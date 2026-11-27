"use client"

import * as React from "react"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Building2,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  Search,
} from "lucide-react"
import { submitGroupBookingApplication } from "@/app/actions/applications"
import {
  resolveAvailableGroupRoomType,
  type BookingModalHotelOption,
  type BookingModalPackage,
  type GroupRoomOccupancyTier,
} from "@/components/public/group-booking-modal"
import {
  formatPkr,
  getTodayPktIso,
  toWaMeUrl,
} from "@/components/public/public-utils"
import { formatTierPriceOrOnRequest } from "@/components/seo/umrah-pricing-helpers"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { readStoredAttribution } from "@/lib/seo/utm"

export interface UmrahPackageBookingCtaProps {
  pkg: BookingModalPackage & { slug: string }
  agencyWhatsapp: string
}

export type GroupPackageCardItem = BookingModalPackage & { slug?: string }

type OccupancyKey = GroupRoomOccupancyTier

const CITY_SLUG_TO_AIRPORT: Record<string, string> = {
  LAHORE: "LHE",
  LHE: "LHE",
  KARACHI: "KHI",
  KHI: "KHI",
  ISLAMABAD: "ISB",
  ISB: "ISB",
}

function subscribeLocationSearch(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }
  window.addEventListener("popstate", onStoreChange)
  return () => {
    window.removeEventListener("popstate", onStoreChange)
  }
}

function getLocationSearchSnapshot(): string {
  return typeof window === "undefined" ? "" : window.location.search
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

function normalizeModalTierPrice(price: number | null | undefined): number {
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? price
    : 0
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

/**
 * Preserves `0` ("On Request") occupancy tier tariffs (`OD-09b`) when handing off
 * a package to booking components, and retains every `multiHotelOptions` row
 * that publishes at least one positive (`> 0`) occupancy price.
 */
export function prepareGroupModalPackage(
  pkg: GroupPackageCardItem
): GroupPackageCardItem {
  const validHotelOptions = (pkg.multiHotelOptions ?? [])
    .map((opt) => ({
      ...opt,
      sharingPricePkr: normalizeModalTierPrice(opt.sharingPricePkr),
      quadPricePkr: normalizeModalTierPrice(opt.quadPricePkr),
      triplePricePkr: normalizeModalTierPrice(opt.triplePricePkr),
      doublePricePkr: normalizeModalTierPrice(opt.doublePricePkr),
    }))
    .filter(
      (opt) =>
        opt.sharingPricePkr > 0 ||
        opt.quadPricePkr > 0 ||
        opt.triplePricePkr > 0 ||
        opt.doublePricePkr > 0
    )

  return {
    ...pkg,
    sharingPricePkr: normalizeModalTierPrice(pkg.sharingPricePkr),
    quadPricePkr: normalizeModalTierPrice(pkg.quadPricePkr),
    triplePricePkr: normalizeModalTierPrice(pkg.triplePricePkr),
    doublePricePkr: normalizeModalTierPrice(pkg.doublePricePkr),
    multiHotelOptions: validHotelOptions,
  }
}

/**
 * Live sticky family price calculator and 1-step inline seat reservation island
 * for `/umrah-packages/[slug]` (`Spec 0031` `AC-8`, `OD-09b`, `OD-09d`).
 * Syncs bidirectionally with `UmrahDeparturesSchedule` via `art:select-batch` / `art:batch-changed`,
 * preserves `<= 0` tiers as disabled `"On Request"`, and submits directly via `submitGroupBookingApplication`.
 */
export function UmrahPackageBookingCta({
  pkg,
  agencyWhatsapp,
}: UmrahPackageBookingCtaProps): React.ReactElement {
  const todayPkt = useMemo(() => getTodayPktIso(), [])
  const locationSearch = useSyncExternalStore(
    subscribeLocationSearch,
    getLocationSearchSnapshot,
    () => ""
  )

  const sanitizedPkg = useMemo(() => prepareGroupModalPackage(pkg), [pkg])

  const openFutureBatches = useMemo(
    () =>
      pkg.departures.filter(
        (d) =>
          (d.status === "open" || d.status === "filling_fast") &&
          d.departureDate >= todayPkt &&
          d.totalSeats - d.bookedSeats > 0
      ),
    [pkg.departures, todayPkt]
  )

  const queryDefaults = useMemo(() => {
    const params = new URLSearchParams(locationSearch)
    const rawCity = (params.get("city") ?? params.get("gateway") ?? "")
      .trim()
      .toUpperCase()
    const mappedAirport = CITY_SLUG_TO_AIRPORT[rawCity] ?? rawCity
    const rawTier = (params.get("tier") ?? params.get("occupancy") ?? "")
      .trim()
      .toLowerCase()
    const rawBatch = (params.get("batch") ?? "").trim()

    const matchedTier: OccupancyKey | undefined =
      rawTier === "sharing" ||
      rawTier === "quad" ||
      rawTier === "triple" ||
      rawTier === "double"
        ? rawTier
        : undefined

    const matchedBatch =
      (rawBatch
        ? openFutureBatches.find(
            (b) => b.id === rawBatch || b.batchCode === rawBatch
          )
        : undefined) ??
      (mappedAirport
        ? openFutureBatches.find(
            (b) =>
              b.departureCity?.airportCode?.trim().toUpperCase() ===
              mappedAirport
          )
        : undefined)

    return {
      batchId: matchedBatch?.id ?? null,
      tier: matchedTier,
    }
  }, [locationSearch, openFutureBatches])

  const [userBatchId, setUserBatchId] = useState<string | null>(null)
  const [selectedHotelOptionCode, setSelectedHotelOptionCode] =
    useState<string>("")
  const [userRoomType, setUserRoomType] = useState<OccupancyKey | null>(null)

  const [adults, setAdults] = useState<number>(() => {
    const firstBatch = pkg.departures.find(
      (d) =>
        (d.status === "open" || d.status === "filling_fast") &&
        d.departureDate >= todayPkt &&
        d.totalSeats - d.bookedSeats > 0
    )
    if (firstBatch && firstBatch.totalSeats - firstBatch.bookedSeats === 1) {
      return 1
    }
    return 2
  })
  const [children, setChildren] = useState<number>(0)
  const [infants, setInfants] = useState<number>(0)

  const [showPilgrimForm, setShowPilgrimForm] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerWhatsapp, setCustomerWhatsapp] = useState("")
  const [customerCity, setCustomerCity] = useState("Lahore")
  const [customerEmail, setCustomerEmail] = useState("")
  const [specialRequests, setSpecialRequests] = useState("")
  const [honeypot, setHoneypot] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [copiedRef, setCopiedRef] = useState(false)
  const [submissionKey, setSubmissionKey] = useState(() =>
    createSubmissionKey("grp")
  )
  const [successResult, setSuccessResult] = useState<{
    referenceNumber: string
    grandTotalPkr: number
    whatsappUrl?: string
  } | null>(null)

  useEffect(() => {
    const onSelectBatch = (ev: Event) => {
      const batchId = (ev as CustomEvent<{ batchId?: string }>).detail?.batchId
      if (!batchId) return
      if (openFutureBatches.some((b) => b.id === batchId)) {
        setUserBatchId(batchId)
        setSubmissionKey(createSubmissionKey("grp"))
        setError(null)
        setSuccessResult(null)
      }
    }
    window.addEventListener("art:select-batch", onSelectBatch)
    return () => {
      window.removeEventListener("art:select-batch", onSelectBatch)
    }
  }, [openFutureBatches])

  const activeBatchId =
    userBatchId && openFutureBatches.some((b) => b.id === userBatchId)
      ? userBatchId
      : queryDefaults.batchId &&
          openFutureBatches.some((b) => b.id === queryDefaults.batchId)
        ? queryDefaults.batchId
        : (openFutureBatches[0]?.id ?? "")

  const activeBatch =
    openFutureBatches.find((b) => b.id === activeBatchId) ??
    openFutureBatches[0] ??
    null
  const remainingSeats = activeBatch
    ? Math.max(0, activeBatch.totalSeats - activeBatch.bookedSeats)
    : 0
  const partySeatCount = adults + children
  const isOverCapacity = activeBatch !== null && partySeatCount > remainingSeats

  const validHotelOptions = useMemo(
    () => sanitizedPkg.multiHotelOptions ?? [],
    [sanitizedPkg.multiHotelOptions]
  )

  const matchedHotelOption = useMemo(
    () =>
      validHotelOptions.find(
        (opt) =>
          opt.pkgCode === selectedHotelOptionCode ||
          opt.label === selectedHotelOptionCode
      ) ?? null,
    [validHotelOptions, selectedHotelOptionCode]
  )

  // OD-09b: Preserve 0-value tiers as 0 ("On Request") instead of masking with quadPricePkr
  const sharingTierRate = normalizeModalTierPrice(
    matchedHotelOption
      ? matchedHotelOption.sharingPricePkr
      : activeBatch?.sharingPriceOverridePkr !== null &&
          activeBatch?.sharingPriceOverridePkr !== undefined
        ? activeBatch.sharingPriceOverridePkr
        : pkg.sharingPricePkr !== undefined
          ? pkg.sharingPricePkr
          : pkg.quadPricePkr
  )

  const quadTierRate = normalizeModalTierPrice(
    matchedHotelOption
      ? matchedHotelOption.quadPricePkr
      : (activeBatch?.quadPriceOverridePkr ?? pkg.quadPricePkr)
  )

  const tripleTierRate = normalizeModalTierPrice(
    matchedHotelOption
      ? matchedHotelOption.triplePricePkr
      : (activeBatch?.triplePriceOverridePkr ?? pkg.triplePricePkr)
  )

  const doubleTierRate = normalizeModalTierPrice(
    matchedHotelOption
      ? matchedHotelOption.doublePricePkr
      : (activeBatch?.doublePriceOverridePkr ?? pkg.doublePricePkr)
  )

  const tierCards = useMemo(() => {
    const entries: Array<{
      key: OccupancyKey
      label: string
      shortLabel: string
      rawPrice: number
    }> = [
      {
        key: "sharing",
        label: "Sharing Bed",
        shortLabel: "Sharing",
        rawPrice: sharingTierRate,
      },
      {
        key: "quad",
        label: "Quad (4-Bed)",
        shortLabel: "Quad",
        rawPrice: quadTierRate,
      },
      {
        key: "triple",
        label: "Triple (3-Bed)",
        shortLabel: "Triple",
        rawPrice: tripleTierRate,
      },
      {
        key: "double",
        label: "Double (2-Bed)",
        shortLabel: "Double",
        rawPrice: doubleTierRate,
      },
    ]
    return entries.map((entry) => ({
      ...entry,
      formatted: formatTierPriceOrOnRequest(entry.rawPrice),
    }))
  }, [sharingTierRate, quadTierRate, tripleTierRate, doubleTierRate])

  const resolvedRoomTier = resolveAvailableGroupRoomType(
    {
      sharing: sharingTierRate,
      quad: quadTierRate,
      triple: tripleTierRate,
      double: doubleTierRate,
    },
    userRoomType ?? queryDefaults.tier
  )

  const activeTierCard =
    tierCards.find(
      (t) => t.key === resolvedRoomTier && t.formatted.isBookable
    ) ??
    tierCards.find((t) => t.formatted.isBookable) ??
    null
  const activeTierRate = activeTierCard?.rawPrice ?? 0

  const effectiveInfantUnitPkr = normalizeModalTierPrice(pkg.infantPricePkr)
  const infantFormatted = formatTierPriceOrOnRequest(effectiveInfantUnitPkr)
  const bedsSubtotalPkr =
    activeTierRate > 0 ? partySeatCount * activeTierRate : 0
  const infantSubtotalPkr = infants * effectiveInfantUnitPkr
  const estimatedTotalPkr =
    activeTierRate > 0 ? bedsSubtotalPkr + infantSubtotalPkr : 0

  const canSubmitBooking = openFutureBatches.length > 0 && activeTierRate > 0

  const whatsappHref = useMemo(() => {
    const tierNote = activeTierCard?.formatted.isBookable
      ? `${activeTierCard.label} (${activeTierCard.formatted.label})`
      : "custom room occupancy"
    const batchNote = activeBatch
      ? ` on batch ${activeBatch.batchCode} (${activeBatch.departureDate})`
      : ""
    return toWaMeUrl(
      agencyWhatsapp,
      `Assalam-o-Alaikum Al Ramlah Travels, I am viewing ${pkg.title} (${pkg.durationDays} Days) at /umrah-packages/${pkg.slug} for ${adults} Adults, ${children} Children, ${infants} Infants (${tierNote}${batchNote}).`
    )
  }, [
    activeBatch,
    activeTierCard,
    adults,
    agencyWhatsapp,
    children,
    infants,
    pkg.durationDays,
    pkg.slug,
    pkg.title,
  ])

  function selectBatchFromRail(batchId: string) {
    setUserBatchId(batchId)
    setSubmissionKey(createSubmissionKey("grp"))
    setError(null)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("art:batch-changed", { detail: { batchId } })
      )
    }
  }

  function syncPhoneToWhatsapp(nextPhone: string) {
    setCustomerPhone(nextPhone)
    if (!customerWhatsapp || customerWhatsapp === customerPhone) {
      setCustomerWhatsapp(nextPhone)
    }
  }

  function handleAdultsChange(delta: number) {
    const maxSeats = activeBatch ? Math.min(30, remainingSeats) : 30
    const nextAdults = Math.max(
      1,
      Math.min(maxSeats - children, adults + delta)
    )
    setAdults(nextAdults)
    if (infants > nextAdults) {
      setInfants(nextAdults)
    }
    setSubmissionKey(createSubmissionKey("grp"))
  }

  function handleChildrenChange(delta: number) {
    const maxSeats = activeBatch ? Math.min(20 + adults, remainingSeats) : 30
    const nextChildren = Math.max(
      0,
      Math.min(20, maxSeats - adults, children + delta)
    )
    setChildren(nextChildren)
    setSubmissionKey(createSubmissionKey("grp"))
  }

  function handleInfantsChange(delta: number) {
    const nextInfants = Math.max(0, Math.min(10, adults, infants + delta))
    setInfants(nextInfants)
    setSubmissionKey(createSubmissionKey("grp"))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || isOverCapacity || !activeBatch || activeTierRate <= 0) {
      return
    }
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
        roomOccupancyTier: activeTierCard?.key ?? resolvedRoomTier,
        selectedHotelOptionCode: selectedHotelOptionCode || undefined,
        passengers: { adults, children, infants },
        contact: {
          customerName,
          customerPhone,
          customerWhatsapp: customerWhatsapp || customerPhone,
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
          res.grandTotalPkr ?? res.estimatedTotalPkr ?? estimatedTotalPkr,
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

  async function handleCopyReference(refCode: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(refCode)
      setCopiedRef(true)
      window.setTimeout(() => setCopiedRef(false), 2000)
    } catch {
      setCopiedRef(false)
    }
  }

  function handleResetReservation() {
    setSuccessResult(null)
    setError(null)
    setFieldErrors({})
    setShowPilgrimForm(false)
    setCopiedRef(false)
    setSubmissionKey(createSubmissionKey("grp"))
  }

  function handleMobileReserveJump() {
    if (canSubmitBooking) {
      setShowPilgrimForm(true)
    }
    if (typeof document !== "undefined") {
      document
        .getElementById("reserve-seats")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const maxSeatsLeft = activeBatch ? remainingSeats : 30

  return (
    <>
      <aside
        id="reserve-seats"
        aria-label="Live Family Price Calculator & Seat Reservation"
        className="flex scroll-mt-24 flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col gap-1 border-b border-border pb-4">
          <h2 className="font-display text-xl font-bold text-primary">
            Family Calculator &amp; Seat Reservation
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Calculate your exact PKR family total and submit a provisional seat
            hold directly to our Lahore ticketing desk.
          </p>
        </div>

        {successResult ? (
          <div
            data-testid="inline-booking-confirmation"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-3 rounded-2xl bg-status-success-bg p-4 text-status-success">
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-display text-base font-bold text-primary">
                    Provisional Seat Hold Recorded
                  </h3>
                  <p className="text-xs leading-relaxed text-foreground">
                    Your inquiry for {pkg.title} is queued for 24-hour ticketing
                    desk verification.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl bg-background px-3.5 py-2.5">
                <div>
                  <span className="block text-xs font-medium text-muted-foreground">
                    Reference Code
                  </span>
                  <span className="font-mono text-base font-extrabold text-primary tabular-nums">
                    {successResult.referenceNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyReference(successResult.referenceNumber)
                  }
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  {copiedRef ? (
                    <>
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-border/70 pt-2 text-xs text-foreground">
                <span>Estimated Total:</span>
                <span className="font-mono text-sm font-bold text-primary tabular-nums">
                  {formatPkr(successResult.grandTotalPkr)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <a
                href={successResult.whatsappUrl || whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                <span>Confirm on WhatsApp Concierge</span>
              </a>
              <Link
                href={`/?trackRef=${encodeURIComponent(successResult.referenceNumber)}#track-status`}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
              >
                <Search className="size-4 text-gold-text" aria-hidden="true" />
                <span>Track Application Status Live</span>
              </Link>
              <button
                type="button"
                onClick={handleResetReservation}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-xl text-xs font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                Reserve Another Batch
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Departure City & Date Batch Selector */}
            <div className="flex flex-col gap-2">
              <span className="block text-xs font-semibold text-foreground">
                1. Departure City &amp; Date Batch
              </span>
              {openFutureBatches.length > 0 ? (
                <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-0.5">
                  {openFutureBatches.map((batch) => {
                    const seatsLeft = Math.max(
                      0,
                      batch.totalSeats - batch.bookedSeats
                    )
                    const isSelected = activeBatch?.id === batch.id
                    const airportCode =
                      batch.departureCity?.airportCode?.trim().toUpperCase() ||
                      "PAK"
                    const cityName = batch.departureCity?.cityName || "Pakistan"
                    return (
                      <button
                        key={batch.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => selectBatchFromRail(batch.id)}
                        className={`flex min-h-11 w-full flex-col gap-1 rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-border bg-background hover:border-gold-border hover:bg-secondary/65"
                        }`}
                      >
                        <span className="flex w-full items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-foreground">
                            {cityName}{" "}
                            <span className="font-mono text-primary tabular-nums">
                              ({airportCode})
                            </span>
                          </span>
                          <span className="font-mono font-bold text-primary tabular-nums">
                            {batch.departureDate}
                          </span>
                        </span>
                        <span className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">
                            {batch.batchCode}
                          </span>
                          <span
                            className={`font-semibold tabular-nums ${
                              seatsLeft <= 5
                                ? "text-destructive"
                                : "text-gold-text"
                            }`}
                          >
                            <span className="font-mono">{seatsLeft}</span> seats
                            left
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-secondary/70 p-3.5 text-xs leading-relaxed text-muted-foreground">
                  No open upcoming departure dates are currently listed. Request
                  custom dates in our Journey Builder below.
                </div>
              )}
            </div>

            {/* 2. Optional Multi-Hotel Tier Selector (only when valid >0 hotel options exist) */}
            {validHotelOptions.length > 0 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Building2
                    className="size-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>2. Optional Hotel Combination</span>
                </legend>
                <div className="flex flex-col gap-2">
                  <label
                    className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border p-3 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none ${
                      selectedHotelOptionCode === ""
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border bg-background hover:border-gold-border hover:bg-secondary/65"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`rail-hotel-option-${pkg.id}`}
                        value=""
                        checked={selectedHotelOptionCode === ""}
                        onChange={() => {
                          setSelectedHotelOptionCode("")
                          setSubmissionKey(createSubmissionKey("grp"))
                        }}
                        className="accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                      <span className="font-semibold text-foreground">
                        Standard Featured Hotels
                      </span>
                    </span>
                    <span className="font-mono font-bold text-primary tabular-nums">
                      {formatTierPriceOrOnRequest(
                        activeBatch?.quadPriceOverridePkr ?? pkg.quadPricePkr
                      ).isBookable
                        ? formatTierPriceOrOnRequest(
                            activeBatch?.quadPriceOverridePkr ??
                              pkg.quadPricePkr
                          ).label
                        : "On Request"}
                    </span>
                  </label>

                  {validHotelOptions.map((opt) => {
                    const codeKey = opt.pkgCode || opt.label
                    const isChosen = selectedHotelOptionCode === codeKey
                    const lowestOptPrice = getLowestPositiveOptionPrice(opt)
                    const optDisplay =
                      opt.quadPricePkr > 0
                        ? formatPkr(opt.quadPricePkr)
                        : lowestOptPrice > 0
                          ? `From ${formatPkr(lowestOptPrice)}`
                          : "On Request"

                    return (
                      <label
                        key={codeKey}
                        className={`flex min-h-11 cursor-pointer items-start justify-between gap-2 rounded-xl border p-3 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none ${
                          isChosen
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-border bg-background hover:border-gold-border hover:bg-secondary/65"
                        }`}
                      >
                        <span className="flex items-start gap-2">
                          <input
                            type="radio"
                            name={`rail-hotel-option-${pkg.id}`}
                            value={codeKey}
                            checked={isChosen}
                            onChange={() => {
                              setSelectedHotelOptionCode(codeKey)
                              setSubmissionKey(createSubmissionKey("grp"))
                            }}
                            className="mt-0.5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          />
                          <span>
                            <span className="block font-bold text-foreground">
                              {opt.label}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {opt.makkahHotelName}, {opt.madinahHotelName}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 font-mono font-bold text-primary tabular-nums">
                          {optDisplay}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ) : null}

            {/* 3. Adult / Child Room Occupancy Selector (`OD-09b`: `<= 0` tiers disabled & "On Request") */}
            <div className="flex flex-col gap-2">
              <span className="block text-xs font-semibold text-foreground">
                {validHotelOptions.length > 0 ? "3." : "2."} Room Occupancy Tier
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {tierCards.map((tier) => {
                  const isSelected =
                    activeTierCard?.key === tier.key &&
                    tier.formatted.isBookable
                  return (
                    <button
                      key={tier.key}
                      type="button"
                      disabled={!tier.formatted.isBookable}
                      aria-pressed={isSelected}
                      onClick={() => {
                        if (tier.formatted.isBookable) {
                          setUserRoomType(tier.key)
                          setSubmissionKey(createSubmissionKey("grp"))
                        }
                      }}
                      className={`min-h-14 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:border-border disabled:bg-secondary/65 disabled:opacity-75 motion-reduce:transition-none ${
                        !tier.formatted.isBookable
                          ? "cursor-not-allowed border-border bg-secondary/65 opacity-75"
                          : isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                            : "border-border bg-background hover:border-gold-border hover:bg-secondary/75"
                      }`}
                    >
                      <span className="block text-xs font-bold text-foreground">
                        {tier.label}
                      </span>
                      <span
                        className={
                          tier.formatted.isBookable
                            ? "mt-0.5 block font-mono text-xs font-bold text-primary tabular-nums sm:text-sm"
                            : "mt-0.5 block text-xs font-semibold text-gold-text sm:text-sm"
                        }
                      >
                        {tier.formatted.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 4. Family Travellers Steppers */}
            <div className="flex flex-col gap-2.5">
              <span className="block text-xs font-semibold text-foreground">
                {validHotelOptions.length > 0 ? "4." : "3."} Family Travellers
              </span>

              <div className="flex flex-col gap-2">
                {/* Adults 12+ */}
                <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/65 px-3 py-2">
                  <div>
                    <span className="block text-xs font-bold text-foreground">
                      Adults (12+ yrs)
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      1 hotel bed, 1 KSA coach seat
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease Adults"
                      disabled={adults <= 1}
                      onClick={() => handleAdultsChange(-1)}
                      className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-bold text-foreground tabular-nums">
                      {adults}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase Adults"
                      disabled={
                        adults >= 30 ||
                        (activeBatch !== null && partySeatCount >= maxSeatsLeft)
                      }
                      onClick={() => handleAdultsChange(1)}
                      className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Children 2 to 11 */}
                <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/65 px-3 py-2">
                  <div>
                    <span className="block text-xs font-bold text-foreground">
                      Children (2 to 11 yrs)
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      1 hotel bed, 1 KSA coach seat
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease Children"
                      disabled={children <= 0}
                      onClick={() => handleChildrenChange(-1)}
                      className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-bold text-foreground tabular-nums">
                      {children}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase Children"
                      disabled={
                        children >= 20 ||
                        (activeBatch !== null && partySeatCount >= maxSeatsLeft)
                      }
                      onClick={() => handleChildrenChange(1)}
                      className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Infants <2 yrs */}
                <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/65 px-3 py-2">
                  <div>
                    <span className="block text-xs font-bold text-foreground">
                      Infants (&lt;2 yrs)
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      0 hotel beds, 0 vehicle seats
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease Infants"
                      disabled={infants <= 0}
                      onClick={() => handleInfantsChange(-1)}
                      className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-bold text-foreground tabular-nums">
                      {infants}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase Infants"
                      disabled={infants >= Math.min(10, adults)}
                      onClick={() => handleInfantsChange(1)}
                      className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              {isOverCapacity ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-status-danger-bg p-3 text-xs font-medium text-status-danger"
                >
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Requested {partySeatCount} seat(s) exceeds the{" "}
                    {remainingSeats} remaining seats on batch{" "}
                    {activeBatch.batchCode}. Please reduce travellers or pick
                    another batch.
                  </span>
                </div>
              ) : null}
            </div>

            {/* 5. Live Itemized Family PKR Summary (`bg-secondary/70 rounded-2xl p-4`, zero nested border) */}
            <div className="flex flex-col gap-2.5 rounded-2xl bg-secondary/70 p-4 text-xs">
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="tabular-nums">
                  Beds &amp; KSA Seats ({partySeatCount} x{" "}
                  {activeTierCard?.shortLabel ?? "Room"})
                </span>
                {activeTierRate > 0 ? (
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {formatPkr(bedsSubtotalPkr)}
                  </span>
                ) : (
                  <span className="font-semibold text-gold-text">
                    On Request
                  </span>
                )}
              </div>

              {infants > 0 ? (
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="tabular-nums">
                    Infants (&lt;2 yrs: {infants}, 0 bed, 0 seat)
                  </span>
                  {infantFormatted.isBookable ? (
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {formatPkr(infantSubtotalPkr)}
                    </span>
                  ) : (
                    <span className="font-semibold text-gold-text">
                      On Request
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>Infant (&lt;2 yrs) Rate (0 bed, 0 seat)</span>
                  {infantFormatted.isBookable ? (
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {infantFormatted.label}
                    </span>
                  ) : (
                    <span className="font-semibold text-gold-text">
                      On Request
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-baseline justify-between gap-2 border-t border-border pt-2.5">
                <span className="text-sm font-bold text-foreground">
                  Estimated Family Total
                </span>
                {activeTierRate > 0 ? (
                  <span className="font-mono text-xl font-bold text-primary tabular-nums">
                    {formatPkr(estimatedTotalPkr)}
                  </span>
                ) : (
                  <span className="text-base font-bold text-gold-text">
                    On Request
                  </span>
                )}
              </div>
            </div>

            {/* 6. 1-Step Inline Reservation Form or Expand Trigger */}
            <div className="flex flex-col gap-2.5">
              {canSubmitBooking ? (
                showPilgrimForm ? (
                  <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="flex flex-col gap-3.5 border-t border-border pt-4"
                  >
                    {/* Hidden Honeypot Trap (`T-055`) */}
                    <div className="sr-only" aria-hidden="true">
                      <label htmlFor={`calc-website-${pkg.id}`}>
                        Company Website
                      </label>
                      <input
                        id={`calc-website-${pkg.id}`}
                        name="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </div>

                    {error ? (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl bg-status-danger-bg p-3 text-xs font-medium text-status-danger"
                      >
                        <AlertCircle
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{error}</span>
                      </div>
                    ) : null}

                    <FieldGroup className="gap-3">
                      <Field
                        data-invalid={Boolean(
                          fieldErrors["contact.customerName"]
                        )}
                      >
                        <FieldLabel
                          htmlFor="calc-name"
                          className="text-xs font-semibold"
                        >
                          Lead Pilgrim Full Name *
                        </FieldLabel>
                        <Input
                          id="calc-name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g. Muhammad Farooq"
                          aria-invalid={Boolean(
                            fieldErrors["contact.customerName"]
                          )}
                          className="h-11 bg-background"
                          required
                        />
                        <FieldError>
                          {fieldErrors["contact.customerName"]}
                        </FieldError>
                      </Field>

                      <Field
                        data-invalid={Boolean(
                          fieldErrors["contact.customerPhone"]
                        )}
                      >
                        <FieldLabel
                          htmlFor="calc-phone"
                          className="text-xs font-semibold"
                        >
                          Phone Number *
                        </FieldLabel>
                        <Input
                          id="calc-phone"
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => syncPhoneToWhatsapp(e.target.value)}
                          placeholder="0327 4029701"
                          aria-invalid={Boolean(
                            fieldErrors["contact.customerPhone"]
                          )}
                          className="h-11 bg-background font-mono tabular-nums"
                          required
                        />
                        <FieldError>
                          {fieldErrors["contact.customerPhone"]}
                        </FieldError>
                      </Field>

                      <Field
                        data-invalid={Boolean(
                          fieldErrors["contact.customerWhatsapp"]
                        )}
                      >
                        <FieldLabel
                          htmlFor="calc-wa"
                          className="text-xs font-semibold"
                        >
                          WhatsApp Number *
                        </FieldLabel>
                        <Input
                          id="calc-wa"
                          type="tel"
                          value={customerWhatsapp}
                          onChange={(e) => setCustomerWhatsapp(e.target.value)}
                          placeholder="0327 4029701"
                          aria-invalid={Boolean(
                            fieldErrors["contact.customerWhatsapp"]
                          )}
                          className="h-11 bg-background font-mono tabular-nums"
                          required
                        />
                        <FieldError>
                          {fieldErrors["contact.customerWhatsapp"]}
                        </FieldError>
                      </Field>

                      <Field
                        data-invalid={Boolean(
                          fieldErrors["contact.customerCity"]
                        )}
                      >
                        <FieldLabel
                          htmlFor="calc-city"
                          className="text-xs font-semibold"
                        >
                          City of Residence *
                        </FieldLabel>
                        <Input
                          id="calc-city"
                          value={customerCity}
                          onChange={(e) => setCustomerCity(e.target.value)}
                          placeholder="e.g. Lahore / Karachi / London"
                          aria-invalid={Boolean(
                            fieldErrors["contact.customerCity"]
                          )}
                          className="h-11 bg-background"
                          required
                        />
                        <FieldError>
                          {fieldErrors["contact.customerCity"]}
                        </FieldError>
                      </Field>

                      <Field
                        data-invalid={Boolean(
                          fieldErrors["contact.customerEmail"]
                        )}
                      >
                        <FieldLabel
                          htmlFor="calc-email"
                          className="text-xs font-semibold"
                        >
                          Email Address (Optional)
                        </FieldLabel>
                        <Input
                          id="calc-email"
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="farooq@example.com"
                          aria-invalid={Boolean(
                            fieldErrors["contact.customerEmail"]
                          )}
                          className="h-11 bg-background"
                        />
                        <FieldError>
                          {fieldErrors["contact.customerEmail"]}
                        </FieldError>
                      </Field>

                      <Field>
                        <FieldLabel
                          htmlFor="calc-notes"
                          className="text-xs font-semibold"
                        >
                          Special Notes (Wheelchair, Adjacent Rooms)
                        </FieldLabel>
                        <Textarea
                          id="calc-notes"
                          rows={2}
                          value={specialRequests}
                          onChange={(e) => setSpecialRequests(e.target.value)}
                          placeholder="Elderly wheelchair assistance, connecting rooms"
                          className="bg-background"
                        />
                      </Field>
                    </FieldGroup>

                    <Button
                      type="submit"
                      disabled={
                        loading ||
                        isOverCapacity ||
                        !activeBatch ||
                        activeTierRate <= 0
                      }
                      className="min-h-11 w-full rounded-xl bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none sm:text-sm"
                    >
                      {loading ? (
                        <Loader2
                          className="size-4 animate-spin motion-reduce:animate-none"
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                      ) : (
                        <CalendarCheck2
                          className="size-4"
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        {loading
                          ? "Recording Seat Hold…"
                          : "Confirm Seat Reservation"}
                      </span>
                    </Button>

                    <button
                      type="button"
                      onClick={() => setShowPilgrimForm(false)}
                      className="inline-flex min-h-9 w-full items-center justify-center rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                    >
                      Collapse Pilgrim Details
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled={isOverCapacity}
                    onClick={() => setShowPilgrimForm(true)}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none sm:text-sm"
                  >
                    <CalendarCheck2 className="size-4" aria-hidden="true" />
                    <span>Enter Pilgrim Details</span>
                  </button>
                )
              ) : (
                <Link
                  href="/?preset=complete_umrah#journey-builder"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
                >
                  <Compass className="size-4" aria-hidden="true" />
                  <span>
                    {openFutureBatches.length === 0
                      ? "Request Custom Travel Dates"
                      : "Request Custom Occupancy Quote"}
                  </span>
                </Link>
              )}

              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-secondary px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                <span>WhatsApp Concierge Inquiry</span>
              </a>

              <div className="pt-1 text-center">
                <Link
                  href="/?preset=complete_umrah#journey-builder"
                  className="inline-flex min-h-6 items-center rounded-sm text-xs font-semibold text-gold-text underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                >
                  Prefer flexible dates or private SUV transfers? Open Custom
                  Builder
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Sticky Mobile Bottom Bar (sibling outside <aside>, pr-24 clears WhatsApp FAB) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 py-3 pr-24 shadow-sm lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block truncate text-xs text-muted-foreground tabular-nums">
              {partySeatCount} {partySeatCount === 1 ? "seat" : "seats"} (
              {activeTierCard?.shortLabel ?? "Custom"})
            </span>
            {activeTierRate > 0 ? (
              <span className="block font-mono text-base font-bold text-primary tabular-nums">
                {formatPkr(estimatedTotalPkr)}
              </span>
            ) : (
              <span className="block text-sm font-bold text-gold-text">
                On Request
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleMobileReserveJump}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
          >
            {successResult ? "View Confirmation" : "Reserve Seats"}
          </button>
        </div>
      </div>
    </>
  )
}
