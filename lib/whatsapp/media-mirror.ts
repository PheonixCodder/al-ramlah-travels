import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
} from "@/db/schema/whatsapp-crm"
import { decrypt } from "@/lib/whatsapp/encryption"
import {
  getWhatsAppMediaMetadata,
  downloadWhatsAppMediaBinary,
} from "@/lib/whatsapp/meta-api"
import { uploadAssetToR2 } from "@/lib/storage/r2"

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
  mediaUrl?: string
  mediaMimeType?: string
  mediaFileSize?: number
  r2Key?: string
  provider?: "cloudflare_r2" | "local_r2_fallback"
  error?: string
}

/**
 * Deterministically maps a MIME type string (e.g. `image/jpeg`, `audio/ogg; codecs=opus`)
 * to a clean file extension for R2 storage keys.
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
 * Sanitizes a WhatsApp `wamid` so it is safe to use inside an R2 object key.
 */
export function sanitizeWamidForR2Key(wamid: string): string {
  return wamid.replace(/[^a-zA-Z0-9._-]/g, "_")
}

/**
 * Resolves a volatile Meta `mediaId` (`rawMediaId`) for an inbound WhatsApp message,
 * downloads its binary stream with `Authorization: Bearer <accessToken>`, uploads it
 * to Cloudflare R2 (`whatsapp-media/{accountId}/{conversationId}/{wamid}.{ext}`),
 * and updates `whatsappMessages.mediaUrl`, `mediaMimeType`, `mediaType`, `mediaSha256`,
 * and `mediaFileSize`.
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
    return {
      success: false,
      messageId: input.messageId,
      error: `Unable to resolve WhatsApp account for message ${input.messageId}`,
    }
  }

  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.id, accountId))
    .limit(1)

  if (!account) {
    return {
      success: false,
      messageId: input.messageId,
      error: `WhatsApp account ${accountId} not found`,
    }
  }

  const rawMediaId = input.rawMediaId || msgRow.rawMediaId
  if (!rawMediaId) {
    return {
      success: false,
      messageId: input.messageId,
      error: `No Meta rawMediaId present on message ${input.messageId}`,
    }
  }

  let accessToken = "mock_offline_token"
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    accessToken = account.encryptedAccessToken || "mock_offline_token"
  }

  const initialMime =
    input.fallbackMimeType || msgRow.mediaMimeType || msgRow.mediaType || null

  // 1. Fetch Meta media metadata (temporary download URL, mime_type, sha256, file_size)
  const metadata = await getWhatsAppMediaMetadata({
    mediaId: rawMediaId,
    accessToken,
    fallbackMimeType: initialMime,
  })

  // 2. Download binary payload from temporary URL with Bearer token
  const downloaded = await downloadWhatsAppMediaBinary({
    mediaUrl: metadata.url,
    mediaId: rawMediaId,
    accessToken,
    expectedMimeType: metadata.mime_type || initialMime,
  })

  const finalMimeType =
    metadata.mime_type || downloaded.mimeType || initialMime || "application/octet-stream"
  const ext = resolveExtensionFromMimeType(finalMimeType, msgRow.mediaFilename)
  const sanitizedWamid = sanitizeWamidForR2Key(input.wamid || msgRow.wamid)
  const r2Key = `whatsapp-media/${accountId}/${conversationId}/${sanitizedWamid}.${ext}`

  // 3. Upload binary buffer to Cloudflare R2 (or local public fallback in dev/test)
  const uploaded = await uploadAssetToR2(r2Key, downloaded.buffer, finalMimeType)

  const finalFileSize = metadata.file_size ?? downloaded.fileSize
  const finalSha256 = metadata.sha256 ?? downloaded.sha256 ?? msgRow.mediaSha256 ?? null

  // 4. Persist R2 URL and metadata on whatsappMessages
  await db
    .update(whatsappMessages)
    .set({
      rawMediaId,
      mediaUrl: uploaded.url,
      mediaMimeType: finalMimeType,
      mediaType: finalMimeType,
      mediaSha256: finalSha256,
      mediaFileSize: finalFileSize,
    })
    .where(eq(whatsappMessages.id, msgRow.id))

  return {
    success: true,
    messageId: msgRow.id,
    mediaUrl: uploaded.url,
    mediaMimeType: finalMimeType,
    mediaFileSize: finalFileSize,
    r2Key: uploaded.key,
    provider: uploaded.provider,
  }
}

export const mirrorWhatsappMediaToR2 = mirrorInboundWhatsAppMediaToR2
