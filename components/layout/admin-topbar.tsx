"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Search,
  Bell,
  Settings,
  LogOut,
  ShieldCheck,
  ChevronDown,
  FileText,
  Inbox,
  CheckCircle2,
} from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"

const ROUTE_TITLES: Record<string, { title: string; category: string }> = {
  "/admin": { title: "Executive Dashboard", category: "Overview & CRM" },
  "/admin/applications": {
    title: "Applications & Quotes",
    category: "Overview & CRM",
  },
  "/admin/messages": { title: "Contact Inbox", category: "Overview & CRM" },
  "/admin/groups": { title: "Group Packages", category: "Packages & Pricing" },
  "/admin/visa": { title: "Visa Pricing", category: "Packages & Pricing" },
  "/admin/hotels": { title: "Hotels Catalog", category: "Dynamic Inventory" },
  "/admin/transport": {
    title: "Transport & Vehicles",
    category: "Dynamic Inventory",
  },
  "/admin/ziyarat": { title: "Ziyarat Places", category: "Dynamic Inventory" },
  "/admin/flights": {
    title: "Airlines & Cities",
    category: "Dynamic Inventory",
  },
  "/admin/content": {
    title: "Website Content CMS",
    category: "Administration",
  },
  "/admin/users": { title: "Staff & Roles", category: "Administration" },
  "/admin/settings": { title: "Agency Settings", category: "Administration" },
}

export interface AdminTopbarUser {
  name?: string | null
  email?: string | null
  role?: string | null
}

export interface AdminTopbarProps {
  user?: AdminTopbarUser
  pendingQuoteCount?: number
  overdueCount?: number
  unreadMessagesCount?: number
}

export function AdminTopbar({
  user,
  pendingQuoteCount = 0,
  overdueCount = 0,
  unreadMessagesCount = 0,
}: AdminTopbarProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Derive route title and category
  const activeMeta = React.useMemo(() => {
    if (!pathname) return { title: "Dashboard", category: "Overview" }
    if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
    for (const [key, val] of Object.entries(ROUTE_TITLES)) {
      if (key !== "/admin" && pathname.startsWith(key)) {
        return val
      }
    }
    return { title: "Executive Operations", category: "Al Ramlah Travels" }
  }, [pathname])

  const initials = React.useMemo(() => {
    if (!user?.name) return "AR"
    const parts = user.name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }, [user?.name])

  const displayName = user?.name || "Admin User"
  const displayEmail = user?.email || "admin@alramlahtravels.com"
  const isSuperAdmin = user?.role === "super_admin"
  const formattedRole = isSuperAdmin ? "Super Admin" : "Quoting Staff"

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
    } catch (err) {
      console.error("Sign out error:", err)
    }
    window.location.href = "/admin/login"
  }

  const handleQuickSearch = () => {
    const input = document.getElementById("admin-global-search")
    if (input) {
      input.focus()
    } else {
      router.push("/admin/applications")
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      {/* Left: Sidebar Trigger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />

        <div className="flex flex-col">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {activeMeta.category}
          </span>
          <h1 className="font-display text-sm font-bold text-foreground">
            {activeMeta.title}
          </h1>
        </div>
      </div>

      {/* Right: Quick Search, SLA Warning, Notifications, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Search Trigger (Ctrl+K) */}
        <button
          type="button"
          onClick={handleQuickSearch}
          className="hidden items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground md:inline-flex cursor-pointer"
        >
          <Search className="size-3.5 text-muted-foreground" />
          <span>Search applications, pilgrims...</span>
          <kbd className="pointer-events-none inline-flex h-4.5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none">
            Ctrl K
          </kbd>
        </button>

        {/* 24h SLA Overdue Notification Pill */}
        {overdueCount > 0 ? (
          <Link
            href="/admin/applications?filter=overdue"
            className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 shadow-2xs transition-colors hover:bg-red-100"
            title={`${overdueCount} application(s) have been pending quote over SLA`}
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-600" />
            </span>
            <span className="hidden sm:inline">
              {overdueCount} Overdue {overdueCount === 1 ? "Quote" : "Quotes"}
            </span>
            <span className="font-mono text-[11px] font-bold">(24h+)</span>
          </Link>
        ) : (
          <div
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-2xs"
            title="All quotes are currently within SLA limits"
          >
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            <span>All Quotes Within SLA</span>
          </div>
        )}

        {/* Interactive Notifications Bell */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="View notifications"
                className="relative text-muted-foreground hover:text-foreground cursor-pointer"
              />
            }
          >
            <Bell className="size-4" />
            {(pendingQuoteCount > 0 || unreadMessagesCount > 0) && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-gold animate-pulse" />
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 bg-card">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Operational Inbox
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                render={<Link href="/admin/applications?status=pending_quote" />}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-amber-500" />
                  <span className="text-xs font-medium">Pending Quotes</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs font-bold text-amber-700 border-amber-300 bg-amber-50"
                >
                  {pendingQuoteCount}
                </Badge>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href="/admin/messages" />}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Inbox className="size-4 text-emerald-600" />
                  <span className="text-xs font-medium">Unread Messages</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs font-bold text-emerald-700 border-emerald-300 bg-emerald-50"
                >
                  {unreadMessagesCount}
                </Badge>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="hidden h-4 sm:block" />

        {/* Admin User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 px-1.5 hover:bg-secondary cursor-pointer"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden flex-col text-left md:flex">
              <span className="text-xs leading-none font-semibold text-foreground">
                {displayName}
              </span>
              <span className="mt-0.5 text-[10px] leading-none text-muted-foreground">
                {formattedRole}
              </span>
            </div>
            <ChevronDown className="hidden size-3.5 text-muted-foreground md:inline-block" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 bg-card">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground truncate max-w-[140px]">
                    {displayName}
                  </span>
                  <Badge
                    className={`px-1.5 py-0 text-[10px] ${
                      isSuperAdmin
                        ? "border-gold/40 bg-gold/20 text-gold-foreground"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {formattedRole}
                  </Badge>
                </div>
                <span className="font-mono text-xs font-normal text-muted-foreground truncate">
                  {displayEmail}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<Link href="/admin/settings" />}
                className="cursor-pointer"
              >
                <Settings className="size-4 text-muted-foreground" />
                <span>Agency Settings</span>
              </DropdownMenuItem>

              {isSuperAdmin && (
                <DropdownMenuItem
                  render={<Link href="/admin/users" />}
                  className="cursor-pointer"
                >
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <span>Staff & Roles</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
