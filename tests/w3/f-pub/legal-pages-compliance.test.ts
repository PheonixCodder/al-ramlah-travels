import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import { closeDatabasePool } from "../../../db"
import PrivacyPolicyPage from "../../../app/(public)/privacy/page"

describe("F-PUB T-020 (OD-06): /privacy Sub-Processors, ZDR AI, Private R2, Retention TTLs, STOP Opt-Out & DSAR", () => {
  after(async () => {
    await closeDatabasePool()
  })

  it("renders truthful /privacy disclosures matching OD-06 and actual sub-processors without contradicting third-party claims", async () => {
    const element = await PrivacyPolicyPage()
    const html = renderToStaticMarkup(element)

    // 1. ZDR AI disclosure (OpenRouter data_collection: "deny" + Google Gemini API)
    assert.match(html, /Zero[- ]Data[- ]Retention/i)
    assert.match(html, /data_collection:\s*&quot;deny&quot;|data_collection:\s*"deny"/i)
    assert.match(html, /OpenRouter/i)

    // 2. Private Cloudflare R2 storage & Neon PostgreSQL & Gotenberg sub-processors
    assert.match(html, /Cloudflare R2/i)
    assert.match(html, /Neon Serverless PostgreSQL/i)
    assert.match(html, /Gotenberg/i)

    // 3. Better Auth & OAuth CSRF state cookies
    assert.match(html, /better-auth/i)
    assert.match(html, /HttpOnly/i)

    // 4. OD-06 retention schedules: 60 days post-return passports, 24 months unbooked leads, 6 years tax/financial ledgers
    assert.match(html, /60 days/i)
    assert.match(html, /24 months/i)
    assert.match(html, /6 years/i)

    // 5. Meta WhatsApp Cloud API & STOP / UNSUBSCRIBE opt-out
    assert.match(html, /WhatsApp Cloud API/i)
    assert.match(html, /STOP/)
    assert.match(html, /UNSUBSCRIBE/)

    // 6. DSAR contact workflow & valid E.164 wa.me link
    assert.match(html, /Data Subject Access/i)
    assert.match(html, /https:\/\/wa\.me\/92/)
    assert.ok(!html.includes("we never share data with any third party"))
  })
})
