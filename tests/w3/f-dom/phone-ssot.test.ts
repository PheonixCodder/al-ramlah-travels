import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  constantTimeEqualStrings,
  formatWhatsAppPhone,
  normalizePhoneE164,
  parsePhoneE164,
  phonesMatchStrict,
  toWaMeUrl,
  toWhatsappJid,
} from "../../../lib/phone"
import {
  dispatchAutomatedWhatsappGroupsCampaignSchema,
  formatPairingCode,
  normalizeStatusJid,
  sanitizePhoneNumberForPairing,
  startLinkedDeviceConnectionSchema,
} from "../../../lib/validations/whatsapp-linked-device"
import {
  extractPostRefCodes,
  normalizePakistaniPhone,
} from "../../../lib/whatsapp/phone-utils"

describe("T-049: E.164 & WhatsApp JID Single Source of Truth", () => {
  it("normalizes all Pakistani mobile & landline variants into canonical +92 E.164", () => {
    const pkInputs = [
      "0327-4029701",
      "0327 4029701",
      "3274029701",
      "+92 327 4029701",
      "+92 (0) 327 4029701",
      "+9203274029701",
      "0092 327 4029701",
      "923274029701",
      "923274029701@s.whatsapp.net",
      "923274029701:14@s.whatsapp.net",
    ]

    for (const raw of pkInputs) {
      const parsed = parsePhoneE164(raw)
      assert.equal(parsed.valid, true, `Expected ${raw} to parse as valid`)
      assert.equal(parsed.e164, "+923274029701")
      assert.equal(parsed.e164Digits, "923274029701")
      assert.equal(parsed.countryCode, "92")
      assert.equal(parsed.nationalDigits, "3274029701")
      assert.equal(parsed.national03, "03274029701")

      assert.equal(normalizePhoneE164(raw), "+923274029701")
      assert.equal(formatWhatsAppPhone(raw), "923274029701")
      assert.equal(sanitizePhoneNumberForPairing(raw), "923274029701")
      assert.equal(toWhatsappJid(raw), "923274029701@s.whatsapp.net")

      const waUtil = normalizePakistaniPhone(raw)
      assert.equal(waUtil.normalizedE164, "923274029701")
      assert.equal(waUtil.e164WithPlus, "+923274029701")
      assert.equal(waUtil.national03, "03274029701")
      assert.ok(waUtil.variants.includes("923274029701"))
    }
  })

  it("preserves diaspora international numbers (+44, +1, +966, +971, +32) and strips trunk (0) safely", () => {
    const intlCases: ReadonlyArray<{
      raw: string
      expectedE164: string
      expectedDigits: string
      expectedCc: string
    }> = [
      {
        raw: "+44 (0) 7911 123456",
        expectedE164: "+447911123456",
        expectedDigits: "447911123456",
        expectedCc: "44",
      },
      {
        raw: "0044 07911 123456",
        expectedE164: "+447911123456",
        expectedDigits: "447911123456",
        expectedCc: "44",
      },
      {
        raw: "+1 (555) 234-5678",
        expectedE164: "+15552345678",
        expectedDigits: "15552345678",
        expectedCc: "1",
      },
      {
        raw: "+1 (312) 555-0199",
        expectedE164: "+13125550199",
        expectedDigits: "13125550199",
        expectedCc: "1",
      },
      {
        raw: "(312) 555-0199",
        expectedE164: "+13125550199",
        expectedDigits: "13125550199",
        expectedCc: "1",
      },
      {
        raw: "+966 (0) 50 123 4567",
        expectedE164: "+966501234567",
        expectedDigits: "966501234567",
        expectedCc: "966",
      },
      {
        raw: "+971 50 123 4567",
        expectedE164: "+971501234567",
        expectedDigits: "971501234567",
        expectedCc: "971",
      },
      {
        raw: "+32 2 123 4567",
        expectedE164: "+3221234567",
        expectedDigits: "3221234567",
        expectedCc: "32",
      },
    ]

    for (const c of intlCases) {
      const parsed = parsePhoneE164(c.raw)
      assert.equal(parsed.valid, true, `Failed on international number: ${c.raw}`)
      assert.equal(parsed.e164, c.expectedE164)
      assert.equal(parsed.e164Digits, c.expectedDigits)
      assert.equal(parsed.countryCode, c.expectedCc)
      assert.equal(formatWhatsAppPhone(c.raw), c.expectedDigits)
      assert.equal(sanitizePhoneNumberForPairing(c.raw), c.expectedDigits)
      assert.equal(toWhatsappJid(c.raw), `${c.expectedDigits}@s.whatsapp.net`)
    }
  })

  it("rejects empty, punctuation-only, alphabetic, and truncated phone inputs across all helpers", () => {
    const malformed = [
      "",
      "   ",
      "-------",
      "(   )",
      "12345",
      "4029701",
      "+92327",
      "javascript:alert(1)",
      "user@example.com",
    ]

    for (const bad of malformed) {
      assert.equal(parsePhoneE164(bad).valid, false, `Expected ${bad} to be invalid`)
      assert.equal(normalizePhoneE164(bad), "")
      assert.equal(formatWhatsAppPhone(bad), "")
      assert.equal(toWaMeUrl(bad), "")
      assert.equal(sanitizePhoneNumberForPairing(bad), "")
      assert.equal(normalizePakistaniPhone(bad).normalizedE164, "")
      assert.deepEqual(normalizePakistaniPhone(bad).variants, [])
    }
  })

  it("builds URL-encoded wa.me deep links cleanly via toWaMeUrl", () => {
    assert.equal(toWaMeUrl("0327-4029701"), "https://wa.me/923274029701")
    assert.equal(
      toWaMeUrl("+44 (0) 7911 123456", "Assalamu Alaikum ART-2026-0001"),
      "https://wa.me/447911123456?text=Assalamu%20Alaikum%20ART-2026-0001"
    )
    assert.equal(toWaMeUrl("-------", "Hello"), "")
  })

  it("enforces >=9 national digits, constant-time equality, and zero empty/suffix matches in phonesMatchStrict", () => {
    assert.equal(constantTimeEqualStrings("+923274029701", "+923274029701"), true)
    assert.equal(constantTimeEqualStrings("+923274029701", "+923274029702"), false)
    assert.equal(constantTimeEqualStrings("+923274029701", "+9232740297"), false)

    // Equivalent PK formats match strictly
    assert.equal(phonesMatchStrict("0327-4029701", "+92 327 4029701"), true)
    assert.equal(phonesMatchStrict("3274029701", "00923274029701"), true)

    // Equivalent UK formats match strictly
    assert.equal(phonesMatchStrict("+44 (0) 7911 123456", "+447911123456"), true)

    // Empty, punctuation, and 7-digit partial suffix attacks MUST return false
    assert.equal(phonesMatchStrict("", ""), false)
    assert.equal(phonesMatchStrict("-------", "-------"), false)
    assert.equal(phonesMatchStrict("4029701", "03274029701"), false)
    assert.equal(phonesMatchStrict("1234567", "+447911123456"), false)
    assert.equal(phonesMatchStrict("03274029701", "03190462638"), false)

    // 8-digit national numbers (e.g. Belgian 2 123 4567) have <9 national digits -> rejected by phonesMatchStrict
    assert.equal(phonesMatchStrict("+32 2 123 4567", "+3221234567"), false)
  })

  it("normalizes WhatsApp broadcast, group, newsletter, and pairing schemas cleanly", () => {
    assert.equal(normalizeStatusJid("status@broadcast"), "status@broadcast")
    assert.equal(normalizeStatusJid("status@broadcast:12"), "status@broadcast")
    assert.equal(
      normalizeStatusJid("120363041234567890@g.us"),
      "120363041234567890@g.us"
    )
    assert.equal(
      normalizeStatusJid("0319-0462638"),
      "923190462638@s.whatsapp.net"
    )
    assert.equal(formatPairingCode("abcd1234"), "ABCD-1234")

    assert.deepEqual(
      extractPostRefCodes(
        "Assalamu Alaikum, quote for art-am-21d-01 and ART-WA-20261114-ABCD1234 please!"
      ),
      ["ART-AM-21D-01", "ART-WA-20261114-ABCD1234"]
    )

    // Pairing mode requires a valid phone number; QR mode does not
    assert.equal(
      startLinkedDeviceConnectionSchema.safeParse({
        mode: "qr",
      }).success,
      true
    )
    assert.equal(
      startLinkedDeviceConnectionSchema.safeParse({
        mode: "pairing_code",
        phoneNumber: "-------",
      }).success,
      false
    )
    assert.equal(
      startLinkedDeviceConnectionSchema.safeParse({
        mode: "pairing_code",
        phoneNumber: "+44 (0) 7911 123456",
      }).success,
      true
    )

    // Campaign dispatch delay bounds: maxDelaySec >= minDelaySec
    assert.equal(
      dispatchAutomatedWhatsappGroupsCampaignSchema.safeParse({
        postAssetId: "550e8400-e29b-41d4-a716-446655440000",
        caption: "Ramadan Umrah 2027",
        channelIds: ["550e8400-e29b-41d4-a716-446655440001"],
        minDelaySec: 60,
        maxDelaySec: 20,
      }).success,
      false
    )
  })
})
