import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
import { inArray } from "drizzle-orm"
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
import AdminSettingsPage from "../../../app/admin/(dashboard)/settings/page"
import {
  maskSecretLast4,
  projectSafeLinkedDeviceDto,
  projectSafeSocialIntegrationDto,
  projectSafeWhatsappAccountDto,
  sanitizeSocialIntegrationMetadataForClient,
} from "../../../components/admin/settings/safe-settings-dto"

if (process.env.NODE_ENV === "test") {
  for (const key of [
    "OPENROUTER_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "OPENAI_API_KEY",
    "COMPOSIO_API_KEY",
  ]) {
    process.env[key] = ""
  }
}
assertAuditSafeEnvironment()

async function signInAndExtractCookie(email: string, password: string): Promise<string> {
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
  assert.equal(res.status, 200, `Expected 200 on sign-in for ${email}`)
  const setCookieHeaders = res.headers.getSetCookie()
  assert.ok(setCookieHeaders.length > 0, "Expected Better Auth session Set-Cookie")
  return setCookieHeaders
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

async function runInNextRenderContext<T>(
  cookieHeader: string,
  fn: () => Promise<T>
): Promise<T> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": "127.0.0.1",
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies)

  const workStore = {
    page: "/admin/(dashboard)/settings/page",
    route: "/admin/settings",
    incrementalCache: {} as WorkStore["incrementalCache"],
    cacheLifeProfiles: {},
    useCacheTimeout: 300_000,
    durableUseCacheEntries: false,
    staticPageGenerationTimeout: 60,
    afterContext: undefined as unknown as WorkStore["afterContext"],
    previouslyRevalidatedTags: [],
    requestStartTime: performance.timeOrigin + performance.now(),
    refreshTagsByCacheKind: new Map(),
    shouldTrackFetchMetrics: false,
    clientComponentLoadTracker: undefined,
  } satisfies WorkStore

  const requestStore = {
    type: "request",
    phase: "render",
    implicitTags: { tags: [], expirationsByCacheKind: new Map() },
    url: { pathname: "/admin/settings", search: "?tab=waba" },
    headers: sealedHeaders,
    cookies: sealedCookies,
    mutableCookies,
    userspaceMutableCookies: mutableCookies,
    draftMode: { isEnabled: false } as RequestStore["draftMode"],
    rootParams: {},
    resumeDataCache: null,
  } satisfies RequestStore

  return workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, fn)
  )
}

describe("F-ADMIN T-038: Settings Hub Secret & Ciphertext Redaction", () => {
  const createdUserIds: string[] = []
  const createdWhatsappAccountIds: string[] = []
  const createdSocialIntegrationIds: string[] = []

  after(async () => {
    if (createdSocialIntegrationIds.length > 0) {
      await db
        .delete(schema.socialIntegrations)
        .where(inArray(schema.socialIntegrations.id, createdSocialIntegrationIds))
    }
    if (createdWhatsappAccountIds.length > 0) {
      await db
        .delete(schema.whatsappAccounts)
        .where(inArray(schema.whatsappAccounts.id, createdWhatsappAccountIds))
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

  it("T-038a: DTO projectors strip encrypted tokens, nested OAuth candidate tokens, Baileys auth keys, and plaintext verify tokens", () => {
    const rawMeta = {
      businessId: "biz-12345",
      encryptedPageAccessToken: "ENC_PAGE_TOKEN_SUPER_SECRET_999",
      oauthClientSecretDigest: "RAW_SECRET_VALUE_ABC",
      pendingCandidates: [
        {
          provider: "facebook",
          internalAccountId: "page-777",
          name: "Al Ramlah Official Page",
          handle: "@alramlahtravels",
          avatarUrl: "https://example.com/avatar.jpg",
          encryptedAccessToken: "ENC_CANDIDATE_ACCESS_TOKEN_LEAK_ME_NOT",
          encryptedRefreshToken: "ENC_CANDIDATE_REFRESH_TOKEN_LEAK_ME_NOT",
        },
      ],
    }

    const sanitizedMeta = sanitizeSocialIntegrationMetadataForClient(rawMeta)
    const serializedMeta = JSON.stringify(sanitizedMeta)
    assert.ok(!serializedMeta.includes("ENC_PAGE_TOKEN_SUPER_SECRET_999"))
    assert.ok(!serializedMeta.includes("RAW_SECRET_VALUE_ABC"))
    assert.ok(!serializedMeta.includes("ENC_CANDIDATE_ACCESS_TOKEN_LEAK_ME_NOT"))
    assert.ok(!serializedMeta.includes("ENC_CANDIDATE_REFRESH_TOKEN_LEAK_ME_NOT"))
    assert.equal(sanitizedMeta.hasPageAccessToken, true)
    assert.equal(sanitizedMeta.pendingCandidatesCount, 1)

    const safeSocial = projectSafeSocialIntegrationDto({
      id: crypto.randomUUID(),
      provider: "instagram",
      name: "Al Ramlah IG",
      handle: "@alramlah",
      avatarUrl: null,
      internalAccountId: "ig-888",
      status: "PENDING_SELECTION",
      isActive: true,
      tokenExpiresAt: new Date(),
      scopes: ["instagram_basic"],
      metadata: rawMeta,
      lastSyncedAt: null,
      createdAt: new Date(),
      encryptedAccessToken: "AES256GCM_SOCIAL_ACCESS_CIPHERTEXT_111",
      encryptedRefreshToken: "AES256GCM_SOCIAL_REFRESH_CIPHERTEXT_222",
    })

    const serializedSocial = JSON.stringify(safeSocial)
    assert.ok(!serializedSocial.includes("AES256GCM_SOCIAL_ACCESS_CIPHERTEXT_111"))
    assert.ok(!serializedSocial.includes("AES256GCM_SOCIAL_REFRESH_CIPHERTEXT_222"))
    assert.equal(safeSocial.hasAccessToken, true)
    assert.equal(safeSocial.hasRefreshToken, true)
    assert.equal("encryptedAccessToken" in safeSocial, false)
    assert.equal("encryptedRefreshToken" in safeSocial, false)

    const safeWaba = projectSafeWhatsappAccountDto({
      id: crypto.randomUUID(),
      name: "Primary WABA",
      phoneNumberId: "9988776655",
      wabaId: "waba-554433",
      displayPhoneNumber: "+92 327 4029701",
      verifiedName: "Al Ramlah Travels",
      qualityRating: "GREEN",
      messagingLimit: "TIER_1K",
      encryptedAccessToken: "AES256GCM_WABA_BEARER_CIPHERTEXT_333",
      webhookVerifyToken: "PLAIN_WEBHOOK_VERIFY_SECRET_X9Z8",
      isActive: true,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const serializedWaba = JSON.stringify(safeWaba)
    assert.ok(!serializedWaba.includes("AES256GCM_WABA_BEARER_CIPHERTEXT_333"))
    assert.ok(!serializedWaba.includes("PLAIN_WEBHOOK_VERIFY_SECRET_X9Z8"))
    assert.equal(safeWaba.hasAccessToken, true)
    assert.equal(safeWaba.hasVerifyToken, true)
    assert.equal(safeWaba.verifyTokenPreview, "••••••••X9Z8")
    assert.equal("webhookVerifyToken" in safeWaba, false)
    assert.equal("encryptedAccessToken" in safeWaba, false)

    const safeDevice = projectSafeLinkedDeviceDto({
      id: crypto.randomUUID(),
      sessionKey: "legacy-device",
      label: "Legacy Sunset Session",
      phoneNumber: "+923274029701",
      pushName: "Al Ramlah Desk",
      status: "disconnected",
      groupsSyncedCount: 0,
      lastError: null,
      lastConnectedAt: null,
      lastSyncedAt: null,
      encryptedAuthCreds: "BAILEYS_ENCRYPTED_AUTH_CREDS_444",
      encryptedAuthKeys: "BAILEYS_ENCRYPTED_AUTH_KEYS_555",
    })
    const serializedDevice = JSON.stringify(safeDevice)
    assert.ok(!serializedDevice.includes("BAILEYS_ENCRYPTED_AUTH_CREDS_444"))
    assert.ok(!serializedDevice.includes("BAILEYS_ENCRYPTED_AUTH_KEYS_555"))
    assert.equal(safeDevice.hasAuthCreds, true)
    assert.equal(safeDevice.hasAuthKeys, true)
    assert.equal(maskSecretLast4("short"), "••••••••")
    assert.equal(maskSecretLast4(""), null)
  })

  it("T-038b: AdminSettingsPage RSC renders safe props with zero leaked tokens or verify secrets from PostgreSQL rows", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const adminEmail = `f-admin-t038-${suffix}@alramlahtravels.com`
    const adminPassword = `FAdmin!${crypto.randomBytes(8).toString("hex")}`

    const adminUser = await provisionStaffAccountInternal({
      email: adminEmail,
      password: adminPassword,
      name: "F-ADMIN Secret Redaction Inspector",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(adminUser.id)

    const wabaAccessCanary = `CANARY_WABA_ENC_ACCESS_${suffix}_SECRET`
    const wabaVerifyCanary = `CANARY_WABA_VERIFY_${suffix}_9481`
    const socialAccessCanary = `CANARY_SOCIAL_ENC_ACCESS_${suffix}_SECRET`
    const socialRefreshCanary = `CANARY_SOCIAL_ENC_REFRESH_${suffix}_SECRET`
    const candidateTokenCanary = `CANARY_CANDIDATE_ENC_TOKEN_${suffix}_SECRET`
    const pageTokenCanary = `CANARY_PAGE_ENC_TOKEN_${suffix}_SECRET`

    const [insertedWaba] = await db
      .insert(schema.whatsappAccounts)
      .values({
        name: `F-ADMIN Test WABA ${suffix}`,
        phoneNumberId: `f-admin-pn-${suffix}`,
        wabaId: `f-admin-waba-${suffix}`,
        displayPhoneNumber: "+92 327 4029701",
        verifiedName: "Al Ramlah Audit WABA",
        encryptedAccessToken: wabaAccessCanary,
        webhookVerifyToken: wabaVerifyCanary,
        isActive: true,
        isDefault: false,
      })
      .returning({ id: schema.whatsappAccounts.id })
    createdWhatsappAccountIds.push(insertedWaba!.id)

    const [insertedSocial] = await db
      .insert(schema.socialIntegrations)
      .values({
        provider: "facebook",
        name: `F-ADMIN Test FB ${suffix}`,
        handle: `@alramlah_${suffix}`,
        internalAccountId: `f-admin-fb-${suffix}`,
        encryptedAccessToken: socialAccessCanary,
        encryptedRefreshToken: socialRefreshCanary,
        status: "PENDING_SELECTION",
        isActive: true,
        metadata: {
          encryptedPageAccessToken: pageTokenCanary,
          pendingCandidates: [
            {
              provider: "facebook",
              internalAccountId: `cand-${suffix}`,
              name: "Candidate Page",
              encryptedAccessToken: candidateTokenCanary,
            },
          ],
        },
        createdByUserId: adminUser.id,
      })
      .returning({ id: schema.socialIntegrations.id })
    createdSocialIntegrationIds.push(insertedSocial!.id)

    const cookieHeader = await signInAndExtractCookie(adminEmail, adminPassword)

    const element = await runInNextRenderContext(cookieHeader, () =>
      AdminSettingsPage({
        searchParams: Promise.resolve({ tab: "waba" }),
      })
    )

    const serializedElementProps = JSON.stringify(element.props)
    assert.ok(
      !serializedElementProps.includes(wabaAccessCanary),
      "WABA encryptedAccessToken must never appear in RSC client props"
    )
    assert.ok(
      !serializedElementProps.includes(wabaVerifyCanary),
      "Plaintext webhookVerifyToken must never appear in RSC client props"
    )
    assert.ok(
      !serializedElementProps.includes(socialAccessCanary),
      "Social encryptedAccessToken must never appear in RSC client props"
    )
    assert.ok(
      !serializedElementProps.includes(socialRefreshCanary),
      "Social encryptedRefreshToken must never appear in RSC client props"
    )
    assert.ok(
      !serializedElementProps.includes(candidateTokenCanary),
      "Nested pendingCandidates encrypted token must never appear in RSC client props"
    )
    assert.ok(
      !serializedElementProps.includes(pageTokenCanary),
      "Nested encryptedPageAccessToken must never appear in RSC client props"
    )

    const wabaAccounts = element.props.whatsappAccounts as Array<{
      id: string
      hasAccessToken: boolean
      hasVerifyToken: boolean
      verifyTokenPreview: string | null
    }>
    const targetWaba = wabaAccounts.find((acc) => acc.id === insertedWaba!.id)
    assert.ok(targetWaba, "Inserted WABA account DTO should be present")
    assert.equal(targetWaba.hasAccessToken, true)
    assert.equal(targetWaba.hasVerifyToken, true)
    assert.equal(targetWaba.verifyTokenPreview, "••••••••9481")

    const socialAccounts = element.props.socialIntegrations as Array<{
      id: string
      hasAccessToken: boolean
      hasRefreshToken: boolean
      metadata: Record<string, unknown>
    }>
    const targetSocial = socialAccounts.find((s) => s.id === insertedSocial!.id)
    assert.ok(targetSocial, "Inserted Social Integration DTO should be present")
    assert.equal(targetSocial.hasAccessToken, true)
    assert.equal(targetSocial.hasRefreshToken, true)
    assert.equal(targetSocial.metadata.hasPageAccessToken, true)
    assert.equal(targetSocial.metadata.pendingCandidatesCount, 1)
  })
})
