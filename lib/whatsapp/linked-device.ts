import crypto from "node:crypto"
import { asc, eq } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappLinkedDeviceSessions,
  type WhatsappLinkedDeviceSession,
} from "@/db/schema/whatsapp-crm"
import { encrypt } from "@/lib/whatsapp/encryption"

/**
 * `OD-01` Option A Sunset Notice (`T-032`):
 * Serverless-incompatible in-memory Baileys WebSockets (`socketMap`) are retired
 * for 0% SIM-ban risk and $0/mo sidecar cost in favor of:
 *   1. Official Meta WhatsApp Cloud API v21.0 (1:1 Inbox, 3-Priority Auto-Responder, Broadcasts)
 *   2. Ban-Safe 1-Click Manual Assisted WA Group & Status Share Queue (`/admin/campaigns`)
 */
export const BAILEYS_SUNSET_MODE = "manual_assisted_queue" as const

export const BAILEYS_SUNSET_NOTICE =
  "Live Baileys Linked-Device WebSockets have been retired (OD-01 Option A) to guarantee 0% SIM-ban risk on Vercel Serverless. Use Official Meta WhatsApp Cloud API v21.0 for 1:1/Broadcasts and the Ban-Safe Manual Assisted WA Group/Status Share Queue in /admin/campaigns."

export interface RetiredBaileysSocketPlaceholder {
  readonly user?: { readonly id?: string }
  end: (err?: Error) => void
}

/**
 * Always returns `null` under `OD-01` Option A (no live Baileys sockets exist in memory).
 */
export function getActiveBaileysSocket(
  _sessionKey = "default"
): RetiredBaileysSocketPlaceholder | null {
  void _sessionKey
  return null
}

/**
 * Always returns `false` under `OD-01` Option A.
 */
export function isLinkedDeviceConnected(_sessionKey = "default"): boolean {
  void _sessionKey
  return false
}

/**
 * Always returns `false` under `OD-01` Option A.
 */
export function isAnyLinkedDeviceConnected(): boolean {
  return false
}

/**
 * Reads the persistent session slot row from PostgreSQL (if any legacy slot exists).
 */
export async function getLinkedDeviceSessionFromDb(
  sessionKey = "default"
): Promise<WhatsappLinkedDeviceSession | null> {
  const [session] = await db
    .select()
    .from(whatsappLinkedDeviceSessions)
    .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))
    .limit(1)

  return session || null
}

/**
 * Lists all registered Linked-Device session slots in ascending order of creation.
 */
export async function getAllLinkedDeviceSessions(): Promise<
  WhatsappLinkedDeviceSession[]
> {
  return db
    .select()
    .from(whatsappLinkedDeviceSessions)
    .orderBy(asc(whatsappLinkedDeviceSessions.createdAt))
}

/**
 * Registers a Manual Assisted WA line slot label in `whatsapp_linked_device_sessions`.
 */
export async function createLinkedDeviceSessionSlot(options: {
  label: string
  sessionKey?: string
}): Promise<WhatsappLinkedDeviceSession> {
  const label = options.label.trim()
  let sessionKey = options.sessionKey?.trim()

  if (!sessionKey) {
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    sessionKey = slug
      ? `${slug.slice(0, 48)}-${Date.now().toString().slice(-4)}`
      : `line-${Date.now()}`
  }

  const [created] = await db
    .insert(whatsappLinkedDeviceSessions)
    .values({
      sessionKey,
      label,
      status: "disconnected",
    })
    .returning()

  if (!created) {
    throw new Error("Failed to create WhatsApp line slot")
  }

  return created
}

/**
 * Updates the display label of an existing session slot.
 */
export async function updateLinkedDeviceSessionLabel(options: {
  sessionKey: string
  label: string
}): Promise<WhatsappLinkedDeviceSession | null> {
  const [updated] = await db
    .update(whatsappLinkedDeviceSessions)
    .set({
      label: options.label.trim(),
      updatedAt: new Date(),
    })
    .where(eq(whatsappLinkedDeviceSessions.sessionKey, options.sessionKey))
    .returning()

  return updated || null
}

/**
 * Disconnects, scrubs all encrypted Signal auth keys (`encryptedAuthCreds`, `encryptedAuthKeys`),
 * soft-deactivates any `linked-${sessionKey}` row in `whatsapp_accounts` (preserving historical
 * `whatsapp_conversations` / `whatsapp_messages` — NEVER cascade-deleting CRM threads!),
 * and deletes the session slot row (`T-032`).
 */
export async function deleteLinkedDeviceSessionSlot(
  sessionKey: string
): Promise<boolean> {
  await disconnectLinkedDevice(sessionKey).catch(() => null)

  const linkedPhoneNumberId = `linked-${sessionKey}`
  await db
    .update(whatsappAccounts)
    .set({
      isActive: false,
      isDefault: false,
      updatedAt: new Date(),
    })
    .where(eq(whatsappAccounts.phoneNumberId, linkedPhoneNumberId))
    .catch(() => null)

  await db
    .delete(whatsappLinkedDeviceSessions)
    .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))

  return true
}

/**
 * Returns the operational status (`isConnected: false`, `mode: "manual_assisted_queue"`) under `OD-01` Option A.
 */
export async function getLinkedDeviceStatus(sessionKey = "default"): Promise<{
  isConnected: false
  mode: typeof BAILEYS_SUNSET_MODE
  sunsetNotice: string
  session: WhatsappLinkedDeviceSession | null
}> {
  const session = await getLinkedDeviceSessionFromDb(sessionKey)
  if (
    session &&
    (session.status === "connected" ||
      session.status === "connecting" ||
      session.status === "qr_ready" ||
      session.status === "pairing_code_ready")
  ) {
    const [normalized] = await db
      .update(whatsappLinkedDeviceSessions)
      .set({
        status: "disconnected",
        qrDataUrl: null,
        pairingCode: null,
        updatedAt: new Date(),
      })
      .where(eq(whatsappLinkedDeviceSessions.id, session.id))
      .returning()

    return {
      isConnected: false,
      mode: BAILEYS_SUNSET_MODE,
      sunsetNotice: BAILEYS_SUNSET_NOTICE,
      session: normalized ?? session,
    }
  }

  return {
    isConnected: false,
    mode: BAILEYS_SUNSET_MODE,
    sunsetNotice: BAILEYS_SUNSET_NOTICE,
    session,
  }
}

/**
 * Backward-compatible helper retained for legacy callers; creates/returns an inactive `LINKED_DEVICE`
 * record with strong random webhook token (never weak `linked_device_*_token`).
 */
export async function ensureLinkedWhatsappAccount(
  sessionPhone?: string | null,
  sessionKey = "default",
  sessionLabel?: string
) {
  const linkedPhoneNumberId = `linked-${sessionKey}`
  const cleanPhone = sessionPhone || "Manual Assisted WA Line"
  const accountName = sessionLabel || `Manual Assisted Line (${cleanPhone})`

  const [existing] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.phoneNumberId, linkedPhoneNumberId))
    .limit(1)

  if (existing) {
    return existing
  }

  const [newAccount] = await db
    .insert(whatsappAccounts)
    .values({
      name: accountName,
      phoneNumberId: linkedPhoneNumberId,
      wabaId: `manual-assisted-${sessionKey}`,
      displayPhoneNumber: cleanPhone,
      encryptedAccessToken: encrypt(crypto.randomBytes(24).toString("hex")),
      webhookVerifyToken: crypto.randomBytes(24).toString("hex"),
      isActive: false,
      isDefault: false,
      accountRole: "COEXISTENCE_FOUNDER",
      platformType: "LINKED_DEVICE",
    })
    .returning()

  return newAccount
}

/**
 * `OD-01` Option A Sunset: Does NOT open a Baileys WebSocket or generate QR/pairing codes.
 * Scrubs any stale QR/pairing artifacts and returns a clean `disconnected` / `manual_assisted_queue` state.
 */
export async function initBaileysSocket(options: {
  sessionKey?: string
  mode?: "qr" | "pairing_code"
  phoneNumber?: string
  forceRestart?: boolean
}): Promise<{
  socket: null
  status: "disconnected"
  mode: typeof BAILEYS_SUNSET_MODE
  sunsetNotice: string
  qrDataUrl?: undefined
  pairingCode?: undefined
}> {
  const sessionKey = options.sessionKey || "default"

  await db
    .update(whatsappLinkedDeviceSessions)
    .set({
      status: "disconnected",
      qrDataUrl: null,
      pairingCode: null,
      lastError: BAILEYS_SUNSET_NOTICE,
      updatedAt: new Date(),
    })
    .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))
    .catch(() => null)

  return {
    socket: null,
    status: "disconnected",
    mode: BAILEYS_SUNSET_MODE,
    sunsetNotice: BAILEYS_SUNSET_NOTICE,
  }
}

/**
 * Scrubs all stored Baileys Signal keys (`encryptedAuthCreds`, `encryptedAuthKeys`), QR data,
 * and pairing codes for `sessionKey` (`T-032`).
 */
export async function disconnectLinkedDevice(
  sessionKey = "default"
): Promise<{
  success: boolean
  mode: typeof BAILEYS_SUNSET_MODE
}> {
  await db
    .update(whatsappLinkedDeviceSessions)
    .set({
      status: "disconnected",
      qrDataUrl: null,
      pairingCode: null,
      phoneNumber: null,
      pushName: null,
      encryptedAuthCreds: null,
      encryptedAuthKeys: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))

  await db
    .update(whatsappAccounts)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(whatsappAccounts.phoneNumberId, `linked-${sessionKey}`))
    .catch(() => null)

  return {
    success: true,
    mode: BAILEYS_SUNSET_MODE,
  }
}

/**
 * `OD-01` Option A Sunset: Returns 0 live-socket groups and directs operators to the
 * Ban-Safe Manual Assisted WA Group/Status Share Queue in `/admin/campaigns`.
 */
export async function syncRealWhatsappGroups(_sessionKey = "default"): Promise<{
  syncedCount: number
  statusAdded: boolean
  mode: typeof BAILEYS_SUNSET_MODE
  sunsetNotice: string
}> {
  void _sessionKey
  return {
    syncedCount: 0,
    statusAdded: false,
    mode: BAILEYS_SUNSET_MODE,
    sunsetNotice: BAILEYS_SUNSET_NOTICE,
  }
}

/**
 * Resolves a preferred session label/key for manual assisted queue routing.
 */
export async function resolveLinkedDeviceSessionForChannel(
  _channelSenderPhone?: string | null,
  preferredSessionKey?: string
): Promise<string> {
  if (preferredSessionKey && preferredSessionKey !== "auto") {
    return preferredSessionKey
  }
  return "manual_assisted_queue"
}

/**
 * `OD-01` Option A Sunset: Returns clean summary with 0 connected live sockets.
 */
export async function syncAllConnectedLinkedDevices(): Promise<{
  totalSyncedGroups: number
  connectedLinesCount: number
  mode: typeof BAILEYS_SUNSET_MODE
  sunsetNotice: string
  results: Array<{
    sessionKey: string
    label: string
    syncedCount: number
    error?: string
  }>
}> {
  return {
    totalSyncedGroups: 0,
    connectedLinesCount: 0,
    mode: BAILEYS_SUNSET_MODE,
    sunsetNotice: BAILEYS_SUNSET_NOTICE,
    results: [],
  }
}

/**
 * `OD-01` Option A Sunset: Rejects automated unofficial Baileys socket messaging (`MANUAL_ASSISTED_QUEUE_REQUIRED`).
 */
export async function sendLinkedDeviceMessage(options: {
  sessionKey?: string
  jid: string
  text?: string
  imageUrl?: string
  documentUrl?: string
  filename?: string
  caption?: string
  simulatePresence?: boolean
}): Promise<{ success: boolean; wamid: string }> {
  throw new Error(
    `MANUAL_ASSISTED_QUEUE_REQUIRED: Unofficial Baileys socket sending to "${options.jid}" is retired (OD-01 Option A). Use Official Meta WhatsApp Cloud API v21.0 for 1:1/Broadcasts or the Ban-Safe 1-Click Manual Assisted WA Group/Status Share Queue in /admin/campaigns.`
  )
}

/**
 * `OD-01` Option A Sunset: Rejects automated unofficial group/status socket blasts in favor of the
 * Ban-Safe Manual Assisted WA Group/Status Share Queue.
 */
export async function sendLinkedDeviceGroupOrStatusPost(options: {
  sessionKey?: string
  jid: string
  imageUrl: string
  caption: string
  simulatePresence?: boolean
}): Promise<{ success: boolean; wamid: string }> {
  return sendLinkedDeviceMessage({
    sessionKey: options.sessionKey,
    jid: options.jid,
    imageUrl: options.imageUrl,
    caption: options.caption,
    simulatePresence: false,
  })
}
