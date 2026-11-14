import { BufferJSON, initAuthCreds, proto } from "@whiskeysockets/baileys"
import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataSet,
  SignalDataTypeMap,
} from "@whiskeysockets/baileys"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { whatsappLinkedDeviceSessions } from "@/db/schema/whatsapp-crm"
import { decrypt, encrypt } from "@/lib/whatsapp/encryption"

export interface PostgresBaileysAuthState {
  state: AuthenticationState
  saveCreds: () => Promise<void>
  clearAuthState: () => Promise<void>
}

/**
 * Custom persistent authentication state adapter for Baileys backed by Neon PostgreSQL.
 * Encrypts Signal keys and credentials with AES-256-GCM.
 * This guarantees linked device sessions survive server restarts and Next.js hot reloads.
 */
export async function initPostgresBaileysAuthState(
  sessionKey = "default"
): Promise<PostgresBaileysAuthState> {
  const [session] = await db
    .select()
    .from(whatsappLinkedDeviceSessions)
    .where(eq(whatsappLinkedDeviceSessions.sessionKey, sessionKey))
    .limit(1)

  let creds: AuthenticationCreds
  const keysStore: Record<string, Record<string, any>> = {}

  if (session?.encryptedAuthCreds) {
    try {
      const decryptedCreds = decrypt(session.encryptedAuthCreds)
      creds = JSON.parse(decryptedCreds, BufferJSON.reviver)
    } catch (err) {
      console.warn("[usePostgresBaileysAuthState] Failed to decrypt creds, initializing fresh:", err)
      creds = initAuthCreds()
    }
  } else {
    creds = initAuthCreds()
  }

  if (session?.encryptedAuthKeys) {
    try {
      const decryptedKeys = decrypt(session.encryptedAuthKeys)
      const parsedKeys = JSON.parse(decryptedKeys, BufferJSON.reviver)
      if (parsedKeys && typeof parsedKeys === "object") {
        Object.assign(keysStore, parsedKeys)
      }
    } catch (err) {
      console.warn("[usePostgresBaileysAuthState] Failed to decrypt keys:", err)
    }
  }

  const saveToDb = async () => {
    try {
      const encCreds = encrypt(JSON.stringify(creds, BufferJSON.replacer))
      const encKeys = encrypt(JSON.stringify(keysStore, BufferJSON.replacer))

      await db
        .insert(whatsappLinkedDeviceSessions)
        .values({
          sessionKey,
          encryptedAuthCreds: encCreds,
          encryptedAuthKeys: encKeys,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: whatsappLinkedDeviceSessions.sessionKey,
          set: {
            encryptedAuthCreds: encCreds,
            encryptedAuthKeys: encKeys,
            updatedAt: new Date(),
          },
        })
    } catch (err) {
      console.error("[usePostgresBaileysAuthState] Error saving auth state to Neon:", err)
    }
  }

  const clearAuthState = async () => {
    try {
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
    } catch (err) {
      console.error("[usePostgresBaileysAuthState] Error clearing auth state:", err)
    }
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: Record<string, any> = {}
          for (const id of ids) {
            const val = keysStore[type]?.[id]
            if (val) {
              data[id] =
                type === "app-state-sync-key"
                  ? proto.Message.AppStateSyncKeyData.fromObject(val)
                  : val
            }
          }
          return data
        },
        set: async (data: SignalDataSet) => {
          for (const category in data) {
            keysStore[category] = keysStore[category] || {}
            for (const id in data[category as keyof SignalDataTypeMap]) {
              const value = data[category as keyof SignalDataTypeMap]![id]
              if (value) {
                keysStore[category][id] = value
              } else {
                delete keysStore[category][id]
              }
            }
          }
          await saveToDb()
        },
      },
    },
    saveCreds: saveToDb,
    clearAuthState,
  }
}
