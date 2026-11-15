import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { eq, inArray } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import {
  getLinkedDeviceStatus,
  initBaileysSocket,
  sendLinkedDeviceMessage,
} from "../../../lib/whatsapp/linked-device"
import {
  deleteLinkedDeviceSessionAction,
  disconnectLinkedDeviceAction,
  purgeFakeMarketingChannelsAction,
  startLinkedDeviceConnectionAction,
} from "../../../app/actions/whatsapp-linked-device"
import {
  cleanupTestArtifacts,
  createTestActorSession,
  createTestWhatsappAccount,
  runServerActionAs,
} from "./helpers"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WT_ROOT = path.resolve(__dirname, "../../..")

describe("F-WA T-032 & OD-01 Option A: Baileys Socket Sunset, Linked Session Key Wipe & Safe Channel Purge", () => {
  const createdUserIds: string[] = []
  const createdAccountIds: string[] = []
  const createdChannelIds: string[] = []
  const createdSessionKeys: string[] = []

  after(async () => {
    await cleanupTestArtifacts({
      userIds: createdUserIds,
      accountIds: createdAccountIds,
      channelIds: createdChannelIds,
      linkedSessionKeys: createdSessionKeys,
    })
    await closeDatabasePool()
  })

  it("sunsets runtime @whiskeysockets/baileys WebSockets in favor of manual_assisted_queue while keeping backward-compatible symbols", async () => {
    const linkedDeviceSrc = fs.readFileSync(
      path.join(WT_ROOT, "lib/whatsapp/linked-device.ts"),
      "utf8"
    )
    const authPostgresSrc = fs.readFileSync(
      path.join(WT_ROOT, "lib/whatsapp/linked-device-auth-postgres.ts"),
      "utf8"
    )

    assert.doesNotMatch(linkedDeviceSrc, /@whiskeysockets\/baileys/)
    assert.doesNotMatch(authPostgresSrc, /@whiskeysockets\/baileys/)

    const status = await getLinkedDeviceStatus("nonexistent-sunset-check")
    assert.equal(status.isConnected, false)
    assert.equal(status.mode, "manual_assisted_queue")

    const qrRes = await initBaileysSocket({
      sessionKey: "nonexistent-sunset-check",
      mode: "qr",
    })
    assert.equal(qrRes.socket, null)
    assert.equal(qrRes.status, "disconnected")
    assert.equal(qrRes.mode, "manual_assisted_queue")

    await assert.rejects(
      () =>
        sendLinkedDeviceMessage({
          jid: "12036304198273645@g.us",
          text: "Test",
        }),
      /MANUAL_ASSISTED_QUEUE_REQUIRED|OD-01/
    )
  })

  it("enforces requireSuperAdmin() on delete/disconnect actions and cleanly wipes encrypted auth keys without deleting CLOUD_API accounts", async () => {
    const staffActor = await createTestActorSession("staff")
    const superAdminActor = await createTestActorSession("super_admin")
    createdUserIds.push(staffActor.userId, superAdminActor.userId)

    const { account: cloudAccount } = await createTestWhatsappAccount({
      platformType: "CLOUD_API",
    })
    createdAccountIds.push(cloudAccount.id)

    const testSessionKey = `test-slot-${Date.now()}`
    createdSessionKeys.push(testSessionKey)

    await db.insert(schema.whatsappLinkedDeviceSessions).values({
      sessionKey: testSessionKey,
      label: "Legacy Slot",
      status: "qr_ready",
      encryptedAuthCreds: "v2:dummy_creds",
      encryptedAuthKeys: "v2:dummy_keys",
    })

    // Staff must be blocked
    const staffAttempt = await runServerActionAs(staffActor.cookie, () =>
      deleteLinkedDeviceSessionAction({ sessionKey: testSessionKey })
    )
    assert.equal(staffAttempt.success, false)
    assert.match(staffAttempt.error || "", /FORBIDDEN|Super Admin/i)

    // Super Admin pairing attempt returns sunset guidance cleanly
    const pairingAttempt = await runServerActionAs(superAdminActor.cookie, () =>
      startLinkedDeviceConnectionAction({
        sessionKey: testSessionKey,
        mode: "qr",
      })
    )
    assert.equal(pairingAttempt.success, false)
    assert.equal(pairingAttempt.mode, "manual_assisted_queue")

    // Super Admin disconnect scrubs encrypted Signal keys in DB
    const disconnectRes = await runServerActionAs(superAdminActor.cookie, () =>
      disconnectLinkedDeviceAction(testSessionKey)
    )
    assert.equal(disconnectRes.success, true)

    const [scrubbedSession] = await db
      .select()
      .from(schema.whatsappLinkedDeviceSessions)
      .where(eq(schema.whatsappLinkedDeviceSessions.sessionKey, testSessionKey))
    assert.equal(scrubbedSession?.encryptedAuthCreds ?? null, null)
    assert.equal(scrubbedSession?.encryptedAuthKeys ?? null, null)

    // Super Admin delete removes slot while preserving CLOUD_API accounts
    const adminDelete = await runServerActionAs(superAdminActor.cookie, () =>
      deleteLinkedDeviceSessionAction({ sessionKey: testSessionKey })
    )
    assert.equal(adminDelete.success, true)

    const [deletedSession] = await db
      .select()
      .from(schema.whatsappLinkedDeviceSessions)
      .where(eq(schema.whatsappLinkedDeviceSessions.sessionKey, testSessionKey))
    assert.equal(deletedSession, undefined)

    const [preservedCloud] = await db
      .select()
      .from(schema.whatsappAccounts)
      .where(eq(schema.whatsappAccounts.id, cloudAccount.id))
    assert.ok(preservedCloud, "CLOUD_API account must never be deleted")
    assert.equal(preservedCloud.isActive, true)
  })

  it("scopes purgeFakeMarketingChannelsAction strictly to placeholder WhatsApp channels and NEVER touches Core 5 social or real @g.us channels", async () => {
    const staffActor = await createTestActorSession("staff")
    const superAdminActor = await createTestActorSession("super_admin")
    createdUserIds.push(staffActor.userId, superAdminActor.userId)

    const suffix = Date.now().toString()
    const insertedChannels = await db
      .insert(schema.marketingChannels)
      .values([
        {
          name: `Core 5 Instagram Page ${suffix}`,
          platform: "instagram",
          externalGroupIdOrHandle: `ig_business_${suffix}`,
          memberCount: 18400,
          isActive: true,
        },
        {
          name: `Verified Pilgrim Group ${suffix}`,
          platform: "whatsapp_group",
          externalGroupIdOrHandle: `1203630999${suffix.slice(-6)}@g.us`,
          memberCount: 245,
          isActive: true,
        },
        {
          name: `Seed Fake WA Group ${suffix}`,
          platform: "whatsapp_group",
          externalGroupIdOrHandle: `fake_placeholder_${suffix}`,
          memberCount: 500,
          isActive: true,
        },
      ])
      .returning()

    for (const ch of insertedChannels) {
      createdChannelIds.push(ch.id)
    }

    const core5Ig = insertedChannels[0]!
    const realWaGroup = insertedChannels[1]!
    const fakeWaGroup = insertedChannels[2]!

    // Staff must be blocked
    const staffPurge = await runServerActionAs(staffActor.cookie, () =>
      purgeFakeMarketingChannelsAction()
    )
    assert.equal(staffPurge.success, false)

    // Super Admin purges ONLY placeholder WA channel
    const adminPurge = await runServerActionAs(superAdminActor.cookie, () =>
      purgeFakeMarketingChannelsAction()
    )
    assert.equal(adminPurge.success, true)

    const remainingRows = await db
      .select()
      .from(schema.marketingChannels)
      .where(
        inArray(schema.marketingChannels.id, [
          core5Ig.id,
          realWaGroup.id,
          fakeWaGroup.id,
        ])
      )

    const remainingById = new Map(remainingRows.map((r) => [r.id, r]))
    assert.ok(
      remainingById.has(core5Ig.id),
      "Core 5 Instagram marketing_channel MUST NOT be deleted"
    )
    assert.equal(
      remainingById.get(core5Ig.id)?.memberCount,
      18400,
      "Real memberCount counter MUST NOT be zeroed"
    )
    assert.ok(
      remainingById.has(realWaGroup.id),
      "Valid @g.us WhatsApp group MUST NOT be deleted"
    )
    assert.equal(
      remainingById.has(fakeWaGroup.id),
      false,
      "Placeholder non-JID WhatsApp channel should be purged"
    )
  })
})
