import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import {
  buildBroadcastBatchConfirmationSummary,
  parseWhatsappBroadcastCsv,
} from "../../../lib/whatsapp/template-variables"
import { shouldAutoScrollThreadOnUpdate } from "../../../lib/whatsapp/desk-tabs"
import { createAndQueueWhatsappBroadcastAction } from "../../../app/actions/whatsapp-crm"
import {
  cleanupTestArtifacts,
  createTestActorSession,
  createTestWhatsappAccount,
  runServerActionAs,
  uniqueTestPhoneE164,
} from "./helpers"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WT_ROOT = path.resolve(__dirname, "../../..")

describe("F-WA T-088 & OD-07: RFC-4180 CSV Parser, Broadcast Recipient Count & SuperAdmin Guard, Accessible Base UI Studio Dialog & Single-Flight Scroll Preservation", () => {
  const createdUserIds: string[] = []
  const createdAccountIds: string[] = []

  after(async () => {
    await cleanupTestArtifacts({
      userIds: createdUserIds,
      accountIds: createdAccountIds,
    })
    await closeDatabasePool()
  })

  it("parses apostrophes (O'Connor), UTF-8 names, WhatsApp/Mobile headers, and RFC-4180 quoted commas in parseWhatsappBroadcastCsv", () => {
    const csvSample = [
      "WhatsApp,Full Name,City,Package",
      `0327-4029701,"O'Connor, Liam",Lahore,"15-Day, Haram View"`,
      `+92 319 0462638,"حاجی محمد طارق",Askari 10,Ramadan VIP`,
    ].join("\r\n")

    const parsed = parseWhatsappBroadcastCsv(csvSample)
    assert.equal(parsed.recipients.length, 2)
    assert.equal(parsed.validCount, 2)

    assert.equal(parsed.recipients[0]?.phone, "+923274029701")
    assert.equal(parsed.recipients[0]?.name, "O'Connor, Liam")
    assert.ok(parsed.recipients[0]?.customParams?.includes("15-Day, Haram View"))

    assert.equal(parsed.recipients[1]?.phone, "+923190462638")
    assert.equal(parsed.recipients[1]?.name, "حاجی محمد طارق")

    // Also support 'Mobile' column header
    const mobileHeaderCsv = `Mobile,Pilgrim Name\n03001112233,Ayesha Siddiqui`
    const mobileParsed = parseWhatsappBroadcastCsv(mobileHeaderCsv)
    assert.equal(mobileParsed.recipients.length, 1)
    assert.equal(mobileParsed.recipients[0]?.phone, "+923001112233")
    assert.equal(mobileParsed.recipients[0]?.name, "Ayesha Siddiqui")

    const summary = buildBroadcastBatchConfirmationSummary({
      category: "MARKETING",
      recipientCount: 250,
    })
    assert.equal(summary.isPaidMarketing, true)
    assert.equal(summary.requiresExplicitConfirmation, true)
    assert.equal(summary.recipientCount, 250)
    assert.match(summary.warningMessage, /250/)
  })

  it("enforces requireSuperAdmin() and recipient count confirmation on bulk Meta broadcast launch", async () => {
    const staffActor = await createTestActorSession("staff")
    const superAdminActor = await createTestActorSession("super_admin")
    createdUserIds.push(staffActor.userId, superAdminActor.userId)

    const { account } = await createTestWhatsappAccount()
    createdAccountIds.push(account.id)

    const [tpl] = await db
      .insert(schema.whatsappTemplates)
      .values({
        accountId: account.id,
        metaTemplateId: `meta_bcast_${Date.now()}`,
        name: `eid_umrah_${Date.now()}`,
        language: "en_US",
        category: "MARKETING",
        status: "APPROVED",
        headerType: "NONE",
        bodyText: "Assalam-o-Alaikum {{1}}, special Umrah seats open.",
      })
      .returning()

    const recipients = [
      { phone: uniqueTestPhoneE164(), name: "O'Connor, Liam" },
      { phone: uniqueTestPhoneE164(), name: "Haji Tariq" },
    ]

    // 1. Staff role MUST be rejected (OD-07)
    await assert.rejects(
      () =>
        runServerActionAs(staffActor.cookie, () =>
          createAndQueueWhatsappBroadcastAction({
            accountId: account.id,
            templateId: tpl!.id,
            name: "Staff Unauthorized Broadcast",
            recipients,
          })
        ),
      /FORBIDDEN|Super Admin/i
    )

    // 2. Super Admin with mismatched confirmedRecipientCount MUST be rejected with CONFIRMATION_COUNT_MISMATCH
    const mismatchAttempt = await runServerActionAs(
      superAdminActor.cookie,
      () =>
        createAndQueueWhatsappBroadcastAction({
          accountId: account.id,
          templateId: tpl!.id,
          name: "Count Mismatch Broadcast",
          recipients,
          confirmedRecipientCount: 999,
        })
    )
    assert.equal(mismatchAttempt.success, false)
    assert.equal(mismatchAttempt.code, "CONFIRMATION_COUNT_MISMATCH")
  })

  it("replaces raw fixed inset-0 overlay in WhatsappAutoReplyStudio with @base-ui/react Dialog and guards DeskHubClient with pollInFlightRef + scroll preservation", () => {
    const studioSrc = fs.readFileSync(
      path.join(
        WT_ROOT,
        "components/admin/desk/whatsapp-auto-reply-studio.tsx"
      ),
      "utf8"
    )
    assert.match(studioSrc, /from "@\/components\/ui\/dialog"/)
    assert.match(studioSrc, /<Dialog\b/)
    assert.match(studioSrc, /<DialogContent\b/)
    assert.match(studioSrc, /<DialogTitle\b/)
    assert.doesNotMatch(
      studioSrc,
      /fixed inset-0/,
      "WhatsappAutoReplyStudio must not use raw <div className='fixed inset-0'> overlay"
    )
    assert.doesNotMatch(studioSrc, /Rawalpindi|Chaklala/i)
    assert.doesNotMatch(studioSrc, /\bdark:/)

    const deskClientSrc = fs.readFileSync(
      path.join(WT_ROOT, "components/admin/hubs/desk-hub-client.tsx"),
      "utf8"
    )
    assert.match(
      deskClientSrc,
      /pollInFlightRef/,
      "DeskHubClient must guard polling with single-flight pollInFlightRef"
    )
    assert.match(deskClientSrc, /shouldAutoScrollThreadOnUpdate/)

    // When operator scrolled up to read earlier messages (scrollTop=100, clientHeight=400, scrollHeight=1200 -> 700px from bottom),
    // background poll update MUST NOT yank scroll to bottom!
    assert.equal(
      shouldAutoScrollThreadOnUpdate({
        conversationChanged: false,
        forceScrollToBottom: false,
        scrollHeight: 1200,
        scrollTop: 100,
        clientHeight: 400,
      }),
      false
    )

    // When near bottom (scrollTop=740, clientHeight=400, scrollHeight=1200 -> 60px from bottom), auto-scroll proceeds
    assert.equal(
      shouldAutoScrollThreadOnUpdate({
        conversationChanged: false,
        forceScrollToBottom: false,
        scrollHeight: 1200,
        scrollTop: 740,
        clientHeight: 400,
      }),
      true
    )

    // Switching conversation or sending an outbound reply always scrolls to bottom
    assert.equal(
      shouldAutoScrollThreadOnUpdate({
        conversationChanged: true,
        forceScrollToBottom: false,
        scrollHeight: 1200,
        scrollTop: 0,
        clientHeight: 400,
      }),
      true
    )
  })
})
