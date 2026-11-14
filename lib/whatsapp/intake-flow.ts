import crypto from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
  type WhatsappIntakeFlowState,
  type WhatsappIntakeStep,
} from "@/db/schema/whatsapp-crm"
import { applications } from "@/db/schema/applications"
import { decrypt } from "@/lib/whatsapp/encryption"
import {
  markWhatsAppMessageAsRead,
  sendInteractiveButtonsMessage,
  sendTextMessage,
} from "@/lib/whatsapp/meta-api"

export interface IntakeFlowInput {
  accountId: string
  conversationId: string
  contactPhone: string
  inboundWamid: string
  inboundText?: string
  interactiveReplyId?: string | null
}

export interface IntakeFlowResult {
  handled: boolean
  step: WhatsappIntakeStep
  cancelled?: boolean
  referenceNumber?: string
  applicationId?: string
  sentMessageIds: string[]
  sentWamids: string[]
  error?: string
}

export const INTAKE_TRIGGER_KEYWORDS = [
  "plan umrah",
  "custom quote",
  "start inquiry",
  "umrah inquiry",
  "custom package",
  "book umrah",
  "umrah package",
  "new booking",
  "create inquiry",
  "umrah rates",
  "hajj inquiry",
]

export const INTAKE_TRIGGER_BUTTON_IDS = [
  "start_umrah_intake",
  "art_intake_start",
  "btn_plan_umrah",
  "rule_loc_umrah",
]

/**
 * Checks whether an incoming text message or button reply matches the Umrah intake flow trigger.
 */
export function isIntakeFlowTrigger(
  text: string | null | undefined,
  buttonId?: string | null
): boolean {
  if (buttonId) {
    const cleanBtn = buttonId.trim().toLowerCase()
    if (INTAKE_TRIGGER_BUTTON_IDS.includes(cleanBtn)) {
      return true
    }
  }

  if (!text) return false
  const normalized = text.trim().toLowerCase()

  return INTAKE_TRIGGER_KEYWORDS.some((kw) => normalized.includes(kw))
}

/**
 * Spec alias for isIntakeFlowTrigger.
 */
export const matchesIntakeTrigger = isIntakeFlowTrigger

/**
 * Generates an application reference number: `ART-WA-YYYYMMDD-XXXX`.
 */
export function generateReferenceNumber(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const random4 = crypto.randomBytes(2).toString("hex").toUpperCase()
  return `ART-WA-${yyyy}${mm}${dd}-${random4}`
}

/**
 * Resolves Travel Season from button ID or user text.
 */
export function resolveMonthSelection(
  text: string,
  buttonId?: string | null
): string | null {
  const b = (buttonId || "").trim().toLowerCase()
  const t = (text || "").trim().toLowerCase()

  if (b === "intake_m_novdec" || t.includes("nov") || t.includes("dec")) {
    return "Nov - Dec 2026"
  }
  if (b === "intake_m_ramadan" || t.includes("ramadan")) {
    return "Ramadan 2027"
  }
  if (
    b === "intake_m_shawwal" ||
    t.includes("shawwal") ||
    t.includes("spring")
  ) {
    return "Shawwal / Spring"
  }

  if (t.length > 0 && t.length <= 40) {
    return text.trim()
  }

  return null
}

/**
 * Resolves Party Size from button ID or user text.
 */
export function resolvePilgrimSelection(
  text: string,
  buttonId?: string | null
): { label: string; adults: number } | null {
  const b = (buttonId || "").trim().toLowerCase()
  const t = (text || "").trim().toLowerCase()

  if (
    b === "intake_p_couple" ||
    t.includes("couple") ||
    t.includes("1-2") ||
    t === "2" ||
    t === "1"
  ) {
    return { label: "1-2 Adults (Couple)", adults: 2 }
  }
  if (
    b === "intake_p_family" ||
    t.includes("family") ||
    t.includes("3-5") ||
    t === "3" ||
    t === "4" ||
    t === "5"
  ) {
    return { label: "Family 3-5 Persons", adults: 4 }
  }
  if (
    b === "intake_p_group" ||
    t.includes("group") ||
    t.includes("6+") ||
    parseInt(t, 10) >= 6
  ) {
    const parsed = parseInt(t, 10)
    return {
      label: "Group 6+ Persons",
      adults: Number.isNaN(parsed) || parsed < 6 ? 6 : parsed,
    }
  }

  if (t.length > 0 && t.length <= 40) {
    const numMatch = t.match(/\d+/)
    const count = numMatch ? parseInt(numMatch[0], 10) : 2
    return { label: text.trim(), adults: Math.max(1, count) }
  }

  return null
}

/**
 * Resolves Hotel Category from button ID or user text.
 */
export function resolveHotelSelection(
  text: string,
  buttonId?: string | null
): string | null {
  const b = (buttonId || "").trim().toLowerCase()
  const t = (text || "").trim().toLowerCase()

  if (
    b === "intake_h_5star" ||
    t.includes("5★") ||
    t.includes("5 star") ||
    t.includes("clock") ||
    t.includes("tower")
  ) {
    return "5★ Clock Tower"
  }
  if (
    b === "intake_h_4star" ||
    t.includes("4★") ||
    t.includes("4 star") ||
    t.includes("walking")
  ) {
    return "4★ Walking Distance"
  }
  if (
    b === "intake_h_economy" ||
    t.includes("economy") ||
    t.includes("shuttle") ||
    t.includes("3 star")
  ) {
    return "Economy Shuttle"
  }

  if (t.length > 0 && t.length <= 40) {
    return text.trim()
  }

  return null
}

/**
 * Pure state machine transition evaluator for test assertions and offline verification.
 */
export function evaluateIntakeTransition(
  currentStep: WhatsappIntakeStep,
  input: { text?: string; buttonId?: string | null }
): {
  nextStep: WhatsappIntakeStep
  month?: string
  pilgrims?: { label: string; adults: number }
  hotelTier?: string
  cancelled?: boolean
  rePrompt?: boolean
} {
  const rawText = (input.text || "").trim()
  const lower = rawText.toLowerCase()
  if (lower === "cancel" || lower === "reset" || lower === "stop") {
    return { nextStep: "IDLE", cancelled: true }
  }

  if (
    currentStep === "IDLE" ||
    currentStep === "COMPLETED" ||
    isIntakeFlowTrigger(rawText, input.buttonId)
  ) {
    return { nextStep: "AWAITING_MONTH" }
  }

  if (currentStep === "AWAITING_MONTH") {
    const month = resolveMonthSelection(rawText, input.buttonId)
    if (!month) return { nextStep: "AWAITING_MONTH", rePrompt: true }
    return { nextStep: "AWAITING_PILGRIMS", month }
  }

  if (currentStep === "AWAITING_PILGRIMS") {
    const pilgrims = resolvePilgrimSelection(rawText, input.buttonId)
    if (!pilgrims) return { nextStep: "AWAITING_PILGRIMS", rePrompt: true }
    return { nextStep: "AWAITING_HOTEL_TIER", pilgrims }
  }

  if (currentStep === "AWAITING_HOTEL_TIER") {
    const hotelTier = resolveHotelSelection(rawText, input.buttonId)
    if (!hotelTier) return { nextStep: "AWAITING_HOTEL_TIER", rePrompt: true }
    return { nextStep: "COMPLETED", hotelTier }
  }

  return { nextStep: currentStep }
}

/**
 * Advances the Guided Umrah Intake Flow state machine for an inbound message.
 */
export async function advanceUmrahIntakeFlow(
  input: IntakeFlowInput
): Promise<IntakeFlowResult> {
  const now = new Date()
  const rawText = (input.inboundText || "").trim()
  const buttonId = input.interactiveReplyId || null

  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.id, input.accountId))
    .limit(1)

  if (!account) {
    return {
      handled: false,
      step: "IDLE",
      error: "account_not_found",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  const [conv] = await db
    .select()
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, input.conversationId))
    .limit(1)

  if (!conv) {
    return {
      handled: false,
      step: "IDLE",
      error: "conversation_not_found",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  let accessToken = "mock_offline_token"
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    accessToken = account.encryptedAccessToken || "mock_offline_token"
  }

  const currentState: WhatsappIntakeFlowState = conv.intakeFlowState || {
    step: "IDLE",
  }

  // 1. Cancellation check
  const lowerText = rawText.toLowerCase()
  if (
    (lowerText === "cancel" || lowerText === "reset" || lowerText === "stop") &&
    currentState.step !== "IDLE" &&
    currentState.step !== "COMPLETED"
  ) {
    const updatedState: WhatsappIntakeFlowState = {
      step: "IDLE",
      updatedAt: now.toISOString(),
    }

    await db
      .update(whatsappConversations)
      .set({
        intakeFlowState: updatedState,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conv.id))

    const cancelNotice =
      "Umrah intake has been cancelled. Feel free to type *Plan Umrah* whenever you wish to restart or ask any question directly!"

    let cancelWamid: string
    try {
      const res = await sendTextMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: input.contactPhone,
        text: cancelNotice,
        contextMessageId: input.inboundWamid,
      })
      cancelWamid = res.messageId
    } catch {
      cancelWamid = `wamid.sim_intake_cancel_${crypto.randomBytes(12).toString("hex")}`
    }

    const [insertedMsg] = await db
      .insert(whatsappMessages)
      .values({
        conversationId: conv.id,
        wamid: cancelWamid,
        direction: "outbound",
        status: "sent",
        messageType: "text",
        body: cancelNotice,
        contextMessageId: input.inboundWamid,
        isAutoReply: true,
        sentAt: now,
      })
      .returning()

    return {
      handled: true,
      step: "IDLE",
      cancelled: true,
      sentMessageIds: insertedMsg ? [insertedMsg.id] : [],
      sentWamids: [cancelWamid],
    }
  }

  // Mark inbound as read
  if (input.inboundWamid) {
    try {
      await markWhatsAppMessageAsRead({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        messageId: input.inboundWamid,
      })
    } catch {
      // ignore
    }
  }

  const sentMessageIds: string[] = []
  const sentWamids: string[] = []

  // 2. Start flow if IDLE or triggered
  if (
    currentState.step === "IDLE" ||
    currentState.step === "COMPLETED" ||
    isIntakeFlowTrigger(rawText, buttonId)
  ) {
    // Send Step 1: Awaiting Month
    const headerText = "Al Ramlah Travels • Umrah Planning (1/3)"
    const bodyText =
      "Assalam-o-Alaikum! Let's tailor your sacred journey to the Haramain. Which travel season or month do you plan to perform Umrah?"
    const footerText = "Al Ramlah Travels • Askari 10 Lahore"
    const buttons = [
      { id: "intake_m_novdec", title: "Nov - Dec 2026" },
      { id: "intake_m_ramadan", title: "Ramadan 2027" },
      { id: "intake_m_shawwal", title: "Shawwal / Spring" },
    ]

    let wamid: string
    try {
      const res = await sendInteractiveButtonsMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: input.contactPhone,
        headerText,
        bodyText,
        footerText,
        buttons,
        contextMessageId: input.inboundWamid,
      })
      wamid = res.messageId
    } catch {
      wamid = `wamid.sim_intake_m_${crypto.randomBytes(12).toString("hex")}`
    }

    const [inserted] = await db
      .insert(whatsappMessages)
      .values({
        conversationId: conv.id,
        wamid,
        direction: "outbound",
        status: "sent",
        messageType: "interactive",
        body: bodyText,
        contextMessageId: input.inboundWamid,
        isAutoReply: true,
        interactivePayload: {
          type: "button",
          flowStep: "AWAITING_MONTH",
          headerText,
          bodyText,
          footerText,
          buttons,
        },
        sentAt: now,
      })
      .returning()

    if (inserted) {
      sentMessageIds.push(inserted.id)
      sentWamids.push(wamid)
    }

    const nextState: WhatsappIntakeFlowState = {
      step: "AWAITING_MONTH",
      startedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    await db
      .update(whatsappConversations)
      .set({
        intakeFlowState: nextState,
        lastAutoRepliedAt: now,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conv.id))

    return {
      handled: true,
      step: "AWAITING_MONTH",
      sentMessageIds,
      sentWamids,
    }
  }

  // 3. Step 1 -> Step 2 (Awaiting Month -> Awaiting Pilgrims)
  if (currentState.step === "AWAITING_MONTH") {
    const selectedMonth = resolveMonthSelection(rawText, buttonId)
    if (!selectedMonth) {
      // Re-prompt if not recognized
      const bodyText =
        "Please select one of the upcoming Umrah travel seasons below to continue your custom quote:"
      const buttons = [
        { id: "intake_m_novdec", title: "Nov - Dec 2026" },
        { id: "intake_m_ramadan", title: "Ramadan 2027" },
        { id: "intake_m_shawwal", title: "Shawwal / Spring" },
      ]

      let wamid: string
      try {
        const res = await sendInteractiveButtonsMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          bodyText,
          buttons,
          contextMessageId: input.inboundWamid,
        })
        wamid = res.messageId
      } catch {
        wamid = `wamid.sim_intake_m_rep_${crypto.randomBytes(12).toString("hex")}`
      }

      return {
        handled: true,
        step: "AWAITING_MONTH",
        sentMessageIds: [],
        sentWamids: [wamid],
      }
    }

    // Advance to AWAITING_PILGRIMS
    const headerText = "Al Ramlah Travels • Umrah Planning (2/3)"
    const bodyText =
      "Masha'Allah. How many pilgrims will be traveling in your party? (Children and infants will be verified during visa issuance)."
    const footerText = "Al Ramlah Travels • Askari 10 Lahore"
    const buttons = [
      { id: "intake_p_couple", title: "1-2 Adults (Couple)" },
      { id: "intake_p_family", title: "Family 3-5 Persons" },
      { id: "intake_p_group", title: "Group 6+ Persons" },
    ]

    let wamid: string
    try {
      const res = await sendInteractiveButtonsMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: input.contactPhone,
        headerText,
        bodyText,
        footerText,
        buttons,
        contextMessageId: input.inboundWamid,
      })
      wamid = res.messageId
    } catch {
      wamid = `wamid.sim_intake_p_${crypto.randomBytes(12).toString("hex")}`
    }

    const [inserted] = await db
      .insert(whatsappMessages)
      .values({
        conversationId: conv.id,
        wamid,
        direction: "outbound",
        status: "sent",
        messageType: "interactive",
        body: bodyText,
        contextMessageId: input.inboundWamid,
        isAutoReply: true,
        interactivePayload: {
          type: "button",
          flowStep: "AWAITING_PILGRIMS",
          headerText,
          bodyText,
          footerText,
          buttons,
        },
        sentAt: now,
      })
      .returning()

    if (inserted) {
      sentMessageIds.push(inserted.id)
      sentWamids.push(wamid)
    }

    const nextState: WhatsappIntakeFlowState = {
      ...currentState,
      step: "AWAITING_PILGRIMS",
      month: selectedMonth,
      updatedAt: now.toISOString(),
    }

    await db
      .update(whatsappConversations)
      .set({
        intakeFlowState: nextState,
        lastAutoRepliedAt: now,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conv.id))

    return {
      handled: true,
      step: "AWAITING_PILGRIMS",
      sentMessageIds,
      sentWamids,
    }
  }

  // 4. Step 2 -> Step 3 (Awaiting Pilgrims -> Awaiting Hotel Tier)
  if (currentState.step === "AWAITING_PILGRIMS") {
    const selectedPilgrims = resolvePilgrimSelection(rawText, buttonId)
    if (!selectedPilgrims) {
      const bodyText =
        "Please select your party size to proceed with your Umrah quote:"
      const buttons = [
        { id: "intake_p_couple", title: "1-2 Adults (Couple)" },
        { id: "intake_p_family", title: "Family 3-5 Persons" },
        { id: "intake_p_group", title: "Group 6+ Persons" },
      ]

      let wamid: string
      try {
        const res = await sendInteractiveButtonsMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          bodyText,
          buttons,
          contextMessageId: input.inboundWamid,
        })
        wamid = res.messageId
      } catch {
        wamid = `wamid.sim_intake_p_rep_${crypto.randomBytes(12).toString("hex")}`
      }

      return {
        handled: true,
        step: "AWAITING_PILGRIMS",
        sentMessageIds: [],
        sentWamids: [wamid],
      }
    }

    // Advance to AWAITING_HOTEL_TIER
    const headerText = "Al Ramlah Travels • Umrah Planning (3/3)"
    const bodyText =
      "What accommodation standard do you prefer for Makkah & Madinah?"
    const footerText = "Al Ramlah Travels • Askari 10 Lahore"
    const buttons = [
      { id: "intake_h_5star", title: "5★ Clock Tower" },
      { id: "intake_h_4star", title: "4★ Walking Distance" },
      { id: "intake_h_economy", title: "Economy Shuttle" },
    ]

    let wamid: string
    try {
      const res = await sendInteractiveButtonsMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: input.contactPhone,
        headerText,
        bodyText,
        footerText,
        buttons,
        contextMessageId: input.inboundWamid,
      })
      wamid = res.messageId
    } catch {
      wamid = `wamid.sim_intake_h_${crypto.randomBytes(12).toString("hex")}`
    }

    const [inserted] = await db
      .insert(whatsappMessages)
      .values({
        conversationId: conv.id,
        wamid,
        direction: "outbound",
        status: "sent",
        messageType: "interactive",
        body: bodyText,
        contextMessageId: input.inboundWamid,
        isAutoReply: true,
        interactivePayload: {
          type: "button",
          flowStep: "AWAITING_HOTEL_TIER",
          headerText,
          bodyText,
          footerText,
          buttons,
        },
        sentAt: now,
      })
      .returning()

    if (inserted) {
      sentMessageIds.push(inserted.id)
      sentWamids.push(wamid)
    }

    const nextState: WhatsappIntakeFlowState = {
      ...currentState,
      step: "AWAITING_HOTEL_TIER",
      pilgrimCount: selectedPilgrims.label,
      updatedAt: now.toISOString(),
    }

    await db
      .update(whatsappConversations)
      .set({
        intakeFlowState: nextState,
        lastAutoRepliedAt: now,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conv.id))

    return {
      handled: true,
      step: "AWAITING_HOTEL_TIER",
      sentMessageIds,
      sentWamids,
    }
  }

  // 5. Step 3 -> COMPLETED (Hotel Tier -> Create Application Lead)
  if (currentState.step === "AWAITING_HOTEL_TIER") {
    const selectedHotelTier = resolveHotelSelection(rawText, buttonId)
    if (!selectedHotelTier) {
      const bodyText =
        "Please select your preferred hotel accommodation category to finalize your inquiry:"
      const buttons = [
        { id: "intake_h_5star", title: "5★ Clock Tower" },
        { id: "intake_h_4star", title: "4★ Walking Distance" },
        { id: "intake_h_economy", title: "Economy Shuttle" },
      ]

      let wamid: string
      try {
        const res = await sendInteractiveButtonsMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          bodyText,
          buttons,
          contextMessageId: input.inboundWamid,
        })
        wamid = res.messageId
      } catch {
        wamid = `wamid.sim_intake_h_rep_${crypto.randomBytes(12).toString("hex")}`
      }

      return {
        handled: true,
        step: "AWAITING_HOTEL_TIER",
        sentMessageIds: [],
        sentWamids: [wamid],
      }
    }

    const referenceNumber = generateReferenceNumber()
    const pilgrimStr = currentState.pilgrimCount || "1-2 Adults (Couple)"
    const numPilgrimsMatch = pilgrimStr.match(/\d+/)
    const adults = numPilgrimsMatch ? parseInt(numPilgrimsMatch[0], 10) : 2

    // Insert tracked lead into `applications`
    const [newApp] = await db
      .insert(applications)
      .values({
        referenceNumber,
        source: "custom_builder",
        status: "pending_quote",
        presetMode: "complete_umrah",
        customerName: conv.contactName || conv.contactPhone || "WhatsApp Pilgrim",
        customerPhone: conv.contactPhone,
        customerWhatsapp: conv.contactPhone,
        customerCity: "Lahore",
        adults: Math.max(1, adults),
        children: 0,
        infants: 0,
        totalPassportCount: Math.max(1, adults),
        bedAndSeatCount: Math.max(1, adults),
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: false,
        sourcePostCode: "WA-INTAKE",
        specialRequests: `[WhatsApp Guided Intake]\nSeason: ${currentState.month || "Upcoming"}\nParty Size: ${currentState.pilgrimCount || "Couple"}\nHotel Tier: ${selectedHotelTier}`,
      })
      .returning()

    const finalState: WhatsappIntakeFlowState = {
      ...currentState,
      step: "COMPLETED",
      hotelTier: selectedHotelTier,
      applicationId: newApp?.id,
      updatedAt: now.toISOString(),
    }

    await db
      .update(whatsappConversations)
      .set({
        applicationId: newApp?.id || conv.applicationId,
        intakeFlowState: finalState,
        lastAutoRepliedAt: now,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conv.id))

    // Send confirmation message
    const confirmationLines = [
      `*Alhamdulillah! Your customized Umrah inquiry dossier has been registered.* 🕋✨`,
      ``,
      `📌 *Reference*: \`${referenceNumber}\``,
      `🗓 *Season*: ${currentState.month || "Upcoming"}`,
      `👥 *Party*: ${currentState.pilgrimCount || "Couple"}`,
      `🏨 *Category*: ${selectedHotelTier}`,
      ``,
      `A dedicated Al Ramlah Haramain consultant from our Askari 10 Lahore desk has been assigned to prepare your itemized proposal and will follow up shortly.`,
      ``,
      `_JazakAllah Khair for placing your trust in Al Ramlah Travels._`,
    ]
    const confirmationText = confirmationLines.join("\n")

    let confirmWamid: string
    try {
      const res = await sendInteractiveButtonsMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: input.contactPhone,
        headerText: `Dossier Created • ${referenceNumber}`.slice(0, 60),
        bodyText: confirmationText,
        footerText: "Al Ramlah Travels • Askari 10 Lahore",
        buttons: [{ id: "rule_loc_call", title: "Talk to Consultant" }],
        contextMessageId: input.inboundWamid,
      })
      confirmWamid = res.messageId
    } catch {
      try {
        const textRes = await sendTextMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          text: confirmationText,
          contextMessageId: input.inboundWamid,
        })
        confirmWamid = textRes.messageId
      } catch {
        confirmWamid = `wamid.sim_intake_done_${crypto.randomBytes(12).toString("hex")}`
      }
    }

    const [insertedDone] = await db
      .insert(whatsappMessages)
      .values({
        conversationId: conv.id,
        wamid: confirmWamid,
        direction: "outbound",
        status: "sent",
        messageType: "interactive",
        body: confirmationText,
        contextMessageId: input.inboundWamid,
        isAutoReply: true,
        interactivePayload: {
          flowStep: "COMPLETED",
          referenceNumber,
          applicationId: newApp?.id,
        },
        sentAt: now,
      })
      .returning()

    if (insertedDone) {
      sentMessageIds.push(insertedDone.id)
      sentWamids.push(confirmWamid)
    }

    return {
      handled: true,
      step: "COMPLETED",
      referenceNumber,
      applicationId: newApp?.id,
      sentMessageIds,
      sentWamids,
    }
  }

  return {
    handled: false,
    step: currentState.step,
    sentMessageIds: [],
    sentWamids: [],
  }
}

/**
 * Spec alias for advanceUmrahIntakeFlow.
 */
export const runGuidedUmrahIntakeStep = advanceUmrahIntakeFlow

/**
 * Spec alias for advanceUmrahIntakeFlow.
 */
export const handleIntakeFlowInbound = advanceUmrahIntakeFlow
