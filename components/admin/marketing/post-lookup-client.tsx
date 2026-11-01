"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Sparkles,
  Building2,
  Plane,
  Coins,
  Share2,
  UserPlus,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  convertPostLookupToApplication,
  generateSingleSpotlightForCard,
} from "@/app/actions/marketing-ops"

export interface LookupPackageItem {
  id: string
  cardNumber: string
  postCode: string
  outboundFlightNo: string
  outboundDateLabel: string
  outboundRoute: string
  outboundDepTime: string
  outboundArrTime: string
  returnFlightNo: string
  returnDateLabel: string
  returnRoute: string
  returnDepTime: string
  returnArrTime: string
  makkahNights: string
  makkahHotelName: string
  makkahDistanceLabel: string
  madinahNights: string
  madinahHotelName: string
  madinahDistanceLabel: string
  mealPlanLabel?: string | null
  netSharingPkr: number
  netQuadPkr: number
  netTriplePkr: number
  netDoublePkr: number
  retailSharingPkr: number
  retailQuadPkr: number
  retailTriplePkr: number
  retailDoublePkr: number
  commissionPkr: number
  spotlightPosterUrl?: string | null
  spotlightPdfUrl?: string | null
  flyer: {
    id: string
    title: string
    rawFlyerImageUrl: string
    multiSheetImageUrl?: string | null
    airlineName: string
    daysTitle: string
    routePill: string
    commissionMode: "included_in_flyer" | "net_plus_markup"
  }
  supplier: {
    id: string
    name: string
    codePrefix: string
    whatsappNumber?: string | null
  }
}

export interface LookupDistributionItem {
  id: string
  scheduledDate: string
  stage: string
  senderWhatsappLine?: string | null
  channel: {
    id: string
    name: string
    platform: string
    areaTag: string
  }
  postAsset: {
    id: string
    postCode: string
    flyerId?: string | null
    flyerPackageId?: string | null
  }
}

export function PostLookupClient({
  packages,
  distributions,
  channels,
}: {
  packages: LookupPackageItem[]
  distributions: LookupDistributionItem[]
  channels: Array<{ id: string; name: string; areaTag: string }>
}) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [supplierFilter, setSupplierFilter] = React.useState("all")
  const [convertingPkgId, setConvertingPkgId] = React.useState<string | null>(
    null
  )
  const [customerName, setCustomerName] = React.useState("")
  const [customerPhone, setCustomerPhone] = React.useState("")
  const [customerCity, setCustomerCity] = React.useState("Lahore")
  const [roomType, setRoomType] = React.useState<
    "sharing" | "quad" | "triple" | "double"
  >("sharing")
  const [adults, setAdults] = React.useState(2)
  const [sourceChannelId, setSourceChannelId] = React.useState("")
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [convertedApp, setConvertedApp] = React.useState<{
    applicationId: string
    referenceNumber: string
  } | null>(null)

  const suppliersList = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const p of packages) {
      map.set(p.supplier.id, p.supplier.name)
    }
    return Array.from(map.entries())
  }, [packages])

  const filteredPackages = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/,/g, "")
    return packages.filter((p) => {
      if (supplierFilter !== "all" && p.supplier.id !== supplierFilter) {
        return false
      }
      if (!q) return true

      // Match against postCode, hotel names, flight numbers, dates, prices, supplier, or distributed channels
      const pkgDistributions = distributions.filter(
        (d) =>
          d.postAsset?.flyerPackageId === p.id ||
          d.postAsset?.flyerId === p.flyer.id ||
          d.postAsset?.postCode === p.postCode
      )
      const channelNames = pkgDistributions
        .map((d) => `${d.channel.name} ${d.channel.areaTag} ${d.scheduledDate}`)
        .join(" ")

      const haystack = [
        p.postCode,
        p.flyer.title,
        p.supplier.name,
        p.flyer.airlineName,
        p.outboundFlightNo,
        p.outboundDateLabel,
        p.returnDateLabel,
        p.makkahHotelName,
        p.madinahHotelName,
        String(p.retailSharingPkr),
        String(p.retailQuadPkr),
        String(p.retailTriplePkr),
        String(p.retailDoublePkr),
        channelNames,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [packages, distributions, searchQuery, supplierFilter])

  const handleConvert = async (pkgId: string) => {
    if (!customerName.trim() || !customerPhone.trim()) return
    setBusyId(pkgId)
    try {
      const res = await convertPostLookupToApplication({
        packageItemId: pkgId,
        customerName,
        customerPhone,
        customerCity,
        selectedRoomType: roomType,
        adults,
        sourceChannelId: sourceChannelId || undefined,
      })
      if (res.success && res.applicationId && res.referenceNumber) {
        setConvertedApp({
          applicationId: res.applicationId,
          referenceNumber: res.referenceNumber,
        })
        setConvertingPkgId(null)
        router.refresh()
      }
    } finally {
      setBusyId(null)
    }
  }

  const handleQuickSpotlight = async (pkgId: string) => {
    setBusyId(`spot-${pkgId}`)
    try {
      await generateSingleSpotlightForCard(pkgId)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Search Bar & Filters */}
      <Card className="border-gold/40 bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12 items-end">
            <div className="md:col-span-8">
              <Label className="text-xs font-bold text-primary">
                Instant Reverse Lookup (Ref Code, Price, Hotel, Date, Flight, or Group Name)
              </Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-2.5 size-4 text-gold" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Try: ART-AM-21D, 269,899, Dar Al Khalil, Swissotel, 10 NOV, Askari 10, Saudia..."
                  className="pl-9 font-mono text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <Label className="text-xs font-semibold">Filter by B2B Supplier</Label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="all">All Suppliers ({packages.length} Packages)</option>
                {suppliersList.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {convertedApp && (
        <div className="rounded-xl border border-emerald-400 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-emerald-950 text-xs">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
            <div>
              <strong>Customer Application &amp; Official Quote Created!</strong>{" "}
              Reference Code:{" "}
              <span className="font-mono font-bold">
                {convertedApp.referenceNumber}
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              router.push(`/admin/applications/${convertedApp.applicationId}`)
            }
            className="bg-[#0A3622] text-white text-xs font-bold cursor-pointer"
          >
            <span>Open Quote &amp; Generate 3-Page PDF →</span>
          </Button>
        </div>
      )}

      {/* Matching Results List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredPackages.map((pkg) => {
          const pkgDistributions = distributions.filter(
            (d) =>
              d.postAsset?.flyerPackageId === pkg.id ||
              d.postAsset?.flyerId === pkg.flyer.id ||
              d.postAsset?.postCode === pkg.postCode
          )

          return (
            <Card
              key={pkg.id}
              className="border-border bg-card shadow-xs hover:border-gold/60 transition-colors"
            >
              <CardHeader className="bg-secondary/25 border-b border-border py-3 px-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-primary px-2.5 py-1 font-mono text-xs font-black text-gold">
                      {pkg.postCode}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-gold/50 bg-gold/10 text-xs font-bold text-foreground"
                    >
                      Supplier: {pkg.supplier.name}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-xs font-mono font-semibold"
                    >
                      {pkg.flyer.airlineName} · {pkg.flyer.daysTitle} (
                      {pkg.outboundDateLabel} → {pkg.returnDateLabel})
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={pkg.flyer.rawFlyerImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-[11px] font-medium hover:bg-secondary"
                    >
                      <ImageIcon className="size-3 text-muted-foreground" />
                      <span>Original Supplier Flyer</span>
                    </a>

                    {pkg.spotlightPosterUrl ? (
                      <a
                        href={pkg.spotlightPosterUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-[#0A3622] px-2.5 py-1 text-[11px] font-bold text-gold hover:bg-[#0A3622]/90"
                      >
                        <Sparkles className="size-3" />
                        <span>Our 4K Spotlight Poster</span>
                        <ExternalLink className="size-2.5" />
                      </a>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === `spot-${pkg.id}`}
                        onClick={() => handleQuickSpotlight(pkg.id)}
                        className="h-7 text-[11px] gap-1 cursor-pointer"
                      >
                        {busyId === `spot-${pkg.id}` ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Sparkles className="size-3 text-gold" />
                        )}
                        <span>Render 4K Spotlight</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setConvertingPkgId(
                          convertingPkgId === pkg.id ? null : pkg.id
                        )
                      }
                      className="h-7 bg-primary text-white hover:bg-primary/90 text-[11px] font-bold gap-1 cursor-pointer"
                    >
                      <UserPlus className="size-3 text-gold" />
                      <span>Convert to Customer Quote</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  {/* Col 1: Flights & Hotels */}
                  <div className="lg:col-span-5 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Plane className="size-3.5 text-primary" />
                      <span>
                        Outbound: {pkg.outboundFlightNo} ({pkg.outboundDateLabel}{" "}
                        · {pkg.outboundDepTime}-{pkg.outboundArrTime}) | Return:{" "}
                        {pkg.returnFlightNo} ({pkg.returnDateLabel})
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Building2 className="size-3.5 text-amber-700 mt-0.5 shrink-0" />
                      <div>
                        <div>
                          <strong className="text-primary">
                            Makkah ({pkg.makkahNights}):
                          </strong>{" "}
                          {pkg.makkahHotelName} {pkg.makkahDistanceLabel}
                        </div>
                        <div>
                          <strong className="text-emerald-800">
                            Madinah ({pkg.madinahNights}):
                          </strong>{" "}
                          {pkg.madinahHotelName} {pkg.madinahDistanceLabel}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Col 2: Retail vs Supplier Net & Commission */}
                  <div className="lg:col-span-4 rounded-xl border border-gold/40 bg-gold/5 p-3 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <Coins className="size-3.5 text-gold" />
                        <span>Retail vs Supplier Net (PKR)</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-emerald-800">
                        Margin: +PKR {pkg.commissionPkr.toLocaleString()}/pax
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[11px]">
                      <div className="rounded bg-white p-1.5 border border-border">
                        <span className="block text-[9px] text-muted-foreground">
                          SHARING
                        </span>
                        <strong className="text-primary">
                          {pkg.retailSharingPkr.toLocaleString()}
                        </strong>
                        <span className="block text-[9px] text-muted-foreground">
                          Net: {pkg.netSharingPkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded bg-white p-1.5 border border-border">
                        <span className="block text-[9px] text-muted-foreground">
                          QUAD
                        </span>
                        <strong>{pkg.retailQuadPkr.toLocaleString()}</strong>
                        <span className="block text-[9px] text-muted-foreground">
                          Net: {pkg.netQuadPkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded bg-white p-1.5 border border-border">
                        <span className="block text-[9px] text-muted-foreground">
                          TRIPLE
                        </span>
                        <strong>{pkg.retailTriplePkr.toLocaleString()}</strong>
                        <span className="block text-[9px] text-muted-foreground">
                          Net: {pkg.netTriplePkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded bg-white p-1.5 border border-border">
                        <span className="block text-[9px] text-muted-foreground">
                          DOUBLE
                        </span>
                        <strong>{pkg.retailDoublePkr.toLocaleString()}</strong>
                        <span className="block text-[9px] text-muted-foreground">
                          Net: {pkg.netDoublePkr.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Col 3: Distribution History */}
                  <div className="lg:col-span-3 rounded-xl border border-border bg-secondary/20 p-3 text-xs">
                    <div className="font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                      <Share2 className="size-3.5 text-primary" />
                      <span>
                        Shared Across ({pkgDistributions.length} Channels)
                      </span>
                    </div>
                    {pkgDistributions.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Not yet logged in Daily Distribution Matrix.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {pkgDistributions.map((d) => (
                          <span
                            key={d.id}
                            className="inline-flex items-center gap-1 rounded bg-white border border-border px-2 py-0.5 text-[10px] font-medium"
                          >
                            <span className="font-semibold text-primary">
                              {d.channel.name}
                            </span>
                            <span className="text-muted-foreground">
                              ({d.scheduledDate})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expandable 1-Click Convert to Customer Application Drawer */}
                {convertingPkgId === pkg.id && (
                  <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 space-y-3">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">
                      Convert Inquiry on [{pkg.postCode}] into Official Customer Application &amp; Quote
                    </CardTitle>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 items-end">
                      <div className="sm:col-span-2">
                        <Label className="text-[11px]">Customer Full Name *</Label>
                        <Input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g. Brig. Tariq Mahmood"
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">WhatsApp / Phone *</Label>
                        <Input
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="0300 4123456"
                          className="h-8 text-xs bg-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Room Tier</Label>
                        <select
                          value={roomType}
                          onChange={(e) =>
                            setRoomType(
                              e.target.value as
                                | "sharing"
                                | "quad"
                                | "triple"
                                | "double"
                            )
                          }
                          className="mt-1 flex h-8 w-full rounded-md border border-input bg-white px-2 text-xs"
                        >
                          <option value="sharing">
                            Sharing (PKR {pkg.retailSharingPkr.toLocaleString()})
                          </option>
                          <option value="quad">
                            Quad (PKR {pkg.retailQuadPkr.toLocaleString()})
                          </option>
                          <option value="triple">
                            Triple (PKR {pkg.retailTriplePkr.toLocaleString()})
                          </option>
                          <option value="double">
                            Double (PKR {pkg.retailDoublePkr.toLocaleString()})
                          </option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-[11px]">Passengers &amp; Source</Label>
                        <div className="flex gap-1.5 mt-1">
                          <Input
                            type="number"
                            min={1}
                            value={adults}
                            onChange={(e) =>
                              setAdults(Math.max(1, Number(e.target.value) || 1))
                            }
                            className="h-8 w-16 text-xs bg-white font-mono"
                          />
                          <select
                            value={sourceChannelId}
                            onChange={(e) => setSourceChannelId(e.target.value)}
                            className="flex h-8 w-full rounded-md border border-input bg-white px-2 text-[11px]"
                          >
                            <option value="">Any Channel</option>
                            {channels.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.areaTag})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === pkg.id}
                          onClick={() => handleConvert(pkg.id)}
                          className="h-8 w-full bg-[#0A3622] text-white text-xs font-bold cursor-pointer"
                        >
                          {busyId === pkg.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <span>Create Quote →</span>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
