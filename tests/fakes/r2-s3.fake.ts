import { Readable } from "node:stream"
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import {
  isPrivateMediaKey,
  verifySignedMediaProxyToken,
  type R2S3ClientLike,
} from "@/lib/storage/r2"

export interface RecordedR2Object {
  bucket: string
  key: string
  visibility: "private" | "public"
  contentType: string
  cacheControl: string
  sizeBytes: number
  body: Buffer
  uploadedAtIso: string
}

export interface PresignedUrlInspection {
  isHttps: boolean
  hostname: string
  pathname: string
  algorithm: string | null
  expiresSeconds: number | null
  signedHeaders: string[]
  hasSignature: boolean
}

export interface R2S3Fake extends R2S3ClientLike {
  publicObjects: Map<string, RecordedR2Object>
  privateObjects: Map<string, RecordedR2Object>
  deletedKeys: string[]
  getObjectRecord: (key: string) => RecordedR2Object | undefined
  injectFault: (errorMessage: string | null) => void
  inspectPresignedUrl: (rawUrl: string) => PresignedUrlInspection
  verifyMediaProxyUrl: (signedProxyUrl: string, nowMs?: number) => boolean
  reset: () => void
}

async function toBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (Buffer.isBuffer(body)) return Buffer.from(body)
  if (body instanceof Uint8Array) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength)
  }
  if (typeof body === "string") {
    return Buffer.from(body, "utf8")
  }
  if (body instanceof Readable) {
    const chunks: Buffer[] = []
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }
  return Buffer.alloc(0)
}

/**
 * Creates an in-memory Cloudflare R2 / AWS S3 contract fake implementing `R2S3ClientLike` (`T-039`, `T-052`):
 * - Segregates `privateObjects` (`passports/`, `whatsapp-media/`, `quotes/`, `quotations/`, `receipts/`)
 *   from `publicObjects` (`posters/`, `hotels/`, `uploads/`) and verifies `Cache-Control` headers.
 * - Supports `PutObjectCommand`, `GetObjectCommand`, `DeleteObjectsCommand`, presign inspection, and fault injection.
 */
export function createR2S3Fake(): R2S3Fake {
  const publicObjects = new Map<string, RecordedR2Object>()
  const privateObjects = new Map<string, RecordedR2Object>()
  const deletedKeys: string[] = []
  let faultMessage: string | null = null

  return {
    publicObjects,
    privateObjects,
    deletedKeys,

    async send(
      command: PutObjectCommand | GetObjectCommand | DeleteObjectsCommand
    ): Promise<unknown> {
      if (faultMessage) {
        throw new Error(faultMessage)
      }

      if (command instanceof PutObjectCommand) {
        const input = command.input
        const key = input.Key ?? ""
        const bucket = input.Bucket ?? "al-ramlah-assets"
        const body = await toBuffer(input.Body)
        const isPrivate = isPrivateMediaKey(key)
        const record: RecordedR2Object = {
          bucket,
          key,
          visibility: isPrivate ? "private" : "public",
          contentType: input.ContentType ?? "application/octet-stream",
          cacheControl: input.CacheControl ?? "",
          sizeBytes: body.byteLength,
          body,
          uploadedAtIso: new Date().toISOString(),
        }

        if (isPrivate) {
          privateObjects.set(key, record)
          publicObjects.delete(key)
        } else {
          publicObjects.set(key, record)
          privateObjects.delete(key)
        }

        return { ETag: `"fake-etag-${body.byteLength}"` }
      }

      if (command instanceof GetObjectCommand) {
        const key = command.input.Key ?? ""
        const found = privateObjects.get(key) ?? publicObjects.get(key)
        if (!found) {
          const err = new Error(`NoSuchKey: The specified key '${key}' does not exist.`)
          Object.assign(err, { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } })
          throw err
        }
        return {
          ContentType: found.contentType,
          ContentLength: found.sizeBytes,
          CacheControl: found.cacheControl,
          Body: {
            transformToByteArray: async () => new Uint8Array(found.body),
          },
        }
      }

      if (command instanceof DeleteObjectsCommand) {
        const objects = command.input.Delete?.Objects ?? []
        const deleted: Array<{ Key: string }> = []
        for (const obj of objects) {
          if (obj.Key) {
            privateObjects.delete(obj.Key)
            publicObjects.delete(obj.Key)
            deletedKeys.push(obj.Key)
            deleted.push({ Key: obj.Key })
          }
        }
        return {
          Deleted: deleted,
          Errors: [],
        }
      }

      throw new Error("Unsupported S3 command on R2S3Fake")
    },

    getObjectRecord(key: string): RecordedR2Object | undefined {
      return privateObjects.get(key) ?? publicObjects.get(key)
    },

    injectFault(errorMessage: string | null): void {
      faultMessage = errorMessage
    },

    inspectPresignedUrl(rawUrl: string): PresignedUrlInspection {
      const parsed = new URL(rawUrl)
      const expiresRaw = parsed.searchParams.get("X-Amz-Expires")
      const signedHeadersRaw = parsed.searchParams.get("X-Amz-SignedHeaders") ?? ""
      const signature = parsed.searchParams.get("X-Amz-Signature") ?? ""
      return {
        isHttps: parsed.protocol === "https:",
        hostname: parsed.hostname,
        pathname: parsed.pathname,
        algorithm: parsed.searchParams.get("X-Amz-Algorithm"),
        expiresSeconds: expiresRaw ? Number.parseInt(expiresRaw, 10) : null,
        signedHeaders: signedHeadersRaw
          ? signedHeadersRaw.split(";").filter(Boolean)
          : [],
        hasSignature: /^[0-9a-f]{64}$/i.test(signature),
      }
    },

    verifyMediaProxyUrl(signedProxyUrl: string, nowMs?: number): boolean {
      const parsed = new URL(signedProxyUrl, "http://127.0.0.1:3000")
      if (!parsed.pathname.startsWith("/api/media/")) {
        return false
      }
      const rawKey = parsed.pathname
        .slice("/api/media/".length)
        .split("/")
        .map((seg) => decodeURIComponent(seg))
        .join("/")
      return verifySignedMediaProxyToken({
        key: rawKey,
        exp: parsed.searchParams.get("exp"),
        sig: parsed.searchParams.get("sig"),
        nowMs,
      })
    },

    reset(): void {
      publicObjects.clear()
      privateObjects.clear()
      deletedKeys.length = 0
      faultMessage = null
    },
  }
}
