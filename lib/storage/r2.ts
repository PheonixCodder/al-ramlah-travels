import crypto from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export interface UploadAssetResult {
  key: string
  url: string
  provider: "cloudflare_r2" | "local_r2_fallback"
  sizeBytes: number
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
      const content = await fs.readFile(configPath, "utf8")
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
