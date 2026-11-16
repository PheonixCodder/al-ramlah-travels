"use client"

import * as React from "react"
import Image from "next/image"
import {
  Search,
  ImageIcon,
  Sparkles,
  Layers,
  FileText,
  Check,
  Loader2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { listStudioMediaLibraryAssetsAction } from "@/app/actions/social-scheduler"

export interface StudioMediaAssetItem {
  id: string
  postCode: string
  kind: string
  title: string
  imageUrl: string
  pdfUrl: string | null
  supplierName?: string | null
  createdAt: string
}

interface StudioMediaPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectAsset: (asset: StudioMediaAssetItem) => void
  currentAssetId?: string
}

export function StudioMediaPickerModal({
  isOpen,
  onClose,
  onSelectAsset,
  currentAssetId,
}: StudioMediaPickerModalProps) {
  const [assets, setAssets] = React.useState<StudioMediaAssetItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [kindFilter, setKindFilter] = React.useState<string>("all")

  const fetchAssets = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listStudioMediaLibraryAssetsAction({
        kind: kindFilter !== "all" ? kindFilter : undefined,
        search: searchQuery.trim() || undefined,
        limit: 60,
      })
      if (res.success && res.assets) {
        setAssets(res.assets)
      } else {
        setError(res.error || "Failed to load studio assets")
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load studio assets"
      )
    } finally {
      setLoading(false)
    }
  }, [kindFilter, searchQuery])

  React.useEffect(() => {
    if (isOpen) {
      fetchAssets()
    }
  }, [isOpen, fetchAssets])

  const filterTabs = [
    { id: "all", label: "All Media", icon: Layers },
    {
      id: "single_package_spotlight",
      label: "Spotlight Posters",
      icon: Sparkles,
    },
    {
      id: "multi_package_sheet",
      label: "Supplier Sheets",
      icon: ImageIcon,
    },
    {
      id: "custom_quotation_pdf",
      label: "Quotation PDFs",
      icon: FileText,
    },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-[#C5A059]/40 shadow-xl">
        <DialogHeader className="p-5 border-b border-border/80 bg-gradient-to-r from-[#0A3622]/5 to-[#C5A059]/5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="size-4 text-[#C5A059]" />
                <span>Multimodal Studio Media Library</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select rendered 4K posters and supplier flyers to attach directly to your social post.
              </DialogDescription>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by package code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs border-border bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {filterTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = kindFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setKindFilter(tab.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#0A3622] text-white shadow-xs"
                        : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    <Icon className="size-3 text-[#C5A059]" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </DialogHeader>

        {/* Assets Grid */}
        <div className="flex-1 overflow-y-auto p-5 min-h-[320px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
              <Loader2 className="size-7 animate-spin text-[#C5A059]" />
              <span className="text-xs">Loading studio posters &amp; flyers...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-destructive">
              <span className="text-xs font-semibold">{error}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchAssets}
                className="text-xs h-7"
              >
                Retry
              </Button>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground text-center">
              <ImageIcon className="size-8 text-muted-foreground/50" />
              <p className="text-xs font-medium">No studio assets found.</p>
              <p className="text-[11px] text-muted-foreground/80 max-w-sm">
                Generate 4K posters in the Multimodal Studio (/admin/studio) or upload supplier flyers first.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {assets.map((asset) => {
                const isSelected = asset.id === currentAssetId
                return (
                  <div
                    key={asset.id}
                    onClick={() => {
                      onSelectAsset(asset)
                      onClose()
                    }}
                    className={`group relative rounded-xl border overflow-hidden bg-background transition-all hover:shadow-md cursor-pointer flex flex-col ${
                      isSelected
                        ? "border-[#0A3622] ring-2 ring-[#0A3622]/40"
                        : "border-border hover:border-[#C5A059]/60"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-[3/4] w-full bg-muted overflow-hidden">
                      {asset.imageUrl ? (
                        <Image
                          src={asset.imageUrl}
                          alt={asset.title}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                          <ImageIcon className="size-8" />
                        </div>
                      )}

                      {/* Kind Pill */}
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-black/60 text-white backdrop-blur-xs font-mono border-0"
                        >
                          {asset.postCode}
                        </Badge>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2 rounded-full bg-[#0A3622] text-white p-1 shadow-sm">
                          <Check className="size-3" />
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-[#0A3622]">
                          {asset.title}
                        </p>
                        {asset.supplierName && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {asset.supplierName}
                          </p>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="capitalize">
                          {asset.kind.replace(/_/g, " ")}
                        </span>
                        <span className="text-[#0A3622] font-semibold group-hover:underline">
                          Select
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
