import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { eq } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import {
  isSafeAutoReplyRegex,
  runWhatsappAutoResponder,
} from "../../../lib/whatsapp/auto-responder"
import { unlockOutreachCooldownForPhone } from "../../../lib/whatsapp/post-ref-detector"
import { dispatchViaWhatsAppBridge } from "../../../lib/bridges/marketing-bridges"
import {
  cleanupTestArtifacts,
  createTestWhatsappAccount,
  uniqueTestPhoneE164,
  uniqueTestWamid,
  withMockedFetch,
} from "./helpers"

describe("F-WA T-030: STOP Opt-Out Compliance, Honest Failed Statuses, Account-Scoped Rules & ReDoS Guard", () => {
  const createdAccountIds: string[] = []
  const createdOutreachIds: string[] = []
  const createdContactPhones: string[] = []

  after(async () => {
    await cleanupTestArtifacts({
      accountIds: createdAccountIds,
      outreachContactIds: createdOutreachIds,
      contactPhones: createdContactPhones,
    })
    await closeDatabasePool()
  })

  it("intercepts STOP / RUKO before cooldown-unlock and bot rules, setting do_not_contact across conversation + outreach_contacts", async () => {
    const { account } = await createTestWhatsappAccount({
      welcomeGreetingEnabled: true,
      welcomeGreetingText: "Welcome!",
    })
    createdAccountIds.push(account.id)

    const pilgrimPhoneE164 = uniqueTestPhoneE164()
    const localZeroPhone = `0${pilgrimPhoneE164.slice(3)}`
    createdContactPhones.push(
      pilgrimPhoneE164,
      localZeroPhone,
      pilgrimPhoneE164.slice(1)
    )
    const futureCooldown = new Date(Date.now() + 7 * 24 * 3600 * 1000)

    const [outreach] = await db
      .insert(schema.outreachContacts)
      .values({
        fullName: "Haji OptOut Test",
        whatsappNumber: localZeroPhone,
        interestStatus: "contacted_cooldown",
        cooldownUntil: futureCooldown,
      })
      .returning()
    createdOutreachIds.push(outreach!.id)

    const [conversation] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: account.id,
        contactPhone: pilgrimPhoneE164,
        contactName: "Haji OptOut Test",
        lastCustomerMessageAt: new Date(),
        lastMessageAt: new Date(),
      })
      .returning()

    // 1. Cooldown unlock must refuse to unlock on STOP
    const unlockOutcome = await unlockOutreachCooldownForPhone(
      pilgrimPhoneE164,
      "STOP"
    )
    assert.equal(
      unlockOutcome.unlocked,
      false,
      "STOP must never unlock outreach cooldown"
    )
    assert.equal(unlockOutcome.optedOut, true)

    let sentMetaPayloads = 0
    const stopRes = await withMockedFetch(
      async (url) => {
        if (url.includes("graph.facebook.com") && url.endsWith("/messages")) {
          sentMetaPayloads += 1
          return new Response(
            JSON.stringify({
              messages: [{ id: uniqueTestWamid("wamid.stop_ack") }],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      },
      async () =>
        runWhatsappAutoResponder({
          accountId: account.id,
          conversationId: conversation!.id,
          contactPhone: pilgrimPhoneE164,
          inboundWamid: uniqueTestWamid("wamid.in_stop"),
          inboundText: "STOP",
        })
    )

    assert.equal(stopRes.matchedTier, "OPT_OUT")
    assert.equal(stopRes.reason, "opted_out")
    assert.equal(sentMetaPayloads, 1, "Must send exactly 1 opt-out confirmation")

    const [updatedConv] = await db
      .select()
      .from(schema.whatsappConversations)
      .where(eq(schema.whatsappConversations.id, conversation!.id))
    assert.equal(updatedConv?.intentCategory, "DO_NOT_CONTACT")

    const [updatedOutreach] = await db
      .select()
      .from(schema.outreachContacts)
      .where(eq(schema.outreachContacts.id, outreach!.id))
    assert.equal(updatedOutreach?.interestStatus, "do_not_contact")
    assert.ok(updatedOutreach?.optedOutAt, "optedOutAt timestamp must be set")

    // 2. Subsequent inbound messages on an opted-out thread must NOT trigger auto-replies
    let postStopMetaCalls = 0
    const postStopRes = await withMockedFetch(
      async () => {
        postStopMetaCalls += 1
        return new Response(JSON.stringify({}), { status: 200 })
      },
      async () =>
        runWhatsappAutoResponder({
          accountId: account.id,
          conversationId: conversation!.id,
          contactPhone: pilgrimPhoneE164,
          inboundWamid: uniqueTestWamid("wamid.in_after_stop"),
          inboundText: "location",
        })
    )
    assert.equal(postStopRes.skipped, true)
    assert.equal(postStopRes.reason, "do_not_contact")
    assert.equal(postStopMetaCalls, 0)
  })

  it("records honest status = 'failed' (never wamid.sim_* / wamid.bridge_*) when Meta Graph API fails", async () => {
    const { account } = await createTestWhatsappAccount({
      welcomeGreetingEnabled: true,
      welcomeGreetingText: "Assalam-o-Alaikum from Askari 10 Lahore!",
    })
    createdAccountIds.push(account.id)

    const pilgrimPhone = uniqueTestPhoneE164()
    const [conversation] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: account.id,
        contactPhone: pilgrimPhone,
        lastCustomerMessageAt: new Date(),
        lastMessageAt: new Date(),
      })
      .returning()

    await withMockedFetch(
      async (url) => {
        if (url.includes("graph.facebook.com") && url.endsWith("/messages")) {
          return new Response(
            JSON.stringify({
              error: { message: "Service unavailable", code: 131000 },
            }),
            { status: 503, headers: { "content-type": "application/json" } }
          )
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      },
      async () => {
        const autoRes = await runWhatsappAutoResponder({
          accountId: account.id,
          conversationId: conversation!.id,
          contactPhone: pilgrimPhone,
          inboundWamid: uniqueTestWamid("wamid.in_failtest"),
          inboundText: "Assalam-o-Alaikum",
        })
        assert.equal(autoRes.triggered, false)

        const bridgeRes = await dispatchViaWhatsAppBridge({
          mode: "direct_1on1",
          senderLine: account.phoneNumberId,
          recipientIdOrPhone: pilgrimPhone,
          recipientName: "Pilgrim Fail Test",
          captionText: "Itemized quote ready",
        })
        assert.equal(bridgeRes.dispatched, false)
      }
    )

    const outboundRows = await db
      .select()
      .from(schema.whatsappMessages)
      .where(eq(schema.whatsappMessages.conversationId, conversation!.id))

    assert.ok(outboundRows.length >= 1)
    for (const row of outboundRows) {
      assert.equal(row.status, "failed")
      assert.doesNotMatch(row.wamid, /^wamid\.(sim|bridge)_/)
    }
  })

  it("scopes keyword rules strictly to whatsappAccountId and rejects nested-quantifier ReDoS REGEX patterns", async () => {
    const { account: accountA } = await createTestWhatsappAccount()
    const { account: accountB } = await createTestWhatsappAccount()
    createdAccountIds.push(accountA.id, accountB.id)

    // Rule belongs ONLY to Account B
    await db.insert(schema.whatsappAutoReplyRules).values({
      accountId: accountB.id,
      name: "Account B Exclusive Promo",
      matchType: "CONTAINS",
      keywords: ["exclusivepromo"],
      responseText: "Account B secret response",
      priority: 100,
      cooldownMinutes: 10,
      isActive: true,
    })

    const phoneA = uniqueTestPhoneE164()
    const [convA] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: accountA.id,
        contactPhone: phoneA,
        lastCustomerMessageAt: new Date(),
        lastMessageAt: new Date(),
      })
      .returning()

    const resA = await withMockedFetch(
      async () =>
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      async () =>
        runWhatsappAutoResponder({
          accountId: accountA.id,
          conversationId: convA!.id,
          contactPhone: phoneA,
          inboundWamid: uniqueTestWamid("wamid.scope_a"),
          inboundText: "Tell me about exclusivepromo",
        })
    )

    assert.notEqual(
      resA.matchedTier,
      "KEYWORD_RULE",
      "Account B keyword rule must never leak into Account A"
    )

    // ReDoS safety checks
    assert.equal(isSafeAutoReplyRegex("^(umrah|makkah)\\s+rates$"), true)
    assert.equal(isSafeAutoReplyRegex("(a+)+$"), false)
    assert.equal(isSafeAutoReplyRegex("([a-z]+)*"), false)
    assert.equal(isSafeAutoReplyRegex("(a|aa)+"), false)
    assert.equal(isSafeAutoReplyRegex("(foo)\\1"), false)
    assert.equal(isSafeAutoReplyRegex("a".repeat(125)), false)
  })
})
