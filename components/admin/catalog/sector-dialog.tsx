"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { upsertTransportSector } from "@/app/actions/catalog"
import { Plus, Loader2, Bus } from "lucide-react"

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

export function SectorDialog({ sector, trigger }: SectorDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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
        setOpen(false)
        router.refresh()
      } else {
        setError("Failed to save sector.")
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer">
              <Plus className="size-4" />
              <span>Add Sector</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {sector ? `Edit ${sector.code}` : "Add Point-to-Point Sector"}
          </DialogTitle>
          <DialogDescription>
            Configure origin, destination, transit time, bus seat rates, and terminal parking fees.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-800">
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
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-label">Display Label</Label>
              <Input
                id="s-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Jeddah (JED) -> Makkah"
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
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
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bus className="size-3.5 text-gold" />
                <span className="text-xs font-semibold text-foreground">
                  Shared Bus & Parking Parameters
                </span>
              </div>
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSharedBusEligible}
                  onChange={(e) => setIsSharedBusEligible(e.target.checked)}
                  className="rounded text-primary"
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
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportsTrain}
                  onChange={(e) => setSupportsTrain(e.target.checked)}
                  className="rounded text-primary"
                />
                <span className="font-medium text-emerald-800">
                  Supports Train
                </span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-primary"
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
                className="w-14 h-7 text-xs"
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
              <span>{sector ? "Save Changes" : "Create Sector"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
