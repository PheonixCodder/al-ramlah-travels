process.env.SKIP_ENV_VALIDATION = "1"
process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/alramlah"
process.env.DATABASE_URL_POOLED = "postgresql://user:pass@localhost:5432/alramlah"
process.env.BETTER_AUTH_SECRET = "12345678901234567890123456789012"

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  extractTemplatePlaceholders,
  extractTemplateVariablePlaceholders,
  interpolateTemplateParam,
  resolveRecipientTemplateParams,
  interpolateTemplateVariables,
  parseWhatsappBroadcastCsv,
} from "../lib/whatsapp/template-variables"

import {
  isIntakeFlowTrigger,
  matchesIntakeTrigger,
  resolveMonthSelection,
  resolvePilgrimSelection,
  resolveHotelSelection,
  evaluateIntakeTransition,
  generateReferenceNumber,
} from "../lib/whatsapp/intake-flow"

import {
  toggleWhatsappConversationPinSchema,
  toggleWhatsappConversationArchiveSchema,
  assignWhatsappConversationAgentSchema,
  addWhatsappConversationInternalNoteSchema,
  createWhatsappBroadcastSchema,
  retryFailedWhatsappBroadcastSchema,
  getWhatsappBroadcastDetailsSchema,
  sendWhatsappConversationReplySchema,
} from "../lib/validations/whatsapp-crm"

const SAMPLE_UUID_1 = "11111111-2222-4333-8444-555555555555"
const SAMPLE_UUID_2 = "22222222-3333-4444-8555-666666666666"

// ============================================================================
// 1. Template Variables & Dynamic Parameter Extraction (AC-4 & AC-7)
// ============================================================================

describe("Spec 0019 / Slice 38: Template Variables, Interpolation & CSV Parser", () => {
  describe("extractTemplatePlaceholders()", () => {
    it("extracts sorted unique positional indices from template body", () => {
      const text =
        "Assalam-o-Alaikum {{1}}! Your Umrah reservation for {{2}} is confirmed. Reminder: {{1}}."
      const indices = extractTemplatePlaceholders(text)
      assert.deepEqual(indices, [1, 2])
    })

    it("verifies alias extractTemplateVariablePlaceholders behaves identically", () => {
      const text = "Hi {{3}}, code: {{1}}, ref: {{2}}"
      const indices = extractTemplateVariablePlaceholders(text)
      assert.deepEqual(indices, [1, 2, 3])
    })

    it("returns empty array for templates without dynamic variables or empty string", () => {
      assert.deepEqual(extractTemplatePlaceholders("Fixed static text"), [])
      assert.deepEqual(extractTemplatePlaceholders(""), [])
      assert.deepEqual(extractTemplatePlaceholders(null as any), [])
    })
  })

  describe("interpolateTemplateParam()", () => {
    it("replaces {{name}} and {{phone}} with contact values", () => {
      const contact = { name: "Muhammad Hamza", phone: "+923001234567" }
      const res = interpolateTemplateParam("Welcome {{name}} ({{phone}})!", contact)
      assert.equal(res, "Welcome Muhammad Hamza (+923001234567)!")
    })

    it("falls back to 'Pilgrim' when contact name is missing or empty", () => {
      const contact = { phone: "+923219876543" }
      const res = interpolateTemplateParam("Assalam {{name}}", contact)
      assert.equal(res, "Assalam Pilgrim")
    })

    it("is case-insensitive for {{Name}} and {{PHONE}}", () => {
      const contact = { name: "Fatima", phone: "03451122334" }
      const res = interpolateTemplateParam("Dear {{Name}}, mob: {{PHONE}}", contact)
      assert.equal(res, "Dear Fatima, mob: 03451122334")
    })
  })

  describe("resolveRecipientTemplateParams()", () => {
    it("interpolates parameters inside array structures", () => {
      const contact = { name: "Tariq Malik", phone: "+923008451122" }
      const rawParams = ["{{name}}", "Special Umrah 2027", "Cell: {{phone}}"]
      const resolved = resolveRecipientTemplateParams(rawParams, contact)
      assert.deepEqual(resolved, ["Tariq Malik", "Special Umrah 2027", "Cell: +923008451122"])
    })

    it("interpolates parameters inside key-value record structures", () => {
      const contact = { name: "Zainab Bibi", phone: "+923190462638" }
      const rawRecord = {
        "1": "{{name}}",
        "2": "5-Star Clock Tower",
        contactNumber: "{{phone}}",
      }
      const resolved = resolveRecipientTemplateParams(rawRecord, contact)
      assert.deepEqual(resolved, {
        "1": "Zainab Bibi",
        "2": "5-Star Clock Tower",
        contactNumber: "+923190462638",
      })
    })

    it("returns empty object when parameters are undefined", () => {
      assert.deepEqual(
        resolveRecipientTemplateParams(undefined, { phone: "+92300" }),
        {}
      )
    })
  })

  describe("interpolateTemplateVariables()", () => {
    it("replaces positional {{1}}, {{2}} from array and contact tokens", () => {
      const body = "Assalam {{1}}, we confirm your {{2}} package for {{phone}}."
      const res = interpolateTemplateVariables(body, ["Ali Khan", "Ramadan 2027"], {
        name: "Ali Khan",
        phone: "+923001234567",
      })
      assert.equal(
        res,
        "Assalam Ali Khan, we confirm your Ramadan 2027 package for +923001234567."
      )
    })

    it("replaces variables from record dictionary", () => {
      const body = "Dossier {{1}}: {{name}} traveling in {{2}}."
      const res = interpolateTemplateVariables(
        body,
        { "1": "ART-WA-001", "2": "Shawwal 2027" },
        { name: "Bilal", phone: "+92300" }
      )
      assert.equal(res, "Dossier ART-WA-001: Bilal traveling in Shawwal 2027.")
    })
  })

  describe("parseWhatsappBroadcastCsv()", () => {
    it("parses name,phone formatted lines with E.164 normalization", () => {
      const csv = `Name,Phone\nMuhammad Ali,03001234567\nUsman Tariq,03219876543`
      const parsed = parseWhatsappBroadcastCsv(csv)
      assert.equal(parsed.validCount, 2)
      assert.equal(parsed.invalidCount, 0)
      assert.equal(parsed.recipients[0]?.phone, "+923001234567")
      assert.equal(parsed.recipients[0]?.name, "Muhammad Ali")
      assert.equal(parsed.recipients[1]?.phone, "+923219876543")
      assert.equal(parsed.recipients[1]?.name, "Usman Tariq")
    })

    it("parses phone,name reversed column order", () => {
      const csv = `Phone,Name\n+923008451122,Al Ramlah Desk\n923190462638,Founder Line`
      const parsed = parseWhatsappBroadcastCsv(csv)
      assert.equal(parsed.validCount, 2)
      assert.equal(parsed.recipients[0]?.phone, "+923008451122")
      assert.equal(parsed.recipients[0]?.name, "Al Ramlah Desk")
      assert.equal(parsed.recipients[1]?.phone, "+923190462638")
      assert.equal(parsed.recipients[1]?.name, "Founder Line")
    })

    it("parses plain phone list without names", () => {
      const csv = `03001112233\n03214445566\n03337778899`
      const parsed = parseWhatsappBroadcastCsv(csv)
      assert.equal(parsed.validCount, 3)
      assert.equal(parsed.recipients[0]?.phone, "+923001112233")
      assert.equal(parsed.recipients[0]?.name, undefined)
    })

    it("handles quoted CSV strings containing commas", () => {
      const csv = `"Malik, Muhammad Ali", 03001234567\n"Bibi, Fatima", 03219876543`
      const parsed = parseWhatsappBroadcastCsv(csv)
      assert.equal(parsed.validCount, 2)
      assert.equal(parsed.recipients[0]?.name, "Malik, Muhammad Ali")
      assert.equal(parsed.recipients[0]?.phone, "+923001234567")
    })

    it("deduplicates identical phone numbers", () => {
      const csv = `Muhammad Ali, 03001234567\nM. Ali, +923001234567\nAli, 0300-1234567`
      const parsed = parseWhatsappBroadcastCsv(csv)
      assert.equal(parsed.validCount, 1)
      assert.equal(parsed.recipients.length, 1)
    })

    it("captures invalid rows and increments invalidCount", () => {
      const csv = `Valid Pilgrim, 03001234567\nInvalid Person, 12345\nJust Text Without Phone\n`
      const parsed = parseWhatsappBroadcastCsv(csv)
      assert.equal(parsed.validCount, 1)
      assert.equal(parsed.invalidCount, 2)
      assert.equal(parsed.errors.length, 2)
    })
  })
})

// ============================================================================
// 2. Guided Multi-Step Umrah Intake Flow State Machine (AC-2)
// ============================================================================

describe("Spec 0019 / Slice 38: Guided Multi-Step Umrah Intake Flow Engine", () => {
  describe("isIntakeFlowTrigger() / matchesIntakeTrigger()", () => {
    it("detects conversational trigger keywords in pilgrim text", () => {
      assert.equal(isIntakeFlowTrigger("Assalam o Alaikum, I want to plan umrah for family"), true)
      assert.equal(matchesIntakeTrigger("Please provide a custom quote for December"), true)
      assert.equal(isIntakeFlowTrigger("start inquiry"), true)
      assert.equal(isIntakeFlowTrigger("need custom package rates"), true)
      assert.equal(isIntakeFlowTrigger("can you book umrah"), true)
      assert.equal(isIntakeFlowTrigger("umrah package details"), true)
    })

    it("detects interactive trigger button replies", () => {
      assert.equal(isIntakeFlowTrigger("", "start_umrah_intake"), true)
      assert.equal(matchesIntakeTrigger(null, "art_intake_start"), true)
      assert.equal(isIntakeFlowTrigger(undefined, "btn_plan_umrah"), true)
      assert.equal(isIntakeFlowTrigger("", "rule_loc_umrah"), true)
    })

    it("rejects generic inquiries unrelated to intake", () => {
      assert.equal(isIntakeFlowTrigger("Where is your Askari 10 office located?"), false)
      assert.equal(isIntakeFlowTrigger("What are the bank account details?"), false)
      assert.equal(isIntakeFlowTrigger("Send me the hotel voucher PDF"), false)
    })
  })

  describe("Intake Selection Resolvers", () => {
    it("resolves travel seasons from buttons and text", () => {
      assert.equal(resolveMonthSelection("", "intake_m_novdec"), "Nov - Dec 2026")
      assert.equal(resolveMonthSelection("I plan in Ramadan"), "Ramadan 2027")
      assert.equal(resolveMonthSelection("", "intake_m_shawwal"), "Shawwal / Spring")
      assert.equal(resolveMonthSelection("Spring time"), "Shawwal / Spring")
    })

    it("resolves party size and adult counts from buttons and text", () => {
      const couple = resolvePilgrimSelection("", "intake_p_couple")
      assert.equal(couple?.label, "1-2 Adults (Couple)")
      assert.equal(couple?.adults, 2)

      const family = resolvePilgrimSelection("We are a family of 4")
      assert.equal(family?.label, "Family 3-5 Persons")
      assert.equal(family?.adults, 4)

      const group = resolvePilgrimSelection("", "intake_p_group")
      assert.equal(group?.label, "Group 6+ Persons")
      assert.equal(group?.adults, 6)
    })

    it("resolves hotel tier categories from buttons and text", () => {
      assert.equal(resolveHotelSelection("", "intake_h_5star"), "5★ Clock Tower")
      assert.equal(resolveHotelSelection("prefer walking distance"), "4★ Walking Distance")
      assert.equal(resolveHotelSelection("", "intake_h_economy"), "Economy Shuttle")
      assert.equal(resolveHotelSelection("economy shuttle"), "Economy Shuttle")
    })
  })

  describe("evaluateIntakeTransition() State Machine Transitions", () => {
    it("transitions from IDLE to AWAITING_MONTH on trigger", () => {
      const res = evaluateIntakeTransition("IDLE", { text: "plan umrah" })
      assert.equal(res.nextStep, "AWAITING_MONTH")
    })

    it("transitions from AWAITING_MONTH to AWAITING_PILGRIMS upon season selection", () => {
      const res = evaluateIntakeTransition("AWAITING_MONTH", {
        buttonId: "intake_m_ramadan",
      })
      assert.equal(res.nextStep, "AWAITING_PILGRIMS")
      assert.equal(res.month, "Ramadan 2027")
    })

    it("re-prompts in AWAITING_MONTH when input is unrecognized", () => {
      const res = evaluateIntakeTransition("AWAITING_MONTH", {
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod",
      })
      assert.equal(res.nextStep, "AWAITING_MONTH")
      assert.equal(res.rePrompt, true)
    })

    it("transitions from AWAITING_PILGRIMS to AWAITING_HOTEL_TIER upon party selection", () => {
      const res = evaluateIntakeTransition("AWAITING_PILGRIMS", {
        buttonId: "intake_p_family",
      })
      assert.equal(res.nextStep, "AWAITING_HOTEL_TIER")
      assert.equal(res.pilgrims?.label, "Family 3-5 Persons")
      assert.equal(res.pilgrims?.adults, 4)
    })

    it("transitions from AWAITING_HOTEL_TIER to COMPLETED upon hotel tier selection", () => {
      const res = evaluateIntakeTransition("AWAITING_HOTEL_TIER", {
        buttonId: "intake_h_5star",
      })
      assert.equal(res.nextStep, "COMPLETED")
      assert.equal(res.hotelTier, "5★ Clock Tower")
    })

    it("handles cancel/reset from any active step and returns to IDLE", () => {
      const res1 = evaluateIntakeTransition("AWAITING_MONTH", { text: "cancel" })
      assert.equal(res1.nextStep, "IDLE")
      assert.equal(res1.cancelled, true)

      const res2 = evaluateIntakeTransition("AWAITING_HOTEL_TIER", { text: "reset" })
      assert.equal(res2.nextStep, "IDLE")
      assert.equal(res2.cancelled, true)
    })
  })

  describe("generateReferenceNumber()", () => {
    it("generates reference number matching the ART-WA-YYYYMMDD-XXXX contract", () => {
      const ref = generateReferenceNumber()
      assert.match(ref, /^ART-WA-\d{8}-[A-F0-9]{4}$/)
    })
  })
})

// ============================================================================
// 3. Conversation & Broadcast Zod Validation Schemas (AC-1, AC-3, AC-4)
// ============================================================================

describe("Spec 0019 / Slice 38: Conversation & Broadcast Validation Schemas", () => {
  describe("toggleWhatsappConversationPinSchema", () => {
    it("validates valid pin toggle inputs", () => {
      const valid = toggleWhatsappConversationPinSchema.parse({
        conversationId: SAMPLE_UUID_1,
        isPinned: true,
      })
      assert.equal(valid.isPinned, true)
    })

    it("rejects non-uuid conversation IDs", () => {
      assert.throws(() => {
        toggleWhatsappConversationPinSchema.parse({
          conversationId: "invalid-id",
          isPinned: true,
        })
      })
    })
  })

  describe("toggleWhatsappConversationArchiveSchema", () => {
    it("validates archive toggle inputs", () => {
      const valid = toggleWhatsappConversationArchiveSchema.parse({
        conversationId: SAMPLE_UUID_1,
        isArchived: true,
      })
      assert.equal(valid.isArchived, true)
    })
  })

  describe("assignWhatsappConversationAgentSchema", () => {
    it("accepts staff user ID string or null for unassignment", () => {
      const assigned = assignWhatsappConversationAgentSchema.parse({
        conversationId: SAMPLE_UUID_1,
        assignedUserId: "usr_agent_001",
      })
      assert.equal(assigned.assignedUserId, "usr_agent_001")

      const unassigned = assignWhatsappConversationAgentSchema.parse({
        conversationId: SAMPLE_UUID_1,
        assignedUserId: null,
      })
      assert.equal(unassigned.assignedUserId, null)

      const emptyStr = assignWhatsappConversationAgentSchema.parse({
        conversationId: SAMPLE_UUID_1,
        assignedUserId: "",
      })
      assert.equal(emptyStr.assignedUserId, null)
    })
  })

  describe("addWhatsappConversationInternalNoteSchema", () => {
    it("validates non-empty staff notes", () => {
      const note = addWhatsappConversationInternalNoteSchema.parse({
        conversationId: SAMPLE_UUID_1,
        note: "Passport bio-page received, awaiting Meezan Bank deposit slip.",
      })
      assert.equal(note.note, "Passport bio-page received, awaiting Meezan Bank deposit slip.")
    })

    it("rejects blank or empty notes", () => {
      assert.throws(() => {
        addWhatsappConversationInternalNoteSchema.parse({
          conversationId: SAMPLE_UUID_1,
          note: "   ",
        })
      })
    })
  })

  describe("createWhatsappBroadcastSchema", () => {
    it("accepts broadcast with recipientPhones array", () => {
      const parsed = createWhatsappBroadcastSchema.parse({
        accountId: SAMPLE_UUID_1,
        name: "Ramadan Broadcast",
        templateId: SAMPLE_UUID_2,
        recipientPhones: ["+923001234567", "+923219876543"],
        headerMediaUrl: "https://example.com/poster.jpg",
        defaultTemplateParams: ["Ramadan 2027"],
      })
      assert.equal(parsed.recipientPhones?.length, 2)
      assert.equal(parsed.headerMediaUrl, "https://example.com/poster.jpg")
    })

    it("accepts broadcast with recipients list", () => {
      const parsed = createWhatsappBroadcastSchema.parse({
        accountId: SAMPLE_UUID_1,
        name: "Personalized VIP Broadcast",
        templateId: SAMPLE_UUID_2,
        recipients: [
          { phone: "+923001234567", name: "Muhammad Ali", templateParams: ["Ali", "VIP"] },
        ],
      })
      assert.equal(parsed.recipients?.length, 1)
    })

    it("accepts broadcast with csvText", () => {
      const parsed = createWhatsappBroadcastSchema.parse({
        accountId: SAMPLE_UUID_1,
        name: "CSV Import Broadcast",
        templateId: SAMPLE_UUID_2,
        csvText: "Name,Phone\nAli Khan,03001234567",
      })
      assert.equal(parsed.csvText, "Name,Phone\nAli Khan,03001234567")
    })

    it("rejects broadcast when no recipients, phones, or csvText are supplied", () => {
      assert.throws(() => {
        createWhatsappBroadcastSchema.parse({
          accountId: SAMPLE_UUID_1,
          name: "Empty Broadcast",
          templateId: SAMPLE_UUID_2,
        })
      })
    })
  })

  describe("retryFailedWhatsappBroadcastSchema & getWhatsappBroadcastDetailsSchema", () => {
    it("validates broadcast retry and drilldown inputs", () => {
      const retry = retryFailedWhatsappBroadcastSchema.parse({ broadcastId: SAMPLE_UUID_1 })
      assert.equal(retry.broadcastId, SAMPLE_UUID_1)

      const details = getWhatsappBroadcastDetailsSchema.parse({ broadcastId: SAMPLE_UUID_2 })
      assert.equal(details.broadcastId, SAMPLE_UUID_2)
    })
  })

  describe("sendWhatsappConversationReplySchema", () => {
    it("validates template reply with headerMediaUrl", () => {
      const reply = sendWhatsappConversationReplySchema.parse({
        conversationId: SAMPLE_UUID_1,
        messageType: "template",
        templateName: "umrah_custom_quote_dossier",
        templateLanguage: "en_US",
        headerMediaUrl: "https://example.com/flyer.jpg",
        templateParams: ["Hamza", "PKR 450,000"],
      })
      assert.equal(reply.headerMediaUrl, "https://example.com/flyer.jpg")
      assert.equal(reply.templateName, "umrah_custom_quote_dossier")
    })
  })
})
