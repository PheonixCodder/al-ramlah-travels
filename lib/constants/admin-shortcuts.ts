export interface CommandHubShortcut {
  id: string
  title: string
  category: string
  href: string
  icon: "Sparkles" | "Share2" | "Inbox" | "Boxes" | "Settings"
  description: string
  badge?: string
}

export const ADMIN_HUB_SHORTCUTS: CommandHubShortcut[] = [
  {
    id: "hub-studio",
    title: "Package & Poster Studio",
    category: "Operational Hubs",
    href: "/admin/studio",
    icon: "Sparkles",
    description: "Multimodal flyer extraction, 4K poster vault & group packages",
    badge: "Studio",
  },
  {
    id: "hub-campaigns",
    title: "Campaigns & Outreach",
    category: "Operational Hubs",
    href: "/admin/campaigns",
    icon: "Share2",
    description: "Social media calendar, WhatsApp groups & 14-day VIP outreach",
    badge: "Campaigns",
  },
  {
    id: "hub-desk",
    title: "Pilgrim Inbox & Quote Desk",
    category: "Operational Hubs",
    href: "/admin/desk",
    icon: "Inbox",
    description: "Shared WhatsApp team inbox & 5-column Kanban quoting pipeline",
    badge: "Desk",
  },
  {
    id: "hub-catalog",
    title: "Catalog & Dynamic Inventory",
    category: "Operations & Inventory",
    href: "/admin/catalog",
    icon: "Boxes",
    description:
      "Hotels, visa tariffs, transport sectors, ziyarat, flights & suppliers",
    badge: "Catalog",
  },
  {
    id: "hub-settings",
    title: "Connections & Settings",
    category: "System",
    href: "/admin/settings",
    icon: "Settings",
    description: "Meta WABA, social accounts, Gotenberg PDF engine & staff access",
    badge: "Settings",
  },
]
