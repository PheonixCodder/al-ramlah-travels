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
import { upsertGroupDeparture } from "@/app/actions/groups"
import { Plus, Loader2, Plane, Luggage } from "lucide-react"

export interface DepartureBatchData {
  id?: string
  packageId: string
  batchCode: string
  departureCityId: string
  departureDate: string
  returnDate: string
  totalSeats: number
  bookedSeats: number
  status: "open" | "filling_fast" | "sold_out" | "closed"
  sharingPriceOverridePkr?: number | null
  quadPriceOverridePkr?: number | null
  triplePriceOverridePkr?: number | null
  doublePriceOverridePkr?: number | null
  outboundFlightNumber?: string | null
  returnFlightNumber?: string | null
  flightScheduleSummary?: string | null
  routingNote?: string | null
  baggageAllowance?: string | null
}

interface DepartureBatchDialogProps {
  batch?: DepartureBatchData
  packageId: string
  cities: { id: string; cityName: string; airportCode: string }[]
  trigger?: React.ReactNode
}

export function DepartureBatchDialog({
  batch,
  packageId,
  cities,
  trigger,
}: DepartureBatchDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [batchCode, setBatchCode] = useState(
    batch?.batchCode ?? `BATCH-${Math.floor(1000 + Math.random() * 9000)}`
  )
  const [departureCityId, setDepartureCityId] = useState(
    batch?.departureCityId ?? (cities[0]?.id || "")
  )
  const [departureDate, setDepartureDate] = useState(
    batch?.departureDate ?? "2026-11-15"
  )
  const [returnDate, setReturnDate] = useState(
    batch?.returnDate ?? "2026-11-29"
  )
  const [totalSeats, setTotalSeats] = useState(batch?.totalSeats ?? 45)
  const [bookedSeats, setBookedSeats] = useState(batch?.bookedSeats ?? 0)
  const [status, setStatus] = useState<
    "open" | "filling_fast" | "sold_out" | "closed"
  >(batch?.status ?? "open")

  // Overrides
  const [sharingOverride, setSharingOverride] = useState<number | undefined>(
    batch?.sharingPriceOverridePkr ?? undefined
  )
  const [quadOverride, setQuadOverride] = useState<number | undefined>(
    batch?.quadPriceOverridePkr ?? undefined
  )
  const [tripleOverride, setTripleOverride] = useState<number | undefined>(
    batch?.triplePriceOverridePkr ?? undefined
  )
  const [doubleOverride, setDoubleOverride] = useState<number | undefined>(
    batch?.doublePriceOverridePkr ?? undefined
  )

  // Flight block fields
  const [outboundFlightNumber, setOutboundFlightNumber] = useState<string>(
    batch?.outboundFlightNumber ?? "SV-739"
  )
  const [returnFlightNumber, setReturnFlightNumber] = useState<string>(
    batch?.returnFlightNumber ?? "SV-738"
  )
  const [baggageAllowance, setBaggageAllowance] = useState<string>(
    batch?.baggageAllowance ?? "23-KG Outbound / 46-KG Return"
  )
  const [routingNote, setRoutingNote] = useState<string>(
    batch?.routingNote ?? "Direct Flights (LHE <-> JED)"
  )
  const [flightScheduleSummary, setFlightScheduleSummary] = useState<string>(
    batch?.flightScheduleSummary ?? "SV-739 (04:15 - 08:30) / SV-738 (21:00 - 03:15)"
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await upsertGroupDeparture({
        id: batch?.id,
        packageId,
        batchCode,
        departureCityId,
        departureDate,
        returnDate,
        totalSeats,
        bookedSeats,
        status,
        sharingPriceOverridePkr: sharingOverride ?? undefined,
        quadPriceOverridePkr: quadOverride ?? undefined,
        triplePriceOverridePkr: tripleOverride ?? undefined,
        doublePriceOverridePkr: doubleOverride ?? undefined,
        outboundFlightNumber: outboundFlightNumber || undefined,
        returnFlightNumber: returnFlightNumber || undefined,
        flightScheduleSummary: flightScheduleSummary || undefined,
        routingNote: routingNote || undefined,
        baggageAllowance: baggageAllowance || undefined,
      })
      setOpen(false)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to save departure batch.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button
              variant="outline"
              size="xs"
              className="gap-1.5 border-border bg-card text-foreground hover:bg-muted cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Batch</span>
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {batch ? `Edit Batch ${batch.batchCode}` : "Schedule Departure Batch"}
          </DialogTitle>
          <DialogDescription>
            Assign gateway airport, travel dates, seat allotment, flight blocks, and rate overrides.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-code">Batch Code</Label>
              <Input
                id="b-code"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value.toUpperCase())}
                placeholder="e.g. NOV-26-LHE-01"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-city">Departure Gateway</Label>
              <select
                id="b-city"
                value={departureCityId}
                onChange={(e) => setDepartureCityId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
                required
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cityName} ({c.airportCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-dep">Departure Date</Label>
              <Input
                id="b-dep"
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-ret">Return Date</Label>
              <Input
                id="b-ret"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-total">Total Seats</Label>
              <Input
                id="b-total"
                type="number"
                min={1}
                value={totalSeats}
                onChange={(e) => setTotalSeats(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-booked">Booked Seats</Label>
              <Input
                id="b-booked"
                type="number"
                min={0}
                value={bookedSeats}
                onChange={(e) => setBookedSeats(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-status">Status</Label>
              <select
                id="b-status"
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as
                      | "open"
                      | "filling_fast"
                      | "sold_out"
                      | "closed"
                  )
                }
                className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs shadow-xs focus-visible:outline-ring"
              >
                <option value="open">Open</option>
                <option value="filling_fast">Filling Fast (80%+)</option>
                <option value="sold_out">Sold Out (100%)</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Flight Block Configuration */}
          <div className="rounded-lg border border-gold/40 bg-card p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Plane className="size-3.5 text-gold" />
              <span>Flight Block & Schedule</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <Label htmlFor="b-outbound">Outbound Flight #</Label>
                <Input
                  id="b-outbound"
                  value={outboundFlightNumber}
                  onChange={(e) => setOutboundFlightNumber(e.target.value)}
                  placeholder="e.g. SV-739"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="b-return">Return Flight #</Label>
                <Input
                  id="b-return"
                  value={returnFlightNumber}
                  onChange={(e) => setReturnFlightNumber(e.target.value)}
                  placeholder="e.g. SV-738"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <Label htmlFor="b-baggage">Baggage Allowance</Label>
                <Input
                  id="b-baggage"
                  value={baggageAllowance}
                  onChange={(e) => setBaggageAllowance(e.target.value)}
                  placeholder="23-KG / 46-KG"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="b-routing">Routing Note</Label>
                <Input
                  id="b-routing"
                  value={routingNote}
                  onChange={(e) => setRoutingNote(e.target.value)}
                  placeholder="Direct Karachi <-> Jeddah"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <Label htmlFor="b-schedule">Schedule Summary</Label>
              <Input
                id="b-schedule"
                value={flightScheduleSummary}
                onChange={(e) => setFlightScheduleSummary(e.target.value)}
                placeholder="SV-739 (04:15 - 08:30) / SV-738 (21:00 - 03:15)"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Optional overrides */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Optional Batch Price Overrides (PKR)
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Input
                placeholder="Sharing Override"
                type="number"
                value={sharingOverride ?? ""}
                onChange={(e) =>
                  setSharingOverride(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                className="text-xs"
              />
              <Input
                placeholder="Quad Override"
                type="number"
                value={quadOverride ?? ""}
                onChange={(e) =>
                  setQuadOverride(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                className="text-xs"
              />
              <Input
                placeholder="Triple Override"
                type="number"
                value={tripleOverride ?? ""}
                onChange={(e) =>
                  setTripleOverride(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                className="text-xs"
              />
              <Input
                placeholder="Double Override"
                type="number"
                value={doubleOverride ?? ""}
                onChange={(e) =>
                  setDoubleOverride(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={loading}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              <span>{batch ? "Save Changes" : "Create Batch"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
