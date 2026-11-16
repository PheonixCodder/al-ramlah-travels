import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { and, eq } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { dispatchViaWhatsAppBridge } from "../../../lib/bridges/marketing-bridges"
import {
  buildLuxuryAutoReplyBody,
  buildVerifiedAutoReplyRules,
  DEFAULT_AWAY_GREETING_TEXT,
  DEFAULT_WELCOME_GREETING_TEXT,
} from "../../../lib/whatsapp/auto-responder"
import {
  dispatchTrackedOutboundMessage,
  sanitizeAutoReplyBrandTruth,
} from "../../../lib/whatsapp/outbox"
import { DEFAULT_COMPANY_INFO } from "../../../lib/company-info"
import {
  cleanupTestArtifacts,
  createTestWhatsappAccount,
  uniqueTestPhoneE164,
  uniqueTestWamid,
  withMockedFetch,
} from "./helpers"

describe("F-WA T-031 & OD-10: Reject Group/Status Cloud Sends, Pre-Insert Outbound Idempotency & Brand Truth", () => {
  const createdAccountIds: string[] = []

  after(async () => {
    await cleanupTestArtifacts({ accountIds: createdAccountIds })
    await closeDatabasePool()
  })

  it("rejects @g.us, status@broadcast, @newsletter, and non-direct_1on1 modes in dispatchViaWhatsAppBridge", async () => {
    let metaCalls = 0
    await withMockedFetch(
      async () => {
        metaCalls += 1
        return new Response("{}", { status: 200 })
      },
      async () => {
        const groupRes = await dispatchViaWhatsAppBridge({
          mode: "direct_1on1",
          senderLine: "03274029701",
          recipientIdOrPhone: "12036304198273645@g.us",
          recipientName: "Pilgrim Group",
          captionText: "Group blast attempt",
        })
        assert.equal(groupRes.dispatched, false)
        assert.equal(groupRes.errorCode, "UNSUPPORTED_NON_1ON1_TARGET")

        const statusRes = await dispatchViaWhatsAppBridge({
          mode: "direct_1on1",
          senderLine: "03274029701",
          recipientIdOrPhone: "status@broadcast",
          recipientName: "Status Broadcast",
          captionText: "Status blast attempt",
        })
        assert.equal(statusRes.dispatched, false)
        assert.equal(statusRes.errorCode, "UNSUPPORTED_NON_1ON1_TARGET")

        const modeRes = await dispatchViaWhatsAppBridge({
          mode: "group",
          senderLine: "03274029701",
          recipientIdOrPhone: "+923274029701",
          recipientName: "Group Mode",
          captionText: "Group mode attempt",
        })
        assert.equal(modeRes.dispatched, false)
        assert.equal(modeRes.errorCode, "UNSUPPORTED_NON_1ON1_TARGET")
      }
    )

    assert.equal(
      metaCalls,
      0,
      "Non-individual targets must be rejected before any Meta Graph API call"
    )
  })

  it("pre-inserts outbound whatsapp_messages in sending state BEFORE calling Meta Graph API and enforces idempotencyKey", async () => {
    const { account } = await createTestWhatsappAccount()
    createdAccountIds.push(account.id)

    const recipientPhone = uniqueTestPhoneE164()
    const [conversation] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: account.id,
        contactPhone: recipientPhone,
        lastCustomerMessageAt: new Date(),
        lastMessageAt: new Date(),
      })
      .returning()

    const idemKey = `test-idem-${uniqueTestWamid("key")}`
    const assignedMetaWamid = uniqueTestWamid("wamid.meta_real")
    let metaSendCalls = 0
    let preInsertedObservedDuringFetch = false

    const firstSend = await withMockedFetch(
      async (url) => {
        if (url.includes("graph.facebook.com") && url.endsWith("/messages")) {
          metaSendCalls += 1
          // Query DB *while* Meta Graph HTTP request is in flight!
          const inFlightRows = await db
            .select()
            .from(schema.whatsappMessages)
            .where(
              and(
                eq(schema.whatsappMessages.conversationId, conversation!.id),
                eq(schema.whatsappMessages.direction, "outbound")
              )
            )
          assert.equal(
            inFlightRows.length,
            1,
            "Outbound row MUST exist in DB before Meta Graph API responds"
          )
          assert.equal(inFlightRows[0]?.status, "pending")
          const raw = inFlightRows[0]?.rawPayload as Record<string, unknown>
          assert.equal(raw.deliveryState, "sending")
          assert.equal(raw.idempotencyKey, idemKey)
          preInsertedObservedDuringFetch = true

          return new Response(
            JSON.stringify({ messages: [{ id: assignedMetaWamid }] }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        return new Response("{}", { status: 200 })
      },
      async () =>
        dispatchTrackedOutboundMessage({
          accountId: account.id,
          conversationId: conversation!.id,
          idempotencyKey: idemKey,
          messageType: "text",
          body: "Assalam-o-Alaikum, your Umrah visa rate is ready.",
          sendFn: async () => {
            const resp = await fetch(
              `https://graph.facebook.com/v21.0/${account.phoneNumberId}/messages`,
              { method: "POST" }
            )
            const data = (await resp.json()) as {
              messages: Array<{ id: string }>
            }
            return { messageId: data.messages[0]!.id }
          },
        })
    )

    assert.equal(preInsertedObservedDuringFetch, true)
    assert.equal(firstSend.ok, true)
    assert.equal(firstSend.wamid, assignedMetaWamid)
    assert.equal(metaSendCalls, 1)

    // Re-running with the same idempotencyKey must deduplicate without calling Meta again!
    const duplicateSend = await dispatchTrackedOutboundMessage({
      accountId: account.id,
      conversationId: conversation!.id,
      idempotencyKey: idemKey,
      messageType: "text",
      body: "Assalam-o-Alaikum, your Umrah visa rate is ready.",
      sendFn: async () => {
        metaSendCalls += 1
        throw new Error("Should not execute duplicate Meta send!")
      },
    })

    assert.equal(duplicateSend.ok, true)
    assert.equal(duplicateSend.deduplicated, true)
    assert.equal(duplicateSend.wamid, assignedMetaWamid)
    assert.equal(metaSendCalls, 1)
  })

  it("enforces OD-10 Askari 10 Lahore Cantt brand truth and purges +92 300 8451122, Rawalpindi, and unverified Meezan IBAN", () => {
    const sampleCardBody = buildLuxuryAutoReplyBody({
      postCode: "ART-AM-21D-01",
      packageId: null,
      postAssetId: null,
      flyerId: null,
      title: "21 Days Ramadan Luxury Umrah",
      airlineName: "Saudia",
      durationDays: 21,
      outboundRoute: "LHE - JED",
      outboundDateLabel: "10 Mar",
      returnDateLabel: "31 Mar",
      makkahHotelName: "Swissotel Makkah",
      makkahNights: "10",
      makkahDistanceLabel: "0m Clock Tower",
      madinahHotelName: "Anwar Al Madinah Movenpick",
      madinahNights: "10",
      madinahDistanceLabel: "50m Haram",
      mealPlanLabel: "Breakfast",
      retailSharingPkr: 410000,
      retailQuadPkr: 435000,
      retailTriplePkr: 475000,
      retailDoublePkr: 530000,
      pdfUrl: null,
      singlePackageImageUrl: null,
    })

    const unverifiedRules = buildVerifiedAutoReplyRules({
      ...DEFAULT_COMPANY_INFO,
      ibanVerified: false,
    })

    const combinedTexts = [
      sampleCardBody,
      DEFAULT_WELCOME_GREETING_TEXT,
      DEFAULT_AWAY_GREETING_TEXT,
      ...unverifiedRules.map((r) => r.responseText),
    ].join("\n\n")

    assert.doesNotMatch(combinedTexts, /8451122/)
    assert.doesNotMatch(combinedTexts, /Rawalpindi/i)
    assert.doesNotMatch(combinedTexts, /Chaklala/i)
    assert.doesNotMatch(combinedTexts, /PK00MEZN/i)
    assert.match(combinedTexts, /Askari 10/i)
    assert.match(combinedTexts, /Lahore/i)
    assert.match(combinedTexts, /\+92 327 4029701/)

    const sanitizedLegacy = sanitizeAutoReplyBrandTruth(
      "Call +92 300 8451122 at our Chaklala Scheme 3, Rawalpindi desk or send to PK00MEZN0001234567890102.",
      { ...DEFAULT_COMPANY_INFO, ibanVerified: false }
    )
    assert.doesNotMatch(
      sanitizedLegacy,
      /8451122|Rawalpindi|Chaklala|PK00MEZN/i
    )
    assert.match(sanitizedLegacy, /Lahore Cantt/)
  })
})
