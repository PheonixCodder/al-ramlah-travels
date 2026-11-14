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
import { getTodayPktIso, toWaMeUrl } from "@/components/public/public-utils"
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageCircle,
  Building2,
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

interface GroupBookingModalProps {
  pkg: BookingModalPackage
  selectedBatchId?: string
  trigger?: React.ReactNode
  agencyWhatsapp?: string
}

function createSubmissionKey(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function GroupBookingModal({
  pkg,
  selectedBatchId,
  trigger,
  agencyWhatsapp = DEFAULT_COMPANY_INFO.primaryWhatsapp,
}: GroupBookingModalProps) {
  const [open, setOpen] = useState(false)
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

  const [batchId, setBatchId] = useState<string>(
    selectedBatchId && availableBatches.some((b) => b.id === selectedBatchId)
      ? selectedBatchId
      : (availableBatches[0]?.id ?? "")
  )

  const [selectedHotelOptionCode, setSelectedHotelOptionCode] =
    useState<string>("")
  const [roomType, setRoomType] = useState<
    "sharing" | "double" | "triple" | "quad"
  >("quad")

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

  const activeBatch = availableBatches.find((d) => d.id === batchId) ?? availableBatches[0]
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

  const sharingTierRate = matchedHotelOption
    ? (matchedHotelOption.sharingPricePkr ?? matchedHotelOption.quadPricePkr)
    : (activeBatch?.sharingPriceOverridePkr ??
      pkg.sharingPricePkr ??
      pkg.quadPricePkr)
  const quadTierRate = matchedHotelOption
    ? matchedHotelOption.quadPricePkr
    : (activeBatch?.quadPriceOverridePkr ?? pkg.quadPricePkr)
  const tripleTierRate = matchedHotelOption
    ? matchedHotelOption.triplePricePkr
    : (activeBatch?.triplePriceOverridePkr ?? pkg.triplePricePkr)
  const doubleTierRate = matchedHotelOption
    ? matchedHotelOption.doublePricePkr
    : (activeBatch?.doublePriceOverridePkr ?? pkg.doublePricePkr)

  let pricePerPerson = quadTierRate
  if (roomType === "sharing") pricePerPerson = sharingTierRate
  else if (roomType === "quad") pricePerPerson = quadTierRate
  else if (roomType === "triple") pricePerPerson = tripleTierRate
  else pricePerPerson = doubleTierRate

  const infantPrice = pkg.infantPricePkr ?? 65000
  const estimatedTotal =
    pricePerPerson * partySeatCount + infants * infantPrice

  function syncPhoneToWhatsapp(val: string) {
    setCustomerPhone(val)
    if (!customerWhatsapp || customerWhatsapp === customerPhone) {
      setCustomerWhatsapp(val)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || isOverCapacity || !activeBatch) return
    setLoading(true)
    setError(null)
    setFieldErrors({})

    try {
      const res = await submitGroupBookingApplication({
        clientSubmissionId: submissionKey,
        honeypot,
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

      // T-054: Surface server validation & capacity errors explicitly via role="alert"
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
        grandTotalPkr: res.grandTotalPkr ?? res.estimatedTotalPkr ?? estimatedTotal,
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
    setSubmissionKey(createSubmissionKey("grp"))
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setError(null)
          setFieldErrors({})
        }
      }}
    >
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs sm:text-sm">
              Book Package Seats
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        {successResult ? (
          <div className="flex flex-col gap-6 py-6 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="font-display text-2xl font-bold text-foreground">
                Group Booking Inquiry Recorded!
              </h3>
              <p className="text-sm text-muted-foreground">
                Your provisional reservation request on <strong>{pkg.title}</strong> is queued for ticketing confirmation.
              </p>
            </div>

            <div className="mx-auto max-w-sm w-full rounded-xl border border-gold/40 bg-gold/5 p-4 flex flex-col gap-2">
              <span className="text-xs uppercase font-semibold text-gold tracking-wider">
                Booking Reference Code
              </span>
              <div className="font-mono tabular-nums text-2xl font-extrabold text-foreground tracking-tight">
                {successResult.referenceNumber}
              </div>
              <div className="text-xs text-muted-foreground pt-1 border-t border-border/80 flex justify-between">
                <span>Total Estimated Cost:</span>
                <span className="font-bold font-mono tabular-nums text-emerald-800">
                  PKR {successResult.grandTotalPkr.toLocaleString()}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Our dedicated Lahore ticketing concierge will contact you within 24 hours to verify passport copies and confirm seat deposit.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
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
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-800"
              >
                <MessageCircle className="size-4" />
                <span>Instant WhatsApp Concierge</span>
              </a>
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full sm:w-auto text-xs sm:text-sm"
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
                className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200"
              >
                <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2" noValidate>
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
                    setBatchId(e.target.value)
                    setSubmissionKey(createSubmissionKey("grp"))
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
                  required
                >
                  {availableBatches.map((d) => {
                    const seatsLeft = d.totalSeats - d.bookedSeats
                    return (
                      <option key={d.id} value={d.id}>
                        {d.batchCode} — {d.departureCity?.cityName || "Pakistan"} (
                        {d.departureDate} → {d.returnDate}) · {seatsLeft} seats left
                      </option>
                    )
                  })}
                </select>
                {activeBatch && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                    <span>
                      Gateway: {activeBatch.departureCity?.cityName || "Pakistan"}
                      {activeBatch.departureCity?.airportCode
                        ? ` (${activeBatch.departureCity.airportCode})`
                        : ""}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        remainingSeats <= 5 ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {remainingSeats} seats available on this flight
                    </span>
                  </div>
                )}
              </div>

              {/* Selectable Multi-Hotel Tier Options (`T-054`) */}
              {pkg.multiHotelOptions && pkg.multiHotelOptions.length > 0 && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
                    <Building2 className="size-3.5 text-emerald-800" />
                    <span>Choose Hotel Package Option</span>
                  </legend>
                  <div className="flex flex-col gap-2">
                    <label
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 text-xs transition-all ${
                        selectedHotelOptionCode === ""
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-card hover:bg-muted/30"
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
                          className="accent-emerald-800"
                        />
                        <span className="font-semibold text-foreground">
                          Standard Featured Package Hotels
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-emerald-800">
                        Quad PKR{" "}
                        {(
                          activeBatch?.quadPriceOverridePkr ?? pkg.quadPricePkr
                        ).toLocaleString()}
                      </span>
                    </label>

                    {pkg.multiHotelOptions.map((opt) => {
                      const codeKey = opt.pkgCode || opt.label
                      const isChosen = selectedHotelOptionCode === codeKey
                      return (
                        <label
                          key={codeKey}
                          className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 text-xs transition-all gap-2 ${
                            isChosen
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border bg-card hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="radio"
                              name={`hotel-option-${pkg.id}`}
                              value={codeKey}
                              checked={isChosen}
                              onChange={() => {
                                setSelectedHotelOptionCode(codeKey)
                                setSubmissionKey(createSubmissionKey("grp"))
                              }}
                              className="mt-0.5 accent-emerald-800"
                            />
                            <div>
                              <span className="font-bold text-foreground block">
                                {opt.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground block">
                                {opt.makkahHotelName} ({opt.makkahDistance}) ·{" "}
                                {opt.madinahHotelName} ({opt.madinahDistance})
                              </span>
                            </div>
                          </div>
                          <span className="font-mono tabular-nums font-bold text-emerald-800 shrink-0">
                            Quad PKR {opt.quadPricePkr.toLocaleString()}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              )}

              {/* Room Sharing Tier */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">
                  Select Room Sharing Tier
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setRoomType("sharing")}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      roomType === "sharing"
                        ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/30"
                        : "border-border bg-card hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <span className="block text-xs font-bold text-foreground">
                      Sharing Bed
                    </span>
                    <span className="font-mono tabular-nums text-xs font-semibold text-emerald-800">
                      PKR {sharingTierRate.toLocaleString()}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoomType("quad")}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      roomType === "quad"
                        ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/30"
                        : "border-border bg-card hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <span className="block text-xs font-bold text-foreground">
                      Quad (4-Bed)
                    </span>
                    <span className="font-mono tabular-nums text-xs font-semibold text-emerald-800">
                      PKR {quadTierRate.toLocaleString()}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoomType("triple")}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      roomType === "triple"
                        ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/30"
                        : "border-border bg-card hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <span className="block text-xs font-bold text-foreground">
                      Triple (3-Bed)
                    </span>
                    <span className="font-mono tabular-nums text-xs font-semibold text-emerald-800">
                      PKR {tripleTierRate.toLocaleString()}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoomType("double")}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      roomType === "double"
                        ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/30"
                        : "border-border bg-card hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <span className="block text-xs font-bold text-foreground">
                      Double (2-Bed)
                    </span>
                    <span className="font-mono tabular-nums text-xs font-semibold text-emerald-800">
                      PKR {doubleTierRate.toLocaleString()}
                    </span>
                  </button>
                </div>
              </div>

              {/* Passenger Demographics */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider tabular-nums">
                  <span>Passenger Demographics</span>
                  <span>
                    Seats: {partySeatCount} · Passports: {totalPassports}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      Children (2–11 yrs)
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
                    className="flex items-center gap-1.5 rounded-md bg-red-100 p-2 text-xs font-medium text-red-800"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    <span>
                      Requested {partySeatCount} seat(s) exceeds the{" "}
                      {remainingSeats} available on this batch (infants require 0 seats).
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
                    <p className="text-[11px] font-medium text-red-700">
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
                    <p className="text-[11px] font-medium text-red-700">
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
                    <p className="text-[11px] font-medium text-red-700">
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
                    aria-invalid={Boolean(fieldErrors["contact.customerWhatsapp"])}
                    required
                  />
                  {fieldErrors["contact.customerWhatsapp"] && (
                    <p className="text-[11px] font-medium text-red-700">
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-gold/30 bg-gold/5 p-3 text-xs gap-1">
                <div>
                  <span className="text-muted-foreground block tabular-nums">
                    Estimated Total ({partySeatCount} seat
                    {partySeatCount === 1 ? "" : "s"} × PKR{" "}
                    {pricePerPerson.toLocaleString()}
                    {infants > 0
                      ? ` + ${infants} infant${infants > 1 ? "s" : ""} × PKR ${infantPrice.toLocaleString()}`
                      : ""}
                    ):
                  </span>
                  <span className="font-mono tabular-nums text-base font-extrabold text-foreground">
                    PKR {estimatedTotal.toLocaleString()}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] text-muted-foreground self-start sm:self-auto"
                >
                  Soft Seat Hold
                </Badge>
              </div>

              <DialogFooter className="pt-2">
                <DialogClose render={<Button variant="outline" type="button" />}>
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  disabled={loading || isOverCapacity || !activeBatch}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
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
