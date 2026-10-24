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
import { Textarea } from "@/components/ui/textarea"
import { upsertZiyaratPlace } from "@/app/actions/catalog"
import { Plus, Loader2 } from "lucide-react"

export interface ZiyaratData {
  id?: string
  city: "makkah" | "madinah"
  name: string
  arabicName: string
  description: string
  imageUrl?: string | null
  isActive: boolean
  sortOrder: number
}

interface ZiyaratDialogProps {
  place?: ZiyaratData
  defaultCity?: "makkah" | "madinah"
  trigger?: React.ReactNode
}

export function ZiyaratDialog({
  place,
  defaultCity = "makkah",
  trigger,
}: ZiyaratDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [city, setCity] = useState<"makkah" | "madinah">(
    place?.city ?? defaultCity
  )
  const [name, setName] = useState(place?.name ?? "")
  const [arabicName, setArabicName] = useState(place?.arabicName ?? "")
  const [description, setDescription] = useState(place?.description ?? "")
  const [imageUrl, setImageUrl] = useState(place?.imageUrl ?? "")
  const [isActive, setIsActive] = useState(place?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(place?.sortOrder ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await upsertZiyaratPlace({
        id: place?.id,
        city,
        name,
        arabicName,
        description,
        imageUrl: imageUrl || undefined,
        isActive,
        sortOrder,
      })
      if (res.success) {
        setOpen(false)
        router.refresh()
      } else {
        setError("Failed to save Ziyarat place.")
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to save Ziyarat place.")
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
              <span>Add Sacred Place</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {place ? `Edit ${place.name}` : "Add Sacred Ziyarat Site"}
          </DialogTitle>
          <DialogDescription>
            Include historical significance and authentic Arabic calligraphy.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="z-city">Holy City</Label>
            <select
              id="z-city"
              value={city}
              onChange={(e) => setCity(e.target.value as "makkah" | "madinah")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
            >
              <option value="makkah">Makkah Al-Mukarramah</option>
              <option value="madinah">Madinah Al-Munawwarah</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="z-name">Site Name (English)</Label>
            <Input
              id="z-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cave of Hira (Jabal Al-Nour)"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="z-arabic">Arabic Name (الاسم بالعربية)</Label>
            <Input
              id="z-arabic"
              value={arabicName}
              onChange={(e) => setArabicName(e.target.value)}
              placeholder="e.g. غار حراء - جبل النور"
              dir="rtl"
              className="font-arabic text-base"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="z-desc">Historical & Spiritual Description</Label>
            <Textarea
              id="z-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Where the Prophet ﷺ received the first revelation..."
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="z-image">Cover Image URL</Label>
            <Input
              id="z-image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
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
              <span className="font-medium">Active in Ziyarat Tour</span>
            </label>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="z-sort" className="text-xs">
                Sort:
              </Label>
              <Input
                id="z-sort"
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
              <span>{place ? "Save Changes" : "Create Site"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
