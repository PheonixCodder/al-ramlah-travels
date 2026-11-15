/**
 * Isomorphic public-route utilities for Al Ramlah Travels (`F-PUB`).
 * Safe to import from both React Server Components / Server Actions and Client Components.
 */

export interface NormalizedPublicPhone {
  /** Digits-only E.164 representation without '+' (e.g. "923274029701", "447911123456") */
  e164Digits: string
  /** Canonical E.164 string with '+' prefix (e.g. "+923274029701") */
  e164: string
  /** Significant national subscriber digits (guaranteed >= 9 digits when valid) */
  nationalDigits: string
}

const KNOWN_3_DIGIT_CC = [
  "966", // Saudi Arabia
  "971", // UAE
  "974", // Qatar
  "973", // Bahrain
  "968", // Oman
  "965", // Kuwait
  "962", // Jordan
  "961", // Lebanon
  "880", // Bangladesh
  "353", // Ireland
]

const KNOWN_2_DIGIT_CC = [
  "92", // Pakistan
  "44", // United Kingdom
  "90", // Turkey
  "60", // Malaysia
  "61", // Australia
  "65", // Singapore
  "49", // Germany
  "33", // France
  "39", // Italy
  "34", // Spain
  "31", // Netherlands
  "46", // Sweden
  "47", // Norway
  "45", // Denmark
  "41", // Switzerland
  "43", // Austria
  "32", // Belgium
  "27", // South Africa
  "91", // India
  "86", // China
  "81", // Japan
  "82", // South Korea
]

function splitCountryAndNationalDigits(
  intlDigits: string
): { cc: string; national: string } | null {
  if (intlDigits.startsWith("1")) {
    const national = intlDigits.slice(1)
    return { cc: "1", national }
  }

  for (const cc of KNOWN_3_DIGIT_CC) {
    if (intlDigits.startsWith(cc)) {
      const national = intlDigits.slice(cc.length).replace(/^0+/, "")
      return { cc, national }
    }
  }

  for (const cc of KNOWN_2_DIGIT_CC) {
    if (intlDigits.startsWith(cc)) {
      const national = intlDigits.slice(cc.length).replace(/^0+/, "")
      return { cc, national }
    }
  }

  // Generic ITU-T fallback: treat leading 2 digits as country code
  if (intlDigits.length >= 11) {
    const cc = intlDigits.slice(0, 2)
    const national = intlDigits.slice(2).replace(/^0+/, "")
    return { cc, national }
  }

  return null
}

/**
 * Strictly parses and normalizes Pakistani and international diaspora phone numbers.
 * Returns `null` if the input is empty, contains letters, consists of punctuation
 * (e.g. `"-------"`), or resolves to `< 9` national subscriber digits.
 */
export function normalizePublicPhone(
  raw: string | null | undefined
): NormalizedPublicPhone | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 32) return null

  // Reject any alphabetic characters (e.g. vanity strings or XSS payloads)
  if (/[a-zA-Z]/.test(trimmed)) return null

  // Reject unexpected characters outside standard phone formatting symbols
  if (!/^[+\d\s().-]+$/.test(trimmed)) return null

  // Strip optional trunk '(0)' used in UK / PK international notation: "+44 (0) 7911..."
  const withoutTrunkZeroParen = trimmed.replace(/\(\s*0\s*\)/g, "")
  const hasExplicitPlus = withoutTrunkZeroParen.startsWith("+")
  const digitsOnly = withoutTrunkZeroParen.replace(/\D/g, "")

  if (!digitsOnly) return null

  // Reject degenerate repeated digits like "00000000000" or "9999999999"
  if (/^(\d)\1{8,}$/.test(digitsOnly)) return null

  let intlDigits = ""

  if (hasExplicitPlus) {
    intlDigits = digitsOnly
  } else if (digitsOnly.startsWith("00") && digitsOnly.length >= 12) {
    intlDigits = digitsOnly.slice(2)
  } else if (digitsOnly.startsWith("0") && digitsOnly.length >= 10 && digitsOnly.length <= 11) {
    // Pakistani domestic format: 03XXXXXXXXX (11 digits) or 042XXXXXXXX (10-11 digits)
    const subscriber = digitsOnly.slice(1)
    if (subscriber.length < 9 || subscriber.length > 10) return null
    intlDigits = `92${subscriber}`
  } else if (digitsOnly.length === 10 && digitsOnly.startsWith("3")) {
    // Pakistani mobile without leading 0: 3XXXXXXXXX
    intlDigits = `92${digitsOnly}`
  } else if (digitsOnly.length >= 11 && digitsOnly.length <= 15) {
    // Bare E.164 digits such as "923274029701", "447911123456", "14165550198"
    intlDigits = digitsOnly
  } else {
    return null
  }

  const split = splitCountryAndNationalDigits(intlDigits)
  if (!split) return null

  const { cc, national } = split
  if (national.length < 9 || national.length > 12) {
    return null
  }

  if (cc === "92" && (national.length < 9 || national.length > 10)) {
    return null
  }

  if (cc === "1" && national.length !== 10) {
    return null
  }

  const canonicalDigits = `${cc}${national}`
  if (canonicalDigits.length < 10 || canonicalDigits.length > 15) {
    return null
  }

  return {
    e164Digits: canonicalDigits,
    e164: `+${canonicalDigits}`,
    nationalDigits: national,
  }
}

export const DEFAULT_AGENCY_WAME_DIGITS = "923274029701"

/**
 * Formats any Pakistani or international phone number into a canonical `https://wa.me/<e164Digits>` URL.
 * Never outputs `wa.me/03...`, `wa.me/+92...`, or unencoded spaces.
 */
export function toWaMeUrl(
  rawPhone: string | null | undefined,
  message?: string,
  fallbackDigits: string = DEFAULT_AGENCY_WAME_DIGITS
): string {
  const parsed = normalizePublicPhone(rawPhone)
  const fallbackParsed = normalizePublicPhone(fallbackDigits)
  const targetDigits =
    parsed?.e164Digits ?? fallbackParsed?.e164Digits ?? DEFAULT_AGENCY_WAME_DIGITS

  if (message && message.trim().length > 0) {
    return `https://wa.me/${targetDigits}?text=${encodeURIComponent(message)}`
  }
  return `https://wa.me/${targetDigits}`
}

/**
 * Returns today's calendar date (`YYYY-MM-DD`) in Pakistan Standard Time (`Asia/Karachi`, UTC+05:00).
 * Deterministic across all server and browser timezones.
 */
export function getTodayPktIso(now: Date = new Date()): string {
  const pktEpochMs = now.getTime() + 5 * 60 * 60 * 1000
  const pktDate = new Date(pktEpochMs)
  const y = String(pktDate.getUTCFullYear()).padStart(4, "0")
  const m = String(pktDate.getUTCMonth() + 1).padStart(2, "0")
  const d = String(pktDate.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Validates that `isoStr` is a real Gregorian calendar `YYYY-MM-DD` date
 * (rejecting rollovers such as `2026-02-31` or `2026-11-31`).
 */
export function isStrictIsoCalendarDate(isoStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return false
  const [yStr, mStr, dStr] = isoStr.split("-")
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return false
  }
  if (y < 2020 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return false
  }
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  )
}

export interface HaramainPrayerSchedule {
  astClock24: string
  nextPrayerName: "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha"
  nextPrayerArabic: string
  makkahTime24: string
  madinahTime24: string
  makkahPrayers: Record<"Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha", string>
  madinahPrayers: Record<"Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha", string>
}

const PRAYER_ARABIC: Record<
  "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha",
  string
> = {
  Fajr: "الفجر",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

function formatHours24(hoursFloat: number): string {
  const normalized = ((hoursFloat % 24) + 24) % 24
  const totalMinutes = Math.round(normalized * 60) % (24 * 60)
  const hh = Math.floor(totalMinutes / 60)
  const mm = totalMinutes % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

function computeUmmAlQuraCityHours(
  dayOfYear: number,
  latDeg: number,
  lonDeg: number
): Record<"Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha", number> {
  // Fractional year angle at solar noon (radians)
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + 0.5)

  // Equation of time (minutes) & solar declination (radians) — Spencer (1971)
  const eqTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))

  const declRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)

  const latRad = degToRad(latDeg)
  const tzOffsetHours = 3 // Arabia Standard Time (UTC+03:00)
  const solarNoonHours = 12 + tzOffsetHours - lonDeg / 15 - eqTimeMin / 60

  const hourAngleHours = (altitudeDeg: number): number => {
    const altRad = degToRad(altitudeDeg)
    const cosH =
      (Math.sin(altRad) - Math.sin(latRad) * Math.sin(declRad)) /
      (Math.cos(latRad) * Math.cos(declRad))
    const clamped = Math.max(-1, Math.min(1, cosH))
    return radToDeg(Math.acos(clamped)) / 15
  }

  // Standard Asr altitude (shadow factor = 1 in Haramain)
  const asrAltRad = Math.atan(1 / (1 + Math.tan(Math.abs(latRad - declRad))))
  const asrAltDeg = radToDeg(asrAltRad)

  const fajr = solarNoonHours - hourAngleHours(-18.5)
  const dhuhr = solarNoonHours + 2 / 60
  const asr = solarNoonHours + hourAngleHours(asrAltDeg)
  const maghrib = solarNoonHours + hourAngleHours(-0.833)
  const isha = maghrib + 1.5 // Umm al-Qura: 90 minutes after Maghrib

  return {
    Fajr: fajr,
    Dhuhr: dhuhr,
    Asr: asr,
    Maghrib: maghrib,
    Isha: isha,
  }
}

/**
 * Pure zero-network Umm al-Qura astronomical prayer-time calculation (`OD-08`)
 * for Makkah al-Mukarramah (`21.4225°N, 39.8262°E`) and Al-Madinah al-Munawwarah (`24.4672°N, 39.6111°E`)
 * in Arabia Standard Time (`AST / UTC+3`).
 */
export function computeHaramainPrayerTimes(
  now: Date = new Date()
): HaramainPrayerSchedule {
  const astMs = now.getTime() + 3 * 60 * 60 * 1000
  const astDate = new Date(astMs)
  const yearStartMs = Date.UTC(astDate.getUTCFullYear(), 0, 1)
  const dayOfYear = Math.floor((astMs - yearStartMs) / 86_400_000) + 1

  const currentAstHours =
    astDate.getUTCHours() +
    astDate.getUTCMinutes() / 60 +
    astDate.getUTCSeconds() / 3600

  const makkahHours = computeUmmAlQuraCityHours(dayOfYear, 21.4225, 39.8262)
  const madinahHours = computeUmmAlQuraCityHours(dayOfYear, 24.4672, 39.6111)

  const order: Array<"Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha"> = [
    "Fajr",
    "Dhuhr",
    "Asr",
    "Maghrib",
    "Isha",
  ]

  const nextPrayerName =
    order.find((name) => makkahHours[name] > currentAstHours) ?? "Fajr"

  return {
    astClock24: formatHours24(currentAstHours),
    nextPrayerName,
    nextPrayerArabic: PRAYER_ARABIC[nextPrayerName],
    makkahTime24: formatHours24(makkahHours[nextPrayerName]),
    madinahTime24: formatHours24(madinahHours[nextPrayerName]),
    makkahPrayers: {
      Fajr: formatHours24(makkahHours.Fajr),
      Dhuhr: formatHours24(makkahHours.Dhuhr),
      Asr: formatHours24(makkahHours.Asr),
      Maghrib: formatHours24(makkahHours.Maghrib),
      Isha: formatHours24(makkahHours.Isha),
    },
    madinahPrayers: {
      Fajr: formatHours24(madinahHours.Fajr),
      Dhuhr: formatHours24(madinahHours.Dhuhr),
      Asr: formatHours24(madinahHours.Asr),
      Maghrib: formatHours24(madinahHours.Maghrib),
      Isha: formatHours24(madinahHours.Isha),
    },
  }
}

/**
 * Deterministic SSR/Client hydration-safe Pakistani Rupee (`PKR`) formatter (`SEO-001`, `S08-004`).
 * Avoids `Number.prototype.toLocaleString()` ICU locale variances between Node.js and browsers.
 */
export function formatPkr(amount: number): string {
  if (!Number.isFinite(amount)) {
    return "PKR 0"
  }
  const rounded = Math.round(amount)
  const sign = rounded < 0 ? "-" : ""
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${sign}PKR ${grouped}`
}
