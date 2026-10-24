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
import { upsertDepartureCity } from "@/app/actions/catalog"
import { Plus, Loader2 } from "lucide-react"

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

export function DepartureCityDialog({
  city,
  trigger,
}: DepartureCityDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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
        setOpen(false)
        router.refresh()
      } else {
        setError("Failed to save departure gateway.")
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4" />
              <span>Add City Gateway</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {city ? `Edit ${city.cityName}` : "Add Departure City Gateway"}
          </DialogTitle>
          <DialogDescription>
            Pakistani international airport origin for group packages and custom flights.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-800">
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
                className="font-mono text-center uppercase"
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
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-primary"
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
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              <span>{city ? "Save Changes" : "Create City"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
