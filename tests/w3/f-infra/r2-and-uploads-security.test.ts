import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { after, before, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { eq } from "drizzle-orm"
import { NextRequest } from "next/server"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { auth, provisionStaffAccountInternal } from "../../../lib/auth"
import * as r2Module from "../../../lib/storage/r2"
import { setRouteAdminVerifierForTests } from "../../../lib/storage/upload-security"
import { POST as localPostHandler, PUT as localPutHandler } from "../../../app/api/uploads/local/route"
import { POST as presignPostHandler } from "../../../app/api/uploads/presign/route"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, "../../..")

// Minimal valid magic-byte fixtures
const VALID_PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
])

const VALID_PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "utf8")

function withEnvOverrides<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key]
    const nextVal = overrides[key]
    if (nextVal === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = nextVal
    }
  }
  return fn().finally(() => {
    for (const [key, prevVal] of Object.entries(saved)) {
      if (prevVal === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = prevVal
      }
    }
  })
}

describe("F-INFRA T-014: R2 Production Fail-Closed, Hardened Uploads & Private PII Media Proxy", () => {
  let adminCookie = ""
  let testUserId = ""

  before(async () => {
    const email = `finfra-admin-${crypto.randomBytes(4).toString("hex")}@alramlahtravels.com`
    const password = `InfraPass!${crypto.randomBytes(8).toString("hex")}`
    try {
      const created = await provisionStaffAccountInternal({
        email,
        password,
        name: "Infra Test Admin",
        role: "super_admin",
        mustChangePassword: false,
      })
      testUserId = created.id

      const signInResponse = await auth.api.signInEmail({
        body: { email, password },
        asResponse: true,
      })
      const rawSetCookie = signInResponse.headers.get("set-cookie") ?? ""
      adminCookie = rawSetCookie
        .split(",")
        .map((part) => part.split(";")[0]?.trim() ?? "")
        .filter(Boolean)
        .join("; ")
      assert.ok(adminCookie.length > 0, "Expected Better Auth session cookie for test admin")
    } catch (err) {
      const causeCode =
        err &&
        typeof err === "object" &&
        "cause" in err &&
        err.cause &&
        typeof err.cause === "object" &&
        "code" in err.cause
          ? String((err.cause as { code?: unknown }).code)
          : ""
      if (causeCode !== "ECONNREFUSED") {
        throw err
      }
      const fallbackToken = crypto.randomBytes(24).toString("hex")
      adminCookie = `better-auth.session_token=${fallbackToken}`
      setRouteAdminVerifierForTests((req) => {
        const cookieHeader = req.headers.get("cookie") ?? ""
        if (cookieHeader.includes(adminCookie)) {
          return { ok: true }
        }
        return {
          ok: false,
          status: 401,
          error: "Unauthorized: Admin access required",
        }
      })
    }
  })

  after(async () => {
    setRouteAdminVerifierForTests(null)
    if (testUserId) {
      await db.delete(schema.session).where(eq(schema.session.userId, testUserId))
      await db.delete(schema.account).where(eq(schema.account.userId, testUserId))
      await db.delete(schema.user).where(eq(schema.user.id, testUserId))
    }
    await closeDatabasePool()
  })

  it("T-014: removes ~/.wrangler scraping from lib/storage/r2.ts and fails closed in NODE_ENV=production without writing to public/", async () => {
    const r2Source = fs.readFileSync(
      path.join(WEB_ROOT, "lib/storage/r2.ts"),
      "utf8"
    )
    assert.ok(
      !r2Source.includes(".wrangler") && !r2Source.includes("resolveWranglerOauthToken"),
      "lib/storage/r2.ts must not scrape ~/.wrangler OAuth tokens"
    )

    await withEnvOverrides(
      {
        NODE_ENV: "production",
        R2_ACCOUNT_ID: undefined,
        R2_ACCESS_KEY_ID: undefined,
        R2_SECRET_ACCESS_KEY: undefined,
        R2_BUCKET_NAME: undefined,
        R2_PUBLIC_URL: undefined,
      },
      async () => {
        await assert.rejects(
          () =>
            r2Module.uploadAssetToR2(
              "posters/sheets/should-never-write.png",
              VALID_PNG_BYTES,
              "image/png"
            ),
          /production|R2/i
        )

        await assert.rejects(
          () =>
            r2Module.createPresignedUploadUrl({
              filename: "banner.png",
              contentType: "image/png",
              folder: "posters",
              sizeBytes: 1024,
            }),
          /production|R2/i
        )
      }
    )

    const leakedPath = path.join(
      WEB_ROOT,
      "public/uploads/r2-local/posters/sheets/should-never-write.png"
    )
    assert.equal(fs.existsSync(leakedPath), false)
  })

  it("T-014: /api/uploads/local returns 404 in production, blocks unauthenticated requests, rejects HTML/SVG/JS, and writes UUID keys in dev", async () => {
    // 1. 404 in production even with valid admin session
    await withEnvOverrides({ NODE_ENV: "production" }, async () => {
      const prodReq = new NextRequest(
        "http://localhost:3000/api/uploads/local?key=uploads/test.png",
        {
          method: "PUT",
          headers: { cookie: adminCookie, "content-type": "image/png" },
          body: VALID_PNG_BYTES,
        }
      )
      const prodRes = await localPutHandler(prodReq)
      assert.equal(prodRes.status, 404)
    })

    // 2. 401 when unauthenticated in dev
    const unauthReq = new NextRequest(
      "http://localhost:3000/api/uploads/local?key=uploads/test.png",
      {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: VALID_PNG_BYTES,
      }
    )
    const unauthRes = await localPutHandler(unauthReq)
    assert.equal(unauthRes.status, 401)

    // 3. Reject HTML / SVG polyglot uploads (stored XSS defense)
    const htmlPayload = Buffer.from(
      "<!DOCTYPE html><html><body><script>alert(1)</script></body></html>",
      "utf8"
    )
    const htmlReq = new NextRequest(
      "http://localhost:3000/api/uploads/local?key=uploads/evil.html",
      {
        method: "PUT",
        headers: { cookie: adminCookie, "content-type": "text/html" },
        body: htmlPayload,
      }
    )
    const htmlRes = await localPutHandler(htmlReq)
    assert.ok(
      htmlRes.status === 400 || htmlRes.status === 415,
      `Expected 400/415 for HTML upload, got ${htmlRes.status}`
    )

    const svgPayload = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
      "utf8"
    )
    const svgReq = new NextRequest(
      "http://localhost:3000/api/uploads/local?key=uploads/evil.svg",
      {
        method: "POST",
        headers: { cookie: adminCookie, "content-type": "image/svg+xml" },
        body: svgPayload,
      }
    )
    const svgRes = await localPostHandler(svgReq)
    assert.ok(
      svgRes.status === 400 || svgRes.status === 415,
      `Expected 400/415 for SVG upload, got ${svgRes.status}`
    )

    // 4. Valid PNG with authenticated admin gets UUID storage key (never raw caller filename)
    const validReq = new NextRequest(
      "http://localhost:3000/api/uploads/local?key=posters/custom-name.html",
      {
        method: "PUT",
        headers: { cookie: adminCookie, "content-type": "image/png" },
        body: VALID_PNG_BYTES,
      }
    )
    const validRes = await localPutHandler(validReq)
    assert.equal(validRes.status, 200)
    const validJson = (await validRes.json()) as {
      success: boolean
      storageKey: string
      publicUrl: string
      url: string
    }
    assert.equal(validJson.success, true)
    assert.match(
      validJson.storageKey,
      /^posters\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i
    )
    assert.ok(!validJson.storageKey.endsWith(".html"))
    assert.equal(validJson.url, validJson.publicUrl)

    // Clean up local fallback file via deleteR2Objects
    const r2WithDelete = r2Module as typeof r2Module & {
      deleteR2Objects: (keys: readonly string[]) => Promise<unknown>
    }
    await r2WithDelete.deleteR2Objects([validJson.storageKey])
  })

  it("T-014: /api/uploads/presign enforces requireAdmin(), accepts bounded video/mp4 & video/quicktime, and binds ContentLength", async () => {
    // Unauthenticated rejected
    const unauthPresign = await presignPostHandler(
      new NextRequest("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: "reel.mp4",
          contentType: "video/mp4",
          folder: "social-media",
          sizeBytes: 12_000_000,
        }),
      })
    )
    assert.equal(unauthPresign.status, 401)

    // Missing sizeBytes rejected so ContentLength is always enforced
    const missingSizeRes = await presignPostHandler(
      new NextRequest("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: JSON.stringify({
          filename: "reel.mp4",
          contentType: "video/mp4",
          folder: "social-media",
        }),
      })
    )
    assert.equal(missingSizeRes.status, 400)

    // Oversized >250MB video rejected
    const oversizedVideoRes = await presignPostHandler(
      new NextRequest("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: JSON.stringify({
          filename: "huge.mp4",
          contentType: "video/mp4",
          folder: "social-media",
          sizeBytes: 300 * 1024 * 1024,
        }),
      })
    )
    assert.equal(oversizedVideoRes.status, 400)

    // Valid MP4 + QuickTime MOV succeed and sign ContentLength into R2 PutObject URL
    await withEnvOverrides(
      {
        R2_ACCOUNT_ID: "testaccount1234567890",
        R2_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
        R2_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        R2_BUCKET_NAME: "al-ramlah-assets",
        R2_PUBLIC_URL: "https://cdn.alramlahtravels.com",
      },
      async () => {
        const mp4Res = await presignPostHandler(
          new NextRequest("http://localhost:3000/api/uploads/presign", {
            method: "POST",
            headers: { cookie: adminCookie, "content-type": "application/json" },
            body: JSON.stringify({
              filename: "umrah-reel.mp4",
              contentType: "video/mp4",
              folder: "social-media",
              sizeBytes: 15_728_640,
            }),
          })
        )
        assert.equal(mp4Res.status, 200)
        const mp4Body = (await mp4Res.json()) as {
          success: boolean
          uploadUrl: string
          publicUrl: string
          mode: string
        }
        assert.equal(mp4Body.success, true)
        assert.equal(mp4Body.mode, "r2_presigned")
        assert.match(mp4Body.uploadUrl, /X-Amz-SignedHeaders=[^&]*content-length/i)

        const movRes = await presignPostHandler(
          new NextRequest("http://localhost:3000/api/uploads/presign", {
            method: "POST",
            headers: { cookie: adminCookie, "content-type": "application/json" },
            body: JSON.stringify({
              filename: "haramain-story.mov",
              contentType: "video/quicktime",
              folder: "social-media",
              sizeBytes: 8_388_608,
            }),
          })
        )
        assert.equal(movRes.status, 200)
      }
    )
  })

  it("T-014 & OD-06: gates private PII prefixes (passports/, whatsapp-media/, quotes/, receipts/) behind admin auth or 10m HMAC tokens via /api/media/[...key]", async () => {
    const mediaRouteModule = (await import(
      "../../../app/api/media/[...key]/route"
    )) as {
      GET: (
        req: NextRequest,
        ctx: { params: Promise<{ key: string[] }> }
      ) => Promise<Response>
    }

    const r2Extended = r2Module as typeof r2Module & {
      isPrivateMediaKey: (key: string) => boolean
      createSignedMediaProxyUrl: (
        key: string,
        opts?: { ttlSeconds?: number; baseUrl?: string; nowMs?: number }
      ) => string
      verifySignedMediaProxyToken: (params: {
        key: string
        exp: string | number | null | undefined
        sig: string | null | undefined
        nowMs?: number
      }) => boolean
      deleteR2Objects: (keys: readonly string[]) => Promise<unknown>
      setR2S3ClientOverrideForTests?: (
        client: { send: (cmd: PutObjectCommand | GetObjectCommand | DeleteObjectsCommand) => Promise<unknown> } | null
      ) => void
    }

    assert.equal(r2Extended.isPrivateMediaKey("passports/pilgrim-01.pdf"), true)
    assert.equal(r2Extended.isPrivateMediaKey("whatsapp-media/acc/conv/m1.jpg"), true)
    assert.equal(r2Extended.isPrivateMediaKey("quotes/art-2026-abcd.pdf"), true)
    assert.equal(r2Extended.isPrivateMediaKey("receipts/meezan-slip.png"), true)
    assert.equal(r2Extended.isPrivateMediaKey("posters/sheets/public.png"), false)

    // Upload a private passport PDF in local test mode -> URL must route through /api/media/, never /uploads/r2-local/
    const privateKey = `passports/test-${crypto.randomUUID()}.pdf`
    const uploaded = await r2Module.uploadAssetToR2(
      privateKey,
      VALID_PDF_BYTES,
      "application/pdf"
    )
    assert.ok(
      uploaded.url.startsWith("/api/media/passports/"),
      `Private PII key must never return public URL; got ${uploaded.url}`
    )

    try {
      const keySegments = privateKey.split("/")

      // 1. Anonymous request without token -> 401
      const anonRes = await mediaRouteModule.GET(
        new NextRequest(`http://localhost:3000/api/media/${privateKey}`),
        { params: Promise.resolve({ key: keySegments }) }
      )
      assert.equal(anonRes.status, 401)
      assert.match(
        anonRes.headers.get("Cache-Control") ?? "",
        /private.*no-store|no-store.*private/i
      )

      // 2. Expired HMAC token -> 401
      const pastNow = Date.now() - 20 * 60 * 1000
      const expiredSignedUrl = r2Extended.createSignedMediaProxyUrl(privateKey, {
        ttlSeconds: 600,
        baseUrl: "http://localhost:3000",
        nowMs: pastNow,
      })
      const expiredRes = await mediaRouteModule.GET(
        new NextRequest(expiredSignedUrl),
        { params: Promise.resolve({ key: keySegments }) }
      )
      assert.equal(expiredRes.status, 401)

      // 3. Valid 10m HMAC-signed query token -> 200 private bytes (in local mode) or 302 presigned GET (when R2 configured)
      const validSignedUrl = r2Extended.createSignedMediaProxyUrl(privateKey, {
        ttlSeconds: 600,
        baseUrl: "http://localhost:3000",
      })
      const signedRes = await mediaRouteModule.GET(
        new NextRequest(validSignedUrl),
        { params: Promise.resolve({ key: keySegments }) }
      )
      assert.equal(signedRes.status, 200)
      assert.match(
        signedRes.headers.get("Cache-Control") ?? "",
        /private.*no-store|no-store.*private/i
      )
      const bodyBuf = Buffer.from(await signedRes.arrayBuffer())
      assert.deepEqual(bodyBuf, VALID_PDF_BYTES)

      // 4. Authenticated admin session without query token -> 302 short-lived presigned R2 GET redirect when R2 is configured
      await withEnvOverrides(
        {
          R2_ACCOUNT_ID: "testaccount1234567890",
          R2_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
          R2_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          R2_BUCKET_NAME: "al-ramlah-private",
        },
        async () => {
          const adminRes = await mediaRouteModule.GET(
            new NextRequest(`http://localhost:3000/api/media/${privateKey}`, {
              headers: { cookie: adminCookie },
            }),
            { params: Promise.resolve({ key: keySegments }) }
          )
          assert.equal(adminRes.status, 302)
          assert.match(
            adminRes.headers.get("Cache-Control") ?? "",
            /private.*no-store|no-store.*private/i
          )
          const location = adminRes.headers.get("location") ?? ""
          assert.match(location, /r2\.cloudflarestorage\.com/i)
          assert.match(location, /X-Amz-Expires=(300|600|900)/i)
        }
      )
    } finally {
      await r2Extended.deleteR2Objects([privateKey])
    }
  })
})
