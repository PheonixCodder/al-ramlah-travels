import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  classifyWhatsappIntentDeterministic,
  classifyWhatsappConversationIntent,
  parseFounderForwardedLead,
} from "../lib/whatsapp/intent-classifier"

describe("WhatsApp Coexistence & AI Intent Detection Gatekeeper", () => {
  it("classifies ART-... post reference codes as 100% TRAVEL_LEAD", () => {
    const res = classifyWhatsappIntentDeterministic({
      inboundText: "Salam, please share details for ART-2026-0412-001-C01",
      detectedPostCode: "ART-2026-0412-001-C01",
    })

    assert.ok(res)
    assert.equal(res.category, "TRAVEL_LEAD")
    assert.equal(res.confidence, 100)
    assert.equal(res.shouldTriggerAutoReply, true)
  })

  it("classifies English, Roman Urdu, and Urdu script Umrah/Hajj/Visa messages as TRAVEL_LEAD", () => {
    const romanUrdu = classifyWhatsappIntentDeterministic({
      inboundText: "Ubaid bhai, Ramadan umrah package for 4 adults makkah hotel rate kya hai?",
    })
    assert.ok(romanUrdu)
    assert.equal(romanUrdu.category, "TRAVEL_LEAD")
    assert.equal(romanUrdu.shouldTriggerAutoReply, true)

    const urduScript = classifyWhatsappIntentDeterministic({
      inboundText: "عمرہ پیکج اور مکہ ہوٹل کی تفصیلات بتا دیں",
    })
    assert.ok(urduScript)
    assert.equal(urduScript.category, "TRAVEL_LEAD")
    assert.equal(urduScript.shouldTriggerAutoReply, true)
  })

  it("classifies personal or unrelated business messages on Coexistence line as PERSONAL_OR_OTHER and mutes auto-reply", () => {
    const personal = classifyWhatsappIntentDeterministic({
      inboundText: "Yar software deployment aur plot registry ki payment bhej di hai",
    })

    assert.ok(personal)
    assert.equal(personal.category, "PERSONAL_OR_OTHER")
    assert.equal(personal.shouldTriggerAutoReply, false)
  })

  it("withholds auto-reply on bare greetings ('Assalam o Alaikum') on Founder Coexistence line so personal contacts are never spammed", async () => {
    const res = await classifyWhatsappConversationIntent({
      inboundText: "Assalam o Alaikum",
    })

    assert.equal(res.category, "PERSONAL_OR_OTHER")
    assert.equal(res.shouldTriggerAutoReply, false)
  })

  it("preserves TRAVEL_LEAD and allows auto-reply on greetings inside an active travel lead thread", async () => {
    const res = await classifyWhatsappConversationIntent({
      inboundText: "Assalam o Alaikum",
      existingIntentCategory: "TRAVEL_LEAD",
      existingIntentConfidence: 95,
    })

    assert.equal(res.category, "TRAVEL_LEAD")
    assert.equal(res.shouldTriggerAutoReply, true)
  })

  it("parses founder-forwarded lead phone numbers (03xx and +923xx) for Dedicated AI Agent handoff", () => {
    const parsedLocal = parseFounderForwardedLead(
      "0300-1234567 Ahmed Bhai asking for 14 days Quad Umrah package from Lahore"
    )
    assert.ok(parsedLocal)
    assert.equal(parsedLocal.leadPhone, "923001234567")
    assert.match(parsedLocal.inquirySummary, /Ahmed Bhai/)

    const parsedIntl = parseFounderForwardedLead(
      "+92 321 9876543 - needs 5 star Makkah clock tower hotel"
    )
    assert.ok(parsedIntl)
    assert.equal(parsedIntl.leadPhone, "923219876543")
  })
})
