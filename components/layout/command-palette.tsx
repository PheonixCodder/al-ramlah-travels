"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Command } from "cmdk"
import {
  Search,
  Sparkles,
  Plane,
  Building2,
  ArrowRight,
  Copy,
  Check,
  X,
  Loader2,
  UserPlus,
  ExternalLink,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  convertCommandLookupToApplicationAction,
  searchPostPackagesCommandAction,
  type CommandLookupItem,
} from "@/app/actions/command-lookup"
import { cn } from "@/lib/utils"

export interface CommandPaletteProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function LookupSearchParamBridge({
  onTriggerLookup,
}: {
  onTriggerLookup: (lookupQuery: string) => void
}) {
  const searchParams = useSearchParams()
  const lastHandledRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const lookupVal =
      searchParams.get("lookup")?.trim() ||
      searchParams.get("openLookup")?.trim() ||
      ""
    if (lookupVal && lastHandledRef.current !== lookupVal) {
      lastHandledRef.current = lookupVal
      onTriggerLookup(lookupVal)
    }
  }, [searchParams, onTriggerLookup])

  return null
}

function firstAvailableTier(
  item: CommandLookupItem
): "sharing" | "quad" | "triple" | "double" {
  if (item.retailSharingPkr > 0) return "sharing"
  if (item.retailQuadPkr > 0) return "quad"
  if (item.retailTriplePkr > 0) return "triple"
  return "double"
}

function tierPriceForItem(
  item: CommandLookupItem,
  tier: "sharing" | "quad" | "triple" | "double"
): number {
  switch (tier) {
    case "sharing":
      return item.retailSharingPkr
    case "quad":
      return item.retailQuadPkr
    case "triple":
      return item.retailTriplePkr
    case "double":
      return item.retailDoublePkr
  }
}

export function CommandPalette({
  open: controlledOpen,
  onOpenChange,
}: CommandPaletteProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen

  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<CommandLookupItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [selectedItem, setSelectedItem] =
    React.useState<CommandLookupItem | null>(null)
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)

  // Quick 1-Click Conversion Form State
  const [showConvertForm, setShowConvertForm] = React.useState(false)
  const [customerName, setCustomerName] = React.useState("")
  const [customerPhone, setCustomerPhone] = React.useState("")
  const [customerCity, setCustomerCity] = React.useState("Lahore")
  const [roomType, setRoomType] = React.useState<
    "sharing" | "quad" | "triple" | "double"
  >("sharing")
  const [adults, setAdults] = React.useState(2)
  const [childrenCount, setChildrenCount] = React.useState(0)
  const [infantsCount, setInfantsCount] = React.useState(0)
  const [isConverting, setIsConverting] = React.useState(false)
  const [convertError, setConvertError] = React.useState<string | null>(null)

  const resetFormState = React.useCallback(() => {
    setShowConvertForm(false)
    setCustomerName("")
    setCustomerPhone("")
    setCustomerCity("Lahore")
    setAdults(2)
    setChildrenCount(0)
    setInfantsCount(0)
    setConvertError(null)
  }, [])

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (onOpenChange) onOpenChange(next)
      else setInternalOpen(next)
      if (!next) {
        resetFormState()
      }
    },
    [onOpenChange, resetFormState]
  )

  const handleUrlLookup = React.useCallback(
    (lookupVal: string) => {
      if (lookupVal !== "1" && lookupVal !== "true") {
        setQuery(lookupVal)
      }
      setOpen(true)
    },
    [setOpen]
  )

  // Global Cmd+K / Ctrl+K listener + custom event `open-command-palette`
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!isOpen)
      } else if (e.key === "Escape" && isOpen) {
        setOpen(false)
      }
    }

    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ query?: string }>
      if (customEvent.detail?.query) {
        setQuery(customEvent.detail.query)
      }
      setOpen(true)
    }

    document.addEventListener("keydown", down)
    window.addEventListener("open-command-palette", handleCustomOpen)
    return () => {
      document.removeEventListener("keydown", down)
      window.removeEventListener("open-command-palette", handleCustomOpen)
    }
  }, [isOpen, setOpen])

  // Debounced search against PostgreSQL
  React.useEffect(() => {
    if (!isOpen) return

    let active = true
    setIsLoading(true)

    const timer = setTimeout(async () => {
      try {
        const items = await searchPostPackagesCommandAction(query)
        if (active) {
          setResults(items)
          setSelectedItem((prev) => {
            const nextSel =
              items.find((it) => it.id === prev?.id) ?? items[0] ?? null
            if (nextSel && nextSel.id !== prev?.id) {
              setRoomType(firstAvailableTier(nextSel))
            }
            return nextSel
          })
        }
      } catch {
        if (active) setResults([])
      } finally {
        if (active) setIsLoading(false)
      }
    }, 180)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, isOpen])

  const handleCopyDetails = (item: CommandLookupItem) => {
    const msg = `*AL RAMLAH TRAVELS — ${item.durationDays} DAYS UMRAH*\n📌 *Ref:* ${item.postCode}\n✈️ *Airline:* ${item.airlineName} (${item.outboundRoute})\n🗓 *Dates:* ${item.outboundDateLabel} — ${item.returnDateLabel}\n🕋 *Makkah (${item.makkahNights}):* ${item.makkahHotelName} (${item.makkahDistanceLabel})\n🕌 *Madinah (${item.madinahNights}):* ${item.madinahHotelName} (${item.madinahDistanceLabel})\n\n💰 *Sharing:* PKR ${item.retailSharingPkr.toLocaleString()}\n💰 *Quad:* PKR ${item.retailQuadPkr.toLocaleString()}\n💰 *Triple:* PKR ${item.retailTriplePkr.toLocaleString()}\n💰 *Double:* PKR ${item.retailDoublePkr.toLocaleString()}\n\n📞 Call / WhatsApp: 03274029701`
    navigator.clipboard.writeText(msg)
    setCopiedCode(item.postCode)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleOneClickConvert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || !customerName.trim() || !customerPhone.trim()) return

    setIsConverting(true)
    setConvertError(null)

    try {
      const res = await convertCommandLookupToApplicationAction({
        packageItemId: selectedItem.id,
        sourceKind: selectedItem.sourceKind ?? "supplier_flyer",
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerCity: customerCity.trim() || "Lahore",
        selectedRoomType: roomType,
        adults: Math.max(1, Math.floor(adults)),
        children: Math.max(0, Math.floor(childrenCount)),
        infants: Math.max(0, Math.floor(infantsCount)),
      })

      if (res.success && res.applicationId) {
        resetFormState()
        setOpen(false)
        router.push(`/admin/applications/${res.applicationId}`)
      } else {
        setConvertError(res.error || "Failed to convert package to quotation")
      }
    } catch (err) {
      setConvertError(
        err instanceof Error ? err.message : "Conversion failed"
      )
    } finally {
      setIsConverting(false)
    }
  }

  const bedAndSeatCount = Math.max(1, adults) + Math.max(0, childrenCount)
  const totalPassportCount = bedAndSeatCount + Math.max(0, infantsCount)
  const selectedTierRate = selectedItem
    ? tierPriceForItem(selectedItem, roomType)
    : 0
  const estimatedInfantRate = selectedItem?.infantPricePkr ?? 65000
  const estimatedGrandTotalPkr =
    bedAndSeatCount * Math.max(0, selectedTierRate) +
    Math.max(0, infantsCount) * estimatedInfantRate

  return (
    <>
      <React.Suspense fallback={null}>
        <LookupSearchParamBridge onTriggerLookup={handleUrlLookup} />
      </React.Suspense>

      {!isOpen ? null : (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-3 pt-[8vh] backdrop-blur-xs sm:p-6 sm:pt-[10vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gold/40 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              shouldFilter={false}
              className="flex h-full max-h-[78vh] flex-col bg-card text-foreground"
            >
              {/* Search Input Header */}
              <div className="flex items-center gap-3 border-b border-border bg-secondary/35 px-4 py-3">
                <Search className="size-4 shrink-0 text-primary" />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={(val) => {
                    setQuery(val)
                    setShowConvertForm(false)
                    setConvertError(null)
                  }}
                  placeholder="Instant Reverse-Lookup: Type Post Ref (ART-UPSKY-15D-04), hotel name, airline, date, or PKR price..."
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {isLoading && (
                  <Loader2 className="size-4 animate-spin text-gold" />
                )}
                <kbd className="hidden rounded border border-border bg-card px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground sm:inline-block">
                  ESC
                </kbd>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Reverse-Lookup Modal"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Split Master-Detail Results */}
              <div className="grid min-h-[380px] flex-1 grid-cols-1 divide-y divide-border overflow-hidden md:grid-cols-12 md:divide-x md:divide-y-0">
                {/* Left List (5 cols) */}
                <Command.List className="max-h-[340px] overflow-y-auto p-2 md:col-span-5 md:max-h-[62vh]">
                  <Command.Empty className="py-12 text-center text-xs text-muted-foreground">
                    {isLoading
                      ? "Searching supplier flyers & published group packages..."
                      : "No matching active post codes or packages found."}
                  </Command.Empty>

                  {results.map((item) => {
                    const isSelected = selectedItem?.id === item.id
                    return (
                      <Command.Item
                        key={item.id}
                        value={item.postCode}
                        onSelect={() => {
                          setSelectedItem(item)
                          setRoomType(firstAvailableTier(item))
                          setShowConvertForm(false)
                          setConvertError(null)
                        }}
                        className={cn(
                          "mb-1 flex cursor-pointer flex-col gap-1 rounded-xl border p-2.5 text-left transition-all",
                          isSelected
                            ? "border-gold/60 bg-primary/8 shadow-2xs"
                            : "border-transparent hover:bg-secondary/60"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {item.postCode}
                          </span>
                          <span className="font-mono text-xs font-bold text-foreground">
                            PKR{" "}
                            {(
                              item.retailSharingPkr ||
                              item.retailQuadPkr ||
                              item.retailTriplePkr ||
                              item.retailDoublePkr
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="truncate text-xs font-medium text-foreground">
                          {item.makkahHotelName} • {item.madinahHotelName}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            {item.airlineName} ({item.durationDays}D)
                          </span>
                          <span>{item.outboundDateLabel}</span>
                        </div>
                      </Command.Item>
                    )
                  })}
                </Command.List>

                {/* Right Detail & 1-Click Quote Conversion (7 cols) */}
                <div className="flex flex-col justify-between overflow-y-auto bg-background/50 p-4 md:col-span-7 md:max-h-[62vh]">
                  {selectedItem ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-primary text-primary-foreground font-mono text-xs">
                                {selectedItem.postCode}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-gold/40 bg-gold/10 text-[11px] font-semibold text-foreground"
                              >
                                Supplier: {selectedItem.supplierName}
                              </Badge>
                            </div>
                            <h4 className="mt-1.5 font-display text-base font-bold text-foreground">
                              {selectedItem.flyerTitle}
                            </h4>
                          </div>

                          {selectedItem.spotlightPosterUrl && (
                            <a
                              href={selectedItem.spotlightPosterUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-primary hover:border-gold"
                            >
                              <span>View Poster</span>
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>

                        {/* Flights & Hotels Grid */}
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <div className="rounded-xl border border-border bg-card p-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                              <Plane className="size-3.5 text-primary" />
                              <span>Flight Schedule</span>
                            </div>
                            <p className="mt-1 text-xs font-bold text-foreground">
                              {selectedItem.airlineName} (
                              {selectedItem.outboundRoute})
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Out: {selectedItem.outboundFlightNo} •{" "}
                              {selectedItem.outboundDateLabel}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Ret: {selectedItem.returnFlightNo} •{" "}
                              {selectedItem.returnDateLabel}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border bg-card p-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                              <Building2 className="size-3.5 text-gold" />
                              <span>Haramain Hotels</span>
                            </div>
                            <p className="mt-1 truncate text-xs font-bold text-foreground">
                              Makkah ({selectedItem.makkahNights}):{" "}
                              {selectedItem.makkahHotelName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {selectedItem.makkahDistanceLabel}
                            </p>
                            <p className="mt-1 truncate text-xs font-bold text-foreground">
                              Madinah ({selectedItem.madinahNights}):{" "}
                              {selectedItem.madinahHotelName}
                            </p>
                          </div>
                        </div>

                        {/* Retail Pricing Matrix */}
                        <div className="grid grid-cols-4 gap-2">
                          {(
                            [
                              {
                                key: "sharing",
                                label: "Sharing",
                                val: selectedItem.retailSharingPkr,
                              },
                              {
                                key: "quad",
                                label: "Quad",
                                val: selectedItem.retailQuadPkr,
                              },
                              {
                                key: "triple",
                                label: "Triple",
                                val: selectedItem.retailTriplePkr,
                              },
                              {
                                key: "double",
                                label: "Double",
                                val: selectedItem.retailDoublePkr,
                              },
                            ] as const
                          ).map((tier) => {
                            const isUnpriced = !tier.val || tier.val <= 0
                            return (
                              <button
                                key={tier.key}
                                type="button"
                                disabled={isUnpriced}
                                onClick={() => setRoomType(tier.key)}
                                className={cn(
                                  "rounded-xl border p-2 text-center transition-all",
                                  isUnpriced
                                    ? "cursor-not-allowed border-border/50 bg-muted/40 opacity-50"
                                    : roomType === tier.key
                                      ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                                      : "border-border bg-card hover:border-gold/50"
                                )}
                              >
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  {tier.label}
                                </div>
                                <div className="mt-0.5 font-mono text-xs font-bold text-foreground">
                                  {isUnpriced
                                    ? "N/A"
                                    : tier.val.toLocaleString()}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {/* Internal Supplier Net & Margin Strip (super_admin only; zeroed for staff) */}
                        {(selectedItem.netSharingPkr > 0 ||
                          selectedItem.commissionPkr > 0) && (
                          <div className="flex items-center justify-between rounded-lg border border-dashed border-gold/40 bg-gold/8 px-3 py-1.5 text-[11px]">
                            <span className="text-muted-foreground">
                              Wholesale Net (Sharing):{" "}
                              <strong className="font-mono text-foreground">
                                PKR{" "}
                                {selectedItem.netSharingPkr.toLocaleString()}
                              </strong>
                            </span>
                            <span className="text-emerald-800 font-semibold">
                              Margin: PKR{" "}
                              {selectedItem.commissionPkr.toLocaleString()}/pax
                            </span>
                          </div>
                        )}

                        {/* Optional Inline 1-Click Quote Conversion Form */}
                        {showConvertForm && (
                          <form
                            onSubmit={handleOneClickConvert}
                            className="space-y-2.5 rounded-xl border border-primary/30 bg-card p-3 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                                <Sparkles className="size-3.5 text-gold" />
                                <span>
                                  1-Click Convert to Official Quotation (
                                  {roomType.toUpperCase()})
                                </span>
                              </div>
                              <span className="font-mono text-[11px] font-bold text-foreground">
                                Est: PKR{" "}
                                {estimatedGrandTotalPkr.toLocaleString()}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <Input
                                required
                                placeholder="Pilgrim Full Name *"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="h-8 text-xs"
                              />
                              <Input
                                required
                                placeholder="WhatsApp / Phone *"
                                value={customerPhone}
                                onChange={(e) =>
                                  setCustomerPhone(e.target.value)
                                }
                                className="h-8 text-xs"
                              />
                              <Input
                                placeholder="City (e.g. Lahore)"
                                value={customerCity}
                                onChange={(e) => setCustomerCity(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label
                                  htmlFor="cmd-adults"
                                  className="block text-[10px] font-semibold text-muted-foreground mb-0.5"
                                >
                                  Adults (12+ yrs)
                                </label>
                                <Input
                                  id="cmd-adults"
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={adults}
                                  onChange={(e) =>
                                    setAdults(
                                      Math.max(1, Number(e.target.value) || 1)
                                    )
                                  }
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="cmd-children"
                                  className="block text-[10px] font-semibold text-muted-foreground mb-0.5"
                                >
                                  Children (2–11 yrs)
                                </label>
                                <Input
                                  id="cmd-children"
                                  type="number"
                                  min={0}
                                  max={50}
                                  value={childrenCount}
                                  onChange={(e) =>
                                    setChildrenCount(
                                      Math.max(0, Number(e.target.value) || 0)
                                    )
                                  }
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="cmd-infants"
                                  className="block text-[10px] font-semibold text-muted-foreground mb-0.5"
                                >
                                  Infants (&lt;2 yrs)
                                </label>
                                <Input
                                  id="cmd-infants"
                                  type="number"
                                  min={0}
                                  max={20}
                                  value={infantsCount}
                                  onChange={(e) =>
                                    setInfantsCount(
                                      Math.max(0, Number(e.target.value) || 0)
                                    )
                                  }
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>
                                {bedAndSeatCount} Beds/Seats (Adults + Children)
                                • {totalPassportCount} Total Passports
                              </span>
                              {infantsCount > 0 && (
                                <span>
                                  Infant Visa/Ticket: PKR{" "}
                                  {estimatedInfantRate.toLocaleString()}/inf
                                </span>
                              )}
                            </div>

                            {convertError && (
                              <p className="text-[11px] font-medium text-destructive">
                                {convertError}
                              </p>
                            )}

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowConvertForm(false)}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                disabled={
                                  isConverting || selectedTierRate <= 0
                                }
                                className="h-7 gap-1.5 text-xs"
                              >
                                {isConverting ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <ArrowRight className="size-3.5" />
                                )}
                                <span>Create Dossier &amp; Open Quote</span>
                              </Button>
                            </div>
                          </form>
                        )}
                      </div>

                      {/* Footer Action Bar */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyDetails(selectedItem)}
                          className="gap-1.5 text-xs"
                        >
                          {copiedCode === selectedItem.postCode ? (
                            <>
                              <Check className="size-3.5 text-emerald-600" />
                              <span>Copied WhatsApp Reply!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3.5" />
                              <span>Copy WhatsApp Reply</span>
                            </>
                          )}
                        </Button>

                        {!showConvertForm && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={selectedTierRate <= 0}
                            onClick={() => setShowConvertForm(true)}
                            className="gap-1.5 text-xs"
                          >
                            <UserPlus className="size-3.5" />
                            <span>1-Click Convert to Quote</span>
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      Select a package code from the left list to inspect rates
                      and convert to a pilgrim quotation.
                    </div>
                  )}
                </div>
              </div>
            </Command>
          </div>
        </div>
      )}
    </>
  )
}
