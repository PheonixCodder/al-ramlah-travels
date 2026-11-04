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
}

export interface MetaPhoneHealth {
  id: string
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
  whatsapp_business_manager_messaging_limit?: string
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
  return phone.replace(/\D/g, "")
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
  const url = `${META_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`
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
      `${META_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`,
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
): Promise<{ success: boolean; alreadyRegistered: boolean }> {
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

export async function markMessageAsRead(args: {
  phoneNumberId: string
  accessToken: string
  messageId: string
}): Promise<void> {
  const { phoneNumberId, accessToken, messageId } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`
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
    await throwMetaError(response, `Failed to mark message as read: ${response.status}`)
  }
}

// ==========================================
// 3. Message Templates Management
// ==========================================

export interface MetaRemoteTemplate {
  id: string
  name: string
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED"
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  language: string
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
  const out: MetaRemoteTemplate[] = []
  let url: string | undefined = `${META_API_BASE}/${wabaId}/message_templates?fields=id,name,status,category,language,components&limit=100`

  for (let page = 0; url && page < 10; page++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      await throwMetaError(response, `Failed to fetch message templates from Meta: ${response.status}`)
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
