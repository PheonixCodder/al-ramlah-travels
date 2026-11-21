import "../setup/hermetic-env"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  ContactSection,
  type AgencyContactInfo,
} from "@/components/public/contact-section"
import { FaqAccordionClient } from "@/components/public/faq-accordion-client"
import {
  GroupPackagesSection,
  type PublicGroupPackageItem,
} from "@/components/public/group-packages-section"
import {
  coerceMaktabCode,
  HajjInquirySection,
} from "@/components/public/hajj-inquiry-section"
import {
  HeroSlider,
  HOME_HERO_PRIMARY_H1,
  normalizeHeroCtaHref,
} from "@/components/public/hero-slider"
import {
  QuotingTimelineClient,
  ZiyaratShowcaseClient,
  type ZiyaratCardItem,
} from "@/components/public/marketing-client-islands"
import {
  DEFAULT_HOME_FAQS,
  MarketingSections,
  resolveHomeFaqs,
} from "@/components/public/marketing-sections"
import {
  sanitizeTrackRefParam,
  StatusTracker,
} from "@/components/public/status-tracker"
import {
  sanitizeHomePlannerCatalog,
  TrustHomeOverview,
} from "@/components/seo/trust-home-overview"
import { HAJJ_2027_REGULATORY_DISCLAIMER } from "@/components/seo/guides-hajj-data"

function buildOpenGroupPackage(
  overrides: Partial<PublicGroupPackageItem> = {}
): PublicGroupPackageItem {
  return {
    id: "pkg-ramadan-vip",
    slug: "15-days-vip-umrah-lahore",
    title: "15 Days VIP Clock Tower Umrah",
    tier: "vip_5star",
    isFeatured: true,
    durationDays: 15,
    makkahNights: 8,
    madinahNights: 6,
    sharingPricePkr: 0,
    quadPricePkr: 485000,
    triplePricePkr: 545000,
    doublePricePkr: 635000,
    infantPricePkr: 92000,
    bannerUrl: "https://images.unsplash.com/photo-1564769625905-50e93615e769",
    highlights: ["Haramain High-Speed Train", "Private GMC Transfer"],
    includesVisa: true,
    includesTransport: true,
    includesZiyarat: true,
    airline: { name: "Saudia", iataCode: "SV" },
    makkahHotel: {
      name: "Makkah Clock Royal Tower",
      starRating: 5,
      distanceLabel: "0m Courtyard",
      distanceMeters: 0,
    },
    madinahHotel: {
      name: "Anwar Al Madinah Movenpick",
      starRating: 5,
      distanceLabel: "50m Ladies Gate",
      distanceMeters: 50,
    },
    multiHotelOptions: [
      {
        pkgCode: "PKG-A",
        label: "Swissotel Makkah Tier",
        makkahHotelName: "Swissotel Makkah",
        makkahDistance: "0m",
        madinahHotelName: "Movenpick Madinah",
        madinahDistance: "50m",
        sharingPricePkr: 0,
        quadPricePkr: 485000,
        triplePricePkr: 545000,
        doublePricePkr: 635000,
      },
      {
        pkgCode: "PKG-B",
        label: "Fairmont Clock Tower Tier",
        makkahHotelName: "Fairmont Makkah",
        makkahDistance: "0m",
        madinahHotelName: "Oberoi Madinah",
        madinahDistance: "20m",
        sharingPricePkr: 0,
        quadPricePkr: 590000,
        triplePricePkr: 675000,
        doublePricePkr: 790000,
      },
    ],
    departures: [
      {
        id: "dep-lhe-open",
        batchCode: "ART-LHE-01",
        departureDate: "2099-03-15",
        returnDate: "2099-03-30",
        totalSeats: 40,
        bookedSeats: 12,
        status: "open",
        departureCity: { cityName: "Lahore", airportCode: "LHE" },
      },
    ],
    ...overrides,
  }
}

describe("HeroSlider and normalizeHeroCtaHref (Spec 0026 AC-5)", () => {
  // covers: AC-5
  it("normalizes legacy builder hashes, bare section hashes, and empty strings to canonical routes", () => {
    expect(normalizeHeroCtaHref("")).toBe("/#journey-builder")
    expect(normalizeHeroCtaHref("   ")).toBe("/#journey-builder")
    expect(normalizeHeroCtaHref("#custom-builder")).toBe("/#journey-builder")
    expect(normalizeHeroCtaHref("/#custom-builder")).toBe("/#journey-builder")
    expect(normalizeHeroCtaHref("#custom-journey")).toBe("/#journey-builder")
    expect(normalizeHeroCtaHref("/#custom-journey")).toBe("/#journey-builder")
    expect(normalizeHeroCtaHref("#hajj-inquiry")).toBe("/#hajj-inquiry")
    expect(normalizeHeroCtaHref("/umrah-packages")).toBe("/umrah-packages")
  })

  // covers: AC-4, AC-5
  it("renders single primary h1, accessible slide tabs with sr-only prefix, Slide 0 LCP media only, and 4 concierge pillars", () => {
    const html = renderToStaticMarkup(React.createElement(HeroSlider))

    expect((html.match(/<h1\b/gi) ?? []).length).toBe(1)
    expect(html).toContain(HOME_HERO_PRIMARY_H1.replace(/&/g, "&amp;"))
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html).toContain('aria-label="Previous slide"')
    expect(html).toContain('aria-label="Next slide"')
    expect(html).toContain('<span class="sr-only">Go to slide </span>')
    expect(html).toContain('aria-current="true"')
    expect((html.match(/data-hero-active-media="true"/g) ?? []).length).toBe(1)
    expect(html).toContain("LHE / KHI / ISB")
    expect(html).toContain("Askari 10 HQ")
  })

  // covers: AC-5
  it("renders custom slide copy and normalized CTA href when slides prop is provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(HeroSlider, {
        slides: [
          {
            id: "slide-custom-1",
            title: "Ramadan Last Ashra Courtyard Suites",
            subtitle: "Direct Haramain transfers from Islamabad and Lahore.",
            primaryCtaLabel: "Configure Ramadan Stay",
            primaryCtaUrl: "#custom-builder",
            imageUrl:
              "https://images.unsplash.com/photo-1564769625905-50e93615e769",
          },
        ],
      })
    )

    expect(html).toContain("Ramadan Last Ashra Courtyard Suites")
    expect(html).toContain("Configure Ramadan Stay")
    expect(html).toContain('href="/#journey-builder"')
  })
})

describe("GroupPackagesSection (Spec 0026 AC-6)", () => {
  // covers: AC-6
  it("renders empty-state seasonal announcement card when packages are empty, expired, closed, or sold out", () => {
    const soldOutAndExpired = buildOpenGroupPackage({
      departures: [
        {
          id: "dep-past",
          batchCode: "PAST-01",
          departureDate: "2020-01-01",
          returnDate: "2020-01-15",
          totalSeats: 30,
          bookedSeats: 5,
          status: "open",
        },
        {
          id: "dep-full",
          batchCode: "FULL-01",
          departureDate: "2099-05-01",
          returnDate: "2099-05-15",
          totalSeats: 30,
          bookedSeats: 30,
          status: "open",
        },
        {
          id: "dep-closed",
          batchCode: "CLSD-01",
          departureDate: "2099-06-01",
          returnDate: "2099-06-15",
          totalSeats: 30,
          bookedSeats: 10,
          status: "closed",
        },
      ],
    })

    const html = renderToStaticMarkup(
      React.createElement(GroupPackagesSection, {
        packages: [soldOutAndExpired],
        agencyWhatsapp: "+923274029701",
      })
    )

    expect(html).toContain("New Seasonal Group Departures Announcing Shortly")
    expect(html).toContain('href="/umrah-packages"')
    expect(html).toContain('href="/umrah-packages/from-lahore"')
    expect(html).toContain("wa.me/923274029701")
  })

  // covers: AC-6
  it("renders open packages inside accessible Embla carousel with gateway filter, On Request zero-tier fallback, multi-hotel badge, and modal trigger", () => {
    const pkg = buildOpenGroupPackage()
    const html = renderToStaticMarkup(
      React.createElement(GroupPackagesSection, {
        packages: [pkg],
        agencyWhatsapp: "+923274029701",
      })
    )

    expect(html).toContain('id="group-packages"')
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html).toContain('id="gp-gateway-filter"')
    expect(html).toContain("15 Days VIP Clock Tower Umrah")
    expect(html).toContain("28 seats left")
    expect(html).toContain("On Request")
    expect(html).toContain("PKR 485,000")
    expect(html).toContain("Infant")
    expect(html).toContain("PKR 92,000")
    expect(html).toContain("2 Selectable Hotel Tiers")
    expect(html).toContain("Book Package Seats")
    expect(html).toContain('href="/umrah-packages/15-days-vip-umrah-lahore"')
  })
})

describe("HajjInquirySection and coerceMaktabCode (Spec 0026 AC-7)", () => {
  // covers: AC-7
  it("coerces raw Maktab strings and tier labels deterministically to A+, A, B, or C", () => {
    expect(coerceMaktabCode("A+")).toBe("A+")
    expect(coerceMaktabCode("maktab a+ royal vip")).toBe("A+")
    expect(coerceMaktabCode("Maktab A")).toBe("A")
    expect(coerceMaktabCode("Maktab B")).toBe("B")
    expect(coerceMaktabCode("Maktab C")).toBe("C")
    expect(coerceMaktabCode("unrecognized-label")).toBe("A")
  })

  // covers: AC-7
  it("renders 4-column Maktab grid, OD-09e disclaimer, ARIA readiness tablist, and labeled #hajj-reservation-card inputs", () => {
    const html = renderToStaticMarkup(React.createElement(HajjInquirySection))

    expect(html).toContain('id="hajj-inquiry"')
    expect(html).toContain("xl:grid-cols-4")
    expect(html).toContain(HAJJ_2027_REGULATORY_DISCLAIMER.slice(0, 48))
    expect(html).toContain(
      'aria-label="Filter Hajj 2027 packages by Maktab tier"'
    )
    expect(html).toContain(
      'role="tablist" aria-label="Hajj 2027 readiness information tabs"'
    )
    expect(html).toContain('id="hajj-guide-tab-inclusions"')
    expect(html).toContain('id="hajj-guide-tab-documents"')
    expect(html).toContain('id="hajj-guide-tab-process"')
    expect(html).toContain('role="tabpanel"')
    expect(html).toContain('id="hajj-reservation-card"')
    for (const inputId of [
      "h-name",
      "h-country",
      "h-city",
      "h-phone",
      "h-wa",
      "h-email",
      "h-blood",
      "h-adults",
      "h-children",
      "h-infants",
      "opt-qurbani",
      "opt-train",
      "h-notes",
      "h-website",
    ]) {
      expect(html, `missing #${inputId}`).toContain(`id="${inputId}"`)
    }
  })

  // covers: AC-7
  it("renders quota updating notice while keeping consultation form active when hajjPackages is explicitly empty", () => {
    const html = renderToStaticMarkup(
      React.createElement(HajjInquirySection, { hajjPackages: [] })
    )

    expect(html).toContain("Hajj 2027 Tier Allotments Currently Updating")
    expect(html).toContain('id="hajj-reservation-card"')
  })
})

describe("StatusTracker and sanitizeTrackRefParam (Spec 0026 AC-8)", () => {
  // covers: AC-8
  it("sanitizes ART- tracking references and rejects non-ART prefixes, nullish values, and injection characters", () => {
    expect(sanitizeTrackRefParam("art-2026-0042")).toBe("ART-2026-0042")
    expect(sanitizeTrackRefParam("  art-9981  ")).toBe("ART-9981")
    expect(sanitizeTrackRefParam(null)).toBe("")
    expect(sanitizeTrackRefParam(undefined)).toBe("")
    expect(sanitizeTrackRefParam("")).toBe("")
    expect(sanitizeTrackRefParam("REF-2026-0042")).toBe("")
    expect(sanitizeTrackRefParam("<script>alert(1)</script>")).toBe("")
    expect(sanitizeTrackRefParam(`ART-${"9".repeat(45)}`).length).toBeLessThanOrEqual(
      32
    )
  })

  // covers: AC-8
  it("renders compact horizontal #track-status lookup bar with labeled #tracker-ref and #tracker-phone inputs", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusTracker, { agencyWhatsapp: "+923274029701" })
    )

    expect(html).toContain('id="track-status"')
    expect(html).toContain('id="tracker-ref"')
    expect(html).toContain('id="tracker-phone"')
    expect(html).toContain('for="tracker-ref"')
    expect(html).toContain('for="tracker-phone"')
    expect(html).toContain("Track Application Status")
  })
})

describe("TrustHomeOverview, MarketingSections, Islands & ContactSection (Spec 0026 AC-1, AC-9, AC-10)", () => {
  // covers: AC-1, AC-9, AC-10
  it("strips wholesale supplier SAR columns in sanitizeHomePlannerCatalog and renders accessible TrustHomeOverview ledger", () => {
    const rawHotelWithWholesaleSar = {
      id: "hotel-clock-tower",
      slug: "makkah-clock-royal-tower",
      name: "Makkah Clock Royal Tower",
      city: "makkah" as const,
      starRating: 5,
      distanceMeters: 0,
      distanceLabel: "0m Courtyard",
      accessType: "walkable" as const,
      imageUrl: "https://images.unsplash.com/photo-1564769625905-50e93615e769",
      galleryUrls: [],
      amenities: ["Kaaba View"],
      allowsSharedRooms: false,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: ["breakfast", "half_board"],
      validFrom: null,
      validUntil: null,
      locationNotes: "Direct Abraj Al Bait access",
      isFeatured: true,
      sortOrder: 1,
      sharingPriceSar: 420,
      quadPriceSar: 680,
      doublePriceSar: 950,
      updatedByUserId: "admin-secret-id",
    }

    const sanitized = sanitizeHomePlannerCatalog({
      visaRates: [],
      hotels: [rawHotelWithWholesaleSar],
      vehicles: [],
      transportSectors: [],
      ziyaratPlaces: [],
      airlines: [],
      departureCities: [],
    })

    const serialized = JSON.stringify(sanitized)
    expect(serialized).toContain("Makkah Clock Royal Tower")
    expect(serialized).not.toContain("sharingPriceSar")
    expect(serialized).not.toContain("quadPriceSar")
    expect(serialized).not.toContain("doublePriceSar")
    expect(serialized).not.toContain("updatedByUserId")

    const overviewHtml = renderToStaticMarkup(
      React.createElement(TrustHomeOverview)
    )
    expect(overviewHtml).toContain('tabindex="0"')
    expect(overviewHtml).toContain("<caption")
    expect(overviewHtml).toContain('href="/umrah-packages"')
    expect(overviewHtml).toContain('href="/umrah-visa"')
    expect(overviewHtml).toContain('href="/hajj-2027"')
    expect(overviewHtml).toContain('href="/hotels/makkah"')
    expect(overviewHtml).toContain('href="/hotels/madinah"')
    expect(overviewHtml).toContain('href="/ziyarat"')
  })

  // covers: AC-9, AC-10
  it("resolves 1:1 Home FAQs, caps at 10 entries, and keeps all FAQ answers mounted in SSR HTML", () => {
    expect(resolveHomeFaqs([])).toEqual(DEFAULT_HOME_FAQS)
    expect(
      resolveHomeFaqs([{ id: "bad", category: "visa", question: "  ", answer: "" }])
    ).toEqual(DEFAULT_HOME_FAQS)

    const twelveFaqs = Array.from({ length: 12 }, (_, idx) => ({
      id: `faq-${idx + 1}`,
      category: "umrah",
      question: `Question ${idx + 1}?`,
      answer: `Detailed verified answer ${idx + 1}.`,
    }))
    const resolved = resolveHomeFaqs(twelveFaqs)
    expect(resolved).toHaveLength(10)

    expect(
      renderToStaticMarkup(React.createElement(FaqAccordionClient, { faqs: [] }))
    ).toBe("")

    const faqHtml = renderToStaticMarkup(
      React.createElement(FaqAccordionClient, { faqs: DEFAULT_HOME_FAQS })
    )
    for (const item of DEFAULT_HOME_FAQS) {
      expect(faqHtml).toContain(item.question.slice(0, 24))
      expect(faqHtml).toContain(item.answer.slice(0, 24))
    }
  })

  // covers: AC-9
  it("renders QuotingTimelineClient 4 steps, ZiyaratShowcaseClient 6-card cap with RTL ArabicText, and verified-only testimonials", () => {
    const timelineHtml = renderToStaticMarkup(
      React.createElement(QuotingTimelineClient)
    )
    expect(timelineHtml).toContain('id="quoting-process-heading"')
    for (const stepNum of ["01", "02", "03", "04"]) {
      expect(timelineHtml).toContain(stepNum)
    }

    const eightLandmarks: ZiyaratCardItem[] = Array.from(
      { length: 8 },
      (_, idx) => ({
        id: `ziy-${idx + 1}`,
        city: idx % 2 === 0 ? "makkah" : "madinah",
        name: `Landmark ${idx + 1}`,
        arabicName: "المسجد",
        description: `Historical sanctuary description ${idx + 1}.`,
        imageUrl:
          "https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb",
      })
    )
    const ziyaratHtml = renderToStaticMarkup(
      React.createElement(ZiyaratShowcaseClient, { sites: eightLandmarks })
    )
    expect(ziyaratHtml).toContain(
      'role="tablist" aria-label="Filter Ziyarat sanctuaries by holy city"'
    )
    expect(ziyaratHtml).toContain('lang="ar"')
    expect(ziyaratHtml).toContain('dir="rtl"')
    expect(ziyaratHtml).toContain('href="/ziyarat"')
    expect((ziyaratHtml.match(/<article\b/g) ?? []).length).toBe(6)

    const noTestimonialsHtml = renderToStaticMarkup(
      React.createElement(MarketingSections, { testimonials: [] })
    )
    expect(noTestimonialsHtml).not.toContain("verified-testimonials-heading")

    const withTestimonialsHtml = renderToStaticMarkup(
      React.createElement(MarketingSections, {
        testimonials: [
          {
            id: "test-1",
            pilgrimName: "Tariq Mahmood",
            city: "Lahore",
            quote: "Seamless Clock Tower rooms and GMC airport pickup.",
            packageOrJourneyType: "Custom Family Umrah",
            rating: 5,
          },
        ],
      })
    )
    expect(withTestimonialsHtml).toContain("verified-testimonials-heading")
    expect(withTestimonialsHtml).toContain("Tariq Mahmood")
  })

  // covers: AC-9
  it("rejects non-HTTPS mapsEmbedUrl in ContactSection and renders labeled Askari 10 contact form inputs", () => {
    const unsafeSettings: AgencyContactInfo = {
      agencyName: "Al Ramlah Travels",
      primaryWhatsapp: "+923274029701",
      secondaryPhone: "+923190462638",
      supportEmail: "alramlahtravels@gmail.com",
      officeAddress:
        "Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt",
      workingHours: "Mon – Sat: 10:00 AM – 8:00 PM PKT",
      mapsEmbedUrl: "javascript:alert(1)",
    }

    const html = renderToStaticMarkup(
      React.createElement(ContactSection, { settings: unsafeSettings })
    )

    expect(html).not.toContain("javascript:alert(1)")
    expect(html).toContain('href="https://')
    expect(html).toContain("Askari 10")
    for (const fieldId of [
      "c-name",
      "c-email",
      "c-phone",
      "c-wa",
      "c-sub",
      "c-msg",
      "c-website",
    ]) {
      expect(html, `missing #${fieldId}`).toContain(`id="${fieldId}"`)
    }
  })
})
