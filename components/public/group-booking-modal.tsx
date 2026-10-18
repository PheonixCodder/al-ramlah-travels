"use client"

import * as React from "react"
import { useState } from "react"
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
import { submitGroupBooking } from "@/app/actions/groups"
import {
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageCircle,
  Clock,
  Sparkles,
} from "lucide-react"

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
  multiHotelOptions?: Array<{
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
  }>
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
}

export function GroupBookingModal({
  pkg,
  selectedBatchId,
  trigger,
}: GroupBookingModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<{
    referenceNumber: string
    grandTotalPkr: number
  } | null>(null)

  // Filter available batches
  const availableBatches = pkg.departures.filter(
    (d) => d.status !== "closed" && d.totalSeats - d.bookedSeats > 0
  )

  const [batchId, setBatchId] = useState<string>(
    selectedBatchId || availableBatches[0]?.id || pkg.departures[0]?.id || ""
  )
  const [roomType, setRoomType] = useState<
    "sharing" | "double" | "triple" | "quad"
  >("quad")

  // Passengers
  const [adults, setAdults] = useState<number>(2)
  const [infants, setInfants] = useState<number>(0)

  // Contact
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerWhatsapp, setCustomerWhatsapp] = useState("")
  const [customerCity, setCustomerCity] = useState("Lahore")
  const [customerEmail, setCustomerEmail] = useState("")
  const [specialRequests, setSpecialRequests] = useState("")

  const activeBatch = pkg.departures.find((d) => d.id === batchId)
  const remainingSeats = activeBatch
    ? activeBatch.totalSeats - activeBatch.bookedSeats
    : 0
  const partySeatCount = adults
  const isOverCapacity = partySeatCount > remainingSeats

  // Price calculation
  let pricePerPerson = 0
  if (roomType === "sharing") {
    pricePerPerson =
      activeBatch?.sharingPriceOverridePkr ??
      pkg.sharingPricePkr ??
      pkg.quadPricePkr
  } else if (roomType === "quad") {
    pricePerPerson =
      activeBatch?.quadPriceOverridePkr ?? pkg.quadPricePkr
  } else if (roomType === "triple") {
    pricePerPerson =
      activeBatch?.triplePriceOverridePkr ?? pkg.triplePricePkr
  } else {
    pricePerPerson =
      activeBatch?.doublePriceOverridePkr ?? pkg.doublePricePkr
  }
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
    if (isOverCapacity) return
    setLoading(true)
    setError(null)

    try {
      const res = await submitGroupBooking({
        groupPackageId: pkg.id,
        groupDepartureId: batchId,
        selectedRoomType: roomType,
        passengers: { adults, infants },
        contact: {
          customerName,
          customerPhone,
          customerWhatsapp,
          customerCity,
          customerEmail: customerEmail || undefined,
          specialRequests: specialRequests || undefined,
        },
      })
      if (res.success) {
        setSuccessResult({
          referenceNumber: res.referenceNumber,
          grandTotalPkr: res.grandTotalPkr,
        })
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to submit group booking.")
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setSuccessResult(null)
    setError(null)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <div className="space-y-6 py-6 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-2xl font-bold text-foreground">
                Group Booking Reserved!
              </h3>
              <p className="text-sm text-muted-foreground">
                Your group seats on <strong>{pkg.title}</strong> have been provisionally held.
              </p>
            </div>

            {/* Reference Number Card */}
            <div className="mx-auto max-w-sm rounded-xl border border-gold/40 bg-gold/5 p-4 space-y-2">
              <span className="text-xs uppercase font-semibold text-gold tracking-wider">
                Booking Reference Code
              </span>
              <div className="font-mono text-2xl font-extrabold text-foreground tracking-tight">
                {successResult.referenceNumber}
              </div>
              <div className="text-xs text-muted-foreground pt-1 border-t border-border/80 flex justify-between">
                <span>Total Estimated Cost:</span>
                <span className="font-bold font-mono text-emerald-800">
                  PKR {successResult.grandTotalPkr.toLocaleString()}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Our dedicated ticketing concierge will contact you within 24 hours to confirm passport copies and verify group airline ticket issuance.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href={`https://wa.me/923001234567?text=${encodeURIComponent(
                  `Assalam-o-Alaikum, I just reserved group booking ${successResult.referenceNumber} for ${pkg.title}. Please guide me on payment and passport submission.`
                )}`}
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
              <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              {/* Batch Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="gb-batch">Select Departure Batch</Label>
                <select
                  id="gb-batch"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
                  required
                >
                  {pkg.departures.map((d) => {
                    const seatsLeft = d.totalSeats - d.bookedSeats
                    return (
                      <option
                        key={d.id}
                        value={d.id}
                        disabled={seatsLeft <= 0 || d.status === "closed"}
                      >
                        {d.batchCode} — {d.departureCity?.cityName || "Pakistan"} (
                        {d.departureDate} → {d.returnDate}) · {seatsLeft} seats left
                      </option>
                    )
                  })}
                </select>
                {activeBatch && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                    <span>
                      Gateway: {activeBatch.departureCity?.cityName} (
                      {activeBatch.departureCity?.airportCode})
                    </span>
                    <span
                      className={`font-semibold ${
                        remainingSeats <= 5 ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {remainingSeats} seats available on this flight
                    </span>
                  </div>
                )}
              </div>

              {/* Room Sharing Tier */}
              <div className="space-y-1.5">
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
                    <span className="font-mono text-xs font-semibold text-emerald-800">
                      PKR{" "}
                      {(
                        activeBatch?.sharingPriceOverridePkr ??
                        pkg.sharingPricePkr ??
                        pkg.quadPricePkr
                      ).toLocaleString()}
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
                    <span className="font-mono text-xs font-semibold text-emerald-800">
                      PKR{" "}
                      {(
                        activeBatch?.quadPriceOverridePkr ?? pkg.quadPricePkr
                      ).toLocaleString()}
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
                    <span className="font-mono text-xs font-semibold text-emerald-800">
                      PKR{" "}
                      {(
                        activeBatch?.triplePriceOverridePkr ?? pkg.triplePricePkr
                      ).toLocaleString()}
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
                    <span className="font-mono text-xs font-semibold text-emerald-800">
                      PKR{" "}
                      {(
                        activeBatch?.doublePriceOverridePkr ?? pkg.doublePricePkr
                      ).toLocaleString()}
                    </span>
                  </button>
                </div>
              </div>

              {/* Passenger Demographics */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Passenger Demographics</span>
                  <span>Seats: {partySeatCount}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="gb-adults" className="text-xs">
                      Adults (12+ yrs)
                    </Label>
                    <Input
                      id="gb-adults"
                      type="number"
                      min={1}
                      max={20}
                      value={adults}
                      onChange={(e) => setAdults(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="gb-infants" className="text-xs">
                      Infants (&lt;2 yrs)
                    </Label>
                    <Input
                      id="gb-infants"
                      type="number"
                      min={0}
                      max={5}
                      value={infants}
                      onChange={(e) => setInfants(Number(e.target.value))}
                    />
                  </div>
                </div>

                {isOverCapacity && (
                  <div className="flex items-center gap-1.5 rounded-md bg-red-100 p-2 text-xs font-medium text-red-800">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>
                      Requested {partySeatCount} seats exceeds the {remainingSeats} available on this batch.
                    </span>
                  </div>
                )}
              </div>

              {/* Pilgrim Contact Info */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gb-name">Lead Pilgrim Name</Label>
                  <Input
                    id="gb-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Muhammad Farooq"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gb-city">City in Pakistan</Label>
                  <Input
                    id="gb-city"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    placeholder="e.g. Lahore / Karachi"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gb-phone">Phone Number</Label>
                  <Input
                    id="gb-phone"
                    value={customerPhone}
                    onChange={(e) => syncPhoneToWhatsapp(e.target.value)}
                    placeholder="+92 300 1234567"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gb-wa">WhatsApp Number</Label>
                  <Input
                    id="gb-wa"
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    placeholder="+92 300 1234567"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gb-email">Email Address (Optional)</Label>
                <Input
                  id="gb-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="farooq@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gb-notes">Special Requests (Wheelchair, Dietary, etc.)</Label>
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
                  <span className="text-muted-foreground block">
                    Estimated Total ({partySeatCount} seats × PKR {pricePerPerson.toLocaleString()}
                    {infants > 0
                      ? ` + ${infants} infant${infants > 1 ? "s" : ""} × PKR ${infantPrice.toLocaleString()}`
                      : ""}):
                  </span>
                  <span className="font-mono text-base font-extrabold text-foreground">
                    PKR {estimatedTotal.toLocaleString()}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] text-muted-foreground self-start sm:self-auto">
                  Provisional Hold
                </Badge>
              </div>

              <DialogFooter className="pt-2">
                <DialogClose render={<Button variant="outline" type="button" />}>
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  disabled={loading || isOverCapacity}
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
