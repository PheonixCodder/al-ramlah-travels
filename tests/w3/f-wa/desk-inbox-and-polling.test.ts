import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { eq } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import {
  assignWhatsappConversationAgentAction,
  getConversationMessagesAction,
  listWhatsappConversationsAction,
} from "../../../app/actions/whatsapp-crm"
import {
  isDocumentVisibilityActive,
  mergePolledConversations,
  resolveDeskRouteState,
} from "../../../lib/whatsapp/desk-tabs"
import {
  cleanupTestArtifacts,
  createTestActorSession,
  createTestWhatsappAccount,
  runServerActionAs,
  uniqueTestPhoneE164,
  uniqueTestWamid,
} from "./helpers"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WT_ROOT = path.resolve(__dirname, "../../..")

describe("F-WA T-068 & OD-07: Real Active Staff Assignment, DESC LIMIT 50 Reversed Thread Load, Read-Only Visibility-Paused Polling & ?tab Aliases", () => {
  const createdUserIds: string[] = []
  const createdAccountIds: string[] = []

  after(async () => {
    await cleanupTestArtifacts({
      userIds: createdUserIds,
      accountIds: createdAccountIds,
    })
    await closeDatabasePool()
  })

  it("queries real active staff accounts in desk/page.tsx, removes fake consultant UUIDs, and validates assignedUserId against active users", async () => {
    const deskPageSrc = fs.readFileSync(
      path.join(WT_ROOT, "app/admin/(dashboard)/desk/page.tsx"),
      "utf8"
    )
    const deskClientSrc = fs.readFileSync(
      path.join(WT_ROOT, "components/admin/hubs/desk-hub-client.tsx"),
      "utf8"
    )

    assert.match(deskPageSrc, /schema\.user\.isActive/)
    assert.match(deskPageSrc, /desc\(schema\.whatsappMessages\.createdAt\)/)
    assert.doesNotMatch(deskClientSrc, /agent_hamza|agent_bilal|staff_me/)

    const staffActor = await createTestActorSession("staff")
    const inactiveActor = await createTestActorSession("staff")
    createdUserIds.push(staffActor.userId, inactiveActor.userId)

    await db
      .update(schema.user)
      .set({ isActive: false })
      .where(eq(schema.user.id, inactiveActor.userId))

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

    // Fake non-existent consultant ID must be rejected
    const fakeAssign = await runServerActionAs(staffActor.cookie, () =>
      assignWhatsappConversationAgentAction({
        conversationId: conv!.id,
        assignedUserId: "agent_hamza",
      })
    )
    assert.equal(fakeAssign.success, false)

    // Deactivated user must be rejected
    const inactiveAssign = await runServerActionAs(staffActor.cookie, () =>
      assignWhatsappConversationAgentAction({
        conversationId: conv!.id,
        assignedUserId: inactiveActor.userId,
      })
    )
    assert.equal(inactiveAssign.success, false)

    // Real active consultant succeeds
    const validAssign = await runServerActionAs(staffActor.cookie, () =>
      assignWhatsappConversationAgentAction({
        conversationId: conv!.id,
        assignedUserId: staffActor.userId,
      })
    )
    assert.equal(validAssign.success, true)
  })

  it("loads newest 50 messages in chronological order for >50-message threads and keeps polling 100% read-only", async () => {
    const staffActor = await createTestActorSession("staff")
    createdUserIds.push(staffActor.userId)

    const { account } = await createTestWhatsappAccount()
    createdAccountIds.push(account.id)

    const [conv] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: account.id,
        contactPhone: uniqueTestPhoneE164(),
        unreadCount: 7,
        lastMessageAt: new Date(),
      })
      .returning()

    const baseTimeMs = Date.now() - 100_000
    const sixtyMessages = Array.from({ length: 60 }, (_, idx) => {
      const seq = idx + 1
      return {
        conversationId: conv!.id,
        wamid: uniqueTestWamid(`wamid.seq_${seq}`),
        direction: "inbound" as const,
        status: "delivered" as const,
        messageType: "text" as const,
        body: `Message #${seq}`,
        createdAt: new Date(baseTimeMs + seq * 1000),
      }
    })

    await db.insert(schema.whatsappMessages).values(sixtyMessages)

    const pollListRes = await runServerActionAs(staffActor.cookie, () =>
      listWhatsappConversationsAction({ accountId: account.id, limit: 50 })
    )
    assert.equal(pollListRes.success, true)

    const pollMsgRes = await runServerActionAs(staffActor.cookie, () =>
      getConversationMessagesAction(conv!.id, 50)
    )
    assert.equal(pollMsgRes.success, true)
    assert.equal(pollMsgRes.messages.length, 50)

    // Must contain messages #11 through #60 in chronological order (oldest of newest 50 -> #60 newest)
    assert.equal(pollMsgRes.messages[0]?.body, "Message #11")
    assert.equal(pollMsgRes.messages[49]?.body, "Message #60")

    // Read-only poll verification: unreadCount MUST still be 7 (zero SQL writes during poll!)
    const [afterPollConv] = await db
      .select()
      .from(schema.whatsappConversations)
      .where(eq(schema.whatsappConversations.id, conv!.id))
    assert.equal(
      afterPollConv?.unreadCount,
      7,
      "Polling getConversationMessagesAction MUST be 100% read-only and never mutate unreadCount"
    )
  })

  it("pauses on hidden visibility, preserves coexistenceMode/botMuted across poll merges, and resolves ?tab aliases", () => {
    assert.equal(isDocumentVisibilityActive("hidden"), false)
    assert.equal(isDocumentVisibilityActive("visible"), true)

    const prevState = [
      {
        id: "conv_1",
        coexistenceMode: true,
        botMuted: true,
        doNotContact: true,
        intentCategory: "PERSONAL_OR_OTHER",
        account: {
          id: "acc_1",
          isOnBizApp: true,
          accountRole: "COEXISTENCE_FOUNDER",
        },
        messages: [{ id: "m1", body: "Existing thread message" }],
      },
    ]

    const lightweightIncoming = [
      {
        id: "conv_1",
        unreadCount: 2,
      },
    ]

    const merged = mergePolledConversations(prevState, lightweightIncoming)
    assert.equal(merged[0]?.coexistenceMode, true)
    assert.equal(merged[0]?.botMuted, true)
    assert.equal(merged[0]?.doNotContact, true)
    assert.equal(merged[0]?.intentCategory, "PERSONAL_OR_OTHER")
    assert.equal(merged[0]?.messages?.length, 1)

    // Verify ?tab=inbox|kanban|pipeline|auto-replies|templates aliases
    assert.deepEqual(resolveDeskRouteState("inbox"), {
      activeTab: "inbox",
      pipelineView: "kanban",
      initialModal: null,
    })
    assert.deepEqual(resolveDeskRouteState("kanban"), {
      activeTab: "pipeline",
      pipelineView: "kanban",
      initialModal: null,
    })
    assert.deepEqual(resolveDeskRouteState("pipeline"), {
      activeTab: "pipeline",
      pipelineView: "kanban",
      initialModal: null,
    })
    assert.deepEqual(resolveDeskRouteState("auto-replies"), {
      activeTab: "inbox",
      pipelineView: "kanban",
      initialModal: "auto-replies",
    })
    assert.deepEqual(resolveDeskRouteState("templates"), {
      activeTab: "inbox",
      pipelineView: "kanban",
      initialModal: "templates",
    })
  })
})
