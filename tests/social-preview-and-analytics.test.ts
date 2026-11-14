import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  CORE5_ASPECT_RATIOS,
  CORE5_CHARACTER_LIMITS,
  CORE5_FOLD_LIMITS,
  formatCore5Preview,
} from "../lib/social/preview-formatter"
import {
  aggregateCampaignAnalytics,
  computeEngagementRate,
  type PostTargetAnalyticsSnapshot,
} from "../lib/social/analytics"

describe("Slice 35 (Spec 0016): Core 5 Preview Formatter & Analytics Rollup", () => {
  it("exports accurate Core 5 character limits, fold limits, and aspect ratios", () => {
    assert.deepEqual(CORE5_CHARACTER_LIMITS, {
      instagram: 2200,
      facebook: 63206,
      tiktok: 2200,
      youtube: 5000,
      gmb: 1500,
    })

    assert.deepEqual(CORE5_FOLD_LIMITS, {
      instagram: 125,
      facebook: 250,
      tiktok: 90,
      youtube: 100,
      gmb: 180,
    })

    assert.deepEqual(CORE5_ASPECT_RATIOS, {
      FEED: "4:5",
      REEL: "9:16",
      STORY: "9:16",
    })
  })

  it("formats Instagram FEED preview with fold truncation, hashtag extraction, and pinned ART-... first comment", () => {
    const longCaption =
      "🕋 Executive 15-Day Ramadan Umrah Package from Lahore (Askari 10 & DHA) with 5-Star Makkah Clock Tower & Madinah Pullman Zamzam hotels! Book today for guaranteed visa & Saudia direct flights. #Umrah2026 #AlRamlahTravels #Lahore"

    const preview = formatCore5Preview({
      provider: "instagram",
      caption: longCaption,
      postType: "FEED",
      publishMode: "SINGLE",
      mediaUrls: ["https://cdn.alramlahtravels.com/posters/art-101.jpg"],
      postCode: "ART-101",
      packageTitle: "15-Day Executive Umrah",
      quadPricePkr: 365000,
      triplePricePkr: 395000,
      doublePricePkr: 440000,
      autoFirstComment: true,
    })

    assert.equal(preview.provider, "instagram")
    assert.equal(preview.charCount, longCaption.length)
    assert.equal(preview.charLimit, 2200)
    assert.equal(preview.remainingChars, 2200 - longCaption.length)
    assert.equal(preview.isOverLimit, false)
    assert.equal(preview.isTruncatedAtFold, true)
    assert.ok(preview.foldPreviewText.endsWith("..."))
    assert.deepEqual(preview.hashtags, [
      "#Umrah2026",
      "#AlRamlahTravels",
      "#Lahore",
    ])
    assert.equal(preview.aspectRatio, "4:5")
    assert.ok(preview.pinnedFirstComment)
    assert.match(preview.pinnedFirstComment!, /ART-101/)
    assert.match(preview.pinnedFirstComment!, /PKR 365,000/)
    assert.match(preview.pinnedFirstComment!, /https:\/\/wa\.me\/923274029701/)
  })

  it("enforces character limits and emits warnings when captions exceed platform thresholds", () => {
    const overGmbText = "A".repeat(1550)
    const gmbSnap = formatCore5Preview({
      provider: "gmb",
      caption: overGmbText,
      postType: "FEED",
    })

    assert.equal(gmbSnap.isOverLimit, true)
    assert.equal(gmbSnap.remainingChars, -50)
    assert.ok(
      gmbSnap.warnings.some((w) => w.includes("exceeds 1,500 characters"))
    )

    const overIgText = "B".repeat(2205)
    const igSnap = formatCore5Preview({
      provider: "instagram",
      caption: overIgText,
      postType: "FEED",
    })
    assert.equal(igSnap.isOverLimit, true)
    assert.equal(igSnap.remainingChars, -5)
  })

  it("enforces 9:16 aspect ratio on TikTok & YouTube Shorts and 4:5 on GMB regardless of postType", () => {
    const tiktokSnap = formatCore5Preview({
      provider: "tiktok",
      caption: "Umrah reel preview #TikTokUmrah",
      postType: "FEED",
      mediaUrls: ["https://cdn.alramlahtravels.com/videos/reel.mp4"],
      autoFirstComment: true,
      postCode: "ART-202",
    })
    assert.equal(tiktokSnap.aspectRatio, "9:16")
    assert.equal(tiktokSnap.pinnedFirstComment, null)

    const ytSnap = formatCore5Preview({
      provider: "youtube",
      caption: "Short Umrah Guide #Shorts",
      postType: "REEL",
      mediaUrls: ["https://cdn.alramlahtravels.com/videos/short.mp4"],
      autoFirstComment: true,
      postCode: "ART-202",
    })
    assert.equal(ytSnap.aspectRatio, "9:16")
    assert.ok(ytSnap.pinnedFirstComment)
    assert.match(ytSnap.pinnedFirstComment!, /ART-202/)

    const gmbSnap = formatCore5Preview({
      provider: "gmb",
      caption: "Visit our Askari 10 & DHA Lahore branch for Umrah bookings.",
      postType: "REEL",
      postCode: "ART-303",
      whatsappNumber: "03274029701",
    })
    assert.equal(gmbSnap.aspectRatio, "4:5")
    assert.ok(gmbSnap.gmbCallToAction)
    assert.match(
      gmbSnap.gmbCallToAction!.url,
      /^https:\/\/wa\.me\/923274029701\?text=/
    )
    assert.match(gmbSnap.gmbCallToAction!.url, /ART-303/)
  })

  it("builds dual Spotlight Frame 1 & Rate Sheet Frame 2 when publishMode is SPOTLIGHT_THEN_SHEET", () => {
    const snap = formatCore5Preview({
      provider: "facebook",
      caption: "2-Step Attention Grabber Campaign",
      postType: "FEED",
      publishMode: "SPOTLIGHT_THEN_SHEET",
      spotlightMediaUrl: "https://cdn.alramlahtravels.com/spotlight-1.jpg",
      sheetMediaUrl: "https://cdn.alramlahtravels.com/rate-sheet-2.jpg",
      postCode: "ART-505",
      autoFirstComment: true,
    })

    assert.equal(snap.mediaFrames.length, 2)
    assert.equal(snap.mediaFrames[0]?.stage, "spotlight")
    assert.equal(
      snap.mediaFrames[0]?.url,
      "https://cdn.alramlahtravels.com/spotlight-1.jpg"
    )
    assert.equal(snap.mediaFrames[1]?.stage, "rate_sheet")
    assert.equal(
      snap.mediaFrames[1]?.url,
      "https://cdn.alramlahtravels.com/rate-sheet-2.jpg"
    )
    assert.equal(snap.isCarousel, true)
  })

  it("aggregates cross-channel campaign analytics across all 5 providers and handles zero-view division safely", () => {
    // 1. Zero-view safety check
    const emptyOverview = aggregateCampaignAnalytics([])
    assert.equal(emptyOverview.totalViews, 0)
    assert.equal(emptyOverview.engagementRatePct, 0)
    assert.equal(
      computeEngagementRate({
        views: 0,
        likes: 10,
        comments: 5,
        shares: 2,
        clicks: 3,
      }),
      0
    )

    // 2. Multi-platform rollup check
    const targets: PostTargetAnalyticsSnapshot[] = [
      {
        targetId: "t-ig",
        postId: "p-1",
        postCode: "ART-101",
        provider: "instagram",
        views: 1000,
        likes: 80,
        comments: 15,
        shares: 10,
        clicks: 25,
      },
      {
        targetId: "t-fb",
        postId: "p-1",
        postCode: "ART-101",
        provider: "facebook",
        views: 500,
        likes: 30,
        comments: 5,
        shares: 5,
        clicks: 10,
      },
      {
        targetId: "t-gmb",
        postId: "p-2",
        postCode: "ART-202",
        provider: "gmb",
        views: 500,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 20,
      },
    ]

    const overview = aggregateCampaignAnalytics(targets)
    assert.equal(overview.totalPosts, 3)
    assert.equal(overview.totalViews, 2000)
    assert.equal(overview.totalLikes, 110)
    assert.equal(overview.totalComments, 20)
    assert.equal(overview.totalShares, 15)
    assert.equal(overview.totalClicks, 55)
    // Total engagements = 110 + 20 + 15 + 55 = 200; (200 / 2000) * 100 = 10%
    assert.equal(overview.engagementRatePct, 10)

    assert.equal(overview.byPlatform.instagram.views, 1000)
    assert.equal(overview.byPlatform.instagram.engagementRatePct, 13)
    assert.equal(overview.byPlatform.facebook.views, 500)
    assert.equal(overview.byPlatform.facebook.engagementRatePct, 10)
    assert.equal(overview.byPlatform.gmb.clicks, 20)
    assert.equal(overview.byPlatform.gmb.engagementRatePct, 4)
    assert.equal(overview.byPlatform.tiktok.views, 0)
    assert.equal(overview.byPlatform.youtube.views, 0)

    assert.equal(overview.topPosts[0]?.targetId, "t-ig")
  })
})
