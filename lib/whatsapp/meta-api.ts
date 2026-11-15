import { parsePhoneE164 } from "@/lib/phone"
import {
  buildSendComponents,
  type SendTimeParams,
  type TemplateDefinition,
} from "./template-send-builder"
import { extractTemplatePlaceholders } from "./template-variables"

export const META_API_VERSION = "v21.0"
export const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`
export const META_GRAPH_TIMEOUT_MS = 15_000

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

/**
 * Returns true if an error represents an expired, revoked, or unauthorized Meta OAuth/System token (`190` or HTTP `401`).
 */
export function isMetaAuthError(err: unknown): boolean {
  if (err instanceof MetaApiError) {
    return err.code === 190 || err.httpStatus === 401
  }
  return false
}

function metaFetch(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = META_GRAPH_TIMEOUT_MS
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  })
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

export function isBusinessScopedUserId(
  value: string | null | undefined
): boolean {
  return !!value && BSUID_PATTERN.test(value.trim())
}

export function isNonIndividualWhatsAppTarget(
  value: string | null | undefined
): boolean {
  if (!value) return false
  const lower = value.trim().toLowerCase()
  return (
    lower.endsWith("@g.us") ||
    lower.endsWith("@newsletter") ||
    lower === "status@broadcast" ||
    lower.endsWith("@broadcast")
  )
}

export function sanitizePhoneForMeta(phone: string): string {
  if (!phone) return ""
  const trimmed = phone.trim()
  if (isNonIndividualWhatsAppTarget(trimmed)) {
    throw new MetaApiError(
      `Meta WhatsApp Cloud API supports 1:1 individual E.164 recipients only (rejected "${trimmed}").`,
      { code: 100, httpStatus: 400 }
    )
  }
  const parsed = parsePhoneE164(trimmed)
  if (parsed.valid) {
    return parsed.e164Digits
  }
  let digits = trimmed.replace(/\D/g, "")
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
  const trimmed = (to || "").trim()
  if (!trimmed) {
    throw new MetaApiError("Recipient phone number is required.", {
      code: 100,
      httpStatus: 400,
    })
  }
  if (isNonIndividualWhatsAppTarget(trimmed)) {
    throw new MetaApiError(
      `Meta WhatsApp Cloud API supports 1:1 E.164 recipients only (rejected "${trimmed}").`,
      { code: 100, httpStatus: 400 }
    )
  }
  if (isBusinessScopedUserId(trimmed)) {
    return { recipient: trimmed }
  }
  const normalizedDigits = sanitizePhoneForMeta(trimmed)
  if (!/^[1-9]\d{9,14}$/.test(normalizedDigits)) {
    throw new MetaApiError(
      `Invalid E.164 WhatsApp recipient phone "${trimmed}".`,
      { code: 100, httpStatus: 400 }
    )
  }
  return {
    recipient_type: "individual",
    to: normalizedDigits,
  }
}

function assertAccessTokenPresent(
  accessToken: string | null | undefined,
  operation: string
): string {
  const trimmed = accessToken?.trim() ?? ""
  if (!trimmed) {
    throw new MetaApiError(
      `${operation} requires a valid Meta Graph API access token.`,
      { code: 190, httpStatus: 401 }
    )
  }
  return trimmed
}

function extractSentMessageId(
  data: { messages?: Array<{ id?: string }> } | null | undefined,
  operation: string
): string {
  const id = data?.messages?.[0]?.id?.trim()
  if (!id) {
    throw new MetaApiError(
      `${operation}: Meta Graph API response did not contain a valid message id.`,
      { httpStatus: 502 }
    )
  }
  return id
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
  const token = assertAccessTokenPresent(args.accessToken, "verifyPhoneNumber")
  const url = `${META_API_BASE}/${encodeURIComponent(args.phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating,is_on_biz_app,platform_type,status,code_verification_status`
  const response = await metaFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to verify phone number (${response.status})`
    )
  }
  return (await response.json()) as MetaPhoneInfo
}

export async function fetchPhoneHealth(
  args: VerifyPhoneNumberArgs
): Promise<MetaPhoneHealth> {
  const token = assertAccessTokenPresent(args.accessToken, "fetchPhoneHealth")
  const encodedId = encodeURIComponent(args.phoneNumberId)
  const headers = { Authorization: `Bearer ${token}` }
  const [response, limitResponse] = await Promise.all([
    metaFetch(
      `${META_API_BASE}/${encodedId}?fields=id,display_phone_number,verified_name,quality_rating,is_on_biz_app,platform_type,status`,
      { headers }
    ),
    metaFetch(
      `${META_API_BASE}/${encodedId}?fields=whatsapp_business_manager_messaging_limit`,
      { headers }
    ).catch(() => null),
  ])

  if (!response.ok) {
    await throwMetaError(
      response,
      `Meta API health query error: ${response.status}`
    )
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
      // ignore JSON parse issue for optional messaging limit field
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
): Promise<{
  success: boolean
  alreadyRegistered: boolean
  isCoexistenceSmb?: boolean
}> {
  const token = assertAccessTokenPresent(
    args.accessToken,
    "registerPhoneNumber"
  )
  const url = `${META_API_BASE}/${encodeURIComponent(args.phoneNumberId)}/register`
  const response = await metaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messaging_product: "whatsapp", pin: args.pin }),
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
    return { success: true, alreadyRegistered: true, isCoexistenceSmb: true }
  }
  throw err
}

export interface SubscribeWabaArgs {
  wabaId: string
  accessToken: string
}

export async function subscribeWabaToApp(args: SubscribeWabaArgs): Promise<void> {
  const token = assertAccessTokenPresent(args.accessToken, "subscribeWabaToApp")
  const url = `${META_API_BASE}/${encodeURIComponent(args.wabaId)}/subscribed_apps`
  const response = await metaFetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to subscribe WABA to app: ${response.status}`
    )
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
  const token = assertAccessTokenPresent(
    args.accessToken,
    "syncCoexistenceSmbAppData"
  )
  const url = `${META_API_BASE}/${encodeURIComponent(args.phoneNumberId)}/smb_app_data`
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }

  const [contactsRes, historyRes] = await Promise.all([
    metaFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        sync_type: "smb_app_state_sync",
      }),
    }).catch(() => null),
    metaFetch(url, {
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

  const response = await metaFetch(url.toString(), { method: "GET" })
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
  const token = assertAccessTokenPresent(
    args.accessToken,
    "listWabaPhoneNumbers"
  )
  const url = `${META_API_BASE}/${encodeURIComponent(args.wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`
  const response = await metaFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to list WABA phone numbers: ${response.status}`
    )
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
  const token = assertAccessTokenPresent(args.accessToken, "sendTextMessage")
  const url = `${META_API_BASE}/${encodeURIComponent(args.phoneNumberId)}/messages`
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    ...recipientFields(args.to),
    type: "text",
    text: { body: args.text },
  }
  if (args.contextMessageId) {
    body.context = { message_id: args.contextMessageId }
  }

  const response = await metaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to send WhatsApp text message: ${response.status}`
    )
  }

  const data = (await response.json()) as { messages?: Array<{ id?: string }> }
  return { messageId: extractSentMessageId(data, "sendTextMessage") }
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

  const token = assertAccessTokenPresent(accessToken, "sendMediaMessage")
  if (!link || !link.trim()) {
    throw new Error("sendMediaMessage requires a valid link URL.")
  }

  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}/messages`
  const mediaObj: Record<string, unknown> = { link: link.trim() }
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

  const response = await metaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to send WhatsApp ${kind} message: ${response.status}`
    )
  }

  const data = (await response.json()) as { messages?: Array<{ id?: string }> }
  return { messageId: extractSentMessageId(data, `sendMediaMessage(${kind})`) }
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

  const token = assertAccessTokenPresent(accessToken, "sendTemplateMessage")
  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}/messages`
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

  const response = await metaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to send WhatsApp template message: ${response.status}`
    )
  }

  const data = (await response.json()) as { messages?: Array<{ id?: string }> }
  return { messageId: extractSentMessageId(data, "sendTemplateMessage") }
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
  const token = assertAccessTokenPresent(
    accessToken,
    "markWhatsAppMessageAsRead"
  )

  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}/messages`
  const response = await metaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
}

export const markMessageAsRead = markWhatsAppMessageAsRead

// ==========================================
// 2b. Media Metadata & Binary Download
// ==========================================

export interface MetaMediaMetadata {
  id: string
  url: string
  mime_type: string
  sha256?: string
  file_size?: number
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
  const token = assertAccessTokenPresent(
    accessToken,
    "getWhatsAppMediaMetadata"
  )
  const defaultMime = fallbackMimeType || inferDefaultMimeTypeFromId(mediaId)

  const url = `${META_API_BASE}/${encodeURIComponent(mediaId.trim())}`
  const response = await metaFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to fetch WhatsApp media metadata (${response.status})`
    )
  }
  const data = (await response.json()) as Partial<MetaMediaMetadata>
  if (!data.url) {
    throw new MetaApiError(
      `Meta media metadata response for ${mediaId} did not include a download URL.`,
      { httpStatus: 502 }
    )
  }
  return {
    id: data.id || mediaId,
    url: data.url,
    mime_type: data.mime_type || defaultMime,
    sha256: data.sha256,
    file_size: typeof data.file_size === "number" ? data.file_size : undefined,
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
  const token = assertAccessTokenPresent(
    args.accessToken,
    "downloadWhatsAppMediaBinary"
  )
  let targetUrl = args.mediaUrl
  let resolvedMime = args.expectedMimeType || "application/octet-stream"
  let resolvedSha256: string | undefined

  if (!targetUrl && args.mediaId) {
    const meta = await getWhatsAppMediaMetadata({
      mediaId: args.mediaId,
      accessToken: token,
      fallbackMimeType: args.expectedMimeType,
    })
    targetUrl = meta.url
    resolvedMime = meta.mime_type || resolvedMime
    resolvedSha256 = meta.sha256
  }

  if (!targetUrl) {
    throw new Error(
      "downloadWhatsAppMediaBinary requires either mediaUrl or mediaId"
    )
  }

  const response = await metaFetch(
    targetUrl,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    30_000
  )
  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to download WhatsApp media binary (${response.status})`
    )
  }
  const arrayBuf = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  const contentType =
    response.headers.get("content-type") ||
    resolvedMime ||
    "application/octet-stream"
  return {
    buffer,
    contentType,
    mimeType: contentType,
    sha256: resolvedSha256,
    fileSize: buffer.byteLength,
  }
}

// ==========================================
// 2c. Reactions & Interactive Messages
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
  const token = assertAccessTokenPresent(
    accessToken,
    "sendWhatsAppReactionMessage"
  )

  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}/messages`
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    ...recipientFields(to),
    type: "reaction",
    reaction: {
      message_id: messageId,
      emoji: emoji ?? "",
    },
  }

  const response = await metaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to send WhatsApp reaction message: ${response.status}`
    )
  }

  const data = (await response.json()) as { messages?: Array<{ id?: string }> }
  return { messageId: extractSentMessageId(data, "sendWhatsAppReactionMessage") }
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
    throw new Error(
      "Meta allows between 1 and 3 reply buttons per interactive message"
    )
  }
  const token = assertAccessTokenPresent(
    accessToken,
    "sendInteractiveButtonsMessage"
  )

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

  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}/messages`
  const response = await metaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to send WhatsApp interactive buttons message: ${response.status}`
    )
  }

  const data = (await response.json()) as { messages?: Array<{ id?: string }> }
  return {
    messageId: extractSentMessageId(data, "sendInteractiveButtonsMessage"),
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
    throw new Error(
      "Interactive list buttonText must be between 1 and 20 characters"
    )
  }
  if (!Array.isArray(sections) || sections.length < 1) {
    throw new Error("Interactive list message requires at least 1 section")
  }
  const token = assertAccessTokenPresent(
    accessToken,
    "sendInteractiveListMessage"
  )

  let totalRows = 0
  const formattedSections = sections.map((sec) => {
    const secTitle = sec.title.trim()
    if (!secTitle || secTitle.length > 24) {
      throw new Error(
        `Interactive list section title '${secTitle}' must be 1..24 characters`
      )
    }
    if (!Array.isArray(sec.rows) || sec.rows.length < 1) {
      throw new Error(
        `Interactive list section '${secTitle}' must have at least 1 row`
      )
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

  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}/messages`
  const response = await metaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to send WhatsApp interactive list message: ${response.status}`
    )
  }

  const data = (await response.json()) as { messages?: Array<{ id?: string }> }
  return { messageId: extractSentMessageId(data, "sendInteractiveListMessage") }
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

export type MetaTemplateHeaderFormat =
  | "NONE"
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT"

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
  const token = assertAccessTokenPresent(
    args.accessToken,
    "fetchMessageTemplates"
  )
  const out: MetaRemoteTemplate[] = []
  let url: string | undefined = `${META_API_BASE}/${encodeURIComponent(args.wabaId)}/message_templates?fields=id,name,status,category,language,rejected_reason,components&limit=100`

  for (let page = 0; url && page < 10; page++) {
    const response = await metaFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
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
  headerType?: MetaTemplateHeaderFormat
  headerText?: string
  headerExample?: string
  headerHandle?: string
  headerMediaUrl?: string
  bodyText: string
  bodyExamples?: string[]
  footerText?: string
  buttons?: Array<
    | { type: "QUICK_REPLY"; text: string }
    | { type: "URL"; text: string; url: string; example?: string[] }
    | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  >
}

const DEFAULT_BODY_EXAMPLE_SAMPLES = [
  "Pilgrim",
  "Ramadan Umrah Executive",
  "15 Ramadan",
  "PKR 485,000",
  "ART-2026-001",
]

export function buildMetaTemplateComponentsPayload(
  args: Omit<CreateMetaTemplateArgs, "wabaId" | "accessToken">
): Array<Record<string, unknown>> {
  const components: Array<Record<string, unknown>> = []
  const resolvedHeaderType = (
    args.headerType ||
    (args.headerText?.trim() ? "TEXT" : "NONE")
  ).toUpperCase() as MetaTemplateHeaderFormat

  if (resolvedHeaderType === "TEXT" && args.headerText?.trim()) {
    const trimmedHeader = args.headerText.trim()
    const headerVars = extractTemplatePlaceholders(trimmedHeader)
    const headerComponent: Record<string, unknown> = {
      type: "HEADER",
      format: "TEXT",
      text: trimmedHeader,
    }
    if (headerVars.length > 0) {
      headerComponent.example = {
        header_text: [args.headerExample?.trim() || "Al Ramlah Travels"],
      }
    }
    components.push(headerComponent)
  } else if (
    resolvedHeaderType === "IMAGE" ||
    resolvedHeaderType === "VIDEO" ||
    resolvedHeaderType === "DOCUMENT"
  ) {
    const handle =
      args.headerHandle?.trim() || args.headerMediaUrl?.trim() || ""
    if (!handle) {
      throw new Error(
        `Meta ${resolvedHeaderType} template header requires a sample media handle or sample media URL (headerHandle).`
      )
    }
    components.push({
      type: "HEADER",
      format: resolvedHeaderType,
      example: {
        header_handle: [handle],
      },
    })
  }

  const trimmedBody = args.bodyText.trim()
  const bodyVars = extractTemplatePlaceholders(trimmedBody)
  const bodyComponent: Record<string, unknown> = {
    type: "BODY",
    text: trimmedBody,
  }
  if (bodyVars.length > 0) {
    const maxIndex = Math.max(...bodyVars)
    const sampleRow: string[] = []
    for (let i = 0; i < maxIndex; i++) {
      const provided = args.bodyExamples?.[i]?.trim()
      sampleRow.push(
        provided ||
          DEFAULT_BODY_EXAMPLE_SAMPLES[i % DEFAULT_BODY_EXAMPLE_SAMPLES.length]!
      )
    }
    bodyComponent.example = {
      body_text: [sampleRow],
    }
  }
  components.push(bodyComponent)

  if (args.footerText && args.footerText.trim()) {
    components.push({
      type: "FOOTER",
      text: args.footerText.trim(),
    })
  }

  if (args.buttons && args.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: args.buttons,
    })
  }

  return components
}

export async function createMetaMessageTemplate(
  args: CreateMetaTemplateArgs
): Promise<{
  id: string
  status: MetaTemplateStatus
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
}> {
  const { wabaId, accessToken, name, language, category } = args

  const normalizedName = name.trim().toLowerCase()
  if (!/^[a-z0-9_]+$/.test(normalizedName)) {
    throw new Error(
      "Meta template name must match ^[a-z0-9_]+$ (lowercase alphanumeric and underscores)"
    )
  }
  if (!args.bodyText || !args.bodyText.trim()) {
    throw new Error("Meta template requires non-empty bodyText")
  }

  const token = assertAccessTokenPresent(
    accessToken,
    "createMetaMessageTemplate"
  )
  const components = buildMetaTemplateComponentsPayload(args)

  const url = `${META_API_BASE}/${encodeURIComponent(wabaId)}/message_templates`
  const response = await metaFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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

  if (!data.id) {
    throw new MetaApiError(
      "Meta Graph API template creation response did not return a template id.",
      { httpStatus: 502 }
    )
  }

  return {
    id: data.id,
    status: data.status || "PENDING",
    category: data.category || category,
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
  const token = assertAccessTokenPresent(
    accessToken,
    "deleteMetaMessageTemplate"
  )

  const url = `${META_API_BASE}/${encodeURIComponent(wabaId)}/message_templates?name=${encodeURIComponent(
    name.trim()
  )}`

  const response = await metaFetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    await throwMetaError(
      response,
      `Failed to delete Meta message template '${name}': ${response.status}`
    )
  }

  return { success: true }
}
