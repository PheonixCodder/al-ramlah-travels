import * as React from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export interface AdminShellFrameProps {
  sidebar: React.ReactNode
  topbar: React.ReactNode
  children: React.ReactNode
  skipLinkLabel?: string
}

/**
 * Pure semantic landmark shell for `/admin/*` routes (`T-092` / `A21-007`).
 * Guarantees:
 * 1. First focusable element is an accessible keyboard skip link (`<a href="#main-content">`).
 * 2. `SidebarInset` renders as a `<div>`, keeping `<AdminTopbar>` (`<header>`) as a top-level banner.
 * 3. Exactly ONE `<main id="main-content" tabIndex={-1}>` landmark wraps the active route content.
 */
export function AdminShellFrame({
  sidebar,
  topbar,
  children,
  skipLinkLabel = "Skip to main content",
}: AdminShellFrameProps) {
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:border focus:border-gold focus:bg-primary focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {skipLinkLabel}
      </a>
      <div className="flex min-h-screen w-full min-w-0 overflow-x-hidden bg-background print:block print:bg-white">
        {sidebar}
        <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
          {topbar}
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 overflow-y-auto p-4 outline-none sm:p-6 lg:p-8 print:bg-white print:p-0"
          >
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
