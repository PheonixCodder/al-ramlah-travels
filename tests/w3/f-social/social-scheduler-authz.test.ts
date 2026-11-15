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
import {
  cancelScheduledPostAction,
  createScheduledSocialPostAction,
  deleteSocialIntegrationAction,
  disconnectSocialIntegrationAction,
  executeScheduledPostNowAction,
  generateArtFirstCommentAction,
  generateSocialCaptionsCopilotAction,
  getNextFreeSocialSlotAction,
  getPendingSocialAccountCandidatesAction,
  getScheduledPostsQueueAction,
  getTikTokCreatorInfoAction,
  listSocialIntegrationsAction,
  refreshSocialIntegrationTokenAction,
  rescheduleSocialPostAction,
  retryFailedPostTargetAction,
  runProactiveTokenRefreshAction,
  saveManualSocialIntegrationAction,
  selectSocialAccountCandidateAction,
  syncAllPublishedPostsAnalyticsAction,
  syncSocialPostAnalyticsAction,
} from "../../../app/actions/social-scheduler"
import { executeScheduledPostNowInternal } from "../../../lib/social/publish-executor"

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
  assert.equal(res.status, 200, `Expected 200 sign-in for ${email}`)
  const setCookieHeaders = res.headers.getSetCookie()
  assert.ok(setCookieHeaders.length > 0, "Expected session Set-Cookie header")
  return setCookieHeaders
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

async function runActionWithCookie<T>(
  cookieHeader: string,
  fn: () => Promise<T>
): Promise<T> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": "203.0.113.77",
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})

  const workStore = {
    page: "/admin/(dashboard)/campaigns/page",
    route: "/admin/campaigns",
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
    url: { pathname: "/admin/campaigns", search: "" },
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

describe("F-SOCIAL T-033 & OD-07: Social Scheduler Server Action AuthZ & Audit Logs", () => {
  const createdUserIds: string[] = []
  const createdIntegrationIds: string[] = []
  const createdPostIds: string[] = []

  after(async () => {
    if (createdPostIds.length > 0) {
      await db
        .delete(schema.scheduledPostTargets)
        .where(
          inArray(schema.scheduledPostTargets.scheduledPostId, createdPostIds)
        )
      await db
        .delete(schema.scheduledPosts)
        .where(inArray(schema.scheduledPosts.id, createdPostIds))
    }
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

  it("T-033a: rejects unauthenticated calls across every exported social-scheduler Server Action", async () => {
    const fakeUuid = crypto.randomUUID()
    const unauthCalls: Array<{ name: string; invoke: () => Promise<unknown> }> =
      [
        {
          name: "executeScheduledPostNowAction",
          invoke: () =>
            executeScheduledPostNowAction({ scheduledPostId: fakeUuid }),
        },
        {
          name: "listSocialIntegrationsAction",
          invoke: () => listSocialIntegrationsAction(),
        },
        {
          name: "getScheduledPostsQueueAction",
          invoke: () => getScheduledPostsQueueAction(),
        },
        {
          name: "getPendingSocialAccountCandidatesAction",
          invoke: () =>
            getPendingSocialAccountCandidatesAction({
              integrationId: fakeUuid,
            }),
        },
        {
          name: "selectSocialAccountCandidateAction",
          invoke: () =>
            selectSocialAccountCandidateAction({
              integrationId: fakeUuid,
              internalAccountId: "123",
            }),
        },
        {
          name: "refreshSocialIntegrationTokenAction",
          invoke: () =>
            refreshSocialIntegrationTokenAction({ integrationId: fakeUuid }),
        },
        {
          name: "runProactiveTokenRefreshAction",
          invoke: () => runProactiveTokenRefreshAction(),
        },
        {
          name: "disconnectSocialIntegrationAction",
          invoke: () =>
            disconnectSocialIntegrationAction({ integrationId: fakeUuid }),
        },
        {
          name: "deleteSocialIntegrationAction",
          invoke: () =>
            deleteSocialIntegrationAction({ integrationId: fakeUuid }),
        },
        {
          name: "saveManualSocialIntegrationAction",
          invoke: () =>
            saveManualSocialIntegrationAction({
              provider: "facebook",
              name: "Unauth Page",
              internalAccountId: "123",
              accessToken: "secret_token_12345",
            }),
        },
        {
          name: "createScheduledSocialPostAction",
          invoke: () =>
            createScheduledSocialPostAction({
              caption: "Unauth post",
              postType: "single_image",
              mediaUrls: ["https://pub-test.r2.dev/poster.jpg"],
              scheduledFor: new Date(),
              targetIntegrationIds: [fakeUuid],
            }),
        },
        {
          name: "cancelScheduledPostAction",
          invoke: () => cancelScheduledPostAction({ postId: fakeUuid }),
        },
        {
          name: "retryFailedPostTargetAction",
          invoke: () => retryFailedPostTargetAction({ targetId: fakeUuid }),
        },
        {
          name: "generateArtFirstCommentAction",
          invoke: () =>
            generateArtFirstCommentAction({ postCode: "ART-TEST-01" }),
        },
        {
          name: "syncSocialPostAnalyticsAction",
          invoke: () =>
            syncSocialPostAnalyticsAction({ postId: fakeUuid }),
        },
        {
          name: "syncAllPublishedPostsAnalyticsAction",
          invoke: () => syncAllPublishedPostsAnalyticsAction(),
        },
        {
          name: "rescheduleSocialPostAction",
          invoke: () =>
            rescheduleSocialPostAction({
              postId: fakeUuid,
              newScheduledFor: new Date(),
            }),
        },
        {
          name: "getNextFreeSocialSlotAction",
          invoke: () => getNextFreeSocialSlotAction(),
        },
        {
          name: "generateSocialCaptionsCopilotAction",
          invoke: () =>
            generateSocialCaptionsCopilotAction({ postCode: "ART-TEST-01" }),
        },
        {
          name: "getTikTokCreatorInfoAction",
          invoke: () => getTikTokCreatorInfoAction({ integrationId: fakeUuid }),
        },
      ]

    for (const entry of unauthCalls) {
      await assert.rejects(
        () => runActionWithCookie("", entry.invoke),
        /Unauthorized/,
        `Expected ${entry.name} to reject unauthenticated call`
      )
    }
  })

  it("T-033b: enforces requireSuperAdmin() on OAuth & integration mutations while allowing staff composer reads", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const staffEmail = `f-social-staff-${suffix}@alramlahtravels.com`
    const staffPass = `StaffPass!${crypto.randomBytes(8).toString("hex")}`

    const staffUser = await provisionStaffAccountInternal({
      email: staffEmail,
      password: staffPass,
      name: "F-SOCIAL Staff",
      role: "staff",
      mustChangePassword: false,
    })
    createdUserIds.push(staffUser.id)
    const staffCookie = await signInAndExtractCookie(staffEmail, staffPass)

    const fakeUuid = crypto.randomUUID()
    const superAdminOnlyActions: Array<{
      name: string
      invoke: () => Promise<unknown>
    }> = [
      {
        name: "getPendingSocialAccountCandidatesAction",
        invoke: () =>
          getPendingSocialAccountCandidatesAction({ integrationId: fakeUuid }),
      },
      {
        name: "selectSocialAccountCandidateAction",
        invoke: () =>
          selectSocialAccountCandidateAction({
            integrationId: fakeUuid,
            internalAccountId: "page-1",
          }),
      },
      {
        name: "refreshSocialIntegrationTokenAction",
        invoke: () =>
          refreshSocialIntegrationTokenAction({ integrationId: fakeUuid }),
      },
      {
        name: "runProactiveTokenRefreshAction",
        invoke: () => runProactiveTokenRefreshAction(),
      },
      {
        name: "disconnectSocialIntegrationAction",
        invoke: () =>
          disconnectSocialIntegrationAction({ integrationId: fakeUuid }),
      },
      {
        name: "deleteSocialIntegrationAction",
        invoke: () =>
          deleteSocialIntegrationAction({ integrationId: fakeUuid }),
      },
      {
        name: "saveManualSocialIntegrationAction",
        invoke: () =>
          saveManualSocialIntegrationAction({
            provider: "facebook",
            name: "Staff Blocked Page",
            internalAccountId: "999",
            accessToken: "blocked_token_123456",
          }),
      },
    ]

    for (const entry of superAdminOnlyActions) {
      await assert.rejects(
        () => runActionWithCookie(staffCookie, entry.invoke),
        /Forbidden: Super Administrator privilege required/,
        `Expected ${entry.name} to reject staff role`
      )
    }

    const slotRes = await runActionWithCookie(staffCookie, () =>
      getNextFreeSocialSlotAction()
    )
    assert.equal(slotRes.success, true)
  })

  it("T-033c: validates UUIDs, records audit_logs on super_admin publish/account mutations, and preserves internal worker executor", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const adminEmail = `f-social-admin-${suffix}@alramlahtravels.com`
    const adminPass = `AdminPass!${crypto.randomBytes(8).toString("hex")}`

    const adminUser = await provisionStaffAccountInternal({
      email: adminEmail,
      password: adminPass,
      name: "F-SOCIAL Super Admin",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(adminUser.id)
    const adminCookie = await signInAndExtractCookie(adminEmail, adminPass)

    const invalidUuidRes = await runActionWithCookie(adminCookie, () =>
      executeScheduledPostNowAction({ scheduledPostId: "not-a-valid-uuid" })
    )
    assert.equal(invalidUuidRes.success, false)
    assert.match(invalidUuidRes.error || "", /UUID|Invalid/i)

    const extId = `manual-fb-${suffix}`
    const saveRes = await runActionWithCookie(adminCookie, () =>
      saveManualSocialIntegrationAction({
        provider: "facebook",
        name: `Al Ramlah Test Page ${suffix}`,
        handle: `@alramlah_${suffix}`,
        internalAccountId: extId,
        accessToken: "mock_token_audit_test_12345",
      })
    )
    assert.equal(saveRes.success, true)
    assert.ok(saveRes.integrationId)
    createdIntegrationIds.push(saveRes.integrationId)

    const [createdPost] = await db
      .insert(schema.scheduledPosts)
      .values({
        caption: `Audit test caption ${suffix}`,
        postType: "single_image",
        postFormat: "FEED",
        mediaUrls: ["https://pub-test.r2.dev/poster.jpg"],
        socialJpegUrls: ["https://pub-test.r2.dev/poster.jpg"],
        campaignStage: "standalone",
        status: "scheduled",
        scheduledFor: new Date(),
      })
      .returning()
    assert.ok(createdPost)
    createdPostIds.push(createdPost.id)

    const execRes = await runActionWithCookie(adminCookie, () =>
      executeScheduledPostNowAction({ scheduledPostId: createdPost.id })
    )
    assert.equal(execRes.success, true)

    // Verify internal worker entrypoint executes without HTTP request cookies
    const workerRes = await executeScheduledPostNowInternal({
      scheduledPostId: createdPost.id,
    })
    assert.equal(workerRes.success, true)

    const discRes = await runActionWithCookie(adminCookie, () =>
      disconnectSocialIntegrationAction({
        integrationId: saveRes.integrationId!,
      })
    )
    assert.equal(discRes.success, true)

    const delRes = await runActionWithCookie(adminCookie, () =>
      deleteSocialIntegrationAction({ integrationId: saveRes.integrationId! })
    )
    assert.equal(delRes.success, true)

    const auditRows = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.actorId, adminUser.id))

    const actionsLogged = new Set(auditRows.map((r) => r.action))
    assert.ok(actionsLogged.has("social.integration.manual_saved"))
    assert.ok(actionsLogged.has("social.post.executed_now"))
    assert.ok(actionsLogged.has("social.integration.disconnected"))
    assert.ok(actionsLogged.has("social.integration.deleted"))
  })
})
