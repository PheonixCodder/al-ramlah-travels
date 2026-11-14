export interface AgencySettingsInput {
  agencyName?: string | null
  legalEntityName?: string | null
  tagline?: string | null
  primaryWhatsapp?: string | null
  secondaryPhone?: string | null
  supportEmail?: string | null
  officeAddress?: string | null
  workingHours?: string | null
  mapsEmbedUrl?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  youtubeUrl?: string | null
  tiktokUrl?: string | null
  dtsLicense?: string | null
  moraLicense?: string | null
  iataCode?: string | null
  ntnNumber?: string | null
  ntn?: string | null
  bankName?: string | null
  accountTitle?: string | null
  officialIban?: string | null
  iban?: string | null
  ibanVerified?: boolean | null
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
  legalEntityName?: string
  dtsLicense?: string | null
  moraLicense?: string | null
  iataCode?: string | null
  ntnNumber?: string | null
  ntn?: string | null
  bankName?: string | null
  accountTitle?: string | null
  officialIban?: string | null
  iban?: string | null
  ibanVerified?: boolean
  facebookUrl?: string | null
  instagramUrl?: string | null
  youtubeUrl?: string | null
  tiktokUrl?: string | null
}

export interface ResolvedCompanyInfo extends CompanyInfo {
  legalEntityName: string
  dtsLicense: string | null
  moraLicense: string | null
  iataCode: string | null
  ntnNumber: string | null
  ntn: string | null
  bankName: string | null
  accountTitle: string | null
  officialIban: string | null
  iban: string | null
  ibanVerified: boolean
  facebookUrl: string | null
  instagramUrl: string | null
  youtubeUrl: string | null
  tiktokUrl: string | null
}

export const DEFAULT_OFFICE_ADDRESS =
  "Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt"

export const DEFAULT_WHATSAPP_INQUIRY_MESSAGE =
  "Assalam o Alaikum, I would like to inquire about Al Ramlah Travels pilgrimage packages."

export function normalizeWhatsappNumber(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "")
  if (!digits) {
    return ""
  }

  if (digits.startsWith("00") && digits.length > 4) {
    digits = digits.slice(2)
  }

  if (digits.startsWith("920") && digits.length === 13) {
    return `92${digits.slice(3)}`
  }

  if (digits.startsWith("03") && digits.length === 11) {
    return `92${digits.slice(1)}`
  }

  if (digits.startsWith("0") && digits.length >= 10 && digits.length <= 11) {
    return `92${digits.slice(1)}`
  }

  if (digits.startsWith("3") && digits.length === 10) {
    return `92${digits}`
  }

  return digits
}

export function buildWhatsappUrl(
  phone: string,
  message?: string | null
): string {
  const normalized = normalizeWhatsappNumber(phone) || "923274029701"
  const trimmedMessage = typeof message === "string" ? message.trim() : ""
  if (!trimmedMessage) {
    return `https://wa.me/${normalized}`
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(trimmedMessage)}`
}

export const DEFAULT_COMPANY_INFO: ResolvedCompanyInfo = {
  agencyName: "Al Ramlah Travels",
  legalEntityName: "Al Ramlah Travels",
  tagline: "Where Purpose Meets Excellence",
  primaryWhatsapp: "+92 327 4029701",
  secondaryPhone: "+92 319 0462638",
  supportEmail: "alramlahtravels@gmail.com",
  officeAddress: DEFAULT_OFFICE_ADDRESS,
  workingHours: "Monday to Saturday: 9:00 AM to 8:00 PM PKT",
  mapsEmbedUrl:
    "https://maps.google.com/?q=Sector+C+Askari+10+Airport+Road+Lahore+Cantt",
  sarToPkrRate: 75,
  hotlineDisplay: "+92 327 4029701 · +92 319 0462638",
  normalizedWhatsapp: "923274029701",
  whatsappUrl: buildWhatsappUrl(
    "+92 327 4029701",
    DEFAULT_WHATSAPP_INQUIRY_MESSAGE
  ),
  dtsLicense: null,
  moraLicense: null,
  iataCode: null,
  ntnNumber: null,
  ntn: null,
  bankName: null,
  accountTitle: null,
  officialIban: null,
  iban: null,
  ibanVerified: false,
  facebookUrl: null,
  instagramUrl: null,
  youtubeUrl: null,
  tiktokUrl: null,
}

function cleanOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function getCompanyInfo(
  dbSettings?: AgencySettingsInput | null
): ResolvedCompanyInfo {
  const agencyName =
    dbSettings?.agencyName?.trim() || DEFAULT_COMPANY_INFO.agencyName
  const legalEntityName =
    dbSettings?.legalEntityName?.trim() ||
    agencyName ||
    DEFAULT_COMPANY_INFO.legalEntityName
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

  const dtsLicense = cleanOptionalText(dbSettings?.dtsLicense)
  const moraLicense = cleanOptionalText(dbSettings?.moraLicense)
  const iataCode = cleanOptionalText(dbSettings?.iataCode)
  const ntnNumber =
    cleanOptionalText(dbSettings?.ntnNumber) ?? cleanOptionalText(dbSettings?.ntn)
  const bankName = cleanOptionalText(dbSettings?.bankName)
  const accountTitle = cleanOptionalText(dbSettings?.accountTitle)
  const ibanVerified = dbSettings?.ibanVerified === true
  const rawIban =
    cleanOptionalText(dbSettings?.officialIban) ??
    cleanOptionalText(dbSettings?.iban)
  const officialIban = rawIban
  const facebookUrl = cleanOptionalText(dbSettings?.facebookUrl)
  const instagramUrl = cleanOptionalText(dbSettings?.instagramUrl)
  const youtubeUrl = cleanOptionalText(dbSettings?.youtubeUrl)
  const tiktokUrl = cleanOptionalText(dbSettings?.tiktokUrl)

  const hotlineDisplay = [primaryWhatsapp, secondaryPhone]
    .filter(Boolean)
    .join(" · ")

  const normalizedWhatsapp =
    normalizeWhatsappNumber(primaryWhatsapp) ||
    DEFAULT_COMPANY_INFO.normalizedWhatsapp
  const whatsappUrl = buildWhatsappUrl(
    primaryWhatsapp,
    DEFAULT_WHATSAPP_INQUIRY_MESSAGE
  )

  return {
    agencyName,
    legalEntityName,
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
    dtsLicense,
    moraLicense,
    iataCode,
    ntnNumber,
    ntn: ntnNumber,
    bankName,
    accountTitle,
    officialIban,
    iban: officialIban,
    ibanVerified,
    facebookUrl,
    instagramUrl,
    youtubeUrl,
    tiktokUrl,
  }
}
