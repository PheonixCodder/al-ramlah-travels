"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Sparkles,
  Share2,
  Inbox,
  Boxes,
  Settings,
  ExternalLink,
  LogOut,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"

export interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
  badgeClass?: string
  role?: "super_admin" | "staff"
}

export interface NavGroup {
  groupLabel: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupLabel: "Command Overview",
    items: [
      {
        title: "Executive Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    groupLabel: "Daily Operational Hubs",
    items: [
      {
        title: "Package & Poster Studio",
        href: "/admin/studio",
        icon: Sparkles,
      },
      {
        title: "Campaigns & Outreach",
        href: "/admin/campaigns",
        icon: Share2,
      },
      {
        title: "Pilgrim Inbox & Quote Desk",
        href: "/admin/desk",
        icon: Inbox,
        badgeClass: "bg-amber-500/25 text-amber-200 border border-amber-500/40",
      },
    ],
  },
  {
    groupLabel: "Inventory & Administration",
    items: [
      {
        title: "Catalog & Suppliers",
        href: "/admin/catalog",
        icon: Boxes,
      },
      {
        title: "Connections & Settings",
        href: "/admin/settings",
        icon: Settings,
      },
    ],
  },
]

export interface AdminSidebarUser {
  name?: string | null
  email?: string | null
  role?: string | null
}

export interface AdminSidebarProps
  extends React.ComponentProps<typeof Sidebar> {
  user?: AdminSidebarUser
  pendingQuotesCount?: number
  unreadMessagesCount?: number
}

export function AdminSidebar({
  user,
  pendingQuotesCount,
  unreadMessagesCount,
  ...props
}: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
    } catch (err) {
      console.error("Sign out error:", err)
    }
    router.push("/admin/login")
  }

  const isSuperAdmin = user?.role === "super_admin"

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground print:hidden"
      {...props}
    >
      {/* Sidebar Header: Brand Emblem & Portal Title */}
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-gold/40 bg-card p-1 shadow-xs">
            <Image
              src="/logo.jpg"
              alt="Al Ramlah Travels Emblem"
              width={36}
              height={36}
              className="size-full object-contain"
              priority
            />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate font-display text-sm font-bold tracking-tight text-sidebar-foreground">
              Al Ramlah Travels
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-wider text-gold uppercase">
                Admin Portal
              </span>
              <span className="text-[9px] text-sidebar-foreground/60">
                · v1.0
              </span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="bg-sidebar-border" />

      {/* Sidebar Content: 3 Consolidated Navigation Groups */}
      <SidebarContent className="gap-2 px-2 py-2">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.role || (item.role === "super_admin" && isSuperAdmin)
          )

          if (visibleItems.length === 0) return null

          return (
            <SidebarGroup key={group.groupLabel} className="p-0">
              <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase group-data-[collapsible=icon]:hidden">
                {group.groupLabel}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isActive = (() => {
                      if (!pathname) return false
                      if (item.href === "/admin") {
                        return pathname === "/admin"
                      }
                      if (item.href === "/admin/studio") {
                        return (
                          pathname.startsWith("/admin/studio") ||
                          pathname.startsWith("/admin/supplier-flyers") ||
                          pathname.startsWith("/admin/groups")
                        )
                      }
                      if (item.href === "/admin/campaigns") {
                        return (
                          pathname.startsWith("/admin/campaigns") ||
                          pathname.startsWith("/admin/distribution") ||
                          pathname.startsWith("/admin/outreach")
                        )
                      }
                      if (item.href === "/admin/desk") {
                        return (
                          pathname.startsWith("/admin/desk") ||
                          pathname.startsWith("/admin/applications") ||
                          pathname.startsWith("/admin/messages") ||
                          pathname.startsWith("/admin/post-lookup")
                        )
                      }
                      if (item.href === "/admin/catalog") {
                        return (
                          pathname.startsWith("/admin/catalog") ||
                          pathname.startsWith("/admin/hotels") ||
                          pathname.startsWith("/admin/visa") ||
                          pathname.startsWith("/admin/transport") ||
                          pathname.startsWith("/admin/ziyarat") ||
                          pathname.startsWith("/admin/flights") ||
                          pathname.startsWith("/admin/content")
                        )
                      }
                      if (item.href === "/admin/settings") {
                        return (
                          pathname.startsWith("/admin/settings") ||
                          pathname.startsWith("/admin/users")
                        )
                      }
                      return pathname.startsWith(item.href)
                    })()

                    let badgeValue: string | undefined = undefined
                    if (item.href === "/admin/desk") {
                      const totalDeskCount =
                        (pendingQuotesCount ?? 0) + (unreadMessagesCount ?? 0)
                      if (totalDeskCount > 0) {
                        badgeValue = String(totalDeskCount)
                      }
                    }

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.title}
                          render={<Link href={item.href} />}
                          className="transition-colors data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-gold cursor-pointer"
                        >
                          <item.icon className="size-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </SidebarMenuButton>

                        {badgeValue && (
                          <SidebarMenuBadge
                            className={
                              item.badgeClass ??
                              "bg-sidebar-accent text-sidebar-foreground"
                            }
                          >
                            {badgeValue}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarSeparator className="bg-sidebar-border" />

      {/* Sidebar Footer: User Profile, Open Public Website & Sign Out */}
      <SidebarFooter className="gap-2 p-2">
        {user && (
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 bg-sidebar-accent/50 border border-sidebar-border group-data-[collapsible=icon]:hidden">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-950/80 border border-gold/40 text-[11px] font-bold text-gold">
              {(user.name || "AR").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-medium text-sidebar-foreground">
                {user.name || "Admin Staff"}
              </span>
              <span className="truncate text-[10px] text-sidebar-foreground/60 capitalize">
                {user.role === "super_admin" ? "Super Admin" : "Agency Staff"}
              </span>
            </div>
          </div>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Open Public Website"
              render={
                <Link href="/" target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLink className="size-4 shrink-0 text-gold" />
              <span className="truncate">Open Public Website</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign Out"
              onClick={handleSignOut}
              className="text-red-300 hover:bg-red-950/30 hover:text-red-200 cursor-pointer"
            >
              <LogOut className="size-4 shrink-0" />
              <span className="truncate">Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
