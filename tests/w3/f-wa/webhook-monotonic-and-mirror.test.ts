import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { eq } from "drizzle-orm"
import { NextRequest } from "next/server"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import {
  GET as whatsappWebhookGet,
  POST as whatsappWebhookPost,
} from "../../../app/api/webhooks/whatsapp/route"
import { setWebhookInboundDispatcherForTests } from "../../../lib/whatsapp/webhook-dispatcher"
import { mirrorInboundWhatsAppMediaToR2 } from "../../../lib/whatsapp/media-mirror"
import { dispatchTrackedOutboundMessage } from "../../../lib/whatsapp/outbox"
import {
  cleanupTestArtifacts,
  computeMetaSignature,
  createTestWhatsappAccount,
  uniqueTestPhoneE164,
  uniqueTestWamid,
  withMockedFetch,
} from "./helpers"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WT_ROOT = path.resolve(__dirname, "../../..")

describe("F-WA T-065 & OD-06: Atomic Webhook Upserts, Monotonic Status Rank, Token Hardening & Private Media Mirror", () => {
  const createdAccountIds: string[] = []

  after(async () => {
    setWebhookInboundDispatcherForTests(null)
    await cleanupTestArtifacts({ accountIds: createdAccountIds })
    await closeDatabasePool()
  })

  it("rejects linked_device_default_token verify challenges and ignores unknown phone_number_id webhooks", async () => {
    const { account, appSecretPlain } = await createTestWhatsappAccount({
      webhookVerifyToken: "linked_device_default_token",
    })
    createdAccountIds.push(account.id)

    const badVerifyReq = new NextRequest(
      "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=linked_device_default_token&hub.challenge=123456"
    )
    const badVerifyRes = await whatsappWebhookGet(badVerifyReq)
    assert.equal(badVerifyRes.status, 403)

    // Unknown phone_number_id must NOT fall back to default account or create phantom conversations
    const unknownWamid = uniqueTestWamid("wamid.unknown_pnid")
    const unknownBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_unknown_999",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "pnid_does_not_exist_999999" },
                messages: [
                  {
                    id: unknownWamid,
                    from: "923270009999",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "Phantom webhook" },
                  },
                ],
              },
            },
          ],
        },
      ],
    })

    const unknownReq = new NextRequest(
      "http://localhost:3000/api/webhooks/whatsapp",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": computeMetaSignature(
            unknownBody,
            appSecretPlain
          ),
        },
        body: unknownBody,
      }
    )
    const unknownRes = await whatsappWebhookPost(unknownReq)
    assert.equal(unknownRes.status, 200)

    const leakedRows = await db
      .select()
      .from(schema.whatsappMessages)
      .where(eq(schema.whatsappMessages.wamid, unknownWamid))
    assert.equal(leakedRows.length, 0)
  })

  it("deduplicates duplicate inbound wamids atomically and enforces monotonic status rank + early status buffering", async () => {
    setWebhookInboundDispatcherForTests(async () => ({
      dispatched: true,
      mode: "queued_async",
    }))

    const { account, appSecretPlain } = await createTestWhatsappAccount()
    createdAccountIds.push(account.id)

    const contactPhone = uniqueTestPhoneE164()
    const duplicateWamid = uniqueTestWamid("wamid.dup_in")

    const makeInboundPayload = () =>
      JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: account.wabaId,
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: account.phoneNumberId },
                  contacts: [
                    {
                      wa_id: contactPhone.replace(/^\+/, ""),
                      profile: { name: "Idempotent Pilgrim" },
                    },
                  ],
                  messages: [
                    {
                      id: duplicateWamid,
                      from: contactPhone.replace(/^\+/, ""),
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: "text",
                      text: { body: "Assalam-o-Alaikum" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

    const body1 = makeInboundPayload()
    await whatsappWebhookPost(
      new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": computeMetaSignature(body1, appSecretPlain),
        },
        body: body1,
      })
    )
    await whatsappWebhookPost(
      new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": computeMetaSignature(body1, appSecretPlain),
        },
        body: body1,
      })
    )

    const [conv] = await db
      .select()
      .from(schema.whatsappConversations)
      .where(eq(schema.whatsappConversations.accountId, account.id))
    assert.equal(
      conv?.unreadCount,
      1,
      "Duplicate webhook wamid must increment unreadCount only once"
    )

    // Test early status receipt arriving BEFORE outbound message finishes DB update,
    // followed by out-of-order lower status ('sent' after 'read')!
    const earlyOutboundWamid = uniqueTestWamid("wamid.early_out")
    const sendStatusWebhook = async (status: "sent" | "delivered" | "read") => {
      const statusBody = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: account.wabaId,
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: account.phoneNumberId },
                  statuses: [
                    {
                      id: earlyOutboundWamid,
                      status,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
      const r = await whatsappWebhookPost(
        new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-hub-signature-256": computeMetaSignature(
              statusBody,
              appSecretPlain
            ),
          },
          body: statusBody,
        })
      )
      assert.equal(r.status, 200)
    }

    // 1. 'read' arrives EARLY before outbound message row has earlyOutboundWamid
    await sendStatusWebhook("read")

    // 2. Outbound send completes and consumes buffered 'read' receipt!
    const tracked = await dispatchTrackedOutboundMessage({
      accountId: account.id,
      conversationId: conv!.id,
      idempotencyKey: `early-test-${earlyOutboundWamid}`,
      messageType: "text",
      body: "Quote sent",
      sendFn: async () => ({ messageId: earlyOutboundWamid }),
    })
    assert.equal(tracked.ok, true)

    const [afterEarlyConsume] = await db
      .select()
      .from(schema.whatsappMessages)
      .where(eq(schema.whatsappMessages.wamid, earlyOutboundWamid))
    assert.equal(
      afterEarlyConsume?.status,
      "read",
      "Buffered early 'read' receipt must be applied when outbound wamid lands"
    )

    // 3. Late out-of-order 'delivered' and 'sent' webhooks MUST NOT downgrade 'read'
    await sendStatusWebhook("delivered")
    await sendStatusWebhook("sent")

    const [afterLateCallbacks] = await db
      .select()
      .from(schema.whatsappMessages)
      .where(eq(schema.whatsappMessages.wamid, earlyOutboundWamid))
    assert.equal(
      afterLateCallbacks?.status,
      "read",
      "Monotonic rank guard must prevent 'delivered'/'sent' from regressing 'read'"
    )
  })

  it("uses private whatsapp-media/ R2 prefix and returns explicit media_status = 'failed' instead of fake URLs on error", async () => {
    const mirrorSrc = fs.readFileSync(
      path.join(WT_ROOT, "lib/whatsapp/media-mirror.ts"),
      "utf8"
    )
    assert.match(mirrorSrc, /whatsapp-media\//)
    assert.doesNotMatch(mirrorSrc, /inbound-whatsapp\//)
    assert.doesNotMatch(mirrorSrc, /AL_RAMLAH_SIM_MEDIA_BINARY/)

    const { account } = await createTestWhatsappAccount()
    createdAccountIds.push(account.id)

    const [conv] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: account.id,
        contactPhone: uniqueTestPhoneE164(),
        lastMessageAt: new Date(),
      })
      .returning()

    const mediaWamid = uniqueTestWamid("wamid.media_fail")
    const [msg] = await db
      .insert(schema.whatsappMessages)
      .values({
        conversationId: conv!.id,
        wamid: mediaWamid,
        direction: "inbound",
        status: "delivered",
        messageType: "image",
        rawMediaId: "meta_media_broken_404",
      })
      .returning()

    const mirrorRes = await withMockedFetch(
      async () =>
        new Response(
          JSON.stringify({ error: { message: "Media expired", code: 100 } }),
          { status: 404, headers: { "content-type": "application/json" } }
        ),
      async () =>
        mirrorInboundWhatsAppMediaToR2({
          messageId: msg!.id,
          accountId: account.id,
          conversationId: conv!.id,
          wamid: mediaWamid,
          rawMediaId: "meta_media_broken_404",
        })
    )

    assert.equal(mirrorRes.success, false)
    assert.equal(mirrorRes.media_status, "failed")
    assert.equal(mirrorRes.mediaUrl, undefined)

    const [updatedMsg] = await db
      .select()
      .from(schema.whatsappMessages)
      .where(eq(schema.whatsappMessages.id, msg!.id))
    assert.equal(updatedMsg?.mediaUrl, null)
    const rawMeta = updatedMsg?.rawPayload as Record<string, unknown>
    assert.equal(rawMeta.media_status, "failed")
  })
})
