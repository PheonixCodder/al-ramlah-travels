"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { upsertTransportSector } from "@/app/actions/catalog"
import { Bus, Loader2, Plus } from "lucide-react"

export interface SectorData {
  id?: string
  code: string
  label: string
  originCity: string
  destinationCity: string
  originType: "airport" | "hotel"
  destinationType: "airport" | "hotel"
  supportsTrain: boolean
  isSharedBusEligible?: boolean
  sharedBusRateSarPerPax?: number
  terminalParkingFeeSar?: number
  approxDistanceKm?: number | null
  approxDurationMinutes?: number | null
  isActive: boolean
  sortOrder: number
}

interface SectorDialogProps {
  sector?: SectorData
  trigger?: React.ReactNode
}

function SectorFormBody({
  sector,
  onSuccess,
}: {
  sector?: SectorData
  onSuccess: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState(sector?.code ?? "")
  const [label, setLabel] = useState(sector?.label ?? "")
  const [originCity, setOriginCity] = useState(sector?.originCity ?? "Jeddah")
  const [destinationCity, setDestinationCity] = useState(
    sector?.destinationCity ?? "Makkah"
  )
  const [originType, setOriginType] = useState<"airport" | "hotel">(
    sector?.originType ?? "airport"
  )
  const [destinationType, setDestinationType] = useState<"airport" | "hotel">(
    sector?.destinationType ?? "hotel"
  )
  const [supportsTrain, setSupportsTrain] = useState(
    sector?.supportsTrain ?? false
  )
  const [isSharedBusEligible, setIsSharedBusEligible] = useState(
    sector?.isSharedBusEligible ?? false
  )
  const [sharedBusRateSarPerPax, setSharedBusRateSarPerPax] = useState<number>(
    sector?.sharedBusRateSarPerPax ?? 20
  )
  const [terminalParkingFeeSar, setTerminalParkingFeeSar] = useState<number>(
    sector?.terminalParkingFeeSar ?? 0
  )
  const [approxDistanceKm, setApproxDistanceKm] = useState<number | undefined>(
    sector?.approxDistanceKm ?? 95
  )
  const [approxDurationMinutes, setApproxDurationMinutes] = useState<
    number | undefined
  >(sector?.approxDurationMinutes ?? 75)
  const [isActive, setIsActive] = useState(sector?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(sector?.sortOrder ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await upsertTransportSector({
        id: sector?.id,
        code,
        label,
        originCity,
        destinationCity,
        originType,
        destinationType,
        supportsTrain,
        isSharedBusEligible,
        sharedBusRateSarPerPax,
        terminalParkingFeeSar,
        approxDistanceKm: approxDistanceKm ?? undefined,
        approxDurationMinutes: approxDurationMinutes ?? undefined,
        isActive,
        sortOrder,
      })
      if (res.success) {
        onSuccess()
        router.refresh()
      } else {
        setError(res.error || "Failed to save sector.")
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to save sector.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {sector ? `Edit ${sector.code}` : "Add Point-to-Point Sector"}
        </DialogTitle>
        <DialogDescription>
          Configure origin, destination, transit time, bus seat rates, and
          terminal parking fees.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-code">Sector Code</Label>
            <Input
              id="s-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. JED_TO_MAKKAH"
              className="font-mono"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-label">Display Label</Label>
            <Input
              id="s-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Jeddah (JED) to Makkah"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-origin-city">Origin City</Label>
            <Input
              id="s-origin-city"
              value={originCity}
              onChange={(e) => setOriginCity(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-dest-city">Destination City</Label>
            <Input
              id="s-dest-city"
              value={destinationCity}
              onChange={(e) => setDestinationCity(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-origin-type">Origin Point Type</Label>
            <select
              id="s-origin-type"
              value={originType}
              onChange={(e) =>
                setOriginType(e.target.value as "airport" | "hotel")
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="airport">Airport Terminal</option>
              <option value="hotel">Hotel / Residence</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-dest-type">Destination Point Type</Label>
            <select
              id="s-dest-type"
              value={destinationType}
              onChange={(e) =>
                setDestinationType(e.target.value as "airport" | "hotel")
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="hotel">Hotel / Residence</option>
              <option value="airport">Airport Terminal</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-distance">Approx Distance (km)</Label>
            <Input
              id="s-distance"
              type="number"
              value={approxDistanceKm ?? ""}
              onChange={(e) =>
                setApproxDistanceKm(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-duration">Approx Duration (Mins)</Label>
            <Input
              id="s-duration"
              type="number"
              value={approxDurationMinutes ?? ""}
              onChange={(e) =>
                setApproxDurationMinutes(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            />
          </div>
        </div>

        {/* Shared Bus & Terminal Parking Fees */}
        <div className="space-y-3 rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bus className="size-3.5 text-gold-text" aria-hidden="true" />
              <span className="text-xs font-semibold text-foreground">
                Shared Bus &amp; Parking Parameters
              </span>
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={isSharedBusEligible}
                onChange={(e) => setIsSharedBusEligible(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span>Shared Bus Eligible</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="s-bus-rate" className="text-xs">
                Shared Bus Rate (SAR / Pax)
              </Label>
              <Input
                id="s-bus-rate"
                type="number"
                min={0}
                value={sharedBusRateSarPerPax}
                onChange={(e) =>
                  setSharedBusRateSarPerPax(Number(e.target.value))
                }
                disabled={!isSharedBusEligible}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-parking-fee" className="text-xs">
                Terminal Parking Fee (SAR)
              </Label>
              <Input
                id="s-parking-fee"
                type="number"
                min={0}
                value={terminalParkingFeeSar}
                onChange={(e) =>
                  setTerminalParkingFeeSar(Number(e.target.value))
                }
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={supportsTrain}
                onChange={(e) => setSupportsTrain(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span className="font-medium text-status-success">
                Supports Train
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span>Active</span>
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="s-sort" className="text-xs">
              Sort:
            </Label>
            <Input
              id="s-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="h-7 w-14 font-mono text-xs"
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
            className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {loading && (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>{sector ? "Save Changes" : "Create Sector"}</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function SectorDialog({ sector, trigger }: SectorDialogProps) {
  const [open, setOpen] = useState(false)
  const [formSession, setFormSession] = useState(0)

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setFormSession((prev) => prev + 1)
    }
    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Plus className="size-4" aria-hidden="true" />
              <span>Add Sector</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <SectorFormBody
          key={`${sector?.id ?? "new"}-${formSession}`}
          sector={sector}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
