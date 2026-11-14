export interface AgencySettingsInput {
  agencyName?: string | null
  tagline?: string | null
  primaryWhatsapp?: string | null
  secondaryPhone?: string | null
  supportEmail?: string | null
  officeAddress?: string | null
  workingHours?: string | null
  mapsEmbedUrl?: string | null
  sarToPkrRate?: number | null
}

export interface CompanyInfo {
  agencyName: string
  tagline: string
  primaryWhatsapp: string
  secondaryPhone: string
  supportEmail: string
  officeAddress: string
  workingHours: string
  mapsEmbedUrl: string
  sarToPkrRate: number
  hotlineDisplay: string
  normalizedWhatsapp: string
  whatsappUrl: string
}

export const DEFAULT_OFFICE_ADDRESS =
  "House no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt"

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  agencyName: "Al Ramlah Travels",
  tagline: "Where Purpose Meets Excellence",
  primaryWhatsapp: "03274029701",
  secondaryPhone: "03190462638",
  supportEmail: "alramlahtravels@gmail.com",
  officeAddress: DEFAULT_OFFICE_ADDRESS,
  workingHours: "Monday to Saturday: 9:00 AM to 8:00 PM PKT",
  mapsEmbedUrl:
    "https://maps.google.com/?q=Sector+C+Askari+10+Airport+Road+Lahore+Cantt",
  sarToPkrRate: 75,
  hotlineDisplay: "03274029701 · 03190462638",
  normalizedWhatsapp: "923274029701",
  whatsappUrl:
    "https://wa.me/923274029701?text=Assalam%20o%20Alaikum%2C%20I%20would%20like%20to%20inquire%20about%20Al%20Ramlah%20Travels%20pilgrimage%20packages.",
}

export function normalizeWhatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("03")) {
    return `923${digits.slice(2)}`
  }
  return digits
}

export function buildWhatsappUrl(
  phone: string,
  message = "Assalam o Alaikum, I would like to inquire about Al Ramlah Travels pilgrimage packages."
): string {
  const normalized = normalizeWhatsappNumber(phone) || "923274029701"
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function getCompanyInfo(
  dbSettings?: AgencySettingsInput | null
): CompanyInfo {
  const agencyName =
    dbSettings?.agencyName?.trim() || DEFAULT_COMPANY_INFO.agencyName
  const tagline = dbSettings?.tagline?.trim() || DEFAULT_COMPANY_INFO.tagline
  const primaryWhatsapp =
    dbSettings?.primaryWhatsapp?.trim() || DEFAULT_COMPANY_INFO.primaryWhatsapp
  const secondaryPhone =
    dbSettings?.secondaryPhone?.trim() || DEFAULT_COMPANY_INFO.secondaryPhone
  const supportEmail =
    dbSettings?.supportEmail?.trim() || DEFAULT_COMPANY_INFO.supportEmail
  const officeAddress =
    dbSettings?.officeAddress?.trim() || DEFAULT_COMPANY_INFO.officeAddress
  const workingHours =
    dbSettings?.workingHours?.trim() || DEFAULT_COMPANY_INFO.workingHours
  const mapsEmbedUrl =
    dbSettings?.mapsEmbedUrl?.trim() || DEFAULT_COMPANY_INFO.mapsEmbedUrl
  const sarToPkrRate =
    typeof dbSettings?.sarToPkrRate === "number" && dbSettings.sarToPkrRate > 0
      ? dbSettings.sarToPkrRate
      : DEFAULT_COMPANY_INFO.sarToPkrRate

  const hotlineDisplay = [primaryWhatsapp, secondaryPhone]
    .filter(Boolean)
    .join(" · ")

  const normalizedWhatsapp = normalizeWhatsappNumber(primaryWhatsapp)
  const whatsappUrl = buildWhatsappUrl(primaryWhatsapp)

  return {
    agencyName,
    tagline,
    primaryWhatsapp,
    secondaryPhone,
    supportEmail,
    officeAddress,
    workingHours,
    mapsEmbedUrl,
    sarToPkrRate,
    hotlineDisplay,
    normalizedWhatsapp,
    whatsappUrl,
  }
}
