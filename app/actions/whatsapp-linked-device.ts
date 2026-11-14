"use server"

import { revalidatePath } from "next/cache"
import { eq, or, sql } from "drizzle-orm"
import { idempotencyKeys } from "@trigger.dev/sdk"
import { db } from "@/db"
import {
  dailyPostDistributions,
  marketingChannels,
} from "@/db/schema/suppliers-and-marketing"
import {
  type WhatsappLinkedDeviceSession,
  type WhatsappLinkedDeviceStatus,
} from "@/db/schema/whatsapp-crm"
import { requireAdmin } from "@/lib/auth-guard"
import {
  createLinkedDeviceSessionSlotSchema,
  deleteLinkedDeviceSessionSlotSchema,
  dispatchAutomatedWhatsappGroupsCampaignSchema,
  startLinkedDeviceConnectionSchema,
  updateLinkedDeviceSessionSlotSchema,
} from "@/lib/validations/whatsapp-linked-device"
import {
  createLinkedDeviceSessionSlot,
  deleteLinkedDeviceSessionSlot,
  disconnectLinkedDevice,
  getAllLinkedDeviceSessions,
  getLinkedDeviceStatus,
  initBaileysSocket,
  syncAllConnectedLinkedDevices,
  syncRealWhatsappGroups,
  updateLinkedDeviceSessionLabel,
} from "@/lib/whatsapp/linked-device"
import { isTriggerCloudConfigured } from "@/trigger/dispatch"
import {
  runSendWhatsappGroupCampaignInline,
  sendWhatsappGroupCampaignTask,
} from "@/trigger/send-whatsapp-group-campaign.task"

export interface SafeLinkedDeviceSession {
  id: string
  sessionKey: string
  label: string
  phoneNumber: string | null
  pushName: string | null
  status: WhatsappLinkedDeviceStatus
  qrDataUrl: string | null
  pairingCode: string | null
  groupsSyncedCount: number
  lastError: string | null
  lastConnectedAt: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LinkedDeviceStatusResult {
  success: boolean
  isConnected: boolean
  session: SafeLinkedDeviceSession | null
  error?: string
}

function toSafeSession(session: WhatsappLinkedDeviceSession): SafeLinkedDeviceSession {
  return {
    id: session.id,
    sessionKey: session.sessionKey,
    label: session.label,
    phoneNumber: session.phoneNumber,
    pushName: session.pushName,
    status: session.status,
    qrDataUrl: session.qrDataUrl,
    pairingCode: session.pairingCode,
    groupsSyncedCount: session.groupsSyncedCount,
    lastError: session.lastError,
    lastConnectedAt: session.lastConnectedAt
      ? session.lastConnectedAt.toISOString()
      : null,
    lastSyncedAt: session.lastSyncedAt
      ? session.lastSyncedAt.toISOString()
      : null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}

/**
 * Retrieves the current status and pairing credentials of the WhatsApp Linked Device for a given slot.
 */
export async function getLinkedDeviceStatusAction(
  sessionKey = "default"
): Promise<LinkedDeviceStatusResult> {
  try {
    await requireAdmin()
    const { isConnected, session } = await getLinkedDeviceStatus(sessionKey)

    if (!session) {
      return { success: true, isConnected: false, session: null }
    }

    return { success: true, isConnected, session: toSafeSession(session) }
  } catch (err: unknown) {
    return {
      success: false,
      isConnected: false,
      session: null,
      error: err instanceof Error ? err.message : "Failed to load linked device status",
    }
  }
}

/**
 * Lists all registered Linked-Device slots, returning an empty list if no phones have been linked yet.
 */
export async function listLinkedDeviceSessionsAction(): Promise<{
  success: boolean
  sessions: SafeLinkedDeviceSession[]
  error?: string
}> {
  try {
    await requireAdmin()
    const sessions = await getAllLinkedDeviceSessions()
    return {
      success: true,
      sessions: sessions.map(toSafeSession),
    }
  } catch (err: unknown) {
    return {
      success: false,
      sessions: [],
      error: err instanceof Error ? err.message : "Failed to list WhatsApp lines",
    }
  }
}

/**
 * Creates a new custom Linked-Device session slot.
 */
export async function createLinkedDeviceSessionSlotAction(rawInput: unknown): Promise<{
  success: boolean
  session?: SafeLinkedDeviceSession
  error?: string
}> {
  try {
    await requireAdmin()
    const validated = createLinkedDeviceSessionSlotSchema.parse(rawInput)
    const created = await createLinkedDeviceSessionSlot(validated)

    revalidatePath("/admin/settings")
    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/desk")

    return {
      success: true,
      session: toSafeSession(created),
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create WhatsApp line slot",
    }
  }
}

/**
 * Updates the display label of a session slot.
 */
export async function updateLinkedDeviceSessionSlotAction(rawInput: unknown): Promise<{
  success: boolean
  session?: SafeLinkedDeviceSession
  error?: string
}> {
  try {
    await requireAdmin()
    const validated = updateLinkedDeviceSessionSlotSchema.parse(rawInput)
    const updated = await updateLinkedDeviceSessionLabel(validated)

    if (!updated) {
      return { success: false, error: "Session slot not found" }
    }

    revalidatePath("/admin/settings")
    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/desk")

    return {
      success: true,
      session: toSafeSession(updated),
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update WhatsApp line label",
    }
  }
}

/**
 * Disconnects and permanently deletes a custom session slot.
 * Rejects deletion of "default" and "secondary".
 */
export async function deleteLinkedDeviceSessionSlotAction(rawInput: unknown): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await requireAdmin()
    const validated = deleteLinkedDeviceSessionSlotSchema.parse(rawInput)
    await deleteLinkedDeviceSessionSlot(validated.sessionKey)

    revalidatePath("/admin/settings")
    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/desk")

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete WhatsApp line slot",
    }
  }
}

/**
 * Initiates linking via Live QR Code or 8-Digit Pairing Code for a given slot.
 */
export async function startLinkedDeviceConnectionAction(rawInput: unknown): Promise<{
  success: boolean
  status?: string
  qrDataUrl?: string
  pairingCode?: string
  error?: string
}> {
  try {
    await requireAdmin()
    const validated = startLinkedDeviceConnectionSchema.parse(rawInput)

    const initResult = await initBaileysSocket({
      sessionKey: validated.sessionKey,
      mode: validated.mode,
      phoneNumber: validated.phoneNumber,
      forceRestart: true,
    })

    revalidatePath("/admin/settings")
    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/desk")

    return {
      success: true,
      status: initResult.status,
      qrDataUrl: initResult.qrDataUrl,
      pairingCode: initResult.pairingCode,
    }
  } catch (err: unknown) {
    console.error("[startLinkedDeviceConnectionAction] Error:", err)
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to initialize WhatsApp connection",
    }
  }
}

/**
 * Disconnects and unlinks a specific slot.
 */
export async function disconnectLinkedDeviceAction(
  sessionKey = "default"
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const result = await disconnectLinkedDevice(sessionKey)

    revalidatePath("/admin/settings")
    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/desk")

    return result
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to disconnect linked device",
    }
  }
}

/**
 * Automatically discovers all participating real WhatsApp groups and Status line for a given slot.
 */
export async function syncRealWhatsappGroupsAction(
  sessionKey = "default"
): Promise<{ success: boolean; syncedCount?: number; error?: string }> {
  try {
    await requireAdmin()
    const result = await syncRealWhatsappGroups(sessionKey)

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/settings")

    return { success: true, syncedCount: result.syncedCount }
  } catch (err: unknown) {
    console.error("[syncRealWhatsappGroupsAction] Error:", err)
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to sync real WhatsApp groups",
    }
  }
}

/**
 * Iterates all connected WhatsApp lines and syncs their groups & status in 1 click.
 */
export async function syncAllConnectedLinkedDevicesAction(): Promise<{
  success: boolean
  totalSyncedGroups: number
  connectedLinesCount: number
  results: Array<{ sessionKey: string; label: string; syncedCount: number; error?: string }>
  error?: string
}> {
  try {
    await requireAdmin()
    const summary = await syncAllConnectedLinkedDevices()

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/settings")
    revalidatePath("/admin/desk")

    return {
      success: true,
      ...summary,
    }
  } catch (err: unknown) {
    console.error("[syncAllConnectedLinkedDevicesAction] Error:", err)
    return {
      success: false,
      totalSyncedGroups: 0,
      connectedLinesCount: 0,
      results: [],
      error: err instanceof Error ? err.message : "Failed to sync connected WhatsApp lines",
    }
  }
}

/**
 * Purges any fake placeholder marketing channels from earlier development phases.
 */
export async function purgeFakeMarketingChannelsAction(): Promise<{
  success: boolean
  purgedCount?: number
  error?: string
}> {
  try {
    await requireAdmin()

    const fakeChannels = await db
      .select({ id: marketingChannels.id })
      .from(marketingChannels)
      .where(
        or(
          sql`${marketingChannels.externalGroupIdOrHandle} IS NULL`,
          sql`(${marketingChannels.externalGroupIdOrHandle} NOT LIKE '%@g.us' AND ${marketingChannels.externalGroupIdOrHandle} NOT LIKE 'status@broadcast%')`
        )
      )

    if (fakeChannels.length === 0) {
      return { success: true, purgedCount: 0 }
    }

    const fakeIds = fakeChannels.map((c) => c.id)

    for (const id of fakeIds) {
      await db
        .delete(dailyPostDistributions)
        .where(eq(dailyPostDistributions.channelId, id))
    }

    for (const id of fakeIds) {
      await db
        .delete(marketingChannels)
        .where(eq(marketingChannels.id, id))
    }

    revalidatePath("/admin/campaigns")
    return { success: true, purgedCount: fakeIds.length }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to purge fake marketing channels",
    }
  }
}

/**
 * Triggers automated, ban-safe paced broadcasting of an Umrah flyer to selected WhatsApp groups & Status.
 */
export async function dispatchAutomatedWhatsappGroupsCampaignAction(
  rawInput: unknown
): Promise<{
  success: boolean
  runId?: string
  totalTargets?: number
  error?: string
}> {
  try {
    await requireAdmin()
    const validated = dispatchAutomatedWhatsappGroupsCampaignSchema.parse(rawInput)
    const payload = {
      ...validated,
      sessionKey: validated.sessionKey || "auto",
    }

    if (isTriggerCloudConfigured()) {
      const idemKey = await idempotencyKeys.create(
        `wa-grp-campaign-${payload.postAssetId}-${Date.now()}`,
        { scope: "global" }
      )

      const run = await sendWhatsappGroupCampaignTask.trigger(payload, {
        idempotencyKey: idemKey,
        tags: [
          `whatsapp-group-campaign:${payload.postAssetId}`,
          `pacing:${payload.pacingTier}`,
        ],
      })

      return {
        success: true,
        runId: run.id,
        totalTargets: payload.channelIds.length,
      }
    } else {
      const runId = `inline_wa_grp_${Date.now()}`
      void runSendWhatsappGroupCampaignInline(payload).catch((err) => {
        console.error("[dispatchAutomatedWhatsappGroupsCampaignAction] Inline error:", err)
      })

      return {
        success: true,
        runId,
        totalTargets: payload.channelIds.length,
      }
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to dispatch automated WhatsApp campaign",
    }
  }
}
