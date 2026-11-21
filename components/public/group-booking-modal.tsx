"use client"

import * as React from "react"
import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { submitGroupBookingApplication } from "@/app/actions/applications"
import {
  formatPkr,
  getTodayPktIso,
  toWaMeUrl,
} from "@/components/public/public-utils"
import { readStoredAttribution } from "@/lib/seo/utm"
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageCircle,
  Building2,
  Search,
} from "lucide-react"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"

export interface BookingModalHotelOption {
  pkgCode: string
  label: string
  makkahHotelName: string
  makkahDistance: string
  madinahHotelName: string
  madinahDistance: string
  sharingPricePkr: number
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
}

export interface BookingModalPackage {
  id: string
  title: string
  durationDays: number
  sharingPricePkr?: number
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
  infantPricePkr?: number
  giftedInclusions?: string[]
  multiHotelOptions?: BookingModalHotelOption[]
  departures: {
    id: string
    batchCode: string
    departureDate: string
    returnDate: string
    totalSeats: number
    bookedSeats: number
    status: string
    departureCity?: { cityName: string; airportCode: string } | null
    sharingPriceOverridePkr?: number | null
    quadPriceOverridePkr?: number | null
    triplePriceOverridePkr?: number | null
    doublePriceOverridePkr?: number | null
    outboundFlightNumber?: string | null
    returnFlightNumber?: string | null
    flightScheduleSummary?: string | null
    baggageAllowance?: string | null
    routingNote?: string | null
  }[]
}

export type GroupRoomOccupancyTier = "sharing" | "quad" | "triple" | "double"

export interface GroupRoomTierPrices {
  sharing: number
  quad: number
  triple: number
  double: number
}

const GROUP_ROOM_FALLBACK_ORDER: readonly GroupRoomOccupancyTier[] = [
  "quad",
  "triple",
  "double",
  "sharing",
]

/**
 * Selects the preferred group occupancy tier if its PKR tariff is positive (`> 0`);
 * otherwise falls back to the first available tier in `["quad", "triple", "double", "sharing"]`
 * (or `"quad"` if all tiers are `"On Request"`).
 */
export function resolveAvailableGroupRoomType(
  prices: GroupRoomTierPrices,
  preferred?: GroupRoomOccupancyTier
): GroupRoomOccupancyTier {
  if (
    preferred &&
    typeof prices[preferred] === "number" &&
    Number.isFinite(prices[preferred]) &&
    prices[preferred] > 0
  ) {
    return preferred
  }

  const firstPositive = GROUP_ROOM_FALLBACK_ORDER.find(
    (tier) =>
      typeof prices[tier] === "number" &&
      Number.isFinite(prices[tier]) &&
      prices[tier] > 0
  )
  return firstPositive ?? "quad"
}

export interface GroupBookingModalProps {
  pkg: BookingModalPackage
  selectedBatchId?: string
  defaultRoomType?: GroupRoomOccupancyTier
  trigger?: React.ReactNode
  agencyWhatsapp?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

function createSubmissionKey(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function formatTierOrOnRequest(price: number): string {
  return price > 0 ? formatPkr(price) : "On Request"
}

function getLowestPositiveOptionPrice(opt: BookingModalHotelOption): number {
  const positives = [
    opt.sharingPricePkr,
    opt.quadPricePkr,
    opt.triplePricePkr,
    opt.doublePricePkr,
  ].filter((n) => typeof n === "number" && n > 0)
  return positives.length > 0 ? Math.min(...positives) : 0
}

export function GroupBookingModal({
  pkg,
  selectedBatchId,
  defaultRoomType,
  trigger,
  agencyWhatsapp = DEFAULT_COMPANY_INFO.primaryWhatsapp,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: GroupBookingModalProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen)
      }
      controlledOnOpenChange?.(nextOpen)
    },
    [controlledOnOpenChange, isControlled]
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submissionKey, setSubmissionKey] = useState(() =>
    createSubmissionKey("grp")
  )
  const [honeypot, setHoneypot] = useState("")
  const [successResult, setSuccessResult] = useState<{
    referenceNumber: string
    grandTotalPkr: number
    whatsappUrl?: string
  } | null>(null)

  const todayPkt = useMemo(() => getTodayPktIso(), [])
  const availableBatches = useMemo(
    () =>
      pkg.departures.filter(
        (d) =>
          (d.status === "open" || d.status === "filling_fast") &&
          d.departureDate >= todayPkt &&
          d.totalSeats - d.bookedSeats > 0
      ),
    [pkg.departures, todayPkt]
  )

  const [userBatchId, setUserBatchId] = useState<string | null>(null)
  const [selectedHotelOptionCode, setSelectedHotelOptionCode] =
    useState<string>("")
  const [userRoomType, setUserRoomType] =
    useState<GroupRoomOccupancyTier | null>(null)

  // Passengers
  const [adults, setAdults] = useState<number>(2)
  const [children, setChildren] = useState<number>(0)
  const [infants, setInfants] = useState<number>(0)

  // Contact
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerWhatsapp, setCustomerWhatsapp] = useState("")
  const [customerCity, setCustomerCity] = useState("Lahore")
  const [customerEmail, setCustomerEmail] = useState("")
  const [specialRequests, setSpecialRequests] = useState("")

  const activeBatchId =
    userBatchId && availableBatches.some((b) => b.id === userBatchId)
      ? userBatchId
      : selectedBatchId &&
          availableBatches.some((b) => b.id === selectedBatchId)
        ? selectedBatchId
        : (availableBatches[0]?.id ?? "")

  const activeBatch =
    availableBatches.find((d) => d.id === activeBatchId) ?? availableBatches[0]
  const remainingSeats = activeBatch
    ? activeBatch.totalSeats - activeBatch.bookedSeats
    : 0
  const partySeatCount = adults + children
  const totalPassports = adults + children + infants
  const isOverCapacity = partySeatCount > remainingSeats

  const matchedHotelOption = useMemo(
    () =>
      pkg.multiHotelOptions?.find(
        (opt) =>
          opt.pkgCode === selectedHotelOptionCode ||
          opt.label === selectedHotelOptionCode
      ) ?? null,
    [pkg.multiHotelOptions, selectedHotelOptionCode]
  )

  // OD-09b: Preserve 0-value tiers as 0 ("On Request") instead of masking with quadPricePkr
  const sharingTierRate = matchedHotelOption
    ? matchedHotelOption.sharingPricePkr
    : activeBatch?.sharingPriceOverridePkr !== null &&
        activeBatch?.sharingPriceOverridePkr !== undefined
      ? activeBatch.sharingPriceOverridePkr
      : pkg.sharingPricePkr !== undefined
        ? pkg.sharingPricePkr
        : pkg.quadPricePkr

  const quadTierRate = matchedHotelOption
    ? matchedHotelOption.quadPricePkr
    : (activeBatch?.quadPriceOverridePkr ?? pkg.quadPricePkr)

  const tripleTierRate = matchedHotelOption
    ? matchedHotelOption.triplePricePkr
    : (activeBatch?.triplePriceOverridePkr ?? pkg.triplePricePkr)

  const doubleTierRate = matchedHotelOption
    ? matchedHotelOption.doublePricePkr
    : (activeBatch?.doublePriceOverridePkr ?? pkg.doublePricePkr)

  const roomType = resolveAvailableGroupRoomType(
    {
      sharing: sharingTierRate,
      quad: quadTierRate,
      triple: tripleTierRate,
      double: doubleTierRate,
    },
    userRoomType ?? defaultRoomType
  )

  let pricePerPerson = quadTierRate
  if (roomType === "sharing") pricePerPerson = sharingTierRate
  else if (roomType === "quad") pricePerPerson = quadTierRate
  else if (roomType === "triple") pricePerPerson = tripleTierRate
  else pricePerPerson = doubleTierRate

  const infantPrice = pkg.infantPricePkr ?? 65000
  const estimatedTotal =
    Math.max(0, pricePerPerson) * partySeatCount + infants * infantPrice

  function syncPhoneToWhatsapp(val: string) {
    setCustomerPhone(val)
    if (!customerWhatsapp || customerWhatsapp === customerPhone) {
      setCustomerWhatsapp(val)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || isOverCapacity || !activeBatch || pricePerPerson <= 0) return
    setLoading(true)
    setError(null)
    setFieldErrors({})

    try {
      const res = await submitGroupBookingApplication({
        clientSubmissionId: submissionKey,
        honeypot,
        attribution: readStoredAttribution(),
        groupPackageId: pkg.id,
        groupDepartureId: activeBatch.id,
        roomOccupancyTier: roomType,
        selectedHotelOptionCode: selectedHotelOptionCode || undefined,
        passengers: { adults, children, infants },
        contact: {
          customerName,
          customerPhone,
          customerWhatsapp,
          customerCity,
          customerEmail: customerEmail || undefined,
          specialRequests: specialRequests || undefined,
        },
        specialRequests: specialRequests || undefined,
      })

      if (!res.success || !res.referenceNumber) {
        setError(
          res.error ||
            "Unable to reserve group seats. Please verify your details and try again."
        )
        setFieldErrors(res.fieldErrors ?? {})
        return
      }

      setSuccessResult({
        referenceNumber: res.referenceNumber,
        grandTotalPkr:
          res.grandTotalPkr ?? res.estimatedTotalPkr ?? estimatedTotal,
        whatsappUrl: res.whatsappUrl,
      })
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit group booking. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setSuccessResult(null)
    setError(null)
    setFieldErrors({})
    setUserBatchId(null)
    setUserRoomType(null)
    setSelectedHotelOptionCode("")
    setSubmissionKey(createSubmissionKey("grp"))
    setOpen(false)
  }

  function handleTrackStatus() {
    const refCode = successResult?.referenceNumber ?? ""
    setOpen(false)
    const element = document.getElementById("track-status")
    if (element) {
      if (refCode && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("alramlah:prefill-tracker", {
            detail: { referenceNumber: refCode },
          })
        )
      }
      setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth" })
      }, 100)
      return
    }
    const targetUrl = refCode
      ? `/?trackRef=${encodeURIComponent(refCode)}#track-status`
      : "/#track-status"
    if (typeof window !== "undefined") {
      window.location.assign(targetUrl)
    }
  }

  const standardSharingRate =
    activeBatch?.sharingPriceOverridePkr !== null &&
    activeBatch?.sharingPriceOverridePkr !== undefined
      ? activeBatch.sharingPriceOverridePkr
      : pkg.sharingPricePkr !== undefined
        ? pkg.sharingPricePkr
        : pkg.quadPricePkr
  const standardQuadRate = activeBatch?.quadPriceOverridePkr ?? pkg.quadPricePkr
  const standardFallbackPositive = [
    standardSharingRate,
    standardQuadRate,
    activeBatch?.triplePriceOverridePkr ?? pkg.triplePricePkr,
    activeBatch?.doublePriceOverridePkr ?? pkg.doublePricePkr,
  ].filter((n) => typeof n === "number" && n > 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setError(null)
          setFieldErrors({})
          setUserBatchId(null)
          setUserRoomType(null)
          setSelectedHotelOptionCode("")
        }
      }}
    >
      {!hideTrigger && (
        <DialogTrigger
          render={
            trigger ? (
              (trigger as React.ReactElement)
            ) : (
              <Button className="w-full bg-primary text-xs font-semibold whitespace-nowrap text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-50 sm:text-sm">
                Book Package Seats
              </Button>
            )
          }
        />
      )}
      <DialogContent className="max-h-[92vh] overflow-y-auto border border-border bg-card sm:max-w-xl">
        {successResult ? (
          <div className="flex flex-col gap-6 py-6 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
              <CheckCircle2 className="size-8" aria-hidden="true" />
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="font-display text-2xl font-bold text-foreground">
                Group Booking Inquiry Recorded!
              </h3>
              <p className="text-sm text-muted-foreground">
                Your provisional reservation request on{" "}
                <strong>{pkg.title}</strong> is queued for ticketing
                confirmation.
              </p>
            </div>

            <div className="mx-auto flex w-full max-w-sm flex-col gap-2 rounded-xl border border-gold-border bg-accent/45 p-4">
              <span className="text-xs font-semibold text-gold-text">
                Booking Reference Code
              </span>
              <div className="font-mono text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                {successResult.referenceNumber}
              </div>
              <div className="flex justify-between border-t border-border/80 pt-1 text-xs text-muted-foreground">
                <span>Total Estimated Cost:</span>
                <span className="font-mono font-bold text-primary tabular-nums">
                  {formatPkr(successResult.grandTotalPkr)}
                </span>
              </div>
            </div>

            <p className="mx-auto max-w-md text-xs text-muted-foreground">
              Our dedicated Lahore ticketing concierge will contact you within
              24 hours to verify passport copies and confirm seat deposit.
            </p>

            <div className="mx-auto flex w-full max-w-sm flex-col gap-2.5 pt-2">
              <a
                href={
                  successResult.whatsappUrl ||
                  toWaMeUrl(
                    agencyWhatsapp,
                    `Assalam-o-Alaikum Al Ramlah Travels, I submitted group booking ${successResult.referenceNumber} for ${pkg.title}. Please guide me on deposit verification and passport submission.`
                  )
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none sm:text-sm"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                <span>Instant WhatsApp Concierge</span>
              </a>
              <Button
                type="button"
                variant="outline"
                onClick={handleTrackStatus}
                className="min-h-10 w-full gap-1.5 border-border bg-background text-xs font-semibold whitespace-nowrap text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-50 sm:text-sm"
              >
                <Search
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
                <span>Track Application Status Live</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="min-h-9 w-full text-xs whitespace-nowrap text-muted-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
              >
                Close Window
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Book Group Pilgrimage Seats</DialogTitle>
              <DialogDescription>
                {pkg.title} · {pkg.durationDays} Days Itinerary
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 py-2"
              noValidate
            >
              {/* Hidden Honeypot Trap (`T-055`) */}
              <div className="sr-only" aria-hidden="true">
                <label htmlFor={`gb-website-${pkg.id}`}>Company Website</label>
                <input
                  id={`gb-website-${pkg.id}`}
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {/* Batch Selector */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gb-batch">Select Departure Batch</Label>
                <select
                  id="gb-batch"
                  value={activeBatch?.id ?? ""}
                  onChange={(e) => {
                    setUserBatchId(e.target.value)
                    setSubmissionKey(createSubmissionKey("grp"))
                  }}
                  className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  {availableBatches.map((d) => {
                    const seatsLeft = d.totalSeats - d.bookedSeats
                    return (
                      <option key={d.id} value={d.id}>
                        {d.batchCode}: {d.departureCity?.cityName || "Pakistan"}{" "}
                        ({d.departureDate} to {d.returnDate}), {seatsLeft} seats
                        left
                      </option>
                    )
                  })}
                </select>
                {activeBatch && (
                  <div className="flex items-center justify-between pt-0.5 text-xs text-muted-foreground">
                    <span>
                      Gateway:{" "}
                      {activeBatch.departureCity?.cityName || "Pakistan"}
                      {activeBatch.departureCity?.airportCode
                        ? ` (${activeBatch.departureCity.airportCode})`
                        : ""}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        remainingSeats <= 5
                          ? "text-destructive"
                          : "text-primary"
                      }`}
                    >
                      {remainingSeats} seats available on this flight
                    </span>
                  </div>
                )}
              </div>

              {/* Selectable Multi-Hotel Tier Options (`T-054` & `OD-09b`) */}
              {pkg.multiHotelOptions && pkg.multiHotelOptions.length > 0 && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Building2
                      className="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                    <span>Choose Hotel Package Option</span>
                  </legend>
                  <div className="flex flex-col gap-2">
                    <label
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none ${
                        selectedHotelOptionCode === ""
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-card hover:bg-secondary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`hotel-option-${pkg.id}`}
                          value=""
                          checked={selectedHotelOptionCode === ""}
                          onChange={() => {
                            setSelectedHotelOptionCode("")
                            setSubmissionKey(createSubmissionKey("grp"))
                          }}
                          className="accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        />
                        <span className="font-semibold text-foreground">
                          Standard Featured Package Hotels
                        </span>
                      </div>
                      <span className="font-mono font-bold text-primary tabular-nums">
                        {standardQuadRate > 0
                          ? `Quad ${formatPkr(standardQuadRate)}`
                          : standardFallbackPositive.length > 0
                            ? `From ${formatPkr(Math.min(...standardFallbackPositive))}`
                            : "On Request"}
                      </span>
                    </label>

                    {pkg.multiHotelOptions.map((opt) => {
                      const codeKey = opt.pkgCode || opt.label
                      const isChosen = selectedHotelOptionCode === codeKey
                      const lowestOptPrice = getLowestPositiveOptionPrice(opt)
                      const isAllZero = lowestOptPrice <= 0
                      return (
                        <label
                          key={codeKey}
                          className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none ${
                            isAllZero
                              ? "cursor-not-allowed border-border/60 bg-muted/40 opacity-65"
                              : isChosen
                                ? "cursor-pointer border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "cursor-pointer border-border bg-card hover:bg-secondary/50"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="radio"
                              name={`hotel-option-${pkg.id}`}
                              value={codeKey}
                              disabled={isAllZero}
                              checked={isChosen}
                              onChange={() => {
                                if (isAllZero) return
                                setSelectedHotelOptionCode(codeKey)
                                setSubmissionKey(createSubmissionKey("grp"))
                              }}
                              className="mt-0.5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed"
                            />
                            <div>
                              <span className="block font-bold text-foreground">
                                {opt.label}
                              </span>
                              <span className="block text-[11px] text-muted-foreground">
                                {opt.makkahHotelName} ({opt.makkahDistance}) ·{" "}
                                {opt.madinahHotelName} ({opt.madinahDistance})
                              </span>
                            </div>
                          </div>
                          <span className="shrink-0 font-mono font-bold text-primary tabular-nums">
                            {opt.quadPricePkr > 0
                              ? `Quad ${formatPkr(opt.quadPricePkr)}`
                              : lowestOptPrice > 0
                                ? `From ${formatPkr(lowestOptPrice)}`
                                : "On Request"}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              )}

              {/* Room Sharing Tier (`OD-09b`: <=0 renders "On Request" & disables selection) */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">
                  Select Room Sharing Tier
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      {
                        key: "sharing" as const,
                        label: "Sharing Bed",
                        rate: sharingTierRate,
                      },
                      {
                        key: "quad" as const,
                        label: "Quad (4-Bed)",
                        rate: quadTierRate,
                      },
                      {
                        key: "triple" as const,
                        label: "Triple (3-Bed)",
                        rate: tripleTierRate,
                      },
                      {
                        key: "double" as const,
                        label: "Double (2-Bed)",
                        rate: doubleTierRate,
                      },
                    ] as const
                  ).map((item) => {
                    const isZeroTier = item.rate <= 0
                    const isSelected = roomType === item.key && !isZeroTier
                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={isZeroTier}
                        onClick={() => {
                          if (!isZeroTier) setUserRoomType(item.key)
                        }}
                        className={`rounded-xl border p-2.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:cursor-not-allowed disabled:opacity-65 motion-reduce:transition-none ${
                          isZeroTier
                            ? "border-border/60 bg-muted/40 text-muted-foreground"
                            : isSelected
                              ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/30"
                              : "border-border bg-card text-muted-foreground hover:bg-secondary/50"
                        }`}
                      >
                        <span className="block text-xs font-bold text-foreground">
                          {item.label}
                        </span>
                        <span className="font-mono text-xs font-semibold text-primary tabular-nums">
                          {formatTierOrOnRequest(item.rate)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Passenger Demographics */}
              <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-secondary/45 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted-foreground tabular-nums">
                  <span>Passenger Demographics</span>
                  <span>
                    Seats: {partySeatCount} · Passports: {totalPassports}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="gb-adults" className="text-xs">
                      Adults (12+ yrs)
                    </Label>
                    <Input
                      id="gb-adults"
                      type="number"
                      min={1}
                      max={30}
                      value={adults}
                      onChange={(e) => {
                        const nextAdults = Math.max(
                          1,
                          Math.min(30, Number(e.target.value) || 1)
                        )
                        setAdults(nextAdults)
                        if (infants > nextAdults) {
                          setInfants(nextAdults)
                        }
                      }}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="gb-children" className="text-xs">
                      Children (2 to 11 yrs)
                    </Label>
                    <Input
                      id="gb-children"
                      type="number"
                      min={0}
                      max={20}
                      value={children}
                      onChange={(e) =>
                        setChildren(
                          Math.max(0, Math.min(20, Number(e.target.value) || 0))
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="gb-infants" className="text-xs">
                      Infants (&lt;2 yrs)
                    </Label>
                    <Input
                      id="gb-infants"
                      type="number"
                      min={0}
                      max={Math.min(10, adults)}
                      value={infants}
                      onChange={(e) =>
                        setInfants(
                          Math.max(
                            0,
                            Math.min(10, adults, Number(e.target.value) || 0)
                          )
                        )
                      }
                    />
                  </div>
                </div>

                {isOverCapacity && (
                  <div
                    role="alert"
                    className="flex items-center gap-1.5 rounded-md border border-destructive/35 bg-destructive/10 p-2 text-xs font-medium text-destructive"
                  >
                    <AlertCircle
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Requested {partySeatCount} seat(s) exceeds the{" "}
                      {remainingSeats} available on this batch (infants require
                      0 seats).
                    </span>
                  </div>
                )}
              </div>

              {/* Pilgrim Contact Info */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gb-name">Lead Pilgrim Name *</Label>
                  <Input
                    id="gb-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Muhammad Farooq"
                    aria-invalid={Boolean(fieldErrors["contact.customerName"])}
                    required
                  />
                  {fieldErrors["contact.customerName"] && (
                    <p className="text-[11px] font-medium text-destructive">
                      {fieldErrors["contact.customerName"]}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gb-city">City of Residence *</Label>
                  <Input
                    id="gb-city"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    placeholder="e.g. Lahore / Karachi / London"
                    aria-invalid={Boolean(fieldErrors["contact.customerCity"])}
                    required
                  />
                  {fieldErrors["contact.customerCity"] && (
                    <p className="text-[11px] font-medium text-destructive">
                      {fieldErrors["contact.customerCity"]}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gb-phone">Phone Number *</Label>
                  <Input
                    id="gb-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => syncPhoneToWhatsapp(e.target.value)}
                    placeholder="0327 4029701"
                    aria-invalid={Boolean(fieldErrors["contact.customerPhone"])}
                    required
                  />
                  {fieldErrors["contact.customerPhone"] && (
                    <p className="text-[11px] font-medium text-destructive">
                      {fieldErrors["contact.customerPhone"]}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gb-wa">WhatsApp Number *</Label>
                  <Input
                    id="gb-wa"
                    type="tel"
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    placeholder="0327 4029701"
                    aria-invalid={Boolean(
                      fieldErrors["contact.customerWhatsapp"]
                    )}
                    required
                  />
                  {fieldErrors["contact.customerWhatsapp"] && (
                    <p className="text-[11px] font-medium text-destructive">
                      {fieldErrors["contact.customerWhatsapp"]}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gb-email">Email Address (Optional)</Label>
                <Input
                  id="gb-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="farooq@example.com"
                  aria-invalid={Boolean(fieldErrors["contact.customerEmail"])}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gb-notes">
                  Special Requests (Wheelchair, Dietary, etc.)
                </Label>
                <Textarea
                  id="gb-notes"
                  rows={2}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Elderly assistance, adjacent room requests..."
                />
              </div>

              {/* Price Estimation Bar */}
              <div className="flex flex-col justify-between gap-2 rounded-xl border border-gold-border bg-accent/45 p-3 text-xs sm:flex-row sm:items-center">
                <div>
                  <span className="block text-muted-foreground tabular-nums">
                    {pricePerPerson > 0 ? (
                      <>
                        Estimated Total ({partySeatCount} seat
                        {partySeatCount === 1 ? "" : "s"} ×{" "}
                        {formatPkr(pricePerPerson)}
                        {infants > 0
                          ? ` + ${infants} infant${infants > 1 ? "s" : ""} × ${formatPkr(infantPrice)}`
                          : ""}
                        ):
                      </>
                    ) : (
                      "Selected room tier requires bespoke confirmation:"
                    )}
                  </span>
                  <span className="font-mono text-base font-extrabold text-foreground tabular-nums">
                    {pricePerPerson > 0
                      ? formatPkr(estimatedTotal)
                      : "On Request"}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="self-start border-gold-border bg-card text-xs text-foreground sm:self-auto"
                >
                  Soft Seat Hold
                </Badge>
              </div>

              <DialogFooter className="pt-2">
                <DialogClose
                  render={
                    <Button
                      variant="outline"
                      type="button"
                      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
                    />
                  }
                >
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  disabled={
                    loading ||
                    isOverCapacity ||
                    !activeBatch ||
                    pricePerPerson <= 0
                  }
                  className="gap-2 bg-primary whitespace-nowrap text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading && (
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  )}
                  <span>Confirm Group Reservation</span>
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
