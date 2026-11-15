import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
import { eq, inArray } from "drizzle-orm"
import { NextRequest } from "next/server"
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external"
import type { WorkStore } from "next/dist/server/app-render/work-async-storage.external"
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external"
import type { RequestStore } from "next/dist/server/app-render/work-unit-async-storage.external"
import { HeadersAdapter } from "next/dist/server/web/spec-extension/adapters/headers"
import {
  MutableRequestCookiesAdapter,
  RequestCookiesAdapter,
} from "next/dist/server/web/spec-extension/adapters/request-cookies"
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies"

import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { provisionStaffAccountInternal } from "../../../lib/auth"
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import { GET as oauthInitGet } from "../../../app/api/oauth/social/[provider]/route"
import { GET as oauthCallbackGet } from "../../../app/api/oauth/social/[provider]/callback/route"
import { GET as composioCallbackGet } from "../../../app/api/oauth/social/[provider]/composio-callback/route"
import {
  createSignedOAuthState,
  OAuthConfigError,
  resolveValidatedOAuthAppOrigin,
  verifySignedOAuthState,
} from "../../../lib/social/oauth-state"
import { decryptToken, encryptToken } from "../../../lib/social/crypto"
import { selectSocialAccountCandidateAction } from "../../../app/actions/social-scheduler"

if (process.env.NODE_ENV === "test") {
  for (const key of [
    "R2_ACCOUNT_ID",
    "R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_API_TOKEN",
    "META_APP_SECRET",
    "TRIGGER_SECRET_KEY",
    "OPENROUTER_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "OPENAI_API_KEY",
    "FACEBOOK_CLIENT_SECRET",
    "TIKTOK_CLIENT_SECRET",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "COMPOSIO_API_KEY",
  ]) {
    process.env[key] = ""
  }
}
assertAuditSafeEnvironment()

async function signInAndExtractCookie(
  email: string,
  password: string
): Promise<string> {
  const req = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 10}`,
    },
    body: JSON.stringify({ email, password }),
  })
  const res = await authPostHandler(req)
  assert.equal(res.status, 200)
  return res.headers
    .getSetCookie()
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

async function runInRequestContext<T>(
  cookieHeader: string,
  pathname: string,
  fn: () => Promise<T>
): Promise<T> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": "203.0.113.88",
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})

  const workStore = {
    page: pathname,
    route: pathname,
    incrementalCache: {} as WorkStore["incrementalCache"],
    cacheLifeProfiles: {} as WorkStore["cacheLifeProfiles"],
    useCacheTimeout: 300_000,
    durableUseCacheEntries: false,
    staticPageGenerationTimeout: 60,
    afterContext: undefined as unknown as WorkStore["afterContext"],
    previouslyRevalidatedTags: [],
    pendingRevalidatedTags: [],
    requestStartTime: performance.timeOrigin + performance.now(),
    refreshTagsByCacheKind: new Map(),
    shouldTrackFetchMetrics: false,
    clientComponentLoadTracker: undefined,
  } as unknown as WorkStore

  const requestStore: RequestStore = {
    type: "request",
    phase: "action",
    implicitTags: { tags: [], expirationsByCacheKind: new Map() },
    url: { pathname, search: "" },
    headers: sealedHeaders,
    cookies: sealedCookies,
    mutableCookies,
    userspaceMutableCookies: mutableCookies,
    draftMode: { isEnabled: false } as RequestStore["draftMode"],
    rootParams: {},
    resumeDataCache: null,
  }

  return workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, fn)
  )
}

describe("F-SOCIAL T-069 & OD-11: OAuth Route AuthZ, Constant-Time State HMAC, Vault Crypto & Non-Destructive Multi-Page Staging", () => {
  const createdUserIds: string[] = []
  const createdIntegrationIds: string[] = []

  after(async () => {
    if (createdIntegrationIds.length > 0) {
      await db
        .delete(schema.socialIntegrations)
        .where(inArray(schema.socialIntegrations.id, createdIntegrationIds))
    }
    if (createdUserIds.length > 0) {
      await db
        .delete(schema.session)
        .where(inArray(schema.session.userId, createdUserIds))
      await db
        .delete(schema.account)
        .where(inArray(schema.account.userId, createdUserIds))
      await db
        .delete(schema.user)
        .where(inArray(schema.user.id, createdUserIds))
    }
    await closeDatabasePool()
  })

  it("T-069a: blocks unauthenticated (401) and staff (403) requests across /api/oauth/social/[provider], /callback & /composio-callback before reading ?code", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const staffEmail = `oauth-staff-${suffix}@alramlahtravels.com`
    const staffPass = `StaffPass!${crypto.randomBytes(8).toString("hex")}`
    const staffUser = await provisionStaffAccountInternal({
      email: staffEmail,
      password: staffPass,
      name: "OAuth Staff",
      role: "staff",
      mustChangePassword: false,
    })
    createdUserIds.push(staffUser.id)
    const staffCookie = await signInAndExtractCookie(staffEmail, staffPass)

    const originalFetch = globalThis.fetch
    let outboundFetchCalled = false
    globalThis.fetch = async () => {
      outboundFetchCalled = true
      throw new Error("OAuth route MUST NOT make outbound calls before authz!")
    }

    try {
      const endpoints = [
        {
          label: "init",
          call: (req: NextRequest) =>
            oauthInitGet(req, {
              params: Promise.resolve({ provider: "facebook" }),
            }),
          url: "http://localhost:3000/api/oauth/social/facebook",
        },
        {
          label: "callback",
          call: (req: NextRequest) =>
            oauthCallbackGet(req, {
              params: Promise.resolve({ provider: "facebook" }),
            }),
          url: "http://localhost:3000/api/oauth/social/facebook/callback?code=attacker_code&state=forged",
        },
        {
          label: "composio-callback",
          call: (req: NextRequest) =>
            composioCallbackGet(req, {
              params: Promise.resolve({ provider: "facebook" }),
            }),
          url: "http://localhost:3000/api/oauth/social/facebook/composio-callback?connectedAccountId=ca_1&state=forged",
        },
      ]

      for (const ep of endpoints) {
        const unauthRes = await runInRequestContext(
          "",
          "/api/oauth/social/facebook",
          () => ep.call(new NextRequest(ep.url))
        )
        assert.equal(
          unauthRes.status,
          401,
          `Expected 401 on unauthenticated ${ep.label}`
        )

        const staffRes = await runInRequestContext(
          staffCookie,
          "/api/oauth/social/facebook",
          () => ep.call(new NextRequest(ep.url))
        )
        assert.equal(
          staffRes.status,
          403,
          `Expected 403 on non-super_admin ${ep.label}`
        )
      }

      assert.equal(outboundFetchCalled, false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("T-069b: enforces HTTPS NEXT_PUBLIC_APP_URL in production and constant-time HMAC state verification", () => {
    const prevNodeEnv = process.env.NODE_ENV
    const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL
    const mutableEnv = process.env as Record<string, string | undefined>

    try {
      mutableEnv.NODE_ENV = "production"

      mutableEnv.NEXT_PUBLIC_APP_URL = ""
      assert.throws(
        () => resolveValidatedOAuthAppOrigin(),
        (err: unknown) => err instanceof OAuthConfigError
      )

      mutableEnv.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
      assert.throws(
        () => resolveValidatedOAuthAppOrigin(),
        (err: unknown) => err instanceof OAuthConfigError
      )

      mutableEnv.NEXT_PUBLIC_APP_URL = "https://alramlahtravels.com/"
      assert.equal(
        resolveValidatedOAuthAppOrigin(),
        "https://alramlahtravels.com"
      )
    } finally {
      mutableEnv.NODE_ENV = prevNodeEnv
      mutableEnv.NEXT_PUBLIC_APP_URL = prevAppUrl
    }

    const signed = createSignedOAuthState({
      provider: "facebook",
      actorUserId: "super_admin_1",
    })
    const verified = verifySignedOAuthState({
      stateParam: signed,
      cookieState: signed,
      provider: "facebook",
      actorUserId: "super_admin_1",
    })
    assert.equal(verified, true)

    // Tampered HMAC signature rejected
    const tampered = `${signed.slice(0, -4)}ffff`
    assert.equal(
      verifySignedOAuthState({
        stateParam: tampered,
        cookieState: tampered,
        provider: "facebook",
        actorUserId: "super_admin_1",
      }),
      false
    )

    // Cross-user CSRF replay rejected
    assert.equal(
      verifySignedOAuthState({
        stateParam: signed,
        cookieState: signed,
        provider: "facebook",
        actorUserId: "different_admin_2",
      }),
      false
    )
  })

  it("T-069c: delegates lib/social/crypto.ts to v2 HKDF-SHA256 vault while preserving legacy 3-part token decryption", () => {
    const freshCipher = encryptToken("EAAB_live_page_token_998877")
    assert.ok(
      freshCipher.startsWith("v2:"),
      `Expected v2 vault envelope, got ${freshCipher.slice(0, 10)}`
    )
    assert.equal(decryptToken(freshCipher), "EAAB_live_page_token_998877")

    // Construct a legacy pre-W3 `<ivHex>:<tagHex>:<ctHex>` ciphertext using raw ENCRYPTION_KEY
    const rawHex = process.env.ENCRYPTION_KEY!
    const rawKey = Buffer.from(rawHex, "hex")
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv("aes-256-gcm", rawKey, iv)
    const ct = Buffer.concat([
      cipher.update("legacy_meta_token_v1", "utf8"),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()
    const legacyPayload = `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`

    assert.equal(decryptToken(legacyPayload), "legacy_meta_token_v1")
  })

  it("T-069d: stages multi-page OAuth candidates in pending:<uuid> without overwriting an existing ACTIVE Page integration", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const adminEmail = `oauth-admin-${suffix}@alramlahtravels.com`
    const adminPass = `AdminPass!${crypto.randomBytes(8).toString("hex")}`
    const adminUser = await provisionStaffAccountInternal({
      email: adminEmail,
      password: adminPass,
      name: "OAuth Super Admin",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(adminUser.id)
    const adminCookie = await signInAndExtractCookie(adminEmail, adminPass)

    const pageAId = `fb_page_a_${suffix}`
    const pageBId = `fb_page_b_${suffix}`

    // Seed existing ACTIVE Page A integration
    const [existingPageA] = await db
      .insert(schema.socialIntegrations)
      .values({
        internalAccountId: pageAId,
        provider: "facebook",
        name: "Al Ramlah Lahore Page A",
        handle: "Al Ramlah Page A",
        encryptedAccessToken: encryptToken("page_a_original_token"),
        status: "ACTIVE",
        isActive: true,
        metadata: { pageId: pageAId },
      })
      .returning()
    assert.ok(existingPageA)
    createdIntegrationIds.push(existingPageA.id)

    const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL
    const prevFbId = process.env.FACEBOOK_CLIENT_ID
    const prevFbSecret = process.env.FACEBOOK_CLIENT_SECRET
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
    process.env.FACEBOOK_CLIENT_ID = "fb_client_test"
    process.env.FACEBOOK_CLIENT_SECRET = "fb_secret_test"

    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async (input) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.includes("/v21.0/oauth/access_token")) {
          return new Response(
            JSON.stringify({
              access_token: "user_token_multi_page",
              expires_in: 5_184_000,
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        if (url.includes("/v21.0/me/accounts")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: pageAId,
                  name: "Al Ramlah Lahore Page A",
                  access_token: "page_a_token_new",
                },
                {
                  id: pageBId,
                  name: "Al Ramlah VIP Umrah Page B",
                  access_token: "page_b_token_fresh",
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        throw new Error(`Unexpected OAuth fetch URL: ${url}`)
      }

      const validState = createSignedOAuthState({
        provider: "facebook",
        actorUserId: adminUser.id,
      })
      const fullCookie = `${adminCookie}; social_oauth_state_facebook=${validState}`
      const callbackUrl = `http://localhost:3000/api/oauth/social/facebook/callback?code=valid_code_123&state=${encodeURIComponent(validState)}`

      const cbRes = await runInRequestContext(
        fullCookie,
        "/api/oauth/social/facebook/callback",
        () =>
          oauthCallbackGet(
            new NextRequest(callbackUrl, {
              headers: { cookie: fullCookie },
            }),
            { params: Promise.resolve({ provider: "facebook" }) }
          )
      )

      assert.equal(cbRes.status, 307)
      const redirectLoc = cbRes.headers.get("location") || ""
      assert.match(redirectLoc, /oauth_select=facebook/)
      const pendingId = new URL(redirectLoc).searchParams.get("integrationId")
      assert.ok(pendingId, "Expected pending staging integration ID in redirect")
      createdIntegrationIds.push(pendingId)

      // Verify Page A remained ACTIVE & untouched while pending row staged candidates!
      const [reloadedPageA] = await db
        .select()
        .from(schema.socialIntegrations)
        .where(eq(schema.socialIntegrations.id, existingPageA.id))
      assert.equal(reloadedPageA?.isActive, true)
      assert.equal(
        decryptToken(reloadedPageA!.encryptedAccessToken),
        "page_a_original_token"
      )

      // Now select Page B from the pending row -> Page B becomes ACTIVE alongside Page A!
      const selectRes = await runInRequestContext(
        adminCookie,
        "/admin/settings",
        () =>
          selectSocialAccountCandidateAction({
            integrationId: pendingId,
            internalAccountId: pageBId,
          })
      )
      assert.equal(selectRes.success, true)
      if (selectRes.integrationId) {
        createdIntegrationIds.push(selectRes.integrationId)
      }

      const bothPages = await db
        .select()
        .from(schema.socialIntegrations)
        .where(
          inArray(schema.socialIntegrations.internalAccountId, [
            pageAId,
            pageBId,
          ])
        )
      assert.equal(bothPages.length, 2)
      assert.ok(bothPages.every((p) => p.isActive === true))
    } finally {
      globalThis.fetch = originalFetch
      process.env.NEXT_PUBLIC_APP_URL = prevAppUrl
      process.env.FACEBOOK_CLIENT_ID = prevFbId
      process.env.FACEBOOK_CLIENT_SECRET = prevFbSecret
    }
  })
})
