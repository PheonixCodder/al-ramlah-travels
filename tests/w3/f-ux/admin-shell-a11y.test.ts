import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AdminShellFrame } from "../../../components/admin/shell/admin-shell-frame"
import { SidebarInset, SidebarProvider } from "../../../components/ui/sidebar"
import {
  AdminSlaProvider,
  DEFAULT_SLA_OVERDUE_HOURS,
  StatusBadge,
  TabularPrice,
  isCreatedOverdue,
} from "../../../components/layout/status-badge"
import {
  LOCKED_THEME_CONFIG,
  ThemeProvider,
} from "../../../components/theme-provider"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WT_ROOT = path.resolve(__dirname, "../../..")

describe("F-UX T-092: Admin Shell Landmarks, Skip Link, Boundaries, Locked Light Theme & Dynamic SLA", () => {
  it("renders AdminShellFrame & SidebarInset with AT MOST ONE <main id='main-content' tabIndex={-1}> and an accessible skip-to-content link", () => {
    const shellHtml = renderToStaticMarkup(
      React.createElement(
        AdminShellFrame,
        {
          sidebar: React.createElement("aside", { "aria-label": "Admin navigation" }, "Nav"),
          topbar: React.createElement("header", null, "Topbar"),
        },
        React.createElement("section", null, "Operational Content")
      )
    )

    const mainMatches = shellHtml.match(/<main\b/g) ?? []
    assert.equal(
      mainMatches.length,
      1,
      `Expected exactly 1 <main> landmark across AdminShellFrame, found ${mainMatches.length}`
    )
    assert.match(shellHtml, /<a[^>]*href="#main-content"[^>]*>Skip to main content<\/a>/)
    assert.match(shellHtml, /<div[^>]*data-slot="sidebar-inset"/)
    assert.match(shellHtml, /<main[^>]*id="main-content"[^>]*tabindex="-1"/)

    // Direct SidebarProvider + SidebarInset composition check
    const insetHtml = renderToStaticMarkup(
      React.createElement(
        SidebarProvider,
        null,
        React.createElement(
          SidebarInset,
          { className: "test-inset" },
          React.createElement("header", null, "Banner"),
          React.createElement("main", { id: "main-content", tabIndex: -1 }, "Body")
        )
      )
    )
    assert.equal((insetHtml.match(/<main\b/g) ?? []).length, 1)

    const layoutSource = fs.readFileSync(
      path.join(WT_ROOT, "app/admin/(dashboard)/layout.tsx"),
      "utf8"
    )
    assert.match(layoutSource, /AdminShellFrame/)
    assert.match(layoutSource, /mustChangePassword/)
    assert.match(
      layoutSource,
      /\/admin\/login\?change_password=1/,
      "AdminDashboardLayout password gate must align with login/page.tsx ?change_password=1 param"
    )
  })

  it("provides Haramain-branded admin error.tsx ('use client', retry + /admin) and loading.tsx without nested <main>", async () => {
    const errorPath = path.join(WT_ROOT, "app/admin/(dashboard)/error.tsx")
    const loadingPath = path.join(WT_ROOT, "app/admin/(dashboard)/loading.tsx")

    assert.ok(fs.existsSync(errorPath), "app/admin/(dashboard)/error.tsx must exist")
    assert.ok(fs.existsSync(loadingPath), "app/admin/(dashboard)/loading.tsx must exist")

    const errorSource = fs.readFileSync(errorPath, "utf8")
    assert.ok(
      errorSource.trimStart().startsWith('"use client"'),
      "app/admin/(dashboard)/error.tsx must start with \"use client\""
    )
    assert.match(errorSource, /\/admin/)

    const errorMod = (await import("../../../app/admin/(dashboard)/error")) as {
      default: React.ComponentType<{
        error: Error & { digest?: string }
        reset: () => void
      }>
    }
    const loadingMod = (await import("../../../app/admin/(dashboard)/loading")) as {
      default: React.ComponentType
    }

    const testErr = Object.assign(new Error("Simulated DB timeout"), {
      digest: "ERR-DIGEST-786",
    })
    const errorHtml = renderToStaticMarkup(
      React.createElement(errorMod.default, {
        error: testErr,
        reset: () => undefined,
      })
    )
    assert.equal(
      (errorHtml.match(/<main\b/g) ?? []).length,
      0,
      "admin error.tsx renders inside layout <main> and must not nest a second <main>"
    )
    assert.match(errorHtml, /role="alert"/)
    assert.match(errorHtml, /ERR-DIGEST-786/)
    assert.match(errorHtml, /tabular-nums/)
    assert.match(errorHtml, /href="\/admin"/)

    const loadingHtml = renderToStaticMarkup(
      React.createElement(loadingMod.default)
    )
    assert.equal(
      (loadingHtml.match(/<main\b/g) ?? []).length,
      0,
      "admin loading.tsx renders inside layout <main> and must not nest a second <main>"
    )
    assert.match(loadingHtml, /role="status"/)
    assert.match(loadingHtml, /aria-busy="true"/)
  })

  it("locks ThemeProvider to forcedTheme='light', enableSystem=false, and disableTransitionOnChange", () => {
    assert.equal(LOCKED_THEME_CONFIG.forcedTheme, "light")
    assert.equal(LOCKED_THEME_CONFIG.enableSystem, false)
    assert.equal(LOCKED_THEME_CONFIG.disableTransitionOnChange, true)

    const html = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          forcedTheme: "light",
          enableSystem: false,
          disableTransitionOnChange: true,
        },
        React.createElement("span", null, "Haramain Light Surface")
      )
    )
    assert.match(html, /data-forced-theme="light"/)
    assert.match(html, /data-enable-system="false"/)
    assert.match(html, /data-disable-transition-on-change="true"/)
    assert.match(html, /Haramain Light Surface/)
  })

  it("lazy-loads CommandPalette via next/dynamic (ssr: false), demotes duplicate topbar <h1>, and links web messages to /admin/catalog?tab=messages", () => {
    const topbarSource = fs.readFileSync(
      path.join(WT_ROOT, "components/layout/admin-topbar.tsx"),
      "utf8"
    )

    assert.match(
      topbarSource,
      /import\s+dynamic\s+from\s+["']next\/dynamic["']/,
      "AdminTopbar must lazy-load CommandPalette with next/dynamic"
    )
    assert.match(
      topbarSource,
      /ssr:\s*false/,
      "Dynamic CommandPalette import must set ssr: false"
    )
    assert.ok(
      !/^import\s+\{\s*CommandPalette\s*\}\s+from/m.test(topbarSource),
      "AdminTopbar must not eagerly import CommandPalette on the SSR critical path"
    )
    assert.match(
      topbarSource,
      /\/admin\/catalog\?tab=messages/,
      "AdminTopbar unread web messages link must point to /admin/catalog?tab=messages"
    )
    assert.ok(
      !/<h1\b/.test(topbarSource),
      "AdminTopbar must not render a duplicate <h1> competing with hub headings"
    )
    assert.match(topbarSource, /tabular-nums/)
  })

  it("defaults StatusBadge slaOverdueHours to 2, honors AdminSlaProvider & explicit prop overrides, and applies tabular-nums", () => {
    assert.equal(DEFAULT_SLA_OVERDUE_HOURS, 2)
    const fixedNow = Date.parse("2026-11-14T12:00:00Z")
    assert.equal(
      isCreatedOverdue(new Date(fixedNow - 3 * 3600 * 1000), 2, fixedNow),
      true
    )
    assert.equal(
      isCreatedOverdue(new Date(fixedNow - 90 * 60 * 1000), 2, fixedNow),
      false
    )

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000)

    // Default SLA = 2 hours -> 3h old pending_quote MUST be overdue (2h+)
    const defaultOverdueHtml = renderToStaticMarkup(
      React.createElement(StatusBadge, {
        status: "pending_quote",
        createdAt: threeHoursAgo,
      })
    )
    assert.match(defaultOverdueHtml, /SLA Overdue \(2h\+\)/)
    assert.match(defaultOverdueHtml, /tabular-nums/)

    // Default SLA = 2 hours -> 90m old pending_quote is NOT overdue
    const withinDefaultSlaHtml = renderToStaticMarkup(
      React.createElement(StatusBadge, {
        status: "pending_quote",
        createdAt: ninetyMinutesAgo,
      })
    )
    assert.ok(!withinDefaultSlaHtml.includes("SLA Overdue"))

    // Live agencySettings.slaOverdueHours via AdminSlaProvider context (e.g. 12h)
    const contextTwelveHoursHtml = renderToStaticMarkup(
      React.createElement(
        AdminSlaProvider,
        { slaOverdueHours: 12 },
        React.createElement(StatusBadge, {
          status: "pending_quote",
          createdAt: threeHoursAgo,
        })
      )
    )
    assert.ok(
      !contextTwelveHoursHtml.includes("SLA Overdue"),
      "3h pending quote must not be marked overdue when AdminSlaProvider supplies 12h SLA"
    )

    // Explicit prop overrides context (slaOverdueHours = 1 inside 12h provider)
    const explicitPropOverrideHtml = renderToStaticMarkup(
      React.createElement(
        AdminSlaProvider,
        { slaOverdueHours: 12 },
        React.createElement(StatusBadge, {
          status: "pending_quote",
          createdAt: ninetyMinutesAgo,
          slaOverdueHours: 1,
        })
      )
    )
    assert.match(explicitPropOverrideHtml, /SLA Overdue \(1h\+\)/)

    // TabularPrice retains tabular-nums
    const priceHtml = renderToStaticMarkup(
      React.createElement(TabularPrice, { amount: 425000, currency: "PKR" })
    )
    assert.match(priceHtml, /tabular-nums/)
    assert.match(priceHtml, /PKR 425,000/)
  })
})
