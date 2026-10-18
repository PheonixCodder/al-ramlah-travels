import * as React from "react"
import { eq, count, and, lt } from "drizzle-orm"
import { db } from "@/db"
import { applications, contactMessages, agencySettings } from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { AdminTopbar } from "@/components/layout/admin-topbar"

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await requireAdmin()

  let pendingQuoteCount = 0
  let overdueCount = 0
  let unreadMessagesCount = 0

  try {
    const [settings] = await db
      .select({ slaOverdueHours: agencySettings.slaOverdueHours })
      .from(agencySettings)
      .where(eq(agencySettings.id, "default"))
      .limit(1)

    const slaHours = settings?.slaOverdueHours ?? 24
    const slaThreshold = new Date(Date.now() - slaHours * 3600 * 1000)

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
    role: (session.user as { role?: string }).role ?? "staff",
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar
          user={user}
          pendingQuotesCount={pendingQuoteCount}
          unreadMessagesCount={unreadMessagesCount}
        />
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background">
          <AdminTopbar
            user={user}
            pendingQuoteCount={pendingQuoteCount}
            overdueCount={overdueCount}
            unreadMessagesCount={unreadMessagesCount}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
