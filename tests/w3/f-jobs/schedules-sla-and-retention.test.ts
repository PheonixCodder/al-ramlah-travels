import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { after, describe, it } from "node:test"
import { eq, inArray } from "drizzle-orm"
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import {
  applicationPayments,
  applicationQuotes,
  applications,
} from "../../../db/schema/applications"
import {
  session as sessionTable,
  user as userTable,
  verification as verificationTable,
} from "../../../db/schema/auth"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
} from "../../../db/schema/whatsapp-crm"
import { encrypt } from "../../../lib/whatsapp/encryption"
import {
  extractRetentionR2Key,
  piiAndMediaRetentionPurgeSchedule,
  proactiveSocialTokenRefreshSchedule,
  runPiiAndMediaRetentionPurge,
  runProactiveSocialTokenRefresh,
  runSlaOverdueQuoteMonitor,
  slaOverdueQuoteMonitorSchedule,
  syncRecentSocialAnalyticsSchedule,
} from "../../../trigger/schedules.task"

assertAuditSafeEnvironment()

describe("F-JOBS T-074 (OD-06 & OD-07): Cron Cadences, Web+WA SLA Escalation Without specialRequests Pollution, Unified Token Refresh & Nightly PII Retention Purge", () => {
  const createdAppIds: string[] = []
  const createdQuoteIds: string[] = []
  const createdPaymentIds: string[] = []
  const createdWaAccountIds: string[] = []
  const createdWaConvIds: string[] = []
  const createdWaMsgIds: string[] = []
  const createdUserIds: string[] = []
  const createdSessionIds: string[] = []
  const createdVerificationIds: string[] = []

  after(async () => {
    if (createdWaMsgIds.length > 0) {
      await db
        .delete(whatsappMessages)
        .where(inArray(whatsappMessages.id, createdWaMsgIds))
    }
    if (createdWaConvIds.length > 0) {
      await db
        .delete(whatsappConversations)
        .where(inArray(whatsappConversations.id, createdWaConvIds))
    }
    if (createdWaAccountIds.length > 0) {
      await db
        .delete(whatsappAccounts)
        .where(inArray(whatsappAccounts.id, createdWaAccountIds))
    }
    if (createdPaymentIds.length > 0) {
      await db
        .delete(applicationPayments)
        .where(inArray(applicationPayments.id, createdPaymentIds))
    }
    if (createdQuoteIds.length > 0) {
      await db
        .delete(applicationQuotes)
        .where(inArray(applicationQuotes.id, createdQuoteIds))
    }
    if (createdAppIds.length > 0) {
      await db
        .delete(applications)
        .where(inArray(applications.id, createdAppIds))
    }
    if (createdSessionIds.length > 0) {
      await db
        .delete(sessionTable)
        .where(inArray(sessionTable.id, createdSessionIds))
    }
    if (createdVerificationIds.length > 0) {
      await db
        .delete(verificationTable)
        .where(inArray(verificationTable.id, createdVerificationIds))
    }
    if (createdUserIds.length > 0) {
      await db.delete(userTable).where(inArray(userTable.id, createdUserIds))
    }
    await closeDatabasePool()
  })

  it("aligns schedules.task.ts & sweeper cron cadences with OD-07 + Neon scale-to-zero and delegates token refresh to lib/social/token-refresh.ts", async () => {
    assert.equal(
      proactiveSocialTokenRefreshSchedule.id,
      "proactive-social-token-refresh"
    )
    assert.equal(
      syncRecentSocialAnalyticsSchedule.id,
      "sync-recent-social-analytics"
    )
    assert.equal(slaOverdueQuoteMonitorSchedule.id, "sla-overdue-quote-monitor")
    assert.equal(
      piiAndMediaRetentionPurgeSchedule.id,
      "pii-and-media-retention-purge"
    )

    const schedulesSource = await readFile(
      path.join(process.cwd(), "trigger", "schedules.task.ts"),
      "utf8"
    )
    const socialSweeperSource = await readFile(
      path.join(process.cwd(), "trigger", "publish-social-post.task.ts"),
      "utf8"
    )
    const waBroadcastSource = await readFile(
      path.join(process.cwd(), "trigger", "send-whatsapp-broadcast.task.ts"),
      "utf8"
    )

    for (const src of [schedulesSource, socialSweeperSource, waBroadcastSource]) {
      assert.equal(
        /\*\/5 \* \* \* \*/.test(src),
        false,
        "*/5 * * * * 24/7 polling cron prevents Neon scale-to-zero and violates OD-07"
      )
      assert.equal(
        /\*\/30 \* \* \* \*/.test(src),
        false,
        "*/30 * * * * 24/7 polling cron prevents Neon overnight scale-to-zero"
      )
      assert.match(
        src,
        /environments:\s*\["PRODUCTION"\]/,
        "Scheduled tasks must be restricted to PRODUCTION environment"
      )
    }

    assert.match(schedulesSource, /refreshExpiringSocialTokens/)
    const refreshSummary = await runProactiveSocialTokenRefresh({
      withinHours: 1,
    })
    assert.equal(typeof refreshSummary.checked, "number")
    assert.equal(typeof refreshSummary.refreshed, "number")
    assert.ok(Array.isArray(refreshSummary.details))
  })

  it("escalates overdue web leads (even with unsent v1 draft application_quotes row) AND WhatsApp leads via slaEscalatedAt with ZERO mutation to specialRequests", async () => {
    const suffix = crypto.randomUUID().slice(0, 8).toUpperCase()
    const now = new Date("2026-11-15T12:00:00.000Z")
    const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

    const originalPilgrimNotes =
      "Wheelchair assistance at Jeddah Airport & high-floor Makkah room please."

    // 1. Overdue Web Lead WITH an unsent v1 draft row in application_quotes (quotedAt = null)
    const [overdueWebApp] = await db
      .insert(applications)
      .values({
        referenceNumber: `ART-SLA-WEB-${suffix}`,
        source: "custom_builder",
        status: "pending_quote",
        presetMode: "complete_umrah",
        customerName: "Tariq Mehmood Family",
        customerPhone: "+923001112233",
        customerWhatsapp: "+923001112233",
        customerCity: "Lahore",
        customerEmail: "tariq@example.com",
        specialRequests: originalPilgrimNotes,
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        createdAt: thirtyHoursAgo,
        updatedAt: thirtyHoursAgo,
      })
      .returning({ id: applications.id })
    createdAppIds.push(overdueWebApp.id)

    const [draftQuote] = await db
      .insert(applicationQuotes)
      .values({
        applicationId: overdueWebApp.id,
        version: 1,
        grandTotalPkr: 0,
        quotedAt: null,
      })
      .returning({ id: applicationQuotes.id })
    createdQuoteIds.push(draftQuote.id)

    // 2. Overdue WhatsApp-originated Lead (`ART-WA-...`) without any quote row
    const [overdueWaApp] = await db
      .insert(applications)
      .values({
        referenceNumber: `ART-WA-SLA-${suffix}`,
        source: "custom_builder",
        status: "pending_quote",
        presetMode: "complete_umrah",
        customerName: "Ayesha Siddiqua",
        customerPhone: "+923219998877",
        customerWhatsapp: "+923219998877",
        customerCity: "Islamabad",
        specialRequests: null,
        adults: 4,
        children: 1,
        infants: 0,
        totalPassportCount: 5,
        bedAndSeatCount: 5,
        createdAt: thirtyHoursAgo,
        updatedAt: thirtyHoursAgo,
      })
      .returning({ id: applications.id })
    createdAppIds.push(overdueWaApp.id)

    // 3. Fresh Lead (2h old < 24h SLA) -> must NOT escalate
    const [freshApp] = await db
      .insert(applications)
      .values({
        referenceNumber: `ART-SLA-NEW-${suffix}`,
        source: "custom_builder",
        status: "pending_quote",
        presetMode: "visa_only",
        customerName: "Fresh Inquiry",
        customerPhone: "+923334445566",
        customerWhatsapp: "+923334445566",
        customerCity: "Karachi",
        adults: 1,
        children: 0,
        infants: 0,
        totalPassportCount: 1,
        bedAndSeatCount: 1,
        createdAt: twoHoursAgo,
        updatedAt: twoHoursAgo,
      })
      .returning({ id: applications.id })
    createdAppIds.push(freshApp.id)

    // 4. Already-Quoted Lead -> must NOT escalate
    const [quotedApp] = await db
      .insert(applications)
      .values({
        referenceNumber: `ART-SLA-QTD-${suffix}`,
        source: "custom_builder",
        status: "pending_quote",
        presetMode: "complete_umrah",
        customerName: "Already Quoted Family",
        customerPhone: "+923456667788",
        customerWhatsapp: "+923456667788",
        customerCity: "Lahore",
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        quoteSentAt: twoHoursAgo,
        createdAt: thirtyHoursAgo,
        updatedAt: twoHoursAgo,
      })
      .returning({ id: applications.id })
    createdAppIds.push(quotedApp.id)

    const summary1 = await runSlaOverdueQuoteMonitor({
      now,
      slaHoursOverride: 24,
      applicationIdsFilter: [
        overdueWebApp.id,
        overdueWaApp.id,
        freshApp.id,
        quotedApp.id,
      ],
      sendEmailAlerts: false,
    })

    assert.equal(summary1.newlyFlagged, 2)
    assert.ok(summary1.escalatedApplicationIds.includes(overdueWebApp.id))
    assert.ok(summary1.escalatedApplicationIds.includes(overdueWaApp.id))
    assert.equal(summary1.escalatedApplicationIds.includes(freshApp.id), false)
    assert.equal(summary1.escalatedApplicationIds.includes(quotedApp.id), false)

    const [verifiedWeb] = await db
      .select({
        slaEscalatedAt: applications.slaEscalatedAt,
        specialRequests: applications.specialRequests,
      })
      .from(applications)
      .where(eq(applications.id, overdueWebApp.id))

    assert.ok(verifiedWeb?.slaEscalatedAt instanceof Date)
    assert.equal(
      verifiedWeb?.specialRequests,
      originalPilgrimNotes,
      "Pilgrim-visible specialRequests MUST remain 100% untouched by SLA escalation"
    )

    const [verifiedWa] = await db
      .select({
        slaEscalatedAt: applications.slaEscalatedAt,
        specialRequests: applications.specialRequests,
      })
      .from(applications)
      .where(eq(applications.id, overdueWaApp.id))

    assert.ok(verifiedWa?.slaEscalatedAt instanceof Date)
    assert.equal(verifiedWa?.specialRequests, null)

    // Idempotency check: second run must escalate 0 additional dossiers
    const summary2 = await runSlaOverdueQuoteMonitor({
      now,
      slaHoursOverride: 24,
      applicationIdsFilter: [
        overdueWebApp.id,
        overdueWaApp.id,
        freshApp.id,
        quotedApp.id,
      ],
      sendEmailAlerts: false,
    })
    assert.equal(summary2.newlyFlagged, 0)
  })

  it("enforces OD-06 nightly retention purge (60d passports/, 24m unbooked leads & whatsapp-media/, 90d rawPayload scrubbing, expired sessions) while preserving 6y paid bookings", async () => {
    assert.equal(
      extractRetentionR2Key(
        "https://cdn.alramlahtravels.com/passports/2025/scan_1.jpg"
      ),
      "passports/2025/scan_1.jpg"
    )
    assert.equal(
      extractRetentionR2Key(
        "https://cdn.alramlahtravels.com/whatsapp-media/acc1/voice.ogg"
      ),
      "whatsapp-media/acc1/voice.ogg"
    )

    const suffix = crypto.randomUUID().slice(0, 8)
    const now = new Date("2026-11-15T03:00:00.000Z")
    const dayMs = 24 * 60 * 60 * 1000

    // 1. Returned pilgrim (> 60 days post-return) with passport R2 key in hajjInquiryJson
    const [returnedApp] = await db
      .insert(applications)
      .values({
        referenceNumber: `ART-RET-PASS-${suffix.toUpperCase()}`,
        source: "hajj_inquiry",
        status: "approved",
        presetMode: "hajj_consultation",
        customerName: "Returned Pilgrim Keep Booking",
        customerPhone: "+923007771111",
        customerWhatsapp: "+923007771111",
        customerCity: "Lahore",
        ksaArrivalDate: "2026-08-01",
        ksaDepartureDate: "2026-08-15",
        hajjInquiryJson: {
          passportBioKey: `https://cdn.alramlahtravels.com/passports/${suffix}/bio_page.jpg`,
          maktabTier: "A",
        },
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        createdAt: new Date(now.getTime() - 120 * dayMs),
      })
      .returning({ id: applications.id })
    createdAppIds.push(returnedApp.id)

    // 2. Expired 25-month-old UNBOOKED lead -> PII must be anonymized
    const [expiredUnbookedApp] = await db
      .insert(applications)
      .values({
        referenceNumber: `ART-RET-UNBK-${suffix.toUpperCase()}`,
        source: "custom_builder",
        status: "cancelled",
        presetMode: "complete_umrah",
        customerName: "Stale Unbooked Pilgrim PII",
        customerPhone: "+923008882222",
        customerWhatsapp: "+923008882222",
        customerCity: "Multan",
        customerEmail: "stale-lead@example.com",
        specialRequests: "Sensitive family medical note",
        adults: 1,
        children: 0,
        infants: 0,
        totalPassportCount: 1,
        bedAndSeatCount: 1,
        createdAt: new Date(now.getTime() - 760 * dayMs),
      })
      .returning({ id: applications.id })
    createdAppIds.push(expiredUnbookedApp.id)

    // 3. 3-year-old PAID / APPROVED booking -> MUST BE PRESERVED for 6-year FBR tax retention!
    const [paidTaxLedgerApp] = await db
      .insert(applications)
      .values({
        referenceNumber: `ART-RET-PAID-${suffix.toUpperCase()}`,
        source: "custom_builder",
        status: "approved",
        presetMode: "complete_umrah",
        customerName: "Protected 6Y Tax Invoice Client",
        customerPhone: "+923009993333",
        customerWhatsapp: "+923009993333",
        customerCity: "Lahore",
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        createdAt: new Date(now.getTime() - 1095 * dayMs),
      })
      .returning({ id: applications.id })
    createdAppIds.push(paidTaxLedgerApp.id)

    const [paidQuote] = await db
      .insert(applicationQuotes)
      .values({
        applicationId: paidTaxLedgerApp.id,
        version: 1,
        grandTotalPkr: 850000,
        amountPaidPkr: 850000,
        paymentStatus: "paid_in_full",
        quotedAt: new Date(now.getTime() - 1094 * dayMs),
      })
      .returning({ id: applicationQuotes.id })
    createdQuoteIds.push(paidQuote.id)

    const [paymentLedger] = await db
      .insert(applicationPayments)
      .values({
        applicationId: paidTaxLedgerApp.id,
        quoteId: paidQuote.id,
        amountPkr: 850000,
        paymentMethod: "bank_transfer",
        bankReference: `MBL-${suffix}`,
      })
      .returning({ id: applicationPayments.id })
    createdPaymentIds.push(paymentLedger.id)

    // 4. WhatsApp messages: 25m-old whatsapp-media/ object + 100d-old unredacted rawPayload
    const [waAcc] = await db
      .insert(whatsappAccounts)
      .values({
        wabaId: `waba_${suffix}`,
        phoneNumberId: `pn_${suffix}`,
        displayPhoneNumber: "+923274029701",
        name: `Retention Test WABA ${suffix}`,
        encryptedAccessToken: encrypt("test_wa_token"),
        webhookVerifyToken: `verify_${suffix}`,
      })
      .returning({ id: whatsappAccounts.id })
    createdWaAccountIds.push(waAcc.id)

    const [waConv] = await db
      .insert(whatsappConversations)
      .values({
        accountId: waAcc.id,
        contactPhone: "923005554444",
        contactName: "Retention Pilgrim",
      })
      .returning({ id: whatsappConversations.id })
    createdWaConvIds.push(waConv.id)

    const [oldMediaAndPayloadMsg] = await db
      .insert(whatsappMessages)
      .values({
        conversationId: waConv.id,
        wamid: `wamid.ret_old_${suffix}`,
        direction: "inbound",
        messageType: "image",
        body: "Old voice/image attachment",
        mediaUrl: `https://cdn.alramlahtravels.com/whatsapp-media/${suffix}/old_attachment.jpg`,
        rawPayload: {
          id: `wamid.ret_old_${suffix}`,
          type: "image",
          from: "923005554444",
          contacts: [
            { wa_id: "923005554444", profile: { name: "Secret Pilgrim Name" } },
          ],
          text: { body: "Passport number PK1234567" },
        },
        createdAt: new Date(now.getTime() - 750 * dayMs),
      })
      .returning({ id: whatsappMessages.id })
    createdWaMsgIds.push(oldMediaAndPayloadMsg.id)

    // 5. Expired vs active auth session & verification rows
    const testUserId = `usr_ret_${suffix}`
    await db.insert(userTable).values({
      id: testUserId,
      name: "Retention Test Staff",
      email: `retention-${suffix}@alramlahtravels.test`,
      emailVerified: true,
      role: "staff",
      isActive: true,
    })
    createdUserIds.push(testUserId)

    const expiredSessionId = `sess_exp_${suffix}`
    const activeSessionId = `sess_act_${suffix}`
    await db.insert(sessionTable).values([
      {
        id: expiredSessionId,
        token: `tok_exp_${suffix}`,
        userId: testUserId,
        expiresAt: new Date(now.getTime() - 5 * dayMs),
      },
      {
        id: activeSessionId,
        token: `tok_act_${suffix}`,
        userId: testUserId,
        expiresAt: new Date(now.getTime() + 5 * dayMs),
      },
    ])
    createdSessionIds.push(expiredSessionId, activeSessionId)

    const expiredVerifId = `ver_exp_${suffix}`
    await db.insert(verificationTable).values({
      id: expiredVerifId,
      identifier: `retention-${suffix}@alramlahtravels.test`,
      value: "123456",
      expiresAt: new Date(now.getTime() - 1 * dayMs),
    })
    createdVerificationIds.push(expiredVerifId)

    const deletedR2KeyCalls: string[] = []
    const purgeSummary = await runPiiAndMediaRetentionPurge({
      now,
      scopedOnly: true,
      scopedApplicationIds: [
        returnedApp.id,
        expiredUnbookedApp.id,
        paidTaxLedgerApp.id,
      ],
      scopedMessageIds: [oldMediaAndPayloadMsg.id],
      scopedSessionIds: [expiredSessionId, activeSessionId],
      scopedVerificationIds: [expiredVerifId],
      scopedLinkedDeviceIds: [],
      deleteStorageObjects: async (keys) => {
        deletedR2KeyCalls.push(...keys)
        return { deletedCount: keys.length, errors: [] }
      },
    })

    assert.equal(purgeSummary.passportMediaObjectsPurged, 1)
    assert.equal(purgeSummary.whatsappMediaObjectsPurged, 1)
    assert.ok(deletedR2KeyCalls.includes(`passports/${suffix}/bio_page.jpg`))
    assert.ok(
      deletedR2KeyCalls.includes(`whatsapp-media/${suffix}/old_attachment.jpg`)
    )
    assert.equal(purgeSummary.unbookedLeadsRedacted, 1)
    assert.equal(purgeSummary.rawPayloadsScrubbed, 1)
    assert.equal(purgeSummary.expiredSessionsDeleted, 1)
    assert.equal(purgeSummary.expiredVerificationsDeleted, 1)

    const [afterReturned] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, returnedApp.id))
    assert.equal(afterReturned?.customerName, "Returned Pilgrim Keep Booking")
    assert.equal(
      (afterReturned?.hajjInquiryJson as Record<string, unknown>)
        ?.passportBioKey,
      null
    )

    const [afterUnbooked] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, expiredUnbookedApp.id))
    assert.equal(afterUnbooked?.customerName, "[REDACTED EXPIRED LEAD]")
    assert.equal(afterUnbooked?.customerPhone, "REDACTED")
    assert.equal(afterUnbooked?.customerEmail, null)
    assert.equal(afterUnbooked?.specialRequests, null)

    const [afterPaid] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, paidTaxLedgerApp.id))
    assert.equal(afterPaid?.customerName, "Protected 6Y Tax Invoice Client")

    const [afterMsg] = await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.id, oldMediaAndPayloadMsg.id))
    assert.equal(afterMsg?.mediaUrl, null)
    assert.ok(afterMsg?.payloadRedactedAt instanceof Date)
    assert.equal(
      JSON.stringify(afterMsg?.rawPayload).includes("Secret Pilgrim Name"),
      false
    )

    const remainingSessions = await db
      .select({ id: sessionTable.id })
      .from(sessionTable)
      .where(inArray(sessionTable.id, [expiredSessionId, activeSessionId]))
    assert.deepEqual(
      remainingSessions.map((s) => s.id),
      [activeSessionId]
    )
  })
})
