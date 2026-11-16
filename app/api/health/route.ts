import crypto from "node:crypto"
import { sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { getAuthenticatedAdminOrNull } from "@/lib/auth-guard"
import { logger } from "@/lib/logger"
import { fetchWithTimeout } from "@/lib/security/fetch-with-timeout"

export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow",
} as const

function verifyHealthBearerToken(authHeader: string | null): boolean {
  const configuredToken = process.env.HEALTHCHECK_BEARER_TOKEN?.trim()
  if (!configuredToken || configuredToken.length < 16 || !authHeader) {
    return false
  }

  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
  if (!match?.[1]) {
    return false
  }

  const providedBuf = Buffer.from(match[1].trim(), "utf8")
  const expectedBuf = Buffer.from(configuredToken, "utf8")
  if (providedBuf.length !== expectedBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf)
}

export async function GET(request: Request): Promise<NextResponse> {
  const searchParams = new URL(request.url).searchParams
  const isDeep =
    searchParams.get("deep") === "1" ||
    searchParams.get("deep") === "true"

  if (!isDeep) {
    return NextResponse.json(
      {
        status: "ok",
        mode: "liveness",
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: NO_STORE_HEADERS }
    )
  }

  // Deep readiness check requires either valid HEALTHCHECK_BEARER_TOKEN or active super_admin session
  const hasValidBearer = verifyHealthBearerToken(
    request.headers.get("authorization")
  )

  let hasSuperAdminSession = false
  if (!hasValidBearer) {
    const adminSession = await getAuthenticatedAdminOrNull(request.headers)
    hasSuperAdminSession = adminSession?.user?.role === "super_admin"
  }

  if (!hasValidBearer && !hasSuperAdminSession) {
    return NextResponse.json(
      {
        status: "unauthorized",
        error: "Deep health probe requires bearer authorization or super_admin session.",
      },
      { status: 401, headers: NO_STORE_HEADERS }
    )
  }

  const checks: Record<
    string,
    { status: "ok" | "degraded" | "unconfigured"; latencyMs?: number }
  > = {}
  let overallHealthy = true

  // 1. PostgreSQL connectivity probe
  const dbStart = Date.now()
  try {
    await db.execute(sql`SELECT 1 AS ok`)
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart }
  } catch (err: unknown) {
    overallHealthy = false
    checks.database = { status: "degraded", latencyMs: Date.now() - dbStart }
    logger.error("Deep health check PostgreSQL probe failed", { error: err })
  }

  // 2. Cloudflare R2 configuration readiness (without leaking bucket/keys)
  const r2Ready = Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET_NAME?.trim()
  )
  checks.r2Storage = { status: r2Ready ? "ok" : "unconfigured" }

  // 3. Gotenberg rendering engine readiness
  const gotenbergUrl =
    process.env.GOTENBERG_API_URL?.trim() || process.env.GOTENBERG_URL?.trim()
  if (!gotenbergUrl) {
    checks.gotenberg = { status: "unconfigured" }
  } else {
    const gotenbergStart = Date.now()
    try {
      const base = gotenbergUrl.replace(/\/+$/, "")
      const headers: Record<string, string> = {}
      const gotenbergApiKey = process.env.GOTENBERG_API_KEY?.trim()
      if (gotenbergApiKey) {
        headers.Authorization = `Bearer ${gotenbergApiKey}`
        headers["X-Gotenberg-Api-Key"] = gotenbergApiKey
      } else if (
        process.env.GOTENBERG_USERNAME &&
        process.env.GOTENBERG_PASSWORD
      ) {
        const credentials = Buffer.from(
          `${process.env.GOTENBERG_USERNAME}:${process.env.GOTENBERG_PASSWORD}`,
          "utf8"
        ).toString("base64")
        headers.Authorization = `Basic ${credentials}`
      }
      const res = await fetchWithTimeout(`${base}/health`, {
        method: "GET",
        headers,
        timeoutMs: 3_000,
      })
      checks.gotenberg = {
        status: res.ok ? "ok" : "degraded",
        latencyMs: Date.now() - gotenbergStart,
      }
    } catch {
      checks.gotenberg = {
        status: "degraded",
        latencyMs: Date.now() - gotenbergStart,
      }
    }
  }

  return NextResponse.json(
    {
      status: overallHealthy ? "ok" : "degraded",
      mode: "readiness",
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: overallHealthy ? 200 : 503,
      headers: NO_STORE_HEADERS,
    }
  )
}
