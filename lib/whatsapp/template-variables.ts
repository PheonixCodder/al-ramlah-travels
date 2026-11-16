import { parsePhoneE164 } from "@/lib/phone"

export interface ParsedBroadcastRecipient {
  phone: string
  name?: string
  customParams?: string[]
}

export interface ParseCsvResult {
  recipients: ParsedBroadcastRecipient[]
  validCount: number
  invalidCount: number
  errors: string[]
}

export interface BroadcastBatchConfirmationSummary {
  recipientCount: number
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  isPaidMarketing: boolean
  requiresExplicitConfirmation: boolean
  warningMessage: string
}

/**
 * Extracts sorted unique numeric placeholder indices from a Meta WhatsApp template text.
 * For example: `"Assalam {{1}}, your booking for {{2}} is confirmed. See {{1}}."` -> `[1, 2]`.
 */
export function extractTemplatePlaceholders(bodyText: string): number[] {
  if (!bodyText || typeof bodyText !== "string") {
    return []
  }

  const matches = bodyText.matchAll(/\{\{(\d+)\}\}/g)
  const indices = new Set<number>()

  for (const match of matches) {
    if (match[1]) {
      const parsed = parseInt(match[1], 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        indices.add(parsed)
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Alias for extractTemplatePlaceholders for spec compatibility.
 */
export const extractTemplateVariablePlaceholders = extractTemplatePlaceholders

/**
 * Interpolates token placeholders such as `{{name}}` or `{{phone}}` in a single parameter string.
 * - `{{name}}` -> contact.name (or "Pilgrim" if missing)
 * - `{{phone}}` -> contact.phone
 */
export function interpolateTemplateParam(
  rawParam: string,
  contact: { name?: string | null; phone: string }
): string {
  if (typeof rawParam !== "string") {
    return String(rawParam ?? "")
  }

  const fallbackName = contact.name?.trim() || "Pilgrim"
  const cleanPhone = contact.phone?.trim() || ""

  return rawParam
    .replace(/\{\{\s*name\s*\}\}/gi, fallbackName)
    .replace(/\{\{\s*phone\s*\}\}/gi, cleanPhone)
}

/**
 * Resolves template parameter arrays or records for a specific contact by interpolating
 * dynamic token markers like `{{name}}` and `{{phone}}`.
 */
export function resolveRecipientTemplateParams(
  templateParams: Record<string, unknown> | string[] | undefined,
  contact: { name?: string | null; phone: string }
): Record<string, unknown> | string[] {
  if (!templateParams) {
    return {}
  }

  if (Array.isArray(templateParams)) {
    return templateParams.map((param) => {
      if (typeof param === "string") {
        return interpolateTemplateParam(param, contact)
      }
      return param
    })
  }

  const resolvedRecord: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(templateParams)) {
    if (typeof val === "string") {
      resolvedRecord[key] = interpolateTemplateParam(val, contact)
    } else {
      resolvedRecord[key] = val
    }
  }
  return resolvedRecord
}

/**
 * Pure template body string interpolator replacing both numeric `{{1}}`, `{{2}}` placeholders
 * and contact tokens `{{name}}`, `{{phone}}` with concrete values.
 */
export function interpolateTemplateVariables(
  templateBody: string,
  variables?: Record<string, unknown> | string[],
  contact?: { name?: string | null; phone: string }
): string {
  if (!templateBody || typeof templateBody !== "string") {
    return ""
  }

  let result = templateBody

  if (contact) {
    const resolvedName = contact.name?.trim() || "Pilgrim"
    const resolvedPhone = contact.phone?.trim() || ""
    result = result
      .replace(/\{\{\s*name\s*\}\}/gi, resolvedName)
      .replace(/\{\{\s*phone\s*\}\}/gi, resolvedPhone)
  }

  if (Array.isArray(variables)) {
    variables.forEach((val, idx) => {
      const placeholder = new RegExp(`\\{\\{${idx + 1}\\}\\}`, "g")
      const strVal = val != null ? String(val) : ""
      result = result.replace(placeholder, strVal)
    })
  } else if (variables && typeof variables === "object") {
    for (const [k, v] of Object.entries(variables)) {
      const strVal = v != null ? String(v) : ""
      const cleanKey = k.replace(/^\{\{|\}\}$/g, "").trim()
      const escapedKey = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const pattern = new RegExp(`\\{\\{${escapedKey}\\}\\}`, "gi")
      result = result.replace(pattern, strVal)
    }
  }

  return result
}

/**
 * RFC-4180 compliant single-line CSV/TSV splitter (`T-088`):
 * - Only double quotes (`"`) act as field delimiters (`""` unescapes to literal `"`).
 * - Single-quote apostrophes (`O'Connor`, `Ma'am Ayesha`) are preserved verbatim as characters!
 * - Commas, semicolons, and tabs inside `"quoted, fields"` are preserved without splitting.
 */
export function splitRfc4180CsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inDoubleQuotes = false
  let fieldStartedWithQuote = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!

    if (inDoubleQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inDoubleQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"' && current.trim().length === 0) {
      inDoubleQuotes = true
      fieldStartedWithQuote = true
      current = ""
      continue
    }

    if (char === "," || char === "\t" || char === ";") {
      cells.push(fieldStartedWithQuote ? current.trim() : current.trim())
      current = ""
      fieldStartedWithQuote = false
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

const PHONE_HEADER_TOKENS = new Set([
  "phone",
  "phone_number",
  "phone number",
  "phonenumber",
  "whatsapp",
  "whatsapp_number",
  "whatsapp number",
  "whatsapp no",
  "wa",
  "wa_id",
  "wa number",
  "mobile",
  "mobile_number",
  "mobile number",
  "mobile no",
  "cell",
  "cell_number",
  "cell number",
  "contact",
  "contact_number",
  "contact number",
  "msisdn",
  "number",
  "tel",
  "telephone",
])

const NAME_HEADER_TOKENS = new Set([
  "name",
  "full_name",
  "full name",
  "fullname",
  "pilgrim",
  "pilgrim_name",
  "pilgrim name",
  "customer",
  "customer_name",
  "customer name",
  "recipient",
  "recipient_name",
  "recipient name",
  "first_name",
  "first name",
])

function normalizeHeaderToken(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[#*:]/g, "")
    .replace(/\s+/g, " ")
}

function isPhoneHeaderCell(cell: string): boolean {
  const token = normalizeHeaderToken(cell)
  if (!token) return false
  if (PHONE_HEADER_TOKENS.has(token)) return true
  return (
    token.includes("whatsapp") ||
    token.includes("phone") ||
    token.includes("mobile") ||
    token.includes("msisdn")
  )
}

function isNameHeaderCell(cell: string): boolean {
  const token = normalizeHeaderToken(cell)
  if (!token) return false
  if (NAME_HEADER_TOKENS.has(token)) return true
  return token.includes("name") || token === "pilgrim" || token === "customer"
}

function normalizeRecipientPhone(candidate: string): string | null {
  const clean = candidate.replace(/^\uFEFF/, "").trim()
  if (!clean) return null
  const parsed = parsePhoneE164(clean)
  return parsed.valid ? parsed.e164 : null
}

/**
 * Pure RFC-4180 parser for CSV / multi-line WhatsApp broadcast contacts (`T-088`).
 * Supports:
 * - Apostrophes and UTF-8 / Urdu / Arabic names (`O'Connor`, `محمد طارق`)
 * - Quoted fields containing commas (`"Malik, Muhammad"`, `"Askari 10, Lahore"`)
 * - Explicit column headers in any order (`WhatsApp`, `Mobile`, `Phone`, `Name`, `Param1`, ...)
 * - Headerless `name,phone` or `phone,name` or single-column phone lists
 * - Strict canonical E.164 normalization via `parsePhoneE164` and phone deduplication
 */
export function parseWhatsappBroadcastCsv(csvText: string): ParseCsvResult {
  const result: ParseCsvResult = {
    recipients: [],
    validCount: 0,
    invalidCount: 0,
    errors: [],
  }

  if (!csvText || typeof csvText !== "string") {
    return result
  }

  const cleanedText = csvText.replace(/^\uFEFF/, "")
  const lines = cleanedText.split(/\r?\n/)
  const seenPhones = new Set<string>()

  let headerPhoneCol: number | null = null
  let headerNameCol: number | null = null
  let headerChecked = false

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex]?.trim() ?? ""
    if (!rawLine) continue

    const cells = splitRfc4180CsvLine(rawLine)
    if (cells.length === 0 || cells.every((c) => !c)) continue

    if (!headerChecked) {
      headerChecked = true
      const detectedPhoneIdx = cells.findIndex((cell) => isPhoneHeaderCell(cell))
      const detectedNameIdx = cells.findIndex((cell) => isNameHeaderCell(cell))

      const firstCellNormalizedPhone = normalizeRecipientPhone(cells[0] ?? "")
      const secondCellNormalizedPhone =
        cells.length > 1 ? normalizeRecipientPhone(cells[1] ?? "") : null

      const looksLikeHeaderRow =
        !firstCellNormalizedPhone &&
        !secondCellNormalizedPhone &&
        (detectedPhoneIdx !== -1 || detectedNameIdx !== -1)

      if (looksLikeHeaderRow) {
        if (detectedPhoneIdx !== -1) headerPhoneCol = detectedPhoneIdx
        if (detectedNameIdx !== -1 && detectedNameIdx !== detectedPhoneIdx) {
          headerNameCol = detectedNameIdx
        }
        continue
      }
    }

    let phoneStr: string | null = null
    let nameStr: string | undefined = undefined
    const customParams: string[] = []

    if (cells.length === 1) {
      phoneStr = cells[0] ?? null
    } else if (headerPhoneCol !== null && headerPhoneCol < cells.length) {
      phoneStr = cells[headerPhoneCol] ?? null
      const resolvedNameIdx =
        headerNameCol !== null && headerNameCol < cells.length
          ? headerNameCol
          : headerPhoneCol === 0
            ? 1
            : 0
      if (resolvedNameIdx !== headerPhoneCol && cells[resolvedNameIdx]) {
        nameStr = cells[resolvedNameIdx] || undefined
      }
      cells.forEach((cell, idx) => {
        if (idx !== headerPhoneCol && idx !== resolvedNameIdx && cell) {
          customParams.push(cell)
        }
      })
    } else {
      const col0Phone = normalizeRecipientPhone(cells[0] ?? "")
      const col1Phone = normalizeRecipientPhone(cells[1] ?? "")

      if (col0Phone && !col1Phone) {
        phoneStr = cells[0] ?? null
        nameStr = cells[1] || undefined
        if (cells.length > 2) {
          customParams.push(...cells.slice(2).filter(Boolean))
        }
      } else if (!col0Phone && col1Phone) {
        nameStr = cells[0] || undefined
        phoneStr = cells[1] ?? null
        if (cells.length > 2) {
          customParams.push(...cells.slice(2).filter(Boolean))
        }
      } else if (col0Phone && col1Phone) {
        phoneStr = cells[0] ?? null
        nameStr = cells[1] || undefined
        if (cells.length > 2) {
          customParams.push(...cells.slice(2).filter(Boolean))
        }
      } else {
        // Attempt remaining columns if phone is in column >= 2
        const fallbackPhoneIdx = cells.findIndex(
          (cell) => normalizeRecipientPhone(cell) !== null
        )
        if (fallbackPhoneIdx !== -1) {
          phoneStr = cells[fallbackPhoneIdx] ?? null
          nameStr = cells[0] || undefined
          cells.forEach((cell, idx) => {
            if (idx !== fallbackPhoneIdx && idx !== 0 && cell) {
              customParams.push(cell)
            }
          })
        } else {
          result.invalidCount++
          result.errors.push(
            `Line ${lineIndex + 1}: No valid phone number found in row ("${rawLine.slice(0, 60)}")`
          )
          continue
        }
      }
    }

    const normalizedPhone = phoneStr ? normalizeRecipientPhone(phoneStr) : null
    if (!normalizedPhone) {
      result.invalidCount++
      result.errors.push(
        `Line ${lineIndex + 1}: Invalid phone number "${phoneStr ?? ""}"`
      )
      continue
    }

    if (seenPhones.has(normalizedPhone)) {
      continue
    }

    seenPhones.add(normalizedPhone)
    result.recipients.push({
      phone: normalizedPhone,
      ...(nameStr ? { name: nameStr } : {}),
      ...(customParams.length > 0 ? { customParams } : {}),
    })
  }

  result.validCount = result.recipients.length
  return result
}

/**
 * Computes pre-launch batch confirmation metadata for paid Meta WhatsApp broadcasts (`T-088`).
 */
export function buildBroadcastBatchConfirmationSummary(args: {
  recipientCount: number
  category?: string | null
}): BroadcastBatchConfirmationSummary {
  const normalizedCategory =
    args.category === "UTILITY" || args.category === "AUTHENTICATION"
      ? args.category
      : "MARKETING"
  const isPaidMarketing = normalizedCategory === "MARKETING"
  const requiresExplicitConfirmation =
    isPaidMarketing && args.recipientCount >= 25

  return {
    recipientCount: args.recipientCount,
    category: normalizedCategory,
    isPaidMarketing,
    requiresExplicitConfirmation,
    warningMessage: isPaidMarketing
      ? `Launching paid Meta MARKETING template broadcast to ${args.recipientCount} verified E.164 recipient(s). Meta per-delivered-template charges apply.`
      : `Launching Meta ${normalizedCategory} template broadcast to ${args.recipientCount} verified E.164 recipient(s).`,
  }
}
