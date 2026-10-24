"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  Inbox,
  Boxes,
  FileCheck,
  Building2,
  Car,
  Compass,
  Plane,
  Globe,
  Users,
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

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
  badgeClass?: string
  role?: "super_admin" | "staff"
}

interface NavGroup {
  groupLabel: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupLabel: "Overview & CRM",
    items: [
      {
        title: "Executive Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
      },
      {
        title: "Applications & Quotes",
        href: "/admin/applications",
        icon: FileText,
        badgeClass: "bg-amber-500/25 text-amber-200 border border-amber-500/40",
      },
      {
        title: "Contact Inbox",
        href: "/admin/messages",
        icon: Inbox,
        badgeClass:
          "bg-emerald-500/25 text-emerald-200 border border-emerald-500/40",
      },
    ],
  },
  {
    groupLabel: "Packages & Pricing",
    items: [
      {
        title: "Group Packages",
        href: "/admin/groups",
        icon: Boxes,
      },
      {
        title: "Visa Pricing",
        href: "/admin/visa",
        icon: FileCheck,
      },
    ],
  },
  {
    groupLabel: "Dynamic Inventory",
    items: [
      {
        title: "Hotels Catalog",
        href: "/admin/hotels",
        icon: Building2,
      },
      {
        title: "Transport & Vehicles",
        href: "/admin/transport",
        icon: Car,
      },
      {
        title: "Ziyarat Places",
        href: "/admin/ziyarat",
        icon: Compass,
      },
      {
        title: "Airlines & Cities",
        href: "/admin/flights",
        icon: Plane,
      },
    ],
  },
  {
    groupLabel: "Administration",
    items: [
      {
        title: "Website Content CMS",
        href: "/admin/content",
        icon: Globe,
      },
      {
        title: "Staff & Roles",
        href: "/admin/users",
        icon: Users,
        role: "super_admin",
      },
      {
        title: "Agency Settings",
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

      {/* Sidebar Content: 4 Navigation Groups */}
      <SidebarContent className="gap-2 px-2 py-2">
        {NAV_GROUPS.map((group) => {
          // Filter out items restricted to super_admin if current user is not super_admin
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
                    const isActive =
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname?.startsWith(item.href)

                    let badgeValue: string | undefined = undefined
                    if (
                      item.href === "/admin/applications" &&
                      pendingQuotesCount !== undefined &&
                      pendingQuotesCount > 0
                    ) {
                      badgeValue = String(pendingQuotesCount)
                    } else if (
                      item.href === "/admin/messages" &&
                      unreadMessagesCount !== undefined &&
                      unreadMessagesCount > 0
                    ) {
                      badgeValue = String(unreadMessagesCount)
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

      {/* Sidebar Footer: View Public Website & Sign Out */}
      <SidebarFooter className="gap-1 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="View Public Website"
              render={
                <Link href="/" target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLink className="size-4 shrink-0 text-gold" />
              <span className="truncate">View Public Site</span>
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
