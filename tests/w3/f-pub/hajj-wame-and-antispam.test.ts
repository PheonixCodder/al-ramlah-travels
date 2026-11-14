import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
import { eq, inArray, like } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import {
  submitCustomApplication,
  submitHajjInquiryApplication,
  submitPublicContactInquiryAction,
} from "../../../app/actions/applications"
import { addDaysToDateString } from "../../../components/planner/planner-context"
import { getTodayPktIso, toWaMeUrl } from "../../../components/public/public-utils"

describe("F-PUB T-055 (OD-09e): Structured hajjInquiryJson, E.164 wa.me Links, Honeypot & Public Rate Limiting", () => {
  const createdAppIds: string[] = []
  const createdContactIds: string[] = []

  after(async () => {
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
    }
    if (createdContactIds.length > 0) {
      await db
        .delete(schema.contactMessages)
        .where(inArray(schema.contactMessages.id, createdContactIds))
    }
    await db
      .delete(schema.rateLimitBuckets)
      .where(like(schema.rateLimitBuckets.key, "submit-contact:%"))
    await closeDatabasePool()
  })

  it("formats domestic PK and international numbers into digits-only https://wa.me/ URLs with zero 'wa.me/03' or '+'", () => {
    const pkLocal = toWaMeUrl("0327 4029701", "Salam Al Ramlah")
    assert.ok(pkLocal.startsWith("https://wa.me/923274029701?text="))
    assert.ok(!pkLocal.includes("wa.me/03"))
    assert.ok(!pkLocal.includes("wa.me/+"))

    const pkPlus = toWaMeUrl("+92 (0) 327-4029701")
    assert.equal(pkPlus, "https://wa.me/923274029701")

    const ukNumber = toWaMeUrl("+44 (0) 7911 123456")
    assert.equal(ukNumber, "https://wa.me/447911123456")
  })

  it("persists structured hajjInquiryJson with Indicative 2027 Pre-Registration disclaimer, Maktab tier, room & add-ons (OD-09e)", async () => {
    const res = await submitHajjInquiryApplication({
      clientSubmissionId: `fpub-t055-hajj-${crypto.randomUUID()}`,
      hajjConsultationType: "Maktab A — VIP Azizia & Shifting (18–22 Days)",
      maktabTier: "A",
      roomType: "double",
      indicativePricePkr: 3150000,
      durationLabel: "18–22 Days",
      includeQurbani: true,
      includeTrainTicket: true,
      bloodGroup: "O+",
      passengers: { adults: 2, children: 0, infants: 0 },
      contact: {
        customerName: "Dr. Usman Qureshi",
        customerPhone: "+44 7700 900123",
        customerCity: "Manchester",
        customerCountry: "United Kingdom",
      },
      notes: "Prefer ground-floor access near Haram shuttle.",
      _testIp: "198.51.100.115",
    })

    assert.equal(res.success, true, res.error)
    assert.ok(res.applicationId)
    createdAppIds.push(res.applicationId)
    assert.ok(res.whatsappUrl?.startsWith("https://wa.me/92"))

    const row = await db.query.applications.findFirst({
      where: eq(schema.applications.id, res.applicationId),
    })
    assert.ok(row && row.hajjInquiryJson)
    const json = row.hajjInquiryJson
    assert.equal(json.isIndicativeEstimate, true)
    assert.equal(json.maktabTier, "A")
    assert.equal(json.roomType, "double")
    assert.equal(json.includeQurbani, true)
    assert.equal(json.includeTrainTicket, true)
    assert.equal(json.bloodGroup, "O+")
    assert.equal(json.customerCountry, "United Kingdom")
    assert.equal(json.customerCity, "Manchester")
    assert.match(String(json.regulatoryDisclaimer ?? ""), /Indicative 2027 Pre-Registration/i)
  })

  it("blocks honeypot bot payloads and enforces rate limiting on public contact & inquiry actions", async () => {
    const arrival = addDaysToDateString(getTodayPktIso(), 20)
    const departure = addDaysToDateString(arrival, 8)

    // 1. Honeypot blocks custom Umrah, Hajj, and Contact submissions without inserting rows
    const hpCustom = await submitCustomApplication({
      presetMode: "visa_only",
      includeVisa: true,
      includeFlights: false,
      includeHotels: false,
      includeTransport: false,
      includeZiyarat: false,
      passengers: { adults: 1, children: 0, infants: 0 },
      ksaArrivalDate: arrival,
      ksaDepartureDate: departure,
      contact: {
        customerName: "Bot User",
        customerPhone: "03274029701",
        customerCity: "Lahore",
        website: "https://spam-seo-bot.example.com",
      },
      _testIp: "198.51.100.116",
    })
    assert.equal(hpCustom.success, false)

    const hpContact = await submitPublicContactInquiryAction({
      name: "Bot Contact",
      phone: "03274029701",
      subject: "Spam Inquiry",
      message: "Automated spam payload attempting to flood inbox.",
      websiteUrl: "http://bot.invalid",
      _testIp: "198.51.100.117",
    })
    assert.equal(hpContact.success, false)

    // 2. Rate limit on submitPublicContactInquiryAction (max 5 per 10m per IP)
    const spamIp = `203.0.113.${Math.floor(Math.random() * 200) + 30}`
    for (let i = 0; i < 5; i++) {
      const okRes = await submitPublicContactInquiryAction({
        name: `Pilgrim Contact ${i + 1}`,
        phone: "03274029701",
        subject: "Umrah Inquiry",
        message: "Assalam-o-Alaikum, please share Ramadan group availability.",
        _testIp: spamIp,
      })
      assert.equal(okRes.success, true, okRes.error)
      if (okRes.id) createdContactIds.push(okRes.id)
    }

    const sixth = await submitPublicContactInquiryAction({
      name: "Rate Limited Pilgrim",
      phone: "03274029701",
      subject: "Sixth Message",
      message: "Should be blocked by rate limiter after 5 rapid submissions.",
      _testIp: spamIp,
    })
    assert.equal(sixth.success, false)
    assert.match(sixth.error ?? "", /Too many messages/i)
  })
})
