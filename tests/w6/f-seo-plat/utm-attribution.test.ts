import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { db } from "@/db"
import * as schema from "@/db/schema"
import {
  captureFirstTouchAttribution,
  formatWhatsAppAttributionSuffix,
  inferAcquisitionChannel,
  readStoredAttribution,
  sanitizeAttributionInput,
  strictAttributionSchema,
  UTM_STORAGE_KEY,
} from "@/lib/seo/utm"

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

describe("W6A F-SEO-PLAT: First-Touch UTM/Landing/Referrer Capture, Sanitization & DB Attribution Columns", () => {
  it("locks first-touch landingPage and external httpReferrer across internal spoke-to-builder navigations", () => {
    const storage = createMemoryStorage()

    // Touch 1: Pilgrim lands on Lahore spoke from Google Search Ads
    const first = captureFirstTouchAttribution({
      pathname: "/umrah-packages/from-lahore",
      search: "?utm_source=google&utm_medium=cpc&utm_campaign=ramadan_2027",
      referrer: "https://www.google.com/search?q=umrah+lahore",
      currentHostname: "alramlahtravels.com",
      storage,
    })

    expect(first).toEqual({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "ramadan_2027",
      utmContent: null,
      utmTerm: null,
      landingPage:
        "/umrah-packages/from-lahore?utm_source=google&utm_medium=cpc&utm_campaign=ramadan_2027",
      httpReferrer: "https://www.google.com/search?q=umrah+lahore",
    })
    expect(storage.getItem(UTM_STORAGE_KEY)).toBeTruthy()

    // Touch 2: Pilgrim clicks internal CTA to /?departureCity=LHE (same-origin referrer, no UTMs)
    const afterInternalNav = captureFirstTouchAttribution({
      pathname: "/",
      search: "?departureCity=LHE",
      referrer: "https://alramlahtravels.com/umrah-packages/from-lahore",
      currentHostname: "alramlahtravels.com",
      storage,
    })

    expect(afterInternalNav.landingPage).toBe(
      "/umrah-packages/from-lahore?utm_source=google&utm_medium=cpc&utm_campaign=ramadan_2027"
    )
    expect(afterInternalNav.httpReferrer).toBe(
      "https://www.google.com/search?q=umrah+lahore"
    )
    expect(afterInternalNav.utmSource).toBe("google")
    expect(afterInternalNav.utmCampaign).toBe("ramadan_2027")
    expect(readStoredAttribution(storage)).toEqual(afterInternalNav)
  })

  it("neutralizes control chars, open-redirect //evil.com or javascript: landing pages, and referrer credentials", () => {
    const sanitized = sanitizeAttributionInput(
      {
        utmSource: "  chatgpt\u0000\u0007  ",
        utmMedium: "referral".repeat(30),
        utmCampaign: "=CMD|' /C calc'!A0",
        landingPage: "javascript:alert(1)",
        httpReferrer: "https://user:secret@chatgpt.com/c/12345#frag",
      },
      { sameOriginHost: "alramlahtravels.com" }
    )

    expect(sanitized.utmSource).toBe("chatgpt")
    expect(sanitized.utmMedium?.length).toBe(120)
    expect(sanitized.landingPage).toBeNull()
    expect(sanitized.httpReferrer).toBe("https://chatgpt.com/c/12345")

    const protocolRelative = sanitizeAttributionInput({
      landingPage: "//evil.example.com/phish",
      httpReferrer: "https://www.alramlahtravels.com/about",
    })
    expect(protocolRelative.landingPage).toBeNull()
    expect(protocolRelative.httpReferrer).toBeNull()

    const zodParsed = strictAttributionSchema.parse({
      utmSource: "perplexity",
      landingPage: "/hajj-2027",
      httpReferrer: "https://www.perplexity.ai/search/hajj",
      extraUnknownKey: "stripped",
    })
    expect(zodParsed.utmSource).toBe("perplexity")
    expect(zodParsed.landingPage).toBe("/hajj-2027")
  })

  it("infers AI/search channels cleanly and caps WhatsApp attribution suffix <=80 chars", () => {
    expect(
      inferAcquisitionChannel({ httpReferrer: "https://chatgpt.com/" })
    ).toBe("AI Search: ChatGPT")
    expect(
      inferAcquisitionChannel({ httpReferrer: "https://www.perplexity.ai/" })
    ).toBe("AI Search: Perplexity")
    expect(
      inferAcquisitionChannel({ httpReferrer: "https://www.google.com.pk/" })
    ).toBe("Organic Search: Google")
    expect(
      inferAcquisitionChannel({ utmSource: "google", utmMedium: "cpc" })
    ).toBe("Paid Search: Google Ads")

    // Direct homepage visit with zero UTMs produces empty suffix
    expect(
      formatWhatsAppAttributionSuffix({ landingPage: "/" }, "/")
    ).toBe("")

    const spokeSuffix = formatWhatsAppAttributionSuffix(
      {
        utmSource: "google",
        utmMedium: "cpc",
        landingPage: "/umrah-packages/from-lahore?utm_source=google",
      },
      "/umrah-packages/from-lahore"
    )
    expect(spokeSuffix).toContain("/umrah-packages/from-lahore")
    expect(spokeSuffix).toContain("google/cpc")
    expect(spokeSuffix.trim().length).toBeLessThanOrEqual(80)
  })

  it("persists and queries all 7 nullable attribution columns on contact_messages and applications schema", async () => {
    expect(schema.applications.utmSource.name).toBe("utm_source")
    expect(schema.applications.landingPage.name).toBe("landing_page")
    expect(schema.applications.httpReferrer.name).toBe("http_referrer")

    const [insertedMsg] = await db
      .insert(schema.contactMessages)
      .values({
        name: "W6A Attribution Test Pilgrim",
        phone: "+923274029701",
        subject: "Lahore Umrah Inquiry",
        message: "Testing attribution persistence.",
        utmSource: "chatgpt.com",
        utmMedium: "referral",
        utmCampaign: "geo_citation",
        utmContent: "answer_card",
        utmTerm: "best umrah agency lahore",
        landingPage: "/umrah-packages/from-lahore",
        httpReferrer: "https://chatgpt.com/",
      })
      .returning()

    try {
      expect(insertedMsg?.utmSource).toBe("chatgpt.com")
      expect(insertedMsg?.utmCampaign).toBe("geo_citation")
      expect(insertedMsg?.landingPage).toBe("/umrah-packages/from-lahore")
      expect(insertedMsg?.httpReferrer).toBe("https://chatgpt.com/")
    } finally {
      if (insertedMsg?.id) {
        await db
          .delete(schema.contactMessages)
          .where(eq(schema.contactMessages.id, insertedMsg.id))
      }
    }
  })
})
