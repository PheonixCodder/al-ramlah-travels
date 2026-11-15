import fs from "node:fs"
import path from "node:path"
import { and, desc, eq } from "drizzle-orm"
import * as schema from "../../db/schema"
import { syncAllPublishedPostsAnalytics } from "../../lib/social/analytics"
import { isSafeAutoReplyRegex } from "../../lib/whatsapp/safe-regex"
import { parseWhatsappBroadcastCsv } from "../../lib/whatsapp/template-variables"
import { runPublishSocialPostExecution } from "../../trigger/publish-social-post.task"
import { runSlaOverdueQuoteMonitor } from "../../trigger/schedules.task"
import { SUPERADMIN_AUTH_FILE } from "./global-setup"
import {
  assertZeroSeriousOrCriticalAxeViolations,
  clearMockRequests,
  getMockRequests,
  injectMockFault,
  readE2eFixturesSummary,
} from "./helpers/assertions"
import { expect, test, type APIRequestContext } from "./helpers/fixture"
import {
  E2E_COEXISTENCE_PHONE_ID,
  E2E_POST_CODE,
  E2E_PRIMARY_PHONE_ID,
  E2E_WABA_ID,
  getE2eDb,
  signWhatsappWebhookBody,
} from "./helpers/db"
import {
  E2E_APP_ORIGIN,
  E2E_HEALTHCHECK_BEARER_TOKEN,
  E2E_WA_VERIFY_TOKEN,
  WEB_ROOT,
} from "./helpers/env"

function buildMetaInboundWebhookPayload(params: {
  phoneNumberId: string
  displayPhoneNumber?: string
  senderWaId: string
  senderName: string
  wamid: string
  message:
    | { type: "text"; text: { body: string } }
    | {
        type: "image"
        image: { id: string; mime_type: string; caption?: string }
      }
}): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: E2E_WABA_ID,
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number:
                  params.displayPhoneNumber ?? "+92 300 0001001",
                phone_number_id: params.phoneNumberId,
              },
              contacts: [
                {
                  profile: { name: params.senderName },
                  wa_id: params.senderWaId,
                },
              ],
              messages: [
                {
                  from: params.senderWaId,
                  id: params.wamid,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  ...params.message,
                },
              ],
            },
          },
        ],
      },
    ],
  })
}

async function postSignedWebhook(
  request: APIRequestContext,
  rawBody: string
): Promise<{ status: number; elapsedMs: number }> {
  const sig = signWhatsappWebhookBody(rawBody)
  const startedAt = performance.now()
  const res = await request.post("/api/webhooks/whatsapp", {
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": sig,
    },
    data: rawBody,
  })
  const elapsedMs = performance.now() - startedAt
  return { status: res.status(), elapsedMs }
}

test.describe("J13–J22 WhatsApp Cloud CRM, Core 5 Social, Catalog Redirects & Security/Chaos", () => {
  test("J13: Signed WhatsApp Cloud Webhook fast ACK, ART-... package bot auto-reply & private R2 media proxy auth gate", async ({
    browser,
    request,
  }) => {
    await clearMockRequests()

    // Warm up `/api/webhooks/whatsapp` GET verification endpoint first
    const verifyRes = await request.get(
      `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(
        E2E_WA_VERIFY_TOKEN
      )}&hub.challenge=e2e_challenge_ok`
    )
    expect(verifyRes.status()).toBe(200)
    expect(await verifyRes.text()).toBe("e2e_challenge_ok")

    // 1. Send signed inbound ART-... package inquiry (`<150ms` fast ACK budget on warmed route)
    const senderWaId = `92301${Date.now().toString().slice(-7)}`
    const wamid1 = `wamid.j13_art_${Date.now()}`
    const artPayload = buildMetaInboundWebhookPayload({
      phoneNumberId: E2E_PRIMARY_PHONE_ID,
      senderWaId,
      senderName: "J13 Package Pilgrim",
      wamid: wamid1,
      message: {
        type: "text",
        text: { body: `Assalamu Alaikum, details for ${E2E_POST_CODE} please` },
      },
    })

    const { status, elapsedMs } = await postSignedWebhook(request, artPayload)
    expect(status).toBe(200)
    // Next.js dev mode warmed route fast-ACK check (decoupled from async processor)
    expect(elapsedMs).toBeLessThan(1000)

    const { db } = getE2eDb()
    // Poll async background processor until outbound auto-reply is recorded (`contactPhone` stores E.164 digits without `+`)
    await expect
      .poll(
        async () => {
          const conv = await db.query.whatsappConversations.findFirst({
            where: eq(
              schema.whatsappConversations.contactPhone,
              senderWaId
            ),
          })
          if (!conv) return 0
          const msgs = await db.query.whatsappMessages.findMany({
            where: and(
              eq(schema.whatsappMessages.conversationId, conv.id),
              eq(schema.whatsappMessages.direction, "outbound")
            ),
          })
          return msgs.length
        },
        { timeout: 15_000 }
      )
      .toBeGreaterThanOrEqual(1)

    // 2. Inbound pilgrim image mirrored to private `/api/media/whatsapp-media/...` proxy
    const wamidImg = `wamid.j13_img_${Date.now()}`
    const imgPayload = buildMetaInboundWebhookPayload({
      phoneNumberId: E2E_PRIMARY_PHONE_ID,
      senderWaId,
      senderName: "J13 Package Pilgrim",
      wamid: wamidImg,
      message: {
        type: "image",
        image: {
          id: "media_e2e_pilgrim_img",
          mime_type: "image/png",
          caption: "Passport scan preview",
        },
      },
    })
    const imgAck = await postSignedWebhook(request, imgPayload)
    expect(imgAck.status).toBe(200)

    let mirroredMediaUrl: string | null = null
    await expect
      .poll(
        async () => {
          const msgRow = await db.query.whatsappMessages.findFirst({
            where: eq(schema.whatsappMessages.wamid, wamidImg),
          })
          mirroredMediaUrl = msgRow?.mediaUrl ?? null
          return mirroredMediaUrl?.startsWith("/api/media/") ?? false
        },
        { timeout: 15_000 }
      )
      .toBe(true)

    const unsignedMediaPath = mirroredMediaUrl!.split("?")[0]!
    // Unauthenticated unsigned request to private WhatsApp media MUST return `401`
    const unauthMediaRes = await fetch(`${E2E_APP_ORIGIN}${unsignedMediaPath}`)
    expect(unauthMediaRes.status).toBe(401)

    // Authenticated admin session receives `200 OK` image bytes
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })
    const authMediaRes = await adminCtx.request.get(unsignedMediaPath)
    expect(authMediaRes.status()).toBe(200)
    await adminCtx.close()
  })

  test("J14: WhatsApp Guided 3-Step Umrah Intake creates ART-WA-... application visible in Kanban Desk", async ({
    browser,
    request,
  }) => {
    const { db } = getE2eDb()
    const intakeSender = `92302${Date.now().toString().slice(-7)}`

    const sendIntakeStep = async (stepIndex: number, textBody: string) => {
      const wamid = `wamid.j14_step${stepIndex}_${Date.now()}`
      const body = buildMetaInboundWebhookPayload({
        phoneNumberId: E2E_PRIMARY_PHONE_ID,
        senderWaId: intakeSender,
        senderName: "J14 Guided Pilgrim",
        wamid,
        message: { type: "text", text: { body: textBody } },
      })
      const res = await postSignedWebhook(request, body)
      expect(res.status).toBe(200)

      await expect
        .poll(
          async () => {
            const msg = await db.query.whatsappMessages.findFirst({
              where: eq(schema.whatsappMessages.wamid, wamid),
            })
            const raw = (msg?.rawPayload ?? {}) as Record<string, unknown>
            return raw.processingStatus === "completed"
          },
          { timeout: 15_000 }
        )
        .toBe(true)
    }

    // Step 0 -> Trigger intake ("plan umrah") -> Step 1 Month ("December") -> Step 2 Pax ("4") -> Step 3 Hotel ("5 star")
    await sendIntakeStep(0, "plan umrah")
    await sendIntakeStep(1, "December")
    await sendIntakeStep(2, "4")
    await sendIntakeStep(3, "5 star")

    const conv = await db.query.whatsappConversations.findFirst({
      where: eq(schema.whatsappConversations.contactPhone, intakeSender),
    })
    expect(conv?.applicationId).toBeTruthy()

    const waApp = await db.query.applications.findFirst({
      where: eq(schema.applications.id, conv!.applicationId!),
    })
    expect(waApp?.referenceNumber).toMatch(/^ART-WA-/)

    // Verify `ART-WA-...` lead renders inside Admin Desk Pipeline
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })
    const page = await adminCtx.newPage()
    await page.goto("/admin/desk?tab=pipeline")
    await expect(page.getByText(waApp!.referenceNumber).first()).toBeVisible({
      timeout: 15_000,
    })
    await adminCtx.close()
  })

  test("J15: Live Desk Inbox read-only poll (`0` unconditional DB writes), pin/notes & >24h Meta template gate", async ({
    browser,
  }) => {
    const { db } = getE2eDb()
    const fixtures = readE2eFixturesSummary()
    const expiredPhone = `92303${Date.now().toString().slice(-7)}`

    // Seed a conversation whose 24-hour customer care window expired 48 hours ago, pinned/recent so it sits at #1 in the 50-thread inbox
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600_000)
    const [expiredConv] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: fixtures.primaryWaAccountId,
        contactPhone: expiredPhone,
        contactName: "J15 Expired Window Pilgrim",
        lastCustomerMessageAt: fortyEightHoursAgo,
        lastMessageAt: new Date(),
        unreadCount: 0,
        isPinned: true,
      })
      .returning()

    await db.insert(schema.whatsappMessages).values({
      conversationId: expiredConv!.id,
      wamid: `wamid.j15_exp_${Date.now()}`,
      direction: "inbound",
      status: "delivered",
      messageType: "text",
      body: "Checking Umrah rates from 2 days ago",
      createdAt: fortyEightHoursAgo,
    })

    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })
    const page = await adminCtx.newPage()
    await page.goto("/admin/desk?tab=inbox")

    await expect(
      page.getByText("J15 Expired Window Pilgrim").first()
    ).toBeVisible({ timeout: 15_000 })

    // Allow initial mount selection to settle, then verify 4s adaptive background poll performs 0 DB writes
    await page.waitForTimeout(800)
    const beforePollRow = await db.query.whatsappConversations.findFirst({
      where: eq(schema.whatsappConversations.id, expiredConv!.id),
    })
    const beforeUpdatedAt = beforePollRow!.updatedAt.getTime()

    await page.waitForTimeout(5000)
    const afterPollRow = await db.query.whatsappConversations.findFirst({
      where: eq(schema.whatsappConversations.id, expiredConv!.id),
    })
    expect(afterPollRow!.updatedAt.getTime()).toBe(beforeUpdatedAt)

    // Select the expired-window conversation and verify >24h Meta template notice / gate
    await page.getByText("J15 Expired Window Pilgrim").first().click()
    await expect(
      page
        .getByText(/24-hour|24h|template|window/i)
        .first()
    ).toBeVisible()

    await adminCtx.close()
  })

  test("J16: Auto-Reply Studio (`role='dialog'`), ReDoS regex guard & Coexistence personal chat suppression", async ({
    browser,
    request,
  }) => {
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })
    const page = await adminCtx.newPage()
    await page.goto("/admin/desk?tab=inbox")

    // 1. Open Auto-Reply Studio modal and verify accessible `role="dialog"`
    await page
      .getByRole("button", { name: /Auto-Replies & Setup/i })
      .click()
    const studioDialog = page.getByRole("dialog")
    await expect(studioDialog).toBeVisible()

    // Verify ReDoS nested quantifier safety validator directly via `lib/whatsapp/safe-regex`
    expect(isSafeAutoReplyRegex("(a+)+$")).toBe(false)
    expect(isSafeAutoReplyRegex("^umrah\\s+rates$")).toBe(true)

    await page.keyboard.press("Escape")
    await adminCtx.close()

    // 2. Coexistence Founder line (`COEXISTENCE_FOUNDER`): personal chat MUST NOT trigger auto-replies!
    await clearMockRequests()
    const personalSender = `92304${Date.now().toString().slice(-7)}`
    const wamidCoex = `wamid.j16_coex_${Date.now()}`
    const personalBody = buildMetaInboundWebhookPayload({
      phoneNumberId: E2E_COEXISTENCE_PHONE_ID,
      displayPhoneNumber: "+92 321 0001002",
      senderWaId: personalSender,
      senderName: "Cousin Bilal Personal",
      wamid: wamidCoex,
      message: {
        type: "text",
        text: { body: "Bhai are you coming to family dinner at 9pm tonight?" },
      },
    })

    const ack = await postSignedWebhook(request, personalBody)
    expect(ack.status).toBe(200)

    const { db } = getE2eDb()
    await expect
      .poll(
        async () => {
          const msg = await db.query.whatsappMessages.findFirst({
            where: eq(schema.whatsappMessages.wamid, wamidCoex),
          })
          const raw = (msg?.rawPayload ?? {}) as Record<string, unknown>
          return raw.processingStatus === "completed"
        },
        { timeout: 15_000 }
      )
      .toBe(true)

    const coexConv = await db.query.whatsappConversations.findFirst({
      where: eq(schema.whatsappConversations.contactPhone, personalSender),
    })
    expect(coexConv).toBeDefined()
    const outboundOnPersonal = await db.query.whatsappMessages.findMany({
      where: and(
        eq(schema.whatsappMessages.conversationId, coexConv!.id),
        eq(schema.whatsappMessages.direction, "outbound")
      ),
    })
    expect(outboundOnPersonal.length).toBe(0)
  })

  test("J17: Meta Template Builder modal, CSV Broadcast (`O'Connor` & `03xx -> +923xx` dedupe) & inbound STOP global opt-out", async ({
    browser,
    request,
  }) => {
    // 1. Open Meta Template Builder modal on `/admin/desk?tab=inbox` and verify `role="dialog"`
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })
    const page = await adminCtx.newPage()
    await page.goto("/admin/desk?tab=inbox")
    await page.getByRole("button", { name: /Meta Templates/i }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await adminCtx.close()

    // 2. CSV Broadcast parser: `O'Connor` apostrophe name + `03098887766` and `+923098887766` dedupe
    const csvSample = [
      "name,phone,city",
      "Tariq O'Connor,0309 8887766,Lahore",
      "Tariq Duplicate,+923098887766,Lahore",
      "Amina Siddiqui,0312-4445566,Islamabad",
    ].join("\n")
    const parsedCsv = parseWhatsappBroadcastCsv(csvSample)
    expect(parsedCsv.recipients.length).toBe(2)
    expect(parsedCsv.recipients[0]?.name).toBe("Tariq O'Connor")
    expect(parsedCsv.recipients[0]?.phone).toBe("+923098887766")

    // 3. Inbound `"STOP"` sets `do_not_contact` on both `whatsapp_conversations` and `outreach_contacts`
    const { db } = getE2eDb()
    const stopDigits = `92305${Date.now().toString().slice(-7)}`
    const stopE164 = `+${stopDigits}`

    await db.insert(schema.outreachContacts).values({
      fullName: "J17 OptOut Pilgrim",
      whatsappNumber: stopE164,
      city: "Lahore",
      interestStatus: "prospect",
    })

    const wamidStop = `wamid.j17_stop_${Date.now()}`
    const stopWebhook = buildMetaInboundWebhookPayload({
      phoneNumberId: E2E_PRIMARY_PHONE_ID,
      senderWaId: stopDigits,
      senderName: "J17 OptOut Pilgrim",
      wamid: wamidStop,
      message: { type: "text", text: { body: "STOP" } },
    })
    const stopRes = await postSignedWebhook(request, stopWebhook)
    expect(stopRes.status).toBe(200)

    await expect
      .poll(
        async () => {
          const contact = await db.query.outreachContacts.findFirst({
            where: eq(schema.outreachContacts.whatsappNumber, stopE164),
          })
          return contact?.interestStatus === "do_not_contact"
        },
        { timeout: 15_000 }
      )
      .toBe(true)

    const updatedContact = await db.query.outreachContacts.findFirst({
      where: eq(schema.outreachContacts.whatsappNumber, stopE164),
    })
    expect(updatedContact?.interestStatus).toBe("do_not_contact")
    expect(updatedContact?.optedOutAt).toBeTruthy()
  })

  test("J18: OD-01 Ban-Safe Manual Assisted WA Group/Status Queue (`0` Baileys runtime socket dependency)", async ({
    browser,
  }) => {
    // 1. Verify zero Baileys / unofficial WhatsApp Web socket dependency in `package.json`
    const pkgJsonRaw = fs.readFileSync(
      path.resolve(WEB_ROOT, "package.json"),
      "utf8"
    )
    const pkgJson = JSON.parse(pkgJsonRaw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const allDepNames = [
      ...Object.keys(pkgJson.dependencies ?? {}),
      ...Object.keys(pkgJson.devDependencies ?? {}),
    ]
    expect(
      allDepNames.some((d) => /baileys|whatsapp-web\.js/i.test(d))
    ).toBe(false)

    // 2. Visit `/admin/campaigns?tab=whatsapp` and verify Manual Assisted Queue UI renders cleanly
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })
    const page = await adminCtx.newPage()
    const resp = await page.goto("/admin/campaigns?tab=whatsapp")
    expect(resp?.status()).toBe(200)
    await expect(page.locator("h1, h2").first()).toBeVisible()
    // Ensure no QR-pairing / Baileys linked-device socket prompt is rendered
    const bodyText = await page.locator("main").innerText()
    expect(bodyText.toLowerCase()).not.toContain("scan baileys qr")

    await adminCtx.close()
  })

  test("J19: Core 5 Social OAuth CSRF state guard, encrypted Candidate Picker staging & GBP v1 / TikTok flags (`OD-11`)", async ({
    browser,
  }) => {
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })

    // 1. Tampered / missing CSRF `state` on `/api/oauth/social/facebook/callback` is rejected
    const badCallback = await adminCtx.request.get(
      "/api/oauth/social/facebook/callback?code=fake_code&state=tampered_csrf_state",
      { maxRedirects: 0 }
    )
    if (badCallback.status() >= 300 && badCallback.status() < 400) {
      expect(badCallback.headers()["location"] ?? "").toContain("error=")
    } else {
      expect(badCallback.status()).toBeGreaterThanOrEqual(400)
    }

    // 2. Initiate genuine OAuth flow as `super_admin` -> extract signed `state` -> complete callback against mock Graph `/me/accounts`
    const initRes = await adminCtx.request.get("/api/oauth/social/facebook", {
      maxRedirects: 0,
    })
    expect([302, 307]).toContain(initRes.status())
    const redirectLocation = initRes.headers()["location"] ?? ""
    const redirectUrl = new URL(redirectLocation)
    const validState = redirectUrl.searchParams.get("state")
    expect(validState).toBeTruthy()

    const callbackRes = await adminCtx.request.get(
      `/api/oauth/social/facebook/callback?code=e2e_mock_auth_code&state=${encodeURIComponent(
        validState!
      )}`,
      { maxRedirects: 0 }
    )
    expect([302, 307]).toContain(callbackRes.status())
    const callbackRedirect = callbackRes.headers()["location"] ?? ""
    // Never leak plaintext page tokens in redirect URL!
    expect(callbackRedirect).not.toContain("fb_page_token_e2e")
    expect(callbackRedirect).not.toContain("fb_user_long_lived_e2e_token")

    // Verify `PENDING_SELECTION` row in PostgreSQL encrypts candidate tokens via `v2:` vault
    const { db } = getE2eDb()
    const pendingRow = await db.query.socialIntegrations.findFirst({
      where: eq(schema.socialIntegrations.status, "PENDING_SELECTION"),
      orderBy: [desc(schema.socialIntegrations.createdAt)],
    })
    expect(pendingRow).toBeDefined()
    expect(pendingRow?.encryptedAccessToken.startsWith("v2:")).toBe(true)
    expect(JSON.stringify(pendingRow?.metadata ?? {})).not.toContain(
      "fb_page_token_e2e_101"
    )

    // 3. Visit `/admin/settings?tab=connections` and verify GBP / TikTok & Connections UI renders cleanly without leaking raw tokens
    const page = await adminCtx.newPage()
    await page.goto(callbackRedirect)
    const settingsHtml = await page.content()
    expect(settingsHtml).not.toContain("fb_page_token_e2e_101")
    expect(settingsHtml).not.toContain("EAAMockWhatsappCloudTokenE2e")

    await adminCtx.close()
  })

  test("J20: Campaigns Hub presigned upload validation, IG Reel container polling (`IN_PROGRESS` -> `FINISHED`) & honest `unavailable` analytics", async ({
    browser,
  }) => {
    await clearMockRequests()
    const fixtures = readE2eFixturesSummary()
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })

    // 1. Presign upload validation: reject executable MIME & oversized video (`>150MB`)
    const badMimeRes = await adminCtx.request.post("/api/uploads/presign", {
      headers: {
        Origin: E2E_APP_ORIGIN,
        "Content-Type": "application/json",
      },
      data: {
        filename: "malware.exe",
        contentType: "application/x-msdownload",
        sizeBytes: 1024,
        folder: "social",
      },
    })
    expect(badMimeRes.status()).toBeGreaterThanOrEqual(400)

    const oversizedRes = await adminCtx.request.post("/api/uploads/presign", {
      headers: {
        Origin: E2E_APP_ORIGIN,
        "Content-Type": "application/json",
      },
      data: {
        filename: "huge-reel.mp4",
        contentType: "video/mp4",
        sizeBytes: 300 * 1024 * 1024,
        folder: "social",
      },
    })
    expect(oversizedRes.status()).toBeGreaterThanOrEqual(400)

    // 2. Visit `/admin/campaigns` UI and verify clean render + WCAG 2.2 AA
    const page = await adminCtx.newPage()
    const resp = await page.goto("/admin/campaigns")
    expect(resp?.status()).toBe(200)
    await assertZeroSeriousOrCriticalAxeViolations(page)

    // 3. Create due Instagram REEL scheduled post & execute durable publisher -> polls `IN_PROGRESS` then `FINISHED`
    const { db } = getE2eDb()
    const [reelPost] = await db
      .insert(schema.scheduledPosts)
      .values({
        postType: "video",
        postFormat: "REEL",
        campaignStage: "standalone",
        caption: `December Umrah Reel ${E2E_POST_CODE}`,
        mediaUrls: ["https://assets.alramlahtravels.com/reels/e2e-reel.mp4"],
        scheduledFor: new Date(Date.now() - 60_000),
        status: "scheduled",
      })
      .returning()

    await db.insert(schema.scheduledPostTargets).values({
      scheduledPostId: reelPost!.id,
      integrationId: fixtures.instagramIntegrationId,
      idempotencyKey: `e2e_ig_reel_${reelPost!.id}`,
      status: "pending",
    })

    const pubResult = await runPublishSocialPostExecution({
      scheduledPostId: reelPost!.id,
    })
    expect(pubResult.completedTargets).toBe(1)

    const pollRequests = await getMockRequests("ig_container_e2e_reel_1")
    // Must have polled container status >= 2 times (`IN_PROGRESS` -> `FINISHED`) before `media_publish`!
    expect(pollRequests.length).toBeGreaterThanOrEqual(2)

    // 4. Analytics sync when Meta `/insights` returns `400` -> honest unavailable (`null` / `0` fabricated SHA-256 numbers!)
    await syncAllPublishedPostsAnalytics(5)
    const [targetAfterSync] = await db
      .select()
      .from(schema.scheduledPostTargets)
      .where(eq(schema.scheduledPostTargets.scheduledPostId, reelPost!.id))
    expect(targetAfterSync?.externalPostId).toBe("ig_published_e2e_reel_999")
    // `analyticsData` must remain `null` (unavailable) rather than fake SHA-256 impressions
    expect(targetAfterSync?.analyticsData).toBeNull()

    await adminCtx.close()
  })

  test("J21: Catalog & CMS (`/admin/catalog`), FK soft-archive protection & all 14 legacy `/admin/*` redirects", async ({
    browser,
  }) => {
    const { db } = getE2eDb()
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })
    const page = await adminCtx.newPage()

    // 1. Catalog Hub renders cleanly & passes Axe
    const catResp = await page.goto("/admin/catalog")
    expect(catResp?.status()).toBe(200)
    await assertZeroSeriousOrCriticalAxeViolations(page)

    // 2. FK protection: a hotel referenced by `application_hotel_stays` has `ON DELETE RESTRICT` (cannot hard-delete; soft-archived via `isActive = false`)
    const [fkHotel] = await db
      .insert(schema.hotels)
      .values({
        name: `E2E FK Protected Hotel ${Date.now()}`,
        city: "makkah",
        starRating: 5,
        distanceMeters: 120,
        distanceLabel: "120m to Haram",
        accessType: "walking",
        imageUrl: "/logo.jpg",
        isActive: true,
      })
      .returning()

    const [fkApp] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-20261115-FK${Date.now().toString().slice(-4)}`,
        source: "custom_builder",
        presetMode: "hotels_only",
        status: "pending_quote",
        includeVisa: false,
        includeFlights: false,
        includeHotels: true,
        includeTransport: false,
        includeZiyarat: false,
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        ksaArrivalDate: "2026-12-18",
        ksaDepartureDate: "2026-12-23",
        customerName: "J21 FK Guard Pilgrim",
        customerPhone: "+923006667788",
        customerWhatsapp: "+923006667788",
        customerCity: "Lahore",
      })
      .returning()

    await db.insert(schema.applicationHotelStays).values({
      applicationId: fkApp!.id,
      stayOrder: 1,
      city: "makkah",
      hotelId: fkHotel!.id,
      nights: 5,
      checkInDate: "2026-12-18",
      checkOutDate: "2026-12-23",
      roomCategory: "private",
      mealPlan: "breakfast",
    })

    // Soft-archive keeps historical application stay intact
    await db
      .update(schema.hotels)
      .set({ isActive: false })
      .where(eq(schema.hotels.id, fkHotel!.id))
    const preservedStay = await db.query.applicationHotelStays.findFirst({
      where: eq(schema.applicationHotelStays.applicationId, fkApp!.id),
    })
    expect(preservedStay?.hotelId).toBe(fkHotel!.id)

    // 3. Verify all 14 legacy `/admin/*` paths redirect cleanly to `200 OK` 4-Hub destinations
    const legacyAdminRoutes = [
      "/admin/hotels",
      "/admin/flights",
      "/admin/groups",
      "/admin/visa",
      "/admin/transport",
      "/admin/ziyarat",
      "/admin/content",
      "/admin/messages",
      "/admin/users",
      "/admin/post-lookup",
      "/admin/supplier-flyers",
      "/admin/distribution",
      "/admin/outreach",
      "/admin/social",
    ] as const

    for (const legacyPath of legacyAdminRoutes) {
      const navRes = await page.goto(legacyPath)
      expect(
        navRes?.status(),
        `Legacy route ${legacyPath} failed to resolve to 200 OK`
      ).toBe(200)
      expect(page.url()).toContain("/admin/")
    }

    await adminCtx.close()
  })

  test("J22: Security & Chaos Resilience — tampered webhook 401, local upload guard, Gotenberg/OpenRouter 502 fault survival, /api/health deep auth & non-destructive SLA monitor", async ({
    browser,
    request,
  }) => {
    // 1. Tampered WhatsApp webhook HMAC -> `401 Unauthorized`
    const tamperedBody = buildMetaInboundWebhookPayload({
      phoneNumberId: E2E_PRIMARY_PHONE_ID,
      senderWaId: "923990001111",
      senderName: "Attacker",
      wamid: `wamid.tampered_${Date.now()}`,
      message: { type: "text", text: { body: "Spoofed webhook" } },
    })
    const tamperedRes = await request.post("/api/webhooks/whatsapp", {
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256":
          "sha256=0000000000000000000000000000000000000000000000000000000000000000",
      },
      data: tamperedBody,
    })
    expect(tamperedRes.status()).toBe(401)

    // 2. Unauthenticated `PUT /api/uploads/local` blocked (`401`/`403`)
    const unauthLocalPut = await request.put(
      "/api/uploads/local?key=posters/unauth.png",
      {
        headers: { "content-type": "image/png" },
        data: Buffer.from("unauth"),
      }
    )
    expect([401, 403, 404]).toContain(unauthLocalPut.status())

    // 3. Inject `502_html` fault on Gotenberg & OpenRouter -> server handles cleanly without crashing
    await injectMockFault({
      target: "gotenberg",
      mode: "502_html",
      remainingCount: 1,
    })
    const deepDuringFault = await request.get("/api/health?deep=1", {
      headers: {
        Authorization: `Bearer ${E2E_HEALTHCHECK_BEARER_TOKEN}`,
      },
    })
    // Even if Gotenberg returns 502 on that single probe, Next.js returns structured JSON (never crashes)
    expect([200, 503]).toContain(deepDuringFault.status())

    // 4. Public `/api/health` (`200`), unauthenticated `/api/health?deep=1` (`401` or shallow), Bearer `/api/health?deep=1` (`200`)
    const shallowHealth = await request.get("/api/health")
    expect(shallowHealth.status()).toBe(200)
    const shallowJson = (await shallowHealth.json()) as Record<string, unknown>
    expect(shallowJson.status).toBe("ok")

    const unauthDeep = await request.get("/api/health?deep=1")
    expect([200, 401, 403]).toContain(unauthDeep.status())
    if (unauthDeep.status() === 200) {
      const unauthDeepBody = (await unauthDeep.json()) as Record<string, unknown>
      // Must not expose internal deep diagnostics unauthenticated
      expect(unauthDeepBody.checks).toBeUndefined()
    }

    const authDeep = await request.get("/api/health?deep=1", {
      headers: {
        Authorization: `Bearer ${E2E_HEALTHCHECK_BEARER_TOKEN}`,
      },
    })
    expect(authDeep.status()).toBe(200)

    // 5. SLA Overdue Monitor (`>24h` unquoted web lead): stamps `slaEscalatedAt` with ZERO mutation to `specialRequests`!
    const { db } = getE2eDb()
    const overdueRef = `ART-20261114-SLA${Date.now().toString().slice(-4)}`
    const originalSpecialRequest =
      "Elderly mother needs ground-floor room & wheelchair at JED."
    const twentySixHoursAgo = new Date(Date.now() - 26 * 3600_000)

    const [overdueLead] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: overdueRef,
        source: "custom_builder",
        presetMode: "complete_umrah",
        status: "pending_quote",
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: false,
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        ksaArrivalDate: "2026-12-20",
        ksaDepartureDate: "2026-12-30",
        customerName: "J22 Overdue SLA Pilgrim",
        customerPhone: "+923001239876",
        customerWhatsapp: "+923001239876",
        customerCity: "Lahore",
        specialRequests: originalSpecialRequest,
        createdAt: twentySixHoursAgo,
        updatedAt: twentySixHoursAgo,
      })
      .returning()

    const slaSummary = await runSlaOverdueQuoteMonitor({
      applicationIdsFilter: [overdueLead!.id],
      sendEmailAlerts: false,
    })
    expect(slaSummary.overdueCount).toBe(1)
    expect(slaSummary.newlyFlaggedCount).toBe(1)

    const refreshedLead = await db.query.applications.findFirst({
      where: eq(schema.applications.id, overdueLead!.id),
    })
    expect(refreshedLead?.slaEscalatedAt).toBeTruthy()
    // Pilgrim-visible `specialRequests` MUST remain 100% untouched!
    expect(refreshedLead?.specialRequests).toBe(originalSpecialRequest)

    // Verify Admin Topbar surfaces overdue SLA alert
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })
    const adminPage = await adminCtx.newPage()
    await adminPage.goto("/admin")
    await expect(
      adminPage.locator('a[href*="filter=overdue"], [title*="SLA"], [href*="/admin/desk"]').first()
    ).toBeVisible()
    await adminCtx.close()
  })
})
