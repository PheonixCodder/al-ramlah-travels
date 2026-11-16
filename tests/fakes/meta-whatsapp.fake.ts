import crypto from "node:crypto"

export interface MetaWhatsAppRecordedCall {
  method: string
  url: string
  pathname: string
  authorization: string | null
  body: Record<string, unknown> | null
}

export interface MetaTemplateRecord {
  id: string
  name: string
  status: "APPROVED" | "PENDING" | "REJECTED"
  category: string
  language: string
  components: Array<Record<string, unknown>>
}

export type MetaFaultMode =
  | null
  | "rate_limit_429"
  | "oauth_expired_190"
  | "outside_24h_window_131047"
  | "server_error_500"

export interface MetaWhatsAppFakeOptions {
  validAccessTokens?: string[]
  initialTemplates?: MetaTemplateRecord[]
}

export interface MetaWhatsAppFake {
  calls: MetaWhatsAppRecordedCall[]
  sentMessages: Array<{
    wamid: string
    phoneNumberId: string
    to: string
    type: string
    payload: Record<string, unknown>
  }>
  templates: MetaTemplateRecord[]
  fetchHandler: typeof fetch
  injectFault: (mode: MetaFaultMode) => void
  registerMediaFixture: (
    mediaId: string,
    fixture: { mimeType: string; bytes: Buffer; sha256?: string }
  ) => void
  reset: () => void
}

/**
 * Signs a raw webhook JSON string using Meta's `x-hub-signature-256` (`sha256=<hex>`) HMAC-SHA256 contract.
 */
export function signMetaWebhookPayload(rawBody: string, appSecret: string): string {
  const cleanSecret = appSecret.split(",")[0]?.trim() ?? appSecret
  const digest = crypto
    .createHmac("sha256", cleanSecret)
    .update(rawBody, "utf8")
    .digest("hex")
  return `sha256=${digest}`
}

/**
 * Builds a realistic Meta Graph API v21.0 inbound WhatsApp text message webhook envelope.
 */
export function buildInboundWhatsAppWebhookEnvelope(params: {
  wabaId?: string
  phoneNumberId: string
  displayPhoneNumber?: string
  fromPhoneDigits: string
  contactName?: string
  wamid?: string
  text: string
  timestampUnixSec?: number
}): Record<string, unknown> {
  const wamid = params.wamid ?? `wamid.HBgM${crypto.randomUUID().replace(/-/g, "")}`
  const ts = String(params.timestampUnixSec ?? Math.floor(Date.now() / 1000))
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: params.wabaId ?? "waba_audit_001",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: params.displayPhoneNumber ?? "923214629700",
                phone_number_id: params.phoneNumberId,
              },
              contacts: [
                {
                  profile: { name: params.contactName ?? "Haji Tariq" },
                  wa_id: params.fromPhoneDigits,
                },
              ],
              messages: [
                {
                  from: params.fromPhoneDigits,
                  id: wamid,
                  timestamp: ts,
                  type: "text",
                  text: { body: params.text },
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

function getHeaderValue(
  headers: HeadersInit | undefined,
  targetName: string
): string | null {
  if (!headers) return null
  const lower = targetName.toLowerCase()
  if (headers instanceof Headers) {
    return headers.get(lower)
  }
  if (Array.isArray(headers)) {
    const found = headers.find(([k]) => k.toLowerCase() === lower)
    return found ? found[1] : null
  }
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && typeof v === "string") {
      return v
    }
  }
  return null
}

/**
 * Creates a deterministic in-memory Meta WhatsApp Cloud API v21.0 contract fake (`T-030`, `T-039`):
 * - Validates `Authorization: Bearer <token>` and rejects expired/invalid tokens with `190` (`401`).
 * - Enforces 1:1 E.164 recipient formatting on `/messages` (rejecting `@g.us`, `status@broadcast`, and local `03xx`).
 * - Supports `/message_templates` list/create/delete, media metadata/download, and `429`/`190`/`131047` fault injection.
 */
export function createMetaWhatsAppFake(
  options: MetaWhatsAppFakeOptions = {}
): MetaWhatsAppFake {
  const calls: MetaWhatsAppRecordedCall[] = []
  const sentMessages: MetaWhatsAppFake["sentMessages"] = []
  const templates: MetaTemplateRecord[] = [...(options.initialTemplates ?? [])]
  const mediaFixtures = new Map<
    string,
    { mimeType: string; bytes: Buffer; sha256: string }
  >()
  let faultMode: MetaFaultMode = null
  let sequence = 1

  const validTokens = options.validAccessTokens
    ? new Set(options.validAccessTokens)
    : null

  function makeErrorResponse(
    httpStatus: number,
    code: number,
    message: string,
    subcode?: number
  ): Response {
    return new Response(
      JSON.stringify({
        error: {
          message,
          type: "OAuthException",
          code,
          ...(subcode !== undefined ? { error_subcode: subcode } : {}),
          fbtrace_id: `AbFakeTrace${sequence++}`,
        },
      }),
      {
        status: httpStatus,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  const fetchHandler: typeof fetch = async (input, init) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const parsed = new URL(urlStr)
    const method = (
      init?.method ??
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase()
    const authHeader = getHeaderValue(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
      "authorization"
    )

    let parsedBody: Record<string, unknown> | null = null
    if (typeof init?.body === "string" && init.body.trim().startsWith("{")) {
      try {
        parsedBody = JSON.parse(init.body) as Record<string, unknown>
      } catch {
        parsedBody = null
      }
    }

    calls.push({
      method,
      url: urlStr,
      pathname: parsed.pathname,
      authorization: authHeader,
      body: parsedBody,
    })

    // Check Bearer token on all Graph & Lookaside requests
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : ""
    if (!token || (validTokens && !validTokens.has(token))) {
      return makeErrorResponse(
        401,
        190,
        "Invalid OAuth access token - Cannot parse access token",
        463
      )
    }

    if (faultMode === "oauth_expired_190") {
      return makeErrorResponse(
        401,
        190,
        "Error validating access token: Session has expired",
        463
      )
    }
    if (faultMode === "rate_limit_429") {
      return makeErrorResponse(
        429,
        130429,
        "Rate limit hit: Cloud API throughput reached"
      )
    }
    if (faultMode === "outside_24h_window_131047") {
      return makeErrorResponse(
        400,
        131047,
        "Re-engagement message: more than 24 hours have passed since the recipient last replied"
      )
    }
    if (faultMode === "server_error_500") {
      return makeErrorResponse(500, 2, "Service temporarily unavailable")
    }

    // Binary media download endpoint (`https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=...`)
    if (
      parsed.hostname === "lookaside.fbsbx.com" ||
      parsed.pathname.startsWith("/media-download/")
    ) {
      const mediaId =
        parsed.searchParams.get("mid") ??
        parsed.pathname.replace("/media-download/", "")
      const fixture = mediaFixtures.get(mediaId) ?? {
        mimeType: "image/jpeg",
        bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
        sha256: crypto.createHash("sha256").update("default-jpeg").digest("hex"),
      }
      return new Response(new Uint8Array(fixture.bytes), {
        status: 200,
        headers: {
          "Content-Type": fixture.mimeType,
          "Content-Length": String(fixture.bytes.byteLength),
        },
      })
    }

    // POST /v21.0/{phoneNumberId}/messages
    const messagesMatch = /^\/v21\.0\/([^/]+)\/messages$/.exec(parsed.pathname)
    if (messagesMatch && method === "POST") {
      const phoneNumberId = decodeURIComponent(messagesMatch[1]!)
      if (!parsedBody || parsedBody.messaging_product !== "whatsapp") {
        return makeErrorResponse(
          400,
          100,
          "Invalid parameter: messaging_product must be 'whatsapp'"
        )
      }

      if (parsedBody.status === "read") {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      const to = String(parsedBody.to ?? parsedBody.recipient ?? "")
      if (
        !to ||
        to.includes("@g.us") ||
        to.includes("@broadcast") ||
        to.startsWith("03") ||
        (!/^[1-9]\d{9,14}$/.test(to) && !/^[A-Za-z]{2}\./.test(to))
      ) {
        return makeErrorResponse(
          400,
          100,
          `Invalid parameter: recipient '${to}' is not a valid 1:1 E.164 WhatsApp user`
        )
      }

      const wamid = `wamid.HBgM${to}FQIAERgS${String(sequence++).padStart(6, "0")}`
      sentMessages.push({
        wamid,
        phoneNumberId,
        to,
        type: String(parsedBody.type ?? "text"),
        payload: parsedBody,
      })

      return new Response(
        JSON.stringify({
          messaging_product: "whatsapp",
          contacts: [{ input: to, wa_id: to }],
          messages: [{ id: wamid }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // /v21.0/{wabaId}/message_templates
    const templatesMatch = /^\/v21\.0\/([^/]+)\/message_templates$/.exec(
      parsed.pathname
    )
    if (templatesMatch) {
      if (method === "GET") {
        return new Response(
          JSON.stringify({
            data: templates,
            paging: { cursors: { before: "b", after: "a" } },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      }
      if (method === "POST" && parsedBody) {
        const created: MetaTemplateRecord = {
          id: `tpl_${sequence++}`,
          name: String(parsedBody.name ?? "unnamed_template"),
          status: "PENDING",
          category: String(parsedBody.category ?? "MARKETING"),
          language: String(parsedBody.language ?? "en_US"),
          components: Array.isArray(parsedBody.components)
            ? (parsedBody.components as Array<Record<string, unknown>>)
            : [],
        }
        templates.push(created)
        return new Response(
          JSON.stringify({
            id: created.id,
            status: created.status,
            category: created.category,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      }
      if (method === "DELETE") {
        const targetName = parsed.searchParams.get("name")
        const idx = templates.findIndex((t) => t.name === targetName)
        if (idx >= 0) templates.splice(idx, 1)
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    // GET /v21.0/{id} (phone verification/health OR media metadata)
    const entityMatch = /^\/v21\.0\/([^/]+)$/.exec(parsed.pathname)
    if (entityMatch && method === "GET") {
      const entityId = decodeURIComponent(entityMatch[1]!)
      const fields = parsed.searchParams.get("fields") ?? ""
      if (
        fields.includes("display_phone_number") ||
        fields.includes("whatsapp_business_manager_messaging_limit")
      ) {
        return new Response(
          JSON.stringify({
            id: entityId,
            display_phone_number: "+92 321 4629700",
            verified_name: "Al Ramlah Travels",
            quality_rating: "GREEN",
            platform_type: "CLOUD_API",
            status: "CONNECTED",
            code_verification_status: "VERIFIED",
            whatsapp_business_manager_messaging_limit: "TIER_1K",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      }

      const fixture = mediaFixtures.get(entityId) ?? {
        mimeType: "image/jpeg",
        bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
        sha256: crypto.createHash("sha256").update(entityId).digest("hex"),
      }
      return new Response(
        JSON.stringify({
          messaging_product: "whatsapp",
          id: entityId,
          url: `https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=${encodeURIComponent(entityId)}`,
          mime_type: fixture.mimeType,
          sha256: fixture.sha256,
          file_size: fixture.bytes.byteLength,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    return makeErrorResponse(404, 803, `Unknown Graph API path: ${parsed.pathname}`)
  }

  return {
    calls,
    sentMessages,
    templates,
    fetchHandler,
    injectFault(mode) {
      faultMode = mode
    },
    registerMediaFixture(mediaId, fixture) {
      const sha256 =
        fixture.sha256 ??
        crypto.createHash("sha256").update(fixture.bytes).digest("hex")
      mediaFixtures.set(mediaId, {
        mimeType: fixture.mimeType,
        bytes: fixture.bytes,
        sha256,
      })
    },
    reset() {
      calls.length = 0
      sentMessages.length = 0
      faultMode = null
    },
  }
}
