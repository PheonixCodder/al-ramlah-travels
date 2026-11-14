/**
 * Al Ramlah Travels — Pure WhatsApp Phone & Reference Code Utilities
 * Client-safe (zero server / database dependencies).
 */

export interface PhoneNormalizationResult {
  raw: string
  digitsOnly: string
  normalizedE164: string
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
  const matches = text.match(/\bART-[A-Za-z0-9_-]+\b/gi)
  if (!matches) return []
  const unique = Array.from(new Set(matches.map((c) => c.toUpperCase())))
  return unique
}

/**
 * Normalizes a Pakistani phone number into standard variants:
 * - `03xx-xxxxxxx` (11 digits, national)
 * - `923xx-xxxxxxx` (12 digits, E.164 without plus)
 * - `+923xx-xxxxxxx` (E.164 with plus)
 */
export function normalizePakistaniPhone(
  rawPhone: string | null | undefined
): PhoneNormalizationResult {
  if (!rawPhone) {
    return {
      raw: "",
      digitsOnly: "",
      normalizedE164: "",
      national03: "",
      variants: [],
    }
  }

  const raw = rawPhone.trim()
  let digits = raw.replace(/\D/g, "")

  // Strip international dialing prefix 00
  if (digits.startsWith("00")) {
    digits = digits.slice(2)
  }

  let normalizedE164 = digits
  let national03 = digits

  if (digits.startsWith("92") && digits.length === 12) {
    normalizedE164 = digits
    national03 = "0" + digits.slice(2)
  } else if (digits.startsWith("03") && digits.length === 11) {
    normalizedE164 = "92" + digits.slice(1)
    national03 = digits
  } else if (digits.startsWith("3") && digits.length === 10) {
    normalizedE164 = "92" + digits
    national03 = "0" + digits
  }

  const variants = Array.from(
    new Set([
      digits,
      normalizedE164,
      `+${normalizedE164}`,
      national03,
      raw,
    ].filter(Boolean))
  )

  return {
    raw,
    digitsOnly: digits,
    normalizedE164,
    national03,
    variants,
  }
}
