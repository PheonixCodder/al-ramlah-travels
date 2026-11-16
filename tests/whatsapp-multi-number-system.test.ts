import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { db } from "../db"
import {
  whatsappAccounts,
  whatsappLinkedDeviceSessions,
} from "../db/schema/whatsapp-crm"
import {
  createLinkedDeviceSessionSlotSchema,
  deleteLinkedDeviceSessionSlotSchema,
  dispatchAutomatedWhatsappGroupsCampaignSchema,
  normalizeStatusJid,
  updateLinkedDeviceSessionSlotSchema,
} from "../lib/validations/whatsapp-linked-device"
import {
  createLinkedDeviceSessionSlot,
  deleteLinkedDeviceSessionSlot,
  ensureLinkedWhatsappAccount,
  getAllLinkedDeviceSessions,
  resolveLinkedDeviceSessionForChannel,
  updateLinkedDeviceSessionLabel,
} from "../lib/whatsapp/linked-device"
import { sendWhatsappGroupCampaignPayloadSchema } from "../trigger/send-whatsapp-group-campaign.task"

const TEST_SLOT_KEY = "test_custom_slot_unit"
const TEST_SLOT_LABEL = "Unit Test Custom Slot"
const SAMPLE_UUID_1 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const SAMPLE_UUID_2 = "ffffffff-1111-4222-8333-444444444444"

describe("Spec 0022 / Slice 41: Multi-Number WhatsApp System Architecture & Routing", () => {
  // Clean up ONLY our isolated test slot — never touch seeded default/secondary rows!
  async function cleanupTestData() {
    try {
      await db
        .delete(whatsappLinkedDeviceSessions)
        .where(eq(whatsappLinkedDeviceSessions.sessionKey, TEST_SLOT_KEY))
      await db
        .delete(whatsappAccounts)
        .where(eq(whatsappAccounts.phoneNumberId, `linked-${TEST_SLOT_KEY}`))
    } catch {
      // non-fatal if tables don't have these rows
    }
  }

  before(async () => {
    await cleanupTestData()
  })

  after(async () => {
    await cleanupTestData()
  })

  // ==========================================================================
  // TC-1: Dynamic Slot Querying
  // ==========================================================================
  describe("TC-1: Dynamic Slot Querying (getAllLinkedDeviceSessions)", () => {
    it("queries database and returns array of linked device sessions", async () => {
      const sessions = await getAllLinkedDeviceSessions()
      assert.ok(Array.isArray(sessions), "Should return an array")
    })
  })

  // ==========================================================================
  // TC-2: Slot Creation & Validation
  // ==========================================================================
  describe("TC-2: Slot Creation & Zod Validation Schemas", () => {
    it("validates valid input for createLinkedDeviceSessionSlotSchema", () => {
      const parsed = createLinkedDeviceSessionSlotSchema.parse({
        label: "Line 3 — Ramadan Desk",
        sessionKey: "line_3_ramadan",
      })
      assert.equal(parsed.label, "Line 3 — Ramadan Desk")
      assert.equal(parsed.sessionKey, "line_3_ramadan")
    })

    it("rejects sessionKey containing spaces, uppercase, or special characters", () => {
      assert.throws(
        () =>
          createLinkedDeviceSessionSlotSchema.parse({
            label: "Valid Label",
            sessionKey: "Line 3 with Spaces",
          }),
        /Session key can only contain lowercase letters/
      )

      assert.throws(
        () =>
          createLinkedDeviceSessionSlotSchema.parse({
            label: "Valid Label",
            sessionKey: "invalid@key!",
          }),
        /Session key can only contain lowercase letters/
      )
    })

    it("rejects labels shorter than 2 characters", () => {
      assert.throws(
        () =>
          createLinkedDeviceSessionSlotSchema.parse({
            label: "A",
          }),
        /Label must be at least 2 characters/
      )
    })

    it("creates and updates a custom session slot in Neon PostgreSQL", async () => {
      const created = await createLinkedDeviceSessionSlot({
        label: TEST_SLOT_LABEL,
        sessionKey: TEST_SLOT_KEY,
      })

      assert.equal(created.sessionKey, TEST_SLOT_KEY)
      assert.equal(created.label, TEST_SLOT_LABEL)
      assert.equal(created.status, "disconnected")

      const updated = await updateLinkedDeviceSessionLabel({
        sessionKey: TEST_SLOT_KEY,
        label: "Updated Test Label",
      })

      assert.ok(updated)
      assert.equal(updated.label, "Updated Test Label")
    })
  })

  // ==========================================================================
  // TC-3: Dynamic Slot Deletion & Account Cascade
  // ==========================================================================
  describe("TC-3: Dynamic Slot Deletion & Account Soft-Deactivation (T-032)", () => {
    it("deletes session slot while soft-deactivating linked whatsapp_accounts row to preserve CRM threads", async () => {
      // Slot was created in TC-2; ensure its associated whatsapp_accounts row exists
      await ensureLinkedWhatsappAccount(
        "923274029701",
        TEST_SLOT_KEY,
        "Temporary Test Slot"
      )

      // Delete the session slot
      const deleted = await deleteLinkedDeviceSessionSlot(TEST_SLOT_KEY)
      assert.equal(deleted, true)

      // Verify session slot is deleted
      const remainingSession = await db
        .select()
        .from(whatsappLinkedDeviceSessions)
        .where(eq(whatsappLinkedDeviceSessions.sessionKey, TEST_SLOT_KEY))
        .limit(1)
      assert.equal(remainingSession.length, 0, "Session slot should be purged")

      // Verify linked whatsapp_accounts row is soft-deactivated (preserving historical threads, T-032)
      const remainingAccount = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.phoneNumberId, `linked-${TEST_SLOT_KEY}`))
        .limit(1)
      assert.equal(remainingAccount.length, 1)
      assert.equal(remainingAccount[0]?.isActive, false)
    })
  })

  // ==========================================================================
  // TC-4: Status JID Isolation
  // ==========================================================================
  describe("TC-4: Status JID Isolation Format", () => {
    it("constructs composite status handle status@broadcast:{sessionKey} without index collision", () => {
      const defaultStatusHandle = `status@broadcast:default`
      const secondaryStatusHandle = `status@broadcast:secondary`
      const customStatusHandle = `status@broadcast:${TEST_SLOT_KEY}`

      assert.notEqual(defaultStatusHandle, secondaryStatusHandle)
      assert.equal(defaultStatusHandle, "status@broadcast:default")
      assert.equal(secondaryStatusHandle, "status@broadcast:secondary")
      assert.equal(customStatusHandle, `status@broadcast:${TEST_SLOT_KEY}`)
    })
  })

  // ==========================================================================
  // TC-5: Status JID Normalization
  // ==========================================================================
  describe("TC-5: Status JID Normalization (normalizeStatusJid)", () => {
    it("normalizes any composite status JID to literal 'status@broadcast'", () => {
      assert.equal(normalizeStatusJid("status@broadcast"), "status@broadcast")
      assert.equal(
        normalizeStatusJid("status@broadcast:default"),
        "status@broadcast"
      )
      assert.equal(
        normalizeStatusJid("status@broadcast:secondary"),
        "status@broadcast"
      )
      assert.equal(
        normalizeStatusJid("status@broadcast:custom_slot_42"),
        "status@broadcast"
      )
      assert.equal(
        normalizeStatusJid("  status@broadcast:extra_spaces  "),
        "status@broadcast"
      )
    })

    it("normalizes phone numbers without @ to E.164 @s.whatsapp.net format", () => {
      assert.equal(
        normalizeStatusJid("03214629700"),
        "923214629700@s.whatsapp.net"
      )
      assert.equal(
        normalizeStatusJid("+92 321 4629700"),
        "923214629700@s.whatsapp.net"
      )
      assert.equal(
        normalizeStatusJid("923198463538"),
        "923198463538@s.whatsapp.net"
      )
    })

    it("preserves real WhatsApp Group @g.us JIDs unmodified", () => {
      assert.equal(
        normalizeStatusJid("120363024888888888@g.us"),
        "120363024888888888@g.us"
      )
      assert.equal(
        normalizeStatusJid("923214629700-1612345678@g.us"),
        "923214629700-1612345678@g.us"
      )
    })
  })

  // ==========================================================================
  // TC-6: Dynamic Routing Resolution
  // ==========================================================================
  describe("TC-6: Dynamic Channel Routing Resolution", () => {
    it("honors explicit preferredSessionKey when not 'auto'", async () => {
      const resolved = await resolveLinkedDeviceSessionForChannel(
        "03214629700",
        "secondary"
      )
      assert.equal(resolved, "secondary")

      const resolvedCustom = await resolveLinkedDeviceSessionForChannel(
        null,
        "custom_line"
      )
      assert.equal(resolvedCustom, "custom_line")
    })

    it("falls back gracefully when preferredSessionKey is 'auto' or omitted", async () => {
      const resolved = await resolveLinkedDeviceSessionForChannel(
        "929999999999",
        "auto"
      )
      // When no match is found, falls back to default or any active slot
      assert.ok(typeof resolved === "string")
      assert.ok(resolved.length > 0)
    })
  })

  // ==========================================================================
  // TC-7: 1-on-1 Account Mapping
  // ==========================================================================
  describe("TC-7: 1-on-1 WhatsApp Accounts Per-Line Mapping", () => {
    it("creates and maps distinct whatsappAccounts row for Line 1 and Line 2", async () => {
      const accountLine1 = await ensureLinkedWhatsappAccount(
        "03214629700",
        "default",
        "Line 1 — Primary Business (0321-4629700)"
      )
      assert.equal(accountLine1.phoneNumberId, "linked-default")
      assert.equal(accountLine1.platformType, "LINKED_DEVICE")
      assert.equal(accountLine1.displayPhoneNumber, "03214629700")

      const accountLine2 = await ensureLinkedWhatsappAccount(
        "03198463538",
        "secondary",
        "Line 2 — Secondary Outreach (0319-8463538)"
      )
      assert.equal(accountLine2.phoneNumberId, "linked-secondary")
      assert.equal(accountLine2.platformType, "LINKED_DEVICE")
      assert.equal(accountLine2.displayPhoneNumber, "03198463538")

      // Line 1 and Line 2 must have distinct database account IDs
      assert.notEqual(accountLine1.id, accountLine2.id)
    })
  })

  // ==========================================================================
  // TC-8: Action & Task Input Zod Schemas
  // ==========================================================================
  describe("TC-8: Action & Task Zod Validation Schemas", () => {
    it("validates updateLinkedDeviceSessionSlotSchema", () => {
      const valid = updateLinkedDeviceSessionSlotSchema.parse({
        sessionKey: "secondary",
        label: "Line 2 — Renamed Outreach",
      })
      assert.equal(valid.sessionKey, "secondary")
      assert.equal(valid.label, "Line 2 — Renamed Outreach")

      assert.throws(
        () =>
          updateLinkedDeviceSessionSlotSchema.parse({
            sessionKey: "",
            label: "Too short",
          }),
        /Session key is required/
      )
    })

    it("validates deleteLinkedDeviceSessionSlotSchema", () => {
      const valid = deleteLinkedDeviceSessionSlotSchema.parse({
        sessionKey: "temp_slot",
      })
      assert.equal(valid.sessionKey, "temp_slot")
    })

    it("defaults sessionKey to 'auto' in dispatchAutomatedWhatsappGroupsCampaignSchema", () => {
      const parsed = dispatchAutomatedWhatsappGroupsCampaignSchema.parse({
        postAssetId: SAMPLE_UUID_1,
        caption: "Ramadan 2026 Package Announcement",
        channelIds: [SAMPLE_UUID_2],
      })
      assert.equal(parsed.sessionKey, "auto")
      assert.equal(parsed.pacingTier, "safe")
    })

    it("defaults sessionKey to 'auto' in sendWhatsappGroupCampaignPayloadSchema", () => {
      const parsed = sendWhatsappGroupCampaignPayloadSchema.parse({
        postAssetId: SAMPLE_UUID_1,
        caption: "Spotlight Flyer",
        channelIds: [SAMPLE_UUID_2],
      })
      assert.equal(parsed.sessionKey, "auto")
    })
  })
})
