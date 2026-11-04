/**
 * Builds the Meta `components` payload used by POST /{phoneNumberId}/messages
 * when sending an APPROVED Meta message template.
 */

export interface SendTimeParams {
  /**
   * Values for the body variables, in order: {{1}}, {{2}}, ...
   */
  body?: string[]
  /** Value for TEXT-header {{1}}, when the header has a variable. */
  headerText?: string
  /** Override the template's static media URL for this send. */
  headerMediaUrl?: string
  /** Meta media id (if previously uploaded to Graph API). */
  headerMediaId?: string
  /**
   * Per-button overrides keyed by button index (0-indexed).
   * Used for URL buttons with {{1}} suffixes or COPY_CODE values.
   */
  buttonParams?: Record<number, string>
}

export type MetaSendParameter =
  | { type: "text"; text: string; parameter_name?: string }
  | { type: "image"; image: { link?: string; id?: string } }
  | { type: "video"; video: { link?: string; id?: string } }
  | { type: "document"; document: { link?: string; id?: string } }
  | { type: "coupon_code"; coupon_code: string }
  | { type: "payload"; payload: string }

export type MetaSendComponent =
  | { type: "header"; parameters: MetaSendParameter[] }
  | { type: "body"; parameters: MetaSendParameter[] }
  | {
      type: "button"
      sub_type: "url" | "quick_reply" | "copy_code"
      index: string
      parameters: MetaSendParameter[]
    }

export interface TemplateDefinition {
  headerType?: string | null
  headerContent?: string | null
  headerMediaUrl?: string | null
  bodyText: string
  buttons?: Array<Record<string, unknown>> | null
}

/**
 * Checks whether a variable key is a named variable (e.g. "customer_name")
 * rather than a positional integer (e.g. "1").
 */
export function isNamedVariable(key: string): boolean {
  return !/^\d+$/.test(key)
}

/**
 * Extracts distinct variables `{{variable}}` from template text.
 */
export function extractTemplateVariables(text: string): string[] {
  if (!text) return []
  const matches = new Set<string>()
  for (const m of text.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)) {
    if (m[1]) matches.add(m[1])
  }
  const all = [...matches]
  if (all.length > 0 && all.every((k) => /^\d+$/.test(k))) {
    return all.map(Number).sort((a, b) => a - b).map(String)
  }
  return all.filter((k) => isNamedVariable(k)).sort((a, b) => a.localeCompare(b))
}

function textParameter(key: string, value: string): MetaSendParameter {
  const param: MetaSendParameter = {
    type: "text",
    text: String(value ?? ""),
  }
  if (isNamedVariable(key)) {
    param.parameter_name = key
  }
  return param
}

function buildHeaderComponent(
  template: TemplateDefinition,
  params: SendTimeParams
): MetaSendComponent | null {
  const headerType = template.headerType?.toLowerCase()
  if (!headerType) return null

  if (headerType === "text") {
    const keys = extractTemplateVariables(template.headerContent ?? "")
    const key = keys[0]
    if (!key) return null
    const val = params.headerText
    if (!val || !val.trim()) {
      throw new Error(`Header text variable {{${key}}} requires a non-empty value.`)
    }
    return {
      type: "header",
      parameters: [textParameter(key, val)],
    }
  }

  if (headerType === "image" || headerType === "video" || headerType === "document") {
    const link = params.headerMediaUrl ?? template.headerMediaUrl
    const id = params.headerMediaId
    if (!link && !id) {
      throw new Error(
        `Media header (${headerType}) requires either a public URL (headerMediaUrl) or a Meta media ID (headerMediaId).`
      )
    }
    const mediaPayload: { link?: string; id?: string } = id
      ? { id }
      : { link: link ?? undefined }
    return {
      type: "header",
      parameters: [
        headerType === "image"
          ? { type: "image", image: mediaPayload }
          : headerType === "video"
            ? { type: "video", video: mediaPayload }
            : { type: "document", document: mediaPayload },
      ],
    }
  }

  return null
}

function buildBodyComponent(
  template: TemplateDefinition,
  params: SendTimeParams
): MetaSendComponent | null {
  const keys = extractTemplateVariables(template.bodyText)
  const varCount = keys.length
  const body = params.body ?? []

  if (varCount === 0 && body.length === 0) return null
  if (body.length < varCount) {
    throw new Error(
      `Template body requires ${varCount} variables (${keys.map((k) => `{{${k}}}`).join(", ")}), but received ${body.length}.`
    )
  }

  return {
    type: "body",
    parameters: keys.map((key, i) => textParameter(key, body[i] ?? "")),
  }
}

function buildButtonComponents(
  template: TemplateDefinition,
  params: SendTimeParams
): MetaSendComponent[] {
  const buttons = template.buttons
  if (!buttons || !Array.isArray(buttons) || buttons.length === 0) return []

  const components: MetaSendComponent[] = []
  buttons.forEach((btn, idx) => {
    const type = typeof btn.type === "string" ? btn.type.toUpperCase() : ""
    const url = typeof btn.url === "string" ? btn.url : ""

    if (type === "URL" && url.includes("{{1}}")) {
      const val = params.buttonParams?.[idx]
      if (!val) {
        throw new Error(
          `URL button #${idx + 1} ("${btn.text ?? "link"}") has a dynamic variable {{1}} but no buttonParams[${idx}] was supplied.`
        )
      }
      components.push({
        type: "button",
        sub_type: "url",
        index: String(idx),
        parameters: [{ type: "text", text: val }],
      })
    } else if (type === "COPY_CODE") {
      const val = params.buttonParams?.[idx] || (typeof btn.code === "string" ? btn.code : "")
      if (val) {
        components.push({
          type: "button",
          sub_type: "copy_code",
          index: String(idx),
          parameters: [{ type: "coupon_code", coupon_code: val }],
        })
      }
    }
  })

  return components
}

/**
 * Builds the full Meta `components` array for template send execution.
 */
export function buildSendComponents(
  template: TemplateDefinition,
  params: SendTimeParams
): MetaSendComponent[] {
  const components: MetaSendComponent[] = []

  const header = buildHeaderComponent(template, params)
  if (header) components.push(header)

  const body = buildBodyComponent(template, params)
  if (body) components.push(body)

  const buttons = buildButtonComponents(template, params)
  components.push(...buttons)

  return components
}
