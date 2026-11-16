"use server"

import { revalidatePath } from "next/cache"
import { and, inArray, isNull, or, sql } from "drizzle-orm"
import { db, withTransaction } from "@/db"
import {
  dailyPostDistributions,
  marketingChannels,
} from "@/db/schema/suppliers-and-marketing"
import {
  type WhatsappLinkedDeviceSession,
  type WhatsappLinkedDeviceStatus,
} from "@/db/schema/whatsapp-crm"
import { recordAuditLog } from "@/lib/audit-log"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard"
import {
  createLinkedDeviceSessionSlotSchema,
  deleteLinkedDeviceSessionSlotSchema,
  dispatchAutomatedWhatsappGroupsCampaignSchema,
  startLinkedDeviceConnectionSchema,
  updateLinkedDeviceSessionSlotSchema,
} from "@/lib/validations/whatsapp-linked-device"
import {
  BAILEYS_SUNSET_MODE,
  BAILEYS_SUNSET_NOTICE,
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
  mode?: typeof BAILEYS_SUNSET_MODE
  sunsetNotice?: string
  session: SafeLinkedDeviceSession | null
  error?: string
}

function safeRevalidatePaths(paths: string[]): void {
  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch {
      // Safe no-op outside Next.js static generation store (e.g. unit/integration tests)
    }
  }
}

function toSafeSession(
  session: WhatsappLinkedDeviceSession
): SafeLinkedDeviceSession {
  return {
    id: session.id,
    sessionKey: session.sessionKey,
    label: session.label,
    phoneNumber: session.phoneNumber,
    pushName: session.pushName,
    status: session.status,
    qrDataUrl: null,
    pairingCode: null,
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
 * Retrieves the current `OD-01` Option A status (`isConnected: false`, `mode: "manual_assisted_queue"`).
 */
export async function getLinkedDeviceStatusAction(
  sessionKey = "default"
): Promise<LinkedDeviceStatusResult> {
  try {
    await requireAdmin()
    const { isConnected, mode, sunsetNotice, session } =
      await getLinkedDeviceStatus(sessionKey)

    if (!session) {
      return {
        success: true,
        isConnected: false,
        mode,
        sunsetNotice,
        session: null,
      }
    }

    return {
      success: true,
      isConnected,
      mode,
      sunsetNotice,
      session: toSafeSession(session),
    }
  } catch (err: unknown) {
    return {
      success: false,
      isConnected: false,
      mode: BAILEYS_SUNSET_MODE,
      sunsetNotice: BAILEYS_SUNSET_NOTICE,
      session: null,
      error:
        err instanceof Error
          ? err.message
          : "Failed to read WhatsApp line status",
    }
  }
}

/**
 * Lists all configured WhatsApp manual-assisted / legacy session slots in `manual_assisted_queue` sunset mode.
 */
export async function listLinkedDeviceSessionsAction(): Promise<{
  success: boolean
  mode: typeof BAILEYS_SUNSET_MODE
  sunsetNotice: string
  sessions: SafeLinkedDeviceSession[]
  error?: string
}> {
  try {
    await requireAdmin()
    const rows = await getAllLinkedDeviceSessions()
    return {
      success: true,
      mode: BAILEYS_SUNSET_MODE,
      sunsetNotice: BAILEYS_SUNSET_NOTICE,
      sessions: rows.map(toSafeSession),
    }
  } catch (err: unknown) {
    return {
      success: false,
      mode: BAILEYS_SUNSET_MODE,
      sunsetNotice: BAILEYS_SUNSET_NOTICE,
      sessions: [],
      error:
        err instanceof Error
          ? err.message
          : "Failed to list WhatsApp line slots",
    }
  }
}

/**
 * Creates a named manual-assisted WhatsApp line slot (`requireSuperAdmin()`, `OD-07`).
 */
export async function createLinkedDeviceSessionSlotAction(
  rawInput: unknown
): Promise<{
  success: boolean
  session?: SafeLinkedDeviceSession
  error?: string
}> {
  try {
    const session = await requireSuperAdmin()
    const validated = createLinkedDeviceSessionSlotSchema.parse(rawInput)
    const created = await createLinkedDeviceSessionSlot(validated)

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "whatsapp.manual_line_slot.create",
      entityType: "whatsapp_linked_device_session",
      entityId: created.id,
      after: { sessionKey: created.sessionKey, label: created.label },
    })

    safeRevalidatePaths(["/admin/settings", "/admin/campaigns", "/admin/desk"])

    return {
      success: true,
      session: toSafeSession(created),
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to create WhatsApp line slot",
    }
  }
}

/**
 * Updates the display label of a session slot (`requireSuperAdmin()`, `OD-07`).
 */
export async function updateLinkedDeviceSessionSlotAction(
  rawInput: unknown
): Promise<{
  success: boolean
  session?: SafeLinkedDeviceSession
  error?: string
}> {
  try {
    const session = await requireSuperAdmin()
    const validated = updateLinkedDeviceSessionSlotSchema.parse(rawInput)
    const updated = await updateLinkedDeviceSessionLabel(validated)

    if (!updated) {
      return { success: false, error: "Session slot not found" }
    }

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "whatsapp.manual_line_slot.update",
      entityType: "whatsapp_linked_device_session",
      entityId: updated.id,
      after: { sessionKey: updated.sessionKey, label: updated.label },
    })

    safeRevalidatePaths(["/admin/settings", "/admin/campaigns", "/admin/desk"])

    return {
      success: true,
      session: toSafeSession(updated),
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to update WhatsApp line label",
    }
  }
}

/**
 * Scrubs encrypted Signal keys and permanently deletes a custom session slot (`requireSuperAdmin()`, `T-032`).
 */
export async function deleteLinkedDeviceSessionSlotAction(
  rawInput: unknown
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const session = await requireSuperAdmin()
    const validated = deleteLinkedDeviceSessionSlotSchema.parse(rawInput)
    await deleteLinkedDeviceSessionSlot(validated.sessionKey)

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "whatsapp.linked_device_slot.delete",
      entityType: "whatsapp_linked_device_session",
      entityId: validated.sessionKey,
      after: { sessionKey: validated.sessionKey, deleted: true },
    })

    safeRevalidatePaths(["/admin/settings", "/admin/campaigns", "/admin/desk"])

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to delete WhatsApp line slot",
    }
  }
}

export const deleteLinkedDeviceSessionAction =
  deleteLinkedDeviceSessionSlotAction

/**
 * `OD-01` Option A Sunset: Returns clean sunset guidance without opening a Baileys socket.
 */
export async function startLinkedDeviceConnectionAction(
  rawInput: unknown
): Promise<{
  success: boolean
  status?: string
  mode?: typeof BAILEYS_SUNSET_MODE
  qrDataUrl?: string
  pairingCode?: string
  error?: string
}> {
  try {
    await requireSuperAdmin()
    const validated = startLinkedDeviceConnectionSchema.parse(rawInput)

    const initResult = await initBaileysSocket({
      sessionKey: validated.sessionKey,
      mode: validated.mode,
      phoneNumber: validated.phoneNumber,
      forceRestart: true,
    })

    safeRevalidatePaths(["/admin/settings", "/admin/campaigns", "/admin/desk"])

    return {
      success: false,
      status: initResult.status,
      mode: initResult.mode,
      error: initResult.sunsetNotice,
    }
  } catch (err: unknown) {
    return {
      success: false,
      mode: BAILEYS_SUNSET_MODE,
      error:
        err instanceof Error
          ? err.message
          : "Failed to process WhatsApp line request",
    }
  }
}

/**
 * Disconnects and wipes encrypted Signal auth keys for a specific slot (`requireSuperAdmin()`, `T-032`).
 */
export async function disconnectLinkedDeviceAction(
  sessionKey = "default"
): Promise<{
  success: boolean
  mode?: typeof BAILEYS_SUNSET_MODE
  error?: string
}> {
  try {
    const session = await requireSuperAdmin()
    const result = await disconnectLinkedDevice(sessionKey)

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "whatsapp.linked_device_slot.disconnect_clear_keys",
      entityType: "whatsapp_linked_device_session",
      entityId: sessionKey,
      after: { sessionKey, authKeysCleared: true },
    })

    safeRevalidatePaths(["/admin/settings", "/admin/campaigns", "/admin/desk"])

    return result
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to disconnect linked device",
    }
  }
}

/**
 * `OD-01` Option A Sunset: Returns 0 live-socket groups with sunset guidance.
 */
export async function syncRealWhatsappGroupsAction(
  sessionKey = "default"
): Promise<{
  success: boolean
  syncedCount?: number
  mode?: typeof BAILEYS_SUNSET_MODE
  error?: string
}> {
  try {
    await requireAdmin()
    const result = await syncRealWhatsappGroups(sessionKey)

    return {
      success: false,
      syncedCount: result.syncedCount,
      mode: result.mode,
      error: result.sunsetNotice,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to sync WhatsApp groups",
    }
  }
}

/**
 * `OD-01` Option A Sunset: Returns clean 0-socket summary.
 */
export async function syncAllConnectedLinkedDevicesAction(): Promise<{
  success: boolean
  totalSyncedGroups: number
  connectedLinesCount: number
  mode?: typeof BAILEYS_SUNSET_MODE
  results: Array<{
    sessionKey: string
    label: string
    syncedCount: number
    error?: string
  }>
  error?: string
}> {
  try {
    await requireAdmin()
    const summary = await syncAllConnectedLinkedDevices()

    return {
      success: true,
      ...summary,
    }
  } catch (err: unknown) {
    return {
      success: false,
      totalSyncedGroups: 0,
      connectedLinesCount: 0,
      mode: BAILEYS_SUNSET_MODE,
      results: [],
      error:
        err instanceof Error
          ? err.message
          : "Failed to inspect WhatsApp lines",
    }
  }
}

/**
 * Purges ONLY fake placeholder WhatsApp marketing channels (`whatsapp_group`, `whatsapp_community`, `whatsapp_status`)
 * lacking valid `@g.us` / `@newsletter` / `status@broadcast` JIDs (`T-032`, `OD-07`).
 *
 * STRICT INVARIANT:
 * - Requires `requireSuperAdmin()` + `recordAuditLog`.
 * - NEVER touches Core 5 social `marketing_channels` (`instagram`, `facebook`, `tiktok`, `youtube`, `google_business`).
 * - NEVER deletes real `@g.us` groups or `status@broadcast` channels or zeroes real counters.
 */
export async function purgeFakeMarketingChannelsAction(): Promise<{
  success: boolean
  purgedCount?: number
  error?: string
}> {
  try {
    const session = await requireSuperAdmin()

    const fakeWhatsappChannels = await db
      .select({
        id: marketingChannels.id,
        name: marketingChannels.name,
        platform: marketingChannels.platform,
        externalGroupIdOrHandle: marketingChannels.externalGroupIdOrHandle,
      })
      .from(marketingChannels)
      .where(
        and(
          inArray(marketingChannels.platform, [
            "whatsapp_group",
            "whatsapp_community",
            "whatsapp_status",
          ]),
          or(
            isNull(marketingChannels.externalGroupIdOrHandle),
            sql`btrim(${marketingChannels.externalGroupIdOrHandle}) = ''`,
            sql`(
              ${marketingChannels.externalGroupIdOrHandle} NOT LIKE '%@g.us'
              AND ${marketingChannels.externalGroupIdOrHandle} NOT LIKE '%@newsletter'
              AND ${marketingChannels.externalGroupIdOrHandle} NOT LIKE 'status@broadcast%'
            )`
          )
        )
      )

    if (fakeWhatsappChannels.length === 0) {
      return { success: true, purgedCount: 0 }
    }

    const fakeIds = fakeWhatsappChannels.map((c) => c.id)

    await withTransaction(async (tx) => {
      await tx
        .delete(dailyPostDistributions)
        .where(inArray(dailyPostDistributions.channelId, fakeIds))

      await tx
        .delete(marketingChannels)
        .where(
          and(
            inArray(marketingChannels.id, fakeIds),
            inArray(marketingChannels.platform, [
              "whatsapp_group",
              "whatsapp_community",
              "whatsapp_status",
            ])
          )
        )
    })

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "marketing_channels.purge_fake_whatsapp",
      entityType: "marketing_channel",
      entityId: "bulk_whatsapp_cleanup",
      before: {
        purgedCount: fakeIds.length,
        channels: fakeWhatsappChannels,
      },
      after: { purgedCount: fakeIds.length },
    })

    safeRevalidatePaths(["/admin/campaigns"])
    return { success: true, purgedCount: fakeIds.length }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to purge fake WhatsApp marketing channels",
    }
  }
}

/**
 * `OD-01` Option A Sunset: Rejects automated unofficial Baileys group blasts and directs staff
 * to the 100% Ban-Safe Manual Assisted WA Group/Status Share Queue in `/admin/campaigns`.
 */
export async function dispatchAutomatedWhatsappGroupsCampaignAction(
  rawInput: unknown
): Promise<{
  success: boolean
  mode?: typeof BAILEYS_SUNSET_MODE
  runId?: string
  totalTargets?: number
  error?: string
}> {
  try {
    await requireSuperAdmin()
    const validated =
      dispatchAutomatedWhatsappGroupsCampaignSchema.parse(rawInput)

    return {
      success: false,
      mode: BAILEYS_SUNSET_MODE,
      totalTargets: validated.channelIds.length,
      error: BAILEYS_SUNSET_NOTICE,
    }
  } catch (err: unknown) {
    return {
      success: false,
      mode: BAILEYS_SUNSET_MODE,
      error:
        err instanceof Error
          ? err.message
          : "Automated unofficial WhatsApp group blasts are retired (OD-01 Option A).",
    }
  }
}
