import QRCode from "qrcode"
import pino from "pino"
import {
  DisconnectReason,
  jidNormalizedUser,
  makeWASocket,
  type WASocket,
} from "@whiskeysockets/baileys"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappLinkedDeviceSessions,
  whatsappMessages,
  type WhatsappLinkedDeviceSession,
} from "@/db/schema/whatsapp-crm"
import { marketingChannels } from "@/db/schema/suppliers-and-marketing"
import { encrypt } from "@/lib/whatsapp/encryption"
import {
  formatPairingCode,
  normalizeStatusJid,
  sanitizePhoneNumberForPairing,
} from "@/lib/validations/whatsapp-linked-device"
import {
  extractPostRefCodes,
  normalizePakistaniPhone,
} from "./phone-utils"
import { initPostgresBaileysAuthState } from "./linked-device-auth-postgres"

declare global {
  var __baileysLinkedDeviceSockets: Map<string, WASocket> | undefined
}

const socketMap =
  globalThis.__baileysLinkedDeviceSockets ||
  (globalThis.__baileysLinkedDeviceSockets = new Map<string, WASocket>())

const logger = pino({ level: "silent" })



/**
 * Retrieves the live, active Baileys socket singleton from memory if connected or connecting.
 */
export function getActiveBaileysSocket(sessionKey = "default"): WASocket | null {
  return socketMap.get(sessionKey) || null
}

/**
 * Returns true if the in-memory socket for sessionKey is active and registered.
 */
export function isLinkedDeviceConnected(sessionKey = "default"): boolean {
  const sock = socketMap.get(sessionKey)
  if (!sock) return false
  return Boolean(sock.user?.id)
}

/**
 * Returns true if any in-memory socket is active and registered.
 */
export function isAnyLinkedDeviceConnected(): boolean {
  for (const sock of socketMap.values()) {
    if (sock.user?.id) return true
  }
  return false
}

/**
 * Reads the latest persistent session row from Neon PostgreSQL.
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
 * Returns an empty array when no phones have been linked yet.
 */
export async function getAllLinkedDeviceSessions(): Promise<WhatsappLinkedDeviceSession[]> {
  return await db
    .select()
    .from(whatsappLinkedDeviceSessions)
    .orderBy(asc(whatsappLinkedDeviceSessions.createdAt))
}

/**
 * Registers a new custom Linked-Device session slot.
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
    sessionKey = slug ? `${slug.slice(0, 48)}-${Date.now().toString().slice(-4)}` : `line-${Date.now()}`
  }

  const [created] = await db
    .insert(whatsappLinkedDeviceSessions)
    .values({
      sessionKey,
      label,
      status: "disconnected",
    })
    .returning()

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
 * Disconnects and permanently deletes any session slot and its associated linked WhatsApp account.
 */
export async function deleteLinkedDeviceSessionSlot(sessionKey: string): Promise<boolean> {
  try {
    await disconnectLinkedDevice(sessionKey)
  } catch (disconnectErr) {
    console.warn(`[linked-device] Non-fatal disconnect error when deleting slot ${sessionKey}:`, disconnectErr)
  }

  const linkedPhoneNumberId = `linked-${sessionKey}`
  await db
    .delete(whatsappAccounts)
    .where(eq(whatsappAccounts.phoneNumberId, linkedPhoneNumberId))
    .catch((err) => {
      console.warn(`[linked-device] Non-fatal error deleting linked whatsapp_accounts for ${sessionKey}:`, err)
    })

  await db
    .delete(whatsappLinkedDeviceSessions)
    .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))

  return true
}

/**
 * Returns the operational status of the linked device, reconciling memory socket with DB state.
 */
export async function getLinkedDeviceStatus(sessionKey = "default"): Promise<{
  isConnected: boolean
  session: WhatsappLinkedDeviceSession | null
}> {
  const session = await getLinkedDeviceSessionFromDb(sessionKey)
  const isMemoryActive = isLinkedDeviceConnected(sessionKey)
  const isConnected = isMemoryActive || session?.status === "connected"
  return { isConnected, session }
}

/**
 * Ensures each Linked-Device sessionKey maps to its own distinct whatsapp_accounts row
 * with phoneNumberId = "linked-" + sessionKey and platformType = "LINKED_DEVICE".
 */
export async function ensureLinkedWhatsappAccount(
  sessionPhone?: string | null,
  sessionKey = "default",
  sessionLabel?: string
) {
  const linkedPhoneNumberId = `linked-${sessionKey}`
  const cleanPhone = sessionPhone || "Linked WhatsApp"
  const accountName = sessionLabel || `Linked Device (${cleanPhone})`

  const [existing] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.phoneNumberId, linkedPhoneNumberId))
    .limit(1)

  if (existing) {
    if (sessionPhone && existing.displayPhoneNumber !== sessionPhone) {
      await db
        .update(whatsappAccounts)
        .set({
          displayPhoneNumber: sessionPhone,
          name: accountName,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(whatsappAccounts.id, existing.id))
    }
    return existing
  }

  const [newAccount] = await db
    .insert(whatsappAccounts)
    .values({
      name: accountName,
      phoneNumberId: linkedPhoneNumberId,
      wabaId: `linked-waba-${sessionKey}`,
      displayPhoneNumber: cleanPhone,
      encryptedAccessToken: encrypt(`linked_device_${sessionKey}_mode`),
      webhookVerifyToken: `linked_device_${sessionKey}_token`,
      isActive: true,
      isDefault: false,
      accountRole: "COEXISTENCE_FOUNDER",
      platformType: "LINKED_DEVICE",
    })
    .returning()

  return newAccount
}

/**
 * Initializes the Baileys WebSocket connection for the specified sessionKey.
 * Supports both Live QR Code (`mode: "qr"`) and 8-Digit Pairing Code (`mode: "pairing_code"`).
 */
export async function initBaileysSocket(options: {
  sessionKey?: string
  mode?: "qr" | "pairing_code"
  phoneNumber?: string
  forceRestart?: boolean
}): Promise<{
  socket: WASocket
  status: "connected" | "qr_ready" | "pairing_code_ready" | "connecting"
  qrDataUrl?: string
  pairingCode?: string
}> {
  const sessionKey = options.sessionKey || "default"
  const mode = options.mode || "qr"

  // Check if an existing socket is already connected and reuse it unless forceRestart is requested
  const existingSocket = socketMap.get(sessionKey)
  if (existingSocket && !options.forceRestart) {
    if (existingSocket.user?.id) {
      return { socket: existingSocket, status: "connected" }
    }
  }

  // If forceRestart, close existing socket
  if (existingSocket) {
    try {
      existingSocket.end(new Error("Force restart requested"))
    } catch {
      // ignore
    }
    socketMap.delete(sessionKey)
  }

  const { state, saveCreds, clearAuthState } =
    await initPostgresBaileysAuthState(sessionKey)

  // Update DB status to connecting (creates slot row dynamically if it didn't exist)
  await db
    .insert(whatsappLinkedDeviceSessions)
    .values({
      sessionKey,
      label: options.phoneNumber ? `WhatsApp (${options.phoneNumber})` : "WhatsApp Phone",
      status: "connecting",
      lastError: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: whatsappLinkedDeviceSessions.sessionKey,
      set: {
        status: "connecting",
        lastError: null,
        updatedAt: new Date(),
      },
    })

  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    browser: ["Al Ramlah Travels", "Chrome", "1.0.0"],
  })

  socketMap.set(sessionKey, sock)

  // 1. Connection Updates & Auth Lifecycle
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && mode === "qr") {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 })
        await db
          .update(whatsappLinkedDeviceSessions)
          .set({
            status: "qr_ready",
            qrDataUrl,
            pairingCode: null,
            updatedAt: new Date(),
          })
          .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))
      } catch (qrErr) {
        console.error("[linked-device] Error generating QR data URL:", qrErr)
      }
    }

    if (connection === "open") {
      const userJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null
      const connectedPhone = userJid ? userJid.split("@")[0] : null
      const pushName = sock.user?.name || connectedPhone || "WhatsApp Phone"

      console.log(`[linked-device] Connection OPEN (${sessionKey})! Logged in as: ${userJid} (${pushName})`)

      const currentSession = await getLinkedDeviceSessionFromDb(sessionKey)
      const isGenericLabel =
        !currentSession?.label ||
        currentSession.label.startsWith("Line ") ||
        currentSession.label.startsWith("New WhatsApp") ||
        currentSession.label.startsWith("WhatsApp Phone") ||
        currentSession.label === "Primary Business" ||
        currentSession.label === "Secondary Outreach"

      const dynamicLabel = isGenericLabel
        ? (sock.user?.name ? `${sock.user.name} (${connectedPhone})` : (connectedPhone || "WhatsApp Phone"))
        : currentSession.label

      await db
        .update(whatsappLinkedDeviceSessions)
        .set({
          status: "connected",
          phoneNumber: connectedPhone,
          pushName,
          label: dynamicLabel,
          qrDataUrl: null,
          pairingCode: null,
          lastConnectedAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))

      // Trigger automatic group & status discovery
      try {
        await syncRealWhatsappGroups(sessionKey)
      } catch (syncErr) {
        console.error(`[linked-device] Auto-sync real groups failed for ${sessionKey}:`, syncErr)
      }
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
      const isLoggedOut = statusCode === DisconnectReason.loggedOut

      console.warn(
        `[linked-device] Connection CLOSED (${sessionKey}) code: ${statusCode}, isLoggedOut: ${isLoggedOut}`
      )

      socketMap.delete(sessionKey)

      if (isLoggedOut) {
        await clearAuthState()
        await db
          .update(whatsappLinkedDeviceSessions)
          .set({
            status: "disconnected",
            qrDataUrl: null,
            pairingCode: null,
            lastError: "Device unlinked from WhatsApp mobile",
            updatedAt: new Date(),
          })
          .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))
      } else {
        await db
          .update(whatsappLinkedDeviceSessions)
          .set({
            status: "disconnected",
            qrDataUrl: null,
            pairingCode: null,
            lastError:
              lastDisconnect?.error instanceof Error
                ? lastDisconnect.error.message
                : "Connection closed unexpectedly",
            updatedAt: new Date(),
          })
          .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))
      }
    }
  })

  // 2. Persistent Signal Creds Update Listener
  sock.ev.on("creds.update", saveCreds)

  // 3. Real-Time Chat & Message Ingestion Sync
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const session = await getLinkedDeviceSessionFromDb(sessionKey)
      const connectedPhone = sock.user?.id?.split("@")[0] || session?.phoneNumber
      const account = await ensureLinkedWhatsappAccount(connectedPhone, sessionKey, session?.label)

      for (const msg of messages) {
        if (!msg.key || !msg.message) continue
        const remoteJid = msg.key.remoteJid
        if (!remoteJid) continue

        // We focus on 1-on-1 conversations for Desk Inbox sync
        if (remoteJid.endsWith("@s.whatsapp.net")) {
          const rawPhone = remoteJid.split("@")[0]!
          const normalized = normalizePakistaniPhone(rawPhone)
          const contactPhone = normalized.national03 || rawPhone
          const contactName = msg.pushName || null

          // Extract text body
          const bodyText =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.documentMessage?.caption ||
            null

          // Detect package codes
          const detectedCodes = extractPostRefCodes(bodyText)
          const detectedPostCode = detectedCodes[0] || null

          const isFromMe = Boolean(msg.key.fromMe)
          const now = new Date()

          // Upsert conversation under this line's dedicated account
          const [existingConv] = await db
            .select()
            .from(whatsappConversations)
            .where(
              and(
                eq(whatsappConversations.accountId, account.id),
                eq(whatsappConversations.contactPhone, contactPhone)
              )
            )
            .limit(1)

          let conversationId: string

          if (existingConv) {
            conversationId = existingConv.id
            await db
              .update(whatsappConversations)
              .set({
                contactName: contactName || existingConv.contactName,
                lastMessageAt: now,
                ...(isFromMe ? {} : { lastCustomerMessageAt: now }),
                unreadCount: isFromMe ? existingConv.unreadCount : existingConv.unreadCount + 1,
                ...(detectedPostCode ? { detectedPostCode } : {}),
                updatedAt: now,
              })
              .where(eq(whatsappConversations.id, existingConv.id))
          } else {
            const [newConv] = await db
              .insert(whatsappConversations)
              .values({
                accountId: account.id,
                contactPhone,
                contactName,
                lastMessageAt: now,
                lastCustomerMessageAt: isFromMe ? null : now,
                unreadCount: isFromMe ? 0 : 1,
                detectedPostCode,
                createdAt: now,
                updatedAt: now,
              })
              .returning()
            conversationId = newConv.id
          }

          // Insert message record if not already present
          const wamid = msg.key.id || `baileys-${Date.now()}`
          const [existingMsg] = await db
            .select({ id: whatsappMessages.id })
            .from(whatsappMessages)
            .where(eq(whatsappMessages.wamid, wamid))
            .limit(1)

          if (!existingMsg) {
            let msgType: "text" | "image" | "document" = "text"
            if (msg.message.imageMessage) msgType = "image"
            if (msg.message.documentMessage) msgType = "document"

            await db.insert(whatsappMessages).values({
              conversationId,
              wamid,
              direction: isFromMe ? "outbound" : "inbound",
              status: isFromMe ? "sent" : "delivered",
              messageType: msgType,
              body: bodyText,
              mediaMimeType:
                msg.message.imageMessage?.mimetype ||
                msg.message.documentMessage?.mimetype ||
                null,
              mediaFilename: msg.message.documentMessage?.fileName || null,
              sentAt: msg.messageTimestamp
                ? new Date(Number(msg.messageTimestamp) * 1000)
                : now,
              createdAt: now,
            })
          }
        }
      }
    } catch (upsertErr) {
      console.error("[linked-device] Error in messages.upsert handler:", upsertErr)
    }
  })

  // 4. Handle 8-Digit Pairing Code Mode
  if (mode === "pairing_code" && options.phoneNumber) {
    const cleanDigits = sanitizePhoneNumberForPairing(options.phoneNumber)
    if (cleanDigits.length >= 10 && !sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          console.log(`[linked-device] Requesting pairing code for: ${cleanDigits} (${sessionKey})...`)
          const rawCode = await sock.requestPairingCode(cleanDigits)
          const formattedCode = formatPairingCode(rawCode)
          console.log(`[linked-device] Received pairing code: ${formattedCode} (${sessionKey})`)

          await db
            .update(whatsappLinkedDeviceSessions)
            .set({
              status: "pairing_code_ready",
              pairingCode: formattedCode,
              phoneNumber: cleanDigits,
              qrDataUrl: null,
              updatedAt: new Date(),
            })
            .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))
        } catch (codeErr) {
          console.error(`[linked-device] Failed to request pairing code (${sessionKey}):`, codeErr)
          await db
            .update(whatsappLinkedDeviceSessions)
            .set({
              status: "disconnected",
              lastError:
                codeErr instanceof Error
                  ? codeErr.message
                  : "Failed to generate pairing code from WhatsApp servers",
              updatedAt: new Date(),
            })
            .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))
        }
      }, 1200)
    }
  }

  return {
    socket: sock,
    status: sock.user?.id ? "connected" : "connecting",
  }
}

/**
 * Disconnects and unlinks the linked device session.
 */
export async function disconnectLinkedDevice(sessionKey = "default"): Promise<{
  success: boolean
  error?: string
}> {
  const sock = socketMap.get(sessionKey)
  if (sock) {
    try {
      await sock.logout()
    } catch {
      try {
        sock.end(new Error("User disconnected session"))
      } catch {
        // ignore
      }
    }
    socketMap.delete(sessionKey)
  }

  const { clearAuthState } = await initPostgresBaileysAuthState(sessionKey)
  await clearAuthState()

  await db
    .update(whatsappLinkedDeviceSessions)
    .set({
      status: "disconnected",
      qrDataUrl: null,
      pairingCode: null,
      phoneNumber: null,
      pushName: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))

  return { success: true }
}

/**
 * Queries WhatsApp servers via `groupFetchAllParticipating()` and automatically
 * upserts all real @g.us groups and WhatsApp Status into `marketingChannels`.
 *
 * WhatsApp Status is scoped per sessionKey (`status@broadcast:${sessionKey}`) to avoid unique key collisions.
 */
export async function syncRealWhatsappGroups(sessionKey = "default"): Promise<{
  syncedCount: number
  statusAdded: boolean
}> {
  const sock = socketMap.get(sessionKey)
  if (!sock) {
    throw new Error(
      `WhatsApp Linked Device [${sessionKey}] is not active or connected in memory. Please reconnect the line.`
    )
  }

  const session = await getLinkedDeviceSessionFromDb(sessionKey)
  const sessionJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null
  const connectedPhone = sessionJid ? sessionJid.split("@")[0] : session?.phoneNumber || null

  console.log(`[linked-device] Fetching participating WhatsApp groups for JID ${sessionJid} (${sessionKey})...`)
  const groupsRecord = await sock.groupFetchAllParticipating()
  const groupsList = Object.values(groupsRecord)

  console.log(`[linked-device] Found ${groupsList.length} participating WhatsApp groups for ${sessionKey}.`)

  for (const group of groupsList) {
    const isUserAdmin = Boolean(
      group.participants?.some(
        (p) =>
          jidNormalizedUser(p.id) === sessionJid &&
          (p.admin === "admin" || p.admin === "superadmin")
      )
    )

    const canPost = !group.announce || isUserAdmin
    const memberCount = group.participants ? group.participants.length : 0

    await db
      .insert(marketingChannels)
      .values({
        name: group.subject,
        platform: "whatsapp_group",
        areaTag: "Synced WhatsApp Group",
        externalGroupIdOrHandle: group.id,
        memberCount,
        senderWhatsappNumber: connectedPhone,
        isActive: canPost,
        dailyTargetPosts: 1,
      })
      .onConflictDoUpdate({
        target: marketingChannels.externalGroupIdOrHandle,
        set: {
          name: group.subject,
          memberCount,
          senderWhatsappNumber: connectedPhone,
          isActive: canPost,
        },
      })
  }

  // Upsert session-isolated WhatsApp Status row
  const statusHandle = `status@broadcast:${sessionKey}`
  const phoneLabel = connectedPhone || sessionKey
  const statusCardName = `WhatsApp Status — ${session?.label || phoneLabel}`

  await db
    .insert(marketingChannels)
    .values({
      name: statusCardName,
      platform: "whatsapp_status",
      areaTag: "WhatsApp Status",
      externalGroupIdOrHandle: statusHandle,
      senderWhatsappNumber: connectedPhone,
      isActive: true,
      dailyTargetPosts: 1,
    })
    .onConflictDoUpdate({
      target: marketingChannels.externalGroupIdOrHandle,
      set: {
        name: statusCardName,
        senderWhatsappNumber: connectedPhone,
        isActive: true,
      },
    })

  // Update session record in DB
  await db
    .update(whatsappLinkedDeviceSessions)
    .set({
      groupsSyncedCount: groupsList.length,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))

  return { syncedCount: groupsList.length, statusAdded: true }
}

/**
 * Resolves the optimal active Baileys sessionKey to dispatch a message to a given channel.
 * If preferredSessionKey is specified and not "auto", it honors the preference.
 * Otherwise, it attempts to match the channel's sender phone number to a connected session.
 */
export async function resolveLinkedDeviceSessionForChannel(
  channelSenderPhone?: string | null,
  preferredSessionKey?: string
): Promise<string> {
  if (preferredSessionKey && preferredSessionKey !== "auto") {
    return preferredSessionKey
  }

  const cleanChannelPhone = channelSenderPhone
    ? channelSenderPhone.replace(/\D/g, "")
    : null

  // 1. Check in-memory active sockets for an exact phone match
  if (cleanChannelPhone) {
    for (const [key, sock] of socketMap.entries()) {
      const sockUserPhone = sock.user?.id ? sock.user.id.split(":")[0]?.split("@")[0] : null
      if (sockUserPhone && sockUserPhone.replace(/\D/g, "") === cleanChannelPhone) {
        return key
      }
    }
  }

  // 2. Check DB sessions for an exact phone match where status is connected
  if (cleanChannelPhone) {
    const dbSessions = await db
      .select()
      .from(whatsappLinkedDeviceSessions)
      .where(eq(whatsappLinkedDeviceSessions.status, "connected"))

    for (const s of dbSessions) {
      if (s.phoneNumber && s.phoneNumber.replace(/\D/g, "") === cleanChannelPhone) {
        return s.sessionKey
      }
    }
  }

  // 3. Fallback: Return any currently connected in-memory socket
  for (const [key, sock] of socketMap.entries()) {
    if (sock.user?.id) {
      return key
    }
  }

  // 4. Fallback: Return any connected DB session
  const anyConnectedDb = await db
    .select()
    .from(whatsappLinkedDeviceSessions)
    .where(eq(whatsappLinkedDeviceSessions.status, "connected"))
    .limit(1)

  if (anyConnectedDb[0]) {
    return anyConnectedDb[0].sessionKey
  }

  // 5. Ultimate Fallback: Return "default"
  return "default"
}

/**
 * Iterates all connected sessions and synchronizes real WhatsApp groups and status in 1 click.
 */
export async function syncAllConnectedLinkedDevices(): Promise<{
  totalSyncedGroups: number
  connectedLinesCount: number
  results: Array<{ sessionKey: string; label: string; syncedCount: number; error?: string }>
}> {
  const allSessions = await getAllLinkedDeviceSessions()
  const results: Array<{ sessionKey: string; label: string; syncedCount: number; error?: string }> = []
  let totalSyncedGroups = 0
  let connectedLinesCount = 0

  for (const session of allSessions) {
    const isMemoryActive = isLinkedDeviceConnected(session.sessionKey)
    const isDbConnected = session.status === "connected"

    if (isMemoryActive || isDbConnected) {
      connectedLinesCount++
      try {
        const syncRes = await syncRealWhatsappGroups(session.sessionKey)
        totalSyncedGroups += syncRes.syncedCount
        results.push({
          sessionKey: session.sessionKey,
          label: session.label,
          syncedCount: syncRes.syncedCount,
        })
      } catch (syncErr: unknown) {
        const errMsg = syncErr instanceof Error ? syncErr.message : String(syncErr)
        results.push({
          sessionKey: session.sessionKey,
          label: session.label,
          syncedCount: 0,
          error: errMsg,
        })
      }
    }
  }

  return {
    totalSyncedGroups,
    connectedLinesCount,
    results,
  }
}

/**
 * Sends a direct message, image flyer, or PDF quotation via the linked WhatsApp SIM.
 * Enforces typing presence simulation to mimic human behavior and avoid automated spam penalties.
 * Transparently normalizes composite status JIDs (e.g. status@broadcast:secondary) to status@broadcast.
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
  let sessionKey = options.sessionKey || "default"
  let sock = socketMap.get(sessionKey)

  // If specific socket is not found, fallback to any connected socket
  if (!sock || !sock.user?.id) {
    for (const [key, fallbackSock] of socketMap.entries()) {
      if (fallbackSock.user?.id) {
        sessionKey = key
        sock = fallbackSock
        break
      }
    }
  }

  if (!sock || !sock.user?.id) {
    throw new Error(
      `Linked device [${sessionKey}] is not currently connected. Please link your WhatsApp phone first.`
    )
  }

  const targetJid = normalizeStatusJid(options.jid)

  // Simulate human typing presence
  if (options.simulatePresence !== false) {
    try {
      await sock.sendPresenceUpdate("composing", targetJid)
      const delayMs = Math.floor(Math.random() * (2200 - 1200 + 1)) + 1200
      await new Promise((res) => setTimeout(res, delayMs))
    } catch (presenceErr) {
      console.warn("[linked-device] Presence update error:", presenceErr)
    }
  }

  let messagePayload: any
  if (options.imageUrl) {
    messagePayload = {
      image: { url: options.imageUrl },
      caption: options.caption || options.text || undefined,
    }
  } else if (options.documentUrl) {
    messagePayload = {
      document: { url: options.documentUrl },
      mimetype: "application/pdf",
      fileName: options.filename || "Al-Ramlah-Quotation.pdf",
      caption: options.caption || options.text || undefined,
    }
  } else if (options.text) {
    messagePayload = { text: options.text }
  } else {
    throw new Error("No message content provided (text, image, or document required)")
  }

  const sent = await sock.sendMessage(targetJid, messagePayload)
  const wamid = sent?.key?.id || `linked-${Date.now()}`

  return { success: true, wamid }
}

/**
 * Dispatches an Umrah package poster flyer and caption to a real WhatsApp Group or Status.
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
    simulatePresence: options.simulatePresence !== false,
  })
}
