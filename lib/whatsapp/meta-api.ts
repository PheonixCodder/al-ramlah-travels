import {
  buildSendComponents,
  type SendTimeParams,
  type TemplateDefinition,
} from "./template-send-builder"

export const META_API_VERSION = "v21.0"
export const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

export interface MetaSendResult {
  messageId: string
}

export interface MetaPhoneInfo {
  id: string
  display_phone_number: string
  verified_name?: string
  quality_rating?: string
  is_on_biz_app?: boolean
  platform_type?: string
  status?: string
  code_verification_status?: string
}

export interface MetaPhoneHealth {
  id: string
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
  whatsapp_business_manager_messaging_limit?: string
  is_on_biz_app?: boolean
  platform_type?: string
  status?: string
}

export interface MetaErrorPayload {
  error?: {
    message?: string
    code?: number
    error_subcode?: number
    type?: string
    fbtrace_id?: string
    error_data?: { messaging_product?: string; details?: string }
  }
}

/**
 * Structured Graph API Error carrying Meta error code, subcode, and fbtrace_id.
 */
export class MetaApiError extends Error {
  readonly code: number | null
  readonly subcode: number | null
  readonly type: string | null
  readonly fbtraceId: string | null
  readonly httpStatus: number
  readonly details: string | null

  constructor(
    message: string,
    fields: {
      code?: number | null
      subcode?: number | null
      type?: string | null
      fbtraceId?: string | null
      httpStatus: number
      details?: string | null
    }
  ) {
    super(message)
    this.name = "MetaApiError"
    this.code = fields.code ?? null
    this.subcode = fields.subcode ?? null
    this.type = fields.type ?? null
    this.fbtraceId = fields.fbtraceId ?? null
    this.httpStatus = fields.httpStatus
    this.details = fields.details ?? null
  }
}

async function readMetaError(
  response: Response,
  fallback: string
): Promise<MetaApiError> {
  let message = fallback
  let envelope: MetaErrorPayload["error"] | undefined
  try {
    const data = (await response.json()) as MetaErrorPayload
    envelope = data.error
    if (envelope?.message) {
      message = envelope.message
    }
  } catch {
    // Body was not JSON
  }

  return new MetaApiError(message, {
    code: typeof envelope?.code === "number" ? envelope.code : null,
    subcode:
      typeof envelope?.error_subcode === "number"
        ? envelope.error_subcode
        : null,
    type: envelope?.type ?? null,
    fbtraceId: envelope?.fbtrace_id ?? null,
    httpStatus: response.status,
    details: envelope?.error_data?.details ?? null,
  })
}

async function throwMetaError(
  response: Response,
  fallback: string
): Promise<never> {
  throw await readMetaError(response, fallback)
}

const BSUID_PATTERN = /^[A-Za-z]{2}\.(?:ENT\.)?[A-Za-z0-9]{4,}$/

export function isBusinessScopedUserId(value: string | null | undefined): boolean {
  return !!value && BSUID_PATTERN.test(value.trim())
}

export function sanitizePhoneForMeta(phone: string): string {
  if (!phone) return ""
  let digits = phone.replace(/\D/g, "")
  if (digits.startsWith("00")) {
    digits = digits.slice(2)
  }
  if (digits.length === 11 && digits.startsWith("03")) {
    return `92${digits.slice(1)}`
  }
  if (digits.length === 10 && digits.startsWith("3")) {
    return `92${digits}`
  }
  return digits
}

function recipientFields(to: string): Record<string, unknown> {
  const trimmed = to.trim()
  if (isBusinessScopedUserId(trimmed)) {
    return { recipient: trimmed }
  }
  return {
    recipient_type: "individual",
    to: sanitizePhoneForMeta(trimmed),
  }
}

// ==========================================
// 1. Account & Phone Verification
// ==========================================

export interface VerifyPhoneNumberArgs {
  phoneNumberId: string
  accessToken: string
}

export async function verifyPhoneNumber(
  args: VerifyPhoneNumberArgs
): Promise<MetaPhoneInfo> {
  const { phoneNumberId, accessToken } = args
  const url = `${META_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,is_on_biz_app,platform_type,status,code_verification_status`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    await throwMetaError(response, `Failed to verify phone number (${response.status})`)
  }
  return (await response.json()) as MetaPhoneInfo
}

export async function fetchPhoneHealth(
  args: VerifyPhoneNumberArgs
): Promise<MetaPhoneHealth> {
  const { phoneNumberId, accessToken } = args
  const headers = { Authorization: `Bearer ${accessToken}` }
  const [response, limitResponse] = await Promise.all([
    fetch(
      `${META_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,is_on_biz_app,platform_type,status`,
      { headers }
    ),
    fetch(
      `${META_API_BASE}/${phoneNumberId}?fields=whatsapp_business_manager_messaging_limit`,
      { headers }
    ).catch(() => null),
  ])

  if (!response.ok) {
    await throwMetaError(response, `Meta API health query error: ${response.status}`)
  }
  const health = (await response.json()) as MetaPhoneHealth
  if (limitResponse && limitResponse.ok) {
    try {
      const limitData = (await limitResponse.json()) as {
        whatsapp_business_manager_messaging_limit?: string
      }
      if (limitData.whatsapp_business_manager_messaging_limit) {
        health.whatsapp_business_manager_messaging_limit =
          limitData.whatsapp_business_manager_messaging_limit
      }
    } catch {
      // ignore JSON parse issue for limit
    }
  }
  return health
}

export const getPhoneNumberHealth = fetchPhoneHealth

export interface RegisterPhoneNumberArgs {
  phoneNumberId: string
  accessToken: string
  pin: string
}

export async function registerPhoneNumber(
  args: RegisterPhoneNumberArgs
): Promise<{ success: boolean; alreadyRegistered: boolean; isCoexistenceSmb?: boolean }> {
  const { phoneNumberId, accessToken, pin } = args
  const url = `${META_API_BASE}/${phoneNumberId}/register`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  })

  if (response.ok) {
    return { success: true, alreadyRegistered: false }
  }

  const err = await readMetaError(
    response,
    `Meta API registration failed: ${response.status}`
  )
  if (/already.*registered/i.test(err.message)) {
    return { success: true, alreadyRegistered: true }
  }
  if (/not available for SMB businesses/i.test(err.message)) {
    // Official Meta Coexistence numbers keep encryption keys on the mobile app
    // and intentionally skip the /register endpoint.
    return { success: true, alreadyRegistered: true, isCoexistenceSmb: true }
  }
  throw err
}

export interface SubscribeWabaArgs {
  wabaId: string
  accessToken: string
}

export async function subscribeWabaToApp(args: SubscribeWabaArgs): Promise<void> {
  const { wabaId, accessToken } = args
  const url = `${META_API_BASE}/${wabaId}/subscribed_apps`
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    await throwMetaError(response, `Failed to subscribe WABA to app: ${response.status}`)
  }
}

/**
 * Triggers Meta Coexistence contact & 6-month conversation history sync
 * (`POST /{phoneNumberId}/smb_app_data`), required within 24h of Embedded Signup v5 onboarding.
 */
export async function syncCoexistenceSmbAppData(args: {
  phoneNumberId: string
  accessToken: string
}): Promise<{ contactsSynced: boolean; historySynced: boolean }> {
  const { phoneNumberId, accessToken } = args
  const url = `${META_API_BASE}/${phoneNumberId}/smb_app_data`
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  const [contactsRes, historyRes] = await Promise.all([
    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        sync_type: "smb_app_state_sync",
      }),
    }).catch(() => null),
    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        sync_type: "history",
      }),
    }).catch(() => null),
  ])

  return {
    contactsSynced: Boolean(contactsRes?.ok),
    historySynced: Boolean(historyRes?.ok),
  }
}

/**
 * Exchanges an Embedded Signup v5 (`FB.login`) authorization code for a Meta Business token.
 */
export async function exchangeEmbeddedSignupCode(args: {
  code: string
  appId?: string
  appSecret?: string
}): Promise<{ accessToken: string }> {
  const appId = args.appId || process.env.META_APP_ID || ""
  const rawSecret = args.appSecret || process.env.META_APP_SECRET || ""
  const appSecret = rawSecret.split(",")[0]?.trim() || ""

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET must be configured in .env")
  }

  const url = new URL(`${META_API_BASE}/oauth/access_token`)
  url.searchParams.set("client_id", appId)
  url.searchParams.set("client_secret", appSecret)
  url.searchParams.set("code", args.code)

  const response = await fetch(url.toString(), { method: "GET" })
  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to exchange Embedded Signup code (${response.status})`
    )
  }

  const data = (await response.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error("Meta OAuth token response did not include access_token")
  }
  return { accessToken: data.access_token }
}

export interface WabaPhoneNumber {
  id: string
  display_phone_number?: string
  verified_name?: string
}

export async function listWabaPhoneNumbers(
  args: SubscribeWabaArgs
): Promise<WabaPhoneNumber[]> {
  const { wabaId, accessToken } = args
  const url = `${META_API_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    await throwMetaError(response, `Failed to list WABA phone numbers: ${response.status}`)
  }
  const data = (await response.json()) as { data?: WabaPhoneNumber[] }
  return data.data ?? []
}

// ==========================================
// 2. Messaging: Text, Media, Documents, Templates
// ==========================================

export interface SendTextMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  text: string
  contextMessageId?: string
}

export async function sendTextMessage(
  args: SendTextMessageArgs
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, text, contextMessageId } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    ...recipientFields(to),
    type: "text",
    text: { body: text },
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    await throwMetaError(response, `Failed to send WhatsApp text message: ${response.status}`)
  }

  const data = (await response.json()) as { messages: Array<{ id: string }> }
  return { messageId: data.messages[0].id }
}

export type MediaKind = "image" | "video" | "document" | "audio"

export interface SendMediaMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  kind: MediaKind
  link: string
  caption?: string
  filename?: string
  contextMessageId?: string
}

export async function sendMediaMessage(
  args: SendMediaMessageArgs
): Promise<MetaSendResult> {
  const {
    phoneNumberId,
    accessToken,
    to,
    kind,
    link,
    caption,
    filename,
    contextMessageId,
  } = args

  if (!link) {
    throw new Error("sendMediaMessage requires a valid link URL.")
  }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const mediaObj: Record<string, unknown> = { link }
  if (caption && kind !== "audio") {
    mediaObj.caption = caption
  }
  if (kind === "document" && filename) {
    mediaObj.filename = filename
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    ...recipientFields(to),
    type: kind,
    [kind]: mediaObj,
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    await throwMetaError(response, `Failed to send WhatsApp ${kind} message: ${response.status}`)
  }

  const data = (await response.json()) as { messages: Array<{ id: string }> }
  return { messageId: data.messages[0].id }
}

export async function sendImageMessage(args: {
  phoneNumberId: string
  accessToken: string
  to: string
  imageUrl: string
  caption?: string
  contextMessageId?: string
}): Promise<MetaSendResult> {
  return sendMediaMessage({
    phoneNumberId: args.phoneNumberId,
    accessToken: args.accessToken,
    to: args.to,
    kind: "image",
    link: args.imageUrl,
    caption: args.caption,
    contextMessageId: args.contextMessageId,
  })
}

export async function sendDocumentMessage(args: {
  phoneNumberId: string
  accessToken: string
  to: string
  documentUrl: string
  filename?: string
  caption?: string
  contextMessageId?: string
}): Promise<MetaSendResult> {
  return sendMediaMessage({
    phoneNumberId: args.phoneNumberId,
    accessToken: args.accessToken,
    to: args.to,
    kind: "document",
    link: args.documentUrl,
    filename: args.filename,
    caption: args.caption,
    contextMessageId: args.contextMessageId,
  })
}

export interface SendTemplateMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  templateName: string
  language?: string
  params?: string[]
  template?: TemplateDefinition
  messageParams?: SendTimeParams
  contextMessageId?: string
}

export async function sendTemplateMessage(
  args: SendTemplateMessageArgs
): Promise<MetaSendResult> {
  const {
    phoneNumberId,
    accessToken,
    to,
    templateName,
    language = "en_US",
    params,
    template,
    messageParams,
    contextMessageId,
  } = args

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const templatePayload: Record<string, unknown> = {
    name: templateName,
    language: { code: language },
  }

  if (template) {
    const components = buildSendComponents(template, {
      body: messageParams?.body ?? params,
      headerText: messageParams?.headerText,
      headerMediaUrl: messageParams?.headerMediaUrl,
      headerMediaId: messageParams?.headerMediaId,
      buttonParams: messageParams?.buttonParams,
    })
    if (components.length > 0) {
      templatePayload.components = components
    }
  } else if (params && params.length > 0) {
    templatePayload.components = [
      {
        type: "body",
        parameters: params.map((p) => ({ type: "text", text: String(p) })),
      },
    ]
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    ...recipientFields(to),
    type: "template",
    template: templatePayload,
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    await throwMetaError(response, `Failed to send WhatsApp template message: ${response.status}`)
  }

  const data = (await response.json()) as { messages: Array<{ id: string }> }
  return { messageId: data.messages[0].id }
}

export async function markWhatsAppMessageAsRead(args: {
  phoneNumberId: string
  accessToken: string
  messageId: string
}): Promise<{ success: boolean }> {
  const { phoneNumberId, accessToken, messageId } = args
  if (!messageId || !messageId.trim()) {
    throw new Error("markWhatsAppMessageAsRead requires a non-empty messageId")
  }

  if (isMetaMockToken(accessToken)) {
    return { success: true }
  }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    })
    if (!response.ok) {
      await throwMetaError(
        response,
        `Failed to mark message as read: ${response.status}`
      )
    }
    return { success: true }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && !(err instanceof MetaApiError)) {
      return { success: true }
    }
    throw err
  }
}

export const markMessageAsRead = markWhatsAppMessageAsRead

// ==========================================
// 2b. Phase 2: Media Metadata & Binary Download
// ==========================================

export interface MetaMediaMetadata {
  id: string
  url: string
  mime_type: string
  sha256?: string
  file_size?: number
}

function isMetaMockToken(accessToken: string | null | undefined): boolean {
  if (!accessToken) return true
  const trimmed = accessToken.trim()
  return (
    process.env.WHATSAPP_MOCK_MODE === "true" ||
    trimmed.startsWith("mock_") ||
    trimmed.startsWith("sim_") ||
    trimmed.startsWith("test_")
  )
}

function inferDefaultMimeTypeFromId(mediaId: string): string {
  const lower = mediaId.toLowerCase()
  if (lower.includes("pdf") || lower.includes("doc")) return "application/pdf"
  if (lower.includes("aud") || lower.includes("ogg") || lower.includes("voice")) {
    return "audio/ogg"
  }
  if (lower.includes("vid") || lower.includes("mp4")) return "video/mp4"
  if (lower.includes("webp") || lower.includes("sticker")) return "image/webp"
  if (lower.includes("png")) return "image/png"
  return "image/jpeg"
}

export async function getWhatsAppMediaMetadata(args: {
  mediaId: string
  accessToken: string
  fallbackMimeType?: string | null
}): Promise<MetaMediaMetadata> {
  const { mediaId, accessToken, fallbackMimeType } = args
  if (!mediaId || !mediaId.trim()) {
    throw new Error("getWhatsAppMediaMetadata requires a valid mediaId")
  }

  const defaultMime = fallbackMimeType || inferDefaultMimeTypeFromId(mediaId)

  if (isMetaMockToken(accessToken)) {
    const mockPayload = Buffer.from(`mock-whatsapp-media:${mediaId}:${defaultMime}`)
    return {
      id: mediaId,
      url: `https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=${encodeURIComponent(mediaId)}&ext=mock`,
      mime_type: defaultMime,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      file_size: mockPayload.byteLength,
    }
  }

  const url = `${META_API_BASE}/${encodeURIComponent(mediaId)}`
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      await throwMetaError(
        response,
        `Failed to fetch WhatsApp media metadata (${response.status})`
      )
    }
    const data = (await response.json()) as Partial<MetaMediaMetadata>
    return {
      id: data.id || mediaId,
      url:
        data.url ||
        `https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=${encodeURIComponent(mediaId)}`,
      mime_type: data.mime_type || defaultMime,
      sha256: data.sha256,
      file_size: typeof data.file_size === "number" ? data.file_size : undefined,
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && !(err instanceof MetaApiError)) {
      const mockPayload = Buffer.from(`mock-whatsapp-media:${mediaId}:${defaultMime}`)
      return {
        id: mediaId,
        url: `https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=${encodeURIComponent(mediaId)}&ext=sim`,
        mime_type: defaultMime,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        file_size: mockPayload.byteLength,
      }
    }
    throw err
  }
}

export const fetchWhatsAppMediaMetadata = getWhatsAppMediaMetadata

export async function downloadWhatsAppMediaBinary(args: {
  mediaUrl?: string
  mediaId?: string
  accessToken: string
  expectedMimeType?: string | null
}): Promise<{
  buffer: Buffer
  contentType: string
  mimeType: string
  sha256?: string
  fileSize: number
}> {
  const { accessToken, expectedMimeType } = args
  let targetUrl = args.mediaUrl
  let resolvedMime = expectedMimeType || "application/octet-stream"
  let resolvedSha256: string | undefined

  if (!targetUrl && args.mediaId) {
    const meta = await getWhatsAppMediaMetadata({
      mediaId: args.mediaId,
      accessToken,
      fallbackMimeType: expectedMimeType,
    })
    targetUrl = meta.url
    resolvedMime = meta.mime_type || resolvedMime
    resolvedSha256 = meta.sha256
  }

  if (!targetUrl) {
    throw new Error("downloadWhatsAppMediaBinary requires either mediaUrl or mediaId")
  }

  if (isMetaMockToken(accessToken) || targetUrl.includes("ext=mock") || targetUrl.includes("ext=sim")) {
    const syntheticBuffer = Buffer.from(
      `AL_RAMLAH_MOCK_MEDIA_BINARY:${args.mediaId || targetUrl}:${resolvedMime}`,
      "utf8"
    )
    return {
      buffer: syntheticBuffer,
      contentType: resolvedMime,
      mimeType: resolvedMime,
      sha256:
        resolvedSha256 ||
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      fileSize: syntheticBuffer.byteLength,
    }
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!response.ok) {
      await throwMetaError(
        response,
        `Failed to download WhatsApp media binary (${response.status})`
      )
    }
    const arrayBuf = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)
    const contentType =
      response.headers.get("content-type") || resolvedMime || "application/octet-stream"
    return {
      buffer,
      contentType,
      mimeType: contentType,
      sha256: resolvedSha256,
      fileSize: buffer.byteLength,
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && !(err instanceof MetaApiError)) {
      const syntheticBuffer = Buffer.from(
        `AL_RAMLAH_SIM_MEDIA_BINARY:${args.mediaId || targetUrl}:${resolvedMime}`,
        "utf8"
      )
      return {
        buffer: syntheticBuffer,
        contentType: resolvedMime,
        mimeType: resolvedMime,
        sha256: resolvedSha256,
        fileSize: syntheticBuffer.byteLength,
      }
    }
    throw err
  }
}

// ==========================================
// 2c. Phase 2: Reactions & Interactive Messages
// ==========================================

export interface SendWhatsAppReactionArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  messageId: string
  emoji: string
}

export async function sendWhatsAppReactionMessage(
  args: SendWhatsAppReactionArgs
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, messageId, emoji } = args
  if (!messageId || !messageId.trim()) {
    throw new Error("sendWhatsAppReactionMessage requires a target messageId")
  }

  if (isMetaMockToken(accessToken)) {
    return { messageId: `wamid.sim_react_${Date.now()}` }
  }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    ...recipientFields(to),
    type: "reaction",
    reaction: {
      message_id: messageId,
      emoji: emoji ?? "",
    },
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      await throwMetaError(
        response,
        `Failed to send WhatsApp reaction message: ${response.status}`
      )
    }

    const data = (await response.json()) as { messages: Array<{ id: string }> }
    return { messageId: data.messages[0].id }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && !(err instanceof MetaApiError)) {
      return { messageId: `wamid.sim_react_${Date.now()}` }
    }
    throw err
  }
}

export const sendReactionMessage = sendWhatsAppReactionMessage

export interface InteractiveReplyButton {
  id: string
  title: string
}

export interface SendInteractiveButtonsArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  headerText?: string
  bodyText: string
  footerText?: string
  buttons: InteractiveReplyButton[]
  contextMessageId?: string
}

export async function sendInteractiveButtonsMessage(
  args: SendInteractiveButtonsArgs
): Promise<MetaSendResult> {
  const {
    phoneNumberId,
    accessToken,
    to,
    headerText,
    bodyText,
    footerText,
    buttons,
    contextMessageId,
  } = args

  if (!bodyText || !bodyText.trim()) {
    throw new Error("Interactive buttons message requires non-empty bodyText")
  }
  if (!Array.isArray(buttons) || buttons.length < 1 || buttons.length > 3) {
    throw new Error("Meta allows between 1 and 3 reply buttons per interactive message")
  }

  const seenIds = new Set<string>()
  const formattedButtons = buttons.map((btn) => {
    const id = btn.id.trim()
    const title = btn.title.trim()
    if (!id) {
      throw new Error("Interactive button id cannot be empty")
    }
    if (!title || title.length > 20) {
      throw new Error(
        `Interactive button title '${title}' must be between 1 and 20 characters`
      )
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate interactive button id '${id}'`)
    }
    seenIds.add(id)
    return {
      type: "reply" as const,
      reply: { id, title },
    }
  })

  if (isMetaMockToken(accessToken)) {
    return { messageId: `wamid.sim_btn_${Date.now()}` }
  }

  const interactive: Record<string, unknown> = {
    type: "button",
    body: { text: bodyText },
    action: {
      buttons: formattedButtons,
    },
  }

  if (headerText && headerText.trim()) {
    interactive.header = {
      type: "text",
      text: headerText.trim().slice(0, 60),
    }
  }
  if (footerText && footerText.trim()) {
    interactive.footer = {
      text: footerText.trim().slice(0, 60),
    }
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    ...recipientFields(to),
    type: "interactive",
    interactive,
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      await throwMetaError(
        response,
        `Failed to send WhatsApp interactive buttons message: ${response.status}`
      )
    }

    const data = (await response.json()) as { messages: Array<{ id: string }> }
    return { messageId: data.messages[0].id }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && !(err instanceof MetaApiError)) {
      return { messageId: `wamid.sim_btn_${Date.now()}` }
    }
    throw err
  }
}

export interface InteractiveListRow {
  id: string
  title: string
  description?: string
}

export interface InteractiveListSection {
  title: string
  rows: InteractiveListRow[]
}

export interface SendInteractiveListArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  headerText?: string
  bodyText: string
  footerText?: string
  buttonText: string
  sections: InteractiveListSection[]
  contextMessageId?: string
}

export async function sendInteractiveListMessage(
  args: SendInteractiveListArgs
): Promise<MetaSendResult> {
  const {
    phoneNumberId,
    accessToken,
    to,
    headerText,
    bodyText,
    footerText,
    buttonText,
    sections,
    contextMessageId,
  } = args

  if (!bodyText || !bodyText.trim()) {
    throw new Error("Interactive list message requires non-empty bodyText")
  }
  if (!buttonText || !buttonText.trim() || buttonText.trim().length > 20) {
    throw new Error("Interactive list buttonText must be between 1 and 20 characters")
  }
  if (!Array.isArray(sections) || sections.length < 1) {
    throw new Error("Interactive list message requires at least 1 section")
  }

  let totalRows = 0
  const formattedSections = sections.map((sec) => {
    const secTitle = sec.title.trim()
    if (!secTitle || secTitle.length > 24) {
      throw new Error(
        `Interactive list section title '${secTitle}' must be 1..24 characters`
      )
    }
    if (!Array.isArray(sec.rows) || sec.rows.length < 1) {
      throw new Error(`Interactive list section '${secTitle}' must have at least 1 row`)
    }
    const rows = sec.rows.map((r) => {
      totalRows++
      const rowId = r.id.trim()
      const rowTitle = r.title.trim()
      if (!rowId) {
        throw new Error("Interactive list row id cannot be empty")
      }
      if (!rowTitle || rowTitle.length > 24) {
        throw new Error(
          `Interactive list row title '${rowTitle}' must be between 1 and 24 characters`
        )
      }
      if (r.description && r.description.length > 72) {
        throw new Error(
          `Interactive list row description for '${rowTitle}' exceeds 72 characters`
        )
      }
      return {
        id: rowId,
        title: rowTitle,
        ...(r.description ? { description: r.description } : {}),
      }
    })
    return {
      title: secTitle,
      rows,
    }
  })

  if (totalRows < 1 || totalRows > 10) {
    throw new Error(
      `Meta allows between 1 and 10 total rows across all list sections (received ${totalRows})`
    )
  }

  if (isMetaMockToken(accessToken)) {
    return { messageId: `wamid.sim_list_${Date.now()}` }
  }

  const interactive: Record<string, unknown> = {
    type: "list",
    body: { text: bodyText },
    action: {
      button: buttonText.trim(),
      sections: formattedSections,
    },
  }

  if (headerText && headerText.trim()) {
    interactive.header = {
      type: "text",
      text: headerText.trim().slice(0, 60),
    }
  }
  if (footerText && footerText.trim()) {
    interactive.footer = {
      text: footerText.trim().slice(0, 60),
    }
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    ...recipientFields(to),
    type: "interactive",
    interactive,
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }

  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      await throwMetaError(
        response,
        `Failed to send WhatsApp interactive list message: ${response.status}`
      )
    }

    const data = (await response.json()) as { messages: Array<{ id: string }> }
    return { messageId: data.messages[0].id }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && !(err instanceof MetaApiError)) {
      return { messageId: `wamid.sim_list_${Date.now()}` }
    }
    throw err
  }
}

// ==========================================
// 3. Message Templates Management
// ==========================================

export type MetaTemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"

export interface MetaRemoteTemplate {
  id: string
  name: string
  status: MetaTemplateStatus
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  language: string
  rejected_reason?: string
  components?: Array<{
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS"
    format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"
    text?: string
    buttons?: Array<Record<string, unknown>>
    example?: Record<string, unknown>
  }>
}

export interface FetchMessageTemplatesArgs {
  wabaId: string
  accessToken: string
}

export async function fetchMessageTemplates(
  args: FetchMessageTemplatesArgs
): Promise<MetaRemoteTemplate[]> {
  const { wabaId, accessToken } = args
  if (isMetaMockToken(accessToken)) {
    return []
  }

  const out: MetaRemoteTemplate[] = []
  let url: string | undefined = `${META_API_BASE}/${wabaId}/message_templates?fields=id,name,status,category,language,rejected_reason,components&limit=100`

  for (let page = 0; url && page < 10; page++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      await throwMetaError(
        response,
        `Failed to fetch message templates from Meta: ${response.status}`
      )
    }
    const data = (await response.json()) as {
      data?: MetaRemoteTemplate[]
      paging?: { next?: string }
    }
    out.push(...(data.data ?? []))
    url = data.paging?.next
  }

  return out
}

export interface CreateMetaTemplateArgs {
  wabaId: string
  accessToken: string
  name: string
  language: string
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  headerText?: string
  bodyText: string
  footerText?: string
  buttons?: Array<
    | { type: "QUICK_REPLY"; text: string }
    | { type: "URL"; text: string; url: string }
    | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  >
}

export async function createMetaMessageTemplate(
  args: CreateMetaTemplateArgs
): Promise<{
  id: string
  status: MetaTemplateStatus
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
}> {
  const {
    wabaId,
    accessToken,
    name,
    language,
    category,
    headerText,
    bodyText,
    footerText,
    buttons,
  } = args

  const normalizedName = name.trim().toLowerCase()
  if (!/^[a-z0-9_]+$/.test(normalizedName)) {
    throw new Error(
      "Meta template name must match ^[a-z0-9_]+$ (lowercase alphanumeric and underscores)"
    )
  }
  if (!bodyText || !bodyText.trim()) {
    throw new Error("Meta template requires non-empty bodyText")
  }

  if (isMetaMockToken(accessToken)) {
    return {
      id: `meta_tmpl_sim_${Date.now()}`,
      status: "PENDING",
      category,
    }
  }

  const components: Array<Record<string, unknown>> = []
  if (headerText && headerText.trim()) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: headerText.trim(),
    })
  }
  components.push({
    type: "BODY",
    text: bodyText.trim(),
  })
  if (footerText && footerText.trim()) {
    components.push({
      type: "FOOTER",
      text: footerText.trim(),
    })
  }
  if (buttons && buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons,
    })
  }

  const url = `${META_API_BASE}/${wabaId}/message_templates`
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: normalizedName,
        language,
        category,
        components,
      }),
    })

    if (!response.ok) {
      await throwMetaError(
        response,
        `Failed to create Meta message template: ${response.status}`
      )
    }

    const data = (await response.json()) as {
      id?: string
      status?: MetaTemplateStatus
      category?: "MARKETING" | "UTILITY" | "AUTHENTICATION"
    }

    return {
      id: data.id || `meta_tmpl_${Date.now()}`,
      status: data.status || "PENDING",
      category: data.category || category,
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && !(err instanceof MetaApiError)) {
      return {
        id: `meta_tmpl_sim_${Date.now()}`,
        status: "PENDING",
        category,
      }
    }
    throw err
  }
}

export interface DeleteMetaTemplateArgs {
  wabaId: string
  accessToken: string
  name: string
}

export async function deleteMetaMessageTemplate(
  args: DeleteMetaTemplateArgs
): Promise<{ success: boolean }> {
  const { wabaId, accessToken, name } = args
  if (!name || !name.trim()) {
    throw new Error("deleteMetaMessageTemplate requires a template name")
  }

  if (isMetaMockToken(accessToken)) {
    return { success: true }
  }

  const url = `${META_API_BASE}/${wabaId}/message_templates?name=${encodeURIComponent(
    name.trim()
  )}`

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      await throwMetaError(
        response,
        `Failed to delete Meta message template '${name}': ${response.status}`
      )
    }

    return { success: true }
  } catch (err) {
    if (process.env.NODE_ENV !== "production" && !(err instanceof MetaApiError)) {
      return { success: true }
    }
    throw err
  }
}

