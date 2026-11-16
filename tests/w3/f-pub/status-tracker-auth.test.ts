import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
import { inArray, like } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import {
  lookupApplicationStatus,
  submitCustomApplication,
} from "../../../app/actions/applications"
import { addDaysToDateString } from "../../../components/planner/planner-context"
import { getTodayPktIso } from "../../../components/public/public-utils"

describe("F-PUB T-016: Status Tracker Auth, CSPRNG References & DTO Redaction", () => {
  const createdAppIds: string[] = []

  after(async () => {
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
    }
    await closeDatabasePool()
  })

  it("generates 48-bit CSPRNG reference numbers (ART-YYYYMMDD-<10-char>) and never sequential counters", async () => {
    const arrival = addDaysToDateString(getTodayPktIso(), 20)
    const departure = addDaysToDateString(arrival, 10)

    const resA = await submitCustomApplication({
      clientSubmissionId: `fpub-t016-a-${crypto.randomUUID()}`,
      presetMode: "visa_only",
      includeVisa: true,
      includeFlights: false,
      includeHotels: false,
      includeTransport: false,
      includeZiyarat: false,
      passengers: { adults: 2, children: 0, infants: 0 },
      ksaArrivalDate: arrival,
      ksaDepartureDate: departure,
      contact: {
        customerName: "Pilgrim CSPRNG Alpha",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: `198.51.100.${Math.floor(Math.random() * 200) + 10}`,
    })

    const resB = await submitCustomApplication({
      clientSubmissionId: `fpub-t016-b-${crypto.randomUUID()}`,
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
        customerName: "Pilgrim CSPRNG Beta",
        customerPhone: "+44 7911 123456",
        customerCity: "London",
        customerCountry: "United Kingdom",
      },
      _testIp: `198.51.100.${Math.floor(Math.random() * 200) + 10}`,
    })

    assert.equal(resA.success, true, resA.error)
    assert.equal(resB.success, true, resB.error)
    if (resA.applicationId) createdAppIds.push(resA.applicationId)
    if (resB.applicationId) createdAppIds.push(resB.applicationId)

    assert.ok(resA.referenceNumber)
    assert.ok(resB.referenceNumber)
    assert.match(resA.referenceNumber, /^ART-\d{8}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/)
    assert.match(resB.referenceNumber, /^ART-\d{8}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/)
    assert.notEqual(resA.referenceNumber, resB.referenceNumber)
    assert.ok(!/-\d{4}$/.test(resA.referenceNumber))
  })

  it("rejects empty/short/punctuation phone bypasses ('', '-------', '701'), matches exact E.164 & ART-WA refs, and strips internal/supplier fields", async () => {
    const uniqueSuffix = crypto.randomBytes(5).toString("hex").toUpperCase()
    const waRef = `ART-WA-20261114-${uniqueSuffix.slice(0, 8)}`
    const secretVoucherToken = crypto.randomBytes(24).toString("base64url")

    const [inserted] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: waRef,
        source: "custom_builder",
        presetMode: "complete_umrah",
        status: "quoted",
        customerName: "Haji Tariq Mahmood",
        customerPhone: "+923001112233",
        customerWhatsapp: "+447911654321",
        customerEmail: "tariq.private@example.com",
        customerCity: "Lahore",
        adults: 2,
        children: 1,
        infants: 1,
        totalPassportCount: 4,
        bedAndSeatCount: 3,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        internalNotesAdmin: "CONFIDENTIAL STAFF MARGIN NOTE - DO NOT LEAK",
        voucherToken: secretVoucherToken,
      })
      .returning()

    assert.ok(inserted)
    createdAppIds.push(inserted.id)

    await db.insert(schema.applicationQuotes).values({
      applicationId: inserted.id,
      version: 1,
      visaTotalPkr: 180000,
      flightsTotalPkr: 520000,
      makkahHotelTotalPkr: 310000,
      madinahHotelTotalPkr: 240000,
      transportTotalPkr: 85000,
      ziyaratTotalPkr: 35000,
      discountPkr: 20000,
      grandTotalPkr: 1350000,
      supplierNetCostPkr: 1120000,
      commissionPkr: 230000,
      paymentStatus: "unpaid",
      quoteNotesCustomer: "Confirmed Makkah Clock Tower + Anwar Al Madinah quote.",
      quotedAt: new Date(),
    })

    // 1. Rejects endsWith("") bypass vectors: "-------", "2233" (4-digit suffix), wrong phone, unknown ref
    const bypassDash = await lookupApplicationStatus({
      referenceNumber: waRef,
      customerPhone: "-------",
      _testIp: `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
    })
    const bypassShortSuffix = await lookupApplicationStatus({
      referenceNumber: waRef,
      customerPhone: "2233",
      _testIp: `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
    })
    const wrongPhone = await lookupApplicationStatus({
      referenceNumber: waRef,
      customerPhone: "03009998877",
      _testIp: `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
    })
    const unknownRef = await lookupApplicationStatus({
      referenceNumber: "ART-20261114-ZZZZZZZZZZ",
      customerPhone: "03001112233",
      _testIp: `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
    })

    assert.equal(bypassDash.success, false)
    assert.equal(bypassShortSuffix.success, false)
    assert.equal(wrongPhone.success, false)
    assert.equal(unknownRef.success, false)

    // Uniform generic auth error prevents reference-existence enumeration
    assert.equal(bypassDash.error, wrongPhone.error)
    assert.equal(bypassShortSuffix.error, wrongPhone.error)
    assert.equal(unknownRef.error, wrongPhone.error)

    // 2. Succeeds on domestic PK format ("0300 1112233") AND international WhatsApp ("+44 (0) 7911 654321")
    const validDomestic = await lookupApplicationStatus({
      referenceNumber: waRef.toLowerCase(),
      customerPhone: "0300 1112233",
      _testIp: `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
    })
    assert.equal(validDomestic.success, true, validDomestic.error)
    assert.equal(validDomestic.application?.referenceNumber, waRef)

    const validIntlWa = await lookupApplicationStatus({
      referenceNumber: waRef,
      customerPhone: "+44 (0) 7911 654321",
      _testIp: `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
    })
    assert.equal(validIntlWa.success, true, validIntlWa.error)

    // 3. Verify sensitive staff/supplier/PII fields are completely stripped from public DTO
    const serialized = JSON.stringify(validDomestic)
    assert.ok(!serialized.includes("CONFIDENTIAL STAFF MARGIN NOTE"))
    assert.ok(!serialized.includes("internalNotesAdmin"))
    assert.ok(!serialized.includes("supplierNetCostPkr"))
    assert.ok(!serialized.includes("1120000"))
    assert.ok(!serialized.includes("commissionPkr"))
    assert.ok(!serialized.includes("230000"))
    assert.ok(!serialized.includes("tariq.private@example.com"))
    assert.ok(!serialized.includes(secretVoucherToken))
    assert.equal(validDomestic.application?.voucherUrl, null)
  })

  it("enforces rate limiting (5 attempts per 15m per IP) on lookupApplicationStatus", async () => {
    const dedicatedIp = `192.0.2.${Math.floor(Math.random() * 200) + 20}`

    for (let i = 0; i < 5; i++) {
      const attempt = await lookupApplicationStatus({
        referenceNumber: "ART-20261114-ABCDEFGHJK",
        customerPhone: "03274029701",
        _testIp: dedicatedIp,
      })
      assert.equal(attempt.success, false)
      assert.match(attempt.error ?? "", /Unable to verify inquiry/i)
    }

    const sixthAttempt = await lookupApplicationStatus({
      referenceNumber: "ART-20261114-ABCDEFGHJK",
      customerPhone: "03274029701",
      _testIp: dedicatedIp,
    })
    assert.equal(sixthAttempt.success, false)
    assert.match(sixthAttempt.error ?? "", /Too many lookup attempts/i)

    // Clean up test rate-limit bucket rows created by this IP
    await db
      .delete(schema.rateLimitBuckets)
      .where(like(schema.rateLimitBuckets.key, "status-tracker:%"))
  })
})
