import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
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
import { db } from "../../../db"
import * as schema from "../../../db/schema"
import { provisionStaffAccountInternal } from "../../../lib/auth"
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import { encrypt } from "../../../lib/whatsapp/encryption"

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

if (!process.env.META_APP_SECRET) {
  process.env.META_APP_SECRET = "fwa_test_meta_app_secret_default_32chars"
}

assertAuditSafeEnvironment()

let phoneSeqCounter = Math.floor(Math.random() * 400_000) + 100_000

export function uniqueTestPhoneE164(): string {
  phoneSeqCounter += 1
  return `+92327${String(phoneSeqCounter).padStart(7, "0").slice(-7)}`
}

export function uniqueTestWamid(prefix = "wamid.fwa"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`
}

export async function createTestActorSession(
  role: "super_admin" | "staff"
): Promise<{
  userId: string
  email: string
  cookie: string
}> {
  const slug = crypto.randomUUID().slice(0, 10)
  const email = `fwa.${role}.${slug}@alramlahtravels.test`
  const password = `Haramain!${slug}9A`

  const provisioned = await provisionStaffAccountInternal({
    name: `F-WA ${role === "super_admin" ? "Super Admin" : "Consultant"} ${slug}`,
    email,
    password,
    role,
    mustChangePassword: false,
  })

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
  assert.equal(res.status, 200, `Expected 200 sign-in for ${email}`)
  const setCookieHeaders = res.headers.getSetCookie()
  assert.ok(setCookieHeaders.length > 0, "Expected session Set-Cookie header")
  const cookie = setCookieHeaders
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")

  return {
    userId: provisioned.id,
    email,
    cookie,
  }
}

export async function runServerActionAs<T>(
  cookieHeader: string,
  fn: () => Promise<T>,
  ipAddress = "203.0.113.77"
): Promise<T> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": ipAddress,
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})

  const workStore: WorkStore = {
    page: "/admin/(dashboard)/desk/page",
    route: "/admin/desk",
    incrementalCache: {} as WorkStore["incrementalCache"],
    cacheLifeProfiles: {},
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
  }

  const requestStore: RequestStore = {
    type: "request",
    phase: "action",
    implicitTags: { tags: [], expirationsByCacheKind: new Map() },
    url: { pathname: "/admin/desk", search: "" },
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

export async function createTestWhatsappAccount(overrides?: {
  name?: string
  phoneNumberId?: string
  wabaId?: string
  displayPhoneNumber?: string
  accessTokenPlain?: string
  webhookVerifyToken?: string
  isActive?: boolean
  isDefault?: boolean
  platformType?: "CLOUD_API" | "LINKED_DEVICE"
  qualityRating?: string
  autoReplyEnabled?: boolean
  welcomeGreetingEnabled?: boolean
  welcomeGreetingText?: string | null
  awayGreetingEnabled?: boolean
  awayGreetingText?: string | null
  businessHoursStart?: string
  businessHoursEnd?: string
}) {
  const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  const accessTokenPlain =
    overrides?.accessTokenPlain ?? `EAA_TEST_META_TOKEN_${slug}`
  const appSecretPlain =
    process.env.META_APP_SECRET || "fwa_test_meta_app_secret_default_32chars"
  const webhookVerifyToken =
    overrides?.webhookVerifyToken ?? `verify_tok_${slug}_strong_token_1234`

  const [account] = await db
    .insert(schema.whatsappAccounts)
    .values({
      name: overrides?.name ?? `Test WABA ${slug}`,
      phoneNumberId: overrides?.phoneNumberId ?? `pnid_${slug}`,
      wabaId: overrides?.wabaId ?? `waba_${slug}`,
      displayPhoneNumber:
        overrides?.displayPhoneNumber ?? uniqueTestPhoneE164(),
      encryptedAccessToken: encrypt(accessTokenPlain),
      webhookVerifyToken,
      isActive: overrides?.isActive ?? true,
      isDefault: overrides?.isDefault ?? false,
      platformType: overrides?.platformType ?? "CLOUD_API",
      qualityRating: overrides?.qualityRating ?? "GREEN",
      autoReplyEnabled: overrides?.autoReplyEnabled ?? true,
      welcomeGreetingEnabled: overrides?.welcomeGreetingEnabled ?? false,
      welcomeGreetingText: overrides?.welcomeGreetingText ?? null,
      awayGreetingEnabled: overrides?.awayGreetingEnabled ?? false,
      awayGreetingText: overrides?.awayGreetingText ?? null,
      businessHoursStart: overrides?.businessHoursStart ?? "00:00",
      businessHoursEnd: overrides?.businessHoursEnd ?? "23:59",
    })
    .returning()

  return {
    account: account!,
    accessTokenPlain,
    appSecretPlain,
    webhookVerifyToken,
  }
}

export function computeMetaSignature(
  rawBody: string,
  appSecret: string
): string {
  const hex = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex")
  return `sha256=${hex}`
}

export async function withMockedFetch<T>(
  handler: (
    url: string,
    init?: RequestInit
  ) => Promise<Response> | Response | null,
  fn: () => Promise<T>
): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const intercepted = await handler(url, init)
    if (intercepted) {
      return intercepted
    }
    return originalFetch(input as RequestInfo, init)
  }) as typeof fetch

  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function cleanupTestArtifacts(params: {
  accountIds?: string[]
  userIds?: string[]
  applicationIds?: string[]
  outreachContactIds?: string[]
  contactPhones?: string[]
  channelIds?: string[]
  linkedSessionKeys?: string[]
}) {
  if (params.applicationIds && params.applicationIds.length > 0) {
    await db
      .update(schema.whatsappConversations)
      .set({ applicationId: null })
      .where(
        inArray(
          schema.whatsappConversations.applicationId,
          params.applicationIds
        )
      )
      .catch(() => {})
    await db
      .delete(schema.applications)
      .where(inArray(schema.applications.id, params.applicationIds))
      .catch(() => {})
  }

  if (params.accountIds && params.accountIds.length > 0) {
    await db
      .delete(schema.whatsappAccounts)
      .where(inArray(schema.whatsappAccounts.id, params.accountIds))
      .catch(() => {})
  }

  if (params.outreachContactIds && params.outreachContactIds.length > 0) {
    await db
      .delete(schema.outreachContacts)
      .where(inArray(schema.outreachContacts.id, params.outreachContactIds))
      .catch(() => {})
  }

  if (params.contactPhones && params.contactPhones.length > 0) {
    await db
      .delete(schema.outreachContacts)
      .where(
        inArray(schema.outreachContacts.whatsappNumber, params.contactPhones)
      )
      .catch(() => {})
  }

  if (params.channelIds && params.channelIds.length > 0) {
    await db
      .delete(schema.marketingChannels)
      .where(inArray(schema.marketingChannels.id, params.channelIds))
      .catch(() => {})
  }

  if (params.linkedSessionKeys && params.linkedSessionKeys.length > 0) {
    for (const key of params.linkedSessionKeys) {
      await db
        .delete(schema.whatsappLinkedDeviceSessions)
        .where(eq(schema.whatsappLinkedDeviceSessions.sessionKey, key))
        .catch(() => {})
    }
  }

  if (params.userIds && params.userIds.length > 0) {
    await db
      .delete(schema.user)
      .where(inArray(schema.user.id, params.userIds))
      .catch(() => {})
  }
}
