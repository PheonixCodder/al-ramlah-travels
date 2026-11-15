import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"

import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import {
  filterWhatsappResourcesByAccount,
  summarizeWhatsappQueueStatus,
  type MarketingChannelRecord,
} from "../../../components/admin/hubs/campaigns-hub-client"
import { filterTemplatesForWhatsappAccount } from "../../../components/admin/campaigns/whatsapp-broadcast-drawer"

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

describe("F-SOCIAL T-071, OD-01 & OD-07: WABA Account Scoping, Honest WA Queue Failed Badges, Ban-Safe Queue & Bounded SSR", () => {
  it("T-071a: strictly scopes Meta templates and broadcast dispatches to selectedAccountId across multi-WABA accounts", () => {
    const templates = [
      {
        id: "tpl-waba1-approved",
        accountId: "waba-1",
        status: "APPROVED",
        name: "ramadan_offer_1",
      },
      {
        id: "tpl-waba1-pending",
        accountId: "waba-1",
        status: "PENDING",
        name: "draft_offer",
      },
      {
        id: "tpl-waba2-approved",
        accountId: "waba-2",
        status: "APPROVED",
        name: "lahore_vip_2",
      },
    ]

    const broadcasts = [
      { id: "bc-1", accountId: "waba-1", name: "WABA 1 Campaign" },
      { id: "bc-2", accountId: "waba-2", name: "WABA 2 Campaign" },
    ]

    const scopedWaba1 = filterWhatsappResourcesByAccount(
      templates,
      broadcasts,
      "waba-1"
    )
    assert.deepEqual(
      scopedWaba1.approvedTemplates.map((t) => t.id),
      ["tpl-waba1-approved"]
    )
    assert.deepEqual(
      scopedWaba1.accountBroadcasts.map((b) => b.id),
      ["bc-1"]
    )

    const scopedWaba2 = filterWhatsappResourcesByAccount(
      templates,
      broadcasts,
      "waba-2"
    )
    assert.deepEqual(
      scopedWaba2.approvedTemplates.map((t) => t.id),
      ["tpl-waba2-approved"]
    )
    assert.deepEqual(
      scopedWaba2.accountBroadcasts.map((b) => b.id),
      ["bc-2"]
    )

    assert.deepEqual(
      filterTemplatesForWhatsappAccount(templates, "waba-2").map((t) => t.id),
      ["tpl-waba2-approved"]
    )
    assert.deepEqual(filterTemplatesForWhatsappAccount(templates, ""), [])
  })

  it("T-071b: excludes status === 'failed' from sharedCountToday, flags failedChannelIds for red Failed badges, and filters non-WA channels", () => {
    const channels: MarketingChannelRecord[] = [
      {
        id: "ch-wa-group-1",
        name: "Askari 10 Residents Group",
        platform: "whatsapp_group",
        areaTag: "Askari 10",
        senderWhatsappNumber: "+923274029701",
        externalGroupIdOrHandle: null,
        inviteLinkOrUrl: null,
        memberCount: 250,
        dailyTargetPosts: 1,
        isActive: true,
        sortOrder: 1,
        lastPostedAt: null,
      },
      {
        id: "ch-wa-group-2",
        name: "Lahore Cantt Umrah Group",
        platform: "whatsapp_group",
        areaTag: "Cantt",
        senderWhatsappNumber: "+923274029701",
        externalGroupIdOrHandle: null,
        inviteLinkOrUrl: null,
        memberCount: 180,
        dailyTargetPosts: 1,
        isActive: true,
        sortOrder: 2,
        lastPostedAt: null,
      },
      {
        id: "ch-wa-status-1",
        name: "Official Status Line",
        platform: "whatsapp_status",
        areaTag: "Status",
        senderWhatsappNumber: "+923274029701",
        externalGroupIdOrHandle: null,
        inviteLinkOrUrl: null,
        memberCount: null,
        dailyTargetPosts: 1,
        isActive: true,
        sortOrder: 3,
        lastPostedAt: null,
      },
      {
        id: "ch-instagram-non-wa",
        name: "Instagram Feed",
        platform: "instagram",
        areaTag: "Social",
        senderWhatsappNumber: null,
        externalGroupIdOrHandle: "@alramlahtravels",
        inviteLinkOrUrl: null,
        memberCount: null,
        dailyTargetPosts: 1,
        isActive: true,
        sortOrder: 4,
        lastPostedAt: null,
      },
    ]

    const distributions = [
      { channelId: "ch-wa-group-1", status: "manual_logged" as const },
      { channelId: "ch-wa-group-2", status: "failed" as const },
      { channelId: "ch-wa-status-1", status: "queued" as const },
    ]

    const summary = summarizeWhatsappQueueStatus(channels, distributions)

    // Non-WhatsApp channel excluded from WA queue
    assert.equal(summary.whatsappChannels.length, 3)
    assert.equal(summary.totalActiveChannels, 3)

    // Failed channel MUST NOT be counted as shared!
    assert.equal(summary.sharedCountToday, 1)
    assert.equal(summary.failedCountToday, 1)
    assert.equal(summary.sharedChannelIds.has("ch-wa-group-1"), true)
    assert.equal(summary.sharedChannelIds.has("ch-wa-group-2"), false)
    assert.equal(summary.failedChannelIds.has("ch-wa-group-2"), true)
    assert.equal(summary.queuedChannelIds.has("ch-wa-status-1"), true)
  })

  it("T-071c: enforces OD-01 manual-assisted WA queue (zero Baileys auto-blast), OD-07 super_admin UI guards, and bounded SSR pagination", () => {
    const hubSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "components/admin/hubs/campaigns-hub-client.tsx"
      ),
      "utf8"
    )
    const ssrPageSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/admin/(dashboard)/campaigns/page.tsx"),
      "utf8"
    )

    // OD-01: Zero unofficial Baileys linked-device auto-blast imports or calls in CampaignsHubClient
    assert.doesNotMatch(hubSource, /whatsapp-linked-device/)
    assert.doesNotMatch(hubSource, /dispatchAutomatedWhatsappGroupsCampaignAction/)
    // Red Failed badge rendered on failed dispatches
    assert.match(hubSource, /<span>Failed<\/span>/)
    // OD-07: super_admin gating on bulk broadcast & OAuth connect links
    assert.match(hubSource, /userRole === "super_admin"/)

    // T-071 SSR: bounded LIMIT queries + SQL count() + sanitized OAuth metadata
    assert.match(ssrPageSource, /postsPageSize/)
    assert.match(ssrPageSource, /contactsPageSize/)
    assert.match(ssrPageSource, /count\(\)/)
    assert.match(ssrPageSource, /sanitizeIntegrationMetaForClient/)
  })
})
