import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { after, describe, it } from "node:test"
import { inArray } from "drizzle-orm"
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import {
  dailyPostDistributions,
  marketingChannels,
  postAssets,
  supplierFlyers,
  suppliers,
} from "../../../db/schema/suppliers-and-marketing"
import {
  resolveValidWhatsappGroupOrStatusHandle,
  runSendWhatsappGroupCampaign,
} from "../../../trigger/send-whatsapp-group-campaign.task"

assertAuditSafeEnvironment()

describe("F-JOBS T-073 & OD-01 Option A: WhatsApp Group Campaign Task Non-Socket manual_ready Transition", () => {
  const createdChannelIds: string[] = []
  const createdPostAssetIds: string[] = []
  const createdFlyerIds: string[] = []
  const createdSupplierIds: string[] = []

  after(async () => {
    if (createdChannelIds.length > 0) {
      await db
        .delete(dailyPostDistributions)
        .where(inArray(dailyPostDistributions.channelId, createdChannelIds))
      await db
        .delete(marketingChannels)
        .where(inArray(marketingChannels.id, createdChannelIds))
    }
    if (createdPostAssetIds.length > 0) {
      await db
        .delete(postAssets)
        .where(inArray(postAssets.id, createdPostAssetIds))
    }
    if (createdFlyerIds.length > 0) {
      await db
        .delete(supplierFlyers)
        .where(inArray(supplierFlyers.id, createdFlyerIds))
    }
    if (createdSupplierIds.length > 0) {
      await db
        .delete(suppliers)
        .where(inArray(suppliers.id, createdSupplierIds))
    }
    await closeDatabasePool()
  })

  it("contains zero Baileys / linked-device socket imports and zero hardcoded 03214629700 phone fallbacks", async () => {
    const taskSource = await readFile(
      path.join(
        process.cwd(),
        "trigger",
        "send-whatsapp-group-campaign.task.ts"
      ),
      "utf8"
    )

    assert.equal(
      /baileys|linked-device|sendPosterViaLinkedDevice|initBaileysSocket/i.test(
        taskSource
      ),
      false,
      "send-whatsapp-group-campaign.task.ts must NOT import or invoke Baileys sockets under OD-01 Option A"
    )
    assert.equal(
      taskSource.includes("03214629700"),
      false,
      "Must never reference phantom fallback phone number 03214629700"
    )
    assert.equal(
      taskSource.includes("@s.whatsapp.net"),
      false,
      "Must never fabricate direct @s.whatsapp.net JIDs for group broadcasts"
    )

    assert.deepEqual(
      resolveValidWhatsappGroupOrStatusHandle({
        platform: "whatsapp_group",
        externalGroupIdOrHandle: "120363044556677889@g.us",
      }),
      { valid: true, targetJid: "120363044556677889@g.us" }
    )
    assert.deepEqual(
      resolveValidWhatsappGroupOrStatusHandle({
        platform: "whatsapp_status",
        externalGroupIdOrHandle: "status@broadcast:default",
      }),
      { valid: true, targetJid: "status@broadcast:default" }
    )
    assert.equal(
      resolveValidWhatsappGroupOrStatusHandle({
        platform: "whatsapp_group",
        externalGroupIdOrHandle: null,
      }).valid,
      false
    )
    assert.equal(
      resolveValidWhatsappGroupOrStatusHandle({
        platform: "whatsapp_group",
        externalGroupIdOrHandle: "03214629700@s.whatsapp.net",
      }).valid,
      false
    )
  })

  it("transitions valid WA Group & Status channels cleanly to manual_ready ('queued' in DB) and marks invalid JIDs 'failed' without sockets", async () => {
    const suffix = crypto.randomUUID().slice(0, 8)

    const [supplier] = await db
      .insert(suppliers)
      .values({
        name: `F-JOBS WA Group Supplier ${suffix}`,
        slug: `fjobs-wagrp-sup-${suffix}`,
        codePrefix: "FJW",
      })
      .returning({ id: suppliers.id })
    createdSupplierIds.push(supplier.id)

    const [flyer] = await db
      .insert(supplierFlyers)
      .values({
        supplierId: supplier.id,
        title: `F-JOBS WA Flyer ${suffix}`,
        rawFlyerImageUrl: "https://cdn.alramlahtravels.com/flyers/raw.jpg",
        airlineName: "Saudia",
        receivedDate: "2026-11-14",
      })
      .returning({ id: supplierFlyers.id })
    createdFlyerIds.push(flyer.id)

    const [asset] = await db
      .insert(postAssets)
      .values({
        postCode: `ART-WAGRP-${suffix.toUpperCase()}`,
        kind: "single_package_spotlight",
        title: `Luxury Umrah Spotlight ${suffix}`,
        supplierId: supplier.id,
        flyerId: flyer.id,
        imageUrl: "https://cdn.alramlahtravels.com/posters/umrah-spotlight.jpg",
      })
      .returning({ id: postAssets.id, postCode: postAssets.postCode })
    createdPostAssetIds.push(asset.id)

    const [validGroup] = await db
      .insert(marketingChannels)
      .values({
        name: `Askari 10 Families ${suffix}`,
        platform: "whatsapp_group",
        externalGroupIdOrHandle: `120363999${Date.now()}${Math.floor(Math.random() * 999)}@g.us`,
        isActive: true,
      })
      .returning({ id: marketingChannels.id })
    createdChannelIds.push(validGroup.id)

    const [validStatus] = await db
      .insert(marketingChannels)
      .values({
        name: `Official WA Status ${suffix}`,
        platform: "whatsapp_status",
        externalGroupIdOrHandle: `status@broadcast:slot_${suffix}`,
        isActive: true,
      })
      .returning({ id: marketingChannels.id })
    createdChannelIds.push(validStatus.id)

    const [invalidChannel] = await db
      .insert(marketingChannels)
      .values({
        name: `Broken Legacy Channel ${suffix}`,
        platform: "whatsapp_group",
        externalGroupIdOrHandle: null,
        isActive: true,
      })
      .returning({ id: marketingChannels.id })
    createdChannelIds.push(invalidChannel.id)

    const outcome = await runSendWhatsappGroupCampaign(
      {
        postAssetId: asset.id,
        channelIds: [validGroup.id, validStatus.id, invalidChannel.id],
        caption: `Blessed Umrah 2027 — Ref ${asset.postCode}`,
        pacingTier: "ultra_safe",
        sessionKey: "default",
      },
      { runId: `run_wa_grp_${suffix}` }
    )

    assert.equal(outcome.success, true)
    assert.equal(outcome.mode, "manual_ready")
    assert.equal(outcome.status, "manual_ready")
    assert.equal(outcome.totalTargets, 3)
    assert.equal(outcome.manualReadyCount, 2)
    assert.equal(
      outcome.sentCount,
      0,
      "Zero automated socket messages should be sent under OD-01 Option A"
    )
    assert.equal(outcome.failedCount, 1)

    const distRows = await db
      .select()
      .from(dailyPostDistributions)
      .where(
        inArray(dailyPostDistributions.channelId, [
          validGroup.id,
          validStatus.id,
          invalidChannel.id,
        ])
      )

    assert.equal(distRows.length, 3)

    const groupDist = distRows.find((r) => r.channelId === validGroup.id)
    const statusDist = distRows.find((r) => r.channelId === validStatus.id)
    const invalidDist = distRows.find((r) => r.channelId === invalidChannel.id)

    assert.equal(groupDist?.status, "queued")
    assert.equal(groupDist?.postedAt, null)
    assert.match(groupDist?.notes ?? "", /manual_ready/)

    assert.equal(statusDist?.status, "queued")
    assert.equal(statusDist?.postedAt, null)

    assert.equal(invalidDist?.status, "failed")
    assert.equal(invalidDist?.postedAt, null)
    assert.equal((invalidDist?.notes ?? "").includes("03214629700"), false)
  })
})
