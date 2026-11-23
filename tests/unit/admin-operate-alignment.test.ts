import "../setup/hermetic-env"
import * as React from "react"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import AdminDashboardLoading from "@/app/admin/(dashboard)/loading"
import { ApplicationsKpiStrip } from "@/components/admin/applications/applications-kpi-strip"
import { QuoteDispatchBar } from "@/components/admin/applications/quote-dispatch-bar"
import { SocialCalendarView } from "@/components/admin/campaigns/social-calendar-view"
import type { ScheduledPostItem } from "@/components/admin/hubs/campaigns-hub-client"
import { getRenderableStudioImageUrl } from "@/components/admin/hubs/studio-hub-client"
import {
  COMMAND_PALETTE_OPEN_EVENTS,
  isCommandPaletteShortcut,
} from "@/components/layout/command-palette"
import {
  AdminSlaProvider,
  StatusBadge,
  TabularPrice,
} from "@/components/layout/status-badge"
import {
  STUDIO_MODE_A_LABEL,
  STUDIO_MODE_B_LABEL,
  formatCmdkPassengerSummary,
} from "@/lib/constants/admin-labels"

const UNIT_DIR = path.dirname(fileURLToPath(import.meta.url))
const WEB_DIR = path.resolve(UNIT_DIR, "../..")

const LEGACY_ADMIN_REDIRECT_STUBS = [
  "app/admin/(dashboard)/content/page.tsx",
  "app/admin/(dashboard)/distribution/page.tsx",
  "app/admin/(dashboard)/flights/page.tsx",
  "app/admin/(dashboard)/groups/page.tsx",
  "app/admin/(dashboard)/hotels/page.tsx",
  "app/admin/(dashboard)/messages/page.tsx",
  "app/admin/(dashboard)/outreach/page.tsx",
  "app/admin/(dashboard)/post-lookup/page.tsx",
  "app/admin/(dashboard)/social/page.tsx",
  "app/admin/(dashboard)/supplier-flyers/page.tsx",
  "app/admin/(dashboard)/transport/page.tsx",
  "app/admin/(dashboard)/users/page.tsx",
  "app/admin/(dashboard)/visa/page.tsx",
  "app/admin/(dashboard)/ziyarat/page.tsx",
] as const

const IN_SCOPE_ADMIN_TARGETS = [
  "app/admin/layout.tsx",
  "app/admin/(auth)",
  "app/admin/(dashboard)/layout.tsx",
  "app/admin/(dashboard)/error.tsx",
  "app/admin/(dashboard)/loading.tsx",
  "app/admin/(dashboard)/page.tsx",
  "app/admin/(dashboard)/applications/page.tsx",
  "app/admin/(dashboard)/applications/[id]/page.tsx",
  "app/admin/(dashboard)/desk",
  "app/admin/(dashboard)/campaigns",
  "app/admin/(dashboard)/studio",
  "app/admin/(dashboard)/catalog",
  "app/admin/(dashboard)/settings",
  "components/admin/applications/application-dossier.tsx",
  "components/admin/applications/applications-filters.tsx",
  "components/admin/applications/applications-kpi-strip.tsx",
  "components/admin/applications/applications-table.tsx",
  "components/admin/applications/quote-dispatch-bar.tsx",
  "components/admin/applications/quote-worksheet-form.tsx",
  "components/admin/auth",
  "components/admin/campaigns",
  "components/admin/catalog",
  "components/admin/dashboard",
  "components/admin/desk",
  "components/admin/hubs",
  "components/admin/marketing",
  "components/admin/settings",
  "components/admin/shell",
  "components/admin/studio",
  "components/admin/whatsapp",
  "components/layout/admin-sidebar.tsx",
  "components/layout/admin-topbar.tsx",
  "components/layout/command-palette.tsx",
  "components/layout/status-badge.tsx",
] as const

const STATUS_NAMES = ["success", "warning", "danger", "info"] as const
const STATUS_SUFFIXES = ["", "-bg", "-border"] as const

function readWebFile(relPath: string): string {
  return fs.readFileSync(path.join(WEB_DIR, relPath), "utf8")
}

function collectAdminSourceFiles(dirRel: string): string[] {
  const rootAbs = path.join(WEB_DIR, dirRel)
  const collected: string[] = []

  function walk(currentAbs: string): void {
    for (const entry of fs.readdirSync(currentAbs, { withFileTypes: true })) {
      const entryAbs = path.join(currentAbs, entry.name)
      const relPosix = path.relative(WEB_DIR, entryAbs).replace(/\\/g, "/")
      if (entry.isDirectory()) {
        if (relPosix === "app/admin/(dashboard)/applications/[id]/voucher") {
          continue
        }
        walk(entryAbs)
      } else if (
        (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
        relPosix !== "components/admin/applications/voucher-gate.ts" &&
        relPosix !== "components/admin/applications/voucher-print-button.tsx"
      ) {
        collected.push(relPosix)
      }
    }
  }

  walk(rootAbs)
  return collected
}

describe("Spec 0028: Admin 4-Hub Operate Surface & Shell Alignment", () => {
  // covers: AC-1
  it("AC-1: preserves printable voucher gate files and all 14 legacy /admin/* server redirect stubs", () => {
    expect(LEGACY_ADMIN_REDIRECT_STUBS).toHaveLength(14)
    for (const stubRel of LEGACY_ADMIN_REDIRECT_STUBS) {
      const stubSource = readWebFile(stubRel)
      expect(stubSource).toContain("redirect(")
    }

    const voucherGateSource = readWebFile(
      "components/admin/applications/voucher-gate.ts"
    )
    expect(voucherGateSource).toContain("evaluateAdminVoucherGate")

    const voucherPageSource = readWebFile(
      "app/admin/(dashboard)/applications/[id]/voucher/page.tsx"
    )
    expect(voucherPageSource).toContain("evaluateAdminVoucherGate")
  })

  // covers: AC-2
  it("AC-2: exposes all 12 semantic status tokens in globals.css, single light theme lock, and admin-labels helpers", () => {
    const globalsCss = readWebFile("app/globals.css")

    const themeStart = globalsCss.indexOf("@theme inline")
    const rootStart = globalsCss.indexOf(":root")
    expect(themeStart).toBeGreaterThan(-1)
    expect(rootStart).toBeGreaterThan(themeStart)

    const themeBlock = globalsCss.slice(themeStart, rootStart)
    const rootBlock = globalsCss.slice(rootStart)

    expect(globalsCss).toContain(
      "@custom-variant dark (&:where(.never-dark *));"
    )

    for (const name of STATUS_NAMES) {
      for (const suffix of STATUS_SUFFIXES) {
        const rootVar = `--status-${name}${suffix}`
        const themeVar = `--color-status-${name}${suffix}: var(${rootVar});`
        expect(rootBlock).toContain(`${rootVar}:`)
        expect(themeBlock).toContain(themeVar)
      }
    }

    expect(STUDIO_MODE_A_LABEL).toBe("Mode A — Finished Al Ramlah 4K Poster")
    expect(STUDIO_MODE_B_LABEL).toBe(
      "Mode B — Raw B2B Supplier Wholesale Flyer"
    )
    expect(formatCmdkPassengerSummary(3, 4)).toBe(
      "3 Beds/Seats (Adults + Children) • 4 Total Passports"
    )
  })

  // covers: AC-3, AC-4
  it("AC-3 & AC-4: renders semantic StatusBadge/SLA overdue pill, TabularPrice, Loading, and enforces Shell/Overview/Dossier source contracts", () => {
    const fixedNowMs = Date.UTC(2026, 10, 21, 12, 0, 0)
    const overdueCreatedAt = new Date(
      fixedNowMs - 3 * 60 * 60 * 1000
    ).toISOString()

    const pendingOverdueHtml = renderToStaticMarkup(
      React.createElement(
        AdminSlaProvider,
        { slaOverdueHours: 2 },
        React.createElement(StatusBadge, {
          status: "pending_quote",
          createdAt: overdueCreatedAt,
          nowMs: fixedNowMs,
        })
      )
    )
    expect(pendingOverdueHtml).toContain("bg-status-warning-bg")
    expect(pendingOverdueHtml).toContain("text-status-warning")
    expect(pendingOverdueHtml).toContain("bg-status-danger-bg")
    expect(pendingOverdueHtml).toContain("text-status-danger")
    expect(pendingOverdueHtml).toContain("SLA Overdue (2h+)")
    expect(pendingOverdueHtml).toContain("tabular-nums")

    const approvedHtml = renderToStaticMarkup(
      React.createElement(StatusBadge, { status: "approved" })
    )
    expect(approvedHtml).toContain("bg-status-success-bg")
    expect(approvedHtml).toContain("text-status-success")

    const quotedHtml = renderToStaticMarkup(
      React.createElement(StatusBadge, { status: "quoted" })
    )
    expect(quotedHtml).toContain("bg-status-info-bg")
    expect(quotedHtml).toContain("text-status-info")

    const priceHtml = renderToStaticMarkup(
      React.createElement(TabularPrice, { amount: 425000, currency: "PKR" })
    )
    expect(priceHtml).toContain("PKR 425,000")
    expect(priceHtml).toContain("tabular-nums")

    const loadingHtml = renderToStaticMarkup(
      React.createElement(AdminDashboardLoading)
    )
    expect(loadingHtml).toContain('role="status"')
    expect(loadingHtml).toContain('aria-busy="true"')

    const sidebarSource = readWebFile("components/layout/admin-sidebar.tsx")
    expect(sidebarSource).toContain('src="/logo.jpg"')
    expect(sidebarSource).toContain("preload")
    expect(sidebarSource).not.toMatch(/<Image[\s\S]*?\bpriority\b/)
    expect(sidebarSource).toContain("focus-visible:outline-gold")

    const topbarSource = readWebFile("components/layout/admin-topbar.tsx")
    expect(topbarSource).toContain("next/dynamic")
    expect(topbarSource).toContain("ssr: false")
    expect(topbarSource).toContain("CommandPalette")
    expect(topbarSource).not.toContain("<h1")
    expect(topbarSource).toContain("/admin/catalog?tab=messages")

    const shellFrameSource = readWebFile(
      "components/admin/shell/admin-shell-frame.tsx"
    )
    expect(shellFrameSource).toContain("Skip to main content")
    expect(shellFrameSource).toContain('id="main-content"')
    expect(shellFrameSource).toContain("overflow-x-hidden")

    const errorSource = readWebFile("app/admin/(dashboard)/error.tsx")
    expect(errorSource).toContain('role="alert"')
    expect(errorSource).toContain("tabular-nums")
    expect(errorSource).toContain('href="/admin"')

    const applicationsPageSource = readWebFile(
      "app/admin/(dashboard)/applications/page.tsx"
    )
    expect(applicationsPageSource).toContain("computeSlaOverdueCutoff")
    expect(applicationsPageSource).toContain("const PAGE_SIZE = 25")

    const worksheetSource = readWebFile(
      "components/admin/applications/quote-worksheet-form.tsx"
    )
    expect(worksheetSource).not.toContain("suppliers[0]?.id")
    expect(worksheetSource).toContain('id="visa-total"')
    expect(worksheetSource).toContain('id="flights-total"')
    expect(worksheetSource).toContain('id="makkah-hotel-total"')
    expect(worksheetSource).toContain('id="madinah-hotel-total"')
    expect(worksheetSource).toContain('id="customer-notes"')
  })

  // covers: AC-5, AC-6, AC-7
  it("AC-5, AC-6 & AC-7: enforces Desk, Campaigns, Studio contracts and bans HaramainSectionReveal across admin", () => {
    const kanbanSource = readWebFile(
      "components/admin/hubs/applications-kanban-board.tsx"
    )
    expect(kanbanSource).toContain("KANBAN_COLUMN_IDS")
    expect(kanbanSource).toContain("setActivatorNodeRef")
    expect(kanbanSource).toContain("Move application ")
    expect(kanbanSource).toContain("tabIndex={0}")

    const deskSource = readWebFile("components/admin/hubs/desk-hub-client.tsx")
    expect(deskSource).toContain("crypto.randomUUID")
    expect(deskSource).toContain("pollInFlightRef")
    expect(deskSource).toContain("shouldAutoScrollThreadOnUpdate")

    const campaignsSource = readWebFile(
      "components/admin/hubs/campaigns-hub-client.tsx"
    )
    expect(campaignsSource).toContain("<span>Failed</span>")
    expect(campaignsSource).toContain('userRole === "super_admin"')
    expect(campaignsSource).not.toContain("whatsapp-linked-device")

    const calendarSource = readWebFile(
      "components/admin/campaigns/social-calendar-view.tsx"
    )
    expect(calendarSource).toContain("md:hidden")
    expect(calendarSource).toContain("overflow-x-auto")
    expect(calendarSource).toContain("min-w-[680px]")

    const previewSource = readWebFile(
      "components/admin/campaigns/social-platform-preview.tsx"
    )
    expect(previewSource).toContain("bg-gold-gradient")
    expect(previewSource).not.toContain("via-pink-500")

    const studioSource = readWebFile(
      "components/admin/hubs/studio-hub-client.tsx"
    )
    expect(studioSource).toContain("STUDIO_MODE_B_LABEL")
    expect(studioSource).toContain("net_plus_markup")
    expect(studioSource).toContain("perTierMarkupPkr")
    expect(studioSource).toContain("isPdfAssetPreviewUrl")

    const adminFiles = [
      ...collectAdminSourceFiles("app/admin"),
      ...collectAdminSourceFiles("components/admin"),
    ]
    expect(adminFiles.length).toBeGreaterThan(0)
    for (const relPath of adminFiles) {
      const content = readWebFile(relPath)
      expect(
        content,
        `${relPath} must follow Operate functional motion law without HaramainSectionReveal`
      ).not.toContain("HaramainSectionReveal")
    }
  })

  // covers: AC-8
  it("AC-8: passes ESLint with 0 errors and 0 warnings across all in-scope admin files", async () => {
    const { ESLint } = await import("eslint")
    const eslint = new ESLint({
      cwd: WEB_DIR,
      cache: true,
      cacheLocation: path.join(
        WEB_DIR,
        "node_modules/.cache/eslint-admin-operate.cache"
      ),
    })
    const results = await eslint.lintFiles([...IN_SCOPE_ADMIN_TARGETS])
    const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0)
    const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0)

    if (totalErrors > 0 || totalWarnings > 0) {
      const formatter = await eslint.loadFormatter("stylish")
      const report = await formatter.format(results)
      expect.fail(
        `Expected 0 ESLint errors and 0 warnings across ${results.length} admin files, got ${totalErrors} errors and ${totalWarnings} warnings:\n${report}`
      )
    }

    expect(results.length).toBeGreaterThanOrEqual(70)
    expect(totalErrors).toBe(0)
    expect(totalWarnings).toBe(0)
  }, 300_000)

  // covers: AC-9
  it("AC-9: passes Hallmark sloplint with 0 FAIL items across all non-voucher admin Operate targets", () => {
    const sloplintScript = path.join(
      WEB_DIR,
      ".agents/skills/hallmark/scripts/sloplint.mjs"
    )
    const run = spawnSync(
      process.execPath,
      [sloplintScript, ...IN_SCOPE_ADMIN_TARGETS],
      {
        cwd: WEB_DIR,
        encoding: "utf8",
        timeout: 120_000,
      }
    )
    const combinedOutput = `${run.stdout ?? ""}\n${run.stderr ?? ""}`.trim()
    expect(
      combinedOutput,
      `Expected 0 FAIL in sloplint output:\n${combinedOutput}`
    ).toMatch(/\b0 FAIL\b/)
  }, 120_000)

  // covers: AC-3, AC-4
  it("AC-3 & AC-4: renders ApplicationsKpiStrip with dynamic SLA overdue hours from AdminSlaProvider and prop overrides instead of hardcoded 24h", () => {
    const sampleData = {
      totalCount: 42,
      pendingCount: 9,
      overdueCount: 3,
      quotedPipelinePkr: 1_850_000,
      approvedRevenuePkr: 920_000,
    }

    const defaultHtml = renderToStaticMarkup(
      React.createElement(ApplicationsKpiStrip, { data: sampleData })
    )
    expect(defaultHtml).toContain("(2h+)")
    expect(defaultHtml).toContain("exceeding 2h SLA")
    expect(defaultHtml).not.toContain("(24h+)")

    const contextHtml = renderToStaticMarkup(
      React.createElement(
        AdminSlaProvider,
        { slaOverdueHours: 4 },
        React.createElement(ApplicationsKpiStrip, { data: sampleData })
      )
    )
    expect(contextHtml).toContain("(4h+)")
    expect(contextHtml).toContain("exceeding 4h SLA")
    expect(contextHtml).not.toContain("(24h+)")

    const overrideHtml = renderToStaticMarkup(
      React.createElement(
        AdminSlaProvider,
        { slaOverdueHours: 4 },
        React.createElement(ApplicationsKpiStrip, {
          data: sampleData,
          slaOverdueHours: 6,
        })
      )
    )
    expect(overrideHtml).toContain("(6h+)")
    expect(overrideHtml).toContain("exceeding 6h SLA")
  })

  // covers: AC-5, AC-7, AC-10
  it("AC-5, AC-7 & AC-10: enforces Studio accessible form labels, CSP-safe VectorPdfPreviewTile without <object>, and Kanban 24px target-size floor", () => {
    const studioSource = readWebFile(
      "components/admin/hubs/studio-hub-client.tsx"
    )
    expect(studioSource).toContain('htmlFor="studio-wholesale-supplier"')
    expect(studioSource).toContain('id="studio-wholesale-supplier"')
    expect(studioSource).toContain('htmlFor="studio-commission-pkr"')
    expect(studioSource).toContain('id="studio-commission-pkr"')
    expect(studioSource).toContain('htmlFor="studio-departure-city"')
    expect(studioSource).toContain('id="studio-departure-city"')
    expect(studioSource).toContain('htmlFor="studio-poster-direct-url"')
    expect(studioSource).toContain('id="studio-poster-direct-url"')
    expect(studioSource).toContain("VectorPdfPreviewTile")
    expect(studioSource).not.toMatch(/<(?:object|embed)\b/i)

    const kanbanSource = readWebFile(
      "components/admin/hubs/applications-kanban-board.tsx"
    )
    expect(kanbanSource).toContain("min-h-7 min-w-6")
  })

  // covers: AC-3, AC-8
  it("AC-3 & AC-8: enforces CommandPalette repeat custom-event wiring, case-insensitive Cmd/Ctrl+K shortcuts, and pure state updaters", () => {
    expect(COMMAND_PALETTE_OPEN_EVENTS).toEqual([
      "open-command-palette",
      "open-post-lookup",
    ])

    expect(
      isCommandPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false })
    ).toBe(true)
    expect(
      isCommandPaletteShortcut({ key: "K", ctrlKey: true, metaKey: false })
    ).toBe(true)
    expect(
      isCommandPaletteShortcut({ key: "k", ctrlKey: false, metaKey: true })
    ).toBe(true)
    expect(
      isCommandPaletteShortcut({ key: "K", ctrlKey: false, metaKey: true })
    ).toBe(true)
    expect(
      isCommandPaletteShortcut({ key: "k", ctrlKey: false, metaKey: false })
    ).toBe(false)
    expect(
      isCommandPaletteShortcut({ key: "p", ctrlKey: true, metaKey: false })
    ).toBe(false)

    const paletteSource = readWebFile("components/layout/command-palette.tsx")
    expect(paletteSource).toContain(
      "for (const evt of COMMAND_PALETTE_OPEN_EVENTS)"
    )
    expect(paletteSource).toContain("selectedItemIdRef")

    const topbarSource = readWebFile("components/layout/admin-topbar.tsx")
    expect(topbarSource).toContain('new CustomEvent("open-command-palette")')
    expect(topbarSource).toContain('addEventListener("open-post-lookup"')
  })

  // covers: AC-6, AC-7
  it("AC-6 & AC-7: filters Studio dynamic image preview URLs to reject empty strings, PDFs, and video extensions while trimming valid image URLs", () => {
    expect(getRenderableStudioImageUrl(null)).toBeNull()
    expect(getRenderableStudioImageUrl(undefined)).toBeNull()
    expect(getRenderableStudioImageUrl("")).toBeNull()
    expect(getRenderableStudioImageUrl("   ")).toBeNull()
    expect(
      getRenderableStudioImageUrl("https://cdn.example.com/flyers/sheet.pdf")
    ).toBeNull()
    expect(
      getRenderableStudioImageUrl(
        "https://cdn.example.com/flyers/SHEET.PDF?X-Amz-Signature=abc"
      )
    ).toBeNull()
    expect(
      getRenderableStudioImageUrl("https://cdn.example.com/reels/promo.mp4")
    ).toBeNull()
    expect(
      getRenderableStudioImageUrl(
        "https://cdn.example.com/reels/promo.MOV?token=1"
      )
    ).toBeNull()
    expect(
      getRenderableStudioImageUrl("https://cdn.example.com/reels/clip.webm#t=2")
    ).toBeNull()
    expect(
      getRenderableStudioImageUrl("https://cdn.example.com/reels/clip.m4v")
    ).toBeNull()
    expect(
      getRenderableStudioImageUrl(
        "  https://cdn.example.com/posters/ramadan-4k.png?v=2  "
      )
    ).toBe("https://cdn.example.com/posters/ramadan-4k.png?v=2")
  })

  // covers: AC-4, AC-6, AC-8
  it("AC-4, AC-6 & AC-8: synchronizes QuoteDispatchBar PDF/voucher props, seeds SocialCalendarView from initialNowMs across PKT midnight, and preserves keyed *FormBody dialog resets", () => {
    const sampleApp = {
      id: "00000000-0000-4000-8000-000000000048",
      referenceNumber: "ART-20261122-0048",
      status: "quoted",
      customerName: "Tariq Mahmood",
      customerPhone: "+923001234567",
      customerWhatsapp: "+923001234567",
      customerEmail: "tariq@example.com",
      ksaArrivalDate: "2026-12-10",
      ksaDepartureDate: "2026-12-20",
      totalPassportCount: 2,
      totalKsaDays: 10,
    }
    const baseQuote = {
      grandTotalPkr: 640_000,
      visaTotalPkr: 92_000,
      flightsTotalPkr: 260_000,
      makkahHotelTotalPkr: 160_000,
      madinahHotelTotalPkr: 98_000,
      transportTotalPkr: 30_000,
      ziyaratTotalPkr: 0,
      discountPkr: 0,
      paymentStatus: "unpaid" as const,
      amountPaidPkr: 0,
      quotationPdfUrl: null,
    }

    const withoutPdfHtml = renderToStaticMarkup(
      React.createElement(QuoteDispatchBar, {
        application: sampleApp,
        latestQuote: baseQuote,
      })
    )
    expect(withoutPdfHtml).not.toContain("Open PDF")
    expect(withoutPdfHtml).toContain("Voucher Locked")

    const withLatestPdfHtml = renderToStaticMarkup(
      React.createElement(QuoteDispatchBar, {
        application: sampleApp,
        latestQuote: {
          ...baseQuote,
          quotationPdfUrl: "https://cdn.example.com/quotes/v1.pdf",
        },
      })
    )
    expect(withLatestPdfHtml).toContain(
      'href="https://cdn.example.com/quotes/v1.pdf"'
    )
    expect(withLatestPdfHtml).toContain("Open PDF")

    const withLiveOverrideAndUnlockedVoucherHtml = renderToStaticMarkup(
      React.createElement(QuoteDispatchBar, {
        application: { ...sampleApp, status: "approved" },
        latestQuote: {
          ...baseQuote,
          quotationPdfUrl: "https://cdn.example.com/quotes/v1.pdf",
        },
        liveQuote: {
          ...baseQuote,
          paymentStatus: "deposit_paid",
          amountPaidPkr: 200_000,
          quotationPdfUrl: "https://cdn.example.com/quotes/v2.pdf",
        },
      })
    )
    expect(withLiveOverrideAndUnlockedVoucherHtml).toContain(
      'href="https://cdn.example.com/quotes/v2.pdf"'
    )
    expect(withLiveOverrideAndUnlockedVoucherHtml).not.toContain(
      'href="https://cdn.example.com/quotes/v1.pdf"'
    )
    expect(withLiveOverrideAndUnlockedVoucherHtml).toContain("Print Voucher")
    expect(withLiveOverrideAndUnlockedVoucherHtml).toContain(
      `/admin/applications/${sampleApp.id}/voucher`
    )

    // 2026-11-30T19:30:00Z is 2026-12-01 00:30 PKT (UTC+5 midnight boundary)
    const pktMidnightBoundaryMs = Date.UTC(2026, 10, 30, 19, 30, 0)
    const sampleScheduledPost: ScheduledPostItem = {
      id: "post-dec-1",
      postAssetId: "asset-dec-1",
      caption: "Ramadan Early Bird Spotlight from Lahore",
      postType: "single_image",
      mediaUrls: ["https://cdn.example.com/posters/ramadan-4k.png"],
      socialJpegUrls: ["https://cdn.example.com/posters/ramadan-1080.jpg"],
      campaignStage: "standalone",
      pairedFollowUpPostId: null,
      twoStepDelayMinutes: 0,
      status: "scheduled",
      scheduledFor: new Date("2026-12-01T06:00:00.000Z"),
      triggerRunId: null,
      createdAt: new Date("2026-11-30T18:00:00.000Z"),
      targets: [
        {
          id: "target-ig-1",
          scheduledPostId: "post-dec-1",
          integrationId: "int-ig-1",
          status: "pending",
          publishedUrl: null,
          externalPostId: null,
          idempotencyKey: "idem-dec-1",
          errorMessage: null,
          publishedAt: null,
          attemptCount: 0,
          integration: {
            id: "int-ig-1",
            name: "Al Ramlah Instagram",
            provider: "instagram",
            handle: "@alramlahtravels",
            avatarUrl: null,
          },
        },
      ],
      postAsset: {
        id: "asset-dec-1",
        postCode: "ART-DEC-001",
        title: "Ramadan Early Bird Spotlight",
        imageUrl: "https://cdn.example.com/posters/ramadan-4k.png",
        kind: "single_package_spotlight",
      },
    }
    const calendarHtml = renderToStaticMarkup(
      React.createElement(SocialCalendarView, {
        initialNowMs: pktMidnightBoundaryMs,
        scheduledPosts: [sampleScheduledPost],
      })
    )
    expect(calendarHtml).toContain("Today")
    expect(calendarHtml).toContain("Ramadan Early Bird Spotlight")

    const airlineDialogSource = readWebFile(
      "components/admin/catalog/airline-dialog.tsx"
    )
    expect(airlineDialogSource).toContain(
      "<Dialog open={open} onOpenChange={handleOpenChange}>"
    )
    expect(airlineDialogSource).toContain(
      'key={`${airline?.id ?? "new"}-${formSession}`}'
    )

    const usersClientSource = readWebFile(
      "components/admin/catalog/users-client.tsx"
    )
    expect(usersClientSource).toContain("crypto.getRandomValues")
    expect(usersClientSource).not.toContain("Math.random")
  })
})
