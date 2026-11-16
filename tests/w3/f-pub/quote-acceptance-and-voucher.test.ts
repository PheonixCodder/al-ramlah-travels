import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
import { eq, inArray } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import {
  DEPOSIT_PAID_PAYMENT_STATUS,
  REVISION_REQUESTED_STATUS,
} from "../../../db/schema/applications"
import {
  lookupApplicationStatus,
  respondToApplicationQuoteAction,
} from "../../../app/actions/applications"
import {
  buildQrSvgPath,
  resolvePublicVoucherByToken,
} from "../../../components/public/voucher-loader"

describe("F-PUB T-017 (OD-04): Pilgrim Quote Acceptance, Revision Loop & Signed Capability Voucher", () => {
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

  it("supports Request Revision -> Accept Quote -> OD-04 Deposit-Gated Capability Voucher with QR SVG", async () => {
    const ref = `ART-20261114-${crypto.randomBytes(5).toString("hex").toUpperCase()}`
    const [app] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: ref,
        source: "custom_builder",
        presetMode: "complete_umrah",
        status: "quoted",
        customerName: "Syed Bilal Raza",
        customerPhone: "+923214445566",
        customerWhatsapp: "+923214445566",
        customerCity: "Lahore",
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        ksaArrivalDate: "2027-01-10",
        ksaDepartureDate: "2027-01-20",
        totalKsaDays: 11,
        entryAirport: "JED",
        exitAirport: "MED",
      })
      .returning()

    assert.ok(app)
    createdAppIds.push(app.id)

    const [quote] = await db
      .insert(schema.applicationQuotes)
      .values({
        applicationId: app.id,
        version: 1,
        visaTotalPkr: 150000,
        flightsTotalPkr: 380000,
        makkahHotelTotalPkr: 220000,
        madinahHotelTotalPkr: 180000,
        transportTotalPkr: 50000,
        ziyaratTotalPkr: 20000,
        discountPkr: 0,
        grandTotalPkr: 1000000,
        depositRequiredPkr: 350000,
        amountPaidPkr: 0,
        paymentStatus: "unpaid",
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        quotedAt: new Date(),
      })
      .returning()
    assert.ok(quote)

    // 1. Wrong phone is rejected uniformly
    const badPhoneRes = await respondToApplicationQuoteAction({
      referenceNumber: ref,
      customerPhone: "03009998888",
      decision: "accept",
      _testIp: "198.51.100.41",
    })
    assert.equal(badPhoneRes.success, false)

    // 2. Request Revision transitions status to REVISION_REQUESTED_STATUS, stores customer notes & audit log
    const revRes = await respondToApplicationQuoteAction({
      referenceNumber: ref,
      customerPhone: "0321 4445566",
      decision: "request_revision",
      revisionNotes: "Please upgrade Makkah hotel to Swissotel Clock Tower view.",
      _testIp: "198.51.100.42",
    })
    assert.equal(revRes.success, true, revRes.error)
    assert.equal(revRes.status, String(REVISION_REQUESTED_STATUS))
    assert.equal(revRes.voucherUrl, null)
    assert.equal(revRes.voucherGateState, "locked")

    const afterRevApp = await db.query.applications.findFirst({
      where: eq(schema.applications.id, app.id),
    })
    assert.equal(afterRevApp?.status, REVISION_REQUESTED_STATUS)
    assert.equal(
      afterRevApp?.revisionNotesCustomer,
      "Please upgrade Makkah hotel to Swissotel Clock Tower view."
    )

    const revAuditRows = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, app.id))
    assert.ok(
      revAuditRows.some((r) => r.action === "pilgrim.quote.revision_requested")
    )

    // 3. Accept Quote transitions status to 'approved' and mints voucherToken,
    //    but keeps voucher gated ('awaiting_deposit') while paymentStatus === 'unpaid' (OD-04)
    const acceptRes = await respondToApplicationQuoteAction({
      referenceNumber: ref,
      customerPhone: "03214445566",
      decision: "accept",
      _testIp: "198.51.100.43",
    })
    assert.equal(acceptRes.success, true, acceptRes.error)
    assert.equal(acceptRes.status, "approved")
    assert.equal(acceptRes.voucherUrl, null)
    assert.equal(acceptRes.voucherGateState, "awaiting_deposit")

    const approvedApp = await db.query.applications.findFirst({
      where: eq(schema.applications.id, app.id),
    })
    assert.equal(approvedApp?.status, "approved")
    assert.ok(approvedApp?.voucherToken && approvedApp.voucherToken.length >= 24)
    const mintedToken = approvedApp.voucherToken

    // 4. Direct capability URL resolution while unpaid returns 403 awaiting_deposit (NOT 200!)
    const unpaidVoucher = await resolvePublicVoucherByToken(mintedToken)
    assert.equal(unpaidVoucher.allowed, false)
    assert.equal(unpaidVoucher.httpStatus, 403)
    if (!unpaidVoucher.allowed && unpaidVoucher.httpStatus === 403) {
      assert.equal(unpaidVoucher.reason, "awaiting_deposit")
    }

    // 5. Unknown or tampered tokens return 404 invalid_token
    const tamperedToken = `${mintedToken.slice(0, -2)}ZZ`
    const invalidRes = await resolvePublicVoucherByToken(tamperedToken)
    assert.equal(invalidRes.allowed, false)
    assert.equal(invalidRes.httpStatus, 404)

    // 6. Admin verifies deposit (paymentStatus = 'deposit_paid', amountPaidPkr = 350000) -> unlocks voucher with balance banner!
    await db
      .update(schema.applicationQuotes)
      .set({
        paymentStatus: DEPOSIT_PAID_PAYMENT_STATUS,
        amountPaidPkr: 350000,
      })
      .where(eq(schema.applicationQuotes.id, quote.id))

    const depositVoucher = await resolvePublicVoucherByToken(mintedToken)
    assert.equal(depositVoucher.allowed, true)
    if (depositVoucher.allowed) {
      assert.equal(depositVoucher.httpStatus, 200)
      assert.equal(
        depositVoucher.paymentBanner,
        "DEPOSIT VERIFIED — BALANCE DUE"
      )
      assert.equal(depositVoucher.amountPaidPkr, 350000)
      assert.equal(depositVoucher.balanceDuePkr, 650000)
      assert.ok(depositVoucher.qrSpec.pathData.startsWith("M"))
      assert.ok(depositVoucher.qrSpec.viewBoxSize >= 25)
    }

    // Status tracker now exposes the unlocked capability URL
    const statusUnlocked = await lookupApplicationStatus({
      referenceNumber: ref,
      customerPhone: "03214445566",
      _testIp: "198.51.100.44",
    })
    assert.equal(statusUnlocked.success, true)
    assert.equal(
      statusUnlocked.application?.voucherUrl,
      `/voucher/${encodeURIComponent(mintedToken)}`
    )
    assert.equal(statusUnlocked.application?.voucherGateState, "unlocked")

    // 7. Full settlement ('paid_in_full', amountPaidPkr = 1000000) -> 'PAID IN FULL' with 0 balance due
    await db
      .update(schema.applicationQuotes)
      .set({
        paymentStatus: "paid_in_full",
        amountPaidPkr: 1000000,
      })
      .where(eq(schema.applicationQuotes.id, quote.id))

    const paidFullVoucher = await resolvePublicVoucherByToken(mintedToken)
    assert.equal(paidFullVoucher.allowed, true)
    if (paidFullVoucher.allowed) {
      assert.equal(paidFullVoucher.paymentBanner, "PAID IN FULL")
      assert.equal(paidFullVoucher.balanceDuePkr, 0)
    }

    // Pure QR SVG generator sanity check
    const qr = buildQrSvgPath("https://alramlahtravels.com/voucher/test-token-1234567890")
    assert.ok(qr.pathData.includes("h1v1h-1z"))
  })

  it("blocks accepting an expired quotation whose validUntil timestamp is in the past", async () => {
    const ref = `ART-20261114-${crypto.randomBytes(5).toString("hex").toUpperCase()}`
    const [app] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: ref,
        source: "custom_builder",
        presetMode: "visa_only",
        status: "quoted",
        customerName: "Expired Quote Pilgrim",
        customerPhone: "+923331234567",
        customerWhatsapp: "+923331234567",
        customerCity: "Lahore",
        adults: 1,
        children: 0,
        infants: 0,
        totalPassportCount: 1,
        bedAndSeatCount: 1,
      })
      .returning()
    assert.ok(app)
    createdAppIds.push(app.id)

    await db.insert(schema.applicationQuotes).values({
      applicationId: app.id,
      version: 1,
      visaTotalPkr: 55000,
      grandTotalPkr: 55000,
      paymentStatus: "unpaid",
      validUntil: new Date(Date.now() - 60_000),
      quotedAt: new Date(Date.now() - 86_400_000),
    })

    const res = await respondToApplicationQuoteAction({
      referenceNumber: ref,
      customerPhone: "03331234567",
      decision: "accept",
      _testIp: "198.51.100.49",
    })
    assert.equal(res.success, false)
    assert.match(res.error ?? "", /expired/i)
  })
})
