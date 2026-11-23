"use client"

import * as React from "react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { submitHajjInquiryApplication } from "@/app/actions/applications"
import { HARAMAIN_EASE, MotionPillIndicator } from "@/components/motion"
import { ArabicText } from "@/components/public/arabic-text"
import { formatPkr, toWaMeUrl } from "@/components/public/public-utils"
import {
  HAJJ_2027_REGULATORY_DISCLAIMER,
  HAJJ_READINESS_DOCUMENTS,
} from "@/components/seo/guides-hajj-data"
import { DEFAULT_COMPANY_INFO, toTelHref } from "@/lib/company-info"
import { readStoredAttribution } from "@/lib/seo/utm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Loader2,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Tent,
  UserCheck,
} from "lucide-react"

export interface PublicHajjPackageItem {
  id: string
  slug: string
  title: string
  seasonYear: number
  maktabTier: string
  durationDays: number
  makkahHotelName: string
  makkahDistanceLabel: string
  madinahHotelName: string
  madinahDistanceLabel: string
  aziziyahStayNotes?: string | null
  indicativeSharingPkr: number
  indicativeQuadPkr?: number | null
  indicativeTriplePkr?: number | null
  indicativeDoublePkr?: number | null
  isIndicative: boolean
  regulatoryDisclaimer: string
  highlights?: string[]
  isFeatured?: boolean
}

export interface HajjInquirySectionProps {
  hajjPackages?: PublicHajjPackageItem[]
  packages?: PublicHajjPackageItem[]
  departureCities?: { cityName: string; airportCode: string }[]
  agencyWhatsapp?: string
  secondaryPhone?: string
}

export interface HajjHotelStay {
  city: "Madinah" | "Makkah" | "Azizia"
  name: string
  meal: string
}

export type HajjMaktabCode = "A+" | "A" | "B" | "C"

export interface HajjPackageDefinition {
  id: string
  slug: string
  maktab: HajjMaktabCode
  code: string
  title: string
  tierName: "Royal VIP" | "Executive" | "Premium" | "Silver"
  duration: string
  daysCount: number
  camps: string
  hotels: HajjHotelStay[]
  pricing: {
    quad: number
    triple: number
    double: number
  }
  popular?: boolean
  regulatoryDisclaimer?: string
}

export const HAJJ_2027_PACKAGES: HajjPackageDefinition[] = [
  {
    id: "hajj-a-01",
    slug: "hajj-2027-maktab-a-executive-10d",
    maktab: "A",
    code: "01",
    title: "Executive · Short Days (10 Days)",
    tierName: "Executive",
    duration: "10 Days",
    daysCount: 10,
    camps: "Mina & Arafat camps · Maktab A category",
    hotels: [
      {
        city: "Madinah",
        name: "Peninsula Worth Hotel Madinah / Similar (Markazia Courtyard)",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Azizia",
        name: "Executive Building, Azizia (Near Jamarat Access)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 2495000,
      triple: 2646000,
      double: 2760000,
    },
  },
  {
    id: "hajj-a-02",
    slug: "hajj-2027-maktab-a-executive-14d",
    maktab: "A",
    code: "02",
    title: "Executive · Short Days (14 Days)",
    tierName: "Executive",
    duration: "14 Days",
    daysCount: 14,
    camps: "Mina & Arafat camps · Maktab A category",
    hotels: [
      {
        city: "Madinah",
        name: "Peninsula Worth Hotel Madinah / Similar (Markazia Courtyard)",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Azizia",
        name: "Executive Building, Azizia (Near Jamarat Access)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 2600000,
      triple: 2775000,
      double: 2850000,
    },
  },
  {
    id: "hajj-a-03",
    slug: "hajj-2027-maktab-a-executive-19d",
    maktab: "A",
    code: "03",
    title: "Executive · Semi-Short Days (18/19 Days)",
    tierName: "Executive",
    duration: "18/19 Days",
    daysCount: 19,
    camps: "Mina & Arafat camps · Maktab A category",
    popular: true,
    hotels: [
      {
        city: "Madinah",
        name: "Elaf Taiba / Similar (Front Row Haram Courtyard)",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Makkah",
        name: "Swissotel Al Maqam / Similar (0m Clock Tower Courtyard)",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Azizia",
        name: "Executive Building, Azizia (Near Jamarat Access)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 2725000,
      triple: 2895000,
      double: 2990000,
    },
  },
  {
    id: "hajj-b-01",
    slug: "hajj-2027-maktab-b-premium-15d",
    maktab: "B",
    code: "01",
    title: "Premium · 14/15 Days",
    tierName: "Premium",
    duration: "14/15 Days",
    daysCount: 15,
    camps: "Mina & Arafat camps · Maktab B category",
    hotels: [
      {
        city: "Madinah",
        name: "Elaf Taiba (Markazia Courtyard)",
        meal: "Half Board: Breakfast + Dinner · Gender-based sharing",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 2175000,
      triple: 2325000,
      double: 2475000,
    },
  },
  {
    id: "hajj-b-02",
    slug: "hajj-2027-maktab-b-executive-15d",
    maktab: "B",
    code: "02",
    title: "Executive · 14/15 Days",
    tierName: "Executive",
    duration: "14/15 Days",
    daysCount: 15,
    camps: "Mina & Arafat camps · Maktab B category",
    hotels: [
      {
        city: "Madinah",
        name: "Verta Al Madina / Similar (Central Markazia)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 1995000,
      triple: 2145000,
      double: 2295000,
    },
  },
  {
    id: "hajj-b-03",
    slug: "hajj-2027-maktab-b-premium-22d",
    maktab: "B",
    code: "03",
    title: "Premium · 20/22 Days",
    tierName: "Premium",
    duration: "20/22 Days",
    daysCount: 22,
    camps: "Mina & Arafat camps · Maktab B category",
    popular: true,
    hotels: [
      {
        city: "Madinah",
        name: "Elaf Taiba (Front Row Courtyard)",
        meal: "Half Board: Breakfast + Dinner · Gender-based sharing",
      },
      {
        city: "Makkah",
        name: "Makkah Clock Royal Tower (0m Haram Courtyard)",
        meal: "Half Board: Breakfast + Dinner · Gender-based sharing",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 2385000,
      triple: 2535000,
      double: 2685000,
    },
  },
  {
    id: "hajj-b-04",
    slug: "hajj-2027-maktab-b-executive-22d",
    maktab: "B",
    code: "04",
    title: "Executive · 20/22 Days",
    tierName: "Executive",
    duration: "20/22 Days",
    daysCount: 22,
    camps: "Mina & Arafat camps · Maktab B category",
    hotels: [
      {
        city: "Madinah",
        name: "Verta Al Madina / Similar (Central Markazia)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
      {
        city: "Makkah",
        name: "Hilton Convention / Marriott Jabal Omar (300m Courtyard)",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 2095000,
      triple: 2245000,
      double: 2395000,
    },
  },
  {
    id: "hajj-c-01",
    slug: "hajj-2027-maktab-c-silver-15d",
    maktab: "C",
    code: "01",
    title: "Silver · 14/15 Days",
    tierName: "Silver",
    duration: "14/15 Days",
    daysCount: 15,
    camps: "Mina & Arafat camps · Maktab C category",
    hotels: [
      {
        city: "Madinah",
        name: "Dewan Al Madina / Similar (Markazia Walkable)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 1700000,
      triple: 1850000,
      double: 2000000,
    },
  },
  {
    id: "hajj-c-02",
    slug: "hajj-2027-maktab-c-silver-22d",
    maktab: "C",
    code: "02",
    title: "Silver · 20/22 Days",
    tierName: "Silver",
    duration: "20/22 Days",
    daysCount: 22,
    camps: "Mina & Arafat camps · Maktab C category",
    hotels: [
      {
        city: "Madinah",
        name: "Dewan Al Madina / Similar (Markazia Walkable)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
      {
        city: "Makkah",
        name: "Arfat Golden Rushd / Similar (650m Walkable)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 1750000,
      triple: 1900000,
      double: 2050000,
    },
  },
  {
    id: "hajj-c-03",
    slug: "hajj-2027-maktab-c-executive-22d",
    maktab: "C",
    code: "03",
    title: "Executive · 20/22 Days",
    tierName: "Executive",
    duration: "20/22 Days",
    daysCount: 22,
    camps: "Mina & Arafat camps · Maktab C category",
    hotels: [
      {
        city: "Madinah",
        name: "Verta Al Madina / Similar (Central Markazia)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
      {
        city: "Makkah",
        name: "Hilton Convention / Marriott Jabal Omar (300m Courtyard)",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 1950000,
      triple: 2095000,
      double: 2250000,
    },
  },
]

const DIASPORA_COUNTRIES = [
  "Pakistan",
  "United Kingdom",
  "United States",
  "Canada",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "European Union",
  "Australia",
  "Other",
] as const

const SUGGESTED_CITIES_BY_COUNTRY: Record<string, string[]> = {
  Pakistan: [
    "Lahore",
    "Islamabad",
    "Karachi",
    "Faisalabad",
    "Multan",
    "Peshawar",
    "Sialkot",
  ],
  "United Kingdom": [
    "London",
    "Birmingham",
    "Manchester",
    "Bradford",
    "Glasgow",
  ],
  "United States": ["Houston", "New York", "Chicago", "Dallas", "Washington DC"],
  Canada: ["Toronto", "Mississauga", "Calgary", "Vancouver", "Montreal"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam"],
}

const CORE_INCLUSIONS = [
  "Private air-conditioned coach transfers across Manasik days",
  "Return airfare from Pakistani or international gateways",
  "Verified stays in Madinah, Makkah, and Azizia",
  "Mina and Arafat camps in your chosen Maktab category",
  "Buffet catering as structured for the selected tier",
  "Resident scholar guidance and group leadership",
  "24/7 Jeddah and Madinah airport meet and ground assistance",
] as const

type GuideTabKey = "inclusions" | "documents" | "process"

const READINESS_TABS: ReadonlyArray<{
  key: GuideTabKey
  label: string
}> = [
  { key: "inclusions", label: "Inclusions" },
  { key: "documents", label: "6 Documents" },
  { key: "process", label: "3-Step Process" },
]

export function coerceMaktabCode(raw: string): HajjMaktabCode {
  const cleaned = (raw || "")
    .trim()
    .toUpperCase()
    .replace(/\bMAKTAB\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (/(?:^|[\s(])A\+/.test(cleaned)) return "A+"
  if (/\bB\b/.test(cleaned)) return "B"
  if (/\bC\b/.test(cleaned)) return "C"
  return "A"
}

function mapDbHajjPackagesToDefinitions(
  rows: PublicHajjPackageItem[]
): HajjPackageDefinition[] {
  return rows.map((row, idx) => {
    const maktab = coerceMaktabCode(row.maktabTier)
    const quad = row.indicativeQuadPkr ?? row.indicativeSharingPkr
    const triple = row.indicativeTriplePkr ?? Math.round(quad * 1.07)
    const double = row.indicativeDoublePkr ?? Math.round(quad * 1.14)

    const hotels: HajjHotelStay[] = [
      {
        city: "Madinah",
        name: `${row.madinahHotelName} (${row.madinahDistanceLabel})`,
        meal: "Half / Full Board Buffet as per package itinerary",
      },
      {
        city: "Makkah",
        name: `${row.makkahHotelName} (${row.makkahDistanceLabel})`,
        meal: "Half / Full Board Buffet as per package itinerary",
      },
    ]

    if (row.aziziyahStayNotes) {
      hotels.push({
        city: "Azizia",
        name: row.aziziyahStayNotes,
        meal: "Full Board Buffet during Manasik days",
      })
    }

    return {
      id: row.id,
      slug: row.slug,
      maktab,
      code: String(idx + 1).padStart(2, "0"),
      title: row.title,
      tierName:
        maktab === "A+"
          ? "Royal VIP"
          : maktab === "A"
            ? "Executive"
            : maktab === "B"
              ? "Premium"
              : "Silver",
      duration: `${row.durationDays} Days`,
      daysCount: row.durationDays,
      camps: `Mina & Arafat camps · Maktab ${maktab} category`,
      hotels,
      pricing: { quad, triple, double },
      popular: row.isFeatured,
      regulatoryDisclaimer: row.regulatoryDisclaimer,
    }
  })
}

function createHajjSubmissionKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `hajj_${crypto.randomUUID().replace(/-/g, "")}`
  }
  return `hajj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function HajjInquirySection({
  hajjPackages,
  packages,
  departureCities,
  agencyWhatsapp = DEFAULT_COMPANY_INFO.primaryWhatsapp,
  secondaryPhone = DEFAULT_COMPANY_INFO.secondaryPhone,
}: HajjInquirySectionProps = {}) {
  const explicitDbPackages =
    packages !== undefined ? packages : hajjPackages

  // SEO-025 & S15-005: Treat explicit `[]` as closed (no synthetic resurrection); fallback only when `undefined`
  const catalogPackages = useMemo(() => {
    if (explicitDbPackages === undefined) {
      return HAJJ_2027_PACKAGES
    }
    if (explicitDbPackages.length > 0) {
      return mapDbHajjPackagesToDefinitions(explicitDbPackages)
    }
    return []
  }, [explicitDbPackages])

  const [selectedMaktab, setSelectedMaktab] = useState<"all" | HajjMaktabCode>(
    "all"
  )
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    () =>
      catalogPackages.find((p) => p.popular)?.id ??
      catalogPackages[0]?.id ??
      ""
  )
  const [selectedRoomType, setSelectedRoomType] = useState<
    "quad" | "triple" | "double"
  >("quad")
  const [activeGuideTab, setActiveGuideTab] =
    useState<GuideTabKey>("inclusions")
  const [includeQurbani, setIncludeQurbani] = useState(true)
  const [includeTrainTicket, setIncludeTrainTicket] = useState(false)
  const [bloodGroup, setBloodGroup] = useState("")

  // Form State (T-084: International diaspora country + free-text city)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerWhatsapp, setCustomerWhatsapp] = useState("")
  const [customerCountry, setCustomerCountry] = useState<string>("Pakistan")
  const [customerCity, setCustomerCity] = useState(
    departureCities?.[0]?.cityName ?? "Lahore"
  )
  const [customerEmail, setCustomerEmail] = useState("")
  const [adults, setAdults] = useState<number>(2)
  const [children, setChildren] = useState<number>(0)
  const [infants, setInfants] = useState<number>(0)
  const [notes, setNotes] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [submissionKey, setSubmissionKey] = useState(() =>
    createHajjSubmissionKey()
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirmedResult, setConfirmedResult] = useState<{
    referenceNumber: string
    whatsappUrl?: string
    selectedPkgTitle?: string
  } | null>(null)

  const activePackage: HajjPackageDefinition | null =
    catalogPackages.find((p) => p.id === selectedPackageId) ??
    catalogPackages[0] ??
    null

  const filteredPackages =
    selectedMaktab === "all"
      ? catalogPackages
      : catalogPackages.filter((p) => p.maktab === selectedMaktab)

  const countAPlus = catalogPackages.filter((p) => p.maktab === "A+").length
  const countA = catalogPackages.filter((p) => p.maktab === "A").length
  const countB = catalogPackages.filter((p) => p.maktab === "B").length
  const countC = catalogPackages.filter((p) => p.maktab === "C").length

  const maktabTabs = useMemo(() => {
    const list: Array<{ key: "all" | HajjMaktabCode; label: string }> = [
      { key: "all", label: `All Packages (${catalogPackages.length})` },
    ]
    if (countAPlus > 0) {
      list.push({ key: "A+", label: `Maktab A+ (${countAPlus})` })
    }
    if (countA > 0) {
      list.push({ key: "A", label: `Maktab A (${countA})` })
    }
    if (countB > 0) {
      list.push({ key: "B", label: `Maktab B (${countB})` })
    }
    if (countC > 0) {
      list.push({ key: "C", label: `Maktab C (${countC})` })
    }
    return list
  }, [catalogPackages.length, countAPlus, countA, countB, countC])

  const citySuggestions = useMemo(() => {
    const base = SUGGESTED_CITIES_BY_COUNTRY[customerCountry] ?? []
    if (customerCountry === "Pakistan" && departureCities?.length) {
      const merged = new Set<string>([
        ...departureCities.map((c) => c.cityName),
        ...base,
      ])
      return Array.from(merged)
    }
    return base
  }, [customerCountry, departureCities])

  function handleSelectPackage(
    pkg: HajjPackageDefinition,
    room: "quad" | "triple" | "double" = "quad"
  ) {
    setSelectedPackageId(pkg.id)
    setSelectedRoomType(room)
    setSubmissionKey(createHajjSubmissionKey())
    if (selectedMaktab !== "all" && selectedMaktab !== pkg.maktab) {
      setSelectedMaktab(pkg.maktab)
    }

    const target = document.getElementById("hajj-reservation-card")
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  function syncPhone(val: string) {
    setCustomerPhone(val)
    if (!customerWhatsapp || customerWhatsapp === customerPhone) {
      setCustomerWhatsapp(val)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    setFieldErrors({})

    try {
      const roomLabel =
        selectedRoomType === "quad"
          ? "Quad Bed"
          : selectedRoomType === "triple"
            ? "Triple Bed"
            : "Double Bed"

      const chosenPrice = activePackage
        ? activePackage.pricing[selectedRoomType]
        : undefined
      const consultationType = activePackage
        ? `Maktab ${activePackage.maktab} (${activePackage.title}, ${roomLabel})`
        : `Hajj 2027 General Priority Consultation (${roomLabel})`

      // T-055, T-084 & SEO-004: Persist structured Hajj metadata + first-touch web attribution
      const res = await submitHajjInquiryApplication({
        clientSubmissionId: submissionKey,
        honeypot,
        attribution: readStoredAttribution(),
        hajjConsultationType: consultationType,
        hajjPackageSlug: activePackage?.slug,
        maktabTier: activePackage?.maktab,
        roomType: selectedRoomType,
        indicativePricePkr: chosenPrice,
        durationLabel: activePackage?.duration,
        includeQurbani,
        includeTrainTicket,
        bloodGroup: bloodGroup.trim() || undefined,
        passengers: { adults, children, infants },
        contact: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerWhatsapp: (customerWhatsapp || customerPhone).trim(),
          customerCountry,
          customerCity: customerCity.trim(),
          customerEmail: customerEmail.trim() || undefined,
        },
        notes: notes.trim() || undefined,
      })

      if (res.success && res.referenceNumber) {
        setConfirmedResult({
          referenceNumber: res.referenceNumber,
          whatsappUrl: res.whatsappUrl,
          selectedPkgTitle: activePackage
            ? `${activePackage.title} (${roomLabel})`
            : `Hajj 2027 Priority Consultation (${roomLabel})`,
        })
      } else {
        setError(res.error || "Failed to submit Hajj pre-registration inquiry.")
        setFieldErrors(res.fieldErrors ?? {})
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to submit inquiry."
      )
    } finally {
      setLoading(false)
    }
  }

  function handleTrackStatus() {
    const refCode = confirmedResult?.referenceNumber ?? ""
    const element = document.getElementById("track-status")
    if (element) {
      if (refCode && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("alramlah:prefill-tracker", {
            detail: { referenceNumber: refCode },
          })
        )
      }
      element.scrollIntoView({ behavior: "smooth" })
      return
    }
    const targetUrl = refCode
      ? `/?trackRef=${encodeURIComponent(refCode)}#track-status`
      : "/#track-status"
    if (typeof window !== "undefined") {
      window.location.assign(targetUrl)
    }
  }

  return (
    <section
      id="hajj-inquiry"
      className="relative overflow-hidden bg-sidebar py-14 sm:py-16 text-white scroll-mt-16"
    >
      <div
        aria-hidden="true"
        className="bg-haramain-dark-pattern pointer-events-none absolute inset-0 opacity-60"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col gap-7">
        {/* ======================================================== */}
        {/* HEADER, ARABIC INVOCATION & REGULATORY NOTICE (`OD-09e`) */}
        {/* ======================================================== */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl flex flex-col gap-2">
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Indicative Hajj 2027 Package Guide
              </h2>
              <p className="text-sm text-sidebar-foreground/85 leading-relaxed">
                <strong className="text-gold font-semibold">
                  Where Purpose Meets Excellence
                </strong>
                : Open to Pakistani residents and overseas diaspora families worldwide. Indicative per-person PKR estimates with hotels listed in order across Madinah, Makkah, and Azizia.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-gold/40 bg-sidebar-accent px-4 py-1.5">
                <ArabicText className="text-base sm:text-lg text-gold font-bold">
                  حَجٌّ مَبْرُورٌ وَسَعْيٌ مَشْكُورٌ
                </ArabicText>
              </div>
              <Link
                href="/hajj-2027"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gold/50 bg-primary px-4 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold hover:text-gold-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90"
              >
                <span>View Full Hajj 2027 Maktab Guide</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Mandatory Regulatory Disclaimer (`OD-09e`) */}
          <div className="rounded-xl border border-gold/35 bg-sidebar-accent px-4 py-2.5 text-xs text-sidebar-foreground/90 flex items-start gap-2.5">
            <Info
              className="size-4 text-gold shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="leading-relaxed">
              {HAJJ_2027_REGULATORY_DISCLAIMER}
            </p>
          </div>

          {/* Maktab Filter Pills with MotionPillIndicator */}
          {catalogPackages.length > 0 && (
            <div
              role="group"
              aria-label="Filter Hajj 2027 packages by Maktab tier"
              className="flex flex-wrap items-center gap-2"
            >
              {maktabTabs.map((tab) => {
                const isActive = selectedMaktab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedMaktab(tab.key)}
                    aria-pressed={isActive}
                    className="relative inline-flex min-h-8 items-center justify-center rounded-full border border-white/15 bg-sidebar-accent px-3.5 py-1.5 text-xs font-semibold transition-colors hover:border-gold/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90"
                  >
                    {isActive && (
                      <MotionPillIndicator
                        layoutId="home-hajj-maktab-pill"
                        className="absolute inset-0 rounded-full bg-gold"
                      />
                    )}
                    <span
                      className={`relative z-10 ${
                        isActive
                          ? "text-gold-foreground font-bold"
                          : "text-white/90"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* BALANCED 4-COLUMN MAKTAB SHOWCASE (`AC-7`)               */}
        {/* ======================================================== */}
        {catalogPackages.length === 0 ? (
          <div className="mx-auto max-w-3xl w-full rounded-2xl border border-gold/40 bg-sidebar-accent p-6 text-center">
            <h3 className="font-display text-xl font-bold text-white">
              Hajj 2027 Tier Allotments Currently Updating
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-sidebar-foreground/85 leading-relaxed">
              Individual Hajj 2027 Maktab tier cards are currently paused pending official Government of Pakistan Ministry of Religious Affairs (MoRA) and Saudi Nusuk tariff notifications. You may register priority consultation interest below to receive immediate notification when official quotas open.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filteredPackages.map((pkg) => {
              const isSelected = selectedPackageId === pkg.id

              return (
                <div
                  key={pkg.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 transition-colors ${
                    isSelected
                      ? "border-gold bg-primary ring-1 ring-gold"
                      : "border-white/15 bg-sidebar-accent hover:border-gold/50"
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Tier + Duration Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
                          Maktab {pkg.maktab}
                        </span>
                        {pkg.popular && (
                          <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
                            Featured
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gold">
                        <Clock className="size-3 shrink-0" aria-hidden="true" />
                        <span>
                          <span className="font-mono tabular-nums">
                            {pkg.daysCount}
                          </span>{" "}
                          Days
                        </span>
                      </span>
                    </div>

                    {/* Title & Camp Category */}
                    <div>
                      <h3 className="font-display text-base font-bold text-white leading-snug line-clamp-2">
                        {pkg.title}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-gold/90">
                        <Tent
                          className="size-3.5 shrink-0 text-gold"
                          aria-hidden="true"
                        />
                        <span>Mina &amp; Arafat Maktab {pkg.maktab}</span>
                      </p>
                    </div>

                    {/* Compact Hotel Summary Lines */}
                    <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5 text-xs">
                      {pkg.hotels.map((hotel, hIdx) => (
                        <div
                          key={hIdx}
                          className="flex items-baseline gap-1.5 min-w-0"
                        >
                          <span className="font-semibold text-gold shrink-0">
                            {hotel.city}:
                          </span>
                          <span
                            className="text-white/85 truncate"
                            title={hotel.name}
                          >
                            {hotel.name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 3-Column Indicative PKR Strip */}
                    <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5">
                      <span className="text-[11px] font-medium text-white/75">
                        Indicative per person (PKR)
                      </span>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {(["quad", "triple", "double"] as const).map(
                          (tierKey) => {
                            const rateVal = pkg.pricing[tierKey]
                            const shortLabel =
                              tierKey === "quad"
                                ? "Quad"
                                : tierKey === "triple"
                                  ? "Triple"
                                  : "Double"
                            const activeCell =
                              isSelected && selectedRoomType === tierKey
                            return (
                              <button
                                key={tierKey}
                                type="button"
                                onClick={() => handleSelectPackage(pkg, tierKey)}
                                title={formatPkr(rateVal)}
                                className={`cursor-pointer rounded-xl border px-1.5 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90 ${
                                  activeCell
                                    ? "border-gold bg-gold/15 text-gold"
                                    : "border-white/15 bg-sidebar/80 hover:border-gold/40 text-white"
                                }`}
                              >
                                <span className="block text-[11px] font-medium text-white/80">
                                  {shortLabel}
                                </span>
                                <span className="block font-mono tabular-nums text-xs font-bold text-white mt-0.5">
                                  {`${(rateVal / 1000000).toFixed(2)}M`}
                                </span>
                              </button>
                            )
                          }
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Select Tier Button */}
                  <div className="pt-3 mt-3 border-t border-white/10">
                    <Button
                      type="button"
                      onClick={() =>
                        handleSelectPackage(pkg, selectedRoomType)
                      }
                      className={`w-full min-h-9 justify-center gap-1.5 text-xs font-bold transition-colors focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0 active:opacity-90 ${
                        isSelected
                          ? "bg-gold text-gold-foreground hover:bg-gold/90"
                          : "border border-gold/50 bg-sidebar text-gold hover:bg-gold hover:text-gold-foreground"
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="size-3.5" aria-hidden="true" />
                          <span>Selected</span>
                        </>
                      ) : (
                        <>
                          <span>Select Tier</span>
                          <ArrowRight
                            className="size-3.5"
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ======================================================== */}
        {/* 2-COLUMN SPLIT: MOTION READINESS GUIDE + COMPACT FORM    */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left Column (5 cols): Motion-Tabbed Readiness Guide */}
          <div className="lg:col-span-5 rounded-2xl border border-white/15 bg-sidebar-accent p-5 sm:p-6 flex flex-col gap-5">
            <div
              role="tablist"
              aria-label="Hajj 2027 readiness information tabs"
              className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-sidebar p-1"
            >
              {READINESS_TABS.map((tab) => {
                const isActive = activeGuideTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    id={`hajj-guide-tab-${tab.key}`}
                    aria-selected={isActive}
                    aria-controls={`hajj-guide-panel-${tab.key}`}
                    onClick={() => setActiveGuideTab(tab.key)}
                    className="relative min-h-9 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90"
                  >
                    {isActive && (
                      <MotionPillIndicator
                        layoutId="home-hajj-readiness-tab"
                        className="absolute inset-0 rounded-lg bg-gold"
                      />
                    )}
                    <span
                      className={`relative z-10 block truncate ${
                        isActive
                          ? "text-gold-foreground font-bold"
                          : "text-white/85 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {activeGuideTab === "inclusions" && (
                <motion.div
                  key="inclusions"
                  role="tabpanel"
                  id="hajj-guide-panel-inclusions"
                  aria-labelledby="hajj-guide-tab-inclusions"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: HARAMAIN_EASE }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="size-4 text-gold shrink-0"
                      aria-hidden="true"
                    />
                    <h3 className="font-display text-lg font-bold text-white">
                      Target Inclusions &amp; Optional Add-Ons
                    </h3>
                  </div>

                  <ul className="flex flex-col gap-2 text-xs text-white/90">
                    {CORE_INCLUSIONS.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check
                          className="size-3.5 text-gold shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t border-white/10 pt-3.5 flex flex-col gap-2">
                    <span className="text-xs font-semibold text-gold">
                      Optional Add-Ons (Estimated)
                    </span>
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 text-xs">
                      <span className="text-white/85">
                        Qurbani / Adahi Sacrifice
                      </span>
                      <span className="font-mono tabular-nums font-bold text-gold">
                        {`~${formatPkr(55000)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/85">
                        Haramain High-Speed Train Ticket
                      </span>
                      <span className="font-mono tabular-nums font-bold text-gold">
                        {`~${formatPkr(61000)}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/65">
                      * Subject to official Saudi Ministry of Hajj &amp; SAR railway 2027 tariff confirmations.
                    </p>
                  </div>
                </motion.div>
              )}

              {activeGuideTab === "documents" && (
                <motion.div
                  key="documents"
                  role="tabpanel"
                  id="hajj-guide-panel-documents"
                  aria-labelledby="hajj-guide-tab-documents"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: HARAMAIN_EASE }}
                  className="flex flex-col gap-3.5"
                >
                  <div className="flex items-center gap-2">
                    <FileText
                      className="size-4 text-gold shrink-0"
                      aria-hidden="true"
                    />
                    <h3 className="font-display text-lg font-bold text-white">
                      6 Documents for Hajj 2027 Readiness
                    </h3>
                  </div>

                  <ol className="flex flex-col gap-2.5 text-xs">
                    {HAJJ_READINESS_DOCUMENTS.map((doc, idx) => (
                      <li
                        key={doc.title}
                        className="flex items-start gap-2.5 border-b border-white/10 pb-2.5 last:border-b-0 last:pb-0"
                      >
                        <span className="font-mono tabular-nums text-xs font-bold text-gold shrink-0">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <span className="block font-semibold text-white">
                            {doc.title}
                          </span>
                          <p className="text-[11px] text-white/75 mt-0.5 leading-relaxed">
                            {doc.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              )}

              {activeGuideTab === "process" && (
                <motion.div
                  key="process"
                  role="tabpanel"
                  id="hajj-guide-panel-process"
                  aria-labelledby="hajj-guide-tab-process"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: HARAMAIN_EASE }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck
                      className="size-4 text-gold shrink-0"
                      aria-hidden="true"
                    />
                    <h3 className="font-display text-lg font-bold text-white">
                      3-Step Priority Quota Process
                    </h3>
                  </div>

                  <ol className="flex flex-col gap-3.5 text-xs">
                    <li className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold font-mono tabular-nums text-xs font-bold text-gold-foreground">
                        1
                      </span>
                      <div>
                        <span className="block font-semibold text-white">
                          Select Preferred Maktab Tier
                        </span>
                        <p className="text-white/75 mt-0.5 leading-relaxed">
                          Choose your target Maktab (A+, A, B, or C), duration, and room occupancy.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold font-mono tabular-nums text-xs font-bold text-gold-foreground">
                        2
                      </span>
                      <div>
                        <span className="block font-semibold text-white">
                          Priority Readiness Review
                        </span>
                        <p className="text-white/75 mt-0.5 leading-relaxed">
                          Our Askari 10 Lahore desk verifies passport validity and Pakistan or Diaspora routing.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold font-mono tabular-nums text-xs font-bold text-gold-foreground">
                        3
                      </span>
                      <div>
                        <span className="block font-semibold text-white">
                          Official Quota Confirmation
                        </span>
                        <p className="text-white/75 mt-0.5 leading-relaxed">
                          Upon official MoRA and Saudi Nusuk quota release, pre-registered families receive priority allotment notice.
                        </p>
                      </div>
                    </li>
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Always-mounted Askari 10 Desk Hotlines + /hajj-2027 Hub Link */}
            <div className="border-t border-white/10 pt-4 flex flex-col gap-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-white/90">
                  Askari 10 Lahore Hajj Desk
                </span>
                <span className="text-[11px] text-white/70">
                  Mon to Sat, 9:00 AM to 8:00 PM PKT
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-gold font-semibold">
                <a
                  href={toTelHref(agencyWhatsapp)}
                  className="inline-flex min-h-6 items-center gap-1.5 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{agencyWhatsapp}</span>
                </a>
                {secondaryPhone && (
                  <a
                    href={toTelHref(secondaryPhone)}
                    className="inline-flex min-h-6 items-center gap-1.5 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{secondaryPhone}</span>
                  </a>
                )}
              </div>
              <Link
                href="/hajj-2027"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-sm text-xs font-semibold text-gold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold pt-1"
              >
                <span>Explore Full Hajj 2027 Maktab Guide</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Right Column (7 cols): Compact Pre-Registration Concierge Card */}
          <div
            id="hajj-reservation-card"
            className="lg:col-span-7 rounded-2xl border border-gold/40 bg-primary p-5 sm:p-6 shadow-lg flex flex-col gap-5 scroll-mt-20"
          >
            <AnimatePresence mode="wait" initial={false}>
              {confirmedResult ? (
                <motion.div
                  key="hajj-confirmed"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: HARAMAIN_EASE }}
                  className="flex flex-col gap-5 py-4 text-center"
                >
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold/20 text-gold border border-gold/50">
                    <CheckCircle2 className="size-8" aria-hidden="true" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-display text-2xl font-bold text-white">
                      Hajj 2027 Pre-Registration Dispatched
                    </h3>
                    <p className="text-xs sm:text-sm text-white/85 max-w-md mx-auto">
                      Your priority pre-registration for{" "}
                      <strong className="text-gold">
                        {confirmedResult.selectedPkgTitle}
                      </strong>{" "}
                      has been assigned to our Senior Hajj Director in Lahore.
                    </p>
                  </div>

                  <div className="mx-auto max-w-sm w-full rounded-xl border border-gold/40 bg-sidebar px-5 py-4 flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gold">
                      Application Reference Code
                    </span>
                    <div className="font-mono tabular-nums text-xl sm:text-2xl font-bold text-white">
                      {confirmedResult.referenceNumber}
                    </div>
                  </div>

                  <p className="text-xs text-white/75 max-w-md mx-auto leading-relaxed">
                    Our Hajj operations team will connect with you via WhatsApp and phone to review passport validity and notify you first when official MoRA and Nusuk 2027 quotas open.
                  </p>

                  <div className="pt-1 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5">
                    <a
                      href={
                        confirmedResult.whatsappUrl ||
                        toWaMeUrl(
                          agencyWhatsapp,
                          `Assalam-o-Alaikum Al Ramlah Travels, I have submitted Hajj 2027 pre-registration ${confirmedResult.referenceNumber} for ${activePackage?.title ?? "Hajj 2027 Consultation"}. Please connect me with the Senior Hajj Director.`
                        )
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-xs sm:text-sm font-bold text-gold-foreground hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold transition-colors active:opacity-90"
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                      <span>Connect on WhatsApp</span>
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>

                    <button
                      type="button"
                      onClick={handleTrackStatus}
                      className="w-full sm:w-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gold/40 bg-sidebar px-4 py-2.5 text-xs font-semibold text-gold hover:bg-gold/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold transition-colors active:opacity-90 whitespace-nowrap"
                    >
                      <Search className="size-3.5" aria-hidden="true" />
                      <span>Track Status Live</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmedResult(null)
                        setSubmissionKey(createHajjSubmissionKey())
                      }}
                      className="w-full sm:w-auto inline-flex min-h-10 items-center justify-center rounded-xl border border-white/20 bg-sidebar-accent px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold transition-colors active:opacity-90 whitespace-nowrap"
                    >
                      New Pre-Registration
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="hajj-form"
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-4"
                  noValidate
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: HARAMAIN_EASE }}
                >
                  {/* Hidden Honeypot Trap (`T-055`) */}
                  <div className="sr-only" aria-hidden="true">
                    <label htmlFor="h-website">Company Website</label>
                    <input
                      id="h-website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  {/* Selected Package Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/15 pb-3.5">
                    <div>
                      <h3 className="font-display text-xl font-bold text-white">
                        {activePackage
                          ? `Maktab ${activePackage.maktab}: ${activePackage.title}`
                          : "Hajj 2027 Priority Consultation"}
                      </h3>
                      <p className="text-xs text-white/75 mt-0.5">
                        {activePackage
                          ? `Mina & Arafat Maktab ${activePackage.maktab}, ${activePackage.duration}`
                          : "Priority notification upon official MoRA and Saudi Nusuk 2027 quota release"}
                      </p>
                    </div>

                    {activePackage && (
                      <div className="rounded-xl border border-gold/40 bg-sidebar px-3.5 py-2 text-right shrink-0">
                        <span className="block text-[11px] font-semibold text-gold capitalize">
                          Indicative {selectedRoomType} rate
                        </span>
                        <span className="font-mono tabular-nums text-base font-bold text-white">
                          {formatPkr(activePackage.pricing[selectedRoomType])}
                        </span>
                        <span className="block text-[10px] text-white/70">
                          per person (non-binding)
                        </span>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-xl bg-red-950 border border-red-400/50 p-3 text-xs text-red-100"
                    >
                      <AlertCircle
                        className="size-4 text-red-300 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Room Occupancy Switcher */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-white/90">
                      Room Accommodation Category *
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["quad", "triple", "double"] as const).map(
                        (tierKey) => (
                          <button
                            key={tierKey}
                            type="button"
                            onClick={() => setSelectedRoomType(tierKey)}
                            className={`rounded-xl border px-2.5 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90 ${
                              selectedRoomType === tierKey
                                ? "border-gold bg-gold/20 text-gold ring-1 ring-gold"
                                : "border-white/15 bg-sidebar-accent text-white/85 hover:border-gold/40"
                            }`}
                          >
                            <span className="block text-xs font-semibold">
                              {tierKey === "quad"
                                ? "Quad (4-Bed)"
                                : tierKey === "triple"
                                  ? "Triple (3-Bed)"
                                  : "Double (2-Bed)"}
                            </span>
                            {activePackage && (
                              <span className="font-mono tabular-nums text-xs font-bold text-white block mt-0.5">
                                {formatPkr(activePackage.pricing[tierKey])}
                              </span>
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Lead Pilgrim Name, Country & City (`T-084`) */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="h-name" className="text-xs text-white/90">
                        Lead Pilgrim Name *
                      </Label>
                      <Input
                        id="h-name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Tariq Mansoor"
                        aria-invalid={Boolean(
                          fieldErrors["contact.customerName"]
                        )}
                        className="h-9 border-white/25 bg-sidebar text-white placeholder:text-white/45 focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor="h-country"
                        className="text-xs text-white/90 flex items-center gap-1"
                      >
                        <Globe
                          className="size-3 text-gold"
                          aria-hidden="true"
                        />
                        <span>Country *</span>
                      </Label>
                      <select
                        id="h-country"
                        value={customerCountry}
                        onChange={(e) => {
                          const nextCountry = e.target.value
                          setCustomerCountry(nextCountry)
                          const nextDefaultCity =
                            SUGGESTED_CITIES_BY_COUNTRY[nextCountry]?.[0] ?? ""
                          if (nextDefaultCity) {
                            setCustomerCity(nextDefaultCity)
                          }
                        }}
                        className="h-9 w-full rounded-lg border border-white/25 bg-sidebar px-2.5 text-sm text-white focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        required
                      >
                        {DIASPORA_COUNTRIES.map((country) => (
                          <option
                            key={country}
                            value={country}
                            className="bg-sidebar text-white"
                          >
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label htmlFor="h-city" className="text-xs text-white/90">
                        City of Residence *
                      </Label>
                      <Input
                        id="h-city"
                        list="hajj-city-suggestions"
                        value={customerCity}
                        onChange={(e) => setCustomerCity(e.target.value)}
                        placeholder={
                          customerCountry === "Pakistan"
                            ? "Lahore / Karachi"
                            : "London / Toronto"
                        }
                        aria-invalid={Boolean(
                          fieldErrors["contact.customerCity"]
                        )}
                        className="h-9 border-white/25 bg-sidebar text-white placeholder:text-white/45 focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0"
                        required
                      />
                      <datalist id="hajj-city-suggestions">
                        {citySuggestions.map((cityName) => (
                          <option key={cityName} value={cityName} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Phone & WhatsApp */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="h-phone" className="text-xs text-white/90">
                        Phone Number (PK or International) *
                      </Label>
                      <Input
                        id="h-phone"
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => syncPhone(e.target.value)}
                        placeholder="0327 4029701 or +44 7911 123456"
                        aria-invalid={Boolean(
                          fieldErrors["contact.customerPhone"]
                        )}
                        className="h-9 border-white/25 bg-sidebar font-mono text-white placeholder:text-white/45 focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="h-wa" className="text-xs text-white/90">
                        WhatsApp Number *
                      </Label>
                      <Input
                        id="h-wa"
                        type="tel"
                        value={customerWhatsapp}
                        onChange={(e) => setCustomerWhatsapp(e.target.value)}
                        placeholder="0327 4029701 or +44 7911 123456"
                        aria-invalid={Boolean(
                          fieldErrors["contact.customerWhatsapp"]
                        )}
                        className="h-9 border-white/25 bg-sidebar font-mono text-white placeholder:text-white/45 focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0"
                        required
                      />
                    </div>
                  </div>

                  {/* Email, Blood Group & Travellers */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="h-email" className="text-xs text-white/90">
                        Email Address (Optional)
                      </Label>
                      <Input
                        id="h-email"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="tariq@example.com"
                        aria-invalid={Boolean(
                          fieldErrors["contact.customerEmail"]
                        )}
                        className="h-9 border-white/25 bg-sidebar text-white placeholder:text-white/45 focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="h-blood" className="text-xs text-white/90">
                        Blood Group (Optional)
                      </Label>
                      <select
                        id="h-blood"
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="h-9 w-full rounded-lg border border-white/25 bg-sidebar px-2.5 text-sm text-white focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      >
                        <option value="" className="bg-sidebar text-white">
                          Select Blood Group
                        </option>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                          (bg) => (
                            <option
                              key={bg}
                              value={bg}
                              className="bg-sidebar text-white"
                            >
                              {bg}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Travellers */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor="h-adults"
                        className="text-xs text-white/90"
                      >
                        Adults (12+ yrs) *
                      </Label>
                      <Input
                        id="h-adults"
                        type="number"
                        min={1}
                        max={30}
                        value={adults}
                        onChange={(e) => {
                          const nextAdults = Math.max(
                            1,
                            Math.min(30, Number(e.target.value) || 1)
                          )
                          setAdults(nextAdults)
                          if (infants > nextAdults) {
                            setInfants(nextAdults)
                          }
                        }}
                        className="h-9 border-white/25 bg-sidebar font-mono tabular-nums text-white focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor="h-children"
                        className="text-xs text-white/90"
                      >
                        Children (2 to 11 yrs)
                      </Label>
                      <Input
                        id="h-children"
                        type="number"
                        min={0}
                        max={20}
                        value={children}
                        onChange={(e) =>
                          setChildren(
                            Math.max(
                              0,
                              Math.min(20, Number(e.target.value) || 0)
                            )
                          )
                        }
                        className="h-9 border-white/25 bg-sidebar font-mono tabular-nums text-white focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor="h-infants"
                        className="text-xs text-white/90"
                      >
                        Infants (&lt;2 yrs)
                      </Label>
                      <Input
                        id="h-infants"
                        type="number"
                        min={0}
                        max={Math.min(10, adults)}
                        value={infants}
                        onChange={(e) =>
                          setInfants(
                            Math.max(
                              0,
                              Math.min(10, adults, Number(e.target.value) || 0)
                            )
                          )
                        }
                        className="h-9 border-white/25 bg-sidebar font-mono tabular-nums text-white focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* Compact Optional Add-Ons */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <label
                      htmlFor="opt-qurbani"
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/15 bg-sidebar-accent px-3 py-2 text-xs transition-colors hover:border-gold/40"
                    >
                      <span className="flex items-center gap-2 text-white">
                        <input
                          id="opt-qurbani"
                          type="checkbox"
                          checked={includeQurbani}
                          onChange={(e) => setIncludeQurbani(e.target.checked)}
                          className="size-4 accent-gold rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        />
                        <span>Qurbani / Adahi</span>
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-gold">
                        {`~${formatPkr(55000)}`}
                      </span>
                    </label>

                    <label
                      htmlFor="opt-train"
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/15 bg-sidebar-accent px-3 py-2 text-xs transition-colors hover:border-gold/40"
                    >
                      <span className="flex items-center gap-2 text-white">
                        <input
                          id="opt-train"
                          type="checkbox"
                          checked={includeTrainTicket}
                          onChange={(e) =>
                            setIncludeTrainTicket(e.target.checked)
                          }
                          className="size-4 accent-gold rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        />
                        <span>Haramain Train</span>
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-gold">
                        {`~${formatPkr(61000)}`}
                      </span>
                    </label>
                  </div>

                  {/* Special Notes */}
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="h-notes" className="text-xs text-white/90">
                      Special Accommodation, Wheelchair or Diaspora Notes
                    </Label>
                    <Textarea
                      id="h-notes"
                      rows={2}
                      maxLength={1000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Elderly mobility assistance, overseas gateway, or suite requests…"
                      className="min-h-14 border-white/25 bg-sidebar text-white placeholder:text-white/45 focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-11 gap-2 bg-gold py-2.5 text-sm font-bold text-gold-foreground hover:bg-gold/90 focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0 active:opacity-90"
                  >
                    {loading && (
                      <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    )}
                    <span>Submit Indicative Hajj 2027 Pre-Registration</span>
                  </Button>

                  <div className="border-t border-white/10 pt-3 flex items-center gap-2 text-xs text-white/75">
                    <ShieldCheck
                      className="size-4 text-gold shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Non-binding priority queue with zero online payment or seat checkout.
                    </span>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
