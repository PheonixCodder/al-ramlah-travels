import crypto from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
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

function getR2S3Client(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string
): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

async function resolveWranglerOauthToken(): Promise<string | null> {
  if (process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    return process.env.CLOUDFLARE_API_TOKEN.trim()
  }
  const candidatePaths = [
    path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      "xdg.config",
      ".wrangler",
      "config",
      "default.toml"
    ),
    path.join(os.homedir(), ".wrangler", "config", "default.toml"),
  ]
  for (const configPath of candidatePaths) {
    try {
      const content = await fs.readFile(
        /*turbopackIgnore: true*/ configPath,
        "utf8"
      )
      const match = content.match(/oauth_token\s*=\s*"([^"]+)"/)
      if (match?.[1]) {
        return match[1]
      }
    } catch {
      // Ignore missing config file
    }
  }
  return null
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest()
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex")
}

function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Buffer {
  const kDate = hmacSha256("AWS4" + secretAccessKey, dateStamp)
  const kRegion = hmacSha256(kDate, regionName)
  const kService = hmacSha256(kRegion, serviceName)
  return hmacSha256(kService, "aws4_request")
}

/**
 * Uploads a binary asset (PNG, JPEG, PDF) to Cloudflare R2 Object Storage using
 * S3-compatible AWS Signature V4, or seamlessly falls back to `public/uploads/r2-local/`
 * when R2 environment credentials are not configured.
 */
export async function uploadAssetToR2(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<UploadAssetResult> {
  const sanitizedKey = key.replace(/^\/+/, "").replace(/\.\./g, "")
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucketName = process.env.R2_BUCKET_NAME?.trim() || "al-ramlah-assets"
  const publicBaseUrl = process.env.R2_PUBLIC_URL?.trim()?.replace(/\/+$/, "")

  if (accountId && accessKeyId && secretAccessKey) {
    try {
      const host = `${accountId}.r2.cloudflarestorage.com`
      const region = "auto"
      const service = "s3"
      const now = new Date()
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "")
      const dateStamp = amzDate.slice(0, 8)
      const payloadHash = sha256Hex(buffer)
      const canonicalUri = `/${bucketName}/${sanitizedKey
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`

      const canonicalHeaders =
        `content-type:${contentType}\n` +
        `host:${host}\n` +
        `x-amz-content-sha256:${payloadHash}\n` +
        `x-amz-date:${amzDate}\n`
      const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date"

      const canonicalRequest = [
        "PUT",
        canonicalUri,
        "",
        canonicalHeaders,
        signedHeaders,
        payloadHash,
      ].join("\n")

      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
      const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
      ].join("\n")

      const signingKey = getSignatureKey(
        secretAccessKey,
        dateStamp,
        region,
        service
      )
      const signature = crypto
        .createHmac("sha256", signingKey)
        .update(stringToSign, "utf8")
        .digest("hex")

      const authorizationHeader =
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`

      const endpointUrl = `https://${host}${canonicalUri}`
      const res = await fetch(endpointUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "x-amz-content-sha256": payloadHash,
          "x-amz-date": amzDate,
          Authorization: authorizationHeader,
        },
        body: new Uint8Array(buffer),
      })

      if (res.ok) {
        const publicUrl = publicBaseUrl
          ? `${publicBaseUrl}/${sanitizedKey}`
          : endpointUrl
        return {
          key: sanitizedKey,
          url: publicUrl,
          provider: "cloudflare_r2",
          sizeBytes: buffer.byteLength,
        }
      } else {
        console.warn(
          `[R2] S3 upload responded with ${res.status}, checking Wrangler OAuth fallback.`
        )
      }
    } catch (err) {
      console.warn("[R2] S3 upload error, checking Wrangler OAuth fallback:", err)
    }
  }

  // Secondary Cloudflare R2 REST API upload using Wrangler OAuth token or CLOUDFLARE_API_TOKEN
  if (accountId) {
    const oauthToken = await resolveWranglerOauthToken()
    if (oauthToken) {
      try {
        const encodedKey = sanitizedKey
          .split("/")
          .map(encodeURIComponent)
          .join("/")
        const restEndpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucketName)}/objects/${encodedKey}`
        const res = await fetch(restEndpoint, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${oauthToken}`,
            "Content-Type": contentType,
          },
          body: new Uint8Array(buffer),
        })

        if (res.ok) {
          const publicUrl = publicBaseUrl
            ? `${publicBaseUrl}/${sanitizedKey}`
            : `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${encodedKey}`
          return {
            key: sanitizedKey,
            url: publicUrl,
            provider: "cloudflare_r2",
            sizeBytes: buffer.byteLength,
          }
        }
      } catch (err) {
        console.warn("[R2] REST API upload error, falling back to local disk:", err)
      }
    }
  }

  // Local R2 fallback storage inside public/uploads/r2-local/
  const relativePublicPath = `/uploads/r2-local/${sanitizedKey}`
  const localFilePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "r2-local",
    ...sanitizedKey.split("/")
  )
  await fs.mkdir(path.dirname(localFilePath), { recursive: true })
  await fs.writeFile(localFilePath, buffer)

  return {
    key: sanitizedKey,
    url: relativePublicPath,
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
 * Creates an S3 Signature V4 presigned direct PUT URL (15 min lifetime) targeting Cloudflare R2
 * when credentials exist, or returns a local fallback endpoint (`/api/uploads/local?key=...`)
 * when running offline in development.
 */
export async function createPresignedUploadUrl(
  options: CreatePresignedUploadUrlOptions
): Promise<PresignedUploadUrlResult> {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucketName = process.env.R2_BUCKET_NAME?.trim() || "al-ramlah-assets"
  const publicBaseUrl = process.env.R2_PUBLIC_URL?.trim()?.replace(/\/+$/, "")

  const rawFolder = options.folder || "uploads"
  const sanitizedFolder = rawFolder
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "")
  const cleanFilename = path
    .basename(options.filename)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
  const uniqueKey = `${sanitizedFolder}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${cleanFilename}`

  if (accountId && accessKeyId && secretAccessKey) {
    try {
      const s3 = getR2S3Client(accountId, accessKeyId, secretAccessKey)
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: uniqueKey,
        ContentType: options.contentType,
      })
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 })
      const publicUrl = publicBaseUrl
        ? `${publicBaseUrl}/${uniqueKey}`
        : `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${uniqueKey}`

      return {
        uploadUrl,
        publicUrl,
        key: uniqueKey,
        mode: "r2_presigned",
        expiresInSeconds: 900,
      }
    } catch (err) {
      console.warn(
        "[R2 Presign] Failed to generate S3 presigned URL, falling back to local dev route:",
        err
      )
    }
  }

  return {
    uploadUrl: `/api/uploads/local?key=${encodeURIComponent(uniqueKey)}`,
    publicUrl: `/uploads/r2-local/${uniqueKey}`,
    key: uniqueKey,
    mode: "local_put",
    expiresInSeconds: 900,
  }
}

/**
 * Resizes a high-resolution 4K poster PNG/JPEG using Sharp so that its shortest dimension
 * is <= 1080px (1080x1520 for 3240x4560 posters), converts it to a progressive sRGB JPEG (quality: 90),
 * and uploads it to R2 / local disk fallback.
 */
export async function optimizePosterForSocialToR2(
  sourceBuffer: Buffer,
  baseKey: string
): Promise<OptimizedSocialAssetResult> {
  const sanitizedBaseKey = baseKey.replace(/^\/+/, "").replace(/\.\./g, "")
  const socialKey = `${sanitizedBaseKey}_social.jpg`

  const image = sharp(sourceBuffer)
  const meta = await image.metadata()
  const origWidth = meta.width ?? 1080
  const origHeight = meta.height ?? 1520

  let pipeline = image.rotate() // auto-orient based on EXIF

  // If shortest side is > 1080, resize to standard 1080x1520 for posters
  if (Math.min(origWidth, origHeight) > 1080) {
    if (origWidth < origHeight) {
      pipeline = pipeline.resize({
        width: 1080,
        height: 1520,
        fit: "cover",
        position: "center",
      })
    } else {
      pipeline = pipeline.resize({
        width: Math.round((origWidth / origHeight) * 1080),
        height: 1080,
        fit: "inside",
      })
    }
  }

  const jpegBuffer = await pipeline
    .jpeg({
      quality: 90,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer()

  const finalMeta = await sharp(jpegBuffer).metadata()
  const finalWidth = finalMeta.width ?? 1080
  const finalHeight = finalMeta.height ?? 1520

  const uploadResult = await uploadAssetToR2(
    socialKey,
    jpegBuffer,
    "image/jpeg"
  )

  return {
    socialJpegUrl: uploadResult.url,
    key: uploadResult.key,
    width: finalWidth,
    height: finalHeight,
    sizeBytes: jpegBuffer.byteLength,
  }
}
