import crypto from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { NodeHttpHandler } from "@smithy/node-http-handler"
import sharp from "sharp"

export interface UploadAssetResult {
  key: string
  url: string
  provider: "cloudflare_r2" | "local_r2_fallback"
  sizeBytes: number
}

export interface CreatePresignedUploadUrlOptions {
  filename: string
  contentType: string
  folder?: string
  sizeBytes?: number
}

export interface PresignedUploadUrlResult {
  uploadUrl: string
  publicUrl: string
  key: string
  mode: "r2_presigned" | "local_put"
  expiresInSeconds: number
}

export interface OptimizedSocialAssetResult {
  socialJpegUrl: string
  key: string
  width: number
  height: number
  sizeBytes: number
}

export interface DeleteR2ObjectsResult {
  deleted: string[]
  errors: Array<{ key: string; message: string }>
  provider: "cloudflare_r2" | "local_r2_fallback"
}

export interface R2S3ClientLike {
  send(
    command: PutObjectCommand | GetObjectCommand | DeleteObjectsCommand,
    options?: { abortSignal?: AbortSignal }
  ): Promise<unknown>
}

export const PRIVATE_MEDIA_PREFIXES = [
  "passports/",
  "whatsapp-media/",
  "quotes/",
  "quotations/",
  "receipts/",
] as const

/**
 * Codified Cloudflare R2 bucket lifecycle & retention policy (`OD-06`, `T-052`).
 */
export const R2_LIFECYCLE_RULES = Object.freeze({
  abortIncompleteMultipartUploadDays: 1,
  passportRetentionDaysAfterReturn: 60,
  unbookedLeadMediaRetentionDays: 730,
  financialReceiptRetentionDays: 2190,
} as const)

const S3_CONNECTION_TIMEOUT_MS = 10_000
const S3_REQUEST_TIMEOUT_MS = 30_000
const MAX_SHARP_INPUT_PIXELS = 67_108_864 // 8192 x 8192 decompression-bomb guard
const DEFAULT_MEDIA_TOKEN_TTL_SECONDS = 600 // 10 minutes
const MIN_PRESIGNED_READ_TTL_SECONDS = 300 // 5 minutes
const MAX_PRESIGNED_READ_TTL_SECONDS = 900 // 15 minutes

let cachedS3ClientKey = ""
let cachedS3Client: S3Client | null = null
let s3ClientOverrideForTests: R2S3ClientLike | null = null

export function setR2S3ClientOverrideForTests(
  client: R2S3ClientLike | null
): void {
  s3ClientOverrideForTests = client
}

function getOrCreateR2S3Client(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string
): S3Client {
  const secretDigest = crypto
    .createHash("sha256")
    .update(secretAccessKey, "utf8")
    .digest("hex")
    .slice(0, 16)
  const cacheKey = `${accountId}|${accessKeyId}|${secretDigest}`

  if (cachedS3Client && cachedS3ClientKey === cacheKey) {
    return cachedS3Client
  }

  cachedS3Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    maxAttempts: 3,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    requestHandler: new NodeHttpHandler({
      connectionTimeout: S3_CONNECTION_TIMEOUT_MS,
      requestTimeout: S3_REQUEST_TIMEOUT_MS,
    }),
  })
  cachedS3ClientKey = cacheKey
  return cachedS3Client
}

function getActiveS3Sender(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string
): R2S3ClientLike {
  if (s3ClientOverrideForTests) {
    return s3ClientOverrideForTests
  }
  return getOrCreateR2S3Client(accountId, accessKeyId, secretAccessKey)
}

export function sanitizeStorageKey(rawKey: string): string {
  if (rawKey.includes("\0")) {
    throw new Error("Invalid storage key: null byte detected")
  }

  const segments = rawKey
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "_"))

  if (segments.length === 0) {
    throw new Error("Invalid storage key: key is empty after sanitization")
  }

  return segments.join("/")
}

export function isPrivateMediaKey(rawKey: string): boolean {
  try {
    const normalized = sanitizeStorageKey(rawKey).toLowerCase()
    return PRIVATE_MEDIA_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  } catch {
    return false
  }
}

export function buildMediaProxyPath(rawKey: string): string {
  const sanitized = sanitizeStorageKey(rawKey)
  const encoded = sanitized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `/api/media/${encoded}`
}

/**
 * Generates an immutable, cache-busting object key (`<folder>/<timestamp>-<16hex>-<filename>`)
 * so regenerated posters, spotlights, and quotation PDFs never serve stale CDN bytes (`T-052`).
 */
export function buildVersionedStorageKey(
  folder: string,
  filename: string,
  versionTag?: string
): string {
  const cleanFolder = sanitizeStorageKey(folder || "uploads")
  const cleanName = path
    .basename(filename || "asset.bin")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
  const tag =
    versionTag?.trim().replace(/[^a-zA-Z0-9_-]/g, "") ||
    `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`
  return `${cleanFolder}/${tag}-${cleanName}`
}

interface ResolvedR2Env {
  configured: boolean
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicBaseUrl: string
}

function resolveR2Env(options: { requirePublicUrl: boolean }): ResolvedR2Env {
  const isProd = process.env.NODE_ENV === "production"
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? ""
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? ""
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? ""
  const rawBucket = process.env.R2_BUCKET_NAME?.trim() ?? ""
  const publicBaseUrl = (process.env.R2_PUBLIC_URL?.trim() ?? "").replace(
    /\/+$/,
    ""
  )

  const hasCredentials = Boolean(accountId && accessKeyId && secretAccessKey)

  if (isProd) {
    if (!hasCredentials || !rawBucket) {
      throw new Error(
        "Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required in production; local disk fallback is disabled."
      )
    }
    if (options.requirePublicUrl && !publicBaseUrl) {
      throw new Error(
        "R2_PUBLIC_URL is required in production for public object storage URLs."
      )
    }
  }

  return {
    configured: hasCredentials,
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName: rawBucket || "al-ramlah-assets",
    publicBaseUrl,
  }
}

export function hasR2CredentialsConfigured(): boolean {
  return Boolean(
    (process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim()) ||
      s3ClientOverrideForTests
  )
}

function getLocalFallbackRootDir(isPrivate: boolean): string {
  // Never write private PII files or test artifacts into `public/uploads/`
  if (isPrivate || process.env.NODE_ENV === "test") {
    return path.join(os.tmpdir(), "alramlah-r2-local")
  }
  return path.join(process.cwd(), "public", "uploads", "r2-local")
}

function resolveSafeLocalPath(rootDir: string, sanitizedKey: string): string {
  const resolvedRoot = path.resolve(rootDir)
  const targetPath = path.resolve(resolvedRoot, ...sanitizedKey.split("/"))
  if (
    !targetPath.startsWith(resolvedRoot + path.sep) &&
    targetPath !== resolvedRoot
  ) {
    throw new Error("Invalid storage key: path traversal outside storage root")
  }
  return targetPath
}

function inferMimeTypeFromExtension(key: string): string {
  const ext = path.extname(key).toLowerCase()
  switch (ext) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".webp":
      return "image/webp"
    case ".pdf":
      return "application/pdf"
    case ".mp4":
      return "video/mp4"
    case ".mov":
      return "video/quicktime"
    default:
      return "application/octet-stream"
  }
}

function deriveMediaTokenKey(): Buffer {
  const rawSecret =
    process.env.ENCRYPTION_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    ""

  if (rawSecret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY or BETTER_AUTH_SECRET (>= 32 chars) is required in production to sign private media URLs."
      )
    }
    const devFallback =
      rawSecret || "alramlah-dev-only-media-proxy-fallback-secret-key"
    return Buffer.from(
      crypto.hkdfSync(
        "sha256",
        devFallback,
        "alramlah-media-proxy-v1",
        "media-read-token",
        32
      )
    )
  }

  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      rawSecret,
      "alramlah-media-proxy-v1",
      "media-read-token",
      32
    )
  )
}

function computeMediaTokenHmacHex(sanitizedKey: string, expUnixSec: number): string {
  const signingKey = deriveMediaTokenKey()
  return crypto
    .createHmac("sha256", signingKey)
    .update(`${sanitizedKey}:${expUnixSec}`, "utf8")
    .digest("hex")
}

/**
 * Generates a short-lived (`10m` default, max `15m`) HMAC-signed URL pointing to
 * `/api/media/<key>?exp=<unix>&sig=<hmac>` for authorized viewing of private PII objects.
 */
export function createSignedMediaProxyUrl(
  rawKey: string,
  options?: {
    ttlSeconds?: number
    baseUrl?: string
    nowMs?: number
  }
): string {
  const sanitizedKey = sanitizeStorageKey(rawKey)
  const ttlSeconds = Math.max(
    60,
    Math.min(
      MAX_PRESIGNED_READ_TTL_SECONDS,
      Math.floor(options?.ttlSeconds ?? DEFAULT_MEDIA_TOKEN_TTL_SECONDS)
    )
  )
  const nowSec = Math.floor((options?.nowMs ?? Date.now()) / 1000)
  const exp = nowSec + ttlSeconds
  const sig = computeMediaTokenHmacHex(sanitizedKey, exp)
  const proxyPath = buildMediaProxyPath(sanitizedKey)
  const base = options?.baseUrl?.trim().replace(/\/+$/, "") ?? ""
  return `${base}${proxyPath}?exp=${exp}&sig=${sig}`
}

/**
 * Verifies a short-lived HMAC-signed `/api/media/[...key]` query token in constant time.
 */
export function verifySignedMediaProxyToken(params: {
  key: string
  exp: string | number | null | undefined
  sig: string | null | undefined
  nowMs?: number
}): boolean {
  if (params.exp === null || params.exp === undefined || !params.sig) {
    return false
  }

  let sanitizedKey: string
  try {
    sanitizedKey = sanitizeStorageKey(params.key)
  } catch {
    return false
  }

  const expSec =
    typeof params.exp === "number"
      ? Math.floor(params.exp)
      : Number.parseInt(String(params.exp), 10)
  if (!Number.isFinite(expSec) || expSec <= 0) {
    return false
  }

  const nowSec = Math.floor((params.nowMs ?? Date.now()) / 1000)
  // Reject expired tokens and excessively far-future tokens (> 16 minutes)
  if (expSec <= nowSec || expSec > nowSec + MAX_PRESIGNED_READ_TTL_SECONDS + 60) {
    return false
  }

  const providedSig = params.sig.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(providedSig)) {
    return false
  }

  const expectedSig = computeMediaTokenHmacHex(sanitizedKey, expSec)
  const providedBuf = Buffer.from(providedSig, "hex")
  const expectedBuf = Buffer.from(expectedSig, "hex")
  if (providedBuf.byteLength !== expectedBuf.byteLength) {
    return false
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf)
}

/**
 * Generates a short-lived (`5–15m`) presigned R2 `GetObjectCommand` URL for private PII objects.
 */
export async function createPresignedReadUrl(
  rawKey: string,
  options?: { expiresInSeconds?: number }
): Promise<string> {
  const sanitizedKey = sanitizeStorageKey(rawKey)
  const r2 = resolveR2Env({ requirePublicUrl: false })
  if (!r2.configured) {
    throw new Error("Cannot presign R2 GET URL when R2 credentials are not configured.")
  }

  const expiresIn = Math.max(
    MIN_PRESIGNED_READ_TTL_SECONDS,
    Math.min(
      MAX_PRESIGNED_READ_TTL_SECONDS,
      Math.floor(options?.expiresInSeconds ?? DEFAULT_MEDIA_TOKEN_TTL_SECONDS)
    )
  )

  const s3 = getOrCreateR2S3Client(
    r2.accountId,
    r2.accessKeyId,
    r2.secretAccessKey
  )
  const command = new GetObjectCommand({
    Bucket: r2.bucketName,
    Key: sanitizedKey,
    ResponseCacheControl: "private, no-store",
  })

  return getSignedUrl(s3, command, { expiresIn })
}

/**
 * Reads an object stored in the non-production local fallback directory.
 */
export async function readLocalFallbackObject(rawKey: string): Promise<{
  buffer: Buffer
  contentType: string
} | null> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local fallback object reads are disabled in production.")
  }

  const sanitizedKey = sanitizeStorageKey(rawKey)
  const candidateRoots = [
    path.join(os.tmpdir(), "alramlah-r2-local"),
    path.join(process.cwd(), "public", "uploads", "r2-local"),
  ]

  for (const root of candidateRoots) {
    const filePath = resolveSafeLocalPath(root, sanitizedKey)
    try {
      const buffer = await fs.readFile(filePath)
      return {
        buffer,
        contentType: inferMimeTypeFromExtension(sanitizedKey),
      }
    } catch {
      // Check next fallback candidate
    }
  }

  return null
}

/**
 * Uploads a binary asset to Cloudflare R2 via official `@aws-sdk/client-s3` (`PutObjectCommand`)
 * with bounded `NodeHttpHandler` + `AbortSignal.timeout(30_000)` timeouts.
 *
 * Fails closed in `NODE_ENV=production` if R2 credentials are missing or if R2 returns an error.
 * Private PII prefixes (`passports/`, `whatsapp-media/`, `quotes/`, `quotations/`, `receipts/`)
 * always return `/api/media/<key>` rather than a public CDN URL.
 */
export async function uploadAssetToR2(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<UploadAssetResult> {
  const sanitizedKey = sanitizeStorageKey(key)
  const isPrivate = isPrivateMediaKey(sanitizedKey)
  const r2 = resolveR2Env({ requirePublicUrl: !isPrivate })

  if (r2.configured || s3ClientOverrideForTests) {
    const sender = getActiveS3Sender(
      r2.accountId || "override-account",
      r2.accessKeyId || "override-key",
      r2.secretAccessKey || "override-secret"
    )

    const command = new PutObjectCommand({
      Bucket: r2.bucketName,
      Key: sanitizedKey,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.byteLength,
      CacheControl: isPrivate
        ? "private, no-store"
        : "public, max-age=31536000, immutable",
    })

    await sender.send(command, {
      abortSignal: AbortSignal.timeout(S3_REQUEST_TIMEOUT_MS),
    })

    const url = isPrivate
      ? buildMediaProxyPath(sanitizedKey)
      : r2.publicBaseUrl
        ? `${r2.publicBaseUrl}/${sanitizedKey}`
        : `https://${r2.accountId}.r2.cloudflarestorage.com/${r2.bucketName}/${sanitizedKey}`

    return {
      key: sanitizedKey,
      url,
      provider: "cloudflare_r2",
      sizeBytes: buffer.byteLength,
    }
  }

  // Non-production local fallback
  const rootDir = getLocalFallbackRootDir(isPrivate)
  const localFilePath = resolveSafeLocalPath(rootDir, sanitizedKey)
  await fs.mkdir(path.dirname(localFilePath), { recursive: true })
  await fs.writeFile(localFilePath, buffer)

  const url = isPrivate
    ? buildMediaProxyPath(sanitizedKey)
    : `/uploads/r2-local/${sanitizedKey}`

  return {
    key: sanitizedKey,
    url,
    provider: "local_r2_fallback",
    sizeBytes: buffer.byteLength,
  }
}

export async function uploadBufferToR2(params: {
  key: string
  body: Buffer
  contentType: string
}): Promise<UploadAssetResult & { storage: "r2" | "local_fallback" }> {
  const result = await uploadAssetToR2(
    params.key,
    params.body,
    params.contentType
  )
  return {
    ...result,
    storage: result.provider === "cloudflare_r2" ? "r2" : "local_fallback",
  }
}

/**
 * Extracts a normalized storage key from a CDN URL, `/api/media/...` proxy path,
 * `/uploads/r2-local/...` dev path, or raw key string.
 */
export function extractStorageKeyFromUrlOrKey(
  rawInput: string | null | undefined
): string | null {
  const trimmed = rawInput?.trim()
  if (!trimmed) {
    return null
  }

  const stripQueryAndDecode = (pathPart: string): string => {
    const withoutQuery = pathPart.split("?")[0]?.split("#")[0] ?? ""
    return withoutQuery
      .split("/")
      .map((seg) => {
        try {
          return decodeURIComponent(seg)
        } catch {
          return seg
        }
      })
      .join("/")
  }

  let candidate = trimmed
  const configuredPublicBase = (process.env.R2_PUBLIC_URL?.trim() ?? "").replace(
    /\/+$/,
    ""
  )

  if (configuredPublicBase && candidate.startsWith(`${configuredPublicBase}/`)) {
    candidate = stripQueryAndDecode(
      candidate.slice(configuredPublicBase.length + 1)
    )
  } else if (/^https?:\/\//i.test(candidate)) {
    try {
      const parsed = new URL(candidate)
      let pathname = stripQueryAndDecode(parsed.pathname).replace(/^\/+/, "")
      const bucketName = process.env.R2_BUCKET_NAME?.trim()
      if (
        bucketName &&
        parsed.hostname.endsWith(".r2.cloudflarestorage.com") &&
        pathname.startsWith(`${bucketName}/`)
      ) {
        pathname = pathname.slice(bucketName.length + 1)
      }
      candidate = pathname
    } catch {
      return null
    }
  } else {
    candidate = stripQueryAndDecode(candidate)
  }

  candidate = candidate.replace(/^\/+/, "")
  if (candidate.startsWith("api/media/")) {
    candidate = candidate.slice("api/media/".length)
  } else if (candidate.startsWith("uploads/r2-local/")) {
    candidate = candidate.slice("uploads/r2-local/".length)
  }

  try {
    return sanitizeStorageKey(candidate)
  } catch {
    return null
  }
}

/**
 * Batch-deletes up to N objects from Cloudflare R2 (`DeleteObjectsCommand`, 1000 keys/batch)
 * or unlinks local dev/test fallback files when R2 is unconfigured in non-production (`T-052`).
 */
export async function deleteR2Objects(
  keysOrUrls: readonly string[]
): Promise<DeleteR2ObjectsResult> {
  const uniqueKeys = Array.from(
    new Set(
      keysOrUrls
        .map((item) => extractStorageKeyFromUrlOrKey(item))
        .filter((key): key is string => Boolean(key))
    )
  )

  const r2 = resolveR2Env({ requirePublicUrl: false })

  if (uniqueKeys.length === 0) {
    return {
      deleted: [],
      errors: [],
      provider:
        r2.configured || s3ClientOverrideForTests
          ? "cloudflare_r2"
          : "local_r2_fallback",
    }
  }

  if (r2.configured || s3ClientOverrideForTests) {
    const sender = getActiveS3Sender(
      r2.accountId || "override-account",
      r2.accessKeyId || "override-key",
      r2.secretAccessKey || "override-secret"
    )

    const deleted: string[] = []
    const errors: Array<{ key: string; message: string }> = []

    for (let i = 0; i < uniqueKeys.length; i += 1000) {
      const batch = uniqueKeys.slice(i, i + 1000)
      const command = new DeleteObjectsCommand({
        Bucket: r2.bucketName,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: false,
        },
      })

      const rawResponse = (await sender.send(command, {
        abortSignal: AbortSignal.timeout(S3_REQUEST_TIMEOUT_MS),
      })) as {
        Deleted?: Array<{ Key?: string }>
        Errors?: Array<{ Key?: string; Code?: string; Message?: string }>
      }

      for (const item of rawResponse?.Deleted ?? []) {
        if (item.Key) {
          deleted.push(item.Key)
        }
      }
      for (const err of rawResponse?.Errors ?? []) {
        errors.push({
          key: err.Key ?? "unknown",
          message: err.Message || err.Code || "DeleteObjects error",
        })
      }
    }

    return {
      deleted,
      errors,
      provider: "cloudflare_r2",
    }
  }

  const deleted: string[] = []
  const errors: Array<{ key: string; message: string }> = []
  const candidateRoots = [
    path.join(os.tmpdir(), "alramlah-r2-local"),
    path.join(process.cwd(), "public", "uploads", "r2-local"),
  ]

  for (const key of uniqueKeys) {
    try {
      for (const root of candidateRoots) {
        const target = resolveSafeLocalPath(root, key)
        await fs.unlink(target).catch((err: NodeJS.ErrnoException) => {
          if (err.code !== "ENOENT") {
            throw err
          }
        })
      }
      deleted.push(key)
    } catch (err) {
      errors.push({
        key,
        message: err instanceof Error ? err.message : "Failed to unlink local object",
      })
    }
  }

  return {
    deleted,
    errors,
    provider: "local_r2_fallback",
  }
}

export const deleteAssetsFromR2 = deleteR2Objects

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
}

/**
 * Generates an S3 Signature V4 presigned PUT URL (15 min TTL) binding `ContentType`
 * and `ContentLength` (`sizeBytes`) when R2 is configured, or falls back to `/api/uploads/local`
 * strictly in non-production environments.
 */
export async function createPresignedUploadUrl(
  options: CreatePresignedUploadUrlOptions
): Promise<PresignedUploadUrlResult> {
  const sanitizedFolder = sanitizeStorageKey(options.folder || "uploads")
  const isPrivate = isPrivateMediaKey(`${sanitizedFolder}/placeholder`)
  const r2 = resolveR2Env({ requirePublicUrl: !isPrivate })

  const normalizedContentType = options.contentType.trim().toLowerCase()
  const safeExt =
    EXTENSION_BY_CONTENT_TYPE[normalizedContentType] ?? "bin"
  const uniqueKey = `${sanitizedFolder}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`

  if (r2.configured) {
    const s3 = getOrCreateR2S3Client(
      r2.accountId,
      r2.accessKeyId,
      r2.secretAccessKey
    )
    const hasValidSize =
      typeof options.sizeBytes === "number" &&
      Number.isInteger(options.sizeBytes) &&
      options.sizeBytes > 0

    const command = new PutObjectCommand({
      Bucket: r2.bucketName,
      Key: uniqueKey,
      ContentType: normalizedContentType,
      ...(hasValidSize ? { ContentLength: options.sizeBytes } : {}),
      CacheControl: isPrivate
        ? "private, no-store"
        : "public, max-age=31536000, immutable",
    })

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 })
    const publicUrl = isPrivate
      ? buildMediaProxyPath(uniqueKey)
      : r2.publicBaseUrl
        ? `${r2.publicBaseUrl}/${uniqueKey}`
        : `https://${r2.accountId}.r2.cloudflarestorage.com/${r2.bucketName}/${uniqueKey}`

    return {
      uploadUrl,
      publicUrl,
      key: uniqueKey,
      mode: "r2_presigned",
      expiresInSeconds: 900,
    }
  }

  const publicUrl = isPrivate
    ? buildMediaProxyPath(uniqueKey)
    : `/uploads/r2-local/${uniqueKey}`

  return {
    uploadUrl: `/api/uploads/local?key=${encodeURIComponent(uniqueKey)}`,
    publicUrl,
    key: uniqueKey,
    mode: "local_put",
    expiresInSeconds: 900,
  }
}

/**
 * Resizes a high-resolution 4K poster PNG/JPEG using Sharp with pixel-count bounds,
 * EXIF-oriented dimensions, Warm Ivory alpha flattening (`#FDFBF6`), and single-pass
 * progressive MozJPEG (`1080x1520` portrait) encoding before uploading to R2.
 */
export async function optimizePosterForSocialToR2(
  sourceBuffer: Buffer,
  baseKey: string
): Promise<OptimizedSocialAssetResult> {
  const sanitizedBaseKey = sanitizeStorageKey(baseKey)
  const socialKey = `${sanitizedBaseKey}_${Date.now().toString(36)}_social.jpg`

  const image = sharp(sourceBuffer, {
    limitInputPixels: MAX_SHARP_INPUT_PIXELS,
    sequentialRead: true,
  })
  const meta = await image.metadata()
  const rawWidth = meta.width ?? 1080
  const rawHeight = meta.height ?? 1520
  const swappedByExif = (meta.orientation ?? 1) >= 5
  const orientedWidth = swappedByExif ? rawHeight : rawWidth
  const orientedHeight = swappedByExif ? rawWidth : rawHeight

  let pipeline = image
    .rotate()
    .flatten({ background: "#FDFBF6" })
    .toColorspace("srgb")

  if (Math.min(orientedWidth, orientedHeight) > 1080) {
    if (orientedWidth < orientedHeight) {
      pipeline = pipeline.resize({
        width: 1080,
        height: 1520,
        fit: "cover",
        position: "center",
      })
    } else {
      pipeline = pipeline.resize({
        width: Math.round((orientedWidth / orientedHeight) * 1080),
        height: 1080,
        fit: "inside",
      })
    }
  }

  const { data: jpegBuffer, info } = await pipeline
    .jpeg({
      quality: 90,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer({ resolveWithObject: true })

  const uploadResult = await uploadAssetToR2(
    socialKey,
    jpegBuffer,
    "image/jpeg"
  )

  return {
    socialJpegUrl: uploadResult.url,
    key: uploadResult.key,
    width: info.width || 1080,
    height: info.height || 1520,
    sizeBytes: jpegBuffer.byteLength,
  }
}
