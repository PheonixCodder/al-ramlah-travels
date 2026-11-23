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
import { upsertAirline } from "@/app/actions/catalog"
import { Loader2, Plus } from "lucide-react"

export interface AirlineData {
  id?: string
  name: string
  iataCode: string
  logoUrl?: string | null
  isDirectAvailable: boolean
  isConnectingAvailable: boolean
  isActive: boolean
  sortOrder: number
}

interface AirlineDialogProps {
  airline?: AirlineData
  trigger?: React.ReactNode
}

function AirlineFormBody({
  airline,
  onSuccess,
}: {
  airline?: AirlineData
  onSuccess: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(airline?.name ?? "")
  const [iataCode, setIataCode] = useState(airline?.iataCode ?? "")
  const [logoUrl, setLogoUrl] = useState(airline?.logoUrl ?? "")
  const [isDirectAvailable, setIsDirectAvailable] = useState(
    airline?.isDirectAvailable ?? true
  )
  const [isConnectingAvailable, setIsConnectingAvailable] = useState(
    airline?.isConnectingAvailable ?? true
  )
  const [isActive, setIsActive] = useState(airline?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(airline?.sortOrder ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await upsertAirline({
        id: airline?.id,
        name,
        iataCode: iataCode.toUpperCase(),
        logoUrl: logoUrl || undefined,
        isDirectAvailable,
        isConnectingAvailable,
        isActive,
        sortOrder,
      })
      if (res.success) {
        onSuccess()
        router.refresh()
      } else {
        setError(res.error || "Failed to save airline.")
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to save airline.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {airline ? `Edit ${airline.name}` : "Add Partner Airline"}
        </DialogTitle>
        <DialogDescription>
          Configure airline IATA code and route availability.
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
            <Label htmlFor="a-name">Airline Name</Label>
            <Input
              id="a-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Saudia"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-iata">IATA (2 to 3 char)</Label>
            <Input
              id="a-iata"
              maxLength={3}
              value={iataCode}
              onChange={(e) => setIataCode(e.target.value.toUpperCase())}
              placeholder="SV"
              className="text-center font-mono"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="a-logo">Logo / Carrier URL</Label>
          <Input
            id="a-logo"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/carrier-logo.png"
          />
        </div>

        <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isDirectAvailable}
              onChange={(e) => setIsDirectAvailable(e.target.checked)}
              className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span>Direct Flight Option</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isConnectingAvailable}
              onChange={(e) => setIsConnectingAvailable(e.target.checked)}
              className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span>Connecting Flight Option</span>
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span className="font-medium">Active Partner</span>
          </label>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="a-sort" className="text-xs">
              Sort:
            </Label>
            <Input
              id="a-sort"
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
            <span>{airline ? "Save Changes" : "Create Airline"}</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function AirlineDialog({ airline, trigger }: AirlineDialogProps) {
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
              <span>Add Airline</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <AirlineFormBody
          key={`${airline?.id ?? "new"}-${formSession}`}
          airline={airline}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
