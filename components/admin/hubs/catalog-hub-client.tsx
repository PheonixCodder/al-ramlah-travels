"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Building2,
  FileCheck,
  Car,
  Compass,
  Plane,
  Coins,
  Globe,
  Inbox,
  Plus,
  Search,
  MessageCircle,
  Edit2,
  Loader2,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { HotelsClient } from "@/components/admin/catalog/hotels-client"
import { VisaClient, type VisaRateData } from "@/components/admin/catalog/visa-client"
import { TransportClient, type TransportRateData } from "@/components/admin/catalog/transport-client"
import { ZiyaratClient } from "@/components/admin/catalog/ziyarat-client"
import { FlightsClient } from "@/components/admin/catalog/flights-client"
import { ContentClient, type CmsSubTab } from "@/components/admin/catalog/content-client"
import { HajjClient, type HajjPackageData } from "@/components/admin/catalog/hajj-client"
import { MessagesClient, type ContactMessageData } from "@/components/admin/catalog/messages-client"
import type { HotelData } from "@/components/admin/catalog/hotel-dialog"
import type { VehicleData } from "@/components/admin/catalog/vehicle-dialog"
import type { SectorData } from "@/components/admin/catalog/sector-dialog"
import type { ZiyaratData } from "@/components/admin/catalog/ziyarat-dialog"
import type { AirlineData } from "@/components/admin/catalog/airline-dialog"
import type { DepartureCityData } from "@/components/admin/catalog/departure-city-dialog"
import type {
  HeroSlideData,
  TestimonialData,
  FaqData,
} from "@/components/admin/catalog/content-dialogs"
import { upsertSupplier } from "@/app/actions/marketing-ops"
import { buildWhatsappUrl } from "@/lib/company-info"
import { cn } from "@/lib/utils"

export interface SupplierRecord {
  id: string
  name: string
  slug: string
  codePrefix: string
  category: "group_packages" | "custom_packages" | "both"
  defaultCommissionMode: "included_in_flyer" | "net_plus_markup"
  defaultCommissionPkr: number
  contactPerson: string | null
  whatsappNumber: string | null
  phone: string | null
  notes: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type CatalogTabKey =
  | "hotels"
  | "visa"
  | "transport"
  | "ziyarat"
  | "flights"
  | "hajj"
  | "suppliers"
  | "cms"
  | "messages"

export function resolveCatalogTab(rawTab?: string | null): {
  tab: CatalogTabKey
  cmsSubTab?: CmsSubTab
} {
  const normalized = (rawTab ?? "").trim().toLowerCase()
  switch (normalized) {
    case "hotels":
    case "hotel":
      return { tab: "hotels" }
    case "visa":
    case "visas":
      return { tab: "visa" }
    case "transport":
    case "vehicles":
      return { tab: "transport" }
    case "ziyarat":
      return { tab: "ziyarat" }
    case "flights":
    case "airlines":
      return { tab: "flights" }
    case "hajj":
    case "hajj-2027":
    case "hajj_packages":
      return { tab: "hajj" }
    case "suppliers":
    case "supplier":
      return { tab: "suppliers" }
    case "cms":
    case "content":
      return { tab: "cms" }
    case "gallery":
      return { tab: "cms", cmsSubTab: "gallery" }
    case "messages":
    case "inquiries":
    case "inbox":
      return { tab: "messages" }
    default:
      return { tab: "hotels" }
  }
}

export interface CatalogHubClientProps {
  initialTab?: string
  hotels: HotelData[]
  visaRates: VisaRateData[]
  sarToPkrRate?: number
  vehicles: VehicleData[]
  transportSectors: SectorData[]
  transportRates: TransportRateData[]
  ziyaratPlaces: ZiyaratData[]
  airlines: AirlineData[]
  departureCities: DepartureCityData[]
  hajjPackages?: HajjPackageData[]
  suppliers: SupplierRecord[]
  heroSlides: HeroSlideData[]
  testimonials: TestimonialData[]
  faqs: FaqData[]
  contactMessages?: ContactMessageData[]
}

const TAB_CONFIG: Array<{
  key: CatalogTabKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}> = [
  {
    key: "hotels",
    label: "Hotels Catalog",
    icon: Building2,
    description: "Makkah & Madinah hotel properties, distance bands, galleries & SAR tariffs",
  },
  {
    key: "visa",
    label: "Visa Pricing",
    icon: FileCheck,
    description: "Short-term & long-term Umrah visa tariffs, Masar fees, and SAR-PKR conversion",
  },
  {
    key: "transport",
    label: "Transport & Vehicles",
    icon: Car,
    description: "Vehicle fleet capacities, inter-city ground transfer sectors & route matrices",
  },
  {
    key: "ziyarat",
    label: "Ziyarat Places",
    icon: Compass,
    description: "Holy ziyarat sites across Makkah & Madinah with Arabic descriptions",
  },
  {
    key: "flights",
    label: "Airlines & Cities",
    icon: Plane,
    description: "Authorized flight carriers, IATA codes, and Pakistan origin departure cities",
  },
  {
    key: "hajj",
    label: "Hajj 2027",
    icon: Sparkles,
    description: "Indicative 2027 Pre-Registration Maktab tiers, hotel bands & regulatory disclaimers",
  },
  {
    key: "suppliers",
    label: "B2B Suppliers",
    icon: Coins,
    description: "Wholesale flight & group inventory partners, commission margins & contact lines",
  },
  {
    key: "cms",
    label: "Website CMS",
    icon: Globe,
    description: "Hero landing slides, pilgrim testimonials, FAQs, and property galleries",
  },
  {
    key: "messages",
    label: "Web Inquiries",
    icon: Inbox,
    description: "Public contact-us inquiries, triage notes, and one-click E.164 WhatsApp replies",
  },
]

export function CatalogHubClient({
  initialTab = "hotels",
  hotels,
  visaRates,
  sarToPkrRate = 75,
  vehicles,
  transportSectors,
  transportRates,
  ziyaratPlaces,
  airlines,
  departureCities,
  hajjPackages = [],
  suppliers: initialSuppliers,
  heroSlides,
  testimonials,
  faqs,
  contactMessages = [],
}: CatalogHubClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const resolvedTab = React.useMemo(() => {
    const urlTab = searchParams.get("tab")
    if (urlTab) {
      return resolveCatalogTab(urlTab)
    }
    return resolveCatalogTab(initialTab)
  }, [searchParams, initialTab])

  const activeTab = resolvedTab.tab

  const handleTabChange = (key: CatalogTabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const unreadMessagesCount = React.useMemo(
    () => contactMessages.filter((m) => m.status === "unread").length,
    [contactMessages]
  )

  // Calculate live item counts for tab badges
  const tabCounts: Record<CatalogTabKey, number> = {
    hotels: hotels.length,
    visa: visaRates.length || 2,
    transport: vehicles.length,
    ziyarat: ziyaratPlaces.length,
    flights: airlines.length,
    hajj: hajjPackages.length,
    suppliers: initialSuppliers.length,
    cms: heroSlides.length + testimonials.length + faqs.length,
    messages: unreadMessagesCount > 0 ? unreadMessagesCount : contactMessages.length,
  }

  const activeMeta = TAB_CONFIG.find((t) => t.key === activeTab) || TAB_CONFIG[0]

  return (
    <div className="flex flex-col gap-6">
      {/* Hub Header */}
      <div className="flex flex-col gap-2 border-b border-border/80 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold-text">
            Hub 4 • Operations &amp; Dynamic Inventory
          </span>
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5"
          >
            {hotels.length} Hotels • {hajjPackages.length} Hajj Tiers • {initialSuppliers.length} Suppliers • {airlines.length} Airlines
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Catalog &amp; Dynamic Inventory
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl">
              Unified administrative workspace for master tariffs, vehicle fleets, holy ziyarat sites,
              flight schedules, Indicative 2027 Hajj pre-registration tiers, B2B wholesale suppliers,
              public CMS content, and web inquiries.
            </p>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="mt-3 flex overflow-x-auto rounded-xl border border-border/80 bg-muted/40 p-1.5 gap-1.5 no-scrollbar">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            const count = tabCounts[tab.key]

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all cursor-pointer select-none",
                  isActive
                    ? "bg-card text-foreground shadow-xs border border-gold/40 text-primary"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-gold-text" : "text-muted-foreground"
                  )}
                />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : tab.key === "messages" && unreadMessagesCount > 0
                        ? "bg-gold text-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Context Banner */}
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-foreground">{activeMeta.label}:</span>
          <span className="text-muted-foreground hidden sm:inline">
            {activeMeta.description}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
          ?tab={activeTab}
        </Badge>
      </div>

      {/* Tab Views */}
      <div className="min-h-[500px]">
        {activeTab === "hotels" && <HotelsClient initialHotels={hotels} />}

        {activeTab === "visa" && (
          <VisaClient
            initialRates={visaRates}
            initialSarToPkrRate={sarToPkrRate}
          />
        )}

        {activeTab === "transport" && (
          <TransportClient
            initialVehicles={vehicles}
            initialSectors={transportSectors}
            initialRates={transportRates}
          />
        )}

        {activeTab === "ziyarat" && (
          <ZiyaratClient initialPlaces={ziyaratPlaces} />
        )}

        {activeTab === "flights" && (
          <FlightsClient
            initialAirlines={airlines}
            initialCities={departureCities}
          />
        )}

        {activeTab === "hajj" && (
          <HajjClient initialPackages={hajjPackages} />
        )}

        {activeTab === "suppliers" && (
          <B2BSuppliersTab initialSuppliers={initialSuppliers} />
        )}

        {activeTab === "cms" && (
          <ContentClient
            initialSlides={heroSlides}
            initialTestimonials={testimonials}
            initialFaqs={faqs}
            initialHotels={hotels}
            initialSubTab={resolvedTab.cmsSubTab ?? "slides"}
          />
        )}

        {activeTab === "messages" && (
          <MessagesClient initialMessages={contactMessages} />
        )}
      </div>
    </div>
  )
}

// ==========================================
// B2B SUPPLIERS MANAGER TAB
// ==========================================

interface B2BSuppliersTabProps {
  initialSuppliers: SupplierRecord[]
}

function B2BSuppliersTab({ initialSuppliers }: B2BSuppliersTabProps) {
  const router = useRouter()
  const [suppliersList, setSuppliersList] =
    React.useState<SupplierRecord[]>(initialSuppliers)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [bannerError, setBannerError] = React.useState<string | null>(null)

  // Add / Edit Dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingSupplier, setEditingSupplier] =
    React.useState<SupplierRecord | null>(null)
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [codePrefix, setCodePrefix] = React.useState("")
  const [category, setCategory] = React.useState<
    "group_packages" | "custom_packages" | "both"
  >("group_packages")
  const [defaultCommissionMode, setDefaultCommissionMode] = React.useState<
    "included_in_flyer" | "net_plus_markup"
  >("included_in_flyer")
  const [defaultCommissionPkr, setDefaultCommissionPkr] = React.useState(22000)
  const [contactPerson, setContactPerson] = React.useState("")
  const [whatsappNumber, setWhatsappNumber] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [isActive, setIsActive] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setSuppliersList(initialSuppliers)
  }, [initialSuppliers])

  const filteredSuppliers = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return suppliersList.filter((s) => {
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false
      if (statusFilter === "active" && !s.isActive) return false
      if (statusFilter === "inactive" && s.isActive) return false
      if (!q) return true

      return (
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.codePrefix.toLowerCase().includes(q) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
        (s.whatsappNumber && s.whatsappNumber.includes(q))
      )
    })
  }, [suppliersList, searchQuery, categoryFilter, statusFilter])

  const openAddDialog = () => {
    setEditingSupplier(null)
    setName("")
    setSlug("")
    setCodePrefix("")
    setCategory("group_packages")
    setDefaultCommissionMode("included_in_flyer")
    setDefaultCommissionPkr(22000)
    setContactPerson("")
    setWhatsappNumber("")
    setPhone("")
    setNotes("")
    setIsActive(true)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEditDialog = (s: SupplierRecord) => {
    setEditingSupplier(s)
    setName(s.name)
    setSlug(s.slug)
    setCodePrefix(s.codePrefix)
    setCategory(s.category)
    setDefaultCommissionMode(s.defaultCommissionMode)
    setDefaultCommissionPkr(s.defaultCommissionPkr)
    setContactPerson(s.contactPerson || "")
    setWhatsappNumber(s.whatsappNumber || "")
    setPhone(s.phone || "")
    setNotes(s.notes || "")
    setIsActive(s.isActive)
    setFormError(null)
    setDialogOpen(true)
  }

  const handleNameChange = (val: string) => {
    setName(val)
    if (!editingSupplier) {
      const derivedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
      setSlug(derivedSlug)

      const parts = val.trim().split(/\s+/)
      const derivedPrefix =
        parts.length > 1 && parts[0]?.[0] && parts[1]?.[0]
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : val.slice(0, 2).toUpperCase()
      setCodePrefix(derivedPrefix.slice(0, 4))
    }
  }

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setFormError("Supplier Name is required.")
      return
    }
    if (!slug.trim()) {
      setFormError("Supplier Slug is required.")
      return
    }
    if (!codePrefix.trim()) {
      setFormError("Code Prefix (e.g. 'UP', 'AM') is required.")
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      const res = await upsertSupplier({
        id: editingSupplier?.id,
        name: name.trim(),
        slug: slug.trim(),
        codePrefix: codePrefix.trim().toUpperCase(),
        category,
        defaultCommissionMode,
        defaultCommissionPkr: Math.max(0, defaultCommissionPkr),
        contactPerson: contactPerson.trim() || null,
        whatsappNumber: whatsappNumber.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        isActive,
      })

      if (res.success && res.supplier) {
        setDialogOpen(false)
        router.refresh()
      } else {
        setFormError(res.error || "Failed to save supplier.")
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error saving supplier")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (s: SupplierRecord) => {
    const nextStatus = !s.isActive
    setBannerError(null)
    setSuppliersList((prev) =>
      prev.map((item) => (item.id === s.id ? { ...item, isActive: nextStatus } : item))
    )

    try {
      const res = await upsertSupplier({
        id: s.id,
        name: s.name,
        slug: s.slug,
        codePrefix: s.codePrefix,
        category: s.category,
        defaultCommissionMode: s.defaultCommissionMode,
        defaultCommissionPkr: s.defaultCommissionPkr,
        contactPerson: s.contactPerson,
        whatsappNumber: s.whatsappNumber,
        phone: s.phone,
        notes: s.notes,
        isActive: nextStatus,
      })
      if (!res.success) {
        setSuppliersList((prev) =>
          prev.map((item) => (item.id === s.id ? { ...item, isActive: s.isActive } : item))
        )
        setBannerError(res.error || "Failed to update supplier status.")
        return
      }
      router.refresh()
    } catch (err: unknown) {
      setSuppliersList((prev) =>
        prev.map((item) => (item.id === s.id ? { ...item, isActive: s.isActive } : item))
      )
      setBannerError(
        err instanceof Error ? err.message : "Failed to update supplier status."
      )
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {bannerError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs font-medium text-destructive">
          {bannerError}
        </div>
      )}

      {/* Search & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search suppliers by name, slug, prefix..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Categories</option>
            <option value="group_packages">Group Packages</option>
            <option value="custom_packages">Custom Packages</option>
            <option value="both">Both</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <Button
            onClick={openAddDialog}
            className="gap-1.5 h-9 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Add Supplier</span>
          </Button>
        </div>
      </div>

      {/* Supplier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((s) => (
          <div
            key={s.id}
            className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs transition-all hover:border-gold/50 hover:shadow-sm"
          >
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-gold/10 border border-gold/30 text-gold-text font-bold font-mono text-sm">
                    {s.codePrefix}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">
                      {s.name}
                    </h3>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      @{s.slug}
                    </p>
                  </div>
                </div>

                <Badge
                  variant={s.isActive ? "default" : "secondary"}
                  className={cn(
                    "text-[10px] font-semibold cursor-pointer select-none",
                    s.isActive
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                  onClick={() => handleToggleActive(s)}
                  title="Click to toggle active status"
                >
                  {s.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* Commission & Details */}
              <div className="space-y-2 py-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Category:</span>
                  <Badge variant="outline" className="text-[10px] font-medium capitalize">
                    {s.category.replace(/_/g, " ")}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Commission Mode:</span>
                  <span className="font-semibold text-foreground text-[11px]">
                    {s.defaultCommissionMode === "included_in_flyer"
                      ? "Included in Flyer"
                      : "Net + Fixed Markup"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Default Margin:</span>
                  <span className="font-mono font-bold text-gold-text text-xs">
                    PKR {s.defaultCommissionPkr.toLocaleString()} / pax
                  </span>
                </div>

                {s.contactPerson && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Contact:</span>
                    <span className="font-medium text-foreground">{s.contactPerson}</span>
                  </div>
                )}

                {s.whatsappNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">WhatsApp:</span>
                    <a
                      href={buildWhatsappUrl(s.whatsappNumber)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      <MessageCircle className="size-3 text-emerald-600" />
                      <span>{s.whatsappNumber}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Card Footer Actions */}
            <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-2">
              <span className="text-[10px] text-muted-foreground">
                Updated {new Date(s.updatedAt).toLocaleDateString()}
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(s)}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Edit2 className="size-3.5" />
                <span>Edit</span>
              </Button>
            </div>
          </div>
        ))}

        {filteredSuppliers.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            <Coins className="size-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="font-semibold text-foreground">No suppliers found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search query or add a new wholesale supplier.
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          key={dialogOpen ? (editingSupplier?.id ?? "new") : "closed"}
          className="sm:max-w-md bg-card border border-gold/40 shadow-xl rounded-2xl"
        >
          <form onSubmit={handleSaveSupplier}>
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? `Edit ${editingSupplier.name}` : "Add New B2B Supplier"}
              </DialogTitle>
              <DialogDescription>
                Configure wholesale inventory partner credentials, code prefix, and default margins.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/30 p-2.5 text-xs font-medium text-destructive">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Supplier Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Upsky Travels"
                  className="h-8 text-xs mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Slug *</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="upsky-travels"
                  className="h-8 text-xs mt-1 font-mono"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Code Prefix (1-8 chars) *</Label>
                <Input
                  value={codePrefix}
                  onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
                  placeholder="UP"
                  maxLength={8}
                  className="h-8 text-xs mt-1 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Category</Label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as "group_packages" | "custom_packages" | "both"
                    )
                  }
                  className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs mt-1"
                >
                  <option value="group_packages">Group Packages</option>
                  <option value="custom_packages">Custom Packages</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Commission Mode</Label>
                <select
                  value={defaultCommissionMode}
                  onChange={(e) =>
                    setDefaultCommissionMode(
                      e.target.value as "included_in_flyer" | "net_plus_markup"
                    )
                  }
                  className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs mt-1"
                >
                  <option value="included_in_flyer">Included in Flyer</option>
                  <option value="net_plus_markup">Net + Markup</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">
                  Default Commission (PKR / pax)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={defaultCommissionPkr}
                  onChange={(e) =>
                    setDefaultCommissionPkr(parseInt(e.target.value, 10) || 0)
                  }
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Contact Person</Label>
                <Input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Sheikh Zahoor"
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">WhatsApp Number</Label>
                <Input
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+923214567890"
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Notes / Office Address</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Wholesale ticketing desk notes, payment terms, or bank accounts..."
                  className="text-xs mt-1 min-h-[60px]"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="supplier-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                />
                <Label htmlFor="supplier-active" className="text-xs font-medium cursor-pointer">
                  Supplier is active and available for flyer extraction &amp; reverse lookups
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
                className="cursor-pointer text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="cursor-pointer gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{editingSupplier ? "Update Supplier" : "Create Supplier"}</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
