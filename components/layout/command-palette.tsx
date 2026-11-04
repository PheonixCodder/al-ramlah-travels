"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Sparkles,
  Share2,
  Inbox,
  Boxes,
  Settings,
  Building2,
  Plane,
  Calendar,
  MapPin,
  Coins,
  ArrowRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  X,
  ChevronRight,
  UserPlus,
  Compass,
  FileCheck,
  Car,
} from "lucide-react"
import { Command as CommandPrimitive } from "cmdk"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  searchPostPackagesCommandAction,
  type CommandLookupPackageCard,
} from "@/app/actions/command-lookup"
import {
  ADMIN_HUB_SHORTCUTS,
  type CommandHubShortcut,
} from "@/lib/constants/admin-shortcuts"
import { convertPostLookupToApplication } from "@/app/actions/marketing-ops"
import { cn } from "@/lib/utils"

export interface CommandPaletteProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CommandPalette({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: CommandPaletteProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = React.useState(false)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setIsOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (isControlled && setControlledOpen) {
        setControlledOpen(nextOpen)
      } else {
        setInternalOpen(nextOpen)
      }
    },
    [isControlled, setControlledOpen]
  )

  const [query, setQuery] = React.useState("")
  const [packages, setPackages] = React.useState<CommandLookupPackageCard[]>([])
  const [shortcuts, setShortcuts] =
    React.useState<CommandHubShortcut[]>(ADMIN_HUB_SHORTCUTS)
  const [isSearching, setIsSearching] = React.useState(false)

  // 1-Click Quote Conversion Mini-Form State
  const [convertingPkgId, setConvertingPkgId] = React.useState<string | null>(
    null
  )
  const [customerName, setCustomerName] = React.useState("")
  const [customerPhone, setCustomerPhone] = React.useState("")
  const [customerCity, setCustomerCity] = React.useState("Lahore")
  const [roomTier, setRoomTier] = React.useState<
    "sharing" | "quad" | "triple" | "double"
  >("sharing")
  const [adults, setAdults] = React.useState(2)
  const [childrenCount, setChildrenCount] = React.useState(0)
  const [infantsCount, setInfantsCount] = React.useState(0)
  const [isConverting, setIsConverting] = React.useState(false)
  const [convertError, setConvertError] = React.useState<string | null>(null)

  // Listen to Cmd+K / Ctrl+K and custom window event
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
    }

    const handleCustomTrigger = () => {
      setIsOpen(true)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("open-post-lookup", handleCustomTrigger)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("open-post-lookup", handleCustomTrigger)
    }
  }, [isOpen, setIsOpen])

  // Debounced search query
  React.useEffect(() => {
    if (!isOpen) {
      setConvertingPkgId(null)
      setConvertError(null)
      return
    }

    let isMounted = true
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await searchPostPackagesCommandAction(query)
        if (isMounted && res.success) {
          setPackages(res.packages)
          setShortcuts(res.shortcuts)
        }
      } catch (err) {
        console.error("Command palette search failed:", err)
      } finally {
        if (isMounted) setIsSearching(false)
      }
    }, 150)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [query, isOpen])

  const handleNavigate = (href: string) => {
    setIsOpen(false)
    router.push(href)
  }

  const handleOpenQuoteForm = (pkg: CommandLookupPackageCard) => {
    setConvertingPkgId(pkg.id)
    setConvertError(null)
    setRoomTier("sharing")
    setAdults(2)
    setChildrenCount(0)
    setInfantsCount(0)
  }

  const handleCloseQuoteForm = () => {
    setConvertingPkgId(null)
    setConvertError(null)
  }

  const handleExecuteConversion = async (pkg: CommandLookupPackageCard) => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setConvertError("Pilgrim Name and Phone Number are required.")
      return
    }

    setIsConverting(true)
    setConvertError(null)

    try {
      const res = await convertPostLookupToApplication({
        packageItemId: pkg.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerCity: customerCity.trim() || "Lahore",
        selectedRoomType: roomTier,
        adults: Math.max(1, adults),
      })

      if (res.success && res.applicationId) {
        setIsOpen(false)
        setConvertingPkgId(null)
        router.push(`/admin/applications/${res.applicationId}`)
      } else {
        setConvertError(res.error || "Failed to create official quote.")
      }
    } catch (err: unknown) {
      setConvertError(
        err instanceof Error ? err.message : "Quote conversion error"
      )
    } finally {
      setIsConverting(false)
    }
  }

  const renderShortcutIcon = (icon: CommandHubShortcut["icon"]) => {
    switch (icon) {
      case "Sparkles":
        return <Sparkles className="size-4 text-amber-500" />
      case "Share2":
        return <Share2 className="size-4 text-emerald-600" />
      case "Inbox":
        return <Inbox className="size-4 text-teal-600" />
      case "Boxes":
        return <Boxes className="size-4 text-gold" />
      case "Settings":
        return <Settings className="size-4 text-slate-500" />
      default:
        return <Boxes className="size-4 text-gold" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-[95vw] sm:max-w-3xl! max-h-[85vh] overflow-hidden rounded-2xl! border border-gold/40 bg-card p-0 shadow-2xl ring-1 ring-gold/20 duration-150">
        <DialogHeader className="sr-only">
          <DialogTitle>Admin Global Command Palette</DialogTitle>
          <DialogDescription>
            Search packages by Post Ref Code, PKR prices, hotels, flights, or navigate to administrative hubs.
          </DialogDescription>
        </DialogHeader>

        <CommandPrimitive
          shouldFilter={false}
          className="flex h-full w-full flex-col overflow-hidden bg-card"
        >
          {/* Header Search Input */}
          <div className="relative flex items-center border-b border-border/80 px-4 py-3 bg-muted/20">
            <Search className="size-5 shrink-0 text-gold" />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search Post Ref (e.g. ART-AM-21D-04), price (269,899), hotel, flight, or hub..."
              className="ml-3 flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none border-none focus:ring-0 focus:outline-none"
              autoFocus
            />

            {isSearching ? (
              <Loader2 className="size-4.5 animate-spin text-gold" />
            ) : query.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear query"
              >
                <X className="size-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
                <span>ESC to close</span>
              </div>
            )}
          </div>

          {/* Results / Hubs List */}
          <CommandPrimitive.List className="max-h-[calc(80vh-4rem)] overflow-y-auto overflow-x-hidden p-3 space-y-4 no-scrollbar">
            {/* Quick Hub Navigation Shortcuts */}
            {shortcuts.length > 0 && (
              <CommandPrimitive.Group
                heading="Operational Hubs & Shortcuts"
                className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 pb-2">
                  {shortcuts.map((shortcut) => (
                    <CommandPrimitive.Item
                      key={shortcut.id}
                      value={shortcut.href}
                      onSelect={() => handleNavigate(shortcut.href)}
                      className="group flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-2.5 transition-all hover:border-gold/50 hover:bg-gold/5 cursor-pointer data-[selected=true]:border-gold data-[selected=true]:bg-gold/10"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 border border-border/50">
                          {renderShortcutIcon(shortcut.icon)}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-foreground truncate">
                            {shortcut.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {shortcut.description}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-gold transition-colors ml-2" />
                    </CommandPrimitive.Item>
                  ))}
                </div>
              </CommandPrimitive.Group>
            )}

            {/* Packages Search Results */}
            {packages.length > 0 && (
              <CommandPrimitive.Group
                heading={`Matching Packages & Wholesale Rates (${packages.length})`}
                className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2"
              >
                <div className="space-y-3 pt-1">
                  {packages.map((pkg) => {
                    const isFormOpen = convertingPkgId === pkg.id
                    const rateForTier =
                      roomTier === "sharing"
                        ? pkg.retailSharingPkr
                        : roomTier === "quad"
                          ? pkg.retailQuadPkr
                          : roomTier === "triple"
                            ? pkg.retailTriplePkr
                            : pkg.retailDoublePkr
                    const grandEstPkr = rateForTier * Math.max(1, adults)

                    return (
                      <div
                        key={pkg.id}
                        className={cn(
                          "rounded-xl border transition-all p-3 bg-card shadow-xs",
                          isFormOpen
                            ? "border-gold ring-1 ring-gold/30 bg-gold/5"
                            : "border-border/80 hover:border-gold/50 hover:bg-muted/10"
                        )}
                      >
                        {/* Package Header Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-extrabold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                              {pkg.postCode}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[11px] font-semibold border-gold/40 bg-gold/10 text-gold-foreground"
                            >
                              {pkg.supplier.name}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-medium"
                            >
                              Card #{pkg.cardNumber}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Plane className="size-3.5 text-emerald-600" />
                            <span className="font-semibold text-foreground">
                              {pkg.flyer.airlineName}
                            </span>
                            <span className="font-mono text-[11px]">
                              ({pkg.outboundFlightNo})
                            </span>
                            <span>•</span>
                            <span className="font-mono text-[11px]">
                              {pkg.outboundDateLabel} → {pkg.returnDateLabel}
                            </span>
                          </div>
                        </div>

                        {/* Hotels & Logistics Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-2 text-xs">
                          <div className="flex items-start gap-1.5 text-muted-foreground">
                            <Building2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-foreground">
                                Makkah ({pkg.makkahNights}):{" "}
                              </span>
                              <span>{pkg.makkahHotelName}</span>{" "}
                              <span className="text-[11px] text-muted-foreground">
                                ({pkg.makkahDistanceLabel})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-1.5 text-muted-foreground">
                            <Building2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-foreground">
                                Madinah ({pkg.madinahNights}):{" "}
                              </span>
                              <span>{pkg.madinahHotelName}</span>{" "}
                              <span className="text-[11px] text-muted-foreground">
                                ({pkg.madinahDistanceLabel})
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Retail Rates Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-2 text-center">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">
                              Sharing
                            </span>
                            <span className="font-mono text-xs font-bold text-foreground">
                              PKR {pkg.retailSharingPkr.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">
                              Quad
                            </span>
                            <span className="font-mono text-xs font-bold text-foreground">
                              PKR {pkg.retailQuadPkr.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">
                              Triple
                            </span>
                            <span className="font-mono text-xs font-bold text-foreground">
                              PKR {pkg.retailTriplePkr.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">
                              Double
                            </span>
                            <span className="font-mono text-xs font-bold text-foreground">
                              PKR {pkg.retailDoublePkr.toLocaleString()}
                            </span>
                          </div>
                          <div className="col-span-2 sm:col-span-1 flex flex-col border-t sm:border-t-0 sm:border-l border-border/50 pt-1 sm:pt-0">
                            <span className="text-[10px] font-medium text-emerald-700 uppercase">
                              Net / Margin
                            </span>
                            <span className="font-mono text-[11px] font-semibold text-emerald-800">
                              PKR {pkg.netSharingPkr.toLocaleString()}
                            </span>
                            <span className="text-[9px] font-mono text-gold">
                              +PKR {pkg.commissionPkr.toLocaleString()} comm
                            </span>
                          </div>
                        </div>

                        {/* Card Actions Bar */}
                        <div className="mt-2.5 flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            {pkg.spotlightPosterUrl && (
                              <a
                                href={pkg.spotlightPosterUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-gold transition-colors"
                              >
                                <ExternalLink className="size-3" />
                                <span>Spotlight Poster</span>
                              </a>
                            )}
                            {pkg.flyer.multiSheetImageUrl && (
                              <a
                                href={pkg.flyer.multiSheetImageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-gold transition-colors"
                              >
                                <ExternalLink className="size-3" />
                                <span>Multi-Sheet</span>
                              </a>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant={isFormOpen ? "secondary" : "default"}
                            onClick={() =>
                              isFormOpen
                                ? handleCloseQuoteForm()
                                : handleOpenQuoteForm(pkg)
                            }
                            className="cursor-pointer gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <UserPlus className="size-3.5" />
                            <span>
                              {isFormOpen
                                ? "Cancel Quote"
                                : "Convert to Official Quote"}
                            </span>
                          </Button>
                        </div>

                        {/* Inline 1-Click Quote Conversion Mini-Form */}
                        {isFormOpen && (
                          <div className="mt-3 rounded-xl border border-gold/40 bg-background p-3.5 shadow-sm space-y-3 animate-in fade-in-50 duration-150">
                            <div className="flex items-center justify-between border-b border-border pb-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="size-4 text-gold" />
                                <span className="text-xs font-bold text-foreground">
                                  1-Click Quote Generation — {pkg.postCode}
                                </span>
                              </div>
                              <span className="font-mono text-xs font-bold text-primary">
                                Est. PKR {grandEstPkr.toLocaleString()}
                              </span>
                            </div>

                            {convertError && (
                              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2 text-xs font-medium text-destructive">
                                {convertError}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <Label className="text-[11px] font-semibold text-muted-foreground">
                                  Pilgrim Full Name *
                                </Label>
                                <Input
                                  value={customerName}
                                  onChange={(e) =>
                                    setCustomerName(e.target.value)
                                  }
                                  placeholder="e.g. Tariq Mehmood"
                                  className="h-8 text-xs mt-1"
                                  autoFocus
                                />
                              </div>

                              <div>
                                <Label className="text-[11px] font-semibold text-muted-foreground">
                                  WhatsApp / Phone *
                                </Label>
                                <Input
                                  value={customerPhone}
                                  onChange={(e) =>
                                    setCustomerPhone(e.target.value)
                                  }
                                  placeholder="e.g. 03214567890"
                                  className="h-8 text-xs mt-1"
                                />
                              </div>

                              <div>
                                <Label className="text-[11px] font-semibold text-muted-foreground">
                                  Departure City
                                </Label>
                                <Input
                                  value={customerCity}
                                  onChange={(e) =>
                                    setCustomerCity(e.target.value)
                                  }
                                  placeholder="Lahore"
                                  className="h-8 text-xs mt-1"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                              <div>
                                <Label className="text-[11px] font-semibold text-muted-foreground">
                                  Room Tier
                                </Label>
                                <div className="grid grid-cols-4 gap-1 mt-1">
                                  {(
                                    [
                                      "sharing",
                                      "quad",
                                      "triple",
                                      "double",
                                    ] as const
                                  ).map((tier) => (
                                    <button
                                      key={tier}
                                      type="button"
                                      onClick={() => setRoomTier(tier)}
                                      className={cn(
                                        "h-8 rounded text-[11px] font-bold uppercase transition-colors border cursor-pointer",
                                        roomTier === tier
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                                      )}
                                    >
                                      {tier.slice(0, 4)}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <Label className="text-[11px] font-semibold text-muted-foreground">
                                  Adults (12+ yrs)
                                </Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={adults}
                                  onChange={(e) =>
                                    setAdults(
                                      Math.max(1, parseInt(e.target.value) || 1)
                                    )
                                  }
                                  className="h-8 text-xs mt-1 font-mono"
                                />
                              </div>

                              <div>
                                <Label className="text-[11px] font-semibold text-muted-foreground">
                                  Children (2-11)
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={15}
                                  value={childrenCount}
                                  onChange={(e) =>
                                    setChildrenCount(
                                      Math.max(0, parseInt(e.target.value) || 0)
                                    )
                                  }
                                  className="h-8 text-xs mt-1 font-mono"
                                />
                              </div>

                              <div>
                                <Label className="text-[11px] font-semibold text-muted-foreground">
                                  Infants (&lt;2 yrs)
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={infantsCount}
                                  onChange={(e) =>
                                    setInfantsCount(
                                      Math.max(0, parseInt(e.target.value) || 0)
                                    )
                                  }
                                  className="h-8 text-xs mt-1 font-mono"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCloseQuoteForm}
                                disabled={isConverting}
                                className="cursor-pointer text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleExecuteConversion(pkg)}
                                disabled={isConverting}
                                className="cursor-pointer gap-1.5 text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800"
                              >
                                {isConverting ? (
                                  <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Generating Quote...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="size-3.5" />
                                    <span>Create Official Quote & Open</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CommandPrimitive.Group>
            )}

            {/* Empty State */}
            {!isSearching && packages.length === 0 && shortcuts.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">
                  No packages or hubs matched &ldquo;{query}&rdquo;
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try searching by Post Reference (e.g.{" "}
                  <code className="font-mono text-primary font-bold">
                    ART-AM-21D
                  </code>
                  ), PKR price, hotel name, or flight date.
                </p>
              </div>
            )}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  )
}
