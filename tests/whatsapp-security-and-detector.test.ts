import "dotenv/config"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import {
  encrypt,
  decrypt,
  isLegacyFormat,
  getDerivedEncryptionKey,
  GCM_IV_LENGTH,
  AUTH_TAG_LENGTH,
  CBC_IV_LENGTH,
} from "../lib/whatsapp/encryption"
import {
  verifyMetaWebhookSignature,
  verifyTokenMatches,
  parseAppSecrets,
} from "../lib/whatsapp/webhook-signature"
import {
  extractPostRefCodes,
  normalizePakistaniPhone,
} from "../lib/whatsapp/post-ref-detector"
import { formatWhatsAppPhone } from "../lib/phone"
import {
  buildSendComponents,
  extractTemplateVariables,
  isNamedVariable,
  type TemplateDefinition,
  type SendTimeParams,
} from "../lib/whatsapp/template-send-builder"

describe("WhatsApp AES-256-GCM Token Encryption and Decryption", () => {
  it("encrypts and decrypts sensitive tokens in a round trip", () => {
    const originalToken = "EAABtestMetaWabaAccessToken_9876543210_abcdef"
    const encrypted = encrypt(originalToken)

    assert.ok(encrypted.length > 0)
    const parts = encrypted.split(":")
    assert.equal(parts.length, 3)

    const [ivHex, ctHex, tagHex] = parts
    assert.equal(ivHex.length, GCM_IV_LENGTH * 2)
    assert.equal(tagHex.length, AUTH_TAG_LENGTH * 2)
    assert.ok(ctHex.length > 0)

    const decrypted = decrypt(encrypted)
    assert.equal(decrypted, originalToken)
  })

  it("produces a unique random IV on every encryption call", () => {
    const token = "EAAB_repeated_token_value_constant"
    const enc1 = encrypt(token)
    const enc2 = encrypt(token)
    const enc3 = encrypt(token)

    assert.notEqual(enc1, enc2)
    assert.notEqual(enc2, enc3)
    assert.notEqual(enc1, enc3)

    const iv1 = enc1.split(":")[0]
    const iv2 = enc2.split(":")[0]
    const iv3 = enc3.split(":")[0]

    assert.notEqual(iv1, iv2)
    assert.notEqual(iv2, iv3)

    assert.equal(decrypt(enc1), token)
    assert.equal(decrypt(enc2), token)
    assert.equal(decrypt(enc3), token)
  })

  it("rejects tampered ciphertext by throwing an authentication error", () => {
    const encrypted = encrypt("sensitive_waba_secret_token")
    const [ivHex, ctHex, tagHex] = encrypted.split(":")

    const flippedChar = ctHex[0] === "a" ? "b" : "a"
    const tamperedCt = flippedChar + ctHex.slice(1)
    const tamperedPayload = `${ivHex}:${tamperedCt}:${tagHex}`

    assert.throws(() => {
      decrypt(tamperedPayload)
    })
  })

  it("rejects tampered auth tag by throwing an authentication error", () => {
    const encrypted = encrypt("sensitive_waba_secret_token")
    const [ivHex, ctHex, tagHex] = encrypted.split(":")

    const flippedTag = (tagHex[0] === "f" ? "0" : "f") + tagHex.slice(1)
    const tamperedPayload = `${ivHex}:${ctHex}:${flippedTag}`

    assert.throws(() => {
      decrypt(tamperedPayload)
    })
  })

  it("rejects tampered IV by throwing an authentication error", () => {
    const encrypted = encrypt("sensitive_waba_secret_token")
    const [ivHex, ctHex, tagHex] = encrypted.split(":")

    const flippedIv = (ivHex[0] === "0" ? "1" : "0") + ivHex.slice(1)
    const tamperedPayload = `${flippedIv}:${ctHex}:${tagHex}`

    assert.throws(() => {
      decrypt(tamperedPayload)
    })
  })

  it("rejects payloads with invalid IV or auth tag lengths", () => {
    const shortIvPayload = "abcd:1234:5678"
    assert.throws(() => {
      decrypt(shortIvPayload)
    }, /invalid GCM IV length/)

    const validIvHex = crypto.randomBytes(GCM_IV_LENGTH).toString("hex")
    const shortTagPayload = `${validIvHex}:1234abcd:5678`
    assert.throws(() => {
      decrypt(shortTagPayload)
    }, /invalid GCM auth tag length/)
  })

  it("handles empty string input safely without throwing", () => {
    assert.equal(encrypt(""), "")
    assert.equal(decrypt(""), "")
    assert.equal(isLegacyFormat(""), false)
  })

  it("detects and decrypts legacy 2 part AES-256-CBC ciphertexts", () => {
    const legacyPlaintext = "legacy_meta_access_token_v1"
    const cbcIv = crypto.randomBytes(CBC_IV_LENGTH)
    const derivedKey = getDerivedEncryptionKey()

    const cipher = crypto.createCipheriv("aes-256-cbc", derivedKey, cbcIv)
    let encrypted = cipher.update(legacyPlaintext, "utf8", "hex")
    encrypted += cipher.final("hex")

    const legacyPayload = `${cbcIv.toString("hex")}:${encrypted}`

    assert.equal(isLegacyFormat(legacyPayload), true)
    const decrypted = decrypt(legacyPayload)
    assert.equal(decrypted, legacyPlaintext)

    const modernPayload = encrypt(legacyPlaintext)
    assert.equal(isLegacyFormat(modernPayload), false)
  })

  it("rejects unrecognised formats with unexpected part count", () => {
    assert.throws(() => {
      decrypt("not_a_valid_token_string")
    }, /unrecognised format/)

    assert.throws(() => {
      decrypt("part1:part2:part3:part4")
    }, /unrecognised format/)
  })
})

describe("Meta Webhook Signature Verification and Token Matching", () => {
  const secretKey = "test_meta_webhook_app_secret_value_2026"
  const payloadBody = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID_12345",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "PHONE_ID_6789" },
            },
            field: "messages",
          },
        ],
      },
    ],
  })

  it("parses single and multiple comma separated app secrets cleanly", () => {
    assert.deepEqual(parseAppSecrets("secret_single"), ["secret_single"])
    assert.deepEqual(
      parseAppSecrets("secret_a,  secret_b , secret_c  "),
      ["secret_a", "secret_b", "secret_c"]
    )
    assert.deepEqual(parseAppSecrets(""), [])
    assert.deepEqual(parseAppSecrets(" , , "), [])
    assert.deepEqual(parseAppSecrets(undefined), [])
  })

  it("verifies valid HMAC-SHA256 signature against webhook payload", () => {
    const hmacHex = crypto
      .createHmac("sha256", secretKey)
      .update(payloadBody, "utf8")
      .digest("hex")
    const signatureHeader = `sha256=${hmacHex}`

    const isValid = verifyMetaWebhookSignature(
      payloadBody,
      signatureHeader,
      secretKey
    )
    assert.equal(isValid, true)
  })

  it("rejects tampered webhook body when signature does not match", () => {
    const hmacHex = crypto
      .createHmac("sha256", secretKey)
      .update(payloadBody, "utf8")
      .digest("hex")
    const signatureHeader = `sha256=${hmacHex}`

    const tamperedBody = payloadBody + " "
    const isValid = verifyMetaWebhookSignature(
      tamperedBody,
      signatureHeader,
      secretKey
    )
    assert.equal(isValid, false)
  })

  it("rejects signature verification when signed with a different secret", () => {
    const hmacHex = crypto
      .createHmac("sha256", secretKey)
      .update(payloadBody, "utf8")
      .digest("hex")
    const signatureHeader = `sha256=${hmacHex}`

    const isValid = verifyMetaWebhookSignature(
      payloadBody,
      signatureHeader,
      "completely_wrong_secret_key"
    )
    assert.equal(isValid, false)
  })

  it("verifies signatures matching any secret in comma separated multi app list", () => {
    const secretOne = "primary_app_secret_111"
    const secretTwo = "secondary_app_secret_222"
    const secretThree = "backup_app_secret_333"
    const combinedSecrets = `${secretOne},  ${secretTwo} , ${secretThree}`

    const sigForSecond =
      "sha256=" +
      crypto
        .createHmac("sha256", secretTwo)
        .update(payloadBody, "utf8")
        .digest("hex")

    const isValid = verifyMetaWebhookSignature(
      payloadBody,
      sigForSecond,
      combinedSecrets
    )
    assert.equal(isValid, true)
  })

  it("fails closed when no app secret is configured", () => {
    const hmacHex = crypto
      .createHmac("sha256", secretKey)
      .update(payloadBody, "utf8")
      .digest("hex")
    const signatureHeader = `sha256=${hmacHex}`

    const isValid = verifyMetaWebhookSignature(
      payloadBody,
      signatureHeader,
      ""
    )
    assert.equal(isValid, false)
  })

  it("rejects null, missing, or malformed signature headers", () => {
    assert.equal(verifyMetaWebhookSignature(payloadBody, null, secretKey), false)
    assert.equal(
      verifyMetaWebhookSignature(payloadBody, "not_sha256_header", secretKey),
      false
    )
    assert.equal(verifyMetaWebhookSignature(payloadBody, "sha256=", secretKey), false)
    assert.equal(
      verifyMetaWebhookSignature(payloadBody, "sha256=short", secretKey),
      false
    )
  })

  it("compares verification tokens in constant time", () => {
    const stored = "al_ramlah_meta_verify_token_secure_99"
    const matching = "al_ramlah_meta_verify_token_secure_99"
    const incorrect = "random_attacker_probe_token"

    assert.equal(verifyTokenMatches(stored, matching), true)
    assert.equal(verifyTokenMatches(stored, incorrect), false)
    assert.equal(verifyTokenMatches("", matching), false)
    assert.equal(verifyTokenMatches(stored, ""), false)
    assert.equal(verifyTokenMatches("", ""), false)
  })
})

describe("Inbound Post Reference Code and Phone Normalization", () => {
  it("extracts reference codes from English pilgrim messages", () => {
    const englishMessage =
      "Salam Al Ramlah team! Can you share details for package ART-AM-21D-01 and flyer ART-2026-8812?"
    const codes = extractPostRefCodes(englishMessage)
    assert.deepEqual(codes, ["ART-AM-21D-01", "ART-2026-8812"])
  })

  it("extracts reference codes from Arabic pilgrim messages", () => {
    const arabicMessage =
      "السلام عليكم ورحمة الله، بخصوص باقة ART-AM-21D-01 وباقة ART-VIP-15D كم السعر النهائي لشخصين؟"
    const codes = extractPostRefCodes(arabicMessage)
    assert.deepEqual(codes, ["ART-AM-21D-01", "ART-VIP-15D"])
  })

  it("extracts reference codes from Urdu pilgrim messages", () => {
    const urduMessage =
      "اسلام علیکم، مجھے ART-SH-14D-03 اور ART-UMRAH-10D کے پیکج کی معلومات مل سکتی ہیں؟"
    const codes = extractPostRefCodes(urduMessage)
    assert.deepEqual(codes, ["ART-SH-14D-03", "ART-UMRAH-10D"])
  })

  it("normalizes lowercase and mixed case codes to uppercase and deduplicates them", () => {
    const repeated =
      "Details on art-am-21d-01 please, also ART-AM-21D-01 and Art-Am-21d-01"
    const codes = extractPostRefCodes(repeated)
    assert.deepEqual(codes, ["ART-AM-21D-01"])
  })

  it("returns empty array when no reference codes exist or text is empty", () => {
    assert.deepEqual(extractPostRefCodes(null), [])
    assert.deepEqual(extractPostRefCodes(undefined), [])
    assert.deepEqual(extractPostRefCodes(""), [])
    assert.deepEqual(extractPostRefCodes("Salam brother, how are you?"), [])
  })

  it("normalizes Pakistani 03xx phone numbers to 923xx E164 format and generates search variants", () => {
    const result = normalizePakistaniPhone("03274029701")

    assert.equal(result.raw, "03274029701")
    assert.equal(result.digitsOnly, "03274029701")
    assert.equal(result.normalizedE164, "923274029701")
    assert.equal(result.national03, "03274029701")

    assert.ok(result.variants.includes("03274029701"))
    assert.ok(result.variants.includes("923274029701"))
    assert.ok(result.variants.includes("+923274029701"))
  })

  it("normalizes Pakistani numbers already prefixed with 92 or international 00", () => {
    const res92 = normalizePakistaniPhone("923274029701")
    assert.equal(res92.normalizedE164, "923274029701")
    assert.equal(res92.national03, "03274029701")

    const res00 = normalizePakistaniPhone("00923274029701")
    assert.equal(res00.normalizedE164, "923274029701")
    assert.equal(res00.national03, "03274029701")
  })

  it("normalizes formatted numbers with plus and spaces and ten digit numbers", () => {
    const resFormatted = normalizePakistaniPhone("+92 327 4029701")
    assert.equal(resFormatted.normalizedE164, "923274029701")
    assert.equal(resFormatted.national03, "03274029701")

    const res10 = normalizePakistaniPhone("3274029701")
    assert.equal(res10.normalizedE164, "923274029701")
    assert.equal(res10.national03, "03274029701")
  })

  it("handles empty or null phone inputs gracefully", () => {
    const resNull = normalizePakistaniPhone(null)
    assert.equal(resNull.raw, "")
    assert.equal(resNull.digitsOnly, "")
    assert.equal(resNull.normalizedE164, "")
    assert.equal(resNull.national03, "")
    assert.deepEqual(resNull.variants, [])
  })
})

describe("WhatsApp Template Send Component Builder", () => {
  it("extracts positional and named template variables accurately", () => {
    const positional = extractTemplateVariables(
      "Salam {{1}}, your package {{2}} is confirmed for {{3}}."
    )
    assert.deepEqual(positional, ["1", "2", "3"])

    const named = extractTemplateVariables(
      "Salam {{customer_name}}, your booking reference is {{booking_ref}}."
    )
    assert.deepEqual(named, ["booking_ref", "customer_name"])

    assert.equal(isNamedVariable("customer_name"), true)
    assert.equal(isNamedVariable("1"), false)
    assert.equal(isNamedVariable("12"), false)
  })

  it("builds image, video, and document media headers", () => {
    const imageTemplate: TemplateDefinition = {
      headerType: "IMAGE",
      bodyText: "Package details attached below",
    }
    const imageComponents = buildSendComponents(imageTemplate, {
      headerMediaUrl: "https://r2.alramlahtravels.com/flyer-card-1.jpg",
    })
    assert.deepEqual(imageComponents, [
      {
        type: "header",
        parameters: [
          {
            type: "image",
            image: { link: "https://r2.alramlahtravels.com/flyer-card-1.jpg" },
          },
        ],
      },
    ])

    const videoTemplate: TemplateDefinition = {
      headerType: "VIDEO",
      bodyText: "Watch the hotel walkthrough",
    }
    const videoComponents = buildSendComponents(videoTemplate, {
      headerMediaId: "meta_media_id_video_12345",
    })
    assert.deepEqual(videoComponents, [
      {
        type: "header",
        parameters: [
          {
            type: "video",
            video: { id: "meta_media_id_video_12345" },
          },
        ],
      },
    ])

    const docTemplate: TemplateDefinition = {
      headerType: "DOCUMENT",
      bodyText: "Your voucher is attached",
    }
    const docComponents = buildSendComponents(docTemplate, {
      headerMediaUrl: "https://r2.alramlahtravels.com/voucher.pdf",
    })
    assert.deepEqual(docComponents, [
      {
        type: "header",
        parameters: [
          {
            type: "document",
            document: { link: "https://r2.alramlahtravels.com/voucher.pdf" },
          },
        ],
      },
    ])
  })

  it("builds text header with dynamic variable", () => {
    const textHeaderTemplate: TemplateDefinition = {
      headerType: "TEXT",
      headerContent: "Welcome to Al Ramlah {{1}}",
      bodyText: "Your application is in review",
    }
    const components = buildSendComponents(textHeaderTemplate, {
      headerText: "Haji Usman",
    })
    assert.deepEqual(components[0], {
      type: "header",
      parameters: [{ type: "text", text: "Haji Usman" }],
    })
  })

  it("throws when media header has no media URL and no media ID", () => {
    const badTemplate: TemplateDefinition = {
      headerType: "IMAGE",
      bodyText: "No media provided",
    }
    assert.throws(() => {
      buildSendComponents(badTemplate, {})
    }, /Media header/)
  })

  it("throws when text header with variable has no headerText supplied", () => {
    const badTextHeader: TemplateDefinition = {
      headerType: "TEXT",
      headerContent: "Salam {{1}}",
      bodyText: "Body text",
    }
    assert.throws(() => {
      buildSendComponents(badTextHeader, {})
    }, /Header text variable/)
  })

  it("assembles positional body parameters in numerical order", () => {
    const template: TemplateDefinition = {
      bodyText: "Salam {{1}}, your package {{2}} is confirmed on {{3}}.",
    }
    const params: SendTimeParams = {
      body: ["Ubaid", "ART-AM-21D-01", "2026-11-20"],
    }
    const components = buildSendComponents(template, params)

    assert.deepEqual(components, [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Ubaid" },
          { type: "text", text: "ART-AM-21D-01" },
          { type: "text", text: "2026-11-20" },
        ],
      },
    ])
  })

  it("assembles named body parameters with parameter_name set", () => {
    const template: TemplateDefinition = {
      bodyText:
        "Salam {{customer_name}}, your booking reference is {{booking_ref}}.",
    }
    const params: SendTimeParams = {
      body: ["ART-BOOK-99", "Haji Tariq"],
    }
    const components = buildSendComponents(template, params)

    assert.deepEqual(components, [
      {
        type: "body",
        parameters: [
          { type: "text", text: "ART-BOOK-99", parameter_name: "booking_ref" },
          { type: "text", text: "Haji Tariq", parameter_name: "customer_name" },
        ],
      },
    ])
  })

  it("throws when fewer body parameter values are provided than required", () => {
    const template: TemplateDefinition = {
      bodyText: "Hello {{1}} and {{2}}",
    }
    assert.throws(() => {
      buildSendComponents(template, { body: ["Only one parameter"] })
    }, /requires 2 variables/)
  })

  it("builds dynamic URL button and copy code button components", () => {
    const template: TemplateDefinition = {
      bodyText: "Track your application and redeem discount below:",
      buttons: [
        {
          type: "URL",
          text: "Track Status",
          url: "https://alramlahtravels.com/track/{{1}}",
        },
        {
          type: "COPY_CODE",
          text: "Copy Coupon",
          code: "DEFAULT2026",
        },
      ],
    }
    const params: SendTimeParams = {
      buttonParams: {
        0: "APP-987654",
        1: "SPECIAL50",
      },
    }
    const components = buildSendComponents(template, params)

    assert.deepEqual(components, [
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: "APP-987654" }],
      },
      {
        type: "button",
        sub_type: "copy_code",
        index: "1",
        parameters: [{ type: "coupon_code", coupon_code: "SPECIAL50" }],
      },
    ])
  })

  it("throws when dynamic URL button has no parameter in buttonParams", () => {
    const template: TemplateDefinition = {
      bodyText: "Track application",
      buttons: [
        {
          type: "URL",
          text: "Track",
          url: "https://alramlahtravels.com/track/{{1}}",
        },
      ],
    }
    assert.throws(() => {
      buildSendComponents(template, {})
    }, /has a dynamic variable/)
  })
})

describe("Shared Isomorphic formatWhatsAppPhone Utility", () => {
  it("formats Pakistani local 03xx 11-digit numbers into 923xx E.164 digits", () => {
    assert.equal(formatWhatsAppPhone("03274029701"), "923274029701")
    assert.equal(formatWhatsAppPhone("0300-1234567"), "923001234567")
    assert.equal(formatWhatsAppPhone("(0319) 0462638"), "923190462638")
  })

  it("strips leading 00 from international numbers", () => {
    assert.equal(formatWhatsAppPhone("00923274029701"), "923274029701")
    assert.equal(formatWhatsAppPhone("00966501234567"), "966501234567")
  })

  it("handles numbers already starting with country code or plus", () => {
    assert.equal(formatWhatsAppPhone("+92 327 4029701"), "923274029701")
    assert.equal(formatWhatsAppPhone("923001234567"), "923001234567")
    assert.equal(formatWhatsAppPhone("+966501234567"), "966501234567")
  })

  it("handles null, undefined, and empty string safely", () => {
    assert.equal(formatWhatsAppPhone(""), "")
    assert.equal(formatWhatsAppPhone(null), "")
    assert.equal(formatWhatsAppPhone(undefined), "")
  })
})
