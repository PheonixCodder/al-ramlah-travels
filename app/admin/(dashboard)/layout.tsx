import * as React from "react"
import { redirect } from "next/navigation"
import { eq, count, and, lt } from "drizzle-orm"
import { db } from "@/db"
import { applications, contactMessages, agencySettings } from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { AdminShellFrame } from "@/components/admin/shell/admin-shell-frame"
import { MandatoryPasswordChangeGate } from "@/components/admin/shell/mandatory-password-change-gate"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import {
  AdminSlaProvider,
  DEFAULT_SLA_OVERDUE_HOURS,
} from "@/components/layout/status-badge"
import { ThemeProvider } from "@/components/theme-provider"

function getSlaThreshold(slaHours: number): Date {
  return new Date(Date.now() - slaHours * 3600 * 1000)
}

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let session: Awaited<ReturnType<typeof requireAdmin>>
  try {
    session = await requireAdmin()
  } catch {
    redirect("/admin/login?session_expired=1")
  }

  let slaHours = DEFAULT_SLA_OVERDUE_HOURS
  let pendingQuoteCount = 0
  let overdueCount = 0
  let unreadMessagesCount = 0

  try {
    const [settings] = await db
      .select({ slaOverdueHours: agencySettings.slaOverdueHours })
      .from(agencySettings)
      .where(eq(agencySettings.id, "default"))
      .limit(1)

    if (
      typeof settings?.slaOverdueHours === "number" &&
      Number.isFinite(settings.slaOverdueHours) &&
      settings.slaOverdueHours > 0
    ) {
      slaHours = settings.slaOverdueHours
    }

    const slaThreshold = getSlaThreshold(slaHours)

    const [quotesRes, overdueRes, messagesRes] = await Promise.all([
      db
        .select({ count: count() })
        .from(applications)
        .where(eq(applications.status, "pending_quote")),
      db
        .select({ count: count() })
        .from(applications)
        .where(
          and(
            eq(applications.status, "pending_quote"),
            lt(applications.createdAt, slaThreshold)
          )
        ),
      db
        .select({ count: count() })
        .from(contactMessages)
        .where(eq(contactMessages.status, "unread")),
    ])

    pendingQuoteCount = quotesRes[0]?.count ?? 0
    overdueCount = overdueRes[0]?.count ?? 0
    unreadMessagesCount = messagesRes[0]?.count ?? 0
  } catch (err) {
    console.error("Failed to load admin live badge counts:", err)
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: session.user.role ?? "staff",
  }

  const mustChangePassword = Boolean(session.user.mustChangePassword)

  return (
    <ThemeProvider
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AdminSlaProvider slaOverdueHours={slaHours}>
        <AdminShellFrame
          skipLinkLabel="Skip to main content"
          sidebar={
            <AdminSidebar
              user={user}
              pendingQuotesCount={pendingQuoteCount}
              unreadMessagesCount={unreadMessagesCount}
            />
          }
          topbar={
            <AdminTopbar
              user={user}
              pendingQuoteCount={pendingQuoteCount}
              overdueCount={overdueCount}
              unreadMessagesCount={unreadMessagesCount}
              slaOverdueHours={slaHours}
            />
          }
        >
          {/* Skip target `#main-content` is mounted by `AdminShellFrame` (`<a href="#main-content">Skip to main content</a>`) */}
          {mustChangePassword ? (
            <MandatoryPasswordChangeGate
              userEmail={session.user.email}
              loginHref="/admin/login?change_password=1"
            />
          ) : (
            children
          )}
        </AdminShellFrame>
      </AdminSlaProvider>
    </ThemeProvider>
  )
}
