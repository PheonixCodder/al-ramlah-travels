/**
 * Al Ramlah Travels — Canonical E.164 Phone & WhatsApp JID Single Source of Truth (`T-049`).
 *
 * Strictly isomorphic (zero Node-only runtime imports) so both Server Actions,
 * Trigger.dev workers, and `"use client"` components share identical normalization
 * and constant-time comparison semantics.
 */

export interface ParsedPhoneE164 {
  valid: boolean
  /** Canonical E.164 with leading `+` (e.g. `"+923274029701"`, `"+447911123456"`), or `""` if invalid */
  e164: string
  /** Canonical E.164 digits without `+` (e.g. `"923274029701"`, `"447911123456"`), or `""` if invalid */
  e164Digits: string
  /** Detected ITU-T E.164 country calling code (e.g. `"92"`, `"44"`, `"1"`, `"966"`, `"971"`), or `""` */
  countryCode: string
  /** Significant national number without trunk `0` (e.g. `"3274029701"`, `"7911123456"`), or `""` */
  nationalDigits: string
  /** Local Pakistani `03XXXXXXXXX` / `0XXXXXXXXXX` representation when `countryCode === "92"`, else `""` */
  national03: string
}

const TWO_DIGIT_COUNTRY_CODES = new Set([
  "20",
  "27",
  "30",
  "31",
  "32",
  "33",
  "34",
  "36",
  "39",
  "40",
  "41",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "81",
  "82",
  "84",
  "86",
  "90",
  "91",
  "92",
  "93",
  "94",
  "95",
  "98",
])

/**
 * Countries where a national trunk prefix `0` is commonly written after the country code
 * (e.g. `+44 (0) 7911 123456`, `+92 0327 4029701`, `+966 050 123 4567`, `+971 050 123 4567`).
 * Note: Italy (`39`) is intentionally excluded because leading `0` is part of Italian geographic numbers.
 */
const TRUNK_ZERO_PREFIX_RULES: ReadonlyArray<{
  cc: string
  minNatDigits: number
  maxNatDigits: number
}> = [
  { cc: "92", minNatDigits: 10, maxNatDigits: 10 },
  { cc: "44", minNatDigits: 9, maxNatDigits: 10 },
  { cc: "966", minNatDigits: 9, maxNatDigits: 9 },
  { cc: "971", minNatDigits: 8, maxNatDigits: 9 },
  { cc: "974", minNatDigits: 8, maxNatDigits: 8 },
  { cc: "973", minNatDigits: 8, maxNatDigits: 8 },
  { cc: "968", minNatDigits: 8, maxNatDigits: 8 },
  { cc: "965", minNatDigits: 8, maxNatDigits: 8 },
  { cc: "962", minNatDigits: 8, maxNatDigits: 9 },
  { cc: "880", minNatDigits: 9, maxNatDigits: 10 },
  { cc: "90", minNatDigits: 10, maxNatDigits: 10 },
  { cc: "61", minNatDigits: 9, maxNatDigits: 9 },
  { cc: "49", minNatDigits: 9, maxNatDigits: 11 },
  { cc: "33", minNatDigits: 9, maxNatDigits: 9 },
  { cc: "31", minNatDigits: 9, maxNatDigits: 9 },
  { cc: "32", minNatDigits: 8, maxNatDigits: 9 },
]

const INVALID_PHONE_RESULT: ParsedPhoneE164 = Object.freeze({
  valid: false,
  e164: "",
  e164Digits: "",
  countryCode: "",
  nationalDigits: "",
  national03: "",
})

function extractCountryCode(e164Digits: string): string {
  if (!e164Digits) return ""
  const d1 = e164Digits.slice(0, 1)
  if (d1 === "1" || d1 === "7") {
    return d1
  }
  const d2 = e164Digits.slice(0, 2)
  if (TWO_DIGIT_COUNTRY_CODES.has(d2)) {
    return d2
  }
  return e164Digits.slice(0, 3)
}

function stripTrunkZeroAfterCountryCode(digits: string): string {
  for (const rule of TRUNK_ZERO_PREFIX_RULES) {
    if (digits.startsWith(`${rule.cc}0`)) {
      const rest = digits.slice(rule.cc.length + 1)
      if (
        rest.length >= rule.minNatDigits &&
        rest.length <= rule.maxNatDigits &&
        /^[1-9]\d+$/.test(rest)
      ) {
        return `${rule.cc}${rest}`
      }
    }
  }
  return digits
}

function isCountryLengthValid(cc: string, nationalDigits: string): boolean {
  const len = nationalDigits.length
  if (!/^[1-9]\d*$/.test(nationalDigits) && cc !== "39") {
    return false
  }
  switch (cc) {
    case "92":
      return len === 10
    case "1":
      return len === 10
    case "966":
      return len === 9
    case "971":
      return len >= 8 && len <= 9
    case "44":
      return len >= 9 && len <= 10
    default:
      return len >= 7 && cc.length + len >= 10 && cc.length + len <= 15
  }
}

/**
 * Constant-time string comparison (pure bitwise XOR, safe in Browser & Node runtimes).
 * Never short-circuits on character mismatch; incorporates length mismatch into `diff`.
 */
export function constantTimeEqualStrings(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length, 16)
  let diff = a.length ^ b.length
  for (let i = 0; i < maxLen; i++) {
    const codeA = i < a.length ? a.charCodeAt(i) : 0
    const codeB = i < b.length ? b.charCodeAt(i) : 0
    diff |= codeA ^ codeB
  }
  return diff === 0
}

/**
 * Parses and normalizes Pakistani & diaspora international phone numbers into canonical E.164:
 * - Pakistani `03XXXXXXXXX` / `3XXXXXXXXX` -> `+923XXXXXXXXX` (`923XXXXXXXXX`)
 * - Pakistani `0092 3XX XXXXXXX` / `+92 (0) 3XX XXXXXXX` -> `+923XXXXXXXXX`
 * - International `+44 (0) 7911 123456`, `+1 (555) 234-5678`, `+966 50 123 4567`, `+971 50 123 4567`
 *   preserved without ever corrupting non-PK prefixes into `+92...`.
 * - Rejects empty strings, punctuation-only strings (`"-------"`), and truncated fragments.
 */
export function parsePhoneE164(
  rawInput: string | null | undefined
): ParsedPhoneE164 {
  if (!rawInput || typeof rawInput !== "string") {
    return INVALID_PHONE_RESULT
  }

  let working = rawInput.trim()
  if (!working) {
    return INVALID_PHONE_RESULT
  }

  // Reject inputs containing alphabetic characters (except valid WhatsApp JID domains stripped below)
  if (working.includes("@")) {
    const [leftOfAt, domain] = working.split("@")
    if (
      !domain ||
      !/^(s\.whatsapp\.net|c\.us|lid)$/i.test(domain.trim()) ||
      !leftOfAt
    ) {
      return INVALID_PHONE_RESULT
    }
    working = leftOfAt.split(":")[0] ?? ""
  }

  if (/[a-zA-Z]/.test(working)) {
    return INVALID_PHONE_RESULT
  }

  const hasLeadingPlus = working.startsWith("+")

  // Strip parenthesized trunk zero `(0)` used in international notation, e.g. `+44 (0) 7911 123456`
  const withoutParenTrunkZero = working.replace(/\(\s*0\s*\)/g, " ")
  const rawDigits = withoutParenTrunkZero.replace(/\D/g, "")

  if (rawDigits.length < 9 || rawDigits.length > 17) {
    return INVALID_PHONE_RESULT
  }

  const hasLeadingDoubleZero = !hasLeadingPlus && /^00[1-9]/.test(rawDigits)
  const hasExplicitIntlPrefix = hasLeadingPlus || hasLeadingDoubleZero

  let candidateDigits = hasLeadingDoubleZero ? rawDigits.slice(2) : rawDigits

  if (hasExplicitIntlPrefix) {
    candidateDigits = stripTrunkZeroAfterCountryCode(candidateDigits)
  } else {
    // National / unprefixed formats
    const isNanpFormatted10 =
      rawDigits.length === 10 &&
      /^\(?[2-9]\d{2}\)?[\s.-][2-9]\d{2}[\s.-]\d{4}$/.test(working)

    if (/^03\d{9}$/.test(candidateDigits)) {
      // Standard Pakistani mobile: 03XXXXXXXXX -> 923XXXXXXXXX
      candidateDigits = `92${candidateDigits.slice(1)}`
    } else if (/^0[1-9]\d{8,9}$/.test(candidateDigits)) {
      // Standard Pakistani geographic landline: 042XXXXXXXX -> 9242XXXXXXXX
      candidateDigits = `92${candidateDigits.slice(1)}`
    } else if (
      /^3[0-7]\d{8}$/.test(candidateDigits) &&
      !isNanpFormatted10
    ) {
      // Bare 10-digit Pakistani mobile: 3274029701 -> 923274029701
      candidateDigits = `92${candidateDigits}`
    } else if (isNanpFormatted10) {
      // North American 10-digit formatted `(312) 555-0199` / `312-555-0199` -> `13125550199`
      candidateDigits = `1${candidateDigits}`
    } else {
      candidateDigits = stripTrunkZeroAfterCountryCode(candidateDigits)
    }
  }

  if (!/^[1-9]\d{9,14}$/.test(candidateDigits)) {
    return INVALID_PHONE_RESULT
  }

  const countryCode = extractCountryCode(candidateDigits)
  const nationalDigits = candidateDigits.slice(countryCode.length)

  if (!isCountryLengthValid(countryCode, nationalDigits)) {
    return INVALID_PHONE_RESULT
  }

  const national03 = countryCode === "92" ? `0${nationalDigits}` : ""

  return {
    valid: true,
    e164: `+${candidateDigits}`,
    e164Digits: candidateDigits,
    countryCode,
    nationalDigits,
    national03,
  }
}

/**
 * Returns canonical E.164 phone with `+` (e.g. `"+923274029701"`), or `""` if invalid.
 */
export function normalizePhoneE164(raw: string | null | undefined): string {
  return parsePhoneE164(raw).e164
}

/**
 * Formats a raw phone string into canonical E.164 digits WITHOUT `+`
 * for WhatsApp `wa.me/<digits>`, Meta Cloud API `to`, and Baileys JIDs.
 * Returns `""` if the input is empty or not a valid phone number.
 */
export function formatWhatsAppPhone(raw: string | null | undefined): string {
  return parsePhoneE164(raw).e164Digits
}

/**
 * Builds a safe `https://wa.me/<e164Digits>` deep link (with optional URL-encoded `?text=`).
 * Returns `""` if `phone` is not a valid phone number.
 */
export function toWaMeUrl(
  phone: string | null | undefined,
  text?: string | null
): string {
  const digits = formatWhatsAppPhone(phone)
  if (!digits) return ""
  if (typeof text === "string" && text.length > 0) {
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  }
  return `https://wa.me/${digits}`
}

/**
 * Strict, constant-time E.164 phone equality check (`T-015`, `T-049`):
 * - Normalizes both inputs via `parsePhoneE164`.
 * - Requires both numbers to be valid with `>= 9` national digits (blocking empty strings,
 *   `"-------"`, and 7-digit partial suffix enumeration attacks).
 * - Compares normalized E.164 strings in constant time.
 */
export function phonesMatchStrict(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const parsedA = parsePhoneE164(a)
  const parsedB = parsePhoneE164(b)

  const equalE164 = constantTimeEqualStrings(parsedA.e164, parsedB.e164)
  const bothValidAndLongEnough =
    parsedA.valid &&
    parsedB.valid &&
    parsedA.nationalDigits.length >= 9 &&
    parsedB.nationalDigits.length >= 9

  return bothValidAndLongEnough && equalE164
}

/**
 * Normalizes a phone number or WhatsApp JID into a valid WhatsApp JID:
 * - `status@broadcast(:.*)?` -> `"status@broadcast"`
 * - Group/channel/LID JIDs (`@g.us`, `@newsletter`, `@lid`) -> preserved trimmed
 * - Phone or `<phone>@s.whatsapp.net` -> `<e164Digits>@s.whatsapp.net` (or `""` if invalid)
 */
export function toWhatsappJid(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return ""
  const trimmed = raw.trim()
  if (!trimmed) return ""

  if (/^status@broadcast(:.*)?$/i.test(trimmed)) {
    return "status@broadcast"
  }

  if (trimmed.includes("@")) {
    const [userPart, domainPart] = trimmed.split("@")
    const domain = (domainPart ?? "").trim().toLowerCase()
    if (domain === "g.us" || domain === "newsletter" || domain === "lid") {
      return userPart ? `${userPart.trim()}@${domain}` : ""
    }
    if (domain === "s.whatsapp.net" || domain === "c.us") {
      const cleanUser = (userPart ?? "").split(":")[0] ?? ""
      const digits = formatWhatsAppPhone(cleanUser)
      return digits ? `${digits}@s.whatsapp.net` : ""
    }
    return ""
  }

  const digits = formatWhatsAppPhone(trimmed)
  return digits ? `${digits}@s.whatsapp.net` : ""
}
