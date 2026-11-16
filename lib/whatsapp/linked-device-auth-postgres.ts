import { eq } from "drizzle-orm"
import { db } from "@/db"
import { whatsappLinkedDeviceSessions } from "@/db/schema/whatsapp-crm"

export interface RetiredBaileysAuthState {
  creds: Record<string, never>
  keys: {
    get: (
      type: string,
      ids: string[]
    ) => Promise<Record<string, unknown>>
    set: (data: Record<string, Record<string, unknown>>) => Promise<void>
  }
}

export interface PostgresBaileysAuthState {
  state: RetiredBaileysAuthState
  saveCreds: () => Promise<void>
  clearAuthState: () => Promise<void>
}

/**
 * `OD-01` Option A Sunset Adapter (`T-032`):
 * Server-side Baileys WebSockets have been permanently retired in favor of:
 *   1. Official Meta WhatsApp Cloud API v21.0 (for 1:1 Inbox, Guided Intake & Templates)
 *   2. 100% Ban-Safe Manual Assisted WA Group/Status Share Queue (`/admin/campaigns`)
 *
 * Preserves the `initPostgresBaileysAuthState` signature without importing the Baileys socket SDK
 * at runtime, while allowing `clearAuthState()` to wipe any residual encrypted Signal keys in Postgres.
 */
export async function initPostgresBaileysAuthState(
  sessionKey = "default"
): Promise<PostgresBaileysAuthState> {
  const clearAuthState = async () => {
    await db
      .update(whatsappLinkedDeviceSessions)
      .set({
        status: "disconnected",
        qrDataUrl: null,
        pairingCode: null,
        encryptedAuthCreds: null,
        encryptedAuthKeys: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))
  }

  return {
    state: {
      creds: {},
      keys: {
        get: async () => ({}),
        set: async () => {
          // No-op: Baileys Signal session persistence retired under OD-01 Option A
        },
      },
    },
    saveCreds: async () => {
      // No-op: Baileys Signal session persistence retired under OD-01 Option A
    },
    clearAuthState,
  }
}
