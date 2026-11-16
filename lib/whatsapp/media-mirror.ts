import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
} from "@/db/schema/whatsapp-crm"
import { uploadAssetToR2 } from "@/lib/storage/r2"
import { decrypt } from "@/lib/whatsapp/encryption"
import {
  downloadWhatsAppMediaBinary,
  getWhatsAppMediaMetadata,
} from "@/lib/whatsapp/meta-api"
import { markWhatsappAccountNeedsReauthIfAuthError } from "./outbox"

export interface MirrorInboundWhatsAppMediaInput {
  messageId: string
  accountId?: string
  conversationId?: string
  rawMediaId?: string
  wamid?: string
  fallbackMimeType?: string | null
}

export interface MirrorInboundWhatsAppMediaResult {
  success: boolean
  messageId: string
  media_status: "mirrored" | "failed"
  mediaUrl?: string
  mediaMimeType?: string
  mediaFileSize?: number
  r2Key?: string
  provider?: "cloudflare_r2" | "local_r2_fallback"
  error?: string
}

/**
 * Deterministically maps a MIME type string to a clean file extension for private R2 storage keys.
 */
export function resolveExtensionFromMimeType(
  mimeType: string | null | undefined,
  filename?: string | null
): string {
  if (filename) {
    const extMatch = filename.trim().match(/\.([a-zA-Z0-9]{2,8})$/)
    if (extMatch?.[1]) {
      return extMatch[1].toLowerCase()
    }
  }

  const normalized = (mimeType || "").split(";")[0]?.trim().toLowerCase() || ""
  switch (normalized) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    case "image/gif":
      return "gif"
    case "application/pdf":
      return "pdf"
    case "audio/ogg":
    case "audio/opus":
      return "ogg"
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3"
    case "audio/mp4":
    case "audio/aac":
      return "m4a"
    case "video/mp4":
      return "mp4"
    case "video/3gpp":
      return "3gp"
    default:
      return "bin"
  }
}

/**
 * Sanitizes a WhatsApp `wamid` so it is safe to use inside an R2 object key (preventing path traversal).
 */
export function sanitizeWamidForR2Key(wamid: string): string {
  return wamid.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, "_")
}

async function markMessageMediaMirrorFailed(
  msgRow: typeof whatsappMessages.$inferSelect,
  errorMessage: string
): Promise<void> {
  const existingRaw =
    msgRow.rawPayload && typeof msgRow.rawPayload === "object"
      ? (msgRow.rawPayload as Record<string, unknown>)
      : {}

  await db
    .update(whatsappMessages)
    .set({
      mediaUrl: null,
      errorCode: "MEDIA_MIRROR_FAILED",
      errorMessage,
      rawPayload: {
        ...existingRaw,
        mediaStatus: "failed",
        media_status: "failed",
        mediaError: errorMessage,
        mediaFailedAt: new Date().toISOString(),
      },
    })
    .where(eq(whatsappMessages.id, msgRow.id))
}

/**
 * Resolves a volatile Meta `mediaId` (`rawMediaId`) for an inbound WhatsApp message,
 * downloads its binary stream with `Authorization: Bearer <accessToken>`, uploads it
 * to the PRIVATE Cloudflare R2 prefix `whatsapp-media/{accountId}/{conversationId}/{wamid}.{ext}`
 * (`OD-06`, `T-065`), and updates `whatsappMessages` with authenticated `/api/media/whatsapp-media/...` proxy URL.
 *
 * Fails closed (`media_status: "failed"`, `mediaUrl: null`) if token decryption, Meta download, or R2 upload fails.
 */
export async function mirrorInboundWhatsAppMediaToR2(
  input: MirrorInboundWhatsAppMediaInput
): Promise<MirrorInboundWhatsAppMediaResult> {
  const [msgRow] = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.id, input.messageId))
    .limit(1)

  if (!msgRow) {
    return {
      success: false,
      messageId: input.messageId,
      media_status: "failed",
      error: `WhatsApp message ${input.messageId} not found`,
    }
  }

  const conversationId = input.conversationId || msgRow.conversationId
  const [convRow] = await db
    .select()
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1)

  const accountId = input.accountId || convRow?.accountId
  if (!accountId) {
    const err = `Unable to resolve WhatsApp account for message ${input.messageId}`
    await markMessageMediaMirrorFailed(msgRow, err)
    return {
      success: false,
      messageId: input.messageId,
      media_status: "failed",
      error: err,
    }
  }

  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.id, accountId))
    .limit(1)

  if (!account) {
    const err = `WhatsApp account ${accountId} not found`
    await markMessageMediaMirrorFailed(msgRow, err)
    return {
      success: false,
      messageId: input.messageId,
      media_status: "failed",
      error: err,
    }
  }

  const rawMediaId = input.rawMediaId || msgRow.rawMediaId
  if (!rawMediaId) {
    const err = `No Meta rawMediaId present on message ${input.messageId}`
    await markMessageMediaMirrorFailed(msgRow, err)
    return {
      success: false,
      messageId: input.messageId,
      media_status: "failed",
      error: err,
    }
  }

  let accessToken = ""
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    const err = "Failed to decrypt Meta WABA access token for media download"
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
      .where(eq(whatsappAccounts.id, account.id))
      .catch(() => null)
    await markMessageMediaMirrorFailed(msgRow, err)
    return {
      success: false,
      messageId: msgRow.id,
      media_status: "failed",
      error: err,
    }
  }

  if (!accessToken) {
    const err = "Meta WABA access token is empty"
    await markMessageMediaMirrorFailed(msgRow, err)
    return {
      success: false,
      messageId: msgRow.id,
      media_status: "failed",
      error: err,
    }
  }

  const initialMime =
    input.fallbackMimeType || msgRow.mediaMimeType || msgRow.mediaType || null

  try {
    const metadata = await getWhatsAppMediaMetadata({
      mediaId: rawMediaId,
      accessToken,
      fallbackMimeType: initialMime,
    })

    const downloaded = await downloadWhatsAppMediaBinary({
      mediaUrl: metadata.url,
      mediaId: rawMediaId,
      accessToken,
      expectedMimeType: metadata.mime_type || initialMime,
    })

    const finalMimeType =
      metadata.mime_type ||
      downloaded.mimeType ||
      initialMime ||
      "application/octet-stream"
    const ext = resolveExtensionFromMimeType(finalMimeType, msgRow.mediaFilename)
    const sanitizedAccount = sanitizeWamidForR2Key(accountId)
    const sanitizedConv = sanitizeWamidForR2Key(conversationId)
    const sanitizedWamid = sanitizeWamidForR2Key(input.wamid || msgRow.wamid)
    const r2Key = `whatsapp-media/${sanitizedAccount}/${sanitizedConv}/${sanitizedWamid}.${ext}`

    const uploaded = await uploadAssetToR2(
      r2Key,
      downloaded.buffer,
      finalMimeType
    )

    const finalFileSize = metadata.file_size ?? downloaded.fileSize
    const finalSha256 =
      metadata.sha256 ?? downloaded.sha256 ?? msgRow.mediaSha256 ?? null
    const existingRaw =
      msgRow.rawPayload && typeof msgRow.rawPayload === "object"
        ? (msgRow.rawPayload as Record<string, unknown>)
        : {}

    await db
      .update(whatsappMessages)
      .set({
        rawMediaId,
        mediaUrl: uploaded.url,
        mediaMimeType: finalMimeType,
        mediaType: finalMimeType,
        mediaSha256: finalSha256,
        mediaFileSize: finalFileSize,
        errorCode: null,
        errorMessage: null,
        rawPayload: {
          ...existingRaw,
          mediaStatus: "mirrored",
          media_status: "mirrored",
          r2Key: uploaded.key,
          mirroredAt: new Date().toISOString(),
        },
      })
      .where(eq(whatsappMessages.id, msgRow.id))

    return {
      success: true,
      messageId: msgRow.id,
      media_status: "mirrored",
      mediaUrl: uploaded.url,
      mediaMimeType: finalMimeType,
      mediaFileSize: finalFileSize,
      r2Key: uploaded.key,
      provider: uploaded.provider,
    }
  } catch (err: unknown) {
    await markWhatsappAccountNeedsReauthIfAuthError(account.id, err)
    const errMsg =
      err instanceof Error ? err.message : "Inbound WhatsApp media mirror failed"
    await markMessageMediaMirrorFailed(msgRow, errMsg)
    return {
      success: false,
      messageId: msgRow.id,
      media_status: "failed",
      error: errMsg,
    }
  }
}

export const mirrorWhatsappMediaToR2 = mirrorInboundWhatsAppMediaToR2
