import { describe, expect, it } from "vitest"
import { formatPkr } from "@/components/public/public-utils"
import {
  DEFAULT_COMPANY_INFO,
  DEFAULT_OFFICE_ADDRESS,
  formatPkPhoneDisplay,
  getCachedCompanyInfo,
  getCompanyInfo,
  toTelHref,
} from "@/lib/company-info"
import {
  BRAND_SOCIAL_URLS,
  BRAND_WEBSITE_DOMAIN,
  BRAND_WEBSITE_URL,
} from "@/lib/constants/brand"
import {
  buildPublicMetadata,
  CANONICAL_ORIGIN,
  clampSeoDescription,
  clampSeoTitle,
  getCanonicalSiteUrl,
} from "@/lib/seo/metadata"
import {
  PUBLIC_SEO_PATHS,
  revalidatePublicSeoPaths,
} from "@/lib/seo/revalidate-public"
import {
  buildSemanticPackageSlug,
  HARAMAIN_CITIES,
  normalizeRouteSlug,
  UMRAH_GATEWAY_CITIES,
} from "@/lib/seo/slugs"

describe("W6A F-SEO-PLAT: Metadata Factory, Canonical Origin, NAP Helpers & Semantic Slugs", () => {
  it("locks canonical apex domain https://alramlahtravels.com across brand constants and getCanonicalSiteUrl()", () => {
    expect(BRAND_WEBSITE_URL).toBe("https://alramlahtravels.com")
    expect(BRAND_WEBSITE_DOMAIN).toBe("alramlahtravels.com")
    expect(CANONICAL_ORIGIN).toBe("https://alramlahtravels.com")

    expect(getCanonicalSiteUrl("http://localhost:3000").toString()).toBe(
      "https://alramlahtravels.com/"
    )
    expect(getCanonicalSiteUrl("http://127.0.0.1:3000").toString()).toBe(
      "https://alramlahtravels.com/"
    )
    expect(
      getCanonicalSiteUrl("https://www.alramlahtravels.com/about").toString()
    ).toBe("https://alramlahtravels.com/")
    expect(getCanonicalSiteUrl(undefined).toString()).toBe(
      "https://alramlahtravels.com/"
    )
  })

  it("clamps SEO titles <=60 chars and descriptions within 150-160 chars while preventing double brand suffixes", () => {
    const shortTitle = clampSeoTitle("Umrah Packages from Lahore")
    expect(shortTitle).toBe("Umrah Packages from Lahore")

    const longTitle = clampSeoTitle(
      "15-Day Royal Ramadan Umrah Package with Clock Tower Fairmont & Oberoi Madinah Direct Flights",
      60
    )
    expect(longTitle.length).toBeLessThanOrEqual(60)
    expect(longTitle.endsWith(" ")).toBe(false)

    const paddedDesc = clampSeoDescription(
      "Explore verified Umrah group packages departing from Lahore Airport (LHE) in PKR."
    )
    expect(paddedDesc.length).toBeGreaterThanOrEqual(150)
    expect(paddedDesc.length).toBeLessThanOrEqual(160)

    const clampedDesc = clampSeoDescription(
      "Book luxury 5-star and economy Umrah packages from Lahore, Karachi, and Islamabad with direct Saudia and PIA flights, Clock Tower courtyard hotels, private GMC Yukon transfers, and guided Ziyarat tours in PKR."
    )
    expect(clampedDesc.length).toBeLessThanOrEqual(160)

    const metaWithoutSuffix = buildPublicMetadata({
      path: "/umrah-packages/from-lahore/?utm_source=google",
      title: "Umrah Packages from Lahore (LHE)",
      description:
        "Compare fixed-departure Umrah packages from Lahore Allama Iqbal Airport (LHE) with transparent PKR room rates, Saudi e-visas, and Haramain hotels.",
    })

    expect(metaWithoutSuffix.alternates?.canonical).toBe(
      "https://alramlahtravels.com/umrah-packages/from-lahore"
    )
    expect(metaWithoutSuffix.title).toEqual({
      absolute: "Umrah Packages from Lahore (LHE) | Al Ramlah Travels",
    })
    expect((metaWithoutSuffix.description ?? "").length).toBeGreaterThanOrEqual(
      150
    )
    expect((metaWithoutSuffix.description ?? "").length).toBeLessThanOrEqual(
      160
    )
    expect(metaWithoutSuffix.openGraph).toMatchObject({
      locale: "en_PK",
      siteName: "Al Ramlah Travels",
      url: "https://alramlahtravels.com/umrah-packages/from-lahore",
    })
    expect("keywords" in metaWithoutSuffix).toBe(false)

    // Passing a title that already includes "| Al Ramlah Travels" or "| Al Ramlah" must never duplicate it
    const metaPreBranded = buildPublicMetadata({
      path: "/hajj-2027",
      title: "Hajj 2027 Packages & Maktab Guide Pakistan | Al Ramlah",
      description:
        "Compare Hajj 2027 Maktab A+, A, B & C pre-registration tiers from Pakistan with shifting vs non-shifting Haramain stays and MORA governance guidance.",
    })
    const resolvedHajjTitle = (
      metaPreBranded.title as { absolute: string }
    ).absolute
    expect(resolvedHajjTitle.length).toBeLessThanOrEqual(60)
    expect(
      resolvedHajjTitle.match(/Al Ramlah/gi)?.length ?? 0
    ).toBe(1)

    const privateMeta = buildPublicMetadata({
      path: "/voucher/sample",
      title: "Pilgrim Voucher",
      description: "Private confirmation voucher.",
      noIndex: true,
    })
    expect(privateMeta.robots).toMatchObject({
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    })
  })

  it("enforces Askari 10 Lahore Cantt, Pakistan NAP, social fallbacks, E.164 tel: links, and deterministic formatPkr()", async () => {
    expect(DEFAULT_OFFICE_ADDRESS).toBe(
      "Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan"
    )
    expect(DEFAULT_COMPANY_INFO.facebookUrl).toBe(BRAND_SOCIAL_URLS.facebook)
    expect(DEFAULT_COMPANY_INFO.instagramUrl).toBe(BRAND_SOCIAL_URLS.instagram)
    expect(DEFAULT_COMPANY_INFO.youtubeUrl).toBe(BRAND_SOCIAL_URLS.youtube)
    expect(DEFAULT_COMPANY_INFO.tiktokUrl).toBe(BRAND_SOCIAL_URLS.tiktok)

    const fallbackInfo = getCompanyInfo({
      facebookUrl: null,
      instagramUrl: "",
    })
    expect(fallbackInfo.facebookUrl).toBe(BRAND_SOCIAL_URLS.facebook)
    expect(fallbackInfo.instagramUrl).toBe(BRAND_SOCIAL_URLS.instagram)

    expect(toTelHref("03274029701")).toBe("tel:+923274029701")
    expect(toTelHref("+92 (0) 319-0462638")).toBe("tel:+923190462638")
    expect(formatPkPhoneDisplay("03274029701")).toBe("+92 327 4029701")
    expect(formatPkPhoneDisplay("03190462638")).toBe("+92 319 0462638")

    expect(formatPkr(258299)).toBe("PKR 258,299")
    expect(formatPkr(3450000)).toBe("PKR 3,450,000")
    expect(formatPkr(0)).toBe("PKR 0")

    const cached = await getCachedCompanyInfo()
    expect(cached.agencyName).toBe("Al Ramlah Travels")
    expect(cached.officeAddress).toContain("Askari 10, Airport Road, Lahore Cantt")
  })

  it("generates clean semantic package slugs and exposes gateway/Haramain city dictionaries + revalidation helper", () => {
    expect(Object.keys(UMRAH_GATEWAY_CITIES)).toEqual([
      "lahore",
      "karachi",
      "islamabad",
    ])
    expect(Object.keys(HARAMAIN_CITIES)).toEqual(["makkah", "madinah"])

    const slug = buildSemanticPackageSlug({
      durationDays: 15,
      departureCityCode: "LHE",
      makkahHotelName: "Swissôtel Al Maqam Makkah",
      postCode: "ART-LH-15D-01",
    })
    expect(slug).toBe(
      "15-day-umrah-lahore-swissotel-al-maqam-makkah-art-lh-15d-01"
    )
    expect(slug).toMatch(/^[a-z0-9-]+$/)
    expect(slug.length).toBeLessThanOrEqual(120)

    expect(normalizeRouteSlug("  Mövenpick & Oberoi — 5★ Luxury! ")).toBe(
      "movenpick-and-oberoi-5-luxury"
    )

    expect(PUBLIC_SEO_PATHS).toContain("/")
    expect(PUBLIC_SEO_PATHS).toContain("/umrah-packages/from-lahore")
    expect(PUBLIC_SEO_PATHS).toContain("/hajj-2027")
    expect(PUBLIC_SEO_PATHS).toContain("/sitemap.xml")
    expect(() =>
      revalidatePublicSeoPaths(["royal-ramadan-15-day-luxury-umrah"])
    ).not.toThrow()
  })
})
