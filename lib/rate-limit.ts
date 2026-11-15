import crypto from "node:crypto"
import { lt, sql } from "drizzle-orm"
import { db, type Database } from "@/db"
import { rateLimitBuckets } from "@/db/schema/audit-logs"
import { logger } from "./logger"

export interface RateLimitOptions {
  max?: number
  windowSec?: number
  database?: Database | null
  useMemoryOnly?: boolean
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterSec: number
  resetAt: Date
}

export class RateLimitExceededError extends Error {
  public readonly statusCode = 429
  public readonly retryAfterSec: number

  constructor(message: string, retryAfterSec: number) {
    super(message)
    this.name = "RateLimitExceededError"
    this.retryAfterSec = retryAfterSec
  }
}

interface MemoryBucket {
  count: number
  windowStartedAtMs: number
  expiresAtMs: number
}

const memoryBuckets = new Map<string, MemoryBucket>()

export function clearMemoryRateLimitsForTests(): void {
  memoryBuckets.clear()
}

export function hashIp(ip: string): string {
  const normalized = ip.trim().toLowerCase() || "unknown"
  const salt =
    process.env.BETTER_AUTH_SECRET?.slice(0, 16) || "alramlah-ip-salt-v1"
  return crypto
    .createHash("sha256")
    .update(`${salt}:${normalized}`)
    .digest("hex")
    .slice(0, 32)
}

export function extractClientIp(
  headers?:
    | Headers
    | Record<string, string | string[] | undefined>
    | null
): string {
  if (!headers) {
    return "127.0.0.1"
  }

  const readHeader = (name: string): string | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name) ?? undefined
    }
    const direct = headers[name] ?? headers[name.toLowerCase()]
    if (Array.isArray(direct)) {
      return direct[0]
    }
    return direct
  }

  if (process.env.CLOUDFLARE_PROXY === "true") {
    const cfIp = readHeader("cf-connecting-ip")?.trim()
    if (cfIp) {
      return cfIp
    }
  }

  if (process.env.VERCEL === "1") {
    const vercelForwarded = readHeader("x-vercel-forwarded-for")
      ?.split(",")[0]
      ?.trim()
    if (vercelForwarded) {
      return vercelForwarded
    }
  }

  const realIp = readHeader("x-real-ip")?.trim()
  if (realIp) {
    return realIp
  }

  const forwarded = readHeader("x-forwarded-for")
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0)
    const rightmostTrusted = hops[hops.length - 1]
    if (rightmostTrusted) {
      return rightmostTrusted
    }
  }

  return "127.0.0.1"
}

function enforceMemoryRateLimit(
  bucketKey: string,
  max: number,
  windowSec: number
): RateLimitResult {
  const nowMs = Date.now()
  if (memoryBuckets.size > 5_000) {
    for (const [k, v] of memoryBuckets.entries()) {
      if (v.expiresAtMs <= nowMs) {
        memoryBuckets.delete(k)
      }
    }
  }

  const existing = memoryBuckets.get(bucketKey)
  if (!existing || existing.expiresAtMs <= nowMs) {
    const expiresAtMs = nowMs + windowSec * 1000
    memoryBuckets.set(bucketKey, {
      count: 1,
      windowStartedAtMs: nowMs,
      expiresAtMs,
    })
    return {
      allowed: true,
      limit: max,
      remaining: Math.max(0, max - 1),
      retryAfterSec: 0,
      resetAt: new Date(expiresAtMs),
    }
  }

  existing.count += 1
  const allowed = existing.count <= max
  const retryAfterSec = allowed
    ? 0
    : Math.max(1, Math.ceil((existing.expiresAtMs - nowMs) / 1000))

  return {
    allowed,
    limit: max,
    remaining: Math.max(0, max - existing.count),
    retryAfterSec,
    resetAt: new Date(existing.expiresAtMs),
  }
}

/**
 * Enforces fixed-window atomic rate limiting backed by PostgreSQL `rate_limit_buckets`
 * so limits hold across serverless instances, with automatic in-memory fallback for pure unit tests.
 */
export async function enforceRateLimit(
  namespace: string,
  identifier: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const max = Math.max(1, Math.floor(options.max ?? 10))
  const windowSec = Math.max(1, Math.floor(options.windowSec ?? 60))
  const cleanNamespace = namespace.trim().slice(0, 80) || "default"
  const hashedId = hashIp(identifier)
  const bucketKey = `${cleanNamespace}:${hashedId}`

  if (options.useMemoryOnly) {
    return enforceMemoryRateLimit(bucketKey, max, windowSec)
  }

  const targetDb = options.database === undefined ? db : options.database
  if (!targetDb) {
    return enforceMemoryRateLimit(bucketKey, max, windowSec)
  }

  try {
    const now = new Date()
    const nextExpiresAt = new Date(now.getTime() + windowSec * 1000)

    const upserted = await targetDb.execute(sql`
      INSERT INTO "rate_limit_buckets" ("key", "count", "window_started_at", "expires_at")
      VALUES (${bucketKey}, 1, ${now.toISOString()}::timestamptz, ${nextExpiresAt.toISOString()}::timestamptz)
      ON CONFLICT ("key") DO UPDATE
      SET
        "count" = CASE
          WHEN "rate_limit_buckets"."expires_at" <= ${now.toISOString()}::timestamptz THEN 1
          ELSE "rate_limit_buckets"."count" + 1
        END,
        "window_started_at" = CASE
          WHEN "rate_limit_buckets"."expires_at" <= ${now.toISOString()}::timestamptz THEN ${now.toISOString()}::timestamptz
          ELSE "rate_limit_buckets"."window_started_at"
        END,
        "expires_at" = CASE
          WHEN "rate_limit_buckets"."expires_at" <= ${now.toISOString()}::timestamptz THEN ${nextExpiresAt.toISOString()}::timestamptz
          ELSE "rate_limit_buckets"."expires_at"
        END
      RETURNING "count", "expires_at"
    `)

    // Opportunistically prune expired buckets ~2% of requests without blocking errors
    if (Math.random() < 0.02) {
      void targetDb
        .delete(rateLimitBuckets)
        .where(lt(rateLimitBuckets.expiresAt, now))
        .catch(() => undefined)
    }

    const row = upserted.rows[0] as
      | { count?: number | string; expires_at?: string | Date }
      | undefined
    const count = Number(row?.count ?? 1)
    const expiresAt = row?.expires_at
      ? new Date(row.expires_at)
      : nextExpiresAt
    const allowed = count <= max
    const retryAfterSec = allowed
      ? 0
      : Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000))

    return {
      allowed,
      limit: max,
      remaining: Math.max(0, max - count),
      retryAfterSec,
      resetAt: expiresAt,
    }
  } catch (err: unknown) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("PostgreSQL rate_limit_buckets unavailable; falling back to isolate memory bucket", {
        namespace: cleanNamespace,
        error: err,
      })
    }
    return enforceMemoryRateLimit(bucketKey, max, windowSec)
  }
}

export async function assertRateLimit(
  namespace: string,
  identifier: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const res = await enforceRateLimit(namespace, identifier, options)
  if (!res.allowed) {
    throw new RateLimitExceededError(
      `Too many requests. Please wait ${res.retryAfterSec} seconds and try again.`,
      res.retryAfterSec
    )
  }
  return res
}
