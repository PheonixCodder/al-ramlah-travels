"use client"

import * as React from "react"
import { useState } from "react"
import { submitHajjInquiry } from "@/app/actions/applications"
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
} from "lucide-react"

export interface HajjInquirySectionProps {
  departureCities?: { cityName: string; airportCode: string }[]
  agencyWhatsapp?: string
}

export interface HajjHotelStay {
  city: "Madinah" | "Makkah" | "Azizia"
  name: string
  meal: string
}

export interface HajjPackageDefinition {
  id: string
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
  notes?: string
}

export const HAJJ_2027_PACKAGES: HajjPackageDefinition[] = [
  // ==========================================
  // MAKTAB A (3 Packages)
  // ==========================================
  {
    id: "hajj-a-01",
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
        name: "Peninsula Worth Hotel Madinah / Similar",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Azizia",
        name: "Executive Building, Azizia",
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
        name: "Peninsula Worth Hotel Madinah / Similar",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Azizia",
        name: "Executive Building, Azizia",
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
        name: "Elaf Taiba / Similar",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Makkah",
        name: "Swiss Al Maqam / Similar",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Azizia",
        name: "Executive Building, Azizia",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
    ],
    pricing: {
      quad: 2725000,
      triple: 2895000,
      double: 2990000,
    },
  },

  // ==========================================
  // MAKTAB B (4 Packages)
  // ==========================================
  {
    id: "hajj-b-01",
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
        name: "Elaf Taiba",
        meal: "Half Board: Breakfast + Dinner · Gender-based sharing",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner · Gender-based sharing",
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
        name: "Verta Al Madina / Similar",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner · Gender-based sharing",
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
        name: "Elaf Taiba",
        meal: "Half Board: Breakfast + Dinner · Gender-based sharing",
      },
      {
        city: "Makkah",
        name: "Clock Tower",
        meal: "Half Board: Breakfast + Dinner · Gender-based sharing",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner · Gender-based sharing",
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
        name: "Verta Al Madina / Similar",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
      {
        city: "Makkah",
        name: "Hilton Convention / Marriott",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner · Gender-based sharing",
      },
    ],
    pricing: {
      quad: 2095000,
      triple: 2245000,
      double: 2395000,
    },
  },

  // ==========================================
  // MAKTAB C (3 Packages)
  // ==========================================
  {
    id: "hajj-c-01",
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
        name: "Dewan Al Madina / Similar",
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
        name: "Dewan Al Madina / Similar",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
      {
        city: "Makkah",
        name: "Arfat Golden Rushd (Ex-Dar Khalil Al Rushd) / Similar",
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
        name: "Verta Al Madina / Similar",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner",
      },
      {
        city: "Makkah",
        name: "Hilton Convention / Marriott",
        meal: "Half Board Buffet: Breakfast + Dinner",
      },
      {
        city: "Azizia",
        name: "Azizia Building (Nearest to Jamarat)",
        meal: "Full Board Buffet: Breakfast + Lunch + Dinner · Gender-based sharing",
      },
    ],
    pricing: {
      quad: 1950000,
      triple: 2095000,
      double: 2250000,
    },
  },
]

export function HajjInquirySection({
  departureCities,
  agencyWhatsapp = "03274029701",
}: HajjInquirySectionProps = {}) {
  const [selectedMaktab, setSelectedMaktab] = useState<"all" | "A" | "B" | "C">("all")
  const [selectedPackageId, setSelectedPackageId] = useState<string>("hajj-a-03")
  const [selectedRoomType, setSelectedRoomType] = useState<"quad" | "triple" | "double">("quad")
  const [includeQurbani, setIncludeQurbani] = useState(true)
  const [includeTrainTicket, setIncludeTrainTicket] = useState(false)
  const [bloodGroup, setBloodGroup] = useState("")

  // Form State
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerWhatsapp, setCustomerWhatsapp] = useState("")
  const [customerCity, setCustomerCity] = useState(
    departureCities?.[0]?.cityName ?? "Lahore"
  )
  const [customerEmail, setCustomerEmail] = useState("")
  const [adults, setAdults] = useState<number>(2)
  const [children, setChildren] = useState<number>(0)
  const [infants, setInfants] = useState<number>(0)
  const [notes, setNotes] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmedResult, setConfirmedResult] = useState<{
    referenceNumber: string
    whatsappUrl?: string
    selectedPkgTitle?: string
  } | null>(null)

  const activePackage =
    HAJJ_2027_PACKAGES.find((p) => p.id === selectedPackageId) ??
    HAJJ_2027_PACKAGES[2]!

  const filteredPackages =
    selectedMaktab === "all"
      ? HAJJ_2027_PACKAGES
      : HAJJ_2027_PACKAGES.filter((p) => p.maktab === selectedMaktab)

  function handleSelectPackage(pkg: HajjPackageDefinition, room: "quad" | "triple" | "double" = "quad") {
    setSelectedPackageId(pkg.id)
    setSelectedRoomType(room)
    if (selectedMaktab !== "all" && selectedMaktab !== pkg.maktab) {
      setSelectedMaktab(pkg.maktab)
    }

    // Smooth scroll to the inquiry reservation form
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
    setLoading(true)
    setError(null)

    try {
      const roomLabel =
        selectedRoomType === "quad"
          ? "Quad Bed"
          : selectedRoomType === "triple"
            ? "Triple Bed"
            : "Double Bed"

      const chosenPrice = activePackage.pricing[selectedRoomType]
      const consultationType = `Maktab ${activePackage.maktab} · ${activePackage.title} · ${roomLabel}`

      const structuredNotes = [
        `Package: Maktab ${activePackage.maktab} - ${activePackage.title}`,
        `Duration: ${activePackage.duration}`,
        `Selected Room: ${roomLabel} (PKR ${chosenPrice.toLocaleString()} / person)`,
        includeQurbani ? "Qurbani: YES (+PKR 55,000/person)" : "Qurbani: NOT REQUESTED",
        includeTrainTicket ? "Train Ticket: YES (+PKR 61,000/person)" : "Train Ticket: NOT REQUESTED",
        bloodGroup.trim() ? `Blood Group: ${bloodGroup.trim()}` : "",
        notes.trim() ? `Special Inquiries / Requests: ${notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | ")

      const res = await submitHajjInquiry({
        hajjConsultationType: consultationType,
        passengers: { adults, children, infants },
        contact: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerWhatsapp: (customerWhatsapp || customerPhone).trim(),
          customerCity: customerCity.trim(),
          customerEmail: customerEmail.trim() || undefined,
        },
        notes: structuredNotes,
      })

      if (res.success && res.referenceNumber) {
        setConfirmedResult({
          referenceNumber: res.referenceNumber,
          whatsappUrl: res.whatsappUrl,
          selectedPkgTitle: `${activePackage.title} (${roomLabel})`,
        })
      } else {
        setError(res.error || "Failed to submit Hajj reservation inquiry.")
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to submit inquiry.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      id="hajj-inquiry"
      className="relative overflow-hidden bg-gradient-to-b from-[#062417] via-[#0A3622] to-[#041B11] py-20 text-white scroll-mt-16"
    >
      {/* Background Islamic Pattern Overlay */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#C5A059_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
        {/* ======================================================== */}
        {/* SECTION HEADER                                          */}
        {/* ======================================================== */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-black/40 px-4 py-1.5 backdrop-blur-md">
            <span
              dir="rtl"
              className="font-arabic text-base text-gold font-medium"
            >
              حَجٌّ مَبْرُورٌ وَسَعْيٌ مَشْكُورٌ
            </span>
            <span className="text-white/40">·</span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-gold">
              HAJJ 2027 PACKAGE GUIDE
            </span>
          </div>

          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Hajj 2027 Packages at a Glance
          </h2>

          <p className="text-white/80 text-sm sm:text-base leading-relaxed">
            <strong className="text-gold font-semibold">Where Purpose Meets Excellence</strong> — All prices are per person in Pakistani Rupees (PKR). Hotels are listed in the order <span className="underline decoration-gold/60 underline-offset-4">Madinah · Makkah · Azizia</span>.
          </p>

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
              All Packages (10)
            </button>
            <button
              type="button"
              onClick={() => setSelectedMaktab("A")}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                selectedMaktab === "A"
                  ? "bg-gold text-emerald-950 shadow-md shadow-gold/20"
                  : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/15"
              }`}
            >
              Maktab A (3 Packages)
            </button>
            <button
              type="button"
              onClick={() => setSelectedMaktab("B")}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                selectedMaktab === "B"
                  ? "bg-gold text-emerald-950 shadow-md shadow-gold/20"
                  : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/15"
              }`}
            >
              Maktab B (4 Packages)
            </button>
            <button
              type="button"
              onClick={() => setSelectedMaktab("C")}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                selectedMaktab === "C"
                  ? "bg-gold text-emerald-950 shadow-md shadow-gold/20"
                  : "bg-white/10 text-white/80 hover:bg-white/20 border border-white/15"
              }`}
            >
              Maktab C (3 Packages)
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 10 OFFICIAL PACKAGES GRID                                */}
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
                {/* Popular Badge */}
                {pkg.popular && (
                  <div className="absolute -top-3 right-6 rounded-full bg-gold px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-950 shadow-md">
                    Most Popular
                  </div>
                )}

                <div className="space-y-4">
                  {/* Category Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-gold/20 font-mono text-xs font-bold text-gold border border-gold/40">
                        {pkg.code}
                      </span>
                      <span className="rounded-md bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90">
                        Maktab {pkg.maktab}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                      <Clock className="size-3" />
                      {pkg.duration}
                    </span>
                  </div>

                  {/* Title & Camp Category */}
                  <div>
                    <h3 className="font-display text-lg font-bold text-white leading-snug">
                      {pkg.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-gold/90 font-medium">
                      <Tent className="size-3.5 shrink-0 text-gold" />
                      <span>{pkg.camps}</span>
                    </div>
                  </div>

                  {/* Hotel Stays & Meals */}
                  <div className="space-y-2 rounded-2xl bg-white/5 p-3.5 border border-white/10 text-xs">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-gold/80">
                      Hotel Accommodations &amp; Meals
                    </span>
                    {pkg.hotels.map((hotel, hIdx) => (
                      <div key={hIdx} className="space-y-0.5 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                        <div className="flex items-center gap-1.5 font-semibold text-white">
                          <Building className="size-3 text-gold shrink-0" />
                          <span className="text-[11px] font-bold text-gold">{hotel.city}:</span>
                          <span className="truncate">{hotel.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-white/70 pl-4.5">
                          <Utensils className="size-2.5 text-white/50 shrink-0" />
                          <span>{hotel.meal}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rates Table (Quad, Triple, Double) */}
                  <div className="space-y-2 pt-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-white/60">
                      Price Per Person (PKR)
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div
                        onClick={() => handleSelectPackage(pkg, "quad")}
                        className={`cursor-pointer rounded-xl border p-2 transition-colors ${
                          isSelected && selectedRoomType === "quad"
                            ? "border-gold bg-gold/15 text-gold"
                            : "border-white/10 bg-white/5 hover:border-white/30 text-white/90"
                        }`}
                      >
                        <span className="block text-[10px] font-semibold text-white/70">
                          Quad Bed
                        </span>
                        <span className="font-mono text-xs font-bold text-white">
                          {(pkg.pricing.quad / 1000000).toFixed(2)}M
                        </span>
                        <span className="block text-[9px] text-white/50">
                          {pkg.pricing.quad.toLocaleString()}
                        </span>
                      </div>

                      <div
                        onClick={() => handleSelectPackage(pkg, "triple")}
                        className={`cursor-pointer rounded-xl border p-2 transition-colors ${
                          isSelected && selectedRoomType === "triple"
                            ? "border-gold bg-gold/15 text-gold"
                            : "border-white/10 bg-white/5 hover:border-white/30 text-white/90"
                        }`}
                      >
                        <span className="block text-[10px] font-semibold text-white/70">
                          Triple Bed
                        </span>
                        <span className="font-mono text-xs font-bold text-white">
                          {(pkg.pricing.triple / 1000000).toFixed(2)}M
                        </span>
                        <span className="block text-[9px] text-white/50">
                          {pkg.pricing.triple.toLocaleString()}
                        </span>
                      </div>

                      <div
                        onClick={() => handleSelectPackage(pkg, "double")}
                        className={`cursor-pointer rounded-xl border p-2 transition-colors ${
                          isSelected && selectedRoomType === "double"
                            ? "border-gold bg-gold/15 text-gold"
                            : "border-white/10 bg-white/5 hover:border-white/30 text-white/90"
                        }`}
                      >
                        <span className="block text-[10px] font-semibold text-white/70">
                          Double Bed
                        </span>
                        <span className="font-mono text-xs font-bold text-white">
                          {(pkg.pricing.double / 1000000).toFixed(2)}M
                        </span>
                        <span className="block text-[9px] text-white/50">
                          {pkg.pricing.double.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action */}
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
                        <span>Selected · Configure Below</span>
                      </>
                    ) : (
                      <>
                        <span>Select Package</span>
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
          {/* Left: Included in Every Package (7 cols) */}
          <div className="space-y-4 lg:col-span-7">
            <div className="flex items-center gap-2 text-gold">
              <Sparkles className="size-5" />
              <h3 className="font-display text-xl font-bold text-white">
                Included in Every Hajj 2027 Package
              </h3>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Every Al Ramlah Travels pilgrim is supported end-to-end with comprehensive logistical execution and spiritual dignity.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="flex items-start gap-2">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Check className="size-3" />
                </div>
                <span>Private luxury bus (Hajj days &amp; intercity transfers)</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Check className="size-3" />
                </div>
                <span>Return air ticket included</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Check className="size-3" />
                </div>
                <span>Hotels in Madinah, Makkah &amp; Azizia</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Check className="size-3" />
                </div>
                <span>Mina &amp; Arafat camps (Maktab A / B / C category)</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Check className="size-3" />
                </div>
                <span>Buffet meals as specified on each package</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Check className="size-3" />
                </div>
                <span>Professional Hajj guide &amp; dedicated group leader</span>
              </div>
              <div className="flex items-start gap-2 sm:col-span-2">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <Check className="size-3" />
                </div>
                <span>24/7 Airport meet, greet &amp; executive ground assistance</span>
              </div>
            </div>
          </div>

          {/* Right: Additional Charges Card (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-[#D97706]/40 bg-[#FEF3C7]/10 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#F59E0B]">
                <Info className="size-4" />
                <h4 className="font-display text-base font-bold text-white">
                  Additional Charges (Not Included)
                </h4>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Package prices do not include these mandatory government &amp; optional transit charges. Please confirm current rates with our desk.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-black/40 border border-white/10 p-3">
                <span className="text-xs font-semibold text-white/90">
                  Qurbani (Mandatory Islamic Sacrifice)
                </span>
                <span className="font-mono text-sm font-extrabold text-gold">
                  PKR 55,000
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-black/40 border border-white/10 p-3">
                <span className="text-xs font-semibold text-white/90">
                  Haramain High-Speed Train Ticket
                </span>
                <span className="font-mono text-sm font-extrabold text-gold">
                  PKR 61,000
                </span>
              </div>
            </div>

            <p className="text-[10px] text-white/50 italic">
              * Charges are subject to official Saudi Ministry of Hajj &amp; SAR railway tariff confirmations at booking time.
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* REQUIREMENTS & HOW TO BOOK (PDF PAGE 7)                  */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 6 Required Documents (7 cols) */}
          <div className="lg:col-span-7 rounded-3xl border border-white/15 bg-black/35 p-6 sm:p-8 backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-gold" />
              <h3 className="font-display text-xl font-bold text-white">
                6 Required Documents for Hajj 2027
              </h3>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              To secure your registration with the Ministry of Hajj and Nusuk system, please prepare original and digital copies of:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                <span className="font-mono text-[10px] font-bold text-gold">01</span>
                <h4 className="font-bold text-white">Pakistani Passport</h4>
                <p className="text-[11px] text-white/70">
                  Machine-readable passport valid until December 2027 or later.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                <span className="font-mono text-[10px] font-bold text-gold">02</span>
                <h4 className="font-bold text-white">Valid CNIC / B-Form</h4>
                <p className="text-[11px] text-white/70">
                  NADRA Smart National ID Card or NADRA B-Form for minors.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                <span className="font-mono text-[10px] font-bold text-gold">03</span>
                <h4 className="font-bold text-white">Postal &amp; Contact Info</h4>
                <p className="text-[11px] text-white/70">
                  Complete permanent residential postal address and active phone/WhatsApp.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                <span className="font-mono text-[10px] font-bold text-gold">04</span>
                <h4 className="font-bold text-white">Next of Kin Details</h4>
                <p className="text-[11px] text-white/70">
                  Next of kin&apos;s CNIC, verified relationship, and contact numbers.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                <span className="font-mono text-[10px] font-bold text-gold">05</span>
                <h4 className="font-bold text-white">Passport Photograph</h4>
                <p className="text-[11px] text-white/70">
                  Recent 4 × 3 cm photograph with clean white background.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                <span className="font-mono text-[10px] font-bold text-gold">06</span>
                <h4 className="font-bold text-white">Blood Group</h4>
                <p className="text-[11px] text-white/70">
                  Official clinical report or driving license recording applicant&apos;s blood group.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Steps to Book (5 cols) */}
          <div className="lg:col-span-5 rounded-3xl border border-gold/30 bg-gradient-to-br from-[#0A3622] to-black/60 p-6 sm:p-8 backdrop-blur-xl space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <UserCheck className="size-5 text-gold" />
                <h3 className="font-display text-xl font-bold text-white">
                  How to Book in 3 Simple Steps
                </h3>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Secure your family&apos;s sacred Hajj reservation with personalized executive support.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold font-mono text-xs font-black text-emerald-950">
                    1
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-white">Choose Your Package</h4>
                    <p className="text-xs text-white/70">
                      Pick your preferred Maktab (A, B, or C), duration, and room type (Quad, Triple, or Double).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold font-mono text-xs font-black text-emerald-950">
                    2
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-white">Share Documents</h4>
                    <p className="text-xs text-white/70">
                      Send your 6 mandatory documents via WhatsApp or visit our Lahore office.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold font-mono text-xs font-black text-emerald-950">
                    3
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-white">Confirm Your Seat</h4>
                    <p className="text-xs text-white/70">
                      Our Hajj directors verify your quota allotment and finalize your booking agreement.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gold/30 bg-black/40 p-3 text-center">
              <span className="text-[11px] font-semibold text-gold block">
                Direct Hotline: 03274029701 · 03190462638
              </span>
              <span className="text-[10px] text-white/60">
                Monday to Saturday: 9:00 AM to 8:00 PM PKT
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* INTERACTIVE HAJJ RESERVATION INQUIRY FORM                */}
        {/* ======================================================== */}
        <div
          id="hajj-reservation-card"
          className="mx-auto max-w-4xl rounded-3xl border-2 border-gold/40 bg-black/60 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl space-y-8 scroll-mt-20"
        >
          {confirmedResult ? (
            <div className="space-y-6 py-6 text-center animate-in fade-in-50 duration-300">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-gold/20 text-gold border-2 border-gold/50">
                <CheckCircle2 className="size-9" />
              </div>

              <div className="space-y-2">
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Hajj 2027 Reservation Inquiry Dispatched
                </h3>
                <p className="text-sm text-white/80 max-w-md mx-auto">
                  Your reservation request for <strong className="text-gold">{confirmedResult.selectedPkgTitle}</strong> has been assigned to our Senior Hajj Director.
                </p>
              </div>

              <div className="mx-auto max-w-sm rounded-2xl border border-gold/40 bg-[#041D12] p-5 space-y-1 shadow-lg">
                <span className="text-[11px] font-semibold text-gold uppercase tracking-wider block">
                  Confidential Application Reference
                </span>
                <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white tracking-wider">
                  {confirmedResult.referenceNumber}
                </div>
              </div>

              <p className="text-xs text-white/70 max-w-md mx-auto leading-relaxed">
                Due to Saudi quota and Maktab room assignments, our director will contact you via WhatsApp and phone to verify your Pakistani passports and confirm seat allotment.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={
                    confirmedResult.whatsappUrl ||
                    `https://wa.me/${agencyWhatsapp.replace(/\D/g, "").replace(/^03/, "923") || "923274029701"}?text=${encodeURIComponent(
                      `As-salamu alaykum Al Ramlah Travels, I have submitted Hajj 2027 reservation inquiry ${confirmedResult.referenceNumber} for ${activePackage.title}. Please connect me with the Senior Hajj Director.`
                    )}`
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
                  onClick={() => setConfirmedResult(null)}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  Submit Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Selected Package Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/15 pb-5">
                <div>
                  <span className="text-xs font-bold text-gold uppercase tracking-wider block">
                    Selected Hajj 2027 Package
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                    Maktab {activePackage.maktab} · {activePackage.title}
                  </h3>
                  <p className="text-xs text-white/70 mt-1">
                    {activePackage.camps} · {activePackage.duration}
                  </p>
                </div>

                {/* Selected Room Pill */}
                <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-right">
                  <span className="block text-[10px] font-semibold uppercase text-gold">
                    {selectedRoomType.toUpperCase()} BED RATE
                  </span>
                  <span className="font-mono text-lg font-black text-white">
                    PKR {activePackage.pricing[selectedRoomType].toLocaleString()}
                  </span>
                  <span className="block text-[9px] text-white/60">per person</span>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-950/80 border border-red-500/50 p-4 text-xs text-red-200">
                  {error}
                </div>
              )}

              {/* Room Selection Switcher */}
              <div className="space-y-2">
                <Label className="text-xs text-white/90">
                  Choose Room Accommodation Category *
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRoomType("quad")}
                    className={`rounded-xl border p-3 text-center transition-all ${
                      selectedRoomType === "quad"
                        ? "border-gold bg-gold/20 text-gold ring-1 ring-gold"
                        : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span className="block text-xs font-bold">Quad (4-Bed)</span>
                    <span className="font-mono text-xs font-semibold text-white block mt-0.5">
                      PKR {activePackage.pricing.quad.toLocaleString()}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRoomType("triple")}
                    className={`rounded-xl border p-3 text-center transition-all ${
                      selectedRoomType === "triple"
                        ? "border-gold bg-gold/20 text-gold ring-1 ring-gold"
                        : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span className="block text-xs font-bold">Triple (3-Bed)</span>
                    <span className="font-mono text-xs font-semibold text-white block mt-0.5">
                      PKR {activePackage.pricing.triple.toLocaleString()}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRoomType("double")}
                    className={`rounded-xl border p-3 text-center transition-all ${
                      selectedRoomType === "double"
                        ? "border-gold bg-gold/20 text-gold ring-1 ring-gold"
                        : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span className="block text-xs font-bold">Double (2-Bed)</span>
                    <span className="font-mono text-xs font-semibold text-white block mt-0.5">
                      PKR {activePackage.pricing.double.toLocaleString()}
                    </span>
                  </button>
                </div>
              </div>

              {/* Lead Pilgrim Name & City */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="h-name" className="text-xs text-white/90">
                    Lead Pilgrim Full Name *
                  </Label>
                  <Input
                    id="h-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Al-Haj Tariq Mansoor"
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-city" className="text-xs text-white/90">
                    City in Pakistan *
                  </Label>
                  {departureCities && departureCities.length > 0 ? (
                    <select
                      id="h-city"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      className="w-full rounded-md border border-white/20 bg-[#062417] px-3 py-2 text-sm text-white focus:border-gold focus:outline-none"
                      required
                    >
                      {departureCities.map((c) => (
                        <option
                          key={c.airportCode}
                          value={c.cityName}
                          className="bg-[#062417] text-white"
                        >
                          {c.cityName} ({c.airportCode})
                        </option>
                      ))}
                      <option value="Lahore" className="bg-[#062417] text-white">
                        Lahore
                      </option>
                      <option value="Islamabad / Rawalpindi" className="bg-[#062417] text-white">
                        Islamabad / Rawalpindi
                      </option>
                      <option value="Karachi" className="bg-[#062417] text-white">
                        Karachi
                      </option>
                      <option value="Faisalabad" className="bg-[#062417] text-white">
                        Faisalabad
                      </option>
                      <option value="Multan" className="bg-[#062417] text-white">
                        Multan
                      </option>
                      <option value="Peshawar" className="bg-[#062417] text-white">
                        Peshawar
                      </option>
                      <option value="Other" className="bg-[#062417] text-white">
                        Other City in Pakistan
                      </option>
                    </select>
                  ) : (
                    <Input
                      id="h-city"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      placeholder="e.g. Lahore / Islamabad / Karachi"
                      className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                      required
                    />
                  )}
                </div>
              </div>

              {/* Phone & WhatsApp */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="h-phone" className="text-xs text-white/90">
                    Phone Number *
                  </Label>
                  <Input
                    id="h-phone"
                    value={customerPhone}
                    onChange={(e) => syncPhone(e.target.value)}
                    placeholder="0327 4029701"
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-wa" className="text-xs text-white/90">
                    WhatsApp Number *
                  </Label>
                  <Input
                    id="h-wa"
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    placeholder="0327 4029701"
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                    required
                  />
                </div>
              </div>

              {/* Email & Blood Group */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="h-email" className="text-xs text-white/90">
                    Email Address (Optional)
                  </Label>
                  <Input
                    id="h-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="tariq@example.com"
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-blood" className="text-xs text-white/90">
                    Applicant Blood Group (Document #6)
                  </Label>
                  <select
                    id="h-blood"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full rounded-md border border-white/20 bg-[#062417] px-3 py-2 text-sm text-white focus:border-gold focus:outline-none"
                  >
                    <option value="" className="bg-[#062417] text-white">Select Blood Group (Optional)</option>
                    <option value="A+" className="bg-[#062417] text-white">A+</option>
                    <option value="A-" className="bg-[#062417] text-white">A-</option>
                    <option value="B+" className="bg-[#062417] text-white">B+</option>
                    <option value="B-" className="bg-[#062417] text-white">B-</option>
                    <option value="AB+" className="bg-[#062417] text-white">AB+</option>
                    <option value="AB-" className="bg-[#062417] text-white">AB-</option>
                    <option value="O+" className="bg-[#062417] text-white">O+</option>
                    <option value="O-" className="bg-[#062417] text-white">O-</option>
                  </select>
                </div>
              </div>

              {/* Travellers Grid: Adults, Children, Infants */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="h-adults" className="text-xs text-white/90">
                    Adults (12+ yrs) *
                  </Label>
                  <Input
                    id="h-adults"
                    type="number"
                    min={1}
                    max={30}
                    value={adults}
                    onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
                    className="border-white/20 bg-white/10 text-white focus:border-gold"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-children" className="text-xs text-white/90">
                    Children (2–11 yrs)
                  </Label>
                  <Input
                    id="h-children"
                    type="number"
                    min={0}
                    max={20}
                    value={children}
                    onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))}
                    className="border-white/20 bg-white/10 text-white focus:border-gold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-infants" className="text-xs text-white/90">
                    Infants (&lt;2 yrs)
                  </Label>
                  <Input
                    id="h-infants"
                    type="number"
                    min={0}
                    max={10}
                    value={infants}
                    onChange={(e) => setInfants(Math.max(0, Number(e.target.value) || 0))}
                    className="border-white/20 bg-white/10 text-white focus:border-gold"
                  />
                </div>
              </div>

              {/* Add-on Checkboxes: Qurbani & Train Ticket */}
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
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
                    <label htmlFor="opt-qurbani" className="text-xs text-white cursor-pointer">
                      Include Official Islamic Qurbani / Adahi Arrangement
                    </label>
                  </div>
                  <span className="font-mono text-xs font-bold text-gold">
                    +PKR 55,000 / person
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
                    <label htmlFor="opt-train" className="text-xs text-white cursor-pointer">
                      Haramain High-Speed Train Intercity Transit
                    </label>
                  </div>
                  <span className="font-mono text-xs font-bold text-gold">
                    +PKR 61,000 / person
                  </span>
                </div>
              </div>

              {/* Special Inquiries or Nusuk requests */}
              <div className="space-y-1.5">
                <Label htmlFor="h-notes" className="text-xs text-white/90">
                  Special Accommodation, Elderly Care or Nusuk Inquiries
                </Label>
                <Textarea
                  id="h-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tell us about elderly family members, wheelchair assistance, next of kin contact info, or preferred departure airport..."
                  className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2 bg-gold py-3 text-sm sm:text-base font-bold text-emerald-950 hover:bg-gold/90 shadow-xl shadow-gold/20"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                <span>Confirm &amp; Reserve Hajj 2027 Seat</span>
              </Button>

              {/* Direct Booking Helpline */}
              <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-white/70">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-gold shrink-0" />
                  <span>Where Purpose Meets Excellence · Dedicated Hajj Operations Desk</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-3.5 text-gold shrink-0" />
                  <span className="font-mono text-gold font-bold">03274029701 · 03190462638</span>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
