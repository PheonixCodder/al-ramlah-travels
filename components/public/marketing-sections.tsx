"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import {
  ShieldCheck,
  Building2,
  Clock,
  Car,
  Compass,
  FileCheck,
  Star,
  ArrowRight,
  CheckCircle2,
  MapPin,
} from "lucide-react"

// Types
export interface ZiyaratPreviewItem {
  id: string
  city: "makkah" | "madinah"
  name: string
  arabicName: string
  description: string
  imageUrl?: string | null
}

export interface TestimonialPreviewItem {
  id: string
  pilgrimName: string
  city: string
  quote: string
  packageOrJourneyType: string
  rating: number
  avatarUrl?: string | null
}

export interface FaqPreviewItem {
  id: string
  category: string
  question: string
  answer: string
}

interface MarketingSectionsProps {
  ziyaratSites?: ZiyaratPreviewItem[]
  testimonials?: TestimonialPreviewItem[]
  faqs?: FaqPreviewItem[]
}

const DEFAULT_ZIYARAT: ZiyaratPreviewItem[] = [
  {
    id: "z-1",
    city: "makkah",
    name: "Cave of Hira (Jabal Al-Nour)",
    arabicName: "غار حراء - جبل النور",
    description:
      "The sacred summit where the Prophet Muhammad ﷺ received the very first revelation of the Holy Qur'an through Angel Jibreel (AS).",
    imageUrl:
      "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "z-2",
    city: "makkah",
    name: "Cave of Thawr (Jabal Thawr)",
    arabicName: "غار ثور",
    description:
      "The miraculous sanctuary where the Prophet ﷺ and Abu Bakr As-Siddiq (RA) took refuge during the historic Hijrah migration.",
    imageUrl:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "z-3",
    city: "madinah",
    name: "Masjid Quba",
    arabicName: "مسجد قباء",
    description:
      "The first mosque founded in Islamic history. Offering two rak'ahs of prayer here carries the reward of a complete Umrah.",
    imageUrl:
      "https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "z-4",
    city: "madinah",
    name: "Mount Uhud & Martyrs' Cemetery",
    arabicName: "جبل أحد ومقبرة الشهداء",
    description:
      "'A mountain that loves us and we love it.' The site of the historic Battle of Uhud and the resting place of Sayyiduna Hamza (RA).",
    imageUrl:
      "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&q=80&w=800",
  },
]

const DEFAULT_TESTIMONIALS: TestimonialPreviewItem[] = [
  {
    id: "t-1",
    pilgrimName: "Dr. Salman Tariq & Family",
    city: "Lahore",
    quote:
      "Having our hotel directly across from King Abdulaziz Gate in Makkah made all the difference with our elderly parents. The private GMC transfer from Jeddah airport was waiting for us as soon as we exited customs. Flawless execution.",
    packageOrJourneyType: "Custom Family Umrah (14 Days)",
    rating: 5,
  },
  {
    id: "t-2",
    pilgrimName: "Al-Haj Zubair Chaudhry",
    city: "Islamabad",
    quote:
      "Al Ramlah Travels handled our entire group departure from Islamabad with Saudia flights. The seat progress tracking and fixed quad rate gave our extended family complete peace of mind. May Allah reward your team.",
    packageOrJourneyType: "VIP 5-Star Group Umrah",
    rating: 5,
  },
  {
    id: "t-3",
    pilgrimName: "Mrs. Naila Rizwan",
    city: "Karachi",
    quote:
      "The 24h itemized quote worksheet was transparent to the single Rupee. No surprise airport surcharges, no hidden shuttle fees. Truly sacred luxury crafted with dignity.",
    packageOrJourneyType: "Custom Couple's Umrah (10 Days)",
    rating: 5,
  },
]

const DEFAULT_FAQS: FaqPreviewItem[] = [
  {
    id: "f-1",
    category: "visa",
    question: "How is the Umrah visa duration calculated for our journey?",
    answer:
      "Our system automatically compares your KSA Arrival Date and KSA Departure Date. Stays up to 30 days are automatically assigned the Short-Term tourist/umrah rate, while stays beyond 30 days (up to 90 days) receive the extended Long-Term rate. You never have to guess or choose tiers manually.",
  },
  {
    id: "f-2",
    category: "hotels",
    question: "Do infants require their own hotel bed or transport seat?",
    answer:
      "Under Saudi hospitality rules, infants under 2 years require their own visa and infant airline ticket, but count as 0 hotel beds and 0 vehicle seats. Hotel bed capacities and fleet vehicle seats are strictly calculated for Adults + Children (2-11 years).",
  },
  {
    id: "f-3",
    category: "general",
    question: "Why does the Custom Planner show a Live Itinerary Summary rather than fixed checkout?",
    answer:
      "Unlike rigid pre-packaged tours, volatile services such as direct flights, 5-star hotel dates, and bullet train transfers fluctuate daily based on Saudi availability. To protect you from inflated pricing buffers, our ticketing directors verify live allotments within 24 hours and issue a guaranteed, itemized quote worksheet.",
  },
  {
    id: "f-4",
    category: "transport",
    question: "Can we start our Umrah itinerary directly in Makkah?",
    answer:
      "Yes. Because Makkah does not have an international airport, itineraries beginning in Makkah automatically designate King Abdulaziz International Airport in Jeddah (JED) as your entry gateway, with immediate private transfer directly to your Makkah hotel.",
  },
  {
    id: "f-5",
    category: "hajj",
    question: "How do I secure a VIP Mina tent for Hajj 1447H / 2026?",
    answer:
      "Hajj operations are governed strictly by the Saudi Nusuk platform and official Ministry quotas. We provide confidential executive consultations for VIP Majar Al-Kabsh gypsum tents and near-Jamarat building accommodations to guide your family through mandatory quota verification without unauthorized online checkouts.",
  },
]

export function MarketingSections({
  ziyaratSites = [],
  testimonials = [],
  faqs = [],
}: MarketingSectionsProps) {
  const activeZiyarat =
    ziyaratSites.length > 0 ? ziyaratSites : DEFAULT_ZIYARAT
  const activeTestimonials =
    testimonials.length > 0 ? testimonials : DEFAULT_TESTIMONIALS
  const activeFaqs = faqs.length > 0 ? faqs : DEFAULT_FAQS

  return (
    <div className="space-y-28 py-16 bg-background">
      {/* ======================================================== */}
      {/* 1. WHY PILGRIMS CHOOSE AL RAMLAH (LUXURY BENTO GRID)     */}
      {/* ======================================================== */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs uppercase tracking-wider font-semibold">
            Sacred Luxury Standard
          </Badge>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Why Pilgrims Choose Al Ramlah
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Every element of your pilgrimage is engineered for serenity, physical dignity, and spiritual focus.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {/* Bento Item 1: Courtyard Proximity (Large 2-col) */}
          <div className="md:col-span-2 rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-8 shadow-xs space-y-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Building2 className="size-6" />
            </div>
            <h3 className="font-display text-2xl font-bold text-foreground">
              50-Meter Courtyard Luxury Properties
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Never wait for crowded shuttle buses or navigate steep hills with elderly parents. We prioritize iconic properties such as Makkah Clock Royal Tower (Fairmont) and Dar Al Taqwa in Madinah, located footsteps from the sanctuary courtyards.
            </p>
            <div className="flex flex-wrap gap-2 pt-2 text-xs font-semibold text-emerald-800">
              <span className="rounded-md bg-emerald-100/80 px-2.5 py-1">
                Zero Shuttle Wait
              </span>
              <span className="rounded-md bg-emerald-100/80 px-2.5 py-1">
                Direct Kaaba Views
              </span>
              <span className="rounded-md bg-emerald-100/80 px-2.5 py-1">
                Wheelchair Accessible
              </span>
            </div>
          </div>

          {/* Bento Item 2: Guaranteed 24h Quoting SLA */}
          <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-8 shadow-xs space-y-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 border border-amber-200">
              <Clock className="size-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">
              24-Hour Quote SLA
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Submit your bespoke custom itinerary and receive an itemized, transparent PKR worksheet confirmed by our senior ticketing director within 24 hours.
            </p>
          </div>

          {/* Bento Item 3: Ministry License & Compliance */}
          <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-8 shadow-xs space-y-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="size-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">
              Ministry Licensed #4082
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Authorized by both the Ministry of Religious Affairs (MORA) Pakistan and Saudi Arabia&apos;s Nusuk electronic system for rapid visa issuance.
            </p>
          </div>

          {/* Bento Item 4: Private Fleet */}
          <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-8 shadow-xs space-y-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Car className="size-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">
              Private GMC Fleet
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Executive SUVs and Toyota HiAce vans with dedicated English and Urdu speaking drivers waiting for your family upon arrival.
            </p>
          </div>

          {/* Bento Item 5: Transparent Pricing (Large 2-col) */}
          <div className="md:col-span-2 rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-8 shadow-xs space-y-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30">
              <FileCheck className="size-6" />
            </div>
            <h3 className="font-display text-2xl font-bold text-foreground">
              Transparent Pricing & Zero Hidden Surcharges
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              In Visa Only mode, you see an immediate guaranteed PKR total calculated per passport. In custom journeys, every hotel night, vehicle leg, and visa fee is itemized line by line in your worksheet.
            </p>
            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <CheckCircle2 className="size-4 text-emerald-600" /> No Currency Exchange Surprises
              </span>
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <CheckCircle2 className="size-4 text-emerald-600" /> Locked Flight Fares
              </span>
            </div>
          </div>

          {/* Bento Item 6: Guided Historical Ziyarat */}
          <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-8 shadow-xs space-y-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 border border-amber-200">
              <Compass className="size-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">
              Sacred Heritage Tours
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Comprehensive visits to the Cave of Hira, Thawr, Masjid Quba, and Mount Uhud guided by certified Islamic scholars.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. HOW OUR LIVE QUOTING WORKS (4-STEP TIMELINE)          */}
      {/* ======================================================== */}
      <section className="bg-muted/30 py-20 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs uppercase tracking-wider font-semibold">
              The Al Ramlah Journey Process
            </Badge>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              How Our Live Quoting Process Works
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              From your initial design to your sacred departure, four transparent steps ensure your pilgrimage is organized without compromise.
            </p>
          </div>

          {/* 4-Step Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Step 1 */}
            <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs space-y-3">
              <span className="font-mono text-3xl font-extrabold text-gold block">
                01
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">
                Craft Your Itinerary
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose your travel dates, city sequence, room sharing preferences, preferred airline, and private vehicles in our interactive planner.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs space-y-3">
              <span className="font-mono text-3xl font-extrabold text-gold block">
                02
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">
                Automated Calculation
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The server calculates your exact Saudi visa duration tier and locks your provisional party demographics, generating your unique ART tracking reference.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs space-y-3">
              <span className="font-mono text-3xl font-extrabold text-gold block">
                03
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">
                24h Director Review
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Our ticketing director confirms live seat allotments and courtyard hotel rooms, locking in the lowest available seasonal rate on your quote worksheet.
              </p>
            </div>

            {/* Step 4 */}
            <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs space-y-3">
              <span className="font-mono text-3xl font-extrabold text-gold block">
                04
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">
                Sacred Departure
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upon quotation approval, electronic visas and flight tickets are issued with complete hotel vouchers and airport driver contact details.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. SACRED ZIYARAT SITES PREVIEW                          */}
      {/* ======================================================== */}
      <section id="ziyarat" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-3 max-w-2xl">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs uppercase tracking-wider font-semibold">
              Historical Sanctuaries
            </Badge>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Sacred Ziyarat Sites
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Immerse yourself in the footsteps of the Prophet ﷺ and the Sahabah (RA) across Makkah Al-Mukarramah and Madinah Al-Munawwarah.
            </p>
          </div>
          <Button
            variant="outline"
            render={<Link href="#journey-builder" />}
            className="gap-2 shrink-0 border-border"
          >
            <span>Include Ziyarat in Planner</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>

        {/* Ziyarat Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {activeZiyarat.map((site) => (
            <div
              key={site.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:shadow-md hover:border-gold/60"
            >
              <div>
                <div className="relative h-44 w-full bg-muted">
                  {site.imageUrl ? (
                    <Image
                      src={site.imageUrl}
                      alt={site.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <Compass className="size-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-2.5 left-2.5">
                    <Badge
                      className={`text-[10px] font-semibold capitalize ${
                        site.city === "makkah"
                          ? "bg-emerald-950/90 text-emerald-100 border-emerald-500/40"
                          : "bg-amber-950/90 text-amber-100 border-amber-500/40"
                      }`}
                    >
                      <MapPin className="size-3 mr-1" />
                      {site.city}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="font-bold text-base text-foreground leading-snug">
                    {site.name}
                  </h3>
                  <div
                    dir="rtl"
                    className="font-arabic text-sm text-gold font-medium"
                  >
                    {site.arabicName}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {site.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. PILGRIM TESTIMONIALS                                  */}
      {/* ======================================================== */}
      <section className="bg-muted/30 py-20 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs uppercase tracking-wider font-semibold">
              Authentic Pilgrim Reviews
            </Badge>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Cherished Words from Our Pilgrims
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Read verified experiences from Pakistani families who trusted Al Ramlah Travels for their sacred journeys.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {activeTestimonials.map((t) => (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-gold">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="size-4 fill-gold text-gold" />
                    ))}
                  </div>

                  <p className="text-xs sm:text-sm text-foreground italic leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                <div className="pt-4 border-t border-border/80">
                  <h4 className="font-bold text-sm text-foreground">
                    {t.pilgrimName}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {t.city} · {t.packageOrJourneyType}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. FREQUENTLY ASKED QUESTIONS (ACCORDION)                */}
      {/* ======================================================== */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs uppercase tracking-wider font-semibold">
            Common Inquiries
          </Badge>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Everything you need to know about visa validity, infant allotments, hotel bookings, and quoting SLA.
          </p>
        </div>

        <Accordion className="rounded-2xl border border-border bg-card p-2 sm:p-4 shadow-xs">
          {activeFaqs.map((faq, idx) => (
            <AccordionItem key={faq.id || idx} value={`item-${idx}`} className="px-2">
              <AccordionTrigger className="text-left font-semibold text-sm sm:text-base text-foreground hover:text-primary py-4">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  )
}
