"use client"

import * as React from "react"
import Image from "next/image"
import {
  Search,
  ImageIcon,
  Sparkles,
  Layers,
  Film,
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

function getRenderableImagePreviewUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  const pathname = trimmed.split(/[?#]/)[0]?.toLowerCase() || ""
  if (
    pathname.endsWith(".mp4") ||
    pathname.endsWith(".mov") ||
    pathname.endsWith(".webm") ||
    pathname.endsWith(".m4v") ||
    pathname.endsWith(".pdf")
  ) {
    return null
  }
  return trimmed
}

function isPdfAssetUrl(url: string): boolean {
  const pathname = url.trim().split(/[?#]/)[0]?.toLowerCase() || ""
  return pathname.endsWith(".pdf")
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
  const [retryNonce, setRetryNonce] = React.useState(0)

  React.useEffect(() => {
    if (!isOpen) return
    let active = true

    void Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true)
      setError(null)
      try {
        const res = await listStudioMediaLibraryAssetsAction({
          kind: kindFilter !== "all" ? kindFilter : undefined,
          search: searchQuery.trim() || undefined,
          limit: 60,
        })
        if (!active) return
        if (res.success && res.assets) {
          setAssets(res.assets)
        } else {
          setError(res.error || "Failed to load studio assets")
        }
      } catch (err: unknown) {
        if (!active) return
        setError(
          err instanceof Error ? err.message : "Failed to load studio assets"
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })

    return () => {
      active = false
    }
  }, [isOpen, kindFilter, searchQuery, retryNonce])

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
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden border-gold-border bg-card p-0 shadow-xl">
        <DialogHeader className="shrink-0 border-b border-border/80 bg-secondary/50 p-5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <DialogTitle className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <Sparkles
                  className="size-4 text-gold-text"
                  aria-hidden="true"
                />
                <span>Multimodal Studio Media Library</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select rendered 4K posters and supplier flyers to attach directly
                to your social post.
              </DialogDescription>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col items-stretch justify-between gap-3 pt-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="text"
                placeholder="Search by package code or title…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 border-border bg-background pl-8 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search query"
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <X className="size-3" aria-hidden="true" />
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
                    disabled={loading}
                    onClick={() => setKindFilter(tab.id)}
                    className={`flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        : "bg-background text-muted-foreground hover:bg-background/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    }`}
                  >
                    <Icon
                      className={`size-3 ${
                        isActive ? "text-gold" : "text-gold-text"
                      }`}
                      aria-hidden="true"
                    />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </DialogHeader>

        {/* Assets Grid */}
        <div className="min-h-[320px] flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2
                className="size-7 animate-spin text-gold-text motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span className="text-xs">
                Loading studio posters &amp; flyers…
              </span>
            </div>
          ) : error ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-status-danger">
              <span className="text-xs font-semibold">{error}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRetryNonce((n) => n + 1)}
                className="h-7 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Retry
              </Button>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <ImageIcon
                className="size-8 text-muted-foreground/50"
                aria-hidden="true"
              />
              <p className="text-xs font-medium">No studio assets found.</p>
              <p className="max-w-sm text-[11px] text-muted-foreground/80">
                Generate 4K posters in the Multimodal Studio (/admin/studio) or
                upload supplier flyers first.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {assets.map((asset) => {
                const isSelected = asset.id === currentAssetId
                const previewImageUrl = getRenderableImagePreviewUrl(
                  asset.imageUrl
                )
                const isPdf = Boolean(
                  asset.imageUrl && isPdfAssetUrl(asset.imageUrl)
                )
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      onSelectAsset(asset)
                      onClose()
                    }}
                    className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl text-left transition-colors active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
                      isSelected
                        ? "bg-primary/5 ring-2 ring-primary"
                        : "bg-secondary/50 hover:bg-secondary/80"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                      {previewImageUrl ? (
                        <Image
                          src={previewImageUrl}
                          alt={asset.title}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover"
                          unoptimized
                        />
                      ) : asset.imageUrl?.trim() ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                          {isPdf ? (
                            <FileText className="size-8" aria-hidden="true" />
                          ) : (
                            <Film className="size-8" aria-hidden="true" />
                          )}
                          <span className="text-[11px] font-medium">
                            {isPdf ? "Vector PDF" : "Video Asset"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="size-8" aria-hidden="true" />
                        </div>
                      )}

                      {/* Kind Pill */}
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant="secondary"
                          className="border-0 bg-primary font-mono text-[10px] text-primary-foreground"
                        >
                          {asset.postCode}
                        </Badge>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2 rounded-full bg-primary p-1 text-primary-foreground shadow-sm">
                          <Check className="size-3" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-1 flex-col justify-between p-2.5">
                      <div>
                        <p className="line-clamp-1 text-xs font-semibold text-foreground group-hover:text-primary">
                          {asset.title}
                        </p>
                        {asset.supplierName && (
                          <p className="line-clamp-1 text-[10px] text-muted-foreground">
                            {asset.supplierName}
                          </p>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                        <span className="capitalize">
                          {asset.kind.replace(/_/g, " ")}
                        </span>
                        <span className="font-semibold text-primary group-hover:underline">
                          Select
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
