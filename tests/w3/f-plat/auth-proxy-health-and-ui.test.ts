import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { eq } from "drizzle-orm"
import { NextRequest } from "next/server"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { auth, provisionStaffAccountInternal } from "../../../lib/auth"
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import { GET as healthGetHandler } from "../../../app/api/health/route"
import {
  clearSentMailOutboxForTests,
  getSentMailOutboxForTests,
} from "../../../lib/security/mailer"
import { proxy } from "../../../proxy"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, "../../..")

function oklchToRelativeLuminance(l: number, c: number, hDeg: number): number {
  const hRad = (hDeg * Math.PI) / 180
  const a = c * Math.cos(hRad)
  const b = c * Math.sin(hRad)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  const clampLinear = (v: number) => Math.max(0, Math.min(1, v))
  const rLin = clampLinear(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3)
  const gLin = clampLinear(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3)
  const bLin = clampLinear(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3)

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin
}

function contrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

describe("F-PLAT: Auth Lockdown, Proxy Security Headers, Health Probe & WCAG Light Theme (T-004, T-043..T-047, T-094)", () => {
  after(async () => {
    await closeDatabasePool()
  })

  it("T-004: blocks anonymous POST /api/auth/sign-up/email with HTTP 403 and creates zero rogue users", async () => {
    const rogueEmail = `attacker-${crypto.randomBytes(4).toString("hex")}@evil.example`
    const req = new NextRequest("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        email: rogueEmail,
        password: "AttackerPassword123!",
        name: "Rogue Self-Registered Admin",
      }),
    })

    const res = await authPostHandler(req)
    assert.equal(res.status, 403)
    const body = (await res.json()) as { code?: string }
    assert.equal(body.code, "SIGN_UP_DISABLED")

    const inDb = await db.query.user.findFirst({
      where: eq(schema.user.email, rogueEmail),
    })
    assert.equal(inDb, undefined)
  })

  it("T-004 & T-043: enforces live isActive check on sign-in and dispatches password-reset link via mailer", async () => {
    const tempEmail = `test-staff-${crypto.randomBytes(4).toString("hex")}@alramlahtravels.com`
    const tempPassword = `TempPass!${crypto.randomBytes(8).toString("hex")}`

    const provisioned = await provisionStaffAccountInternal({
      email: tempEmail,
      password: tempPassword,
      name: "Test Consultant",
      role: "staff",
      mustChangePassword: true,
    })

    try {
      clearSentMailOutboxForTests()

      const resetReq = new NextRequest(
        "http://localhost:3000/api/auth/request-password-reset",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
          },
          body: JSON.stringify({
            email: tempEmail,
            redirectTo: "http://localhost:3000/admin/login",
          }),
        }
      )

      const resetRes = await authPostHandler(resetReq)
      assert.equal(resetRes.status, 200)
      const outbox = getSentMailOutboxForTests()
      assert.equal(outbox.length, 1)
      assert.ok(outbox[0]!.html.includes("/reset-password/"))

      // Deactivate user in DB -> sign-in session creation must be rejected by databaseHooks.session.create.before
      await db
        .update(schema.user)
        .set({ isActive: false })
        .where(eq(schema.user.id, provisioned.id))

      await assert.rejects(
        () =>
          auth.api.signInEmail({
            body: {
              email: tempEmail,
              password: tempPassword,
            },
          }),
        (err: unknown) => err instanceof Error
      )
    } finally {
      await db
        .delete(schema.session)
        .where(eq(schema.session.userId, provisioned.id))
      await db
        .delete(schema.account)
        .where(eq(schema.account.userId, provisioned.id))
      await db
        .delete(schema.user)
        .where(eq(schema.user.id, provisioned.id))
    }
  })

  it("T-044, T-046 & T-047: proxy() sets CSP/HSTS/XFO/nosniff/X-Robots-Tag and preserves session cookie on GET /admin/login?session_expired=1", () => {
    const publicReq = new NextRequest("https://alramlahtravels.com/")
    const publicRes = proxy(publicReq)
    assert.match(
      publicRes.headers.get("Content-Security-Policy") ?? "",
      /default-src 'self'/
    )
    assert.match(
      publicRes.headers.get("Content-Security-Policy") ?? "",
      /frame-ancestors 'none'/
    )
    assert.match(
      publicRes.headers.get("Strict-Transport-Security") ?? "",
      /max-age=63072000/
    )
    assert.equal(publicRes.headers.get("X-Frame-Options"), "DENY")
    assert.equal(publicRes.headers.get("X-Content-Type-Options"), "nosniff")
    assert.equal(publicRes.headers.get("X-Robots-Tag"), null)

    const unauthAdminReq = new NextRequest(
      "https://alramlahtravels.com/admin/desk"
    )
    const unauthAdminRes = proxy(unauthAdminReq)
    assert.equal(unauthAdminRes.status, 307)
    assert.equal(
      unauthAdminRes.headers.get("X-Robots-Tag"),
      "noindex, nofollow, noarchive, nosnippet"
    )
    assert.match(
      unauthAdminRes.headers.get("location") ?? "",
      /\/admin\/login\?callbackUrl=%2Fadmin%2Fdesk/
    )

    // Forced-logout gadget regression check (T-047): GET /admin/login?session_expired=1 must NOT delete cookies
    const sessionExpiredReq = new NextRequest(
      "https://alramlahtravels.com/admin/login?session_expired=1",
      {
        headers: {
          cookie: "__Secure-better-auth.session_token=valid_live_token_value",
        },
      }
    )
    const sessionExpiredRes = proxy(sessionExpiredReq)
    assert.equal(sessionExpiredRes.status, 200)
    const setCookieHeader = sessionExpiredRes.headers.get("set-cookie") ?? ""
    assert.ok(
      !setCookieHeader.includes("Max-Age=0") &&
        !setCookieHeader.includes("session_token=;"),
      "proxy.ts must never clear live session cookies on GET /admin/login?session_expired=1"
    )
  })

  it("T-045: GET /api/health serves public liveness (200) and gates ?deep=1 behind bearer authorization", async () => {
    const shallowRes = await healthGetHandler(
      new NextRequest("http://localhost:3000/api/health")
    )
    assert.equal(shallowRes.status, 200)
    const shallowBody = (await shallowRes.json()) as {
      status: string
      mode: string
    }
    assert.equal(shallowBody.status, "ok")
    assert.equal(shallowBody.mode, "liveness")

    const unauthDeepRes = await healthGetHandler(
      new NextRequest("http://localhost:3000/api/health?deep=1")
    )
    assert.equal(unauthDeepRes.status, 401)

    const prevToken = process.env.HEALTHCHECK_BEARER_TOKEN
    process.env.HEALTHCHECK_BEARER_TOKEN = "hc_bearer_secret_token_for_test_12345"
    try {
      const authDeepRes = await healthGetHandler(
        new NextRequest("http://localhost:3000/api/health?deep=1", {
          headers: {
            Authorization: "Bearer hc_bearer_secret_token_for_test_12345",
          },
        })
      )
      assert.equal(authDeepRes.status, 200)
      const deepBody = (await authDeepRes.json()) as {
        status: string
        checks: { database: { status: string } }
      }
      assert.equal(deepBody.status, "ok")
      assert.equal(deepBody.checks.database.status, "ok")
    } finally {
      if (prevToken === undefined) {
        delete process.env.HEALTHCHECK_BEARER_TOKEN
      } else {
        process.env.HEALTHCHECK_BEARER_TOKEN = prevToken
      }
    }
  })

  it("T-046 & T-094: locks single light theme in globals.css, meets WCAG 2.2 AA contrast ratios, provides error boundaries, and avoids duplicate title suffix", () => {
    const css = fs.readFileSync(
      path.join(WEB_ROOT, "app/globals.css"),
      "utf8"
    )
    assert.match(css, /@custom-variant dark \(&:where\(\.never-dark \*\)\);/)
    assert.match(css, /color-scheme:\s*light;/)
    assert.match(css, /--font-serif:\s*var\(--font-display\);/)
    assert.match(css, /font-variant-numeric:\s*tabular-nums;/)
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)

    // Mathematical WCAG 2.2 AA contrast verification against Warm Ivory --background oklch(0.975 0.012 85) & White --card oklch(1 0 0)
    const bgLum = oklchToRelativeLuminance(0.975, 0.012, 85)
    const cardLum = oklchToRelativeLuminance(1, 0, 0)
    const mutedFgLum = oklchToRelativeLuminance(0.42, 0.025, 150)
    const goldTextLum = oklchToRelativeLuminance(0.46, 0.11, 80)
    const inputBorderLum = oklchToRelativeLuminance(0.62, 0.025, 85)

    assert.ok(
      contrastRatio(bgLum, mutedFgLum) >= 4.5,
      `Expected --muted-foreground contrast >= 4.5:1 on ivory, got ${contrastRatio(bgLum, mutedFgLum).toFixed(2)}`
    )
    assert.ok(
      contrastRatio(bgLum, goldTextLum) >= 4.5,
      `Expected --gold-text contrast >= 4.5:1 on ivory, got ${contrastRatio(bgLum, goldTextLum).toFixed(2)}`
    )
    assert.ok(
      contrastRatio(bgLum, inputBorderLum) >= 3.0 &&
        contrastRatio(cardLum, inputBorderLum) >= 3.0,
      `Expected --input border contrast >= 3.0:1 on ivory & white card`
    )

    assert.equal(fs.existsSync(path.join(WEB_ROOT, "app/error.tsx")), true)
    assert.equal(
      fs.existsSync(path.join(WEB_ROOT, "app/global-error.tsx")),
      true
    )
    assert.equal(fs.existsSync(path.join(WEB_ROOT, "app/not-found.tsx")), true)

    const loginPageSrc = fs.readFileSync(
      path.join(WEB_ROOT, "app/admin/(auth)/login/page.tsx"),
      "utf8"
    )
    assert.ok(
      !loginPageSrc.includes("dark:"),
      "login/page.tsx must contain zero dark:* utility classes"
    )

    const layoutSrc = fs.readFileSync(
      path.join(WEB_ROOT, "app/layout.tsx"),
      "utf8"
    )
    assert.match(
      layoutSrc,
      /template:\s*"%s(?:\s*\|\s*Al Ramlah Travels)?"/,
      "Root metadata title template must be canonical"
    )
    assert.match(
      layoutSrc,
      /colorScheme:\s*"light"/,
      "Root layout viewport must lock colorScheme to light"
    )
  })
})
