"use client"

import * as React from "react"
import { useMemo, useState } from "react"
import { submitHajjInquiryApplication } from "@/app/actions/applications"
import { ArabicText } from "@/components/public/arabic-text"
import { toWaMeUrl } from "@/components/public/public-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CheckCircle2,
  Tent,
  Building,
  Sparkles,
  MessageCircle,
  Loader2,
  Phone,
  Clock,
  ShieldCheck,
  Utensils,
  FileText,
  UserCheck,
  Check,
  Info,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  Globe,
} from "lucide-react"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"

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
  departureCities?: { cityName: string; airportCode: string }[]
  agencyWhatsapp?: string
  secondaryPhone?: string
}

export interface HajjHotelStay {
  city: "Madinah" | "Makkah" | "Azizia"
  name: string
  meal: string
}

export interface HajjPackageDefinition {
  id: string
  slug: string
  maktab: "A" | "B" | "C"
  code: string
  title: string
  tierName: "Executive" | "Premium" | "Silver"
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
  Pakistan: ["Lahore", "Islamabad", "Karachi", "Faisalabad", "Multan", "Peshawar", "Sialkot"],
  "United Kingdom": ["London", "Birmingham", "Manchester", "Bradford", "Glasgow"],
  "United States": ["Houston", "New York", "Chicago", "Dallas", "Washington DC"],
  Canada: ["Toronto", "Mississauga", "Calgary", "Vancouver", "Montreal"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam"],
}

function coerceMaktabCode(raw: string): "A" | "B" | "C" {
  const upper = raw.trim().toUpperCase()
  if (upper.includes("B")) return "B"
  if (upper.includes("C")) return "C"
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
      tierName: maktab === "A" ? "Executive" : maktab === "B" ? "Premium" : "Silver",
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
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `hajj_${crypto.randomUUID().replace(/-/g, "")}`
  }
  return `hajj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function HajjInquirySection({
  hajjPackages = [],
  departureCities,
  agencyWhatsapp = DEFAULT_COMPANY_INFO.primaryWhatsapp,
  secondaryPhone = DEFAULT_COMPANY_INFO.secondaryPhone,
}: HajjInquirySectionProps = {}) {
  // T-084 & OD-09e: Hydrate from DB hajjPackages when populated, with indicative 2027 catalog fallback
  const catalogPackages = useMemo(() => {
    if (hajjPackages.length > 0) {
      return mapDbHajjPackagesToDefinitions(hajjPackages)
    }
    return HAJJ_2027_PACKAGES
  }, [hajjPackages])

  const [selectedMaktab, setSelectedMaktab] = useState<"all" | "A" | "B" | "C">(
    "all"
  )
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    () =>
      catalogPackages.find((p) => p.popular)?.id ??
      catalogPackages[0]?.id ??
      "hajj-a-03"
  )
  const [selectedRoomType, setSelectedRoomType] = useState<
    "quad" | "triple" | "double"
  >("quad")
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

  const activePackage =
    catalogPackages.find((p) => p.id === selectedPackageId) ??
    catalogPackages[0]!

  const filteredPackages =
    selectedMaktab === "all"
      ? catalogPackages
      : catalogPackages.filter((p) => p.maktab === selectedMaktab)

  const countA = catalogPackages.filter((p) => p.maktab === "A").length
  const countB = catalogPackages.filter((p) => p.maktab === "B").length
  const countC = catalogPackages.filter((p) => p.maktab === "C").length

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

      const chosenPrice = activePackage.pricing[selectedRoomType]
      const consultationType = `Maktab ${activePackage.maktab} · ${activePackage.title} · ${roomLabel}`

      // T-055 & T-084: Persist structured Hajj metadata in hajjInquiryJson without overflowing specialRequests
      const res = await submitHajjInquiryApplication({
        clientSubmissionId: submissionKey,
        honeypot,
        hajjConsultationType: consultationType,
        hajjPackageSlug: activePackage.slug,
        maktabTier: activePackage.maktab,
        roomType: selectedRoomType,
        indicativePricePkr: chosenPrice,
        durationLabel: activePackage.duration,
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
          selectedPkgTitle: `${activePackage.title} (${roomLabel})`,
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

  return (
    <section
      id="hajj-inquiry"
      className="relative overflow-hidden bg-gradient-to-b from-[#062417] via-[#0A3622] to-[#041B11] py-20 text-white scroll-mt-16"
    >
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#C5A059_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col gap-16">
        {/* ======================================================== */}
        {/* SECTION HEADER & INDICATIVE REGULATORY BANNER (`OD-09e`)  */}
        {/* ======================================================== */}
        <div className="text-center max-w-3xl mx-auto flex flex-col gap-4">
          <div className="inline-flex self-center items-center gap-2 rounded-full border border-gold/40 bg-black/40 px-4 py-1.5 backdrop-blur-md">
            <ArabicText className="text-base text-gold font-medium">
              حَجٌّ مَبْرُورٌ وَسَعْيٌ مَشْكُورٌ
            </ArabicText>
            <span className="text-white/40">·</span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-gold">
              INDICATIVE HAJJ 2027 PRE-REGISTRATION
            </span>
          </div>

          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Hajj 2027 Indicative Package Guide
          </h2>

          <p className="text-white/80 text-sm sm:text-base leading-relaxed">
            <strong className="text-gold font-semibold">
              Where Purpose Meets Excellence
            </strong>{" "}
            — Open to Pakistani residents and overseas diaspora families worldwide. Indicative per-person figures in PKR; hotels listed in the order{" "}
            <span className="underline decoration-gold/60 underline-offset-4">
              Madinah · Makkah · Azizia
            </span>
            .
          </p>

          {/* Mandatory Regulatory Disclaimer (`OD-09e`) */}
          <div className="rounded-2xl border border-gold/40 bg-black/40 px-4 py-3 text-left text-xs text-white/85 flex items-start gap-2.5">
            <Info className="size-4 text-gold shrink-0 mt-0.5" />
            <span>
              <strong className="text-gold">Regulatory Pre-Registration Notice:</strong>{" "}
              All Hajj 2027 tariffs and Maktab structures shown below are{" "}
              <strong>non-binding indicative pre-registration estimates</strong>{" "}
              based on prior Maktab benchmarks. Final seat allocation, camp zones, and tariffs remain subject to official Government of Pakistan Ministry of Religious Affairs (MoRA) and Saudi Ministry of Hajj &amp; Umrah (Nusuk) 2027 announcements.
            </span>
          </div>

          {/* Maktab Filter Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedMaktab("all")}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                selectedMaktab === "all"
                  ? "bg-gold text-emerald-950 shadow-md shadow-gold/20"
                  : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/15"
              }`}
            >
              All Packages ({catalogPackages.length})
            </button>
            {countA > 0 && (
              <button
                type="button"
                onClick={() => setSelectedMaktab("A")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  selectedMaktab === "A"
                    ? "bg-gold text-emerald-950 shadow-md shadow-gold/20"
                    : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/15"
                }`}
              >
                Maktab A ({countA})
              </button>
            )}
            {countB > 0 && (
              <button
                type="button"
                onClick={() => setSelectedMaktab("B")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  selectedMaktab === "B"
                    ? "bg-gold text-emerald-950 shadow-md shadow-gold/20"
                    : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/15"
                }`}
              >
                Maktab B ({countB})
              </button>
            )}
            {countC > 0 && (
              <button
                type="button"
                onClick={() => setSelectedMaktab("C")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  selectedMaktab === "C"
                    ? "bg-gold text-emerald-950 shadow-md shadow-gold/20"
                    : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/15"
                }`}
              >
                Maktab C ({countC})
              </button>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* PACKAGES GRID                                            */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPackages.map((pkg) => {
            const isSelected = selectedPackageId === pkg.id

            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col justify-between rounded-3xl border p-6 backdrop-blur-xl transition-all duration-300 ${
                  isSelected
                    ? "border-gold bg-[#041D12]/95 ring-2 ring-gold/60 shadow-2xl shadow-gold/15"
                    : "border-white/15 bg-black/35 hover:border-gold/50 hover:bg-black/50"
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 right-6 rounded-full bg-gold px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-950 shadow-md">
                    Featured Tier
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-gold/20 font-mono tabular-nums text-xs font-bold text-gold border border-gold/40">
                        {pkg.code}
                      </span>
                      <span className="rounded-md bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90">
                        Maktab {pkg.maktab}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30 tabular-nums">
                      <Clock className="size-3" />
                      {pkg.duration}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-white leading-snug">
                      {pkg.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-gold/90 font-medium">
                      <Tent className="size-3.5 shrink-0 text-gold" />
                      <span>{pkg.camps}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-2xl bg-white/5 p-3.5 border border-white/10 text-xs">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-gold/80">
                      Hotel Accommodations &amp; Meals
                    </span>
                    {pkg.hotels.map((hotel, hIdx) => (
                      <div
                        key={hIdx}
                        className="flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-white">
                          <Building className="size-3 text-gold shrink-0" />
                          <span className="text-[11px] font-bold text-gold">
                            {hotel.city}:
                          </span>
                          <span className="truncate">{hotel.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-white/70 pl-4.5">
                          <Utensils className="size-2.5 text-white/50 shrink-0" />
                          <span>{hotel.meal}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-white/60">
                      Indicative Estimate Per Person (PKR)
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {(["quad", "triple", "double"] as const).map((tierKey) => {
                        const rateVal = pkg.pricing[tierKey]
                        const label =
                          tierKey === "quad"
                            ? "Quad Bed"
                            : tierKey === "triple"
                              ? "Triple Bed"
                              : "Double Bed"
                        return (
                          <button
                            key={tierKey}
                            type="button"
                            onClick={() => handleSelectPackage(pkg, tierKey)}
                            className={`cursor-pointer rounded-xl border p-2 transition-colors ${
                              isSelected && selectedRoomType === tierKey
                                ? "border-gold bg-gold/15 text-gold"
                                : "border-white/10 bg-white/5 hover:border-white/30 text-white/90"
                            }`}
                          >
                            <span className="block text-[10px] font-semibold text-white/70">
                              {label}
                            </span>
                            <span className="font-mono tabular-nums text-xs font-bold text-white">
                              {(rateVal / 1000000).toFixed(2)}M
                            </span>
                            <span className="block font-mono tabular-nums text-[9px] text-white/50">
                              {rateVal.toLocaleString()}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-5">
                  <Button
                    type="button"
                    onClick={() => handleSelectPackage(pkg, selectedRoomType)}
                    className={`w-full justify-center gap-2 py-2.5 text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-gold text-emerald-950 hover:bg-gold/90 shadow-md shadow-gold/20"
                        : "border border-gold/50 bg-black/40 text-gold hover:bg-gold hover:text-emerald-950"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="size-4" />
                        <span>Selected · Pre-Register Below</span>
                      </>
                    ) : (
                      <>
                        <span>Pre-Register Interest</span>
                        <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ======================================================== */}
        {/* INCLUDED IN EVERY PACKAGE & ADDITIONAL CHARGES BANNER     */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 rounded-3xl border border-gold/30 bg-black/40 p-6 sm:p-8 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:col-span-7">
            <div className="flex items-center gap-2 text-gold">
              <Sparkles className="size-5" />
              <h3 className="font-display text-xl font-bold text-white">
                Target Inclusions Across Hajj 2027 Tiers
              </h3>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Every Al Ramlah Travels pilgrim is supported end-to-end with comprehensive logistical execution and spiritual dignity.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              {[
                "Private luxury bus (Manasik days & intercity transfers)",
                "Return air ticket (Pakistani or international gateway options)",
                "Accommodations in Madinah, Makkah & Azizia",
                "Mina & Arafat camps (Maktab A / B / C category)",
                "Buffet meals as specified on each package",
                "Religious scholar guidance & dedicated group leader",
                "24/7 Airport meet, greet & executive ground assistance",
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${
                    idx === 6 ? "sm:col-span-2" : ""
                  }`}
                >
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                    <Check className="size-3" />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-[#D97706]/40 bg-[#FEF3C7]/10 p-5 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[#F59E0B]">
                <Info className="size-4" />
                <h4 className="font-display text-base font-bold text-white">
                  Optional Add-Ons (Estimated)
                </h4>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Indicative package figures exclude optional Adahi / Qurbani coupons and Haramain High-Speed Rail upgrades.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between rounded-xl bg-black/40 border border-white/10 p-3">
                <span className="text-xs font-semibold text-white/90">
                  Qurbani / Adahi Sacrifice
                </span>
                <span className="font-mono tabular-nums text-sm font-extrabold text-gold">
                  ~PKR 55,000
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-black/40 border border-white/10 p-3">
                <span className="text-xs font-semibold text-white/90">
                  Haramain High-Speed Train Ticket
                </span>
                <span className="font-mono tabular-nums text-sm font-extrabold text-gold">
                  ~PKR 61,000
                </span>
              </div>
            </div>

            <p className="text-[10px] text-white/50 italic">
              * Subject to official Saudi Ministry of Hajj &amp; SAR railway 2027 tariff confirmations.
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* REQUIRED DOCUMENTS & HOW TO PRE-REGISTER                 */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-3xl border border-white/15 bg-black/35 p-6 sm:p-8 backdrop-blur-xl flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-gold" />
              <h3 className="font-display text-xl font-bold text-white">
                6 Documents for Hajj 2027 Readiness
              </h3>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Prepare digital copies ahead of the official MoRA / Nusuk quota window:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-1">
                <span className="font-mono tabular-nums text-[10px] font-bold text-gold">
                  01
                </span>
                <h4 className="font-bold text-white">Machine-Readable Passport</h4>
                <p className="text-[11px] text-white/70">
                  Pakistani MRP or Overseas Pakistani / Dual-National passport valid through December 2027.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-1">
                <span className="font-mono tabular-nums text-[10px] font-bold text-gold">
                  02
                </span>
                <h4 className="font-bold text-white">CNIC / NICOP / B-Form</h4>
                <p className="text-[11px] text-white/70">
                  NADRA Smart CNIC, Overseas NICOP/POC, or B-Form for minors.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-1">
                <span className="font-mono tabular-nums text-[10px] font-bold text-gold">
                  03
                </span>
                <h4 className="font-bold text-white">Residential &amp; Contact Info</h4>
                <p className="text-[11px] text-white/70">
                  Complete residential address and active WhatsApp number.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-1">
                <span className="font-mono tabular-nums text-[10px] font-bold text-gold">
                  04
                </span>
                <h4 className="font-bold text-white">Next of Kin Details</h4>
                <p className="text-[11px] text-white/70">
                  Nominee / next of kin identification, relationship, and emergency phone.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-1">
                <span className="font-mono tabular-nums text-[10px] font-bold text-gold">
                  05
                </span>
                <h4 className="font-bold text-white">Biometric Photograph</h4>
                <p className="text-[11px] text-white/70">
                  Recent 4 × 3 cm photograph with clean white background.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-1">
                <span className="font-mono tabular-nums text-[10px] font-bold text-gold">
                  06
                </span>
                <h4 className="font-bold text-white">Blood Group Record</h4>
                <p className="text-[11px] text-white/70">
                  Clinical card or driving license recording applicant blood group.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl border border-gold/30 bg-gradient-to-br from-[#0A3622] to-black/60 p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <UserCheck className="size-5 text-gold" />
                <h3 className="font-display text-xl font-bold text-white">
                  How Pre-Registration Works
                </h3>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Register priority interest with personalized executive guidance from our Askari 10 Lahore desk.
              </p>

              <div className="flex flex-col gap-4 pt-2">
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold font-mono text-xs font-black text-emerald-950">
                    1
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      Select Preferred Maktab Tier
                    </h4>
                    <p className="text-xs text-white/70">
                      Choose your target Maktab (A, B, or C), duration, and room occupancy.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold font-mono text-xs font-black text-emerald-950">
                    2
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      Priority Readiness Review
                    </h4>
                    <p className="text-xs text-white/70">
                      Our Hajj desk verifies passport validity and diaspora/resident routing options.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold font-mono text-xs font-black text-emerald-950">
                    3
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      Official Quota Confirmation
                    </h4>
                    <p className="text-xs text-white/70">
                      Upon official MoRA / Nusuk quota release, pre-registered families receive priority allotment confirmation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gold/30 bg-black/40 p-3 text-center">
              <span className="text-[11px] font-semibold text-gold block font-mono tabular-nums">
                Direct Hotline: {[agencyWhatsapp, secondaryPhone].filter(Boolean).join(" · ")}
              </span>
              <span className="text-[10px] text-white/60">
                Monday to Saturday: 9:00 AM to 8:00 PM PKT
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* INTERACTIVE HAJJ PRE-REGISTRATION FORM                   */}
        {/* ======================================================== */}
        <div
          id="hajj-reservation-card"
          className="mx-auto max-w-4xl w-full rounded-3xl border-2 border-gold/40 bg-black/60 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl flex flex-col gap-8 scroll-mt-20"
        >
          {confirmedResult ? (
            <div className="flex flex-col gap-6 py-6 text-center animate-in fade-in-50 duration-300">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-gold/20 text-gold border-2 border-gold/50">
                <CheckCircle2 className="size-9" />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Hajj 2027 Pre-Registration Dispatched
                </h3>
                <p className="text-sm text-white/80 max-w-md mx-auto">
                  Your priority pre-registration for{" "}
                  <strong className="text-gold">
                    {confirmedResult.selectedPkgTitle}
                  </strong>{" "}
                  has been assigned to our Senior Hajj Director in Lahore.
                </p>
              </div>

              <div className="mx-auto max-w-sm w-full rounded-2xl border border-gold/40 bg-[#041D12] p-5 flex flex-col gap-1 shadow-lg">
                <span className="text-[11px] font-semibold text-gold uppercase tracking-wider block">
                  Application Reference Code
                </span>
                <div className="font-mono tabular-nums text-2xl sm:text-3xl font-extrabold text-white tracking-wider">
                  {confirmedResult.referenceNumber}
                </div>
              </div>

              <p className="text-xs text-white/70 max-w-md mx-auto leading-relaxed">
                Our Hajj operations team will connect with you via WhatsApp and phone to review passport validity and notify you first when official MoRA / Nusuk 2027 quotas open.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={
                    confirmedResult.whatsappUrl ||
                    toWaMeUrl(
                      agencyWhatsapp,
                      `Assalam-o-Alaikum Al Ramlah Travels, I have submitted Hajj 2027 pre-registration ${confirmedResult.referenceNumber} for ${activePackage.title}. Please connect me with the Senior Hajj Director.`
                    )
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-7 py-3 text-sm font-bold text-emerald-950 hover:bg-gold/90 shadow-lg shadow-gold/20 transition-colors"
                >
                  <MessageCircle className="size-4" />
                  <span>Connect with Hajj Desk on WhatsApp</span>
                  <ExternalLink className="size-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmedResult(null)
                    setSubmissionKey(createHajjSubmissionKey())
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  Submit Another Pre-Registration
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
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

              {/* Selected Package Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/15 pb-5">
                <div>
                  <span className="text-xs font-bold text-gold uppercase tracking-wider block">
                    Selected Indicative Hajj 2027 Structure
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                    Maktab {activePackage.maktab} · {activePackage.title}
                  </h3>
                  <p className="text-xs text-white/70 mt-1">
                    {activePackage.camps} · {activePackage.duration}
                  </p>
                </div>

                <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-right">
                  <span className="block text-[10px] font-semibold uppercase text-gold">
                    INDICATIVE {selectedRoomType.toUpperCase()} ESTIMATE
                  </span>
                  <span className="font-mono tabular-nums text-lg font-black text-white">
                    PKR {activePackage.pricing[selectedRoomType].toLocaleString()}
                  </span>
                  <span className="block text-[9px] text-white/60">
                    per person (non-binding)
                  </span>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-red-950/80 border border-red-500/50 p-4 text-xs text-red-200"
                >
                  <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Room Selection Switcher */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-white/90">
                  Choose Room Accommodation Category *
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {(["quad", "triple", "double"] as const).map((tierKey) => (
                    <button
                      key={tierKey}
                      type="button"
                      onClick={() => setSelectedRoomType(tierKey)}
                      className={`rounded-xl border p-3 text-center transition-all ${
                        selectedRoomType === tierKey
                          ? "border-gold bg-gold/20 text-gold ring-1 ring-gold"
                          : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <span className="block text-xs font-bold capitalize">
                        {tierKey === "quad"
                          ? "Quad (4-Bed)"
                          : tierKey === "triple"
                            ? "Triple (3-Bed)"
                            : "Double (2-Bed)"}
                      </span>
                      <span className="font-mono tabular-nums text-xs font-semibold text-white block mt-0.5">
                        PKR {activePackage.pricing[tierKey].toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lead Pilgrim Name, Country & City (`T-084` International Diaspora Support) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5 sm:col-span-1">
                  <Label htmlFor="h-name" className="text-xs text-white/90">
                    Lead Pilgrim Full Name *
                  </Label>
                  <Input
                    id="h-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Al-Haj Tariq Mansoor"
                    aria-invalid={Boolean(fieldErrors["contact.customerName"])}
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="h-country"
                    className="text-xs text-white/90 flex items-center gap-1"
                  >
                    <Globe className="size-3 text-gold" />
                    <span>Country of Residence *</span>
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
                    className="w-full rounded-md border border-white/20 bg-[#062417] px-3 py-2 text-sm text-white focus:border-gold focus:outline-none"
                    required
                  >
                    {DIASPORA_COUNTRIES.map((country) => (
                      <option
                        key={country}
                        value={country}
                        className="bg-[#062417] text-white"
                      >
                        {country}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
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
                        ? "e.g. Lahore / Islamabad / Karachi"
                        : "e.g. London / Houston / Toronto / Dubai"
                    }
                    aria-invalid={Boolean(fieldErrors["contact.customerCity"])}
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="h-phone" className="text-xs text-white/90">
                    Phone Number (PK or International) *
                  </Label>
                  <Input
                    id="h-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => syncPhone(e.target.value)}
                    placeholder="0327 4029701 or +44 7911 123456"
                    aria-invalid={Boolean(fieldErrors["contact.customerPhone"])}
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="h-wa" className="text-xs text-white/90">
                    WhatsApp Number *
                  </Label>
                  <Input
                    id="h-wa"
                    type="tel"
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    placeholder="0327 4029701 or +44 7911 123456"
                    aria-invalid={Boolean(fieldErrors["contact.customerWhatsapp"])}
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                    required
                  />
                </div>
              </div>

              {/* Email & Blood Group */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="h-email" className="text-xs text-white/90">
                    Email Address (Optional)
                  </Label>
                  <Input
                    id="h-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="tariq@example.com"
                    aria-invalid={Boolean(fieldErrors["contact.customerEmail"])}
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="h-blood" className="text-xs text-white/90">
                    Applicant Blood Group (Document #06)
                  </Label>
                  <select
                    id="h-blood"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full rounded-md border border-white/20 bg-[#062417] px-3 py-2 text-sm text-white focus:border-gold focus:outline-none"
                  >
                    <option value="" className="bg-[#062417] text-white">
                      Select Blood Group (Optional)
                    </option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                      (bg) => (
                        <option key={bg} value={bg} className="bg-[#062417] text-white">
                          {bg}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* Travellers Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="h-adults" className="text-xs text-white/90">
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
                    className="border-white/20 bg-white/10 text-white focus:border-gold"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="h-children" className="text-xs text-white/90">
                    Children (2–11 yrs)
                  </Label>
                  <Input
                    id="h-children"
                    type="number"
                    min={0}
                    max={20}
                    value={children}
                    onChange={(e) =>
                      setChildren(
                        Math.max(0, Math.min(20, Number(e.target.value) || 0))
                      )
                    }
                    className="border-white/20 bg-white/10 text-white focus:border-gold"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="h-infants" className="text-xs text-white/90">
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
                    className="border-white/20 bg-white/10 text-white focus:border-gold"
                  />
                </div>
              </div>

              {/* Add-on Checkboxes */}
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 flex flex-col gap-3">
                <span className="block text-xs font-bold text-gold uppercase tracking-wider">
                  Additional Add-On Services (Optional)
                </span>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <input
                      id="opt-qurbani"
                      type="checkbox"
                      checked={includeQurbani}
                      onChange={(e) => setIncludeQurbani(e.target.checked)}
                      className="size-4 accent-gold rounded"
                    />
                    <label
                      htmlFor="opt-qurbani"
                      className="text-xs text-white cursor-pointer"
                    >
                      Include Official Islamic Qurbani / Adahi Arrangement
                    </label>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-bold text-gold">
                    ~PKR 55,000 / person
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <input
                      id="opt-train"
                      type="checkbox"
                      checked={includeTrainTicket}
                      onChange={(e) => setIncludeTrainTicket(e.target.checked)}
                      className="size-4 accent-gold rounded"
                    />
                    <label
                      htmlFor="opt-train"
                      className="text-xs text-white cursor-pointer"
                    >
                      Haramain High-Speed Train Intercity Transit
                    </label>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-bold text-gold">
                    ~PKR 61,000 / person
                  </span>
                </div>
              </div>

              {/* Special Inquiries */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="h-notes" className="text-xs text-white/90">
                  Special Accommodation, Elderly Care or Nusuk Inquiries
                </Label>
                <Textarea
                  id="h-notes"
                  rows={3}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tell us about elderly family members, wheelchair assistance, overseas departure airport, or preferred suite configuration..."
                  className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2 bg-gold py-3 text-sm sm:text-base font-bold text-emerald-950 hover:bg-gold/90 shadow-xl shadow-gold/20"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                <span>Submit Indicative Hajj 2027 Pre-Registration</span>
              </Button>

              <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-white/70">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-gold shrink-0" />
                  <span>
                    Where Purpose Meets Excellence · Askari 10 Lahore Hajj Desk
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-3.5 text-gold shrink-0" />
                  <span className="font-mono tabular-nums text-gold font-bold">
                    {[agencyWhatsapp, secondaryPhone].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
