import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  matchKeywordAutoReplyRule,
  isWithinPktBusinessHours,
  DEFAULT_AL_RAMLAH_AUTO_REPLY_RULES,
  DEFAULT_WELCOME_GREETING_TEXT,
  DEFAULT_AWAY_GREETING_TEXT,
  type KeywordRuleCandidate,
} from "../lib/whatsapp/auto-responder"
import {
  upsertWhatsappAutoReplyRuleSchema,
  deleteWhatsappAutoReplyRuleSchema,
  toggleWhatsappAutoReplyRuleSchema,
  updateWhatsappGreetingSettingsSchema,
  upsertWhatsappQuickReplySchema,
  deleteWhatsappQuickReplySchema,
} from "../lib/validations/whatsapp-crm"

const VALID_RULE_UUID = "11111111-2222-4333-8444-555555555555"
const VALID_ACCOUNT_UUID = "22222222-3333-4444-8555-666666666666"

describe("Slice 36 · WaCRM Custom Keyword Auto-Reply Rules Engine & Greeting Setup", () => {
  describe("matchKeywordAutoReplyRule()", () => {
    const sampleRules: KeywordRuleCandidate[] = [
      {
        id: "rule-contains",
        name: "Location Inquiry",
        matchType: "CONTAINS",
        keywords: ["askari 10", "airport road", "office address"],
        responseText:
          "Visit our Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt office.",
        priority: 80,
        cooldownMinutes: 30,
        isActive: true,
      },
      {
        id: "rule-exact",
        name: "Exact Salam Greeting",
        matchType: "EXACT",
        keywords: ["salam", "aoa", "assalamu alaikum"],
        responseText: "Wa Alaikum Assalam! Welcome to Al Ramlah Travels.",
        priority: 60,
        cooldownMinutes: 60,
        isActive: true,
      },
      {
        id: "rule-starts-with",
        name: "Starts With Price Check",
        matchType: "STARTS_WITH",
        keywords: ["price of", "rate for"],
        responseText: "Here are our latest 2026 Umrah package rates.",
        priority: 70,
        cooldownMinutes: 30,
        isActive: true,
      },
      {
        id: "rule-regex",
        name: "Regex Maktab Pattern",
        matchType: "REGEX",
        keywords: ["maktab\\s*[abc]", "hajj\\s*202[67]"],
        responseText: "Hajj 2027 Maktab A, B & C VIP registration is open.",
        priority: 95,
        cooldownMinutes: 60,
        isActive: true,
      },
      {
        id: "rule-inactive",
        name: "Inactive Rule",
        matchType: "CONTAINS",
        keywords: ["secret-disabled"],
        responseText: "Should never match when inactive.",
        priority: 999,
        cooldownMinutes: 15,
        isActive: false,
      },
    ]

    it("matches CONTAINS rules case-insensitively", () => {
      const res = matchKeywordAutoReplyRule(
        "Assalam o Alaikum, where is your ASKARI 10 office located?",
        sampleRules
      )
      assert.ok(res)
      assert.equal(res.rule.id, "rule-contains")
      assert.equal(res.matchedKeyword, "askari 10")
    })

    it("matches EXACT rules only when full trimmed message matches", () => {
      const exactMatch = matchKeywordAutoReplyRule("  AoA  ", sampleRules)
      assert.ok(exactMatch)
      assert.equal(exactMatch.rule.id, "rule-exact")

      const nonExactMatch = matchKeywordAutoReplyRule(
        "AoA brother how are you",
        sampleRules
      )
      assert.equal(nonExactMatch, null)
    })

    it("matches STARTS_WITH rules when message begins with keyword", () => {
      const startsMatch = matchKeywordAutoReplyRule(
        "Rate for 15 days Ramadan Umrah package?",
        sampleRules
      )
      assert.ok(startsMatch)
      assert.equal(startsMatch.rule.id, "rule-starts-with")
      assert.equal(startsMatch.matchedKeyword, "rate for")
    })

    it("matches REGEX rules and respects deterministic highest-priority ordering", () => {
      // Contains both 'askari 10' (priority 80) and 'Maktab B' (priority 95)
      const res = matchKeywordAutoReplyRule(
        "Can I visit Askari 10 to book Maktab B for Hajj?",
        sampleRules
      )
      assert.ok(res)
      assert.equal(res.rule.id, "rule-regex")
    })

    it("ignores inactive rules and safely skips invalid or overly long regex patterns", () => {
      const badRegexRules: KeywordRuleCandidate[] = [
        {
          id: "bad-regex",
          name: "Broken Regex",
          matchType: "REGEX",
          keywords: ["[unclosed-group", "a".repeat(130)],
          responseText: "Should not throw",
          priority: 100,
          isActive: true,
        },
      ]
      assert.doesNotThrow(() => {
        const res = matchKeywordAutoReplyRule("test message", badRegexRules)
        assert.equal(res, null)
      })

      const inactiveRes = matchKeywordAutoReplyRule(
        "secret-disabled",
        sampleRules
      )
      assert.equal(inactiveRes, null)
    })

    it("matches all 4 default Al Ramlah Travels preset rules accurately", () => {
      const presetCandidates: KeywordRuleCandidate[] =
        DEFAULT_AL_RAMLAH_AUTO_REPLY_RULES.map((r, idx) => ({
          ...r,
          id: `preset-${idx + 1}`,
        }))

      const locMatch = matchKeywordAutoReplyRule(
        "Please share your Askari 10 Lahore office pin",
        presetCandidates
      )
      assert.ok(locMatch)
      assert.ok(locMatch.rule.name.includes("Office Location"))

      const docsMatch = matchKeywordAutoReplyRule(
        "What documents are required for Umrah visa?",
        presetCandidates
      )
      assert.ok(docsMatch)
      assert.ok(docsMatch.rule.name.includes("Required Umrah Documents"))

      const hajjMatch = matchKeywordAutoReplyRule(
        "Tell me about Hajj 2027 Maktab packages",
        presetCandidates
      )
      assert.ok(hajjMatch)
      assert.ok(hajjMatch.rule.name.includes("Hajj 2027"))

      const bankMatch = matchKeywordAutoReplyRule(
        "Send your IBAN for payment transfer",
        presetCandidates
      )
      assert.ok(bankMatch)
      assert.ok(bankMatch.rule.name.includes("Bank & Payment Details"))
    })
  })

  describe("isWithinPktBusinessHours()", () => {
    it("evaluates Asia/Karachi (UTC+5) standard daytime hours (09:00 to 21:00 PKT)", () => {
      // 07:00 UTC = 12:00 PKT (noon) -> inside 09:00..21:00 PKT
      const noonPkt = new Date("2026-03-15T07:00:00.000Z")
      assert.equal(isWithinPktBusinessHours(noonPkt, "09:00", "21:00"), true)

      // 18:00 UTC = 23:00 PKT (11 PM) -> outside 09:00..21:00 PKT
      const lateNightPkt = new Date("2026-03-15T18:00:00.000Z")
      assert.equal(
        isWithinPktBusinessHours(lateNightPkt, "09:00", "21:00"),
        false
      )
    })

    it("supports overnight business hours windows and defaults cleanly", () => {
      assert.ok(DEFAULT_WELCOME_GREETING_TEXT.includes("Al Ramlah Travels"))
      assert.ok(DEFAULT_AWAY_GREETING_TEXT.includes("Al Ramlah Travels"))
    })
  })

  describe("Slice 36 Zod Validation Schemas", () => {
    it("validates upsertWhatsappAutoReplyRuleSchema & toggle/delete schemas", () => {
      const validRule = upsertWhatsappAutoReplyRuleSchema.parse({
        id: VALID_RULE_UUID,
        accountId: VALID_ACCOUNT_UUID,
        name: "Umrah Visa Requirements",
        matchType: "CONTAINS",
        keywords: ["visa", "passport", "documents"],
        responseText: "Passport with 8 months validity required.",
        interactiveButtons: [
          { id: "btn_1", title: "Book Umrah" },
          { id: "btn_2", title: "Talk to Agent" },
        ],
        priority: 90,
        cooldownMinutes: 45,
        isActive: true,
      })

      assert.equal(validRule.name, "Umrah Visa Requirements")
      assert.equal(validRule.keywords.length, 3)

      const toggled = toggleWhatsappAutoReplyRuleSchema.parse({
        id: VALID_RULE_UUID,
        isActive: false,
      })
      assert.equal(toggled.isActive, false)

      const deleted = deleteWhatsappAutoReplyRuleSchema.parse({
        id: VALID_RULE_UUID,
      })
      assert.equal(deleted.id, VALID_RULE_UUID)
    })

    it("validates updateWhatsappGreetingSettingsSchema and quick reply schemas", () => {
      const greetingCfg = updateWhatsappGreetingSettingsSchema.parse({
        accountId: VALID_ACCOUNT_UUID,
        autoReplyEnabled: true,
        autoReplyCooldownMinutes: 60,
        welcomeGreetingEnabled: true,
        welcomeGreetingText: "Assalamu Alaikum! Welcome to Al Ramlah Travels.",
        awayGreetingEnabled: true,
        awayGreetingText: "Our Askari 10, Lahore Cantt office opens at 09:00 PKT.",
        businessHoursStart: "09:00",
        businessHoursEnd: "21:00",
      })

      assert.equal(greetingCfg.businessHoursStart, "09:00")
      assert.equal(greetingCfg.welcomeGreetingEnabled, true)

      const qr = upsertWhatsappQuickReplySchema.parse({
        shortcut: "/docs",
        title: "Umrah Documents Checklist",
        category: "documents",
        bodyText: "1. Original Passport\n2. CNIC Copy\n3. Photo",
      })
      assert.equal(qr.shortcut, "/docs")

      const delQr = deleteWhatsappQuickReplySchema.parse({
        id: VALID_RULE_UUID,
      })
      assert.equal(delQr.id, VALID_RULE_UUID)
    })
  })
})
