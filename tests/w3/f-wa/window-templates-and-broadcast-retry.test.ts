import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { eq } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import {
  decrypt,
  encrypt,
  getDerivedEncryptionKey,
  isMaskedOrEncryptedToken,
  maskAccessToken,
} from "../../../lib/whatsapp/encryption"
import { buildMetaTemplateComponentsPayload } from "../../../lib/whatsapp/meta-api"
import {
  buildSafeUnverifiedBankReplyText,
  buildVerifiedBankReplyText,
} from "../../../lib/whatsapp/outbox"
import {
  dispatchViaWhatsAppBridge,
  normalizeSocialBridgePlatform,
} from "../../../lib/bridges/marketing-bridges"
import {
  retryFailedWhatsappBroadcastRecipientsAction,
  sendWhatsAppInteractiveButtonsAction,
  sendWhatsAppReactionAction,
  sendWhatsappConversationReplyAction,
  upsertWhatsappAccountAction,
} from "../../../app/actions/whatsapp-crm"
import { DEFAULT_COMPANY_INFO } from "../../../lib/company-info"
import {
  cleanupTestArtifacts,
  createTestActorSession,
  createTestWhatsappAccount,
  runServerActionAs,
  uniqueTestPhoneE164,
  uniqueTestWamid,
  withMockedFetch,
} from "./helpers"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WT_ROOT = path.resolve(__dirname, "../../..")

describe("F-WA T-067 & OD-10: 24h Window Gate, Template Header/Samples, Broadcast Retry Aggregates, Vault Delegation, NEEDS_REAUTH, GMB & IBAN Gate", () => {
  const createdUserIds: string[] = []
  const createdAccountIds: string[] = []

  after(async () => {
    await cleanupTestArtifacts({
      userIds: createdUserIds,
      accountIds: createdAccountIds,
    })
    await closeDatabasePool()
  })

  it("blocks freeform text, interactive buttons, reactions & bridge sends outside 24h with WINDOW_CLOSED_TEMPLATE_REQUIRED", async () => {
    const staffActor = await createTestActorSession("staff")
    createdUserIds.push(staffActor.userId)

    const { account } = await createTestWhatsappAccount()
    createdAccountIds.push(account.id)

    const stalePhone = uniqueTestPhoneE164()
    const expired26hAgo = new Date(Date.now() - 26 * 3600 * 1000)

    const [expiredConv] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: account.id,
        contactPhone: stalePhone,
        lastCustomerMessageAt: expired26hAgo,
        lastMessageAt: expired26hAgo,
      })
      .returning()

    const textAttempt = await runServerActionAs(staffActor.cookie, () =>
      sendWhatsappConversationReplyAction({
        conversationId: expiredConv!.id,
        messageType: "text",
        text: "Freeform outside 24h should fail",
      })
    )
    assert.equal(textAttempt.success, false)
    assert.equal(textAttempt.code, "WINDOW_CLOSED_TEMPLATE_REQUIRED")

    const buttonsAttempt = await runServerActionAs(staffActor.cookie, () =>
      sendWhatsAppInteractiveButtonsAction({
        conversationId: expiredConv!.id,
        bodyText: "Choose option",
        buttons: [{ id: "b1", title: "Option 1" }],
      })
    )
    assert.equal(buttonsAttempt.success, false)
    assert.equal(buttonsAttempt.code, "WINDOW_CLOSED_TEMPLATE_REQUIRED")

    const reactionAttempt = await runServerActionAs(staffActor.cookie, () =>
      sendWhatsAppReactionAction({
        conversationId: expiredConv!.id,
        messageId: "wamid.old_msg",
        emoji: "👍",
      })
    )
    assert.equal(reactionAttempt.success, false)
    assert.equal(reactionAttempt.code, "WINDOW_CLOSED_TEMPLATE_REQUIRED")

    const bridgeAttempt = await dispatchViaWhatsAppBridge({
      mode: "direct_1on1",
      senderLine: account.phoneNumberId,
      recipientIdOrPhone: stalePhone,
      recipientName: "Stale Pilgrim",
      captionText: "Outreach outside 24h without HSM template",
    })
    assert.equal(bridgeAttempt.dispatched, false)
    assert.equal(bridgeAttempt.errorCode, "WINDOW_CLOSED_TEMPLATE_REQUIRED")
  })

  it("includes IMAGE/DOCUMENT header_handle + body_text samples in Meta templates and verifies MetaTemplateBuilderModal", () => {
    const components = buildMetaTemplateComponentsPayload({
      name: "umrah_doc_quote",
      language: "en_US",
      category: "UTILITY",
      headerType: "DOCUMENT",
      headerHandle: "4::cGRmX3NhbXBsZV9oYW5kbGU=",
      bodyText: "Salam {{1}}, your {{2}} Umrah itinerary is attached.",
      bodyExamples: ["Haji Usman", "15-Day Haram View"],
      footerText: "Reply STOP to opt out",
    })

    const headerComp = components.find((c) => c.type === "HEADER")
    assert.ok(headerComp)
    assert.equal(headerComp.format, "DOCUMENT")
    assert.deepEqual(headerComp.example, {
      header_handle: ["4::cGRmX3NhbXBsZV9oYW5kbGU="],
    })

    const bodyComp = components.find((c) => c.type === "BODY")
    assert.ok(bodyComp)
    assert.deepEqual(bodyComp.example, {
      body_text: [["Haji Usman", "15-Day Haram View"]],
    })

    const modalSrc = fs.readFileSync(
      path.join(
        WT_ROOT,
        "components/admin/desk/meta-template-builder-modal.tsx"
      ),
      "utf8"
    )
    assert.match(modalSrc, /DOCUMENT/)
    assert.match(modalSrc, /IMAGE/)
    assert.match(modalSrc, /headerHandle/)
    assert.match(modalSrc, /bodyExamples/)
  })

  it("delegates encryption to vault v2 GCM, skips re-encrypting masked tokens, marks NEEDS_REAUTH on Meta 190, maps google_business -> gmb, and gates IBAN", async () => {
    const cipherV2 = encrypt("EAA_SUPER_SECRET_META_ACCESS_TOKEN_123456")
    assert.ok(cipherV2.startsWith("v2:"))
    assert.equal(
      decrypt(cipherV2),
      "EAA_SUPER_SECRET_META_ACCESS_TOKEN_123456"
    )

    // Legacy 3-part hex GCM read compatibility (`ivHex:ctHex:tagHex` derived via getDerivedEncryptionKey())
    const legacyKey = getDerivedEncryptionKey()
    const legacyIv = crypto.randomBytes(12)
    const legacyCipher = crypto.createCipheriv(
      "aes-256-gcm",
      legacyKey,
      legacyIv
    )
    const legacyCt = Buffer.concat([
      legacyCipher.update("LEGACY_WABA_TOKEN_99", "utf8"),
      legacyCipher.final(),
    ])
    const legacyTag = legacyCipher.getAuthTag()
    const legacyPayload = `${legacyIv.toString("hex")}:${legacyCt.toString("hex")}:${legacyTag.toString("hex")}`
    assert.equal(decrypt(legacyPayload), "LEGACY_WABA_TOKEN_99")

    // 2-part CBC must hard-fail
    assert.throws(() => decrypt("aaaa:bbbb"))

    const masked = maskAccessToken("EAABcdefghijklmnop9876")
    assert.equal(isMaskedOrEncryptedToken(masked), true)
    assert.equal(isMaskedOrEncryptedToken(cipherV2), true)

    // Upsert account with masked token must preserve original encrypted token!
    const superAdmin = await createTestActorSession("super_admin")
    createdUserIds.push(superAdmin.userId)
    const { account, accessTokenPlain } = await createTestWhatsappAccount()
    createdAccountIds.push(account.id)

    const updateRes = await runServerActionAs(superAdmin.cookie, () =>
      upsertWhatsappAccountAction({
        id: account.id,
        name: "Updated Lahore WABA Name",
        phoneNumberId: account.phoneNumberId,
        wabaId: account.wabaId,
        displayPhoneNumber: account.displayPhoneNumber,
        accessToken: masked,
        isDefault: false,
      })
    )
    assert.equal(updateRes.success, true)

    const [reloadedAcc] = await db
      .select()
      .from(schema.whatsappAccounts)
      .where(eq(schema.whatsappAccounts.id, account.id))
    assert.equal(
      decrypt(reloadedAcc!.encryptedAccessToken),
      accessTokenPlain,
      "Masked token submission MUST NOT overwrite stored secret with bullet characters"
    )

    // Meta 190 OAuth error marks whatsapp_accounts NEEDS_REAUTH
    const [activeConv] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: account.id,
        contactPhone: uniqueTestPhoneE164(),
        lastCustomerMessageAt: new Date(),
        lastMessageAt: new Date(),
      })
      .returning()

    await withMockedFetch(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "Error validating access token: Session has expired",
              code: 190,
            },
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        ),
      async () =>
        runServerActionAs(superAdmin.cookie, () =>
          sendWhatsappConversationReplyAction({
            conversationId: activeConv!.id,
            messageType: "text",
            text: "Test 190 reauth marker",
          })
        )
    )

    const [after190] = await db
      .select()
      .from(schema.whatsappAccounts)
      .where(eq(schema.whatsappAccounts.id, account.id))
    assert.equal(after190?.qualityRating, "NEEDS_REAUTH")

    // google_business -> gmb mapping + OD-10 IBAN gate
    assert.equal(normalizeSocialBridgePlatform("google_business"), "gmb")
    assert.equal(normalizeSocialBridgePlatform("gmb"), "gmb")
    assert.doesNotMatch(
      buildSafeUnverifiedBankReplyText({
        ...DEFAULT_COMPANY_INFO,
        ibanVerified: false,
      }),
      /PK\d{2}[A-Z]{4}/
    )
    assert.match(
      buildVerifiedBankReplyText({
        ...DEFAULT_COMPANY_INFO,
        ibanVerified: true,
        bankName: "Meezan Bank Limited",
        accountTitle: "Al Ramlah Travels (Pvt) Ltd",
        officialIban: "PK36MEZN0002010109876543",
      }),
      /PK36MEZN0002010109876543/
    )
  })

  it("recomputes broadcast sentCount/failedCount from SQL recipient aggregates on 1-click retry", async () => {
    const superAdmin = await createTestActorSession("super_admin")
    createdUserIds.push(superAdmin.userId)

    const { account } = await createTestWhatsappAccount()
    createdAccountIds.push(account.id)

    const [tpl] = await db
      .insert(schema.whatsappTemplates)
      .values({
        accountId: account.id,
        metaTemplateId: `meta_tpl_${Date.now()}`,
        name: `ramadan_offer_${Date.now()}`,
        language: "en_US",
        category: "MARKETING",
        status: "APPROVED",
        headerType: "NONE",
        bodyText: "Salam {{1}}, Umrah offer ready.",
      })
      .returning()

    const [broadcast] = await db
      .insert(schema.whatsappBroadcasts)
      .values({
        accountId: account.id,
        templateId: tpl!.id,
        name: "Test Aggregate Retry Broadcast",
        templateName: tpl!.name,
        templateLanguage: "en_US",
        status: "completed",
        totalRecipients: 2,
        sentCount: 99, // Intentionally drifted counter to prove SQL aggregate recomputation!
        failedCount: 99,
      })
      .returning()

    await db.insert(schema.whatsappBroadcastRecipients).values([
      {
        broadcastId: broadcast!.id,
        contactPhone: uniqueTestPhoneE164(),
        templateParams: { "1": "Already Sent Pilgrim" },
        status: "sent",
        wamid: uniqueTestWamid("wamid.bcast_ok"),
      },
      {
        broadcastId: broadcast!.id,
        contactPhone: uniqueTestPhoneE164(),
        templateParams: { "1": "Failed Pilgrim" },
        status: "failed",
        errorMessage: "Rate limit",
      },
    ])

    const retryRes = await withMockedFetch(
      async (url) => {
        if (url.includes("graph.facebook.com") && url.endsWith("/messages")) {
          return new Response(
            JSON.stringify({
              messages: [{ id: uniqueTestWamid("wamid.bcast_retried") }],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        return new Response("{}", { status: 200 })
      },
      async () =>
        runServerActionAs(superAdmin.cookie, () =>
          retryFailedWhatsappBroadcastRecipientsAction({
            broadcastId: broadcast!.id,
          })
        )
    )

    assert.equal(retryRes.success, true)

    const [recomputedBroadcast] = await db
      .select()
      .from(schema.whatsappBroadcasts)
      .where(eq(schema.whatsappBroadcasts.id, broadcast!.id))

    assert.equal(recomputedBroadcast?.totalRecipients, 2)
    assert.equal(
      recomputedBroadcast?.sentCount,
      2,
      "sentCount must be recomputed from recipient rows (not incremented onto drifted 99)"
    )
    assert.equal(recomputedBroadcast?.failedCount, 0)
  })
})
