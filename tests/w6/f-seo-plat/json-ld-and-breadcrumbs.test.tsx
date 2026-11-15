import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { ArabicText } from "@/components/public/arabic-text"
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildHajjServiceJsonLd,
  buildHotelItemListJsonLd,
  buildTouristAttractionListJsonLd,
  buildTravelAgencyJsonLd,
  buildUmrahPackageJsonLd,
  buildWebSiteJsonLd,
  JsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld"
import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderLuxuryOgCard,
} from "@/lib/seo/og-card"

describe("W6A F-SEO-PLAT: JSON-LD Rich-Result Safety Guards, BiDi Isolation, Breadcrumbs & Luxury OG Card", () => {
  it("escapes </script> and '<' characters in serializeJsonLd() and <JsonLd /> to prevent stored XSS", () => {
    const hostilePayload = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      note: "</script><script>alert('xss')</script> Short-term <=30 days",
      aggregateRating: { "@type": "AggregateRating", ratingValue: 5 },
      review: [{ "@type": "Review" }],
    }

    const serialized = serializeJsonLd(hostilePayload)
    expect(serialized).not.toContain("</script>")
    expect(serialized).not.toContain("<script>")
    expect(serialized).toContain("\\u003c/script\\u003e")
    expect(serialized).not.toContain("aggregateRating")
    expect(serialized).not.toContain('"review"')

    const html = renderToStaticMarkup(<JsonLd data={hostilePayload} />)
    expect(html).toContain('type="application/ld+json"')
    expect(html).not.toContain("<script>alert")
  })

  it("enforces OD-10 TravelAgency license gating and bans AggregateRating across all schema builders", () => {
    const unverifiedAgency = buildTravelAgencyJsonLd({
      dtsLicense: null,
      moraLicense: null,
      iataCode: "",
      ntnNumber: null,
    })
    expect(unverifiedAgency["@type"]).toBe("TravelAgency")
    expect(unverifiedAgency["@id"]).toBe(
      "https://alramlahtravels.com/#organization"
    )
    expect(unverifiedAgency.telephone).toBe("+923274029701")
    expect(unverifiedAgency.identifier).toBeUndefined()
    expect(unverifiedAgency.aggregateRating).toBeUndefined()
    expect(unverifiedAgency.review).toBeUndefined()

    const verifiedAgency = buildTravelAgencyJsonLd({
      dtsLicense: "DTS-LHR-4410",
      moraLicense: "MORA-PK-902",
    })
    expect(verifiedAgency.identifier).toEqual([
      {
        "@type": "PropertyValue",
        name: "DTS License",
        value: "DTS-LHR-4410",
      },
      {
        "@type": "PropertyValue",
        name: "MORA Hajj & Umrah Organizer License",
        value: "MORA-PK-902",
      },
    ])

    const websiteSchema = buildWebSiteJsonLd()
    expect(websiteSchema["@type"]).toBe("WebSite")
    expect(websiteSchema.potentialAction).toBeUndefined()
  })

  it("enforces OD-09 pricing truthfulness across Umrah TouristTrip, Hajj 2027 Service, Hotel ItemList, and Ziyarat ItemList", () => {
    const futureDate = "2099-03-15"
    const inStockTrip = buildUmrahPackageJsonLd({
      slug: "royal-ramadan-15-day-luxury-umrah",
      title: "Royal Ramadan 15-Day Luxury Umrah",
      durationDays: 15,
      makkahNights: 8,
      madinahNights: 7,
      sharingPricePkr: 419999,
      quadPricePkr: 485000,
      triplePricePkr: 545000,
      doublePricePkr: 635000,
      departures: [
        {
          departureDate: futureDate,
          totalSeats: 35,
          bookedSeats: 12,
          status: "open",
        },
      ],
    })
    const offers = inStockTrip.offers as Record<string, unknown>
    expect(offers["@type"]).toBe("AggregateOffer")
    expect(offers.priceCurrency).toBe("PKR")
    expect(offers.lowPrice).toBe(419999)
    expect(offers.highPrice).toBe(635000)
    expect(offers.availability).toBe("https://schema.org/InStock")

    const soldOutTrip = buildUmrahPackageJsonLd({
      slug: "sold-out-group",
      title: "Sold Out Group",
      durationDays: 14,
      makkahNights: 7,
      madinahNights: 7,
      quadPricePkr: 310000,
      departures: [
        {
          departureDate: futureDate,
          totalSeats: 30,
          bookedSeats: 30,
          status: "sold_out",
        },
      ],
    })
    expect((soldOutTrip.offers as Record<string, unknown>).availability).toBe(
      "https://schema.org/SoldOut"
    )

    const zeroPriceTrip = buildUmrahPackageJsonLd({
      slug: "on-request-group",
      title: "On Request Group",
      durationDays: 14,
      makkahNights: 7,
      madinahNights: 7,
      sharingPricePkr: 0,
      quadPricePkr: 0,
    })
    expect(zeroPriceTrip.offers).toBeUndefined()

    const hajjJson = serializeJsonLd(
      buildHajjServiceJsonLd([
        {
          slug: "hajj-2027-maktab-a",
          title: "Hajj 2027 Maktab A",
          maktabTier: "A",
          durationDays: 21,
        },
      ])
    )
    expect(hajjJson).not.toContain("InStock")
    expect(hajjJson).not.toContain('"price"')

    const hotelsJson = serializeJsonLd(
      buildHotelItemListJsonLd("makkah", [
        {
          name: "Fairmont Makkah Clock Royal Tower",
          starRating: 5,
          distanceLabel: "0m Haram Courtyard",
        },
      ])
    )
    expect(hotelsJson).not.toContain('"price"')
    expect(hotelsJson).not.toContain("AggregateRating")

    const ziyaratJson = serializeJsonLd(
      buildTouristAttractionListJsonLd("madinah", [
        {
          name: "Masjid Quba",
          arabicName: "مسجد قباء",
          city: "madinah",
        },
      ])
    )
    expect(ziyaratJson).not.toContain('"price"')
    expect(ziyaratJson).toContain("Masjid Quba")

    expect(buildFaqPageJsonLd([])).toBeNull()
    const faqSchema = buildFaqPageJsonLd([
      { question: "Is insurance included?", answer: "Yes, mandatory Saudi insurance is included." },
    ])
    expect(faqSchema?.["@type"]).toBe("FAQPage")
  })

  it("renders PublicBreadcrumbs via @base-ui/react render prop with matching BreadcrumbList JSON-LD and isolates ArabicText BiDi", async () => {
    const breadcrumbHtml = renderToStaticMarkup(
      <PublicBreadcrumbs
        items={[
          { label: "Umrah Packages", href: "/umrah-packages" },
          { label: "From Lahore (LHE)", href: "/umrah-packages/from-lahore" },
        ]}
      />
    )
    expect(breadcrumbHtml).toContain('aria-label="breadcrumb"')
    expect(breadcrumbHtml).toContain('href="/"')
    expect(breadcrumbHtml).toContain('href="/umrah-packages"')
    expect(breadcrumbHtml).toContain('aria-current="page"')
    expect(breadcrumbHtml).toContain("https://alramlahtravels.com/umrah-packages/from-lahore")

    const trailJson = buildBreadcrumbJsonLd([
      { label: "Home", href: "/" },
      { label: "Hajj 2027", href: "/hajj-2027" },
    ])
    expect(trailJson["@type"]).toBe("BreadcrumbList")

    const arabicHtml = renderToStaticMarkup(
      <ArabicText>مسجد قباء</ArabicText>
    )
    expect(arabicHtml).toContain('lang="ar"')
    expect(arabicHtml).toContain('dir="rtl"')
    expect(arabicHtml).toContain("unicode-bidi:isolate")

    const ogResponse = renderLuxuryOgCard({
      title: "Umrah Packages from Lahore (LHE)",
      subtitle: "Direct non-stop Saudia & PIA group batches in PKR.",
    })
    expect(OG_IMAGE_SIZE).toEqual({ width: 1200, height: 630 })
    expect(OG_IMAGE_CONTENT_TYPE).toBe("image/png")
    expect(ogResponse.headers.get("content-type")).toContain("image/png")
  })
})
