import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseEnv } from "../../../lib/env"

const VALID_PROD_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://neondb_owner:strong_secret@ep-calm-pond.ap-southeast-1.aws.neon.tech/alramlah?sslmode=require",
  DATABASE_URL_POOLED:
    "postgresql://neondb_owner:strong_secret@ep-calm-pond-pooler.ap-southeast-1.aws.neon.tech/alramlah?sslmode=require",
  BETTER_AUTH_SECRET: "9f8e7d6c5b4a3928172635445566778899aabbccddeeff001122334455667788",
  BETTER_AUTH_URL: "https://alramlahtravels.com",
  NEXT_PUBLIC_APP_URL: "https://alramlahtravels.com",
  ENCRYPTION_KEY:
    "a3f1c8904b2d7e615098bcdef1234567890abcdef1234567890abcdef9876543",
  R2_ACCOUNT_ID: "cf_acct_123",
  R2_ACCESS_KEY_ID: "r2_key_123",
  R2_SECRET_ACCESS_KEY: "r2_secret_456",
  R2_BUCKET_NAME: "al-ramlah-assets",
  TRIGGER_SECRET_KEY: "tr_prod_live_key_example",
  GOTENBERG_API_URL: "https://gotenberg.alramlahtravels.com",
  GOTENBERG_API_KEY: "gtb_secret_token_live",
  META_APP_SECRET: "meta_app_secret_live_value",
  GEMINI_API_KEY: "AIzaSyExampleKeyForValidationTest12345",
}

describe("F-PLAT: Fail-Closed Environment Validation (T-003)", () => {
  it("accepts a complete production environment and unifies GEMINI_API_KEY <-> GOOGLE_GENERATIVE_AI_API_KEY", () => {
    const parsed = parseEnv({
      ...VALID_PROD_ENV,
      TIKTOK_DIRECT_POST_APPROVED: "true",
      GBP_API_APPROVED: "false",
    })

    assert.equal(parsed.NEXT_PUBLIC_APP_URL, "https://alramlahtravels.com")
    assert.equal(
      parsed.GOOGLE_GENERATIVE_AI_API_KEY,
      "AIzaSyExampleKeyForValidationTest12345"
    )
    assert.equal(
      parsed.GEMINI_API_KEY,
      "AIzaSyExampleKeyForValidationTest12345"
    )
    assert.equal(parsed.TIKTOK_DIRECT_POST_ENABLED, true)
    assert.equal(parsed.GBP_API_ENABLED, false)
  })

  it("hard-blocks SKIP_ENV_VALIDATION in production", () => {
    assert.throws(
      () =>
        parseEnv({
          ...VALID_PROD_ENV,
          SKIP_ENV_VALIDATION: "1",
        }),
      /SKIP_ENV_VALIDATION is strictly forbidden/
    )
  })

  it("rejects localhost URLs, placeholder secrets, dummy hex keys, and WHATSAPP_MOCK_MODE in production", () => {
    assert.throws(
      () =>
        parseEnv({
          ...VALID_PROD_ENV,
          NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        }),
      /NEXT_PUBLIC_APP_URL must be an explicit non-localhost https/
    )

    assert.throws(
      () =>
        parseEnv({
          ...VALID_PROD_ENV,
          BETTER_AUTH_SECRET: "replace-with-openssl-rand-base64-32-value",
        }),
      /BETTER_AUTH_SECRET matches a known placeholder/
    )

    assert.throws(
      () =>
        parseEnv({
          ...VALID_PROD_ENV,
          ENCRYPTION_KEY:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        }),
      /ENCRYPTION_KEY matches a known test\/dummy key/
    )

    assert.throws(
      () =>
        parseEnv({
          ...VALID_PROD_ENV,
          WHATSAPP_MOCK_MODE: "true",
        }),
      /WHATSAPP_MOCK_MODE cannot be enabled in production/
    )
  })

  it("supports hermetic defaults when NODE_ENV === 'test'", () => {
    const testParsed = parseEnv({ NODE_ENV: "test" })
    assert.equal(testParsed.NODE_ENV, "test")
    assert.match(testParsed.DATABASE_URL, /^postgresql:\/\//)
  })
})
