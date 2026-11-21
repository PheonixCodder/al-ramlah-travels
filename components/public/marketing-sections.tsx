import * as React from "react"
import Link from "next/link"
import { FaqAccordionClient } from "@/components/public/faq-accordion-client"
import {
  QuotingTimelineClient,
  ZiyaratShowcaseClient,
} from "@/components/public/marketing-client-islands"
import { TrustHomeOverview } from "@/components/seo/trust-home-overview"
import {
  ArrowRight,
  Building2,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck,
  ShieldCheck,
  Star,
} from "lucide-react"

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
      "https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "z-3",
    city: "makkah",
    name: "Mashair Plains: Mina, Muzdalifah & Arafat",
    arabicName: "المشاعر المقدسة: منى ومزدلفة وعرفات",
    description:
      "Scholar-guided circuit across the historic Hajj valleys, viewing Masjid Namirah and Jabal al-Rahmah on the Plain of Arafat.",
    imageUrl:
      "https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "z-4",
    city: "madinah",
    name: "Masjid Quba",
    arabicName: "مسجد قباء",
    description:
      "The first mosque founded in Islamic history. Offering two rak'ahs of prayer here carries the reward of a complete Umrah.",
    imageUrl:
      "https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "z-5",
    city: "madinah",
    name: "Mount Uhud & Martyrs' Cemetery",
    arabicName: "جبل أحد ومقبرة الشهداء",
    description:
      "The mountain ridge north of Madinah holding Archers' Hill and the resting place of Sayyiduna Hamza (RA) and the martyrs of Uhud.",
    imageUrl:
      "https://images.unsplash.com/photo-1575101261474-5cb5653bb416?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "z-6",
    city: "madinah",
    name: "Masjid al-Qiblatayn",
    arabicName: "مسجد القبلتين",
    description:
      "The Mosque of the Two Qiblahs in northwestern Madinah where divine revelation directed prayer toward the Holy Kaaba in Makkah.",
    imageUrl:
      "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&q=80&w=800",
  },
]

export const DEFAULT_HOME_FAQS: FaqPreviewItem[] = [
  {
    id: "f-1",
    category: "visa",
    question: "How is the Umrah visa duration calculated for our journey?",
    answer:
      "Our system automatically compares your KSA Arrival Date and KSA Departure Date. Stays up to 30 days are automatically assigned the Short-Term Umrah tariff, while stays beyond 30 days (up to 90 days) receive the extended Long-Term tariff. You never have to guess or choose visa tiers manually.",
  },
  {
    id: "f-2",
    category: "hotels",
    question: "Do infants require their own hotel bed or transport seat?",
    answer:
      "Under Saudi hospitality rules, infants under 2 years require their own Umrah visa and infant airline ticket, but count as 0 hotel beds and 0 vehicle seats. Hotel bed capacities and fleet vehicle seats are strictly calculated for Adults + Children (2–11 years).",
  },
  {
    id: "f-3",
    category: "general",
    question:
      "Why does the Custom Planner show a Live Itinerary Summary rather than a static checkout price?",
    answer:
      "Unlike rigid pre-packaged tours, volatile services such as direct flights, 5-star Haram courtyard dates, and Haramain train transfers fluctuate daily based on Saudi availability. To protect you from inflated pricing buffers, our ticketing directors verify live allotments within 24 hours and issue a guaranteed, itemized PKR quote worksheet.",
  },
  {
    id: "f-4",
    category: "transport",
    question: "Can we start our Umrah itinerary directly in Makkah?",
    answer:
      "Yes. Because Makkah does not have an international airport, itineraries beginning in Makkah automatically designate King Abdulaziz International Airport in Jeddah (JED) as your entry gateway, paired with private ground transfer directly to your Makkah hotel.",
  },
  {
    id: "f-5",
    category: "hajj",
    question:
      "How does pre-registration work under the Hajj 2027 Indicative Package Guide?",
    answer:
      "Our Hajj 2027 Guide presents non-binding indicative Maktab A+, Maktab A, Maktab B, and Maktab C structures across 10, 14, and 20/22 day durations for both resident and overseas Pakistani families. Submit your pre-registration inquiry and our Hajj directors will contact you as soon as official Ministry of Religious Affairs (MoRA) and Saudi Nusuk quotas are announced.",
  },
]

/**
 * Resolves the exact visible FAQ array rendered on `/` so `MarketingSections` DOM
 * and `buildFaqPageJsonLd(homeFaqs)` in `app/(public)/page.tsx` maintain strict 1:1 parity (`SEO-023`).
 */
export function resolveHomeFaqs(
  faqs?: ReadonlyArray<FaqPreviewItem>
): FaqPreviewItem[] {
  const valid = (faqs ?? [])
    .map((item, idx) => ({
      id: item.id || `home-faq-${idx}`,
      category: item.category || "general",
      question: (item.question || "").trim(),
      answer: (item.answer || "").trim(),
    }))
    .filter((item) => item.question.length > 0 && item.answer.length > 0)

  return valid.length > 0 ? valid.slice(0, 10) : DEFAULT_HOME_FAQS
}

/**
 * Server Component marketing & GEO overview section (`SEO-023`, `S03-001`, `Spec 0026`).
 * Delegates interactive timeline scrubbing, tabbed Ziyarat filtering, and FAQ collapse state
 * to clean client islands while preserving 100% SSR HTML visibility and `GB-04`/`GB-06` parity.
 */
export function MarketingSections({
  ziyaratSites = [],
  testimonials = [],
  faqs = [],
}: MarketingSectionsProps) {
  const activeZiyarat =
    ziyaratSites.length > 0 ? ziyaratSites : DEFAULT_ZIYARAT
  // T-056: Render testimonials strictly from verified DB rows; never fabricate fallback reviews
  const verifiedTestimonials = testimonials
  const activeFaqs = resolveHomeFaqs(faqs)

  return (
    <div className="flex w-full min-w-0 flex-col bg-background">
      {/* ======================================================== */}
      {/* 0. AT-A-GLANCE HARAMAIN SERVICE & BOOKING RULES SPLIT    */}
      {/* ======================================================== */}
      <TrustHomeOverview />

      {/* ======================================================== */}
      {/* 1. ASYMMETRIC WHY FAMILIES CHOOSE AL RAMLAH              */}
      {/* ======================================================== */}
      <section
        aria-labelledby="why-alramlah-heading"
        className="border-t border-border bg-secondary/45 py-12 sm:py-16"
      >
        <div className="mx-auto grid w-full min-w-0 max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8">
          <div className="flex flex-col gap-4 self-start lg:sticky lg:top-24 lg:col-span-4">
            <h2
              id="why-alramlah-heading"
              className="font-display text-2xl font-bold tracking-tight text-primary text-balance sm:text-3xl lg:text-4xl"
            >
              Why Pakistani &amp; Diaspora Families Choose Al Ramlah Travels
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              From our Askari 10, Lahore Cantt concierge desk to Makkah and
              Madinah courtyards, every itinerary is structured for elderly
              comfort, clear PKR accounting, and unhurried worship.
            </p>
            <div className="flex flex-col gap-2 border-t border-border pt-3 text-xs font-semibold sm:text-sm">
              <Link
                href="/#journey-builder"
                className="inline-flex min-h-7 items-center gap-1.5 text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
              >
                <span>Design a Custom Umrah Itinerary</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/umrah-packages"
                className="inline-flex min-h-7 items-center gap-1.5 text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
              >
                <span>Compare Fixed Group Umrah Packages</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-8">
            <article className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Building2
                  className="size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Walking-Distance Courtyard Hotels
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Avoid steep uphill walks and shuttle queues with elderly
                parents. Compare 0 to 50m Clock Tower suites in{" "}
                <Link
                  href="/hotels/makkah"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                >
                  Makkah
                </Link>{" "}
                and flat Markaziyah hotels near Ladies Gate 25 in{" "}
                <Link
                  href="/hotels/madinah"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                >
                  Madinah
                </Link>
                .
              </p>
              <p className="mt-auto text-xs font-medium text-gold-text">
                Wheelchair-friendly routes with zero shuttle waiting
              </p>
            </article>

            <article className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Clock
                  className="size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <h3 className="font-display text-lg font-semibold text-foreground">
                  24-Hour PKR Quote SLA
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Submit your custom itinerary and receive an itemized,
                line-by-line PKR quotation verified by our Lahore Cantt
                ticketing directors within 24 hours.
              </p>
              <p className="mt-auto text-xs font-medium text-gold-text">
                Issued with an ART tracking code for live verification
              </p>
            </article>

            <article className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck
                  className="size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Official Saudi Umrah E-Visas
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Electronic KSA visa issuance with mandatory Saudi medical
                insurance, Nusuk Masar hotel linking, and{" "}
                <Link
                  href="/umrah-visa"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                >
                  fixed Visa-Only PKR rates
                </Link>
                .
              </p>
              <p className="mt-auto text-xs font-medium text-gold-text">
                Automatic 30-day vs 90-day duration calculation
              </p>
            </article>

            <article className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Car
                  className="size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Private GMC &amp; HiAce Fleet
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Executive sedans, GMC Yukon SUVs, and Toyota HiAce vans with
                Urdu and English speaking drivers greeting your family at
                Jeddah (JED) or Madinah (MED) airport.
              </p>
              <p className="mt-auto text-xs font-medium text-gold-text">
                Haramain High-Speed Rail options on eligible sectors
              </p>
            </article>

            <article className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <FileCheck
                  className="size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Transparent PKR Accounting
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Compare published{" "}
                <Link
                  href="/umrah-packages"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                >
                  Group Umrah PKR tiers
                </Link>{" "}
                or custom worksheets itemizing every visa, flight, hotel stay,
                and transfer before deposit.
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-3 text-xs font-semibold text-primary">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  <span>Clear SAR-to-PKR Lock</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  <span>Verified Askari 10 HQ</span>
                </span>
              </div>
            </article>

            <article className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Compass
                  className="size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Scholar-Guided Ziyarat Tours
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Curated heritage visits to Jabal Al-Nour, Ghar-e-Thawr, Masjid
                Quba, Mount Uhud, Badr, and Taif through our{" "}
                <Link
                  href="/ziyarat"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                >
                  Haramain Ziyarat Guide
                </Link>
                .
              </p>
              <p className="mt-auto text-xs font-medium text-gold-text">
                Morning and afternoon private family schedules
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. AUTHORED GSAP SCROLLTRIGGER 4-STEP QUOTING TIMELINE   */}
      {/* ======================================================== */}
      <QuotingTimelineClient />

      {/* ======================================================== */}
      {/* 3. TABBED MAKKAH & MADINAH ZIYARAT SHOWCASE (`#ziyarat`) */}
      {/* ======================================================== */}
      <ZiyaratShowcaseClient sites={activeZiyarat} />

      {/* ======================================================== */}
      {/* 4. VERIFIED PILGRIM TESTIMONIALS (`T-056` — DB-ONLY)     */}
      {/* ======================================================== */}
      {verifiedTestimonials.length > 0 && (
        <section
          aria-labelledby="verified-testimonials-heading"
          className="border-t border-border bg-background py-12 sm:py-16"
        >
          <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
            <div className="flex max-w-3xl flex-col gap-2">
              <h2
                id="verified-testimonials-heading"
                className="font-display text-2xl font-bold tracking-tight text-primary text-balance sm:text-3xl lg:text-4xl"
              >
                Cherished Words from Our Pilgrims
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                Read verified experiences from families who entrusted Al Ramlah
                Travels with their sacred journeys.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {verifiedTestimonials.map((t) => (
                <article
                  key={t.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs"
                >
                  <div className="flex flex-col gap-3">
                    <div
                      className="flex items-center gap-1 text-gold-text"
                      aria-label={`${t.rating} out of 5 stars`}
                    >
                      {Array.from({
                        length: Math.max(1, Math.min(5, t.rating)),
                      }).map((_, i) => (
                        <Star
                          key={i}
                          className="size-4 fill-gold text-gold"
                          aria-hidden="true"
                        />
                      ))}
                    </div>

                    <p className="text-sm leading-relaxed text-foreground">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  </div>

                  <div className="border-t border-border pt-3">
                    <h3 className="text-sm font-bold text-foreground">
                      {t.pilgrimName}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t.city}, {t.packageOrJourneyType}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 5. 2-COLUMN EDITORIAL FAQ (`keepMounted` 1:1 PARITY)     */}
      {/* ======================================================== */}
      <section
        id="faq"
        aria-labelledby="home-faq-heading"
        className={`w-full scroll-mt-20 border-t border-border py-12 sm:py-16 ${
          verifiedTestimonials.length > 0 ? "bg-secondary/45" : "bg-background"
        }`}
      >
        <div className="mx-auto grid w-full min-w-0 max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:items-start lg:px-8">
          <div className="flex flex-col gap-4 lg:col-span-4">
            <h2
              id="home-faq-heading"
              className="font-display text-2xl font-bold tracking-tight text-primary text-balance sm:text-3xl lg:text-4xl"
            >
              Frequently Asked Questions on Umrah, Visas &amp; Hajj 2027
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Essential answers on Saudi visa duration rules, infant bed
              allotments, Jeddah to Makkah transfers, and 24-hour PKR quoting.
            </p>
            <div className="flex flex-col gap-2 border-t border-border pt-3 text-xs font-semibold sm:text-sm">
              <Link
                href="/faq"
                className="inline-flex min-h-7 items-center gap-1.5 text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
              >
                <span>Explore All Categorized Umrah &amp; Hajj FAQs</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-7 items-center text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
              >
                Ask Our Askari 10 Lahore Desk
              </Link>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-8">
            <FaqAccordionClient faqs={activeFaqs} />
          </div>
        </div>
      </section>
    </div>
  )
}
