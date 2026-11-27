// covers: AC-2, AC-3, AC-5, AC-6, AC-7, AC-8, AC-9
import "../setup/hermetic-env"
import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/catalog",
  useSearchParams: () => new URLSearchParams("tab=cms"),
}))

import { PUT as localUploadPutHandler } from "@/app/api/uploads/local/route"
import { POST as presignPostHandler } from "@/app/api/uploads/presign/route"
import { GET as localRangeGetHandler } from "@/app/uploads/r2-local/[...key]/route"
import { ContentClient } from "@/components/admin/catalog/content-client"
import {
  HeroSlider,
  HOME_HERO_PRIMARY_H1,
  type PublicHeroSlide,
} from "@/components/public/hero-slider"
import { deleteR2Objects, writeLocalFallbackObject } from "@/lib/storage/r2"
import {
  extractManagedHeroSlidesKey,
  MAX_HERO_SLIDE_MEDIA_BYTES,
  setRouteAdminVerifierForTests,
  validateHeroSlideFolderAndMime,
} from "@/lib/storage/upload-security"
import { heroSlideSchema } from "@/lib/validations/cms"

const WEB_ROOT = process.cwd()

const VALID_MP4_HEADER = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
])

const VALID_JPEG_HEADER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
])

const VALID_MOV_HEADER = Buffer.from([
  0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20, 0x00,
  0x00, 0x02, 0x00, 0x71, 0x74, 0x20, 0x20,
])

describe("Spec 0030: Hybrid Hero Video, Upload RBAC, Range Streaming & Role-Aware Admin CMS", () => {
  const keysToClean: string[] = []

  afterEach(async () => {
    setRouteAdminVerifierForTests(null)
    if (keysToClean.length > 0) {
      await deleteR2Objects(keysToClean.splice(0, keysToClean.length))
    }
  })

  it("AC-6 & AC-9: renders zero <video> tags on SSR, strictly 1 <h1> & 1 <img>, 3 default fallback slides, and keeps planner untouched", () => {
    const hybridSlides: PublicHeroSlide[] = [
      {
        id: "slide-video-1",
        badge: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        title: "Sanctuary Courtyard Motion",
        subtitle: "Calm ambient Haramain video layered over an instant poster.",
        imageUrl:
          "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=1600",
        videoUrl: "https://r2.alramlahtravels.com/cms/hero-slides/videos/1.mp4",
        primaryCtaLabel: "Plan Custom Journey",
        primaryCtaUrl: "/#journey-builder",
        secondaryCtaLabel: "Explore Group Packages",
        secondaryCtaUrl: "/umrah-packages",
      },
      {
        id: "slide-photo-2",
        badge: "Madinah Markaziyah",
        title: "Peace Facing the Green Dome",
        subtitle: "Steps from Ladies Gate 25.",
        imageUrl:
          "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600",
        videoUrl: null,
        primaryCtaLabel: "View Madinah Hotels",
        primaryCtaUrl: "/hotels/madinah",
      },
    ]

    const ssrHtml = renderToStaticMarkup(<HeroSlider slides={hybridSlides} />)
    expect(ssrHtml).toContain(HOME_HERO_PRIMARY_H1.replace("&", "&amp;"))
    expect((ssrHtml.match(/<h1\b/gi) ?? []).length).toBe(1)
    expect((ssrHtml.match(/<img\b/gi) ?? []).length).toBe(1)
    expect((ssrHtml.match(/<video\b/gi) ?? []).length).toBe(0)
    expect(ssrHtml).not.toMatch(/style="[^"]*opacity:\s*0\b/i)
    expect(ssrHtml).toContain('aria-label="Slide pagination"')
    expect(ssrHtml).toContain('aria-label="Previous slide"')
    expect(ssrHtml).toContain('aria-label="Next slide"')

    // Empty slides prop falls back to 3 curated static Haramain slides
    const fallbackHtml = renderToStaticMarkup(<HeroSlider slides={[]} />)
    expect((fallbackHtml.match(/Go to slide /g) ?? []).length).toBe(3)
    expect((fallbackHtml.match(/<video\b/gi) ?? []).length).toBe(0)

    // Source-level guards (`trust-spokes` + `Spec 0026 AC-1`)
    const heroSource = fs.readFileSync(
      path.join(WEB_ROOT, "components/public/hero-slider.tsx"),
      "utf8"
    )
    const legacyImgAttr = ["pri", "ority"].join("")
    expect(new RegExp(`\\b${legacyImgAttr}\\b`).test(heroSource)).toBe(false)
    expect(heroSource).not.toContain("transition-all")
    expect(heroSource).not.toContain("framer-motion")
    expect(heroSource).toContain('"Pause background video"')
    expect(heroSource).toContain('"Play background video"')
    expect(heroSource).toContain("AbortError")

    const homePageSource = fs.readFileSync(
      path.join(WEB_ROOT, "app/(public)/page.tsx"),
      "utf8"
    )
    expect(homePageSource).toContain('id="journey-builder"')
    expect(homePageSource).toContain("videoUrl: s.videoUrl ?? null")

    const plannerDiff = execFileSync(
      "git",
      ["diff", "--name-only", "--", "components/planner"],
      { cwd: WEB_ROOT, encoding: "utf8" }
    ).trim()
    expect(plannerDiff).toBe("")
  })

  it("AC-5: gates all 4 ContentClient sub-tabs on canManageCms and displays Video + Poster vs Photo Slide badges", () => {
    const sampleSlides = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        badge: "Al Ramlah Elite",
        title: "Makkah Courtyard Video Slide",
        subtitle: "Ambient loop active.",
        imageUrl:
          "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=1600",
        videoUrl:
          "https://r2.alramlahtravels.com/cms/hero-slides/videos/loop.mp4",
        primaryCtaLabel: "Plan Journey",
        primaryCtaUrl: "#custom-builder",
        isActive: true,
        sortOrder: 0,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        badge: "Madinah",
        title: "Madinah Static Slide",
        subtitle: "Photo only slide.",
        imageUrl:
          "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600",
        videoUrl: null,
        primaryCtaLabel: "Explore",
        primaryCtaUrl: "/umrah-packages",
        isActive: true,
        sortOrder: 1,
      },
    ]
    const sampleReviews = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        pilgrimName: "Tariq Mahmood",
        city: "Lahore",
        quote: "Seamless Haramain service.",
        packageOrJourneyType: "Custom Umrah",
        rating: 5,
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
      },
    ]
    const sampleFaqs = [
      {
        id: "44444444-4444-4444-8444-444444444444",
        category: "visa" as const,
        question: "How fast is Umrah visa issuance?",
        answer: "Typically 48 to 72 hours.",
        isActive: true,
        sortOrder: 0,
      },
    ]
    const sampleHotels = [
      {
        id: "55555555-5555-4555-8555-555555555555",
        name: "Makkah Clock Royal Tower",
        city: "makkah" as const,
        starRating: 5,
        distanceMeters: 0,
        distanceLabel: "0m Courtyard",
        imageUrl:
          "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800",
        galleryUrls: [
          "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
        ],
        sharingPriceSar: 400,
        quadPriceSar: 450,
        triplePriceSar: 550,
        doublePriceSar: 700,
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
      },
    ]

    const superAdminSlidesHtml = renderToStaticMarkup(
      <ContentClient
        initialSlides={sampleSlides}
        initialTestimonials={sampleReviews}
        initialFaqs={sampleFaqs}
        initialHotels={sampleHotels}
        initialSubTab="slides"
        canManageCms={true}
      />
    )
    expect(superAdminSlidesHtml).toContain("Add Slide")
    expect(superAdminSlidesHtml).toContain("Video + Poster")
    expect(superAdminSlidesHtml).toContain("Photo Slide")
    expect(superAdminSlidesHtml).toContain("Edit slide Makkah Courtyard Video Slide")

    for (const subTab of ["slides", "reviews", "faqs", "gallery"] as const) {
      const staffHtml = renderToStaticMarkup(
        <ContentClient
          initialSlides={sampleSlides}
          initialTestimonials={sampleReviews}
          initialFaqs={sampleFaqs}
          initialHotels={sampleHotels}
          initialSubTab={subTab}
          canManageCms={false}
        />
      )
      expect(staffHtml).toContain("Super Admin Only")
      expect(staffHtml).not.toContain("Add Slide")
      expect(staffHtml).not.toContain("Add Testimonial")
      expect(staffHtml).not.toContain("Add FAQ")
      expect(staffHtml).not.toContain("Add Photo")
      expect(staffHtml).not.toContain("Save Property Gallery")
      expect(staffHtml).not.toContain("Move Up")
      expect(staffHtml).not.toContain("Move Slide Up")
    }
  })

  it("AC-3 & AC-4: validates safe asset URLs, normalizes blank videoUrl to null, and checks managed R2 origins", () => {
    const validParsed = heroSlideSchema.safeParse({
      title: "Haramain Courtyard",
      subtitle: "Five star Makkah & Madinah hospitality.",
      imageUrl: "https://r2.alramlahtravels.com/cms/hero-slides/images/p.jpg",
      videoUrl: "   ",
      primaryCtaLabel: "Plan Custom Umrah",
      primaryCtaUrl: "#custom-builder",
    })
    expect(validParsed.success).toBe(true)
    if (validParsed.success) {
      expect(validParsed.data.videoUrl).toBeNull()
    }

    for (const badUrl of [
      "javascript:alert(1)",
      "data:video/mp4;base64,AAAA",
      "http://insecure.example.com/video.mp4",
      "//evil.example.com/video.mp4",
    ]) {
      expect(
        heroSlideSchema.safeParse({
          title: "Bad Video",
          subtitle: "Unsafe scheme",
          imageUrl:
            "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa",
          videoUrl: badUrl,
        }).success
      ).toBe(false)

      expect(
        heroSlideSchema.safeParse({
          title: "Bad Poster",
          subtitle: "Unsafe scheme",
          imageUrl: badUrl,
        }).success
      ).toBe(false)
    }

    expect(
      extractManagedHeroSlidesKey(
        "https://r2.alramlahtravels.com/cms/hero-slides/videos/clip.mp4"
      )
    ).toBe("cms/hero-slides/videos/clip.mp4")
    expect(
      extractManagedHeroSlidesKey(
        "/uploads/r2-local/cms/hero-slides/images/poster.jpg"
      )
    ).toBe("cms/hero-slides/images/poster.jpg")
    expect(
      extractManagedHeroSlidesKey(
        "https://thirdparty.example.com/cms/hero-slides/videos/clip.mp4"
      )
    ).toBeNull()
    expect(
      extractManagedHeroSlidesKey(
        "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa"
      )
    ).toBeNull()
    expect(extractManagedHeroSlidesKey("/images/static-hero.jpg")).toBeNull()
  })

  it("AC-2: enforces super_admin RBAC, 25 MB cap, strict subfolder allowlist, canonical contentType, and local UUID key preservation", async () => {
    // 1. Staff gets 403 on cms/hero-slides/* presign & local upload, but 200 on flyers
    setRouteAdminVerifierForTests(() => ({ ok: true, role: "staff" }))

    const staffFlyerPresign = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "flyer.jpg",
          contentType: "image/jpg",
          folder: "flyers",
          sizeBytes: 4096,
        }),
      })
    )
    expect(staffFlyerPresign.status).toBe(200)

    const staffHeroPresign = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "loop.mp4",
          contentType: "video/mp4",
          folder: "cms/hero-slides/videos",
          sizeBytes: 4096,
        }),
      })
    )
    expect(staffHeroPresign.status).toBe(403)

    const staffHeroLocalPut = await localUploadPutHandler(
      new NextRequest(
        "http://localhost:3000/api/uploads/local?folder=cms/hero-slides/videos",
        {
          method: "PUT",
          body: new Uint8Array(VALID_MP4_HEADER),
        }
      )
    )
    expect(staffHeroLocalPut.status).toBe(403)

    // 2. Super Admin folder/MIME/size checks
    setRouteAdminVerifierForTests(() => ({ ok: true, role: "super_admin" }))

    const malformedJsonRes = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      })
    )
    expect(malformedJsonRes.status).toBe(400)

    for (const invalidBody of [
      {
        filename: "clip.mov",
        contentType: "video/quicktime",
        folder: "cms/hero-slides/videos",
        sizeBytes: 4096,
      },
      {
        filename: "too-big.mp4",
        contentType: "video/mp4",
        folder: "cms/hero-slides/videos",
        sizeBytes: MAX_HERO_SLIDE_MEDIA_BYTES + 1,
      },
      {
        filename: "wrong-slot.mp4",
        contentType: "video/mp4",
        folder: "cms/hero-slides/images",
        sizeBytes: 4096,
      },
      {
        filename: "bad-subfolder.jpg",
        contentType: "image/jpeg",
        folder: "cms/hero-slides/other",
        sizeBytes: 4096,
      },
    ]) {
      const res = await presignPostHandler(
        new Request("http://localhost:3000/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalidBody),
        })
      )
      expect(res.status).toBe(400)
    }

    expect(
      validateHeroSlideFolderAndMime({
        folder: "cms/hero-slides/other",
        canonicalMime: "image/jpeg",
        sizeBytes: 1024,
      }).ok
    ).toBe(false)

    // Valid JPG presign normalizes `image/jpg` -> `image/jpeg` in response
    const posterPresignRes = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "kaaba.jpg",
          contentType: "image/jpg",
          folder: "cms/hero-slides/images",
          sizeBytes: VALID_JPEG_HEADER.byteLength,
        }),
      })
    )
    expect(posterPresignRes.status).toBe(200)
    const posterPresignJson = (await posterPresignRes.json()) as {
      contentType: string
      key: string
    }
    expect(posterPresignJson.contentType).toBe("image/jpeg")

    // Local PUT rejects .mov on cms/hero-slides/videos (`400`) and preserves safe UUID `.jpeg` / `.mp4` keys
    const movLocalRes = await localUploadPutHandler(
      new NextRequest(
        "http://localhost:3000/api/uploads/local?folder=cms/hero-slides/videos",
        {
          method: "PUT",
          body: new Uint8Array(VALID_MOV_HEADER),
        }
      )
    )
    expect(movLocalRes.status).toBe(400)

    const uuidKey = `cms/hero-slides/videos/1795500000-${crypto.randomUUID()}.mp4`
    keysToClean.push(uuidKey)
    const mp4LocalRes = await localUploadPutHandler(
      new NextRequest(
        `http://localhost:3000/api/uploads/local?key=${encodeURIComponent(uuidKey)}`,
        {
          method: "PUT",
          body: new Uint8Array(VALID_MP4_HEADER),
        }
      )
    )
    expect(mp4LocalRes.status).toBe(200)
    const mp4LocalJson = (await mp4LocalRes.json()) as {
      storageKey: string
      publicUrl: string
    }
    expect(mp4LocalJson.storageKey).toBe(uuidKey)
    expect(mp4LocalJson.publicUrl).toBe(`/uploads/r2-local/${uuidKey}`)

    const jpegUuidKey = `cms/hero-slides/images/${crypto.randomUUID()}.jpeg`
    keysToClean.push(jpegUuidKey)
    const jpegLocalRes = await localUploadPutHandler(
      new NextRequest(
        `http://localhost:3000/api/uploads/local?key=${encodeURIComponent(jpegUuidKey)}`,
        {
          method: "PUT",
          body: new Uint8Array(VALID_JPEG_HEADER),
        }
      )
    )
    expect(jpegLocalRes.status).toBe(200)
    const jpegLocalJson = (await jpegLocalRes.json()) as { storageKey: string }
    expect(jpegLocalJson.storageKey).toBe(jpegUuidKey)
  })

  it("AC-2: streams 200 OK & 206 Partial Content byte ranges on /uploads/r2-local/[...key] while blocking production and private prefixes", async () => {
    const testKey = `cms/hero-slides/videos/range-${crypto.randomUUID()}.mp4`
    const privateKey = `passports/private-${crypto.randomUUID()}.jpg`
    keysToClean.push(testKey, privateKey)

    await writeLocalFallbackObject(testKey, VALID_MP4_HEADER, "video/mp4")
    await writeLocalFallbackObject(privateKey, VALID_JPEG_HEADER, "image/jpeg")

    // Verify stored in os.tmpdir(), NOT public/uploads/
    expect(
      fs.existsSync(path.join(os.tmpdir(), "alramlah-r2-local", ...testKey.split("/")))
    ).toBe(true)

    // Full 200 OK stream
    const fullRes = await localRangeGetHandler(
      new NextRequest(`http://localhost:3000/uploads/r2-local/${testKey}`),
      { params: Promise.resolve({ key: testKey.split("/") }) }
    )
    expect(fullRes.status).toBe(200)
    expect(fullRes.headers.get("Accept-Ranges")).toBe("bytes")
    expect(fullRes.headers.get("Content-Type")).toBe("video/mp4")
    const fullBuf = Buffer.from(await fullRes.arrayBuffer())
    expect(fullBuf.equals(VALID_MP4_HEADER)).toBe(true)

    // 206 Partial Content (`bytes=4-7` === "ftyp")
    const rangeRes = await localRangeGetHandler(
      new NextRequest(`http://localhost:3000/uploads/r2-local/${testKey}`, {
        headers: { Range: "bytes=4-7" },
      }),
      { params: Promise.resolve({ key: testKey.split("/") }) }
    )
    expect(rangeRes.status).toBe(206)
    expect(rangeRes.headers.get("Content-Range")).toBe(
      `bytes 4-7/${VALID_MP4_HEADER.byteLength}`
    )
    expect(Buffer.from(await rangeRes.arrayBuffer()).toString("ascii")).toBe(
      "ftyp"
    )

    // Suffix range (`bytes=-4` === "iso2")
    const suffixRes = await localRangeGetHandler(
      new NextRequest(`http://localhost:3000/uploads/r2-local/${testKey}`, {
        headers: { Range: "bytes=-4" },
      }),
      { params: Promise.resolve({ key: testKey.split("/") }) }
    )
    expect(suffixRes.status).toBe(206)
    expect(Buffer.from(await suffixRes.arrayBuffer()).toString("ascii")).toBe(
      "iso2"
    )

    // Out-of-bounds range -> 416 with Content-Range: bytes */total
    const invalidRangeRes = await localRangeGetHandler(
      new NextRequest(`http://localhost:3000/uploads/r2-local/${testKey}`, {
        headers: { Range: "bytes=9999-10000" },
      }),
      { params: Promise.resolve({ key: testKey.split("/") }) }
    )
    expect(invalidRangeRes.status).toBe(416)
    expect(invalidRangeRes.headers.get("Content-Range")).toBe(
      `bytes */${VALID_MP4_HEADER.byteLength}`
    )

    // Malformed URI -> 400
    const badUriRes = await localRangeGetHandler(
      new NextRequest("http://localhost:3000/uploads/r2-local/%E0%A4%A"),
      { params: Promise.resolve({ key: ["%E0%A4%A"] }) }
    )
    expect(badUriRes.status).toBe(400)

    // Private prefix (`passports/`) -> 404
    const privateRes = await localRangeGetHandler(
      new NextRequest(`http://localhost:3000/uploads/r2-local/${privateKey}`),
      { params: Promise.resolve({ key: privateKey.split("/") }) }
    )
    expect(privateRes.status).toBe(404)

    // Real production (`NODE_ENV=production` without `AUDIT_E2E_LOCAL=1`) -> 404
    const prevNodeEnv = process.env.NODE_ENV
    const prevAuditLocal = process.env.AUDIT_E2E_LOCAL
    try {
      ;(process.env as Record<string, string | undefined>).NODE_ENV =
        "production"
      delete process.env.AUDIT_E2E_LOCAL
      const prodRes = await localRangeGetHandler(
        new NextRequest(`http://localhost:3000/uploads/r2-local/${testKey}`),
        { params: Promise.resolve({ key: testKey.split("/") }) }
      )
      expect(prodRes.status).toBe(404)
    } finally {
      ;(process.env as Record<string, string | undefined>).NODE_ENV =
        prevNodeEnv
      if (prevAuditLocal !== undefined) {
        process.env.AUDIT_E2E_LOCAL = prevAuditLocal
      }
    }
  })
})
