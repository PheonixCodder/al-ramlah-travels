import "dotenv/config"
import { describe, it, after } from "node:test"
import assert from "node:assert/strict"
import { BufferJSON } from "@whiskeysockets/baileys"
import { eq } from "drizzle-orm"
import { db } from "../db"
import { whatsappLinkedDeviceSessions } from "../db/schema/whatsapp-crm"
import {
  sanitizePhoneNumberForPairing,
  formatPairingCode,
  getPacingDelayRange,
  getRandomPacingDelayMs,
  PACING_TIERS,
  startLinkedDeviceConnectionSchema,
  dispatchAutomatedWhatsappGroupsCampaignSchema,
} from "../lib/validations/whatsapp-linked-device"
import { sendWhatsappGroupCampaignPayloadSchema } from "../trigger/send-whatsapp-group-campaign.task"
import { encrypt, decrypt } from "../lib/whatsapp/encryption"

const SAMPLE_UUID_1 = "11111111-2222-4333-8444-555555555555"
const SAMPLE_UUID_2 = "22222222-3333-4444-8555-666666666666"

describe("Spec 0021 / Slice 40: Native WhatsApp Linked-Device Engine & Auto-Sync", () => {
  // ==========================================================================
  // 1. Phone Number Sanitization for 8-Digit Pairing Code
  // ==========================================================================
  describe("sanitizePhoneNumberForPairing()", () => {
    it("converts local 11-digit Pakistani numbers (03xx) to 923xx format without plus", () => {
      assert.equal(sanitizePhoneNumberForPairing("03274029701"), "923274029701")
      assert.equal(sanitizePhoneNumberForPairing("03190462638"), "923190462638")
      assert.equal(sanitizePhoneNumberForPairing("03001234567"), "923001234567")
    })

    it("converts 10-digit Pakistani numbers lacking leading 0 to 923xx", () => {
      assert.equal(sanitizePhoneNumberForPairing("3274029701"), "923274029701")
      assert.equal(sanitizePhoneNumberForPairing("3190462638"), "923190462638")
    })

    it("strips international 00 prefix and handles numbers starting with 0092", () => {
      assert.equal(sanitizePhoneNumberForPairing("00923274029701"), "923274029701")
      assert.equal(sanitizePhoneNumberForPairing("0015551234567"), "15551234567")
    })

    it("strips plus signs, parentheses, spaces, and hyphens", () => {
      assert.equal(sanitizePhoneNumberForPairing("+92 327 4029701"), "923274029701")
      assert.equal(sanitizePhoneNumberForPairing("+92-319-0462638"), "923190462638")
      assert.equal(sanitizePhoneNumberForPairing("+1 (555) 123-4567"), "15551234567")
      assert.equal(sanitizePhoneNumberForPairing("+966 50 123 4567"), "966501234567")
    })

    it("handles already normalized 923xx digits without modification", () => {
      assert.equal(sanitizePhoneNumberForPairing("923274029701"), "923274029701")
    })

    it("returns empty string for inputs without any digits", () => {
      assert.equal(sanitizePhoneNumberForPairing(""), "")
      assert.equal(sanitizePhoneNumberForPairing("abc-xyz"), "")
    })
  })

  // ==========================================================================
  // 2. 8-Digit Pairing Code Formatter
  // ==========================================================================
  describe("formatPairingCode()", () => {
    it("formats 8 alphanumeric characters into standard XXXX-XXXX uppercase format", () => {
      assert.equal(formatPairingCode("abcdefgh"), "ABCD-EFGH")
      assert.equal(formatPairingCode("12345678"), "1234-5678")
      assert.equal(formatPairingCode("AB12CD34"), "AB12-CD34")
    })

    it("formats pairing codes that already contain dashes or spaces cleanly", () => {
      assert.equal(formatPairingCode("ABCD-EFGH"), "ABCD-EFGH")
      assert.equal(formatPairingCode("abcd efgh"), "ABCD-EFGH")
      assert.equal(formatPairingCode("12-34-56-78"), "1234-5678")
    })

    it("preserves non-8-character codes as-is without crashing", () => {
      assert.equal(formatPairingCode("1234"), "1234")
      assert.equal(formatPairingCode("1234567890"), "1234567890")
      assert.equal(formatPairingCode(""), "")
    })
  })

  // ==========================================================================
  // 3. Pacing Delay Tiers & Randomized Interval Generator
  // ==========================================================================
  describe("Pacing Delay Tiers & Interval Logic", () => {
    it("enforces canonical pacing tier presets according to anti-ban specifications", () => {
      assert.equal(PACING_TIERS.fast.minSec, 10)
      assert.equal(PACING_TIERS.fast.maxSec, 20)

      assert.equal(PACING_TIERS.safe.minSec, 25)
      assert.equal(PACING_TIERS.safe.maxSec, 45)

      assert.equal(PACING_TIERS.ultra_safe.minSec, 45)
      assert.equal(PACING_TIERS.ultra_safe.maxSec, 90)
    })

    it("getPacingDelayRange returns correct ranges for each tier", () => {
      assert.deepEqual(getPacingDelayRange("fast"), { minSec: 10, maxSec: 20 })
      assert.deepEqual(getPacingDelayRange("safe"), { minSec: 25, maxSec: 45 })
      assert.deepEqual(getPacingDelayRange("ultra_safe"), { minSec: 45, maxSec: 90 })
    })

    it("getPacingDelayRange defaults to safe tier when invalid tier is supplied", () => {
      assert.deepEqual(getPacingDelayRange("unknown" as any), { minSec: 25, maxSec: 45 })
    })

    it("getPacingDelayRange honours explicit minOverride and maxOverride", () => {
      const custom = getPacingDelayRange("safe", 15, 30)
      assert.deepEqual(custom, { minSec: 15, maxSec: 30 })
    })

    it("getRandomPacingDelayMs produces numbers strictly within bounds", () => {
      for (let i = 0; i < 50; i++) {
        const delay = getRandomPacingDelayMs(10, 20)
        assert.ok(delay >= 10000, `Delay ${delay} should be >= 10000ms`)
        assert.ok(delay <= 20000, `Delay ${delay} should be <= 20000ms`)
        assert.equal(Math.floor(delay), delay, "Delay must be an integer")
      }
    })
  })

  // ==========================================================================
  // 4. Baileys Signal Auth State Serialization & AES-256-GCM Round-Trip
  // ==========================================================================
  describe("Baileys Auth Creds Serialization with BufferJSON & AES-256-GCM", () => {
    it("properly serializes Buffers/Uint8Arrays with BufferJSON replacer/reviver", () => {
      const mockKeypair = {
        private: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
        public: Buffer.from([9, 10, 11, 12, 13, 14, 15, 16]),
      }

      const serialized = JSON.stringify(mockKeypair, BufferJSON.replacer)
      const deserialized = JSON.parse(serialized, BufferJSON.reviver)

      assert.ok(Buffer.isBuffer(deserialized.private) || deserialized.private instanceof Uint8Array)
      assert.deepEqual(Array.from(deserialized.private), [1, 2, 3, 4, 5, 6, 7, 8])
      assert.deepEqual(Array.from(deserialized.public), [9, 10, 11, 12, 13, 14, 15, 16])
    })

    it("encrypts and decrypts Baileys auth state payloads via AES-256-GCM vault", () => {
      const mockCreds = {
        noiseKey: {
          private: Buffer.from("test_noise_private_key_32_bytes!"),
          public: Buffer.from("test_noise_public_key__32_bytes!"),
        },
        pairingEphemeralKeyPair: {
          private: Buffer.from("test_pairing_private_key_32bytes"),
          public: Buffer.from("test_pairing_public_key__32bytes"),
        },
        signedIdentityKey: {
          private: Buffer.from("test_signed_identity_priv_32by"),
          public: Buffer.from("test_signed_identity_pub__32by"),
        },
        registrationId: 987654321,
        advSecretKey: "secret_adv_key_test_string",
        me: { id: "923274029701:1@s.whatsapp.net", name: "Al Ramlah Travels Desk" },
      }

      const serialized = JSON.stringify(mockCreds, BufferJSON.replacer)
      const encrypted = encrypt(serialized)
      assert.ok(encrypted.includes(":"), "Encrypted ciphertext must contain IV and tag delimiters")

      const decrypted = decrypt(encrypted)
      const restored = JSON.parse(decrypted, BufferJSON.reviver)

      assert.equal(restored.registrationId, 987654321)
      assert.equal(restored.me.id, "923274029701:1@s.whatsapp.net")
      assert.equal(restored.me.name, "Al Ramlah Travels Desk")
      assert.deepEqual(
        Array.from(restored.noiseKey.private),
        Array.from(mockCreds.noiseKey.private)
      )
    })
  })

  // ==========================================================================
  // 5. Group Permission & Announcement-Only Filter Invariant
  // ==========================================================================
  describe("Group Posting Permission & Announcement-Only Filter Invariant", () => {
    function computeCanPost(
      group: { announce?: boolean; participants: Array<{ id: string; admin?: string | null }> },
      userJid: string
    ): boolean {
      const isUserAdmin = Boolean(
        group.participants?.some(
          (p) => p.id === userJid && (p.admin === "admin" || p.admin === "superadmin")
        )
      )
      return !group.announce || isUserAdmin
    }

    const sessionJid = "923274029701@s.whatsapp.net"

    it("allows posting in standard open groups (announce: false) even if user is not admin", () => {
      const openGroup = {
        announce: false,
        participants: [
          { id: sessionJid, admin: null },
          { id: "923001234567@s.whatsapp.net", admin: "admin" },
        ],
      }
      assert.equal(computeCanPost(openGroup, sessionJid), true)
    })

    it("allows posting in announcement-only groups (announce: true) if user is an admin", () => {
      const announceGroupAdmin = {
        announce: true,
        participants: [
          { id: sessionJid, admin: "admin" },
          { id: "923001234567@s.whatsapp.net", admin: null },
        ],
      }
      assert.equal(computeCanPost(announceGroupAdmin, sessionJid), true)
    })

    it("allows posting in announcement-only groups if user is superadmin", () => {
      const announceGroupSuperAdmin = {
        announce: true,
        participants: [
          { id: sessionJid, admin: "superadmin" },
          { id: "923001234567@s.whatsapp.net", admin: null },
        ],
      }
      assert.equal(computeCanPost(announceGroupSuperAdmin, sessionJid), true)
    })

    it("blocks posting in announcement-only groups if user is a regular participant", () => {
      const announceGroupRegularMember = {
        announce: true,
        participants: [
          { id: sessionJid, admin: null },
          { id: "923001234567@s.whatsapp.net", admin: "admin" },
        ],
      }
      assert.equal(computeCanPost(announceGroupRegularMember, sessionJid), false)
    })
  })

  // ==========================================================================
  // 6. Validation Schemas for Linked Device & Campaigns
  // ==========================================================================
  describe("Zod Validation Schemas", () => {
    describe("startLinkedDeviceConnectionSchema", () => {
      it("validates QR mode connection request", () => {
        const parsed = startLinkedDeviceConnectionSchema.parse({
          mode: "qr",
        })
        assert.equal(parsed.mode, "qr")
        assert.ok(
          parsed.sessionKey === "auto" || parsed.sessionKey === "default"
        )
      })

      it("validates pairing code mode connection request with phone number", () => {
        const parsed = startLinkedDeviceConnectionSchema.parse({
          mode: "pairing_code",
          phoneNumber: "03274029701",
          sessionKey: "primary",
        })
        assert.equal(parsed.mode, "pairing_code")
        assert.equal(parsed.phoneNumber, "03274029701")
        assert.equal(parsed.sessionKey, "primary")
      })

      it("rejects invalid mode", () => {
        assert.throws(() => {
          startLinkedDeviceConnectionSchema.parse({
            mode: "bluetooth",
          })
        })
      })
    })

    describe("dispatchAutomatedWhatsappGroupsCampaignSchema", () => {
      it("accepts valid automated group campaign payload", () => {
        const payload = {
          postAssetId: SAMPLE_UUID_1,
          caption: "Al Ramlah Travels Luxury Umrah Package 2026. Contact 03274029701.",
          channelIds: [SAMPLE_UUID_1, SAMPLE_UUID_2],
          pacingTier: "safe" as const,
        }
        const parsed = dispatchAutomatedWhatsappGroupsCampaignSchema.parse(payload)
        assert.equal(parsed.postAssetId, SAMPLE_UUID_1)
        assert.equal(parsed.channelIds.length, 2)
        assert.equal(parsed.pacingTier, "safe")
        assert.ok(
          parsed.sessionKey === "auto" || parsed.sessionKey === "default"
        )
      })

      it("rejects empty channelIds array", () => {
        assert.throws(() => {
          dispatchAutomatedWhatsappGroupsCampaignSchema.parse({
            postAssetId: SAMPLE_UUID_1,
            caption: "Valid caption",
            channelIds: [],
          })
        }, /Select at least 1 WhatsApp channel/)
      })

      it("rejects empty caption", () => {
        assert.throws(() => {
          dispatchAutomatedWhatsappGroupsCampaignSchema.parse({
            postAssetId: SAMPLE_UUID_1,
            caption: "",
            channelIds: [SAMPLE_UUID_1],
          })
        }, /Caption cannot be empty/)
      })

      it("rejects invalid postAssetId UUID", () => {
        assert.throws(() => {
          dispatchAutomatedWhatsappGroupsCampaignSchema.parse({
            postAssetId: "not-a-uuid",
            caption: "Valid caption",
            channelIds: [SAMPLE_UUID_1],
          })
        }, /Invalid Post Asset ID/)
      })
    })

    describe("sendWhatsappGroupCampaignPayloadSchema (Trigger.dev Task)", () => {
      it("accepts task payload with custom delay overrides", () => {
        const taskPayload = {
          postAssetId: SAMPLE_UUID_1,
          caption: "Test broadcast caption",
          channelIds: [SAMPLE_UUID_1],
          pacingTier: "ultra_safe" as const,
          minDelaySec: 50,
          maxDelaySec: 100,
          sessionKey: "default",
        }
        const parsed = sendWhatsappGroupCampaignPayloadSchema.parse(taskPayload)
        assert.equal(parsed.pacingTier, "ultra_safe")
        assert.equal(parsed.minDelaySec, 50)
        assert.equal(parsed.maxDelaySec, 100)
      })
    })
  })

  // ==========================================================================
  // 7. Live Database Session Cycle & Cleanup Verification
  // ==========================================================================
  describe("Neon Database Session Cycle & Cleanup", () => {
    const testSessionKey = `test_slice40_${Date.now()}`

    after(async () => {
      // Ensure test session is completely purged from live Neon DB so zero leftover test rows exist!
      try {
        await db
          .delete(whatsappLinkedDeviceSessions)
          .where(eq(whatsappLinkedDeviceSessions.sessionKey, testSessionKey))
      } catch (err) {
        console.warn("[Test Cleanup] Error purging test session row:", err)
      }
    })

    it("inserts, updates status, and reads whatsappLinkedDeviceSessions in Neon PostgreSQL", async () => {
      const dummyEncryptedCreds = encrypt(JSON.stringify({ testCred: true }))

      // 1. Insert test session
      const [inserted] = await db
        .insert(whatsappLinkedDeviceSessions)
        .values({
          sessionKey: testSessionKey,
          status: "connecting",
          phoneNumber: "923274029701",
          encryptedAuthCreds: dummyEncryptedCreds,
          updatedAt: new Date(),
        })
        .returning()

      assert.ok(inserted.id)
      assert.equal(inserted.sessionKey, testSessionKey)
      assert.equal(inserted.status, "connecting")

      // 2. Update to connected
      const [updated] = await db
        .update(whatsappLinkedDeviceSessions)
        .set({
          status: "connected",
          pushName: "Al Ramlah Test Desk",
          updatedAt: new Date(),
        })
        .where(eq(whatsappLinkedDeviceSessions.sessionKey, testSessionKey))
        .returning()

      assert.equal(updated.status, "connected")
      assert.equal(updated.pushName, "Al Ramlah Test Desk")

      // 3. Verify read query
      const [queried] = await db
        .select()
        .from(whatsappLinkedDeviceSessions)
        .where(eq(whatsappLinkedDeviceSessions.sessionKey, testSessionKey))
        .limit(1)

      assert.ok(queried)
      assert.equal(queried.status, "connected")
      assert.equal(queried.phoneNumber, "923274029701")
      assert.ok(queried.encryptedAuthCreds)
      assert.deepEqual(JSON.parse(decrypt(queried.encryptedAuthCreds)), { testCred: true })
    })
  })
})
