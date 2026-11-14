import "./test-env"
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_PKT_POSTING_SLOTS,
  PKT_TIMEZONE,
  PKT_UTC_OFFSET_HOURS,
  parsePktSlotToUtc,
  formatPktDateKey,
  formatPktTime,
  formatPktTime12h,
  formatPktDate,
  findNextFreePostingSlot,
  bucketPostsByPktDate,
  generateCalendarGridDays,
  generateWeekGridDays,
} from "../lib/social/time-slots"

import {
  buildDeterministicSocialCaptions,
  generateSocialCaptionsCopilot,
} from "../lib/social/caption-copilot"

import {
  pollInstagramContainerFinished,
} from "../lib/social/providers/instagram"

import {
  resolveTikTokPublishedPostId,
} from "../lib/social/providers/tiktok"

import {
  platformCaptionsSchema,
  engagementPlugConfigSchema,
  rescheduleSocialPostSchema,
  generateSocialCaptionsCopilotSchema,
} from "../lib/validations/social-scheduler"

describe("Slice 39 (Spec 0020): Postiz Phase 3 Calendar Slots, AI Copilot, and Provider Hardening", () => {
  // --------------------------------------------------------------------------
  // 1. PKT Time-Slot Queue & Calendar Calculations
  // --------------------------------------------------------------------------
  describe("1. PKT Time-Slot Queue & Calendar Calculations", () => {
    it("exports default PKT posting slots at 11:00 AM, 4:00 PM, and 9:00 PM", () => {
      assert.equal(PKT_TIMEZONE, "Asia/Karachi")
      assert.equal(PKT_UTC_OFFSET_HOURS, 5)
      assert.deepEqual(DEFAULT_PKT_POSTING_SLOTS, ["11:00", "16:00", "21:00"])
    })

    it("parses PKT date and slot string to exact UTC timestamp", () => {
      // 11:00 PKT on 2026-11-15 -> 06:00 UTC
      const utc11 = parsePktSlotToUtc("2026-11-15", "11:00")
      assert.equal(utc11.toISOString(), "2026-11-15T06:00:00.000Z")

      // 16:00 PKT on 2026-11-15 -> 11:00 UTC
      const utc16 = parsePktSlotToUtc("2026-11-15", "16:00")
      assert.equal(utc16.toISOString(), "2026-11-15T11:00:00.000Z")

      // 21:00 PKT on 2026-11-15 -> 16:00 UTC
      const utc21 = parsePktSlotToUtc("2026-11-15", "21:00")
      assert.equal(utc21.toISOString(), "2026-11-15T16:00:00.000Z")
    })

    it("formats UTC dates into PKT date strings, 24h time, and 12h labels", () => {
      // 2026-11-15T06:00:00Z is 11:00 in PKT
      const date = new Date("2026-11-15T06:00:00.000Z")
      assert.equal(formatPktDateKey(date), "2026-11-15")
      assert.equal(formatPktTime(date), "11:00")
      assert.equal(formatPktTime12h(date), "11:00 AM")

      // 2026-11-15T16:30:00Z is 21:30 in PKT
      const eveningDate = new Date("2026-11-15T16:30:00.000Z")
      assert.equal(formatPktDateKey(eveningDate), "2026-11-15")
      assert.equal(formatPktTime(eveningDate), "21:30")
      assert.equal(formatPktTime12h(eveningDate), "9:30 PM")

      // Cross-midnight test: 2026-11-15T22:00:00Z is 2026-11-16 03:00 PKT
      const lateDate = new Date("2026-11-15T22:00:00.000Z")
      assert.equal(formatPktDateKey(lateDate), "2026-11-16")
      assert.equal(formatPktTime(lateDate), "03:00")
    })

    it("findNextFreePostingSlot picks the next valid PKT slot on the same day when ahead by >= 15 min", () => {
      // Current time: 08:00 PKT on 2026-11-15 (03:00 UTC)
      const now = new Date("2026-11-15T03:00:00.000Z")
      const nextSlot = findNextFreePostingSlot([], now)

      assert.equal(formatPktDateKey(nextSlot), "2026-11-15")
      assert.equal(formatPktTime(nextSlot), "11:00")
      assert.equal(nextSlot.toISOString(), "2026-11-15T06:00:00.000Z")
    })

    it("findNextFreePostingSlot jumps to next slot if a collision exists within +/- 30 minutes", () => {
      // Current time: 08:00 PKT (03:00 UTC)
      const now = new Date("2026-11-15T03:00:00.000Z")
      // An existing post is scheduled for 11:15 PKT (within 30 mins of 11:00)
      const existingCollision = [new Date("2026-11-15T06:15:00.000Z")]

      const nextSlot = findNextFreePostingSlot(existingCollision, now)
      assert.equal(formatPktDateKey(nextSlot), "2026-11-15")
      assert.equal(formatPktTime(nextSlot), "16:00") // 4:00 PM PKT
      assert.equal(nextSlot.toISOString(), "2026-11-15T11:00:00.000Z")
    })

    it("findNextFreePostingSlot rolls over to the next day when all current day slots have passed", () => {
      // Current time: 21:10 PKT (16:10 UTC) - 21:00 slot has already passed
      const now = new Date("2026-11-15T16:10:00.000Z")
      const nextSlot = findNextFreePostingSlot([], now)

      assert.equal(formatPktDateKey(nextSlot), "2026-11-16")
      assert.equal(formatPktTime(nextSlot), "11:00")
      assert.equal(nextSlot.toISOString(), "2026-11-16T06:00:00.000Z")
    })

    it("generateCalendarGridDays generates a full month grid aligned to Mondays (35 or 42 cells)", () => {
      // November 2026
      const grid = generateCalendarGridDays(2026, 11)
      assert.ok(grid.length === 35 || grid.length === 42)

      // First day of grid must be Monday
      const firstCellDate = new Date(grid[0].dateUtcStart.getTime() + 5 * 3600 * 1000)
      assert.equal(firstCellDate.getUTCDay(), 1) // 1 = Monday

      // Verify November 15, 2026 cell exists and is marked current month
      const nov15 = grid.find((c) => c.dateKey === "2026-11-15")
      assert.ok(nov15)
      assert.equal(nov15?.isCurrentMonth, true)
      assert.equal(nov15?.dayNumber, 15)
    })

    it("generateWeekGridDays generates exactly 7 days starting from Monday", () => {
      const anchor = new Date("2026-11-18T10:00:00.000Z") // Wednesday
      const week = generateWeekGridDays(anchor)

      assert.equal(week.length, 7)
      // Check first cell is Monday
      const firstCell = new Date(week[0].dateUtcStart.getTime() + 5 * 3600 * 1000)
      assert.equal(firstCell.getUTCDay(), 1)
      assert.equal(week[0].dateKey, "2026-11-16") // Monday before Nov 18
      assert.equal(week[6].dateKey, "2026-11-22") // Sunday
    })

    it("bucketPostsByPktDate correctly groups posts by PKT date key", () => {
      const posts = [
        { id: "post-1", scheduledFor: "2026-11-15T06:00:00.000Z" }, // 11:00 PKT Nov 15
        { id: "post-2", scheduledFor: "2026-11-15T11:00:00.000Z" }, // 16:00 PKT Nov 15
        { id: "post-3", scheduledFor: "2026-11-15T22:00:00.000Z" }, // 03:00 PKT Nov 16
      ]

      const bucketed = bucketPostsByPktDate(posts)
      assert.equal(bucketed.get("2026-11-15")?.length, 2)
      assert.equal(bucketed.get("2026-11-16")?.length, 1)
      assert.equal(bucketed.get("2026-11-16")?.[0].id, "post-3")
    })
  })

  // --------------------------------------------------------------------------
  // 2. AI Social Caption Copilot & Luxury Haramain Fallback
  // --------------------------------------------------------------------------
  describe("2. AI Social Caption Copilot & Luxury Haramain Fallback", () => {
    it("generates deterministic captions for all 5 platforms with luxury Haramain tone and pricing", () => {
      const result = buildDeterministicSocialCaptions({
        postCode: "ART-404",
        title: "Ramadan 15-Day Executive Umrah",
        quadPricePkr: 385000,
        triplePricePkr: 415000,
        doublePricePkr: 460000,
      })

      // 3 hooks generated
      assert.equal(result.hooks.length, 3)

      // Platform captions
      assert.ok(result.captions.instagram)
      assert.ok(result.captions.facebook)
      assert.ok(result.captions.tiktok)
      assert.ok(result.captions.youtube)
      assert.ok(result.captions.gmb)

      // Instagram caption contains ART code, PKR pricing, and hashtags
      const ig = result.captions.instagram
      assert.ok(ig.caption.includes("ART-404"))
      assert.ok(ig.caption.includes("Ramadan 15-Day Executive Umrah"))
      assert.ok(ig.caption.includes("385,000"))
      assert.ok(ig.caption.includes("#AlRamlahTravels"))
      assert.ok(ig.firstComment?.includes("ART-404"))
      assert.ok(ig.firstComment?.includes("https://wa.me/"))

      // TikTok caption is punchy with viral hashtags
      const tiktok = result.captions.tiktok
      assert.ok(tiktok.caption.includes("#fyp") || tiktok.caption.includes("#viral"))
      assert.ok(tiktok.caption.includes("ART-404"))

      // YouTube caption includes #Shorts and stays compact
      const yt = result.captions.youtube
      assert.ok(yt.caption.includes("#Shorts"))

      // GMB includes formal booking CTA
      const gmb = result.captions.gmb
      assert.ok(gmb.caption.includes("Direct booking") || gmb.caption.includes("Al Ramlah Travels"))
    })

    it("generateSocialCaptionsCopilot returns fallback copy cleanly when no API keys are provided", async () => {
      const result = await generateSocialCaptionsCopilot({
        postCode: "ART-505",
        title: "5-Star Shaban Umrah Special",
      })

      assert.ok(result.hooks.length >= 3)
      assert.ok(result.captions.instagram.caption.includes("ART-505"))
      assert.ok(result.captions.facebook.caption.includes("ART-505"))
      assert.ok(result.captions.tiktok.caption.length > 0)
      assert.ok(result.captions.youtube.caption.includes("#Shorts"))
      assert.ok(result.captions.gmb.caption.length > 0)
    })
  })

  // --------------------------------------------------------------------------
  // 3. Instagram Video Container Polling
  // --------------------------------------------------------------------------
  describe("3. Instagram Video Container Polling", () => {
    it("pollInstagramContainerFinished resolves when status_code is FINISHED", async () => {
      const originalFetch = globalThis.fetch
      let callCount = 0

      // Mock fetch: first IN_PROGRESS, second FINISHED
      globalThis.fetch = (async (url: string | URL | Request) => {
        callCount++
        const urlStr = String(url)
        assert.ok(urlStr.includes("graph.facebook.com"))
        assert.ok(urlStr.includes("fields=status_code"))

        if (callCount === 1) {
          return new Response(JSON.stringify({ status_code: "IN_PROGRESS" }), { status: 200 })
        }
        return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 })
      }) as typeof fetch

      try {
        await pollInstagramContainerFinished({
          containerId: "cnt-12345",
          accessToken: "EAAB_test_token",
          maxAttempts: 3,
          delayMs: 10,
        })
        assert.equal(callCount, 2)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it("pollInstagramContainerFinished throws immediate non-retryable error on ERROR status", async () => {
      const originalFetch = globalThis.fetch

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ status_code: "ERROR" }), { status: 200 })
      }) as typeof fetch

      try {
        await assert.rejects(
          async () => {
            await pollInstagramContainerFinished({
              containerId: "cnt-error",
              accessToken: "EAAB_test_token",
              maxAttempts: 3,
              delayMs: 10,
            })
          },
          /processing failed with status: ERROR/
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it("pollInstagramContainerFinished throws timeout error when maxAttempts is reached", async () => {
      const originalFetch = globalThis.fetch

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ status_code: "IN_PROGRESS" }), { status: 200 })
      }) as typeof fetch

      try {
        await assert.rejects(
          async () => {
            await pollInstagramContainerFinished({
              containerId: "cnt-timeout",
              accessToken: "EAAB_test_token",
              maxAttempts: 2,
              delayMs: 5,
            })
          },
          /timed out after/
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  // --------------------------------------------------------------------------
  // 4. TikTok Publish Status & Video Permalink Resolution
  // --------------------------------------------------------------------------
  describe("4. TikTok Publish Status & Video Permalink Resolution", () => {
    it("resolves permanent TikTok video permalink when status is PUBLISH_COMPLETE", async () => {
      const originalFetch = globalThis.fetch

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url)
        assert.ok(urlStr.includes("open.tiktokapis.com/v2/post/publish/status/fetch/"))

        const body = JSON.parse(String(init?.body))
        assert.equal(body.publish_id, "v_pub_abc123")

        return new Response(
          JSON.stringify({
            data: {
              status: "PUBLISH_COMPLETE",
              publicaly_available_post_id: ["7198765432109876543"],
            },
          }),
          { status: 200 }
        )
      }) as typeof fetch

      try {
        const result = await resolveTikTokPublishedPostId({
          accessToken: "act.tiktok_token_xyz",
          publishId: "v_pub_abc123",
          username: "@alramlahtravels",
        })

        assert.equal(result.status, "PUBLISH_COMPLETE")
        assert.equal(result.publicPostId, "7198765432109876543")
        assert.equal(
          result.publishedUrl,
          "https://www.tiktok.com/@alramlahtravels/video/7198765432109876543"
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it("returns PROCESSING status without publishedUrl when video is still being uploaded or processed", async () => {
      const originalFetch = globalThis.fetch

      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            data: {
              status: "PROCESSING_DOWNLOAD",
            },
          }),
          { status: 200 }
        )
      }) as typeof fetch

      try {
        const result = await resolveTikTokPublishedPostId({
          accessToken: "act.tiktok_token_xyz",
          publishId: "v_pub_processing",
        })

        assert.equal(result.status, "PROCESSING_DOWNLOAD")
        assert.equal(result.publicPostId, undefined)
        assert.equal(result.publishedUrl, undefined)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  // --------------------------------------------------------------------------
  // 5. Validation Schemas & Reactive Engagement Auto-Plug
  // --------------------------------------------------------------------------
  describe("5. Validation Schemas & Reactive Engagement Auto-Plug", () => {
    it("validates per-platform captions schema with optional platform overrides", () => {
      const validPayload = {
        instagram: {
          caption: "Instagram specific caption #Umrah",
          firstComment: "Drop ART-101 for booking!",
        },
        tiktok: {
          caption: "TikTok viral caption #fyp",
        },
      }

      const parsed = platformCaptionsSchema.parse(validPayload)
      assert.equal(parsed.instagram?.caption, "Instagram specific caption #Umrah")
      assert.equal(parsed.instagram?.firstComment, "Drop ART-101 for booking!")
      assert.equal(parsed.tiktok?.caption, "TikTok viral caption #fyp")
      assert.equal(parsed.facebook, undefined)
    })

    it("validates engagementPlugConfig schema with minLikes, minViews, and plugText", () => {
      const validConfig = {
        enabled: true,
        minLikes: 50,
        minViews: 500,
        plugText: "⚡ High inquiry volume! Only 3 double rooms remaining. DM or WhatsApp +92 300 0000000",
        triggeredAt: null,
      }

      const parsed = engagementPlugConfigSchema.parse(validConfig)
      assert.ok(parsed)
      assert.equal(parsed?.enabled, true)
      assert.equal(parsed?.minLikes, 50)
      assert.equal(parsed?.minViews, 500)
    })

    it("evaluates reactive engagement trigger condition correctly and prevents double triggering", () => {
      const config = {
        enabled: true,
        minLikes: 50,
        minViews: 1000,
        plugText: "Urgent update!",
        triggeredAt: null as string | null,
      }

      // Case 1: Below thresholds -> should NOT trigger
      const lowMetrics = { likes: 30, views: 500 }
      const shouldTriggerLow =
        config.enabled &&
        !config.triggeredAt &&
        (lowMetrics.likes >= config.minLikes || lowMetrics.views >= config.minViews)
      assert.equal(shouldTriggerLow, false)

      // Case 2: Likes threshold met -> should trigger
      const highLikes = { likes: 55, views: 600 }
      const shouldTriggerLikes =
        config.enabled &&
        !config.triggeredAt &&
        (highLikes.likes >= config.minLikes || highLikes.views >= config.minViews)
      assert.equal(shouldTriggerLikes, true)

      // Case 3: Already triggered -> idempotency prevents re-triggering
      config.triggeredAt = new Date().toISOString()
      const shouldTriggerAgain =
        config.enabled &&
        !config.triggeredAt &&
        (highLikes.likes >= config.minLikes || highLikes.views >= config.minViews)
      assert.equal(shouldTriggerAgain, false)
    })

    it("validates rescheduleSocialPostSchema requiring postId and valid ISO date", () => {
      const valid = rescheduleSocialPostSchema.safeParse({
        postId: "11111111-1111-4111-8111-111111111111",
        newScheduledFor: "2026-11-20T11:00:00.000Z",
      })
      assert.equal(valid.success, true)

      const invalid = rescheduleSocialPostSchema.safeParse({
        postId: "not-a-uuid",
        newScheduledFor: "invalid-date",
      })
      assert.equal(invalid.success, false)
    })
  })
})
