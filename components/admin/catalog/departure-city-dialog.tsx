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
import { upsertDepartureCity } from "@/app/actions/catalog"
import { Loader2, Plus } from "lucide-react"

export interface DepartureCityData {
  id?: string
  cityName: string
  airportCode: string
  airportName: string
  isActive: boolean
  sortOrder: number
}

interface DepartureCityDialogProps {
  city?: DepartureCityData
  trigger?: React.ReactNode
}

function DepartureCityFormBody({
  city,
  onSuccess,
}: {
  city?: DepartureCityData
  onSuccess: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cityName, setCityName] = useState(city?.cityName ?? "")
  const [airportCode, setAirportCode] = useState(city?.airportCode ?? "")
  const [airportName, setAirportName] = useState(city?.airportName ?? "")
  const [isActive, setIsActive] = useState(city?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(city?.sortOrder ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await upsertDepartureCity({
        id: city?.id,
        cityName,
        airportCode: airportCode.toUpperCase(),
        airportName,
        isActive,
        sortOrder,
      })
      if (res.success) {
        onSuccess()
        router.refresh()
      } else {
        setError(res.error || "Failed to save departure gateway.")
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to save departure gateway.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {city ? `Edit ${city.cityName}` : "Add Departure City Gateway"}
        </DialogTitle>
        <DialogDescription>
          Pakistani international airport origin for group packages and custom
          flights.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="dc-name">City Name</Label>
            <Input
              id="dc-name"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="e.g. Lahore"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-code">Airport (3-char)</Label>
            <Input
              id="dc-code"
              maxLength={3}
              value={airportCode}
              onChange={(e) => setAirportCode(e.target.value.toUpperCase())}
              placeholder="LHE"
              className="text-center font-mono"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dc-airport">Airport Official Name</Label>
          <Input
            id="dc-airport"
            value={airportName}
            onChange={(e) => setAirportName(e.target.value)}
            placeholder="e.g. Allama Iqbal International Airport"
            required
          />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span className="font-medium">Active Gateway</span>
          </label>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="dc-sort" className="text-xs">
              Sort:
            </Label>
            <Input
              id="dc-sort"
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
            <span>{city ? "Save Changes" : "Create City"}</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function DepartureCityDialog({
  city,
  trigger,
}: DepartureCityDialogProps) {
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
              <span>Add City Gateway</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DepartureCityFormBody
          key={`${city?.id ?? "new"}-${formSession}`}
          city={city}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
