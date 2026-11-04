import "dotenv/config"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import sharp from "sharp"
import { encryptToken, decryptToken } from "../lib/social/crypto"
import {
  normalizeImageForSocialBuffer,
  inspectImageDimensions,
} from "../lib/social/normalize-media"
import {
  instagramProvider,
  facebookProvider,
  tiktokProvider,
  youtubeProvider,
  gmbProvider,
  getSocialProvider,
  SOCIAL_PROVIDERS,
} from "../lib/social/providers/index"
import type { SocialPostPayload } from "../lib/social/types"

describe("OAuth Token Encryption and Decryption (AES-256-GCM)", () => {
  it("encrypts and decrypts OAuth tokens in a round trip", () => {
    const sensitiveToken =
      "ya29.a0AfH6SMB_google_oauth_refresh_token_example_1234567890_xyz"
    const encrypted = encryptToken(sensitiveToken)

    assert.ok(encrypted.length > 0)
    const parts = encrypted.split(":")
    assert.equal(parts.length, 3)

    const [ivHex, authTagHex, ciphertextHex] = parts
    assert.equal(ivHex.length, 24) // 12 bytes IV
    assert.equal(authTagHex.length, 32) // 16 bytes auth tag
    assert.ok(ciphertextHex.length > 0)

    const decrypted = decryptToken(encrypted)
    assert.equal(decrypted, sensitiveToken)
  })

  it("generates a unique random IV on every token encryption call", () => {
    const token = "fixed_oauth_secret_value"
    const enc1 = encryptToken(token)
    const enc2 = encryptToken(token)
    const enc3 = encryptToken(token)

    assert.notEqual(enc1, enc2)
    assert.notEqual(enc2, enc3)
    assert.notEqual(enc1, enc3)

    const iv1 = enc1.split(":")[0]
    const iv2 = enc2.split(":")[0]
    const iv3 = enc3.split(":")[0]

    assert.notEqual(iv1, iv2)
    assert.notEqual(iv2, iv3)

    assert.equal(decryptToken(enc1), token)
    assert.equal(decryptToken(enc2), token)
    assert.equal(decryptToken(enc3), token)
  })

  it("rejects tampered auth tag by throwing an authentication error", () => {
    const encrypted = encryptToken("test_secret_token_data")
    const [ivHex, authTagHex, ctHex] = encrypted.split(":")

    const flippedTag = (authTagHex[0] === "0" ? "1" : "0") + authTagHex.slice(1)
    const tamperedPayload = `${ivHex}:${flippedTag}:${ctHex}`

    assert.throws(() => {
      decryptToken(tamperedPayload)
    }, /Decryption failed: Token authentication tag mismatch/)
  })

  it("rejects tampered ciphertext by throwing an authentication error", () => {
    const encrypted = encryptToken("test_secret_token_data")
    const [ivHex, authTagHex, ctHex] = encrypted.split(":")

    const flippedCt = (ctHex[0] === "a" ? "b" : "a") + ctHex.slice(1)
    const tamperedPayload = `${ivHex}:${authTagHex}:${flippedCt}`

    assert.throws(() => {
      decryptToken(tamperedPayload)
    }, /Decryption failed: Token authentication tag mismatch/)
  })

  it("rejects tampered IV by throwing an authentication error", () => {
    const encrypted = encryptToken("test_secret_token_data")
    const [ivHex, authTagHex, ctHex] = encrypted.split(":")

    const flippedIv = (ivHex[0] === "e" ? "f" : "e") + ivHex.slice(1)
    const tamperedPayload = `${flippedIv}:${authTagHex}:${ctHex}`

    assert.throws(() => {
      decryptToken(tamperedPayload)
    }, /Decryption failed: Token authentication tag mismatch/)
  })

  it("rejects invalid payload format or invalid IV and tag lengths", () => {
    assert.throws(() => {
      decryptToken("only_one_part_without_colons")
    }, /Invalid encrypted token format/)

    assert.throws(() => {
      decryptToken("iv:tag:ct:extra")
    }, /Invalid encrypted token format/)

    assert.throws(() => {
      decryptToken("abcd:1234:5678")
    }, /Invalid IV length/)

    const validIvHex = "0123456789abcdef01234567" // 12 bytes = 24 hex chars
    assert.throws(() => {
      decryptToken(`${validIvHex}:shorttag:5678abcd`)
    }, /Invalid auth tag length/)
  })

  it("handles empty string gracefully", () => {
    assert.equal(encryptToken(""), "")
    assert.equal(decryptToken(""), "")
  })
})

describe("Sharp Image Normalization and Dimension Inspection", () => {
  it("normalizes oversized 3240x4560 poster to crisp 1080x1520 progressive JPEG", async () => {
    const inputWidth = 3240
    const inputHeight = 4560

    const inputPngBuffer = await sharp({
      create: {
        width: inputWidth,
        height: inputHeight,
        channels: 4,
        background: { r: 18, g: 30, b: 49, alpha: 1 },
      },
    })
      .png()
      .toBuffer()

    const initialDims = await inspectImageDimensions(inputPngBuffer)
    assert.equal(initialDims.width, 3240)
    assert.equal(initialDims.height, 4560)
    assert.equal(initialDims.format, "png")

    const normalized = await normalizeImageForSocialBuffer(inputPngBuffer)

    assert.equal(normalized.format, "jpeg")
    assert.ok(Math.min(normalized.width, normalized.height) <= 1080)
    assert.equal(normalized.width, 1080)
    assert.equal(normalized.height, 1520)

    const finalDims = await inspectImageDimensions(normalized.buffer)
    assert.equal(finalDims.width, 1080)
    assert.equal(finalDims.height, 1520)
    assert.equal(finalDims.format, "jpeg")
  })

  it("preserves dimensions of already compliant images while converting to progressive JPEG", async () => {
    const compliantBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer()

    const normalized = await normalizeImageForSocialBuffer(compliantBuffer)
    assert.equal(normalized.format, "jpeg")
    assert.equal(normalized.width, 800)
    assert.equal(normalized.height, 600)
    assert.ok(Math.min(normalized.width, normalized.height) <= 1080)
  })

  it("normalizes landscape oversized image so shorter side does not exceed 1080px", async () => {
    const landscape4k = await sharp({
      create: {
        width: 3840,
        height: 2160,
        channels: 4,
        background: { r: 50, g: 50, b: 50, alpha: 1 },
      },
    })
      .png()
      .toBuffer()

    const normalized = await normalizeImageForSocialBuffer(landscape4k)
    assert.equal(normalized.format, "jpeg")
    assert.equal(normalized.height, 1080)
    assert.equal(normalized.width, 1920)
    assert.ok(Math.min(normalized.width, normalized.height) <= 1080)
  })
})

describe("Social Provider Adapters Validation (Core 5)", () => {
  it("resolves all Core 5 provider adapters via registry lookup", () => {
    assert.equal(getSocialProvider("instagram"), instagramProvider)
    assert.equal(getSocialProvider("facebook"), facebookProvider)
    assert.equal(getSocialProvider("tiktok"), tiktokProvider)
    assert.equal(getSocialProvider("youtube"), youtubeProvider)
    assert.equal(getSocialProvider("gmb"), gmbProvider)

    assert.equal(Object.keys(SOCIAL_PROVIDERS).length, 5)

    assert.throws(() => {
      // @ts-expect-error Testing invalid provider id
      getSocialProvider("unsupported_network")
    }, /Unsupported social provider/)
  })

  describe("Instagram Provider Adapter", () => {
    it("Instagram: rejects post without caption or exceeding 2200 characters", () => {
      const emptyCaptionRes = instagramProvider.validateSocialPost({
        id: "ig-1",
        caption: "   ",
        media: [{ url: "https://example.com/photo.jpg", type: "image" }],
      })
      assert.equal(emptyCaptionRes.valid, false)
      assert.ok(
        emptyCaptionRes.errors.includes("Caption is required for Instagram posts.")
      )

      const longCaptionRes = instagramProvider.validateSocialPost({
        id: "ig-2",
        caption: "A".repeat(2201),
        media: [{ url: "https://example.com/photo.jpg", type: "image" }],
      })
      assert.equal(longCaptionRes.valid, false)
      assert.ok(
        longCaptionRes.errors.some((err) =>
          err.includes("exceeds Instagram limit of 2,200 characters")
        )
      )
    })

    it("Instagram: rejects post with empty media attachments", () => {
      const emptyMediaRes = instagramProvider.validateSocialPost({
        id: "ig-3",
        caption: "Umrah Mubarak from Al Ramlah Travels",
        media: [],
      })
      assert.equal(emptyMediaRes.valid, false)
      assert.ok(
        emptyMediaRes.errors.includes(
          "Instagram posts require at least one photo or video attachment."
        )
      )
    })

    it("Instagram: rejects carousel with more than 10 attachments", () => {
      const elevenItems = Array.from({ length: 11 }, (_, i) => ({
        url: `https://example.com/item-${i + 1}.jpg`,
        type: "image" as const,
      }))

      const overLimitRes = instagramProvider.validateSocialPost({
        id: "ig-4",
        caption: "Umrah packages showcase",
        media: elevenItems,
      })
      assert.equal(overLimitRes.valid, false)
      assert.ok(
        overLimitRes.errors.includes(
          "Instagram carousels support up to 10 attachments (provided: 11)."
        )
      )
    })

    it("Instagram: accepts valid single feed photo, video, and 2 to 10 image carousel", () => {
      const validSingle = instagramProvider.validateSocialPost({
        id: "ig-5",
        caption: "Al Ramlah 21-day Economy Package ART-AM-21D-01",
        media: [
          { url: "https://r2.alramlahtravels.com/flyer-1.jpg", type: "image" },
        ],
      })
      assert.equal(validSingle.valid, true)
      assert.equal(validSingle.errors.length, 0)

      const validVideo = instagramProvider.validateSocialPost({
        id: "ig-6",
        caption: "Watch our Makkah hotel tour",
        media: [
          { url: "https://r2.alramlahtravels.com/tour.mp4", type: "video" },
        ],
      })
      assert.equal(validVideo.valid, true)
      assert.equal(validVideo.errors.length, 0)

      const validCarousel = instagramProvider.validateSocialPost({
        id: "ig-7",
        caption: "Browse our 4 package tiers for Ramadan 2026",
        media: Array.from({ length: 4 }, (_, i) => ({
          url: `https://r2.alramlahtravels.com/card-${i + 1}.jpg`,
          type: "image" as const,
        })),
      })
      assert.equal(validCarousel.valid, true)
      assert.equal(validCarousel.errors.length, 0)
    })
  })

  describe("Facebook Provider Adapter", () => {
    it("Facebook: rejects post with neither caption nor media", () => {
      const emptyRes = facebookProvider.validateSocialPost({
        id: "fb-1",
        caption: "   ",
        media: [],
      })
      assert.equal(emptyRes.valid, false)
      assert.ok(
        emptyRes.errors.includes(
          "Facebook posts require at least text content or media attachments."
        )
      )
    })

    it("Facebook: rejects caption exceeding 63206 characters", () => {
      const longRes = facebookProvider.validateSocialPost({
        id: "fb-2",
        caption: "F".repeat(63207),
        media: [],
      })
      assert.equal(longRes.valid, false)
      assert.ok(
        longRes.errors.some((err) =>
          err.includes("Facebook post caption exceeds limit of 63,206 characters")
        )
      )
    })

    it("Facebook: accepts text only post without media", () => {
      const textOnly = facebookProvider.validateSocialPost({
        id: "fb-3",
        caption:
          "Important announcement: Umrah visa applications for Ramadan 2026 are now open!",
        media: [],
      })
      assert.equal(textOnly.valid, true)
      assert.equal(textOnly.errors.length, 0)
    })

    it("Facebook: accepts single photo, album multi photo, and video posts", () => {
      const singlePhoto = facebookProvider.validateSocialPost({
        id: "fb-4",
        caption: "Exclusive package update",
        media: [
          { url: "https://r2.alramlahtravels.com/fb-post.jpg", type: "image" },
        ],
      })
      assert.equal(singlePhoto.valid, true)

      const multiPhoto = facebookProvider.validateSocialPost({
        id: "fb-5",
        caption: "Hotel room categories overview",
        media: Array.from({ length: 6 }, (_, i) => ({
          url: `https://r2.alramlahtravels.com/room-${i + 1}.jpg`,
          type: "image" as const,
        })),
      })
      assert.equal(multiPhoto.valid, true)

      const singleVideo = facebookProvider.validateSocialPost({
        id: "fb-6",
        caption: "Pilgrim orientation seminar recording",
        media: [
          { url: "https://r2.alramlahtravels.com/seminar.mp4", type: "video" },
        ],
      })
      assert.equal(singleVideo.valid, true)
    })
  })

  describe("TikTok Provider Adapter", () => {
    it("TikTok: rejects empty media attachments", () => {
      const emptyRes = tiktokProvider.validateSocialPost({
        id: "tt-1",
        caption: "TikTok video caption",
        media: [],
      })
      assert.equal(emptyRes.valid, false)
      assert.ok(
        emptyRes.errors.includes(
          "TikTok posts require at least one photo or video attachment."
        )
      )
    })

    it("TikTok: rejects captions exceeding 2000 characters", () => {
      const longRes = tiktokProvider.validateSocialPost({
        id: "tt-2",
        caption: "T".repeat(2001),
        media: [
          { url: "https://r2.alramlahtravels.com/reel.mp4", type: "video" },
        ],
      })
      assert.equal(longRes.valid, false)
      assert.ok(
        longRes.errors.some((err) =>
          err.includes("TikTok caption exceeds limit of 2,000 characters")
        )
      )
    })

    it("TikTok: rejects mixed video and photo attachments or multiple video attachments", () => {
      const mixedRes = tiktokProvider.validateSocialPost({
        id: "tt-3",
        caption: "Mixed media post",
        media: [
          { url: "https://r2.alramlahtravels.com/clip.mp4", type: "video" },
          { url: "https://r2.alramlahtravels.com/poster.jpg", type: "image" },
        ],
      })
      assert.equal(mixedRes.valid, false)
      assert.ok(
        mixedRes.errors.includes(
          "TikTok only supports multiple items when all attachments are photos (images)."
        )
      )
    })

    it("TikTok: rejects photo posts with more than 35 images", () => {
      const thirtySixPhotos = Array.from({ length: 36 }, (_, i) => ({
        url: `https://r2.alramlahtravels.com/photo-${i + 1}.jpg`,
        type: "image" as const,
      }))
      const overLimitRes = tiktokProvider.validateSocialPost({
        id: "tt-4",
        caption: "Huge gallery",
        media: thirtySixPhotos,
      })
      assert.equal(overLimitRes.valid, false)
      assert.ok(
        overLimitRes.errors.includes(
          "TikTok photo posts support up to 35 images (provided: 36)."
        )
      )
    })

    it("TikTok: enforces shorter side constraint <= 1080px and guides normalization", () => {
      const oversizedItem = {
        url: "https://r2.alramlahtravels.com/flyer-4k.jpg",
        type: "image" as const,
        width: 3240,
        height: 4560,
      }
      const unnormalizedRes = tiktokProvider.validateSocialPost({
        id: "tt-5",
        caption: "Oversized flyer test",
        media: [oversizedItem],
      })
      assert.equal(unnormalizedRes.valid, false)
      assert.ok(
        unnormalizedRes.errors.some((err) =>
          err.includes(
            "exceeds TikTok's maximum shorter side limit of 1080px. Run normalizeImageForSocialBuffer first."
          )
        )
      )

      const normalizedItem = {
        url: "https://r2.alramlahtravels.com/flyer-normalized.jpg",
        type: "image" as const,
        width: 1080,
        height: 1520,
      }
      const normalizedRes = tiktokProvider.validateSocialPost({
        id: "tt-6",
        caption: "Normalized flyer post",
        media: [normalizedItem],
      })
      assert.equal(normalizedRes.valid, true)
      assert.equal(normalizedRes.errors.length, 0)
    })

    it("TikTok: accepts valid single video post and valid photo series", () => {
      const validVideo = tiktokProvider.validateSocialPost({
        id: "tt-7",
        caption: "Makkah Clock Tower view from our hotel",
        media: [
          { url: "https://r2.alramlahtravels.com/makkah.mp4", type: "video" },
        ],
      })
      assert.equal(validVideo.valid, true)

      const validPhotos = tiktokProvider.validateSocialPost({
        id: "tt-8",
        caption: "Swipe through our 5 star executive package details",
        media: [
          {
            url: "https://r2.alramlahtravels.com/p1.jpg",
            type: "image",
            width: 1080,
            height: 1350,
          },
          {
            url: "https://r2.alramlahtravels.com/p2.jpg",
            type: "image",
            width: 1080,
            height: 1350,
          },
        ],
      })
      assert.equal(validPhotos.valid, true)
    })
  })

  describe("YouTube Provider Adapter", () => {
    it("YouTube: rejects post with non video or image only attachments", () => {
      const imageRes = youtubeProvider.validateSocialPost({
        id: "yt-1",
        title: "Test Image Title",
        caption: "Test description",
        media: [
          { url: "https://r2.alramlahtravels.com/flyer.jpg", type: "image" },
        ],
      })
      assert.equal(imageRes.valid, false)
      assert.ok(
        imageRes.errors.includes(
          "YouTube attachment must be an MP4 video file."
        )
      )
    })

    it("YouTube: rejects empty media or multiple video attachments", () => {
      const zeroMediaRes = youtubeProvider.validateSocialPost({
        id: "yt-2",
        title: "No Media Title",
        caption: "Description",
        media: [],
      })
      assert.equal(zeroMediaRes.valid, false)
      assert.ok(
        zeroMediaRes.errors.includes(
          "YouTube requires exactly one video attachment per post."
        )
      )

      const twoVideosRes = youtubeProvider.validateSocialPost({
        id: "yt-3",
        title: "Two Videos Title",
        caption: "Description",
        media: [
          { url: "https://example.com/v1.mp4", type: "video" },
          { url: "https://example.com/v2.mp4", type: "video" },
        ],
      })
      assert.equal(twoVideosRes.valid, false)
      assert.ok(
        twoVideosRes.errors.includes(
          "YouTube requires exactly one video attachment per post."
        )
      )
    })

    it("YouTube: rejects video title exceeding 100 characters", () => {
      const longTitleRes = youtubeProvider.validateSocialPost({
        id: "yt-4",
        title: "Y".repeat(101),
        caption: "Valid description",
        media: [
          { url: "https://r2.alramlahtravels.com/walkthrough.mp4", type: "video" },
        ],
      })
      assert.equal(longTitleRes.valid, false)
      assert.ok(
        longTitleRes.errors.some((err) =>
          err.includes("YouTube video title exceeds limit of 100 characters")
        )
      )
    })

    it("YouTube: rejects video description exceeding 5000 characters", () => {
      const longDescRes = youtubeProvider.validateSocialPost({
        id: "yt-5",
        title: "Valid Title",
        caption: "D".repeat(5001),
        media: [
          { url: "https://r2.alramlahtravels.com/walkthrough.mp4", type: "video" },
        ],
      })
      assert.equal(longDescRes.valid, false)
      assert.ok(
        longDescRes.errors.some((err) =>
          err.includes(
            "YouTube description exceeds limit of 5,000 characters"
          )
        )
      )
    })

    it("YouTube: accepts valid single MP4 video post with title and description", () => {
      const validVideoRes = youtubeProvider.validateSocialPost({
        id: "yt-6",
        title: "Complete Umrah Guide 2026: Al Ramlah Travels",
        caption:
          "Full step-by-step walkthrough of Umrah rituals, hotel check-in in Makkah, and Ziyarat sectors.",
        media: [
          {
            url: "https://r2.alramlahtravels.com/umrah-guide-2026.mp4",
            type: "video",
          },
        ],
      })
      assert.equal(validVideoRes.valid, true)
      assert.equal(validVideoRes.errors.length, 0)
    })
  })

  describe("Google Business Profile (GMB) Provider Adapter", () => {
    it("GMB: rejects empty text summary caption or captions exceeding 1500 characters", () => {
      const emptyCaptionRes = gmbProvider.validateSocialPost({
        id: "gmb-1",
        caption: "   ",
        media: [],
      })
      assert.equal(emptyCaptionRes.valid, false)
      assert.ok(
        emptyCaptionRes.errors.includes(
          "Google Business Profile posts require text summary content."
        )
      )

      const longCaptionRes = gmbProvider.validateSocialPost({
        id: "gmb-2",
        caption: "G".repeat(1501),
        media: [],
      })
      assert.equal(longCaptionRes.valid, false)
      assert.ok(
        longCaptionRes.errors.some((err) =>
          err.includes(
            "Google Business Profile post summary exceeds limit of 1,500 characters"
          )
        )
      )
    })

    it("GMB: rejects multiple images and rejects MP4 video attachments", () => {
      const twoImagesRes = gmbProvider.validateSocialPost({
        id: "gmb-3",
        caption: "Special discount on Umrah packages",
        media: [
          { url: "https://r2.alramlahtravels.com/gmb1.jpg", type: "image" },
          { url: "https://r2.alramlahtravels.com/gmb2.jpg", type: "image" },
        ],
      })
      assert.equal(twoImagesRes.valid, false)
      assert.ok(
        twoImagesRes.errors.includes(
          "Google Business Profile local posts support at most one photo attachment."
        )
      )

      const videoRes = gmbProvider.validateSocialPost({
        id: "gmb-4",
        caption: "Video update",
        media: [
          { url: "https://r2.alramlahtravels.com/promo.mp4", type: "video" },
        ],
      })
      assert.equal(videoRes.valid, false)
      assert.ok(
        videoRes.errors.includes(
          "Google Business Profile local posts do not support video attachments. Please attach a photo."
        )
      )
    })

    it("GMB: accepts single image post with OFFER call to action and coupon details", () => {
      const offerPost: SocialPostPayload = {
        id: "gmb-5",
        caption:
          "Save PKR 25,000 on family Umrah bookings for Ramadan 2026. Visit our Lahore office or book online today.",
        media: [
          {
            url: "https://r2.alramlahtravels.com/ramadan-offer-poster.jpg",
            type: "image",
          },
        ],
        postType: "offer",
        callToActionType: "LEARN_MORE",
        callToActionUrl: "https://alramlahtravels.com/packages/ramadan-2026",
        offerDetails: {
          couponCode: "RAMADAN25K",
          redeemUrl: "https://alramlahtravels.com/apply",
          terms: "Valid for bookings confirmed before December 31, 2026.",
        },
      }

      const res = gmbProvider.validateSocialPost(offerPost)
      assert.equal(res.valid, true)
      assert.equal(res.errors.length, 0)
    })

    it("GMB: accepts standard text only update without media", () => {
      const textOnly = gmbProvider.validateSocialPost({
        id: "gmb-6",
        caption:
          "Our Lahore head office is open Monday through Saturday from 10:00 AM to 7:00 PM for Umrah consultations.",
        media: [],
      })
      assert.equal(textOnly.valid, true)
      assert.equal(textOnly.errors.length, 0)
    })
  })
})
