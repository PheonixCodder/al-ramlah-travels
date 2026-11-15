import "./setup/hermetic-env"
import { describe, it, after } from "node:test"
import assert from "node:assert/strict"
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
  type PacingTier,
} from "../lib/validations/whatsapp-linked-device"
import {
  BAILEYS_SUNSET_MODE,
  BAILEYS_SUNSET_NOTICE,
  createLinkedDeviceSessionSlot,
  deleteLinkedDeviceSessionSlot,
  disconnectLinkedDevice,
  getActiveBaileysSocket,
  getLinkedDeviceStatus,
  initBaileysSocket,
  isLinkedDeviceConnected,
  sendLinkedDeviceMessage,
  syncRealWhatsappGroups,
  updateLinkedDeviceSessionLabel,
} from "../lib/whatsapp/linked-device"
import {
  resolveValidWhatsappGroupOrStatusHandle,
  sendWhatsappGroupCampaignPayloadSchema,
} from "../trigger/send-whatsapp-group-campaign.task"
import { encrypt, decrypt } from "../lib/whatsapp/encryption"

const SAMPLE_UUID_1 = "11111111-2222-4333-8444-555555555555"
const SAMPLE_UUID_2 = "22222222-3333-4444-8555-666666666666"

describe("Spec 0021 / OD-01 Option A: WhatsApp Linked-Device Sunset & Manual Assisted Queue", () => {
  // ==========================================================================
  // 1. Phone Number Sanitization for E.164 WhatsApp Formatting
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
  // 3. Pacing Delay Tiers & Interval Logic
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
      const unknownTier = "unknown" as unknown as PacingTier
      assert.deepEqual(getPacingDelayRange(unknownTier), { minSec: 25, maxSec: 45 })
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
  // 4. OD-01 Option A Sunset Contract & AES-256-GCM Vault Round-Trip
  // ==========================================================================
  describe("OD-01 Baileys Sunset & AES-256-GCM Vault Security", () => {
    it("enforces manual_assisted_queue sunset mode with zero live Baileys sockets", async () => {
      assert.equal(BAILEYS_SUNSET_MODE, "manual_assisted_queue")
      assert.ok(BAILEYS_SUNSET_NOTICE.includes("OD-01 Option A"))
      assert.equal(getActiveBaileysSocket("default"), null)
      assert.equal(isLinkedDeviceConnected("default"), false)

      const syncRes = await syncRealWhatsappGroups("default")
      assert.equal(syncRes.syncedCount, 0)
      assert.equal(syncRes.statusAdded, false)
      assert.equal(syncRes.mode, "manual_assisted_queue")

      await assert.rejects(
        () =>
          sendLinkedDeviceMessage({
            jid: "120363024849102938@g.us",
            text: "Test group message",
          }),
        /MANUAL_ASSISTED_QUEUE_REQUIRED/
      )
    })

    it("encrypts and decrypts structured credential JSON via v2 AES-256-GCM HKDF vault", () => {
      const mockPayload = {
        lineLabel: "Askari 10 Lahore Cantt Desk",
        phoneNumber: "923274029701",
        binaryDigestBase64: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]).toString("base64"),
      }

      const serialized = JSON.stringify(mockPayload)
      const encrypted = encrypt(serialized)
      assert.ok(encrypted.startsWith("v2:"), "Vault output must use v2 versioned AES-256-GCM format")

      const decrypted = decrypt(encrypted)
      const restored = JSON.parse(decrypted) as typeof mockPayload
      assert.equal(restored.lineLabel, "Askari 10 Lahore Cantt Desk")
      assert.equal(restored.phoneNumber, "923274029701")
      assert.deepEqual(
        Array.from(Buffer.from(restored.binaryDigestBase64, "base64")),
        [1, 2, 3, 4, 5, 6, 7, 8]
      )
    })
  })

  // ==========================================================================
  // 5. Real Group & Status Handle Validator (resolveValidWhatsappGroupOrStatusHandle)
  // ==========================================================================
  describe("resolveValidWhatsappGroupOrStatusHandle() (OD-01 / T-073)", () => {
    it("accepts genuine @g.us group JIDs", () => {
      const res = resolveValidWhatsappGroupOrStatusHandle({
        platform: "whatsapp_group",
        externalGroupIdOrHandle: "120363024849102938@g.us",
      })
      assert.equal(res.valid, true)
      if (res.valid) {
        assert.equal(res.targetJid, "120363024849102938@g.us")
      }
    })

    it("accepts whatsapp_status blank or status@broadcast handles cleanly", () => {
      const blankStatus = resolveValidWhatsappGroupOrStatusHandle({
        platform: "whatsapp_status",
        externalGroupIdOrHandle: "",
      })
      assert.equal(blankStatus.valid, true)
      if (blankStatus.valid) {
        assert.equal(blankStatus.targetJid, "status@broadcast")
      }

      const slottedStatus = resolveValidWhatsappGroupOrStatusHandle({
        platform: "whatsapp_status",
        externalGroupIdOrHandle: "status@broadcast:default",
      })
      assert.equal(slottedStatus.valid, true)
      if (slottedStatus.valid) {
        assert.equal(slottedStatus.targetJid, "status@broadcast:default")
      }
    })

    it("rejects missing handles and bare phone numbers on whatsapp_group channels", () => {
      const missing = resolveValidWhatsappGroupOrStatusHandle({
        platform: "whatsapp_group",
        externalGroupIdOrHandle: null,
      })
      assert.equal(missing.valid, false)

      const directPhone = resolveValidWhatsappGroupOrStatusHandle({
        platform: "whatsapp_group",
        externalGroupIdOrHandle: "923274029701@s.whatsapp.net",
      })
      assert.equal(directPhone.valid, false)
    })
  })

  // ==========================================================================
  // 6. Validation Schemas for Linked Device & Manual Assisted Campaigns
  // ==========================================================================
  describe("Zod Validation Schemas", () => {
    describe("startLinkedDeviceConnectionSchema", () => {
      it("validates QR mode connection request", () => {
        const parsed = startLinkedDeviceConnectionSchema.parse({
          mode: "qr",
        })
        assert.equal(parsed.mode, "qr")
        assert.ok(parsed.sessionKey === "auto" || parsed.sessionKey === "default")
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
      it("accepts valid group campaign queue payload", () => {
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
        assert.ok(parsed.sessionKey === "auto" || parsed.sessionKey === "default")
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
  // 7. Disposable Audit PostgreSQL Session Slot Lifecycle & Scrubbing
  // ==========================================================================
  describe("Disposable Audit PostgreSQL Session Slot Lifecycle", () => {
    const testSessionKey = "test_w3c_slot_sunset_01"

    after(async () => {
      await db
        .delete(whatsappLinkedDeviceSessions)
        .where(eq(whatsappLinkedDeviceSessions.sessionKey, testSessionKey))
        .catch(() => null)
    })

    it("creates, relabels, normalizes sunset status, disconnects (scrubbing keys), and deletes slot", async () => {
      await db
        .delete(whatsappLinkedDeviceSessions)
        .where(eq(whatsappLinkedDeviceSessions.sessionKey, testSessionKey))

      const created = await createLinkedDeviceSessionSlot({
        sessionKey: testSessionKey,
        label: "Askari 10 Lahore Primary Queue",
      })
      assert.equal(created.sessionKey, testSessionKey)
      assert.equal(created.status, "disconnected")

      const relabeled = await updateLinkedDeviceSessionLabel({
        sessionKey: testSessionKey,
        label: "Askari 10 Lahore Cantt VIP Queue",
      })
      assert.ok(relabeled)
      assert.equal(relabeled.label, "Askari 10 Lahore Cantt VIP Queue")

      const initRes = await initBaileysSocket({
        sessionKey: testSessionKey,
        mode: "qr",
      })
      assert.equal(initRes.socket, null)
      assert.equal(initRes.status, "disconnected")
      assert.equal(initRes.mode, "manual_assisted_queue")

      const statusRes = await getLinkedDeviceStatus(testSessionKey)
      assert.equal(statusRes.isConnected, false)
      assert.equal(statusRes.mode, "manual_assisted_queue")

      const disc = await disconnectLinkedDevice(testSessionKey)
      assert.equal(disc.success, true)

      const deleted = await deleteLinkedDeviceSessionSlot(testSessionKey)
      assert.equal(deleted, true)
    })
  })
})
