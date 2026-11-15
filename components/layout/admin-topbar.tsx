"use client"

import * as React from "react"
import dynamic from "next/dynamic"
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
import {
  DEFAULT_SLA_OVERDUE_HOURS,
  useAdminSlaOverdueHours,
} from "@/components/layout/status-badge"
import { authClient } from "@/lib/auth-client"

const LazyCommandPalette = dynamic(
  () =>
    import("@/components/layout/command-palette").then(
      (mod) => mod.CommandPalette
    ),
  { ssr: false }
)

const ROUTE_TITLES: Record<string, { title: string; category: string }> = {
  "/admin": { title: "Executive Dashboard", category: "Overview & CRM" },
  "/admin/studio": {
    title: "Package & Poster Studio",
    category: "Daily Operational Hubs",
  },
  "/admin/campaigns": {
    title: "Campaigns & Outreach",
    category: "Daily Operational Hubs",
  },
  "/admin/desk": {
    title: "Pilgrim Inbox & Quote Desk",
    category: "Daily Operational Hubs",
  },
  "/admin/catalog": {
    title: "Catalog & Suppliers",
    category: "Inventory & Administration",
  },
  "/admin/settings": {
    title: "Connections & Settings",
    category: "Inventory & Administration",
  },
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
  slaOverdueHours?: number
}

export function AdminTopbar({
  user,
  pendingQuoteCount = 0,
  overdueCount = 0,
  unreadMessagesCount = 0,
  slaOverdueHours,
}: AdminTopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const contextSlaHours = useAdminSlaOverdueHours()

  const effectiveSlaHours =
    typeof slaOverdueHours === "number" &&
    Number.isFinite(slaOverdueHours) &&
    slaOverdueHours > 0
      ? slaOverdueHours
      : typeof contextSlaHours === "number" &&
          Number.isFinite(contextSlaHours) &&
          contextSlaHours > 0
        ? contextSlaHours
        : DEFAULT_SLA_OVERDUE_HOURS

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
  }, [user])

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
    router.push("/admin/login")
  }

  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false)
  const [hasLoadedPalette, setHasLoadedPalette] = React.useState(false)

  const handleOpenCommandPalette = React.useCallback(() => {
    setHasLoadedPalette(true)
    setCommandPaletteOpen(true)
  }, [])

  React.useEffect(() => {
    if (hasLoadedPalette) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === "k" || event.key === "K") &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        setHasLoadedPalette(true)
        setCommandPaletteOpen(true)
      }
    }

    const handleCustomOpen = () => {
      setHasLoadedPalette(true)
      setCommandPaletteOpen(true)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("open-post-lookup", handleCustomOpen)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("open-post-lookup", handleCustomOpen)
    }
  }, [hasLoadedPalette])

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 sm:px-6 print:hidden">
      {/* Deferred Global Cmd+K Command Palette (lazy chunk loaded on demand) */}
      {hasLoadedPalette && (
        <LazyCommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
        />
      )}

      {/* Left: Sidebar Trigger & Breadcrumb */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />

        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {activeMeta.category}
          </span>
          <span className="truncate font-display text-sm font-bold text-foreground">
            {activeMeta.title}
          </span>
        </div>
      </div>

      {/* Right: Prominent Global Cmd+K Search, SLA Warning, Notifications, User Profile */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {/* Prominent "Search Post Ref / Price (⌘K)" Trigger Pill */}
        <button
          type="button"
          onClick={handleOpenCommandPalette}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gold/40 bg-background/80 px-2 py-1.5 text-xs font-medium text-foreground transition-all hover:border-gold hover:bg-gold/10 hover:shadow-2xs focus-visible:ring-2 focus-visible:ring-ring sm:px-3"
          title="Search Post Ref codes, PKR prices, hotels, or jump to operational hubs (⌘K or Ctrl+K)"
        >
          <Search aria-hidden="true" className="size-3.5 shrink-0 text-gold-text" />
          <span className="hidden sm:inline">Search Post Ref / Price</span>
          <span className="text-[11px] sm:hidden">Search</span>
          <kbd
            aria-hidden="true"
            className="pointer-events-none hidden h-4.5 items-center gap-0.5 rounded border border-gold/30 bg-gold/10 px-1.5 font-mono text-[10px] font-bold text-gold-foreground select-none sm:inline-flex"
          >
            ⌘K
          </kbd>
        </button>

        {/* Dynamic SLA Overdue Notification Pill */}
        {overdueCount > 0 ? (
          <Link
            href="/admin/desk?tab=pipeline&filter=overdue"
            className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 tabular-nums shadow-2xs transition-colors hover:bg-red-100"
            title={`${overdueCount} application(s) have been pending quote over ${effectiveSlaHours}h SLA`}
          >
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-red-600" />
            </span>
            <span className="hidden tabular-nums sm:inline">
              {overdueCount} Overdue {overdueCount === 1 ? "Quote" : "Quotes"}
            </span>
            <span className="font-mono text-[11px] font-bold tabular-nums">
              ({effectiveSlaHours}h+)
            </span>
          </Link>
        ) : (
          <div
            className="hidden items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-2xs lg:inline-flex"
            title={`All quotes are currently within ${effectiveSlaHours}h SLA limits`}
          >
            <CheckCircle2 aria-hidden="true" className="size-3.5 text-emerald-600" />
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
                className="relative cursor-pointer text-muted-foreground hover:text-foreground"
              />
            }
          >
            <Bell className="size-4" />
            {(pendingQuoteCount > 0 || unreadMessagesCount > 0) && (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 size-2 animate-pulse rounded-full bg-gold motion-reduce:animate-none"
              />
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 bg-card">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Operational Inbox
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                render={<Link href="/admin/desk?tab=pipeline&status=pending_quote" />}
                className="flex cursor-pointer items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-amber-600" />
                  <span className="text-xs font-medium">Pending Quotes</span>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 font-mono text-xs font-bold text-amber-800 tabular-nums"
                >
                  {pendingQuoteCount}
                </Badge>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href="/admin/catalog?tab=messages" />}
                className="flex cursor-pointer items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Inbox className="size-4 text-emerald-600" />
                  <span className="text-xs font-medium">Unread Messages</span>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50 font-mono text-xs font-bold text-emerald-800 tabular-nums"
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
                className="cursor-pointer gap-2 px-1.5 hover:bg-secondary"
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
            <span className="sr-only">account menu</span>
            <ChevronDown aria-hidden="true" className="hidden size-3.5 text-muted-foreground md:inline-block" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 bg-card">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="max-w-[140px] truncate font-semibold text-foreground">
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
                <span className="truncate font-mono text-xs font-normal text-muted-foreground">
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
                  render={<Link href="/admin/settings?tab=users" />}
                  className="cursor-pointer"
                >
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <span>Staff &amp; Roles</span>
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
