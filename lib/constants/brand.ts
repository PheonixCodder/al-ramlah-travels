/**
 * Canonical Brand, Regulatory & Lahore HQ Single Source of Truth (`OD-10`, `T-050`).
 *
 * Verified headquarters address:
 * Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan
 *
 * Unverified regulatory licenses (DTS, MORA, IATA, NTN) and unverified corporate IBANs
 * default to `null` / `ibanVerified = false` until verified by a `super_admin` in `/admin/settings`.
 */

export const BRAND_NAME = "Al Ramlah Travels"
export const BRAND_LEGAL_NAME = "Al Ramlah Travels"
export const BRAND_ARABIC_NAME = "سفريات الرملة"
export const BRAND_TAGLINE = "Where Purpose Meets Excellence"

export const BRAND_OFFICE_ADDRESS =
  "Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan"
export const BRAND_CITY = "Lahore"
export const BRAND_COUNTRY = "Pakistan"
export const BRAND_TIMEZONE = "Asia/Karachi"
export const BRAND_PKT_UTC_OFFSET_HOURS = 5

export const BRAND_PRIMARY_WHATSAPP = "03274029701"
export const BRAND_PRIMARY_WHATSAPP_E164 = "+923274029701"
export const BRAND_PRIMARY_WHATSAPP_DIGITS = "923274029701"

export const BRAND_SECONDARY_PHONE = "03190462638"
export const BRAND_SECONDARY_PHONE_E164 = "+923190462638"
export const BRAND_SECONDARY_PHONE_DIGITS = "923190462638"

export const BRAND_HOTLINE_DISPLAY = "+92 327 4029701 · +92 319 0462638"
export const BRAND_SUPPORT_EMAIL = "alramlahtravels@gmail.com"
export const BRAND_WEBSITE_URL = "https://www.alramlahtravels.com"
export const BRAND_WEBSITE_DOMAIN = "www.alramlahtravels.com"

export const BRAND_MAPS_EMBED_URL =
  "https://maps.google.com/?q=Sector+C+Askari+10+Airport+Road+Lahore+Cantt"
export const BRAND_WORKING_HOURS = "Monday to Saturday: 9:00 AM to 8:00 PM PKT"

export const BRAND_SOCIAL_URLS = {
  facebook: "https://facebook.com/alramlahtravels",
  instagram: "https://instagram.com/alramlahtravels",
  youtube: "https://youtube.com/@alramlahtravels",
  tiktok: "https://tiktok.com/@alramlahtravels",
} as const

export const BRAND_DEFAULT_SLA_HOURS = 24
export const BRAND_DEFAULT_SAR_TO_PKR = 75
export const BRAND_IBAN_VERIFIED_DEFAULT = false

/**
 * Single Haramain luxury theme palette tokens (matched to `public/logo.jpg`).
 * Dark mode / theme switching is strictly disallowed across the platform.
 */
export const BRAND_COLORS = {
  emeraldDeep: "#0A3622",
  emeraldAccent: "#0F5132",
  warmIvory: "#FAF7F0",
  alabasterSurface: "#F4EFE4",
  metallicGold: "#C5A059",
  accessibleGoldText: "#8A6914",
} as const

export const AL_RAMLAH_BRAND = {
  name: BRAND_NAME,
  legalEntityName: BRAND_LEGAL_NAME,
  arabicName: BRAND_ARABIC_NAME,
  tagline: BRAND_TAGLINE,
  officeAddress: BRAND_OFFICE_ADDRESS,
  city: BRAND_CITY,
  country: BRAND_COUNTRY,
  timezone: BRAND_TIMEZONE,
  primaryWhatsapp: BRAND_PRIMARY_WHATSAPP,
  primaryWhatsappE164: BRAND_PRIMARY_WHATSAPP_E164,
  primaryWhatsappDigits: BRAND_PRIMARY_WHATSAPP_DIGITS,
  secondaryPhone: BRAND_SECONDARY_PHONE,
  secondaryPhoneE164: BRAND_SECONDARY_PHONE_E164,
  secondaryPhoneDigits: BRAND_SECONDARY_PHONE_DIGITS,
  hotlineDisplay: BRAND_HOTLINE_DISPLAY,
  supportEmail: BRAND_SUPPORT_EMAIL,
  websiteUrl: BRAND_WEBSITE_URL,
  mapsEmbedUrl: BRAND_MAPS_EMBED_URL,
  workingHours: BRAND_WORKING_HOURS,
  socialUrls: BRAND_SOCIAL_URLS,
  defaultSlaOverdueHours: BRAND_DEFAULT_SLA_HOURS,
  defaultSarToPkrRate: BRAND_DEFAULT_SAR_TO_PKR,
  dtsLicense: null as string | null,
  moraLicense: null as string | null,
  iataCode: null as string | null,
  ntnNumber: null as string | null,
  officialIban: null as string | null,
  ibanVerified: BRAND_IBAN_VERIFIED_DEFAULT,
  colors: BRAND_COLORS,
} as const

export const BRAND_CONFIG = AL_RAMLAH_BRAND
