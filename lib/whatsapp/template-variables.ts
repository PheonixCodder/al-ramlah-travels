import { normalizePakistaniPhone } from "./phone-utils"

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
      const pattern = new RegExp(`\\{\\{${cleanKey}\\}\\}`, "gi")
      result = result.replace(pattern, strVal)
    }
  }

  return result
}

/**
 * Splits a CSV line taking quoted commas into account (e.g., `"Malik, Muhammad", 03001234567`).
 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes
    } else if ((char === "," || char === "\t" || char === ";") && !inQuotes) {
      cells.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  cells.push(current.trim())

  return cells.map((cell) => cell.replace(/^["']|["']$/g, "").trim())
}

/**
 * Checks whether a candidate cell string looks like a telephone number.
 */
function isPotentialPhoneNumber(cell: string): boolean {
  const digitsOnly = cell.replace(/\D/g, "")
  return digitsOnly.length >= 10 && digitsOnly.length <= 15
}

/**
 * Normalizes phone number into E.164 standard with or without leading `+`.
 */
function normalizeRecipientPhone(candidate: string): string | null {
  const clean = candidate.trim()
  if (!clean) return null

  const pkrNorm = normalizePakistaniPhone(clean)
  if (pkrNorm.normalizedE164 && pkrNorm.normalizedE164.length >= 10) {
    return pkrNorm.normalizedE164.startsWith("+")
      ? pkrNorm.normalizedE164
      : `+${pkrNorm.normalizedE164}`
  }

  const digits = clean.replace(/\D/g, "")
  if (digits.length >= 10 && digits.length <= 15) {
    return clean.startsWith("+") ? `+${digits}` : `+${digits}`
  }

  return null
}

/**
 * Pure parser for CSV / multi-line broadcast contacts.
 * Supports:
 * - `name,phone` (e.g. `Hamza Malik, +92 300 1234567`)
 * - `phone,name` (e.g. `+923001234567, Hamza Malik`)
 * - Plain phone list (one per line)
 * - Additional columns treated as customParams (`[param1, param2, ...]`)
 * - Automatically skips header rows (`name,phone`, `mobile`, `contact`, etc.)
 * - Normalizes numbers and deduplicates duplicate entries.
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

  const lines = csvText.split(/\r?\n/)
  const seenPhones = new Set<string>()

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex].trim()
    if (!rawLine) continue

    const cells = splitCsvLine(rawLine)
    if (cells.length === 0 || cells.every((c) => !c)) continue

    // Detect header row (e.g., contains 'name', 'phone', 'mobile', 'contact', 'msisdn')
    const firstCellLower = cells[0].toLowerCase().trim()
    const secondCellLower = (cells[1] || "").toLowerCase().trim()

    const isSingleCellHeader =
      cells.length === 1 &&
      [
        "name",
        "phone",
        "mobile",
        "contact",
        "msisdn",
        "number",
        "phone_number",
        "phone number",
        "cell",
        "customer",
        "recipient",
      ].includes(firstCellLower)

    const isMultiCellHeader =
      cells.length > 1 &&
      (firstCellLower.includes("name") ||
        firstCellLower.includes("phone") ||
        firstCellLower.includes("mobile") ||
        firstCellLower.includes("contact") ||
        firstCellLower.includes("msisdn")) &&
      (secondCellLower.includes("name") ||
        secondCellLower.includes("phone") ||
        secondCellLower.includes("mobile") ||
        secondCellLower.includes("contact") ||
        secondCellLower.includes("msisdn"))

    if (isSingleCellHeader || isMultiCellHeader) {
      continue
    }

    let phoneStr: string | null = null
    let nameStr: string | undefined = undefined
    const customParams: string[] = []

    if (cells.length === 1) {
      phoneStr = cells[0]
    } else {
      // Determine which column is phone
      const col0IsPhone = isPotentialPhoneNumber(cells[0])
      const col1IsPhone = isPotentialPhoneNumber(cells[1])

      if (col0IsPhone && !col1IsPhone) {
        // phone, name, ...
        phoneStr = cells[0]
        nameStr = cells[1] || undefined
        if (cells.length > 2) {
          customParams.push(...cells.slice(2).filter(Boolean))
        }
      } else if (!col0IsPhone && col1IsPhone) {
        // name, phone, ...
        nameStr = cells[0] || undefined
        phoneStr = cells[1]
        if (cells.length > 2) {
          customParams.push(...cells.slice(2).filter(Boolean))
        }
      } else if (col0IsPhone && col1IsPhone) {
        // Both look numeric, treat column 0 as phone
        phoneStr = cells[0]
        nameStr = cells[1]
        if (cells.length > 2) {
          customParams.push(...cells.slice(2).filter(Boolean))
        }
      } else {
        // Neither looks like a valid phone
        result.invalidCount++
        result.errors.push(
          `Line ${lineIndex + 1}: No valid phone number found in row ("${rawLine.slice(0, 40)}")`
        )
        continue
      }
    }

    const normalizedPhone = phoneStr ? normalizeRecipientPhone(phoneStr) : null
    if (!normalizedPhone) {
      result.invalidCount++
      result.errors.push(
        `Line ${lineIndex + 1}: Invalid phone number format "${phoneStr || ""}"`
      )
      continue
    }

    const digitsOnly = normalizedPhone.replace(/\D/g, "")
    if (seenPhones.has(digitsOnly)) {
      // Skip duplicate
      continue
    }
    seenPhones.add(digitsOnly)

    result.recipients.push({
      phone: normalizedPhone,
      ...(nameStr && nameStr.trim() ? { name: nameStr.trim() } : {}),
      ...(customParams.length > 0 ? { customParams } : {}),
    })
    result.validCount++
  }

  return result
}
