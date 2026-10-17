import * as React from "react"
import { eq, count } from "drizzle-orm"
import { db } from "@/db"
import { applications, contactMessages } from "@/db/schema"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { AdminTopbar } from "@/components/layout/admin-topbar"

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let pendingQuotesCount: number | undefined
  let unreadMessagesCount: number | undefined

  try {
    const [quotesRes, messagesRes] = await Promise.all([
      db
        .select({ count: count() })
        .from(applications)
        .where(eq(applications.status, "pending_quote")),
      db
        .select({ count: count() })
        .from(contactMessages)
        .where(eq(contactMessages.status, "unread")),
    ])
    pendingQuotesCount = quotesRes[0]?.count ?? 0
    unreadMessagesCount = messagesRes[0]?.count ?? 0
  } catch (err) {
    console.error("Failed to load admin live badge counts:", err)
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar
          pendingQuotesCount={pendingQuotesCount}
          unreadMessagesCount={unreadMessagesCount}
        />
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background">
          <AdminTopbar />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
