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
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const customerCity = "Lahore"
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
      <Card className="border-gold-border bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-12">
            <div className="md:col-span-8">
              <Label className="text-xs font-bold text-primary">
                Instant Reverse Lookup (Ref Code, Price, Hotel, Date, Flight, or
                Group Name)
              </Label>
              <div className="relative mt-1.5">
                <Search
                  className="absolute top-2.5 left-3 size-4 text-gold-text"
                  aria-hidden="true"
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Try: ART-AM-21D, 269,899, Dar Al Khalil, Swissotel, 10 NOV, Askari 10, Saudia…"
                  className="pl-9 font-mono text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <Label className="text-xs font-semibold">
                Filter by B2B Supplier
              </Label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="all">
                  All Suppliers ({packages.length} Packages)
                </option>
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
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-status-success-border bg-status-success-bg p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5 text-xs text-status-success">
            <CheckCircle2
              className="size-5 shrink-0 text-status-success"
              aria-hidden="true"
            />
            <div>
              <strong>
                Customer Application &amp; Official Quote Created!
              </strong>{" "}
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
            className="cursor-pointer gap-1.5 bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span>Open Quote &amp; Generate 3-Page PDF</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
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
              className="border-border bg-card shadow-xs transition-colors hover:border-gold-border motion-reduce:transition-none"
            >
              <CardHeader className="border-b border-border bg-secondary/25 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-primary px-2.5 py-1 font-mono text-xs font-black text-gold">
                      {pkg.postCode}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-gold-border bg-accent/40 text-xs font-bold text-foreground"
                    >
                      Supplier: {pkg.supplier.name}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="font-mono text-xs font-semibold"
                    >
                      {pkg.flyer.airlineName} · {pkg.flyer.daysTitle} (
                      {pkg.outboundDateLabel} to {pkg.returnDateLabel})
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={pkg.flyer.rawFlyerImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <ImageIcon
                        className="size-3 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>Original Supplier Flyer</span>
                    </a>

                    {pkg.spotlightPosterUrl ? (
                      <a
                        href={pkg.spotlightPosterUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-gold hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <Sparkles className="size-3" aria-hidden="true" />
                        <span>Our 4K Spotlight Poster</span>
                        <ExternalLink className="size-2.5" aria-hidden="true" />
                      </a>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === `spot-${pkg.id}`}
                        onClick={() => handleQuickSpotlight(pkg.id)}
                        className="h-7 cursor-pointer gap-1 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {busyId === `spot-${pkg.id}` ? (
                          <Loader2
                            className="size-3 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : (
                          <Sparkles
                            className="size-3 text-gold-text"
                            aria-hidden="true"
                          />
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
                      className="h-7 cursor-pointer gap-1 bg-primary text-[11px] font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <UserPlus
                        className="size-3 text-gold"
                        aria-hidden="true"
                      />
                      <span>Convert to Customer Quote</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  {/* Col 1: Flights & Hotels */}
                  <div className="space-y-2 text-xs lg:col-span-5">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Plane
                        className="size-3.5 text-primary"
                        aria-hidden="true"
                      />
                      <span>
                        Outbound: {pkg.outboundFlightNo} (
                        {pkg.outboundDateLabel} · {pkg.outboundDepTime}-
                        {pkg.outboundArrTime}) | Return: {pkg.returnFlightNo} (
                        {pkg.returnDateLabel})
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Building2
                        className="mt-0.5 size-3.5 shrink-0 text-gold-text"
                        aria-hidden="true"
                      />
                      <div>
                        <div>
                          <strong className="text-primary">
                            Makkah ({pkg.makkahNights}):
                          </strong>{" "}
                          {pkg.makkahHotelName} {pkg.makkahDistanceLabel}
                        </div>
                        <div>
                          <strong className="text-status-success">
                            Madinah ({pkg.madinahNights}):
                          </strong>{" "}
                          {pkg.madinahHotelName} {pkg.madinahDistanceLabel}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Col 2: Retail vs Supplier Net & Commission */}
                  <div className="rounded-xl bg-accent/25 p-3 text-xs lg:col-span-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-bold text-foreground">
                        <Coins
                          className="size-3.5 text-gold-text"
                          aria-hidden="true"
                        />
                        <span>Retail vs Supplier Net (PKR)</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-status-success tabular-nums">
                        Margin: +PKR {pkg.commissionPkr.toLocaleString()}/pax
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[11px] tabular-nums">
                      <div className="rounded bg-card p-1.5">
                        <span className="block font-sans text-[10px] text-muted-foreground">
                          Sharing
                        </span>
                        <strong className="text-primary">
                          {pkg.retailSharingPkr.toLocaleString()}
                        </strong>
                        <span className="block text-[10px] text-muted-foreground">
                          Net: {pkg.netSharingPkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded bg-card p-1.5">
                        <span className="block font-sans text-[10px] text-muted-foreground">
                          Quad
                        </span>
                        <strong>{pkg.retailQuadPkr.toLocaleString()}</strong>
                        <span className="block text-[10px] text-muted-foreground">
                          Net: {pkg.netQuadPkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded bg-card p-1.5">
                        <span className="block font-sans text-[10px] text-muted-foreground">
                          Triple
                        </span>
                        <strong>{pkg.retailTriplePkr.toLocaleString()}</strong>
                        <span className="block text-[10px] text-muted-foreground">
                          Net: {pkg.netTriplePkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded bg-card p-1.5">
                        <span className="block font-sans text-[10px] text-muted-foreground">
                          Double
                        </span>
                        <strong>{pkg.retailDoublePkr.toLocaleString()}</strong>
                        <span className="block text-[10px] text-muted-foreground">
                          Net: {pkg.netDoublePkr.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Col 3: Distribution History */}
                  <div className="rounded-xl bg-secondary/50 p-3 text-xs lg:col-span-3">
                    <div className="mb-1.5 flex items-center gap-1.5 font-bold text-foreground">
                      <Share2
                        className="size-3.5 text-primary"
                        aria-hidden="true"
                      />
                      <span>
                        Shared Across ({pkgDistributions.length} Channels)
                      </span>
                    </div>
                    {pkgDistributions.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Not yet logged in Daily Distribution Matrix.
                      </p>
                    ) : (
                      <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                        {pkgDistributions.map((d) => (
                          <span
                            key={d.id}
                            className="inline-flex items-center gap-1 rounded bg-card px-2 py-0.5 text-[11px] font-medium"
                          >
                            <span className="font-semibold text-primary">
                              {d.channel.name}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
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
                  <div className="space-y-3 rounded-xl border-t-2 border-primary bg-primary/5 p-4">
                    <CardTitle className="text-xs font-bold text-primary">
                      Convert Inquiry on [{pkg.postCode}] into Official Customer
                      Application &amp; Quote
                    </CardTitle>
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-6">
                      <div className="sm:col-span-2">
                        <Label className="text-[11px]">
                          Customer Full Name *
                        </Label>
                        <Input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g. Brig. Tariq Mahmood"
                          className="mt-1 h-8 bg-background text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">
                          WhatsApp / Phone *
                        </Label>
                        <Input
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="0300 4123456"
                          className="mt-1 h-8 bg-background text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Room Tier</Label>
                        <select
                          value={roomType}
                          onChange={(e) =>
                            setRoomType(
                              e.target.value as
                                "sharing" | "quad" | "triple" | "double"
                            )
                          }
                          className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <option value="sharing">
                            Sharing (PKR {pkg.retailSharingPkr.toLocaleString()}
                            )
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
                        <Label className="text-[11px]">
                          Passengers &amp; Source
                        </Label>
                        <div className="mt-1 flex gap-1.5">
                          <Input
                            type="number"
                            min={1}
                            value={adults}
                            onChange={(e) =>
                              setAdults(
                                Math.max(1, Number(e.target.value) || 1)
                              )
                            }
                            className="h-8 w-16 bg-background font-mono text-xs"
                          />
                          <select
                            value={sourceChannelId}
                            onChange={(e) => setSourceChannelId(e.target.value)}
                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                          className="h-8 w-full cursor-pointer gap-1.5 bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {busyId === pkg.id ? (
                            <Loader2
                              className="size-3.5 animate-spin motion-reduce:animate-none"
                              aria-hidden="true"
                            />
                          ) : (
                            <>
                              <span>Create Quote</span>
                              <ArrowRight
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            </>
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
