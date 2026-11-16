import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { inArray } from "drizzle-orm"

import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db, withTransaction } from "../../../db"
import * as schema from "../../../db/schema"
import {
  DEFAULT_PKT_POSTING_SLOTS,
  findNextFreePostingSlot,
  formatPktDateTimeLocal,
  parsePktDateTimeLocal,
  parsePktSlotToUtc,
  reserveNextFreePostingSlotInTx,
} from "../../../lib/social/time-slots"
import { generateSocialCaptionsFallback } from "../../../lib/social/caption-copilot"
import { formatCore5Preview } from "../../../lib/social/preview-formatter"
import { navigateCalendarDate } from "../../../components/admin/campaigns/social-calendar-view"
import { normalizeCampaignsTab } from "../../../components/admin/hubs/campaigns-hub-client"

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

describe("F-SOCIAL T-089 & OD-10: PKT Time-Slots, Day-14+ Overflow, Transactional Slot Reservation, Askari 10 Brand Copy & Calendar/Tab Routing", () => {
  const createdPostIds: string[] = []

  after(async () => {
    if (createdPostIds.length > 0) {
      await db
        .delete(schema.scheduledPosts)
        .where(inArray(schema.scheduledPosts.id, createdPostIds))
    }
    await closeDatabasePool()
  })

  it("T-089a: round-trips PKT datetime-local (+05:00), overflows cleanly past Day 14, and serializes concurrent transactional slot reservations", async () => {
    // 1. PKT datetime-local round-trip invariant (16:00 PKT == 11:00 UTC)
    const utc11 = parsePktDateTimeLocal("2027-03-15T16:00")
    assert.equal(utc11.toISOString(), "2027-03-15T11:00:00.000Z")
    assert.equal(formatPktDateTimeLocal(utc11), "2027-03-15T16:00")

    // 2. Day 14+ overflow: fill all 42 peak slots across Days 0..13 (14 days * 3 slots)
    const fromUtc = parsePktSlotToUtc("2027-04-01", "08:00")
    const occupiedDates: Date[] = []
    for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
      const dayStr = `2027-04-${String(1 + dayOffset).padStart(2, "0")}`
      for (const slot of DEFAULT_PKT_POSTING_SLOTS) {
        occupiedDates.push(parsePktSlotToUtc(dayStr, slot))
      }
    }
    assert.equal(occupiedDates.length, 42)

    const overflowSlot = findNextFreePostingSlot(occupiedDates, fromUtc)
    assert.equal(
      overflowSlot.toISOString(),
      parsePktSlotToUtc("2027-04-15", "11:00").toISOString(),
      "When Days 0..13 are full, must pick Day 14 11:00 PKT without colliding with occupied slots"
    )

    // 3. Concurrent PostgreSQL transactional reservation via pg_advisory_xact_lock
    // Pick a far-future anchor date so no existing rows interfere
    const futureAnchor = parsePktSlotToUtc("2034-06-10", "08:00")
    const reserveAndInsert = async (label: string) =>
      withTransaction(async (tx) => {
        const reserved = await reserveNextFreePostingSlotInTx(tx, {
          now: futureAnchor,
        })
        const [inserted] = await tx
          .insert(schema.scheduledPosts)
          .values({
            caption: `Concurrent slot test ${label}`,
            postType: "single_image",
            postFormat: "FEED",
            mediaUrls: ["https://pub-12345.r2.dev/posters/slot.jpg"],
            socialJpegUrls: ["https://pub-12345.r2.dev/posters/slot.jpg"],
            campaignStage: "standalone",
            status: "scheduled",
            scheduledFor: reserved,
          })
          .returning()
        return inserted!
      })

    const suffix = crypto.randomBytes(3).toString("hex")
    const [postA, postB] = await Promise.all([
      reserveAndInsert(`A-${suffix}`),
      reserveAndInsert(`B-${suffix}`),
    ])
    createdPostIds.push(postA.id, postB.id)

    assert.notEqual(
      postA.scheduledFor.getTime(),
      postB.scheduledFor.getTime(),
      "Concurrent transactional slot reservations must never double-book the same PKT slot"
    )
  })

  it("T-089b: purges fabricated 'DHA Phase 5' & retired gemini-3.8-* IDs across caption-copilot, preview-formatter & UI", () => {
    const filesToCheck = [
      "lib/social/caption-copilot.ts",
      "lib/social/preview-formatter.ts",
      "components/admin/campaigns/social-platform-preview.tsx",
      "components/admin/hubs/campaigns-hub-client.tsx",
    ]

    for (const rel of filesToCheck) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), "utf8")
      assert.doesNotMatch(
        src,
        /DHA Phase 5|Askari 10\s*&\s*DHA|Askari 10\s*&amp;\s*DHA|#DHALahore|gemini-3\.8/i,
        `Forbidden fabricated address or retired model ID found in ${rel}`
      )
    }

    const fallback = generateSocialCaptionsFallback({
      postCode: "ART-HQ-01",
      title: "15-Day Executive Umrah Package",
      sharingPricePkr: 315_000,
    })
    assert.match(fallback.captions.gmb.caption, /Askari 10/i)
    assert.doesNotMatch(fallback.captions.gmb.caption, /DHA Phase 5/i)

    const gmbPreview = formatCore5Preview({
      provider: "gmb",
      caption: fallback.captions.gmb.caption,
      postCode: "ART-HQ-01",
    })
    assert.match(
      gmbPreview.gmbCallToAction?.verifiedBadgeLabel || "",
      /Askari 10/i
    )
    assert.doesNotMatch(
      gmbPreview.gmbCallToAction?.verifiedBadgeLabel || "",
      /DHA/i
    )
  })

  it("T-089c: fixes month rollover navigation, adds mobile calendar agenda responsiveness, and aligns /admin/{distribution,outreach,social} tab routing", () => {
    // Month rollover: March 31 -> Prev must land in February (month index 1), NOT March!
    const mar31 = new Date("2026-03-31T12:00:00.000Z")
    const prevFromMar31 = navigateCalendarDate(mar31, -1, "month")
    assert.equal(prevFromMar31.getUTCFullYear(), 2026)
    assert.equal(prevFromMar31.getUTCMonth(), 1) // February

    // Jan 31 -> Next must land in February (month index 1), NOT March!
    const jan31 = new Date("2026-01-31T12:00:00.000Z")
    const nextFromJan31 = navigateCalendarDate(jan31, 1, "month")
    assert.equal(nextFromJan31.getUTCFullYear(), 2026)
    assert.equal(nextFromJan31.getUTCMonth(), 1) // February

    // Responsive calendar classes check
    const calSrc = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "components/admin/campaigns/social-calendar-view.tsx"
      ),
      "utf8"
    )
    assert.match(calSrc, /md:hidden/)
    assert.match(calSrc, /overflow-x-auto/)
    assert.match(calSrc, /min-w-\[680px\]/)

    // Redirect pages check
    const distPage = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "app/admin/(dashboard)/distribution/page.tsx"
      ),
      "utf8"
    )
    const outreachPage = fs.readFileSync(
      path.resolve(process.cwd(), "app/admin/(dashboard)/outreach/page.tsx"),
      "utf8"
    )
    const socialPage = fs.readFileSync(
      path.resolve(process.cwd(), "app/admin/(dashboard)/social/page.tsx"),
      "utf8"
    )

    assert.match(distPage, /\/admin\/campaigns\?tab=whatsapp/)
    assert.match(outreachPage, /\/admin\/campaigns\?tab=outreach/)
    assert.match(socialPage, /\/admin\/campaigns\?tab=social/)

    // Query-param alias normalization
    assert.equal(normalizeCampaignsTab("whatsapp"), "whatsapp")
    assert.equal(normalizeCampaignsTab("distribution"), "whatsapp")
    assert.equal(normalizeCampaignsTab("groups"), "whatsapp")
    assert.equal(normalizeCampaignsTab("outreach"), "outreach")
    assert.equal(normalizeCampaignsTab("broadcasts"), "outreach")
    assert.equal(normalizeCampaignsTab("vip"), "outreach")
    assert.equal(normalizeCampaignsTab("social"), "social")
    assert.equal(normalizeCampaignsTab("calendar"), "social")
    assert.equal(normalizeCampaignsTab("unknown-value"), "social")
  })
})
