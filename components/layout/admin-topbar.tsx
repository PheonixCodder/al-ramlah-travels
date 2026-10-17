"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Search,
  Bell,
  AlertTriangle,
  User,
  Settings,
  LogOut,
  ShieldCheck,
  ChevronDown,
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

export function AdminTopbar() {
  const pathname = usePathname()

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
          onClick={() => {
            // Simulated global search shortcut trigger
            const input = document.getElementById("admin-global-search")
            if (input) input.focus()
          }}
          className="hidden items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground md:inline-flex"
        >
          <Search className="size-3.5 text-muted-foreground" />
          <span>Search applications, pilgrims...</span>
          <kbd className="pointer-events-none inline-flex h-4.5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none">
            Ctrl K
          </kbd>
        </button>

        {/* 24h SLA Overdue Notification Pill */}
        <Link
          href="/admin/applications?filter=overdue"
          className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 shadow-2xs transition-colors hover:bg-red-100"
          title="1 application has been pending quote for over 24 hours"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-red-600" />
          </span>
          <span className="hidden sm:inline">1 Overdue Quote</span>
          <span className="font-mono text-[11px] font-bold">(24h+)</span>
        </Link>

        {/* Notifications Bell */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="View notifications"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="size-4" />
          <span className="absolute top-1 right-1 size-2 rounded-full bg-gold" />
        </Button>

        <Separator orientation="vertical" className="hidden h-4 sm:block" />

        {/* Admin User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 px-1.5 hover:bg-secondary"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                OA
              </AvatarFallback>
            </Avatar>
            <div className="hidden flex-col text-left md:flex">
              <span className="text-xs leading-none font-semibold text-foreground">
                Omar Al-Ansari
              </span>
              <span className="mt-0.5 text-[10px] leading-none text-muted-foreground">
                Super Admin
              </span>
            </div>
            <ChevronDown className="hidden size-3.5 text-muted-foreground md:inline-block" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 bg-card">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">
                  Omar Al-Ansari
                </span>
                <Badge className="border-gold/40 bg-gold/20 px-1.5 py-0 text-[10px] text-gold-foreground">
                  Super Admin
                </Badge>
              </div>
              <span className="font-mono text-xs font-normal text-muted-foreground">
                admin@alramlahtravels.com
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<Link href="/admin/settings" />}
                className="cursor-pointer"
              >
                <Settings className="size-4 text-muted-foreground" />
                <span>Agency Settings</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href="/admin/users" />}
                className="cursor-pointer"
              >
                <ShieldCheck className="size-4 text-muted-foreground" />
                <span>Staff & Roles</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              render={<Link href="/admin/login" />}
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
