import { formatPkr } from "@/components/public/public-utils"
import type { FaqJsonLdItem, VisaRateJsonLdInput } from "@/lib/seo/json-ld"
import type { PublicVisaRateDto } from "@/lib/seo/public-queries"

export const UMRAH_VISA_METADATA_SPEC = {
  path: "/umrah-visa",
  title: "Saudi Umrah Visa Price Pakistan (PKR) | Al Ramlah Travels",
  description:
    "Check live Saudi Umrah visa rates in PKR for short-term (<=30 days) & long-term stays, Nusuk Masar hotel rules, Saudi Bio steps, and instant visa quotes.",
  h1: "Saudi Umrah Visa Rates in PKR, Nusuk Masar Rules & Requirements",
} as const

export interface NormalizedVisaTierRow {
  tier: "short_term" | "long_term"
  label: string
  stayWindowLabel: string
  minDays: number
  maxDays: number
  pricePkr: number | null
  masarBundleRule: string
  notes: string
}

export function normalizePublicVisaTierRows(
  rates: ReadonlyArray<PublicVisaRateDto>
): NormalizedVisaTierRow[] {
  const shortRow = rates.find((r) => r.tier === "short_term")
  const longRow = rates.find((r) => r.tier === "long_term")

  return [
    {
      tier: "short_term",
      label: shortRow?.label || "Short-Term Saudi Umrah E-Visa",
      stayWindowLabel: "1 – 30 Inclusive KSA Days",
      minDays: 1,
      maxDays: shortRow?.maxDays ?? 30,
      pricePkr:
        shortRow && Number.isFinite(shortRow.pricePkr) && shortRow.pricePkr > 0
          ? shortRow.pricePkr
          : null,
      masarBundleRule:
        "Live Rate — Confirmed upon submission (1–10d, 11–15d, 16–21d & 22–30d Nusuk Masar stay brackets)",
      notes:
        shortRow?.notes ||
        "Includes official Saudi Umrah e-visa issuance and mandatory Kingdom emergency medical insurance for stays up to 30 calendar days.",
    },
    {
      tier: "long_term",
      label: longRow?.label || "Long-Term Extended Saudi Umrah E-Visa",
      stayWindowLabel: "31 – 90 Inclusive KSA Days",
      minDays: 31,
      maxDays: longRow?.maxDays ?? 90,
      pricePkr:
        longRow && Number.isFinite(longRow.pricePkr) && longRow.pricePkr > 0
          ? longRow.pricePkr
          : null,
      masarBundleRule:
        "Live Rate — Confirmed upon submission (31–90d extended Nusuk Masar itinerary worksheet)",
      notes:
        longRow?.notes ||
        "Designed for extended Haramain spiritual residence, Ramadan full-month stays, and family visits between 31 and 90 inclusive days.",
    },
  ]
}

export function toVisaServiceJsonLdInputs(
  rows: ReadonlyArray<NormalizedVisaTierRow>
): VisaRateJsonLdInput[] {
  return rows
    .filter((row): row is NormalizedVisaTierRow & { pricePkr: number } => {
      return typeof row.pricePkr === "number" && row.pricePkr > 0
    })
    .map((row) => ({
      tier: row.tier,
      label: row.label,
      fixedAdultPkr: row.pricePkr,
      minDays: row.minDays,
      maxDays: row.maxDays,
    }))
}

export const SAUDI_BIO_ENROLLMENT_STEPS: ReadonlyArray<{
  stepNumber: string
  title: string
  instruction: string
}> = [
  {
    stepNumber: "01",
    title: "Install Official Saudi Visa Bio App",
    instruction:
      "Download the official 'Saudi Visa Bio' app (developed by the Saudi Ministry of Foreign Affairs) on an NFC-capable iPhone or Android smartphone with a rear camera flash.",
  },
  {
    stepNumber: "02",
    title: "Scan Machine-Readable Passport Data Page",
    instruction:
      "Place your Pakistani passport flat under even indoor light so the two-line MRZ code at the bottom scans cleanly with at least 6 months remaining validity from KSA arrival.",
  },
  {
    stepNumber: "03",
    title: "Select Umrah Visa Type & Capture Live Portrait",
    instruction:
      "Stand against a plain white or off-white wall without eyeglasses, caps, or tinted lenses. Women wear hijab framing the full facial oval from forehead hairline to chin.",
  },
  {
    stepNumber: "04",
    title: "Complete 10-Finger Optical Biometric Scan",
    instruction:
      "Hold four fingers steady over a contrasting matte surface for both left and right hands, followed by both thumbs, until green focus indicators confirm enrollment.",
  },
  {
    stepNumber: "05",
    title: "Age Exemptions & Tasheer Biometric Exceptions",
    instruction:
      "Children under 12 years and seniors above 80 years are exempt from mobile fingerprint capture under current Saudi consular rules. Seniors with faded dermal ridges can visit Tasheer centers if prompted.",
  },
] as const

export const VACCINATION_AND_ENTRY_RULES: ReadonlyArray<{
  badge: string
  title: string
  requirement: string
}> = [
  {
    badge: "Mandatory Vaccine",
    title: "Quadrivalent Meningococcal Meningitis (ACWY-135)",
    requirement:
      "Pilgrims aged 1 year and older must carry a valid ACWY-135 vaccination certificate issued at least 10 days prior to KSA entry (valid 3 years for polysaccharide or 5 years for conjugate vaccine).",
  },
  {
    badge: "Pakistan Exit / KSA Entry",
    title: "Polio Vaccination Certificate (OPV / IPV)",
    requirement:
      "Travelers departing from Pakistan must carry an official Polio vaccination card (administered at least 4 weeks and within 12 months before travel) for airline check-in at LHE, KHI, and ISB.",
  },
  {
    badge: "Airport & Miqat Rule",
    title: "Jeddah (JED) vs Madinah (MED) Arrival Port",
    requirement:
      "Makkah has no civilian airport. Pilgrims starting in Makkah land at Jeddah (JED) wearing Ihram before crossing the airborne Miqat, whereas Madinah-first travelers land at MED in regular travel attire.",
  },
  {
    badge: "Passport Count Rule",
    title: "Adults, Children & Infants (< 2 Years)",
    requirement:
      "Every traveler — including infants under 2 years on a parent's lap — must hold an individual machine-readable passport and an approved Saudi Umrah e-visa.",
  },
] as const

export interface VisaEligibilityMatrixRow {
  travelerCategory: string
  recommendedPermit: string
  hotelMasarRule: string
  biometricsAndHealth: string
}

export const VISA_ELIGIBILITY_MATRIX_ROWS: readonly VisaEligibilityMatrixRow[] = [
  {
    travelerCategory:
      "Pakistani Passport Holders (Residing in Pakistan)",
    recommendedPermit:
      "Official Saudi Umrah E-Visa (Single Entry, up to 90 days validity outside Hajj season closure).",
    hotelMasarRule:
      "Available as Standalone Visa-Only (immediate fixed PKR rate) or bundled with Nusuk Masar verified Haramain hotels ('Live Rate — Confirmed upon submission').",
    biometricsAndHealth:
      "Saudi Visa Bio smartphone enrollment + Meningitis ACWY-135 & Pakistan Polio certificate.",
  },
  {
    travelerCategory:
      "Overseas Pakistanis Holding Pakistani Passport + UK/US/CA/EU Residency or Active Visa",
    recommendedPermit:
      "Saudi Visa-on-Arrival / e-Visa (if holding utilized qualifying US/UK/Schengen visa or PR) OR standard Saudi Umrah E-Visa.",
    hotelMasarRule:
      "Flexible land-only Haramain courtyard hotel booking synchronized with relatives flying from Lahore, Karachi, or Islamabad.",
    biometricsAndHealth:
      "Biometrics completed at KSA port of entry (for VoA) or via Saudi Visa Bio app (for advance Umrah e-visa).",
  },
  {
    travelerCategory:
      "UK, USA, Canada, EU & Australian Citizen Passports",
    recommendedPermit:
      "1-Year Multiple-Entry Saudi Tourist e-Visa (permits multiple Umrah performances outside Dhul Qa'dah / Hajj blackout dates) + Nusuk Umrah permit slot.",
    hotelMasarRule:
      "Book Makkah Clock Tower & Madinah Markaziyah suites directly via our Custom Journey Builder ('Live Rate — Confirmed upon submission').",
    biometricsAndHealth:
      "Passport validity >= 6 months + Meningitis ACWY-135 health compliance.",
  },
  {
    travelerCategory:
      "GCC Residents (UAE, Qatar, Kuwait, Oman, Bahrain Iqama Holders)",
    recommendedPermit:
      "Saudi GCC Resident e-Visa (subject to valid GCC residency >= 3 months and passport validity >= 6 months).",
    hotelMasarRule:
      "Combine directly with land-only Haramain hotels and private GMC Yukon / Hyundai Staria airport transfers.",
    biometricsAndHealth:
      "Digital application photo, GCC residency card copy, and Nusuk permit registration.",
  },
] as const

export function buildUmrahVisaFaqs(
  rows: ReadonlyArray<NormalizedVisaTierRow>
): FaqJsonLdItem[] {
  const shortTier = rows.find((r) => r.tier === "short_term")
  const longTier = rows.find((r) => r.tier === "long_term")

  const shortRatePhrase = shortTier?.pricePkr
    ? `${formatPkr(shortTier.pricePkr)} per passport`
    : "our live published short-term PKR tariff"
  const longRatePhrase = longTier?.pricePkr
    ? `${formatPkr(longTier.pricePkr)} per passport`
    : "our live published long-term PKR tariff"

  return [
    {
      question:
        "What is the current Saudi Umrah visa price in Pakistan in PKR?",
      answer: `For standalone Visa-Only applications without hotel bundles, our current published rate is ${shortRatePhrase} for short-term stays (1 to 30 inclusive days in Saudi Arabia) and ${longRatePhrase} for long-term stays (31 to 90 inclusive days). Both tiers include mandatory Saudi emergency medical insurance and apply per passport across adults, children, and infants.`,
    },
    {
      question:
        "How does Al Ramlah Travels decide between a short-term and long-term Umrah visa?",
      answer:
        "You never have to guess or pick a manual visa dropdown. Our server automatically calculates your exact inclusive calendar days in Saudi Arabia from your mandatory KSA Arrival Date and KSA Departure Date: 30 inclusive days or fewer qualifies for the short-term tier, while 31 to 90 inclusive days triggers the long-term tier.",
    },
    {
      question:
        "What is the difference between Standalone Visa-Only and a Nusuk Masar hotel-bundled Umrah visa?",
      answer:
        "Standalone Visa-Only displays an immediate fixed PKR total and is ideal for pilgrims staying with KSA relatives or holding independent arrangements. When you combine your visa with Makkah and Madinah hotels in our Custom Journey Builder, Nusuk Masar hotel-linked visa rules apply and your complete itinerary is verified as 'Live Rate — Confirmed upon submission' by our Lahore quoting desk.",
    },
    {
      question:
        "Do infants under 2 years require a separate Saudi Umrah visa and fee?",
      answer:
        "Yes. Under Saudi Ministry of Foreign Affairs regulations, every infant under 2 years must travel on an individual machine-readable passport with a dedicated Umrah e-visa and infant airline ticket. However, in our hotel and transport calculators, infants occupy zero hotel beds and zero vehicle seats so families never overpay for room capacity.",
    },
    {
      question:
        "Is the Saudi Visa Bio fingerprint app mandatory for Pakistani Umrah applicants?",
      answer:
        "Yes. Pakistani Umrah visa applicants aged 12 to 80 must complete facial and fingerprint enrollment on the official Saudi Visa Bio mobile app before visa issuance. Children under 12 and senior citizens over 80 are currently exempt from fingerprint capture. Walk into our Askari 10, Lahore Cantt office if elderly family members need hands-on assistance with app scanning.",
    },
    {
      question:
        "How long does Saudi Umrah e-visa issuance take from Pakistan and when is the Hajj season cutoff?",
      answer:
        "Once passport scans, photographs, and Saudi Visa Bio confirmation are verified, Umrah e-visas typically issue within 24 to 72 working hours. Please note that Saudi authorities enforce an annual pre-Hajj Umrah entry and exit cutoff around mid-Shawwal / Dhul Qa'dah so Makkah can prepare for Hajj pilgrims.",
    },
  ]
}
