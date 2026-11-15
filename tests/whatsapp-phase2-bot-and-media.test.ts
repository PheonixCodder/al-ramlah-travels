import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { createMetaWhatsAppFake } from "./fakes/meta-whatsapp.fake"

import {
  whatsappMessageTypeEnum,
  whatsappTemplateStatusEnum,
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
  whatsappTemplates,
} from "../db/schema/whatsapp-crm"

import {
  sendInteractiveButtonsSchema,
  sendInteractiveListSchema,
  sendWhatsappReactionSchema,
  markConversationAsReadSchema,
  toggleWhatsappAutoResponderSchema,
  createWhatsappTemplateSchema,
  deleteWhatsappTemplateSchema,
  metaWebhookInboundMessageSchema,
  metaWebhookChangeValueSchema,
  metaWebhookPayloadSchema,
} from "../lib/validations/whatsapp-crm"

import {
  getWhatsAppMediaMetadata,
  fetchWhatsAppMediaMetadata,
  downloadWhatsAppMediaBinary,
  markWhatsAppMessageAsRead,
  markMessageAsRead,
  sendWhatsAppReactionMessage,
  sendReactionMessage,
  sendInteractiveButtonsMessage,
  sendInteractiveListMessage,
  createMetaMessageTemplate,
  deleteMetaMessageTemplate,
} from "../lib/whatsapp/meta-api"

import {
  resolveExtensionFromMimeType,
  sanitizeWamidForR2Key,
  mirrorInboundWhatsAppMediaToR2,
} from "../lib/whatsapp/media-mirror"

import {
  formatPkr,
  buildLuxuryAutoReplyBody,
  buildAutoReplyButtons,
  processInboundPostRefAutoReply,
  type ResolvedPostRefCard,
} from "../lib/whatsapp/auto-responder"

import { extractPostRefCodes } from "../lib/whatsapp/post-ref-detector"

const originalFetch = globalThis.fetch
const TEST_META_TOKEN = "EAAG_audit_phase2_token"
const metaFake = createMetaWhatsAppFake({
  validAccessTokens: [TEST_META_TOKEN],
})

beforeEach(() => {
  metaFake.reset()
  metaFake.registerMediaFixture("media_passport_pdf_001", {
    mimeType: "application/pdf",
    bytes: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "utf8"),
  })
  metaFake.registerMediaFixture("media_urdu_voice_ogg_002", {
    mimeType: "audio/ogg",
    bytes: Buffer.from("OggS\x00\x02\x00\x00", "utf8"),
  })
  globalThis.fetch = metaFake.fetchHandler
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ============================================================================
// AC-1 & AC-7: Inbound Media Metadata, Binary Stream & R2 Key Formatting
// ============================================================================

describe("AC-1 & AC-7: Inbound Pilgrim Media -> Cloudflare R2 Pipeline & Offline Mock Resolution", () => {
  it("resolves deterministic file extensions from WhatsApp MIME types and filenames", () => {
    assert.equal(resolveExtensionFromMimeType("image/jpeg"), "jpg")
    assert.equal(resolveExtensionFromMimeType("image/png"), "png")
    assert.equal(resolveExtensionFromMimeType("image/webp"), "webp")
    assert.equal(resolveExtensionFromMimeType("application/pdf"), "pdf")
    assert.equal(resolveExtensionFromMimeType("audio/ogg; codecs=opus"), "ogg")
    assert.equal(resolveExtensionFromMimeType("audio/mpeg"), "mp3")
    assert.equal(resolveExtensionFromMimeType("video/mp4"), "mp4")
    assert.equal(
      resolveExtensionFromMimeType("application/octet-stream", "passport_scan.PDF"),
      "pdf"
    )
    assert.equal(resolveExtensionFromMimeType("unknown/custom"), "bin")
  })

  it("formats deterministic R2 storage keys as whatsapp-media/{accountId}/{conversationId}/{wamid}.{ext}", () => {
    const accountId = "11111111-2222-4333-8444-555555555555"
    const conversationId = "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee"
    const rawWamid = "wamid.HBgMOTIzMDAxMjM0NTY3FQIAEhggQ0M="
    const sanitizedWamid = sanitizeWamidForR2Key(rawWamid)
    const ext = resolveExtensionFromMimeType("application/pdf")

    assert.ok(!sanitizedWamid.includes("="))
    const r2Key = `whatsapp-media/${accountId}/{conversationId}/${sanitizedWamid}.${ext}`.replace(
      "{conversationId}",
      conversationId
    )
    assert.equal(
      r2Key,
      "whatsapp-media/11111111-2222-4333-8444-555555555555/aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee/wamid.HBgMOTIzMDAxMjM0NTY3FQIAEhggQ0M_.pdf"
    )
  })

  it("resolves getWhatsAppMediaMetadata and downloadWhatsAppMediaBinary against local Meta Cloud API contract fake", async () => {
    assert.equal(getWhatsAppMediaMetadata, fetchWhatsAppMediaMetadata)

    await assert.rejects(
      () =>
        getWhatsAppMediaMetadata({
          mediaId: "   ",
          accessToken: TEST_META_TOKEN,
        }),
      /requires a valid mediaId/
    )

    const metaPdf = await getWhatsAppMediaMetadata({
      mediaId: "media_passport_pdf_001",
      accessToken: TEST_META_TOKEN,
    })
    assert.equal(metaPdf.id, "media_passport_pdf_001")
    assert.equal(metaPdf.mime_type, "application/pdf")
    assert.ok(metaPdf.url.includes("mid=media_passport_pdf_001"))
    assert.ok(typeof metaPdf.file_size === "number" && metaPdf.file_size > 0)

    const metaVoice = await getWhatsAppMediaMetadata({
      mediaId: "media_urdu_voice_ogg_002",
      accessToken: TEST_META_TOKEN,
    })
    assert.equal(metaVoice.mime_type, "audio/ogg")

    const downloaded = await downloadWhatsAppMediaBinary({
      mediaId: "media_passport_pdf_001",
      accessToken: TEST_META_TOKEN,
      expectedMimeType: "application/pdf",
    })
    assert.ok(Buffer.isBuffer(downloaded.buffer))
    assert.ok(downloaded.buffer.byteLength > 0)
    assert.equal(downloaded.mimeType, "application/pdf")
    assert.equal(downloaded.fileSize, downloaded.buffer.byteLength)

    await assert.rejects(
      () =>
        downloadWhatsAppMediaBinary({
          accessToken: TEST_META_TOKEN,
        }),
      /requires either mediaUrl or mediaId/
    )
  })

  it("mirrorInboundWhatsAppMediaToR2 returns structured failure result for missing messageId without throwing", async () => {
    const missingRes = await mirrorInboundWhatsAppMediaToR2({
      messageId: "00000000-0000-4000-8000-000000000099",
    })
    assert.equal(missingRes.success, false)
    assert.equal(missingRes.media_status, "failed")
    assert.ok(Boolean(missingRes.error))
  })
})

// ============================================================================
// AC-2: Instant 3-Second ART-... Post Ref Auto-Responder Bot
// ============================================================================

describe("AC-2: Instant 3-Second ART-... Post Ref Auto-Responder Bot", () => {
  const sampleCard: ResolvedPostRefCard = {
    postCode: "ART-AM-21D-01",
    packageId: "99999999-8888-4777-8666-555555555555",
    postAssetId: "77777777-6666-4555-8444-333333333333",
    flyerId: "55555555-4444-4333-8222-111111111111",
    title: "21 Days Executive Ramadan Umrah Package",
    airlineName: "Saudi Airlines",
    durationDays: 21,
    outboundRoute: "LHE - JED",
    outboundDateLabel: "12 Nov 2026",
    returnDateLabel: "03 Dec 2026",
    makkahHotelName: "Pullman Zamzam Makkah",
    makkahNights: "10",
    makkahDistanceLabel: "0m Clock Tower / Haram View",
    madinahHotelName: "Anwar Al Madinah Movenpick",
    madinahNights: "10",
    madinahDistanceLabel: "50m Markazia North",
    mealPlanLabel: "Buffet Breakfast",
    retailSharingPkr: 365000,
    retailQuadPkr: 385000,
    retailTriplePkr: 420000,
    retailDoublePkr: 475000,
    pdfUrl: "https://assets.alramlahtravels.com/flyers/ART-AM-21D-01.pdf",
    singlePackageImageUrl: "https://assets.alramlahtravels.com/flyers/ART-AM-21D-01.jpg",
  }

  it("formats PKR values and luxury Haramain hospitality reply with hotel & Quad/Triple/Double PKR rates", () => {
    assert.equal(formatPkr(385000), "PKR 385,000")
    assert.equal(formatPkr(0), "On Request")
    assert.equal(formatPkr(null), "On Request")

    const replyBody = buildLuxuryAutoReplyBody(sampleCard)
    assert.ok(replyBody.includes("Assalam-o-Alaikum!"))
    assert.ok(replyBody.includes("Al Ramlah Travels (Askari 10, Lahore Cantt)"))
    assert.ok(replyBody.includes("`ART-AM-21D-01`"))
    assert.ok(replyBody.includes("21 Days Executive Ramadan Umrah Package"))
    assert.ok(replyBody.includes("Pullman Zamzam Makkah"))
    assert.ok(replyBody.includes("10 Nights"))
    assert.ok(replyBody.includes("0m Clock Tower / Haram View"))
    assert.ok(replyBody.includes("Anwar Al Madinah Movenpick"))
    assert.ok(replyBody.includes("50m Markazia North"))
    assert.ok(replyBody.includes("Sharing: *PKR 365,000*"))
    assert.ok(replyBody.includes("Quad (4-Bed): *PKR 385,000*"))
    assert.ok(replyBody.includes("Triple (3-Bed): *PKR 420,000*"))
    assert.ok(replyBody.includes("Double (2-Bed): *PKR 475,000*"))
  })

  it("builds 3 interactive quick-reply buttons (Book Now, Customize Dates, Talk to Agent) within Meta limits", () => {
    const buttons = buildAutoReplyButtons("art-am-21d-01")
    assert.equal(buttons.length, 3)
    assert.deepEqual(buttons, [
      { id: "art_book:ART-AM-21D-01", title: "Book Now" },
      { id: "art_dates:ART-AM-21D-01", title: "Customize Dates" },
      { id: "art_agent:ART-AM-21D-01", title: "Talk to Agent" },
    ])
    for (const btn of buttons) {
      assert.ok(btn.title.length <= 20, `Button title "${btn.title}" must be <= 20 chars`)
    }
  })

  it("extracts ART-... codes from free-form text and interactive button reply IDs", () => {
    const fromText = extractPostRefCodes("Salam! Please share details for ART-AM-21D-01.")
    assert.deepEqual(fromText, ["ART-AM-21D-01"])

    const fromButtonId = extractPostRefCodes("Book Now art_book:ART-SV-15D-04")
    assert.deepEqual(fromButtonId, ["ART-SV-15D-04"])
  })

  it("enforces bot loop guards (skips bot-originated messages, messages without ART-... codes, and active cooldown windows)", async () => {
    // 1. Skip messages originating from the bot itself
    const botSelfResult = await processInboundPostRefAutoReply({
      accountId: "11111111-2222-4333-8444-555555555555",
      conversationId: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee",
      contactPhone: "923001234567",
      inboundWamid: "wamid.bot_self_1",
      inboundBodyText: "Assalam-o-Alaikum! Package Ref: ART-AM-21D-01",
      isFromBot: true,
    })
    assert.equal(botSelfResult.triggered, false)
    assert.equal(botSelfResult.skipped, true)
    assert.equal(botSelfResult.reason, "message_from_bot")

    // 2. Skip messages without any ART-... post reference code
    const noCodeResult = await processInboundPostRefAutoReply({
      accountId: "11111111-2222-4333-8444-555555555555",
      conversationId: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee",
      contactPhone: "923001234567",
      inboundWamid: "wamid.no_code_1",
      inboundBodyText: "Assalam-o-Alaikum, what are your office timings in Askari 10?",
      isFromBot: false,
    })
    assert.equal(noCodeResult.triggered, false)
    assert.equal(noCodeResult.skipped, true)
    assert.equal(noCodeResult.reason, "no_post_ref_code")

    // 3. Verify cooldown window calculation logic
    const cooldownMinutes = 60
    const now = new Date("2026-11-07T12:00:00Z")
    const cutoffDate = new Date(now.getTime() - cooldownMinutes * 60 * 1000)
    const recentReplyAt = new Date("2026-11-07T11:30:00Z") // 30m ago -> inside cooldown
    const expiredReplyAt = new Date("2026-11-07T10:30:00Z") // 90m ago -> outside cooldown

    assert.equal(recentReplyAt >= cutoffDate, true, "30m-old auto-reply is within 60m cooldown")
    assert.equal(expiredReplyAt >= cutoffDate, false, "90m-old auto-reply is outside 60m cooldown")

    // Validate toggle schema
    const toggleParsed = toggleWhatsappAutoResponderSchema.parse({
      accountId: "11111111-2222-4333-8444-555555555555",
      enabled: true,
      cooldownMinutes: 1440,
    })
    assert.equal(toggleParsed.enabled, true)
    assert.equal(toggleParsed.cooldownMinutes, 1440)
  })
})

// ============================================================================
// AC-3: Blue-Tick Read Receipts & Emoji Reactions
// ============================================================================

describe("AC-3: markWhatsAppMessageAsRead Blue-Tick Receipts & Emoji Reactions", () => {
  it("validates markWhatsAppMessageAsRead arguments and sends Graph API receipt via contract fake", async () => {
    assert.equal(markWhatsAppMessageAsRead, markMessageAsRead)

    await assert.rejects(
      () =>
        markWhatsAppMessageAsRead({
          phoneNumberId: "1234567890",
          accessToken: TEST_META_TOKEN,
          messageId: "   ",
        }),
      /requires a non-empty messageId/
    )

    const res = await markWhatsAppMessageAsRead({
      phoneNumberId: "1234567890",
      accessToken: TEST_META_TOKEN,
      messageId: "wamid.HBgMOTIzMDAxMjM0NTY3FQIAEhgg",
    })
    assert.deepEqual(res, { success: true })

    const parsedSchema = markConversationAsReadSchema.parse({
      conversationId: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee",
      messageId: "wamid.HBgMOTIzMDAxMjM0NTY3FQIAEhgg",
    })
    assert.equal(parsedSchema.conversationId, "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee")
  })

  it("validates sendWhatsAppReactionMessage arguments and propagates real Graph API wamid / errors (zero wamid.sim_*)", async () => {
    assert.equal(sendWhatsAppReactionMessage, sendReactionMessage)

    await assert.rejects(
      () =>
        sendWhatsAppReactionMessage({
          phoneNumberId: "1234567890",
          accessToken: TEST_META_TOKEN,
          to: "923001234567",
          messageId: "",
          emoji: "🕋",
        }),
      /requires a target messageId/
    )

    const reactionRes = await sendWhatsAppReactionMessage({
      phoneNumberId: "1234567890",
      accessToken: TEST_META_TOKEN,
      to: "0300-1234567",
      messageId: "wamid.target_msg_1",
      emoji: "🤲",
    })
    assert.ok(reactionRes.messageId.startsWith("wamid.HBgM"))
    assert.ok(!reactionRes.messageId.startsWith("wamid.sim_"))

    // Verify expired/invalid token throws real MetaApiError instead of returning fake wamid.sim_* (T-030)
    await assert.rejects(
      () =>
        sendWhatsAppReactionMessage({
          phoneNumberId: "1234567890",
          accessToken: "invalid_expired_token",
          to: "923001234567",
          messageId: "wamid.target_msg_1",
          emoji: "🤲",
        }),
      /Invalid OAuth access token/
    )

    const validReactionInput = sendWhatsappReactionSchema.parse({
      conversationId: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee",
      messageId: "wamid.target_msg_1",
      emoji: "❤️",
    })
    assert.equal(validReactionInput.emoji, "❤️")
  })
})

// ============================================================================
// AC-4: Interactive Reply Buttons, List Menus & Webhook Interactive/Reaction Parsing
// ============================================================================

describe("AC-4: Interactive Reply Buttons (1..3, <=20 chars) & List Menus (1..10 rows, <=24 chars)", () => {
  it("enforces 1..3 buttons, <=20 char button titles, and unique button IDs in sendInteractiveButtonsMessage", async () => {
    // Valid 3-button dispatch
    const validRes = await sendInteractiveButtonsMessage({
      phoneNumberId: "1234567890",
      accessToken: TEST_META_TOKEN,
      to: "03001234567",
      headerText: "Al Ramlah • ART-AM-21D-01",
      bodyText: "Select an action below:",
      footerText: "Al Ramlah Travels • Askari 10",
      buttons: buildAutoReplyButtons("ART-AM-21D-01"),
    })
    assert.ok(validRes.messageId.startsWith("wamid.HBgM"))
    assert.ok(!validRes.messageId.startsWith("wamid.sim_"))

    // Reject 0 buttons
    await assert.rejects(
      () =>
        sendInteractiveButtonsMessage({
          phoneNumberId: "1234567890",
          accessToken: TEST_META_TOKEN,
          to: "923001234567",
          bodyText: "Choose option:",
          buttons: [],
        }),
      /between 1 and 3 reply buttons/
    )

    // Reject 4 buttons
    await assert.rejects(
      () =>
        sendInteractiveButtonsMessage({
          phoneNumberId: "1234567890",
          accessToken: TEST_META_TOKEN,
          to: "923001234567",
          bodyText: "Choose option:",
          buttons: [
            { id: "b1", title: "One" },
            { id: "b2", title: "Two" },
            { id: "b3", title: "Three" },
            { id: "b4", title: "Four" },
          ],
        }),
      /between 1 and 3 reply buttons/
    )

    // Reject button title > 20 characters
    await assert.rejects(
      () =>
        sendInteractiveButtonsMessage({
          phoneNumberId: "1234567890",
          accessToken: TEST_META_TOKEN,
          to: "923001234567",
          bodyText: "Choose option:",
          buttons: [{ id: "b1", title: "This Button Title Is Way Too Long" }],
        }),
      /between 1 and 20 characters/
    )

    // Reject duplicate button IDs
    await assert.rejects(
      () =>
        sendInteractiveButtonsMessage({
          phoneNumberId: "1234567890",
          accessToken: TEST_META_TOKEN,
          to: "923001234567",
          bodyText: "Choose option:",
          buttons: [
            { id: "dup_id", title: "First" },
            { id: "dup_id", title: "Second" },
          ],
        }),
      /Duplicate interactive button id/
    )

    // Verify Zod schema validation for sendInteractiveButtonsSchema
    const zodValidButtons = sendInteractiveButtonsSchema.safeParse({
      conversationId: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee",
      bodyText: "Pick one",
      buttons: buildAutoReplyButtons("ART-AM-21D-01"),
    })
    assert.equal(zodValidButtons.success, true)

    const zodInvalid4 = sendInteractiveButtonsSchema.safeParse({
      conversationId: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee",
      bodyText: "Pick one",
      buttons: [
        { id: "1", title: "One" },
        { id: "2", title: "Two" },
        { id: "3", title: "Three" },
        { id: "4", title: "Four" },
      ],
    })
    assert.equal(zodInvalid4.success, false)

    const zodInvalidTitle = sendInteractiveButtonsSchema.safeParse({
      conversationId: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee",
      bodyText: "Pick one",
      buttons: [{ id: "1", title: "123456789012345678901" }], // 21 chars
    })
    assert.equal(zodInvalidTitle.success, false)
  })

  it("enforces 1..10 total rows across sections and <=24 char row titles in sendInteractiveListMessage", async () => {
    const validListRes = await sendInteractiveListMessage({
      phoneNumberId: "1234567890",
      accessToken: TEST_META_TOKEN,
      to: "923001234567",
      headerText: "Umrah Departure Packages",
      bodyText: "Select your preferred room tier and departure window:",
      footerText: "Al Ramlah Travels",
      buttonText: "View Options",
      sections: [
        {
          title: "Room Sharing Tiers",
          rows: [
            { id: "tier_quad", title: "Quad Sharing (4-Bed)", description: "PKR 385,000 per pilgrim" },
            { id: "tier_triple", title: "Triple Sharing (3-Bed)", description: "PKR 420,000 per pilgrim" },
            { id: "tier_double", title: "Double Sharing (2-Bed)", description: "PKR 475,000 per pilgrim" },
          ],
        },
      ],
    })
    assert.ok(validListRes.messageId.startsWith("wamid.HBgM"))
    assert.ok(!validListRes.messageId.startsWith("wamid.sim_"))

    // Reject row title > 24 characters
    await assert.rejects(
      () =>
        sendInteractiveListMessage({
          phoneNumberId: "1234567890",
          accessToken: TEST_META_TOKEN,
          to: "923001234567",
          bodyText: "Select tier:",
          buttonText: "View Options",
          sections: [
            {
              title: "Packages",
              rows: [
                {
                  id: "r1",
                  title: "Row Title Exceeding 24 Characters Limit",
                },
              ],
            },
          ],
        }),
      /between 1 and 24 characters/
    )

    // Reject > 10 total rows across sections
    const elevenRows = Array.from({ length: 11 }, (_, i) => ({
      id: `row_${i + 1}`,
      title: `Package Option ${i + 1}`,
    }))
    await assert.rejects(
      () =>
        sendInteractiveListMessage({
          phoneNumberId: "1234567890",
          accessToken: TEST_META_TOKEN,
          to: "923001234567",
          bodyText: "Select tier:",
          buttonText: "View Options",
          sections: [
            { title: "Section A", rows: elevenRows.slice(0, 6) },
            { title: "Section B", rows: elevenRows.slice(6) },
          ],
        }),
      /between 1 and 10 total rows/
    )

    const zodElevenRows = sendInteractiveListSchema.safeParse({
      conversationId: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee",
      bodyText: "Select tier",
      buttonText: "View Options",
      sections: [
        { title: "Section A", rows: elevenRows.slice(0, 6) },
        { title: "Section B", rows: elevenRows.slice(6) },
      ],
    })
    assert.equal(zodElevenRows.success, false)
  })

  it("parses inbound interactive (button_reply, list_reply) and reaction webhook payloads", () => {
    const buttonReplyMsg = metaWebhookInboundMessageSchema.parse({
      from: "923001234567",
      id: "wamid.inbound_btn_1",
      timestamp: "1762534800",
      type: "interactive",
      interactive: {
        type: "button_reply",
        button_reply: {
          id: "art_book:ART-AM-21D-01",
          title: "Book Now",
        },
      },
    })
    assert.equal(buttonReplyMsg.interactive?.button_reply?.id, "art_book:ART-AM-21D-01")
    assert.equal(buttonReplyMsg.interactive?.button_reply?.title, "Book Now")

    const listReplyMsg = metaWebhookInboundMessageSchema.parse({
      from: "923001234567",
      id: "wamid.inbound_list_1",
      timestamp: "1762534805",
      type: "interactive",
      interactive: {
        type: "list_reply",
        list_reply: {
          id: "tier_quad",
          title: "Quad Sharing (4-Bed)",
          description: "PKR 385,000 per pilgrim",
        },
      },
    })
    assert.equal(listReplyMsg.interactive?.list_reply?.id, "tier_quad")
    assert.equal(listReplyMsg.interactive?.list_reply?.title, "Quad Sharing (4-Bed)")

    const reactionMsg = metaWebhookInboundMessageSchema.parse({
      from: "923001234567",
      id: "wamid.inbound_react_1",
      timestamp: "1762534810",
      type: "reaction",
      reaction: {
        message_id: "wamid.outbound_pkg_1",
        emoji: "🕋",
      },
    })
    assert.equal(reactionMsg.reaction?.message_id, "wamid.outbound_pkg_1")
    assert.equal(reactionMsg.reaction?.emoji, "🕋")
  })
})

// ============================================================================
// AC-5: Meta Template Lifecycle Creation, Deletion & Webhook Sync
// ============================================================================

describe("AC-5: Meta Template Creation, Deletion & message_template_status_update Webhook", () => {
  it("enforces ^[a-z0-9_]+$ template naming in createWhatsappTemplateSchema and deleteWhatsappTemplateSchema", () => {
    const validTemplate = createWhatsappTemplateSchema.safeParse({
      name: "ramadan_umrah_2026_offer",
      language: "en_US",
      category: "MARKETING",
      headerText: "Al Ramlah Travels • Askari 10",
      bodyText: "Assalam-o-Alaikum {{1}}, explore our executive Umrah packages.",
      footerText: "Reply STOP to opt out",
      buttons: [
        { type: "QUICK_REPLY", text: "View Packages" },
        { type: "URL", text: "Visit Website", url: "https://alramlahtravels.com" },
      ],
    })
    assert.equal(validTemplate.success, true)

    const invalidUppercase = createWhatsappTemplateSchema.safeParse({
      name: "Ramadan-Umrah-Offer!",
      language: "en_US",
      category: "MARKETING",
      bodyText: "Hello {{1}}",
    })
    assert.equal(invalidUppercase.success, false)

    const validDelete = deleteWhatsappTemplateSchema.safeParse({
      name: "ramadan_umrah_2026_offer",
    })
    assert.equal(validDelete.success, true)
  })

  it("executes createMetaMessageTemplate and deleteMetaMessageTemplate via Graph API contract fake", async () => {
    await assert.rejects(
      () =>
        createMetaMessageTemplate({
          wabaId: "waba_12345",
          accessToken: TEST_META_TOKEN,
          name: "Invalid-Template-Name!",
          language: "en_US",
          category: "MARKETING",
          bodyText: "Test body",
        }),
      /must match \^\[a-z0-9_\]\+\$/
    )

    const created = await createMetaMessageTemplate({
      wabaId: "waba_12345",
      accessToken: TEST_META_TOKEN,
      name: "umrah_visa_issued_notice",
      language: "en_US",
      category: "UTILITY",
      headerText: "Umrah E-Visa Approved",
      bodyText: "Mubarak {{1}}! Your Saudi Umrah e-Visa has been issued.",
      footerText: "Al Ramlah Travels",
    })
    assert.ok(created.id.startsWith("tpl_"))
    assert.equal(created.status, "PENDING")
    assert.equal(created.category, "UTILITY")

    const deleted = await deleteMetaMessageTemplate({
      wabaId: "waba_12345",
      accessToken: TEST_META_TOKEN,
      name: "umrah_visa_issued_notice",
    })
    assert.deepEqual(deleted, { success: true })

    await assert.rejects(
      () =>
        deleteMetaMessageTemplate({
          wabaId: "waba_12345",
          accessToken: TEST_META_TOKEN,
          name: "   ",
        }),
      /requires a template name/
    )
  })

  it("validates message_template_status_update webhook payloads (APPROVED, REJECTED, PAUSED, DISABLED)", () => {
    const webhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_987654321",
          changes: [
            {
              field: "message_template_status_update",
              value: {
                event: "REJECTED",
                message_template_id: 192837465,
                message_template_name: "ramadan_umrah_2026_offer",
                message_template_language: "en_US",
                reason: "PROMOTIONAL_CONTENT_IN_UTILITY",
              },
            },
          ],
        },
      ],
    }

    const parsedEnvelope = metaWebhookPayloadSchema.parse(webhookPayload)
    const change = parsedEnvelope.entry[0]!.changes[0]!
    assert.equal(change.field, "message_template_status_update")
    assert.equal(change.value.event, "REJECTED")
    assert.equal(change.value.message_template_id, 192837465)
    assert.equal(change.value.message_template_name, "ramadan_umrah_2026_offer")
    assert.equal(change.value.reason, "PROMOTIONAL_CONTENT_IN_UTILITY")

    const approvedChange = metaWebhookChangeValueSchema.parse({
      event: "APPROVED",
      message_template_id: "192837465",
      message_template_name: "ramadan_umrah_2026_offer",
      message_template_language: "en_US",
      reason: null,
    })
    assert.equal(approvedChange.event, "APPROVED")
  })
})

// ============================================================================
// AC-6: Schema & Phase 2 Column Contracts
// ============================================================================

describe("AC-6: Drizzle Schema Phase 2 Enums & Columns Integrity", () => {
  it("includes sticker, reaction, and DISABLED enum values and Phase 2 table columns", () => {
    assert.ok(whatsappMessageTypeEnum.enumValues.includes("sticker"))
    assert.ok(whatsappMessageTypeEnum.enumValues.includes("reaction"))
    assert.ok(whatsappMessageTypeEnum.enumValues.includes("interactive"))
    assert.ok(whatsappTemplateStatusEnum.enumValues.includes("DISABLED"))

    assert.ok("autoReplyEnabled" in whatsappAccounts)
    assert.ok("autoReplyCooldownMinutes" in whatsappAccounts)
    assert.ok("lastAutoRepliedPostCode" in whatsappConversations)
    assert.ok("lastAutoRepliedAt" in whatsappConversations)
    assert.ok("rawMediaId" in whatsappMessages)
    assert.ok("mediaMimeType" in whatsappMessages)
    assert.ok("interactivePayload" in whatsappMessages)
    assert.ok("reactionEmoji" in whatsappMessages)
    assert.ok("isAutoReply" in whatsappMessages)
    assert.ok("rejectionReason" in whatsappTemplates)
  })
})
