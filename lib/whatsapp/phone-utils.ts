/**
 * Al Ramlah Travels — Pure WhatsApp Phone & Reference Code Utilities (`T-049`).
 * Client-safe (zero server / database dependencies), backed by `@/lib/phone` SSoT.
 */

import {
  constantTimeEqualStrings,
  formatWhatsAppPhone,
  normalizePhoneE164,
  parsePhoneE164,
  phonesMatchStrict,
  toWaMeUrl,
  toWhatsappJid,
  type ParsedPhoneE164,
} from "../phone"

export {
  constantTimeEqualStrings,
  formatWhatsAppPhone,
  normalizePhoneE164,
  parsePhoneE164,
  phonesMatchStrict,
  toWaMeUrl,
  toWhatsappJid,
  type ParsedPhoneE164,
}

export interface PhoneNormalizationResult {
  raw: string
  digitsOnly: string
  /** E.164 digits without leading `+` (e.g. `"923274029701"` or `"447911123456"`) */
  normalizedE164: string
  /** Canonical E.164 with leading `+` (e.g. `"+923274029701"` or `"+447911123456"`) */
  e164WithPlus?: string
  /** National `03XXXXXXXXX` format for Pakistani numbers, or national digits for international */
  national03: string
  variants: string[]
}

/**
 * Extracts all `ART-...` reference codes from an inbound text string.
 * Example: "Salam, price for ART-AM-21D-01 or ref ART-2026-8812?"
 * Returns: ["ART-AM-21D-01", "ART-2026-8812"]
 */
export function extractPostRefCodes(text: string | null | undefined): string[] {
  if (!text) return []
  const matches = text.match(/\bART-[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)+\b/gi)
  if (!matches) return []
  return Array.from(new Set(matches.map((c) => c.toUpperCase())))
}

/**
 * Normalizes a Pakistani or international phone number into canonical E.164 & lookup variants
 * using the single source of truth in `@/lib/phone`:
 * - `03xx-xxxxxxx` / `3xx-xxxxxxx` -> `normalizedE164: "923xxxxxxxxx"`, `e164WithPlus: "+923xxxxxxxxx"`, `national03: "03xxxxxxxxx"`
 * - International `+44 (0) 7911 123456` -> `normalizedE164: "447911123456"`, `e164WithPlus: "+447911123456"`
 * - Malformed / empty / hyphen-only strings -> empty fields & `variants: []`
 */
export function normalizePakistaniPhone(
  rawPhone: string | null | undefined
): PhoneNormalizationResult {
  if (!rawPhone || typeof rawPhone !== "string") {
    return {
      raw: "",
      digitsOnly: "",
      normalizedE164: "",
      e164WithPlus: "",
      national03: "",
      variants: [],
    }
  }

  const raw = rawPhone.trim()
  const digitsOnly = raw.replace(/\D/g, "")
  const parsed = parsePhoneE164(raw)

  if (!parsed.valid) {
    return {
      raw,
      digitsOnly,
      normalizedE164: "",
      e164WithPlus: "",
      national03: "",
      variants: [],
    }
  }

  const national03 = parsed.national03 || parsed.nationalDigits
  const variants = Array.from(
    new Set(
      [
        parsed.e164Digits,
        parsed.e164,
        national03,
        digitsOnly,
        raw,
      ].filter(Boolean)
    )
  )

  return {
    raw,
    digitsOnly,
    normalizedE164: parsed.e164Digits,
    e164WithPlus: parsed.e164,
    national03,
    variants,
  }
}
