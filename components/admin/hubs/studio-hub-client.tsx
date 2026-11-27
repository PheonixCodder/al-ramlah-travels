"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Sparkles,
  Wand2,
  Globe,
  Upload,
  Image as ImageIcon,
  Film,
  FileText,
  CheckCircle2,
  Loader2,
  Building2,
  Coins,
  ExternalLink,
  Trash2,
  Plus,
  Share2,
  Search,
  Copy,
  Check,
  Plane,
  AlertCircle,
  FileUp,
  Layers,
  Pencil,
  Camera,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import type { PackageWithRelations } from "@/components/admin/catalog/groups-client"
import { PackageWorkbenchClient } from "@/components/admin/studio/package-workbench-client"
import type { StudioHotelOption } from "@/components/admin/studio/package-builder-sheet"
import {
  approveStagedSupplierFlyerAction,
  ingestFinishedPosterOrFlyerAction,
  generateMultiPackageSheetForFlyer,
  generateSingleSpotlightForCard,
  updateExtractedFlyerCardAction,
  deleteSupplierFlyerAction,
  publishFlyerCardToPublicGroupPackages,
  publishAllFlyerCardsToPublicGroupPackagesAction,
  unpublishFlyerCardFromPublicAction,
  updatePackageSpotlightImageAction,
  upsertSupplier,
} from "@/app/actions/marketing-ops"
import { mintRealtimeRunPublicTokenAction } from "@/app/actions/trigger-realtime"
import { StudioRealtimeRunBanner } from "@/components/admin/studio/studio-realtime-run-banner"
import type { TaskProgressMetadata } from "@/trigger/metadata"
import {
  STUDIO_MODE_A_LABEL,
  STUDIO_MODE_B_LABEL,
} from "@/lib/constants/admin-labels"
import { cn } from "@/lib/utils"

function extractPreviewPathname(url: string): string {
  return url.trim().split(/[?#]/)[0]?.trim().toLowerCase() ?? ""
}

function isPdfAssetPreviewUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return extractPreviewPathname(url).endsWith(".pdf")
}

function isVideoAssetPreviewUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const pathname = extractPreviewPathname(url)
  return (
    pathname.endsWith(".mp4") ||
    pathname.endsWith(".mov") ||
    pathname.endsWith(".webm") ||
    pathname.endsWith(".m4v")
  )
}

export function getRenderableStudioImageUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (isPdfAssetPreviewUrl(trimmed) || isVideoAssetPreviewUrl(trimmed)) {
    return null
  }
  return trimmed
}

function isSafeVectorPdfPreviewHref(
  url: string | null | undefined
): url is string {
  if (!url) return false
  const trimmed = url.trim()
  return trimmed.startsWith("https://") || trimmed.startsWith("/api/media/")
}

const VECTOR_PDF_TILE_STYLES = {
  card: {
    container: "gap-2 bg-secondary/70 p-6",
    icon: "size-10",
    title: "text-xs",
    link: "text-[11px]",
  },
  compact: {
    container: "gap-1 bg-secondary p-2",
    icon: "size-6",
    title: "text-[11px]",
    link: "text-[11px]",
  },
  thumb: {
    container: "gap-0.5 bg-secondary p-1",
    icon: "size-4",
    title: "text-[10px] leading-tight",
    link: "text-[10px] leading-tight",
  },
} as const

function VectorPdfPreviewTile({
  url,
  size = "card",
}: {
  url: string
  size?: keyof typeof VECTOR_PDF_TILE_STYLES
}) {
  const safeHref = isSafeVectorPdfPreviewHref(url) ? url.trim() : null
  const styles = VECTOR_PDF_TILE_STYLES[size]

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center text-center",
        styles.container
      )}
    >
      <FileText
        className={cn("text-gold-text", styles.icon)}
        aria-hidden="true"
      />
      <span className={cn("font-bold text-primary", styles.title)}>
        Vector PDF Document
      </span>
      {safeHref && (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "font-semibold text-status-success underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            styles.link
          )}
        >
          Open Vector PDF
        </a>
      )}
    </div>
  )
}

function StudioAssetPreviewMedia({
  url,
  alt,
  size = "card",
  imageClassName = "object-cover",
}: {
  url: string | null | undefined
  alt: string
  size?: keyof typeof VECTOR_PDF_TILE_STYLES
  imageClassName?: string
}) {
  if (url && isPdfAssetPreviewUrl(url)) {
    return <VectorPdfPreviewTile url={url} size={size} />
  }

  const renderableImg = getRenderableStudioImageUrl(url)
  if (renderableImg) {
    return (
      <Image
        src={renderableImg}
        alt={alt}
        fill
        unoptimized
        className={imageClassName}
      />
    )
  }

  const isVideo = isVideoAssetPreviewUrl(url)
  const styles = VECTOR_PDF_TILE_STYLES[size]
  const Icon = isVideo ? Film : ImageIcon

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center text-center",
        styles.container,
        "bg-secondary/60"
      )}
    >
      <Icon
        className={cn(
          isVideo ? "text-gold-text" : "text-muted-foreground",
          styles.icon
        )}
        aria-hidden="true"
      />
      <span className={cn("font-semibold text-muted-foreground", styles.title)}>
        {isVideo ? "Video Asset" : "No Image"}
      </span>
    </div>
  )
}

function formatStudioPkrTier(amount: number): string {
  return amount > 0 ? amount.toLocaleString("en-PK") : "On Request"
}

export interface SupplierRecord {
  id: string
  name: string
  slug: string
  codePrefix: string
  category: "group_packages" | "custom_packages" | "both"
  defaultCommissionMode: "included_in_flyer" | "net_plus_markup"
  defaultCommissionPkr: number
  contactPerson?: string | null
  whatsappNumber?: string | null
  phone?: string | null
  notes?: string | null
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface SupplierFlyerPackageRecord {
  id: string
  flyerId: string
  supplierId: string
  cardNumber: string
  postCode: string
  sheetIndex?: number | null
  outboundFlightNo: string
  outboundDateLabel: string
  outboundRoute: string
  outboundDepTime: string
  outboundArrTime: string
  returnFlightNo: string
  returnDateLabel: string
  returnRoute: string
  returnDepTime: string
  returnArrTime: string
  makkahNights: string
  makkahHotelName: string
  makkahDistanceLabel: string
  madinahNights: string
  madinahHotelName: string
  madinahDistanceLabel: string
  mealPlanLabel?: string | null
  rawSharingPkr: number
  rawQuadPkr: number
  rawTriplePkr: number
  rawDoublePkr: number
  netSharingPkr: number
  netQuadPkr: number
  netTriplePkr: number
  netDoublePkr: number
  retailSharingPkr: number
  retailQuadPkr: number
  retailTriplePkr: number
  retailDoublePkr: number
  commissionPkr: number
  spotlightPosterUrl?: string | null
  spotlightPdfUrl?: string | null
  publishedGroupPackageId?: string | null
  publishedGroupDepartureId?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface SupplierFlyerRecord {
  id: string
  flyerCode?: string | null
  supplierId: string
  title: string
  rawFlyerImageUrl: string
  airlineName: string
  airlineIataCode?: string | null
  airlineLogoUrl?: string | null
  durationDays: number
  daysTitle: string
  routePill: string
  departureCityCode?: string | null
  arrivalAirportCode?: string | null
  returnAirportCode?: string | null
  outboundBaggage?: string | null
  inboundBaggage?: string | null
  giftedInclusions: string[]
  commissionMode: "included_in_flyer" | "net_plus_markup"
  commissionPkr: number
  receivedDate: string
  multiSheetImageUrl?: string | null
  multiSheetPdfUrl?: string | null
  socialReadySheetJpegUrl?: string | null
  ingestionSource?: string | null
  extractionStatus?: string | null
  extractedCardsCount?: number | null
  status: string
  notes?: string | null
  createdByUserId?: string | null
  createdAt?: Date
  updatedAt?: Date
  supplier: SupplierRecord
  packages: SupplierFlyerPackageRecord[]
}

export interface PostAssetRecord {
  id: string
  postCode: string
  kind: "multi_package_sheet" | "single_package_spotlight" | "custom_quotation"
  title: string
  supplierId: string
  flyerId: string
  flyerPackageId?: string | null
  imageUrl: string
  pdfUrl?: string | null
  captionWhatsapp?: string | null
  captionInstagram?: string | null
  searchableText?: string | null
  createdAt?: Date
  supplier?: {
    name: string
    codePrefix: string
  } | null
  flyer?: {
    title: string
    airlineName: string
    daysTitle: string
    routePill: string
    socialReadySheetJpegUrl?: string | null
  } | null
  flyerPackage?: SupplierFlyerPackageRecord | null
}

export interface StudioHubClientProps {
  initialTab?: string
  todayPktIso?: string
  suppliers: SupplierRecord[]
  supplierFlyers: SupplierFlyerRecord[]
  postAssets: PostAssetRecord[]
  groupPackages: PackageWithRelations[]
  airlines: { id: string; name: string; iataCode: string }[]
  hotels: StudioHotelOption[]
  departureCities: { id: string; cityName: string; airportCode: string }[]
}

export type StudioTabKey = "packages" | "studio" | "vault"

const VALID_STUDIO_TABS: readonly StudioTabKey[] = [
  "packages",
  "studio",
  "vault",
]

/**
 * Direct-to-R2 upload utility using presigned URLs to bypass Vercel 4.5MB serverless body limits.
 */
async function uploadFileDirectToR2(
  file: File,
  folder: string,
  onProgress?: (percent: number, statusText: string) => void
): Promise<{ publicUrl: string; key: string }> {
  onProgress?.(15, "Authorizing direct storage upload signature...")
  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      folder,
      sizeBytes: file.size,
    }),
  })

  if (!presignRes.ok) {
    const errorJson = (await presignRes.json().catch(() => ({}))) as {
      error?: string
    }
    throw new Error(
      errorJson.error ||
        `Upload authorization failed (HTTP ${presignRes.status})`
    )
  }

  const { uploadUrl, publicUrl, key } = (await presignRes.json()) as {
    uploadUrl: string
    publicUrl: string
    key: string
  }

  onProgress?.(
    45,
    "Streaming file directly to Cloudflare R2 (zero 4.5MB limit)..."
  )

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  })

  if (!putRes.ok) {
    throw new Error(
      `Direct R2 upload failed (HTTP ${putRes.status}: ${putRes.statusText})`
    )
  }

  onProgress?.(100, "File uploaded to storage!")
  return { publicUrl, key }
}

export function StudioHubClient({
  initialTab = "packages",
  todayPktIso = "2026-11-24",
  suppliers: initialSuppliers,
  supplierFlyers: initialFlyers,
  postAssets: initialAssets,
  groupPackages,
  airlines,
  hotels,
  departureCities,
}: StudioHubClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeTab: StudioTabKey = React.useMemo(() => {
    const urlTab = searchParams.get("tab") as StudioTabKey | null
    if (urlTab && VALID_STUDIO_TABS.includes(urlTab)) {
      return urlTab
    }
    if (initialTab && VALID_STUDIO_TABS.includes(initialTab as StudioTabKey)) {
      return initialTab as StudioTabKey
    }
    return "packages"
  }, [searchParams, initialTab])

  const [packageBuilderOpen, setPackageBuilderOpen] = React.useState(false)
  const [builderEditingPackage, setBuilderEditingPackage] =
    React.useState<PackageWithRelations | null>(null)

  const switchTab = React.useCallback(
    (tab: StudioTabKey) => {
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set("tab", tab)
      router.push(`${pathname}?${nextParams.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const [suppliersList, setSuppliersList] =
    React.useState<SupplierRecord[]>(initialSuppliers)
  const [flyersList, setFlyersList] =
    React.useState<SupplierFlyerRecord[]>(initialFlyers)
  const [assetsList, setAssetsList] =
    React.useState<PostAssetRecord[]>(initialAssets)

  const [prevInitialFlyers, setPrevInitialFlyers] =
    React.useState(initialFlyers)
  if (prevInitialFlyers !== initialFlyers) {
    setPrevInitialFlyers(initialFlyers)
    setFlyersList(initialFlyers)
  }
  const [prevInitialAssets, setPrevInitialAssets] =
    React.useState(initialAssets)
  if (prevInitialAssets !== initialAssets) {
    setPrevInitialAssets(initialAssets)
    setAssetsList(initialAssets)
  }
  const [prevInitialSuppliers, setPrevInitialSuppliers] =
    React.useState(initialSuppliers)
  if (prevInitialSuppliers !== initialSuppliers) {
    setPrevInitialSuppliers(initialSuppliers)
    setSuppliersList(initialSuppliers)
  }

  const [notice, setNotice] = React.useState<{
    type: "success" | "error" | "info"
    text: string
  } | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)

  // ----------------------------------------------------------------------
  // REALTIME RUN TELEMETRY STATE (TRIGGER.DEV V4 + LOCAL FALLBACK)
  // ----------------------------------------------------------------------
  const [activeRealtimeRun, setActiveRealtimeRun] = React.useState<{
    runId: string
    publicAccessToken?: string | null
    tokenMode: "cloud" | "local"
    taskKind: "extract_packages" | "render_gotenberg" | "studio_pipeline"
    title: string
    isActive: boolean
    localProgress: Partial<TaskProgressMetadata>
  } | null>(null)

  const syncRunTokenIfAvailable = React.useCallback(async (runId: string) => {
    try {
      const tokenRes = await mintRealtimeRunPublicTokenAction(runId)
      if (tokenRes.success) {
        setActiveRealtimeRun((prev) =>
          prev
            ? {
                ...prev,
                runId,
                publicAccessToken:
                  tokenRes.publicAccessToken ?? tokenRes.token ?? null,
                tokenMode: tokenRes.mode === "cloud" ? "cloud" : "local",
                localProgress: tokenRes.snapshot ?? prev.localProgress,
              }
            : null
        )
      }
    } catch {
      // Safe fallback to local polling
    }
  }, [])

  // ----------------------------------------------------------------------
  // MODAL: ADD NEW SUPPLIER
  // ----------------------------------------------------------------------
  const [isSupplierModalOpen, setIsSupplierModalOpen] = React.useState(false)
  const [newSupName, setNewSupName] = React.useState("")
  const [newSupCodePrefix, setNewSupCodePrefix] = React.useState("")
  const [newSupCategory, setNewSupCategory] = React.useState<
    "group_packages" | "custom_packages" | "both"
  >("group_packages")
  const [newSupCommMode, setNewSupCommMode] = React.useState<
    "included_in_flyer" | "net_plus_markup"
  >("included_in_flyer")
  const [newSupCommPkr, setNewSupCommPkr] = React.useState(22000)
  const [newSupWhatsapp, setNewSupWhatsapp] = React.useState("")
  const [newSupContact, setNewSupContact] = React.useState("")
  const [newSupSaving, setNewSupSaving] = React.useState(false)

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSupName.trim() || !newSupCodePrefix.trim()) {
      setNotice({
        type: "error",
        text: "Supplier name and uppercase code prefix (e.g. AM, UP, ZH) are required.",
      })
      return
    }

    setNewSupSaving(true)
    try {
      const slug = newSupName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")

      const res = await upsertSupplier({
        name: newSupName.trim(),
        slug,
        codePrefix: newSupCodePrefix.trim().toUpperCase(),
        category: newSupCategory,
        defaultCommissionMode: newSupCommMode,
        defaultCommissionPkr: newSupCommPkr,
        whatsappNumber: newSupWhatsapp.trim() || null,
        contactPerson: newSupContact.trim() || null,
        isActive: true,
      })

      if (res.success && res.supplier) {
        const created = res.supplier as SupplierRecord
        const nextSuppliers = [...suppliersList, created]
        setSuppliersList(nextSuppliers)
        setSelectedSupplierId(created.id)
        applySupplierDefaults(created.id, ingestionMode, nextSuppliers)
        setIsSupplierModalOpen(false)
        setNewSupName("")
        setNewSupCodePrefix("")
        setNewSupWhatsapp("")
        setNewSupContact("")
        setNotice({
          type: "success",
          text: `Supplier "${created.name}" (${created.codePrefix}) registered successfully!`,
        })
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to register supplier.",
        })
      }
    } finally {
      setNewSupSaving(false)
    }
  }

  // ----------------------------------------------------------------------
  // TAB 1: 4K POSTER & RAW SUPPLIER FLYER INGESTION WORKBENCH STATE
  // ----------------------------------------------------------------------
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>(
    initialSuppliers[0]?.id || ""
  )
  const [ingestionMode, setIngestionMode] = React.useState<
    "gemini_ultra_poster" | "raw_supplier_flyer"
  >("gemini_ultra_poster")
  const [commissionMode, setCommissionMode] = React.useState<
    "included_in_flyer" | "net_plus_markup"
  >(initialSuppliers[0]?.defaultCommissionMode || "included_in_flyer")
  const [commissionPkr, setCommissionPkr] = React.useState<number>(22000)
  const [usePerTierMarkup, setUsePerTierMarkup] = React.useState<boolean>(false)
  const [perTierMarkup, setPerTierMarkup] = React.useState<{
    sharing: number
    quad: number
    triple: number
    double: number
  }>({
    sharing: 22000,
    quad: 22000,
    triple: 25000,
    double: 28000,
  })
  const [departureCityCode, setDepartureCityCode] =
    React.useState<string>("LHE")

  const [posterFile, setPosterFile] = React.useState<File | null>(null)
  const [posterDirectUrl, setPosterDirectUrl] = React.useState<string>("")
  const [uploadProgress, setUploadProgress] = React.useState<number>(0)
  const [uploadStatus, setUploadStatus] = React.useState<string>("")

  const applySupplierDefaults = (
    supplierId: string,
    mode: "gemini_ultra_poster" | "raw_supplier_flyer",
    list: SupplierRecord[] = suppliersList
  ) => {
    const s = list.find((sup) => sup.id === supplierId)
    if (!s) return
    const defComm = s.defaultCommissionPkr || 22000
    setCommissionPkr(defComm)
    setPerTierMarkup({
      sharing: defComm,
      quad: defComm,
      triple: defComm,
      double: defComm,
    })
    if (mode === "raw_supplier_flyer") {
      setCommissionMode(s.defaultCommissionMode || "net_plus_markup")
    } else {
      setCommissionMode("included_in_flyer")
    }
  }

  // ----------------------------------------------------------------------
  // HANDLERS: FINISHED 4K POSTER INGESTION & 4K GOTENBERG RENDERS
  // ----------------------------------------------------------------------
  const handleIngestPoster = async () => {
    if (!selectedSupplierId) {
      setNotice({ type: "error", text: "Please select a wholesale supplier." })
      return
    }

    const syntheticRunId = `local_extract_${Date.now()}`
    setBusyKey("ingest_poster")
    setNotice(null)
    setUploadProgress(5)
    setUploadStatus("Preparing finished poster ingestion...")

    setActiveRealtimeRun({
      runId: syntheticRunId,
      tokenMode: "local",
      taskKind: "extract_packages",
      title: "Multimodal AI Extraction & 1080p Social JPEG Pipeline",
      isActive: true,
      localProgress: {
        stage: "initializing",
        progress: 10,
        detail: "Preparing finished 4K poster ingestion pipeline...",
        updatedAt: new Date().toISOString(),
      },
    })

    try {
      let finalMediaUrl = posterDirectUrl.trim()

      if (posterFile) {
        const uploadResult = await uploadFileDirectToR2(
          posterFile,
          "posters/finished",
          (pct, text) => {
            setUploadProgress(pct)
            setUploadStatus(text)
            setActiveRealtimeRun((prev) =>
              prev
                ? {
                    ...prev,
                    localProgress: {
                      stage: pct < 45 ? "initializing" : "uploading_r2",
                      progress: Math.min(
                        35,
                        Math.max(12, Math.round(pct * 0.35))
                      ),
                      detail: text,
                      updatedAt: new Date().toISOString(),
                    },
                  }
                : null
            )
          }
        )
        finalMediaUrl = uploadResult.publicUrl
      }

      if (!finalMediaUrl) {
        setNotice({
          type: "error",
          text: "Please provide a 4K poster image/PDF file or direct URL.",
        })
        setActiveRealtimeRun(null)
        return
      }

      setUploadStatus(
        "Invoking Gemini Ultra Multimodal AI extraction & 1080p social optimizer..."
      )
      setActiveRealtimeRun((prev) =>
        prev
          ? {
              ...prev,
              localProgress: {
                stage: "extracting_ai",
                progress: 45,
                detail:
                  "Running Gemini Ultra multimodal AI package extraction & 1080×1520 social JPEG normalization...",
                updatedAt: new Date().toISOString(),
              },
            }
          : null
      )

      const effectiveCommMode =
        ingestionMode === "gemini_ultra_poster"
          ? "included_in_flyer"
          : commissionMode

      const res = await ingestFinishedPosterOrFlyerAction({
        supplierId: selectedSupplierId,
        mediaUrl: finalMediaUrl,
        ingestionMode,
        commissionMode: effectiveCommMode,
        commissionPkr,
        perTierMarkupPkr:
          effectiveCommMode === "net_plus_markup" && usePerTierMarkup
            ? perTierMarkup
            : undefined,
        departureCityCode,
      })

      const returnedRunId = (res as { runId?: string }).runId || syntheticRunId
      void syncRunTokenIfAvailable(returnedRunId)

      if (res.success) {
        const createdFlyer = res.flyer as SupplierFlyerRecord | undefined
        setActiveRealtimeRun((prev) =>
          prev
            ? {
                ...prev,
                runId: returnedRunId,
                isActive: false,
                localProgress: {
                  stage: "completed",
                  progress: 100,
                  detail: `Extracted ${res.packagesCount} package cards and normalized 1080p social JPEG`,
                  extractedCount: res.packagesCount,
                  pngUrl: createdFlyer?.multiSheetImageUrl ?? finalMediaUrl,
                  socialJpegUrl:
                    createdFlyer?.socialReadySheetJpegUrl ?? undefined,
                  updatedAt: new Date().toISOString(),
                },
              }
            : null
        )
        setNotice({
          type: "success",
          text: `Successfully ingested 4K poster! Preserved 4K asset, generated 1080p social JPEG, and extracted ${res.packagesCount} package cards.`,
        })
        setPosterFile(null)
        setPosterDirectUrl("")
        setUploadProgress(0)
        setUploadStatus("")
        router.refresh()
        switchTab("vault")
      } else {
        const errMsg = res.error || "Failed to ingest finished poster."
        setActiveRealtimeRun((prev) =>
          prev
            ? {
                ...prev,
                isActive: false,
                localProgress: {
                  stage: "failed",
                  progress: 100,
                  detail: errMsg,
                  error: errMsg,
                  updatedAt: new Date().toISOString(),
                },
              }
            : null
        )
        setNotice({
          type: "error",
          text: errMsg,
        })
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Ingestion failed."
      setActiveRealtimeRun((prev) =>
        prev
          ? {
              ...prev,
              isActive: false,
              localProgress: {
                stage: "failed",
                progress: 100,
                detail: errMsg,
                error: errMsg,
                updatedAt: new Date().toISOString(),
              },
            }
          : null
      )
      setNotice({
        type: "error",
        text: errMsg,
      })
    } finally {
      setBusyKey(null)
    }
  }

  const handleGenerateMultiSheet = async (
    flyerId: string,
    flyerTitle: string
  ) => {
    const syntheticRunId = `local_render_sheet_${flyerId}_${Date.now()}`
    setBusyKey(`render-sheet-${flyerId}`)
    setNotice(null)

    setActiveRealtimeRun({
      runId: syntheticRunId,
      tokenMode: "local",
      taskKind: "render_gotenberg",
      title: `4K Multi-Package Sheet Render · ${flyerTitle}`,
      isActive: true,
      localProgress: {
        stage: "rendering_gotenberg",
        progress: 55,
        detail: `Rendering 4K Multi-Package Sheet & Vector PDF via Gotenberg queue for "${flyerTitle}"...`,
        updatedAt: new Date().toISOString(),
      },
    })

    try {
      const res = await generateMultiPackageSheetForFlyer(flyerId)
      const returnedRunId = (res as { runId?: string }).runId || syntheticRunId
      void syncRunTokenIfAvailable(returnedRunId)

      if (res.success && res.pngUrl) {
        setFlyersList((prev) =>
          prev.map((f) =>
            f.id === flyerId
              ? {
                  ...f,
                  multiSheetImageUrl: res.pngUrl,
                  multiSheetPdfUrl: res.pdfUrl ?? f.multiSheetPdfUrl,
                }
              : f
          )
        )
        setActiveRealtimeRun((prev) =>
          prev
            ? {
                ...prev,
                runId: returnedRunId,
                isActive: false,
                localProgress: {
                  stage: "completed",
                  progress: 100,
                  detail: `Rendered 4K Multi-Package Sheet [${res.postCode}] and uploaded to Cloudflare R2`,
                  pngUrl: res.pngUrl,
                  pdfUrl: res.pdfUrl ?? undefined,
                  updatedAt: new Date().toISOString(),
                },
              }
            : null
        )
        setNotice({
          type: "success",
          text: `4K Multi-Package Sheet [${res.postCode}] rendered and uploaded to Cloudflare R2!`,
        })
        router.refresh()
      } else {
        const errMsg = res.error || "Failed to generate 4K Multi-Package Sheet."
        setActiveRealtimeRun((prev) =>
          prev
            ? {
                ...prev,
                isActive: false,
                localProgress: {
                  stage: "failed",
                  progress: 100,
                  detail: errMsg,
                  error: errMsg,
                  updatedAt: new Date().toISOString(),
                },
              }
            : null
        )
        setNotice({
          type: "error",
          text: errMsg,
        })
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "Failed to generate 4K Multi-Package Sheet."
      setActiveRealtimeRun((prev) =>
        prev
          ? {
              ...prev,
              isActive: false,
              localProgress: {
                stage: "failed",
                progress: 100,
                detail: errMsg,
                error: errMsg,
                updatedAt: new Date().toISOString(),
              },
            }
          : null
      )
      setNotice({
        type: "error",
        text: errMsg,
      })
    } finally {
      setBusyKey(null)
    }
  }

  const handleGenerateSpotlight = async (pkgId: string, postCode: string) => {
    const syntheticRunId = `local_render_spot_${pkgId}_${Date.now()}`
    setBusyKey(`render-spot-${pkgId}`)
    setNotice(null)

    setActiveRealtimeRun({
      runId: syntheticRunId,
      tokenMode: "local",
      taskKind: "render_gotenberg",
      title: `4K Spotlight Poster Render · ${postCode}`,
      isActive: true,
      localProgress: {
        stage: "rendering_gotenberg",
        progress: 55,
        detail: `Rendering 4K Single-Package Spotlight Poster [${postCode}] via Gotenberg queue...`,
        updatedAt: new Date().toISOString(),
      },
    })

    try {
      const res = await generateSingleSpotlightForCard(pkgId)
      const returnedRunId = (res as { runId?: string }).runId || syntheticRunId
      void syncRunTokenIfAvailable(returnedRunId)

      if (res.success && res.pngUrl) {
        setFlyersList((prev) =>
          prev.map((flyer) => ({
            ...flyer,
            packages: flyer.packages.map((card) =>
              card.id === pkgId
                ? {
                    ...card,
                    spotlightPosterUrl: res.pngUrl,
                    spotlightPdfUrl: res.pdfUrl ?? card.spotlightPdfUrl,
                  }
                : card
            ),
          }))
        )
        setActiveRealtimeRun((prev) =>
          prev
            ? {
                ...prev,
                runId: returnedRunId,
                isActive: false,
                localProgress: {
                  stage: "completed",
                  progress: 100,
                  detail: `Rendered 4K Spotlight Poster [${res.postCode}] and uploaded to Cloudflare R2`,
                  pngUrl: res.pngUrl,
                  pdfUrl: res.pdfUrl ?? undefined,
                  updatedAt: new Date().toISOString(),
                },
              }
            : null
        )
        setNotice({
          type: "success",
          text: `4K Spotlight Poster [${res.postCode}] rendered and synced across Vault & Campaigns!`,
        })
        router.refresh()
      } else {
        const errMsg = res.error || "Failed to render 4K Spotlight Poster."
        setActiveRealtimeRun((prev) =>
          prev
            ? {
                ...prev,
                isActive: false,
                localProgress: {
                  stage: "failed",
                  progress: 100,
                  detail: errMsg,
                  error: errMsg,
                  updatedAt: new Date().toISOString(),
                },
              }
            : null
        )
        setNotice({
          type: "error",
          text: errMsg,
        })
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "Failed to render 4K Spotlight Poster."
      setActiveRealtimeRun((prev) =>
        prev
          ? {
              ...prev,
              isActive: false,
              localProgress: {
                stage: "failed",
                progress: 100,
                detail: errMsg,
                error: errMsg,
                updatedAt: new Date().toISOString(),
              },
            }
          : null
      )
      setNotice({
        type: "error",
        text: errMsg,
      })
    } finally {
      setBusyKey(null)
    }
  }

  // ----------------------------------------------------------------------
  // TAB 2: VAULT ACTIONS & MODALS (QUICK EDIT CARD & DELETE BATCH)
  // ----------------------------------------------------------------------
  const [vaultSearch, setVaultSearch] = React.useState("")
  const [vaultSupplierFilter, setVaultSupplierFilter] = React.useState("all")
  const [vaultViewMode, setVaultViewMode] = React.useState<
    "flyers_cards" | "assets_gallery"
  >("flyers_cards")
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)

  // Quick Edit Modal State
  const [editingCard, setEditingCard] =
    React.useState<SupplierFlyerPackageRecord | null>(null)
  const [editForm, setEditForm] = React.useState<{
    makkahHotelName: string
    makkahNights: string
    makkahDistanceLabel: string
    madinahHotelName: string
    madinahNights: string
    madinahDistanceLabel: string
    mealPlanLabel: string
    outboundFlightNo: string
    outboundDateLabel: string
    outboundRoute: string
    outboundDepTime: string
    outboundArrTime: string
    returnFlightNo: string
    returnDateLabel: string
    returnRoute: string
    returnDepTime: string
    returnArrTime: string
    commissionPkr: number
    rawSharingPkr: number
    rawQuadPkr: number
    rawTriplePkr: number
    rawDoublePkr: number
    spotlightPosterUrl: string
  }>({
    makkahHotelName: "",
    makkahNights: "15N",
    makkahDistanceLabel: "(600M)",
    madinahHotelName: "",
    madinahNights: "05N",
    madinahDistanceLabel: "(400M)",
    mealPlanLabel: "Room Only",
    outboundFlightNo: "",
    outboundDateLabel: "",
    outboundRoute: "",
    outboundDepTime: "",
    outboundArrTime: "",
    returnFlightNo: "",
    returnDateLabel: "",
    returnRoute: "",
    returnDepTime: "",
    returnArrTime: "",
    commissionPkr: 22000,
    rawSharingPkr: 0,
    rawQuadPkr: 0,
    rawTriplePkr: 0,
    rawDoublePkr: 0,
    spotlightPosterUrl: "",
  })

  // Delete Flyer Batch State
  const [deletingFlyer, setDeletingFlyer] =
    React.useState<SupplierFlyerRecord | null>(null)

  // Dedicated Package Spotlight Image Modal State
  const [imageModalCard, setImageModalCard] = React.useState<{
    cardId: string
    postCode: string
    currentImageUrl: string
    title: string
  } | null>(null)
  const [imageModalUrlInput, setImageModalUrlInput] = React.useState("")
  const [imageModalUploading, setImageModalUploading] = React.useState(false)
  const [imageModalProgress, setImageModalProgress] = React.useState<
    string | null
  >(null)
  const imageModalFileInputRef = React.useRef<HTMLInputElement | null>(null)

  const [editCardImageUploading, setEditCardImageUploading] =
    React.useState(false)
  const editCardFileInputRef = React.useRef<HTMLInputElement | null>(null)

  const copyToClipboard = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(identifier)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  const openEditCardDialog = (card: SupplierFlyerPackageRecord) => {
    setEditingCard(card)
    setEditForm({
      makkahHotelName: card.makkahHotelName,
      makkahNights: card.makkahNights,
      makkahDistanceLabel: card.makkahDistanceLabel,
      madinahHotelName: card.madinahHotelName,
      madinahNights: card.madinahNights,
      madinahDistanceLabel: card.madinahDistanceLabel,
      mealPlanLabel: card.mealPlanLabel || "Room Only",
      outboundFlightNo: card.outboundFlightNo,
      outboundDateLabel: card.outboundDateLabel,
      outboundRoute: card.outboundRoute,
      outboundDepTime: card.outboundDepTime,
      outboundArrTime: card.outboundArrTime,
      returnFlightNo: card.returnFlightNo,
      returnDateLabel: card.returnDateLabel,
      returnRoute: card.returnRoute,
      returnDepTime: card.returnDepTime,
      returnArrTime: card.returnArrTime,
      commissionPkr: card.commissionPkr,
      rawSharingPkr: card.rawSharingPkr,
      rawQuadPkr: card.rawQuadPkr,
      rawTriplePkr: card.rawTriplePkr,
      rawDoublePkr: card.rawDoublePkr,
      spotlightPosterUrl: card.spotlightPosterUrl || "",
    })
  }

  const handleSavePackageSpotlightImage = async (
    cardId: string,
    imageUrlToSave: string
  ) => {
    if (!imageUrlToSave.trim()) {
      setNotice({ type: "error", text: "Please enter or upload an image." })
      return
    }
    setImageModalUploading(true)
    try {
      const res = await updatePackageSpotlightImageAction({
        cardId,
        imageUrl: imageUrlToSave.trim(),
      })
      if (res.success) {
        setFlyersList((prev) =>
          prev.map((flyer) => ({
            ...flyer,
            packages: flyer.packages.map((card) =>
              card.id === cardId
                ? { ...card, spotlightPosterUrl: imageUrlToSave.trim() }
                : card
            ),
          }))
        )
        setAssetsList((prev) =>
          prev.map((asset) =>
            asset.flyerPackageId === cardId || asset.postCode === res.postCode
              ? { ...asset, imageUrl: imageUrlToSave.trim() }
              : asset
          )
        )
        setNotice({
          type: "success",
          text: `Custom dedicated image updated for package [${res.postCode}] and synced across 4K Social Gallery, Campaigns, and Website!`,
        })
        setImageModalCard(null)
        setImageModalUrlInput("")
        setImageModalProgress(null)
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to update package image.",
        })
      }
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to update package image.",
      })
    } finally {
      setImageModalUploading(false)
    }
  }

  const handleImageModalFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file || !imageModalCard) return
    setImageModalUploading(true)
    try {
      const { publicUrl } = await uploadFileDirectToR2(
        file,
        "posters/spotlights",
        (_percent, statusText) => setImageModalProgress(statusText)
      )
      setImageModalUrlInput(publicUrl)
      await handleSavePackageSpotlightImage(imageModalCard.cardId, publicUrl)
    } catch (err) {
      setNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to upload package image.",
      })
      setImageModalUploading(false)
    } finally {
      if (imageModalFileInputRef.current)
        imageModalFileInputRef.current.value = ""
    }
  }

  const handleEditCardImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setEditCardImageUploading(true)
    try {
      const { publicUrl } = await uploadFileDirectToR2(
        file,
        "posters/spotlights",
        () => {}
      )
      setEditForm((prev) => ({ ...prev, spotlightPosterUrl: publicUrl }))
    } catch (err) {
      setNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to upload package image.",
      })
    } finally {
      setEditCardImageUploading(false)
      if (editCardFileInputRef.current) editCardFileInputRef.current.value = ""
    }
  }

  const handleSaveCardEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCard) return
    setBusyKey("saving_edit_card")
    setNotice(null)
    try {
      const res = await updateExtractedFlyerCardAction({
        id: editingCard.id,
        ...editForm,
      })
      if (res.success && res.package) {
        const updatedPkg = res.package as SupplierFlyerPackageRecord
        setFlyersList((prev) =>
          prev.map((flyer) => ({
            ...flyer,
            packages: flyer.packages.map((card) =>
              card.id === updatedPkg.id ? { ...card, ...updatedPkg } : card
            ),
          }))
        )
        if (updatedPkg.spotlightPosterUrl) {
          setAssetsList((prev) =>
            prev.map((asset) =>
              asset.flyerPackageId === updatedPkg.id ||
              asset.postCode === updatedPkg.postCode
                ? { ...asset, imageUrl: updatedPkg.spotlightPosterUrl! }
                : asset
            )
          )
        }
        setNotice({
          type: "success",
          text: `Package card [${editingCard.postCode}] updated successfully! Supplier net costs and retail tariffs recalculated.`,
        })
        setEditingCard(null)
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to update package card.",
        })
      }
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text:
          err instanceof Error ? err.message : "Failed to update package card.",
      })
    } finally {
      setBusyKey(null)
    }
  }

  const handleDeleteFlyerBatch = async () => {
    if (!deletingFlyer) return
    setBusyKey(`del-flyer-${deletingFlyer.id}`)
    setNotice(null)
    try {
      const res = await deleteSupplierFlyerAction({ flyerId: deletingFlyer.id })
      if (res.success) {
        if (res.archivedInsteadOfDeleted) {
          setFlyersList((prev) =>
            prev.map((f) =>
              f.id === deletingFlyer.id ? { ...f, status: "archived" } : f
            )
          )
          setNotice({
            type: "info",
            text: `Flyer batch "${deletingFlyer.title}" has ${res.activeApplicationsCount || 1} active customer booking(s) and was safely Soft-Archived (bookings preserved, public packages unpublished).`,
          })
        } else {
          setFlyersList((prev) => prev.filter((f) => f.id !== deletingFlyer.id))
          setAssetsList((prev) =>
            prev.filter((a) => a.flyerId !== deletingFlyer.id)
          )
          setNotice({
            type: "success",
            text: `Flyer batch "${deletingFlyer.title}" and associated assets deleted successfully.`,
          })
        }
        setDeletingFlyer(null)
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to delete flyer batch.",
        })
      }
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text:
          err instanceof Error ? err.message : "Failed to delete flyer batch.",
      })
    } finally {
      setBusyKey(null)
    }
  }

  const handlePublishToWebsite = async (pkgId: string, postCode: string) => {
    setBusyKey(`pub-${pkgId}`)
    setNotice(null)
    try {
      const res = await publishFlyerCardToPublicGroupPackages(pkgId)
      if (res.success) {
        setFlyersList((prev) =>
          prev.map((flyer) => ({
            ...flyer,
            packages: flyer.packages.map((card) =>
              card.id === pkgId
                ? {
                    ...card,
                    publishedGroupPackageId:
                      res.groupPackageId ||
                      card.publishedGroupPackageId ||
                      "optimistic-published",
                    publishedGroupDepartureId:
                      res.groupDepartureId || card.publishedGroupDepartureId,
                  }
                : card
            ),
          }))
        )
        setNotice({
          type: "success",
          text: `Package [${postCode}] published live to Website Group Packages & Departures with real ISO dates!`,
        })
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to publish package.",
        })
      }
    } finally {
      setBusyKey(null)
    }
  }

  const handlePublishAllToWebsite = async (
    flyerId: string,
    flyerTitle: string
  ) => {
    setBusyKey(`pub-all-${flyerId}`)
    setNotice(null)
    try {
      const res = await publishAllFlyerCardsToPublicGroupPackagesAction({
        flyerId,
      })
      if (res.success && res.updatedCards) {
        const cardMap = new Map(res.updatedCards.map((c) => [c.cardId, c]))
        setFlyersList((prev) =>
          prev.map((flyer) =>
            flyer.id === flyerId
              ? {
                  ...flyer,
                  packages: flyer.packages.map((card) => {
                    const updated = cardMap.get(card.id)
                    if (updated) {
                      return {
                        ...card,
                        publishedGroupPackageId: updated.groupPackageId,
                        publishedGroupDepartureId: updated.groupDepartureId,
                      }
                    }
                    return card
                  }),
                }
              : flyer
          )
        )
        setNotice({
          type: "success",
          text: `Successfully synced all ${res.publishedCount} cards from "${flyerTitle}" to public website group packages!`,
        })
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to publish all cards.",
        })
      }
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to publish all cards to website.",
      })
    } finally {
      setBusyKey(null)
    }
  }

  const handleApproveDraftFlyer = async (
    flyerId: string,
    flyerTitle: string
  ) => {
    setBusyKey(`approve-draft-${flyerId}`)
    setNotice(null)
    try {
      const res = await approveStagedSupplierFlyerAction({ flyerId })
      if (res.success && res.flyer) {
        const nextStatus = res.flyer.status
        setFlyersList((prev) =>
          prev.map((f) => (f.id === flyerId ? { ...f, status: nextStatus } : f))
        )
        setNotice({
          type: "success",
          text: `Approved B2B extraction draft "${flyerTitle}"! You can now render 4K posters and publish cards to the public website.`,
        })
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to approve draft flyer.",
        })
      }
    } finally {
      setBusyKey(null)
    }
  }

  const handleUnpublishFromWebsite = async (
    pkgId: string,
    postCode: string
  ) => {
    setBusyKey(`unpub-${pkgId}`)
    setNotice(null)
    try {
      const res = await unpublishFlyerCardFromPublicAction({
        packageItemId: pkgId,
      })
      if (res.success) {
        setNotice({
          type: "info",
          text: `Package [${postCode}] unpublished from live website (historical booking references safely preserved).`,
        })
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to unpublish package card.",
        })
      }
    } finally {
      setBusyKey(null)
    }
  }
  const filteredFlyers = React.useMemo(() => {
    return flyersList.filter((flyer) => {
      const matchesSupplier =
        vaultSupplierFilter === "all" ||
        flyer.supplierId === vaultSupplierFilter

      const q = vaultSearch.toLowerCase().trim()
      if (!q) return matchesSupplier

      const matchesSearch =
        flyer.title.toLowerCase().includes(q) ||
        flyer.airlineName.toLowerCase().includes(q) ||
        flyer.supplier?.name.toLowerCase().includes(q) ||
        flyer.supplier?.codePrefix.toLowerCase().includes(q) ||
        flyer.packages.some(
          (p) =>
            p.postCode.toLowerCase().includes(q) ||
            p.makkahHotelName.toLowerCase().includes(q) ||
            p.madinahHotelName.toLowerCase().includes(q) ||
            p.outboundDateLabel.toLowerCase().includes(q)
        )

      return matchesSupplier && matchesSearch
    })
  }, [flyersList, vaultSupplierFilter, vaultSearch])

  // Filtered assets in Vault
  const filteredAssets = React.useMemo(() => {
    return assetsList.filter((asset) => {
      const matchesSupplier =
        vaultSupplierFilter === "all" ||
        asset.supplierId === vaultSupplierFilter

      const q = vaultSearch.toLowerCase().trim()
      if (!q) return matchesSupplier

      return (
        asset.postCode.toLowerCase().includes(q) ||
        asset.title.toLowerCase().includes(q) ||
        asset.searchableText?.toLowerCase().includes(q) ||
        asset.supplier?.name.toLowerCase().includes(q)
      )
    })
  }, [assetsList, vaultSupplierFilter, vaultSearch])

  const totalCardsCount = React.useMemo(() => {
    return flyersList.reduce((acc, f) => acc + (f.packages?.length || 0), 0)
  }, [flyersList])

  return (
    <div className="flex flex-col gap-6">
      {/* ==================================================================== */}
      {/* OPERATE WORKSPACE HEADER & TOP TABS                                  */}
      {/* ==================================================================== */}
      <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Umrah Packages &amp; Studio
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Build fixed-departure Umrah packages, schedule multi-city batches,
            and extract 4K promotional posters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "packages" && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setBuilderEditingPackage(null)
                setPackageBuilderOpen(true)
              }}
              className="cursor-pointer gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Create Package &amp; Batches</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSupplierModalOpen(true)}
            className="cursor-pointer gap-1.5 border-border bg-card text-xs font-semibold text-foreground hover:border-gold-border hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
          >
            <Building2 className="size-3.5 text-gold-text" aria-hidden="true" />
            <span>+ Add B2B Supplier</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            render={<Link href="/admin/campaigns?tab=social" />}
            nativeButton={false}
            className="cursor-pointer gap-1.5 border-border bg-card text-xs font-semibold text-foreground hover:border-gold-border hover:bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
          >
            <Share2 className="size-3.5 text-gold-text" aria-hidden="true" />
            <span>Campaigns Hub</span>
          </Button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* URL-SYNCED 3-TAB SEGMENTED TOOLBAR                                   */}
      {/* ==================================================================== */}
      <div
        role="tablist"
        aria-label="Studio workspace views"
        className="flex flex-wrap items-center gap-2 border-b border-border pb-3"
      >
        <Button
          type="button"
          role="tab"
          aria-selected={activeTab === "packages"}
          variant={activeTab === "packages" ? "default" : "outline"}
          onClick={() => switchTab("packages")}
          className={cn(
            "cursor-pointer gap-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
            activeTab === "packages"
              ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
              : "border-border hover:border-gold-border"
          )}
        >
          <Globe className="size-3.5 text-gold" aria-hidden="true" />
          <span>1. Umrah Packages &amp; Batches</span>
          <Badge
            variant="secondary"
            className={cn(
              "ml-0.5 px-1.5 py-0 text-[11px] font-semibold",
              activeTab === "packages"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-secondary text-foreground"
            )}
          >
            <span className="font-mono tabular-nums">
              {groupPackages.length}
            </span>
          </Badge>
        </Button>

        <Button
          type="button"
          role="tab"
          aria-selected={activeTab === "studio"}
          variant={activeTab === "studio" ? "default" : "outline"}
          onClick={() => switchTab("studio")}
          className={cn(
            "cursor-pointer gap-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
            activeTab === "studio"
              ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
              : "border-border hover:border-gold-border"
          )}
        >
          <Sparkles className="size-3.5 text-gold" aria-hidden="true" />
          <span>2. AI Flyer &amp; Poster Importer</span>
        </Button>

        <Button
          type="button"
          role="tab"
          aria-selected={activeTab === "vault"}
          variant={activeTab === "vault" ? "default" : "outline"}
          onClick={() => switchTab("vault")}
          className={cn(
            "cursor-pointer gap-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
            activeTab === "vault"
              ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
              : "border-border hover:border-gold-border"
          )}
        >
          <Layers className="size-3.5 text-gold" aria-hidden="true" />
          <span>3. Internal 4K Poster Vault</span>
          <Badge
            variant="secondary"
            className={cn(
              "ml-0.5 px-1.5 py-0 text-[11px] font-semibold",
              activeTab === "vault"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-secondary text-foreground"
            )}
          >
            <span className="font-mono tabular-nums">{flyersList.length}</span>
          </Badge>
        </Button>
      </div>

      {/* Operational Notice Banner */}
      {notice && (
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border p-3.5 text-xs font-medium shadow-xs transition-colors motion-reduce:transition-none",
            notice.type === "error"
              ? "border-status-danger-border bg-status-danger-bg text-status-danger"
              : notice.type === "info"
                ? "border-status-info-border bg-status-info-bg text-status-info"
                : "border-status-success-border bg-status-success-bg text-status-success"
          )}
        >
          <div className="flex items-center gap-2">
            {notice.type === "error" ? (
              <AlertCircle
                className="size-4 shrink-0 text-status-danger"
                aria-hidden="true"
              />
            ) : notice.type === "info" ? (
              <AlertCircle
                className="size-4 shrink-0 text-status-info"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="size-4 shrink-0 text-status-success"
                aria-hidden="true"
              />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-4 cursor-pointer text-[11px] font-semibold underline hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Trigger.dev v4 Realtime Task Progress Banner */}
      {activeRealtimeRun && (
        <StudioRealtimeRunBanner
          runId={activeRealtimeRun.runId}
          publicAccessToken={activeRealtimeRun.publicAccessToken}
          tokenMode={activeRealtimeRun.tokenMode}
          taskKind={activeRealtimeRun.taskKind}
          title={activeRealtimeRun.title}
          isActive={activeRealtimeRun.isActive}
          localProgress={activeRealtimeRun.localProgress}
          onComplete={() => {
            router.refresh()
          }}
          onDismiss={() => setActiveRealtimeRun(null)}
        />
      )}

      {/* ==================================================================== */}
      {/* TAB 1: FINISHED 4K POSTER / PDF INGESTION STUDIO                     */}
      {/* ==================================================================== */}
      {activeTab === "studio" && (
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border bg-secondary/30 pb-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                    <Sparkles
                      className="size-4 text-gold-text"
                      aria-hidden="true"
                    />
                    <span>
                      Finished 4K Poster / Vector PDF Ingestion Studio
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Zero re-rendering: Preserves your master 4K artwork
                    byte-for-byte, generates progressive sRGB 1080p social
                    preview, and indexes all package cards for reverse search.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="self-start border-gold-border bg-accent/40 text-xs font-medium text-primary sm:self-auto"
                >
                  Direct-to-R2 Streaming Enabled
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
              {/* Mode A vs Mode B Selector */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setIngestionMode("gemini_ultra_poster")
                    applySupplierDefaults(
                      selectedSupplierId,
                      "gemini_ultra_poster"
                    )
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                    ingestionMode === "gemini_ultra_poster"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background hover:border-gold-border"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="size-4 shrink-0 text-gold-text"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold text-foreground">
                      {STUDIO_MODE_A_LABEL}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Finished retail artwork: extracted rates are Retail PKR (Net
                    = Retail minus Commission).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIngestionMode("raw_supplier_flyer")
                    applySupplierDefaults(
                      selectedSupplierId,
                      "raw_supplier_flyer"
                    )
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
                    ingestionMode === "raw_supplier_flyer"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background hover:border-gold-border"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Wand2
                      className="size-4 shrink-0 text-gold-text"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold text-foreground">
                      {STUDIO_MODE_B_LABEL}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Stages in Draft Review: wraps wholesale net rates (+ flat or
                    per-tier markup) into 4K Al Ramlah posters.
                  </p>
                </button>
              </div>

              {/* Configuration Row: Supplier & Commission & City */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="studio-wholesale-supplier"
                    className="text-xs font-semibold"
                  >
                    1. Wholesale Supplier
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <select
                      id="studio-wholesale-supplier"
                      value={selectedSupplierId}
                      onChange={(e) => {
                        setSelectedSupplierId(e.target.value)
                        applySupplierDefaults(e.target.value, ingestionMode)
                      }}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {suppliersList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.codePrefix})
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setIsSupplierModalOpen(true)}
                      title="Add New Supplier"
                      aria-label="Add New Supplier"
                      className="shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="studio-commission-pkr"
                      className="text-xs font-semibold"
                    >
                      2.{" "}
                      {ingestionMode === "raw_supplier_flyer" &&
                      commissionMode === "net_plus_markup"
                        ? "Markup per Seat (PKR)"
                        : "Commission Margin per Seat (PKR)"}
                    </Label>
                    {ingestionMode === "raw_supplier_flyer" && (
                      <select
                        id="studio-commission-mode"
                        aria-label="Commission Strategy Mode"
                        value={commissionMode}
                        onChange={(e) =>
                          setCommissionMode(
                            e.target.value as
                              "included_in_flyer" | "net_plus_markup"
                          )
                        }
                        className="rounded border border-gold-border bg-accent/40 px-1.5 py-0.5 text-[11px] font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <option value="net_plus_markup">Net + Markup</option>
                        <option value="included_in_flyer">
                          Comm. Included
                        </option>
                      </select>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="studio-commission-pkr"
                      type="number"
                      min={0}
                      value={commissionPkr}
                      onChange={(e) =>
                        setCommissionPkr(Number(e.target.value) || 0)
                      }
                      className="h-9 font-mono text-xs font-bold"
                    />
                    <span className="absolute top-2 right-3 text-[11px] font-semibold text-muted-foreground">
                      {ingestionMode === "raw_supplier_flyer" &&
                      commissionMode === "net_plus_markup"
                        ? "Mode B: +Markup"
                        : "Mode A: Included"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {ingestionMode === "raw_supplier_flyer" &&
                    commissionMode === "net_plus_markup"
                      ? "Added onto non-zero wholesale net tiers (0 stays On Request)."
                      : "Deducted internally to calculate net payable to supplier."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="studio-departure-city"
                    className="text-xs font-semibold"
                  >
                    3. Origin Departure City
                  </Label>
                  <select
                    id="studio-departure-city"
                    value={departureCityCode}
                    onChange={(e) => setDepartureCityCode(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {departureCities.map((c) => (
                      <option key={c.id} value={c.airportCode}>
                        {c.cityName} ({c.airportCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Per-Tier Markup Editor for Mode B (`T-026` / `OD-09b`) */}
              {ingestionMode === "raw_supplier_flyer" &&
                commissionMode === "net_plus_markup" && (
                  <div className="space-y-2.5 rounded-xl bg-accent/25 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">
                        Mode B Markup Strategy (0 PKR tiers remain &ldquo;On
                        Request&rdquo;)
                      </span>
                      <label
                        htmlFor="studio-use-per-tier-markup"
                        className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold"
                      >
                        <input
                          id="studio-use-per-tier-markup"
                          type="checkbox"
                          checked={usePerTierMarkup}
                          onChange={(e) =>
                            setUsePerTierMarkup(e.target.checked)
                          }
                          className="accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        />
                        <span>Customize per-room-tier markup</span>
                      </label>
                    </div>
                    {usePerTierMarkup && (
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        {(["sharing", "quad", "triple", "double"] as const).map(
                          (tierKey) => (
                            <div key={tierKey} className="space-y-1">
                              <Label
                                htmlFor={`studio-tier-markup-${tierKey}`}
                                className="text-[11px] font-semibold capitalize"
                              >
                                +{tierKey} Markup (PKR)
                              </Label>
                              <Input
                                id={`studio-tier-markup-${tierKey}`}
                                type="number"
                                min={0}
                                value={perTierMarkup[tierKey]}
                                onChange={(e) =>
                                  setPerTierMarkup((prev) => ({
                                    ...prev,
                                    [tierKey]: Number(e.target.value) || 0,
                                  }))
                                }
                                className="h-8 font-mono text-xs font-bold"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

              {/* Multimodal Dropzone for 4K Poster */}
              <div className="space-y-2">
                <p className="text-xs leading-none font-semibold">
                  4. Master 4K Poster File (PNG, JPEG, WebP, or Vector PDF)
                </p>
                <div className="rounded-xl border-2 border-dashed border-gold-border bg-accent/20 p-6 text-center transition-colors hover:bg-accent/35 motion-reduce:transition-none">
                  <Upload
                    className="mx-auto mb-2 size-8 text-gold-text"
                    aria-hidden="true"
                  />
                  <div className="text-xs font-semibold text-foreground">
                    {posterFile ? (
                      <span className="font-mono font-bold text-status-success">
                        Selected: {posterFile.name} (
                        {(posterFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    ) : (
                      <span>
                        Drag and drop your 4K Ultra Poster, or click to browse
                      </span>
                    )}
                  </div>
                  <p className="mt-1 mb-3 text-[11px] text-muted-foreground">
                    Supports direct-to-R2 upload up to 50MB. Recommended
                    resolution: 3240×4560 px.
                  </p>
                  <label
                    htmlFor="studio-poster-file"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary hover:bg-primary/90"
                  >
                    <FileUp className="size-3.5 text-gold" aria-hidden="true" />
                    <span>
                      {posterFile ? "Change File" : "Select 4K Poster / PDF"}
                    </span>
                    <input
                      id="studio-poster-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) setPosterFile(f)
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>

                {/* Or Enter Direct URL */}
                <div className="flex items-center gap-2 pt-2">
                  <Label
                    htmlFor="studio-poster-direct-url"
                    className="shrink-0 text-[11px] font-semibold text-muted-foreground"
                  >
                    Or Direct Media URL:
                  </Label>
                  <Input
                    id="studio-poster-direct-url"
                    placeholder="https://pub-....r2.dev/posters/finished/..."
                    value={posterDirectUrl}
                    onChange={(e) => setPosterDirectUrl(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Upload Progress Bar */}
              {uploadProgress > 0 && (
                <div className="space-y-1 rounded-lg bg-secondary/50 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Loader2
                        className="size-3.5 animate-spin text-gold-text motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      {uploadStatus}
                    </span>
                    <span className="font-mono font-bold text-primary tabular-nums">
                      {uploadProgress}%
                    </span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Ingest Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  disabled={
                    busyKey === "ingest_poster" ||
                    (!posterFile && !posterDirectUrl.trim())
                  }
                  onClick={handleIngestPoster}
                  className="h-10 cursor-pointer gap-2 bg-primary px-6 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {busyKey === "ingest_poster" ? (
                    <Loader2
                      className="size-4 animate-spin text-gold motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Sparkles className="size-4 text-gold" aria-hidden="true" />
                  )}
                  <span>
                    Ingest 4K Poster &amp; Run AI Multimodal Extraction
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: 4K POSTERS & EXTRACTED CARDS VAULT                            */}
      {/* ==================================================================== */}
      {activeTab === "vault" && (
        <div className="flex flex-col gap-6">
          {/* Vault Top Metrics Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-border bg-card p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Total Ingested Posters
              </span>
              <div className="mt-1 font-mono text-xl font-bold text-primary tabular-nums">
                {flyersList.length}
              </div>
            </Card>
            <Card className="border-border bg-card p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Extracted Package Cards
              </span>
              <div className="mt-1 font-mono text-xl font-bold text-foreground tabular-nums">
                {totalCardsCount}
              </div>
            </Card>
            <Card className="border-border bg-card p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground">
                4K Posters &amp; Assets Vault
              </span>
              <div className="mt-1 font-mono text-xl font-bold text-gold-text tabular-nums">
                {assetsList.length}
              </div>
            </Card>
            <Card className="border-border bg-card p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Live Website Packages
              </span>
              <div className="mt-1 font-mono text-xl font-bold text-status-success tabular-nums">
                {groupPackages.length}
              </div>
            </Card>
          </div>

          {/* Search, Filter & View Mode Controls */}
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative max-w-sm min-w-[240px] flex-1">
                <Search
                  className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="studio-vault-search"
                  aria-label="Filter by Post Ref, Hotel, Airline, or Date"
                  placeholder="Filter by Post Ref (ART-…), Hotel, Airline, Date…"
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  className="h-9 pl-8 text-xs"
                />
              </div>

              <select
                id="studio-vault-supplier-filter"
                aria-label="Filter by Wholesale Supplier"
                value={vaultSupplierFilter}
                onChange={(e) => setVaultSupplierFilter(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="all">
                  All Suppliers ({suppliersList.length})
                </option>
                {suppliersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.codePrefix})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <Button
                type="button"
                size="sm"
                variant={
                  vaultViewMode === "flyers_cards" ? "default" : "outline"
                }
                onClick={() => setVaultViewMode("flyers_cards")}
                className="cursor-pointer gap-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Layers className="size-3.5" aria-hidden="true" />
                <span>Poster Batches &amp; Cards</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant={
                  vaultViewMode === "assets_gallery" ? "default" : "outline"
                }
                onClick={() => setVaultViewMode("assets_gallery")}
                className="cursor-pointer gap-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <ImageIcon className="size-3.5" aria-hidden="true" />
                <span>4K Social Gallery ({assetsList.length})</span>
              </Button>
            </div>
          </div>

          {/* VIEW 1: POSTER BATCHES & EXTRACTED CARDS */}
          {vaultViewMode === "flyers_cards" && (
            <div className="flex flex-col gap-6">
              {filteredFlyers.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <Sparkles
                      className="mx-auto mb-2 size-8 text-gold-text"
                      aria-hidden="true"
                    />
                    <h3 className="font-display text-base font-bold text-foreground">
                      No Poster Batches Found
                    </h3>
                    <p className="mt-1 mb-4 text-xs text-muted-foreground">
                      {vaultSearch || vaultSupplierFilter !== "all"
                        ? "Try clearing your search query or supplier filter."
                        : "No 4K posters ingested yet. Switch to Tab 1 to drop your first 4K poster or PDF."}
                    </p>
                    <Button
                      type="button"
                      onClick={() => switchTab("studio")}
                      className="cursor-pointer gap-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      <span>Upload First 4K Poster</span>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredFlyers.map((flyer) => {
                  const sheetAsset = assetsList.find(
                    (a) =>
                      a.flyerId === flyer.id && a.kind === "multi_package_sheet"
                  )
                  const totalFlyerCards = flyer.packages?.length || 0
                  const publishedFlyerCardsCount =
                    flyer.packages?.filter((p) =>
                      Boolean(p.publishedGroupPackageId)
                    ).length || 0
                  const allCardsPublished =
                    totalFlyerCards > 0 &&
                    publishedFlyerCardsCount === totalFlyerCards

                  return (
                    <Card
                      key={flyer.id}
                      className="overflow-hidden border-border bg-card shadow-sm"
                    >
                      {/* Flyer Card Header */}
                      <CardHeader className="border-b border-border bg-secondary/30 pb-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <Badge className="bg-primary text-[11px] font-bold text-gold">
                                Supplier: {flyer.supplier?.name} (
                                {flyer.supplier?.codePrefix})
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-gold-border bg-accent/40 font-mono text-xs font-bold text-foreground"
                              >
                                {flyer.airlineName} · {flyer.daysTitle} (
                                {flyer.routePill})
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-status-success-border bg-status-success-bg text-[11px] font-semibold text-status-success"
                              >
                                {flyer.commissionMode === "net_plus_markup"
                                  ? `Mode B: Net + Markup (PKR ${flyer.commissionPkr.toLocaleString()})`
                                  : `Mode A: Comm Included (PKR ${flyer.commissionPkr.toLocaleString()})`}
                              </Badge>
                              {flyer.status === "draft_extracted" && (
                                <Badge className="border border-status-warning-border bg-status-warning-bg text-[11px] font-bold text-status-warning">
                                  Draft Review Required
                                </Badge>
                              )}
                              {flyer.status === "archived" && (
                                <Badge className="border border-border bg-muted text-[11px] font-bold text-muted-foreground">
                                  Archived (Bookings Protected)
                                </Badge>
                              )}
                              {flyer.ingestionSource && (
                                <Badge
                                  variant="secondary"
                                  className="font-mono text-[11px] capitalize"
                                >
                                  {flyer.ingestionSource.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="font-display text-lg font-bold text-foreground">
                              {flyer.title}
                            </CardTitle>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                              <span>Received: {flyer.receivedDate}</span>
                              <span>
                                {flyer.packages?.length || 0} Package Cards
                              </span>
                              <span>
                                Baggage: {flyer.outboundBaggage || "Unstated"}{" "}
                                Out / {flyer.inboundBaggage || "Unstated"} In
                              </span>
                            </div>
                          </div>

                          {/* Master Assets & Batch Actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            {flyer.status === "draft_extracted" && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={
                                  busyKey === `approve-draft-${flyer.id}`
                                }
                                onClick={() =>
                                  handleApproveDraftFlyer(flyer.id, flyer.title)
                                }
                                className="cursor-pointer gap-1.5 bg-gold text-xs font-bold text-gold-foreground shadow-xs hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                {busyKey === `approve-draft-${flyer.id}` ? (
                                  <Loader2
                                    className="size-3.5 animate-spin motion-reduce:animate-none"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <CheckCircle2
                                    className="size-3.5 text-primary"
                                    aria-hidden="true"
                                  />
                                )}
                                <span>Approve Draft</span>
                              </Button>
                            )}

                            {/* 1-Click Bulk Publish All Cards to Website */}
                            {totalFlyerCards > 0 &&
                              flyer.status !== "archived" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={
                                    busyKey === `pub-all-${flyer.id}` ||
                                    flyer.status === "draft_extracted"
                                  }
                                  onClick={() =>
                                    handlePublishAllToWebsite(
                                      flyer.id,
                                      flyer.title
                                    )
                                  }
                                  className={cn(
                                    "cursor-pointer gap-1.5 text-xs font-bold shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                                    allCardsPublished
                                      ? "border border-status-success-border bg-status-success-bg text-status-success hover:bg-status-success-bg/80"
                                      : "border border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                                  )}
                                >
                                  {busyKey === `pub-all-${flyer.id}` ? (
                                    <Loader2
                                      className="size-3.5 animate-spin motion-reduce:animate-none"
                                      aria-hidden="true"
                                    />
                                  ) : allCardsPublished ? (
                                    <CheckCircle2
                                      className="size-3.5 text-status-success"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Globe
                                      className="size-3.5 text-gold"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span>
                                    {busyKey === `pub-all-${flyer.id}`
                                      ? "Syncing All Cards…"
                                      : allCardsPublished
                                        ? `All ${totalFlyerCards} Synced to Web`
                                        : publishedFlyerCardsCount > 0
                                          ? `Publish Remaining ${totalFlyerCards - publishedFlyerCardsCount} Cards to Web`
                                          : `Publish All ${totalFlyerCards} Cards to Web`}
                                  </span>
                                </Button>
                              )}

                            <a
                              href={
                                flyer.multiSheetImageUrl ||
                                flyer.rawFlyerImageUrl
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <ImageIcon
                                className="size-3.5 text-muted-foreground"
                                aria-hidden="true"
                              />
                              <span>View 4K Poster</span>
                            </a>

                            {flyer.socialReadySheetJpegUrl && (
                              <a
                                href={flyer.socialReadySheetJpegUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-status-success-border bg-status-success-bg px-2.5 py-1.5 text-xs font-bold text-status-success hover:bg-status-success-bg/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <span>1080p Social JPEG</span>
                                <ExternalLink
                                  className="size-3"
                                  aria-hidden="true"
                                />
                              </a>
                            )}

                            {flyer.multiSheetPdfUrl && (
                              <a
                                href={flyer.multiSheetPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <FileText
                                  className="size-3.5 text-gold-text"
                                  aria-hidden="true"
                                />
                                <span>Vector PDF</span>
                              </a>
                            )}

                            {sheetAsset && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  router.push(
                                    `/admin/campaigns?tab=social&assetId=${sheetAsset.id}`
                                  )
                                }
                                className="cursor-pointer gap-1 border-gold-border text-xs font-semibold text-foreground hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <Share2
                                  className="size-3.5 text-gold-text"
                                  aria-hidden="true"
                                />
                                <span>Schedule</span>
                              </Button>
                            )}

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busyKey === `render-sheet-${flyer.id}`}
                              onClick={() =>
                                handleGenerateMultiSheet(flyer.id, flyer.title)
                              }
                              className="cursor-pointer gap-1.5 border-gold-border bg-secondary text-xs font-semibold text-primary hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              title="Render 4K Multi-Package Sheet & Vector PDF via Gotenberg queue"
                            >
                              {busyKey === `render-sheet-${flyer.id}` ? (
                                <Loader2
                                  className="size-3.5 animate-spin text-gold-text motion-reduce:animate-none"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Sparkles
                                  className="size-3.5 text-gold-text"
                                  aria-hidden="true"
                                />
                              )}
                              <span>Render 4K Sheet</span>
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingFlyer(flyer)}
                              className="ml-auto cursor-pointer gap-1.5 border-status-danger-border text-xs font-semibold text-status-danger hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <Trash2
                                className="size-3.5 text-status-danger"
                                aria-hidden="true"
                              />
                              <span>Delete Poster Batch</span>
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      {/* Package Cards Table */}
                      <CardContent className="p-4">
                        <div
                          tabIndex={0}
                          className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border text-left text-xs font-bold text-muted-foreground">
                                <th className="py-2.5 pr-3">Post Ref Code</th>
                                <th className="py-2.5 pr-3">Flight Schedule</th>
                                <th className="py-2.5 pr-3">
                                  Makkah &amp; Madinah Hotels
                                </th>
                                <th className="py-2.5 pr-3 text-right">
                                  Supplier Net (Sharing)
                                </th>
                                <th className="py-2.5 pr-3 text-right">
                                  Al Ramlah Retail (S / Q / T / D)
                                </th>
                                <th className="py-2.5 text-right">
                                  Card Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {flyer.packages.map((pkg) => {
                                const matchingAsset = assetsList.find(
                                  (a) =>
                                    a.flyerPackageId === pkg.id ||
                                    a.postCode === pkg.postCode
                                )

                                return (
                                  <tr
                                    key={pkg.id}
                                    className="transition-colors hover:bg-secondary/20 motion-reduce:transition-none"
                                  >
                                    {/* Post Code & Identifier */}
                                    <td className="py-3 pr-3 align-top">
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 font-mono text-xs font-bold text-gold">
                                          {pkg.postCode}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            copyToClipboard(
                                              pkg.postCode,
                                              pkg.id
                                            )
                                          }
                                          className="cursor-pointer p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                          title="Copy Post Code"
                                          aria-label={`Copy Post Code ${pkg.postCode}`}
                                        >
                                          {copiedCode === pkg.id ? (
                                            <Check
                                              className="size-3 text-status-success"
                                              aria-hidden="true"
                                            />
                                          ) : (
                                            <Copy
                                              className="size-3"
                                              aria-hidden="true"
                                            />
                                          )}
                                        </button>
                                      </div>
                                      <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                                        Card #{pkg.cardNumber} · Margin: PKR{" "}
                                        {pkg.commissionPkr.toLocaleString()}
                                      </div>
                                    </td>

                                    {/* Flight Schedule */}
                                    <td className="py-3 pr-3 align-top">
                                      <div className="font-mono font-bold text-foreground">
                                        {pkg.outboundFlightNo} (
                                        {pkg.outboundDateLabel})
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        {pkg.outboundRoute} ·{" "}
                                        {pkg.outboundDepTime}-
                                        {pkg.outboundArrTime}
                                      </div>
                                      <div className="mt-1 font-mono font-semibold text-foreground">
                                        {pkg.returnFlightNo} (
                                        {pkg.returnDateLabel})
                                      </div>
                                    </td>

                                    {/* Hotels & Distance */}
                                    <td className="py-3 pr-3 align-top">
                                      <div>
                                        <span className="font-bold text-primary">
                                          Makkah ({pkg.makkahNights}):
                                        </span>{" "}
                                        <span className="font-semibold">
                                          {pkg.makkahHotelName}
                                        </span>{" "}
                                        <span className="text-muted-foreground">
                                          {pkg.makkahDistanceLabel}
                                        </span>
                                      </div>
                                      <div className="mt-0.5">
                                        <span className="font-bold text-status-success">
                                          Madinah ({pkg.madinahNights}):
                                        </span>{" "}
                                        <span className="font-semibold">
                                          {pkg.madinahHotelName}
                                        </span>{" "}
                                        <span className="text-muted-foreground">
                                          {pkg.madinahDistanceLabel}
                                        </span>
                                      </div>
                                      <div className="mt-1">
                                        <Badge
                                          variant="outline"
                                          className="border-gold-border px-1.5 py-0 text-[11px] text-muted-foreground"
                                        >
                                          {pkg.mealPlanLabel || "Room Only"}
                                        </Badge>
                                      </div>
                                    </td>

                                    {/* Supplier Net Price */}
                                    <td className="py-3 pr-3 text-right align-top tabular-nums">
                                      <div className="text-muted-foreground">
                                        <span>PKR </span>
                                        <span className="font-mono">
                                          {pkg.netSharingPkr.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="text-[11px] font-semibold text-status-success">
                                        <span>+PKR </span>
                                        <span className="font-mono">
                                          {pkg.commissionPkr.toLocaleString()}
                                        </span>{" "}
                                        <span>Comm.</span>
                                      </div>
                                    </td>

                                    {/* Al Ramlah Retail Price */}
                                    <td className="py-3 pr-3 text-right align-top tabular-nums">
                                      <div className="text-sm font-bold text-primary">
                                        <span>S: </span>
                                        <span className="font-mono">
                                          {formatStudioPkrTier(
                                            pkg.retailSharingPkr
                                          )}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-foreground">
                                        <span>Q: </span>
                                        <span className="font-mono">
                                          {formatStudioPkrTier(
                                            pkg.retailQuadPkr
                                          )}
                                        </span>{" "}
                                        <span>| T: </span>
                                        <span className="font-mono">
                                          {formatStudioPkrTier(
                                            pkg.retailTriplePkr
                                          )}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        <span>D: </span>
                                        <span className="font-mono">
                                          {formatStudioPkrTier(
                                            pkg.retailDoublePkr
                                          )}
                                        </span>
                                      </div>
                                    </td>

                                    {/* Actions */}
                                    <td className="py-3 text-right align-top">
                                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                                        {/* Quick Edit Card */}
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            openEditCardDialog(pkg)
                                          }
                                          className="h-7 cursor-pointer gap-1 border-border px-2 text-[11px] font-semibold hover:border-gold hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                          title="Quick Edit Card details, hotels or prices"
                                        >
                                          <Pencil
                                            className="size-3 text-gold-text"
                                            aria-hidden="true"
                                          />
                                          <span>Edit Card</span>
                                        </Button>

                                        {/* Render 4K Spotlight Poster */}
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={
                                            busyKey === `render-spot-${pkg.id}`
                                          }
                                          onClick={() =>
                                            handleGenerateSpotlight(
                                              pkg.id,
                                              pkg.postCode
                                            )
                                          }
                                          className="h-7 cursor-pointer gap-1 border-gold-border bg-secondary px-2 text-[11px] font-semibold text-primary hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                          title="Render 4K Single-Package Spotlight Poster via Gotenberg queue"
                                        >
                                          {busyKey ===
                                          `render-spot-${pkg.id}` ? (
                                            <Loader2
                                              className="size-3 animate-spin text-gold-text motion-reduce:animate-none"
                                              aria-hidden="true"
                                            />
                                          ) : (
                                            <Sparkles
                                              className="size-3 text-gold-text"
                                              aria-hidden="true"
                                            />
                                          )}
                                          <span>Render 4K</span>
                                        </Button>

                                        {/* Preview Poster */}
                                        {(pkg.spotlightPosterUrl ||
                                          flyer.multiSheetImageUrl ||
                                          flyer.rawFlyerImageUrl) && (
                                          <a
                                            href={
                                              pkg.spotlightPosterUrl ||
                                              flyer.multiSheetImageUrl ||
                                              flyer.rawFlyerImageUrl
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-gold hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                          >
                                            <span>4K Poster</span>
                                            <ExternalLink
                                              className="size-2.5"
                                              aria-hidden="true"
                                            />
                                          </a>
                                        )}

                                        {/* Publish to Website */}
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={busyKey === `pub-${pkg.id}`}
                                          onClick={() =>
                                            handlePublishToWebsite(
                                              pkg.id,
                                              pkg.postCode
                                            )
                                          }
                                          className={cn(
                                            "h-7 cursor-pointer px-2 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                                            pkg.publishedGroupPackageId
                                              ? "border-status-success-border bg-status-success-bg text-status-success"
                                              : "border-gold-border bg-accent/40 text-foreground hover:bg-accent/60"
                                          )}
                                        >
                                          {busyKey === `pub-${pkg.id}` ? (
                                            <Loader2
                                              className="size-3 animate-spin motion-reduce:animate-none"
                                              aria-hidden="true"
                                            />
                                          ) : pkg.publishedGroupPackageId ? (
                                            <CheckCircle2
                                              className="size-3 text-status-success"
                                              aria-hidden="true"
                                            />
                                          ) : (
                                            <Globe
                                              className="size-3 text-gold-text"
                                              aria-hidden="true"
                                            />
                                          )}
                                          <span>
                                            {pkg.publishedGroupPackageId
                                              ? "Synced to Web"
                                              : "1-Click Publish"}
                                          </span>
                                        </Button>

                                        {pkg.publishedGroupPackageId && (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            disabled={
                                              busyKey === `unpub-${pkg.id}`
                                            }
                                            onClick={() =>
                                              handleUnpublishFromWebsite(
                                                pkg.id,
                                                pkg.postCode
                                              )
                                            }
                                            className="h-7 cursor-pointer px-2 text-[11px] font-semibold text-status-warning hover:bg-status-warning-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                            title="Unpublish from live website without breaking bookings"
                                          >
                                            <span>Unpublish</span>
                                          </Button>
                                        )}

                                        {/* Schedule Campaign */}
                                        {matchingAsset && (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                              router.push(
                                                `/admin/campaigns?tab=social&assetId=${matchingAsset.id}`
                                              )
                                            }
                                            className="h-7 cursor-pointer gap-1 px-2 text-[11px] font-semibold text-primary hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                            title="Schedule in Campaigns Studio"
                                          >
                                            <Share2
                                              className="size-3 text-gold-text"
                                              aria-hidden="true"
                                            />
                                            <span>Schedule</span>
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          )}

          {/* VIEW 2: ALL 4K SOCIAL ASSETS GALLERY */}
          {vaultViewMode === "assets_gallery" && (
            <div className="flex flex-col gap-6">
              {filteredAssets.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <ImageIcon
                      className="mx-auto mb-2 size-8 text-gold-text"
                      aria-hidden="true"
                    />
                    <h3 className="font-display text-base font-bold text-foreground">
                      No 4K Posters or Assets in Vault
                    </h3>
                    <p className="mt-1 mb-4 text-xs text-muted-foreground">
                      Ingest finished 4K posters from Tab 1 to populate this
                      vault.
                    </p>
                    <Button
                      type="button"
                      onClick={() => setVaultViewMode("flyers_cards")}
                      className="cursor-pointer gap-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Layers className="size-3.5" aria-hidden="true" />
                      <span>Back to Poster Batches</span>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredAssets.map((asset) => {
                    const linkedCard = flyersList
                      .flatMap((f) => f.packages)
                      .find(
                        (p) =>
                          p.id === asset.flyerPackageId ||
                          p.postCode === asset.postCode
                      )

                    return (
                      <Card
                        key={asset.id}
                        className="flex flex-col justify-between overflow-hidden border-border bg-card shadow-sm transition-colors hover:border-gold-border motion-reduce:transition-none"
                      >
                        <div>
                          {/* Thumbnail Container */}
                          <div className="relative aspect-[3/4] w-full overflow-hidden border-b border-border bg-secondary/50">
                            <StudioAssetPreviewMedia
                              url={asset.imageUrl}
                              alt={asset.title}
                              size="card"
                            />
                            <div className="absolute top-2 left-2 flex items-center gap-1.5">
                              <span className="rounded-md bg-primary px-2 py-0.5 font-mono text-[11px] font-bold text-gold shadow-sm">
                                {asset.postCode}
                              </span>
                              <Badge
                                variant="secondary"
                                className="bg-card text-[10px] font-bold text-foreground"
                              >
                                {asset.kind === "multi_package_sheet"
                                  ? "Master Poster"
                                  : "Spotlight"}
                              </Badge>
                            </div>

                            {/* Top Right Change Image Button */}
                            {linkedCard && (
                              <div className="absolute top-2 right-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setImageModalCard({
                                      cardId: linkedCard.id,
                                      postCode: linkedCard.postCode,
                                      currentImageUrl: asset.imageUrl,
                                      title: asset.title,
                                    })
                                    setImageModalUrlInput(
                                      linkedCard.spotlightPosterUrl || ""
                                    )
                                  }}
                                  className="h-6 cursor-pointer gap-1 border border-gold/40 bg-primary px-2 text-[11px] font-bold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                                  title="Change dedicated image for this package"
                                >
                                  <Camera
                                    className="size-3 text-gold"
                                    aria-hidden="true"
                                  />
                                  <span>Change Image</span>
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="space-y-2 p-4">
                            <h4 className="line-clamp-1 font-display text-sm font-bold text-foreground">
                              {asset.title}
                            </h4>
                            <p className="text-[11px] text-muted-foreground">
                              Supplier:{" "}
                              {asset.supplier?.name || "B2B Wholesale"} ·
                              Created:{" "}
                              {asset.createdAt
                                ? new Date(asset.createdAt).toLocaleDateString()
                                : "Active"}
                            </p>
                          </div>
                        </div>

                        {/* Action Pills Footer */}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-secondary/15 p-4 pt-3">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={asset.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-gold hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <span>4K PNG</span>
                              <ExternalLink
                                className="size-2.5"
                                aria-hidden="true"
                              />
                            </a>

                            {asset.pdfUrl && (
                              <a
                                href={asset.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <FileText
                                  className="size-2.5 text-gold-text"
                                  aria-hidden="true"
                                />
                                <span>PDF</span>
                              </a>
                            )}

                            {linkedCard && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setImageModalCard({
                                    cardId: linkedCard.id,
                                    postCode: linkedCard.postCode,
                                    currentImageUrl: asset.imageUrl,
                                    title: asset.title,
                                  })
                                  setImageModalUrlInput(
                                    linkedCard.spotlightPosterUrl || ""
                                  )
                                }}
                                className="h-7 cursor-pointer gap-1 border-border px-2 text-[11px] font-semibold hover:border-gold hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                title="Change dedicated package image"
                              >
                                <Camera
                                  className="size-3 text-gold-text"
                                  aria-hidden="true"
                                />
                                <span>Edit Image</span>
                              </Button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {asset.captionWhatsapp && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  copyToClipboard(
                                    asset.captionWhatsapp || "",
                                    asset.id
                                  )
                                }
                                className="h-7 cursor-pointer gap-1 px-2 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                title="Copy WhatsApp Caption"
                              >
                                {copiedCode === asset.id ? (
                                  <Check
                                    className="size-3 text-status-success"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Copy className="size-3" aria-hidden="true" />
                                )}
                                <span>Caption</span>
                              </Button>
                            )}

                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/admin/campaigns?tab=social&assetId=${asset.id}`
                                )
                              }
                              className="h-7 cursor-pointer gap-1 bg-gold px-2.5 text-[11px] font-bold text-gold-foreground shadow-xs hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <Share2 className="size-3" aria-hidden="true" />
                              <span>Schedule</span>
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1 (DEFAULT): UMRAH PACKAGES & BATCHES WORKBENCH                  */}
      {/* ==================================================================== */}
      {activeTab === "packages" && (
        <PackageWorkbenchClient
          initialPackages={groupPackages}
          airlines={airlines}
          hotels={hotels}
          departureCities={departureCities}
          todayPktIso={todayPktIso}
          onSwitchToVault={() => switchTab("vault")}
          onSwitchToStudio={() => switchTab("studio")}
          builderOpen={packageBuilderOpen}
          onBuilderOpenChange={setPackageBuilderOpen}
          editingPackage={builderEditingPackage}
          onEditingPackageChange={setBuilderEditingPackage}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD NEW B2B SUPPLIER (BASE UI RENDER PROP COMPLIANT)          */}
      {/* ==================================================================== */}
      <Dialog open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateSupplier}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <Building2
                  className="size-4 text-gold-text"
                  aria-hidden="true"
                />
                <span>Register New Wholesale Supplier</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Add an authorized B2B wholesale partner (e.g. Ammaar, Upsky
                Travels, Zahoor Travels) for automated flyer wrapping and
                deterministic Post Codes.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label
                  htmlFor="studio-new-sup-name"
                  className="text-xs font-semibold"
                >
                  Supplier Name *
                </Label>
                <Input
                  id="studio-new-sup-name"
                  required
                  placeholder="e.g. Zahoor Travels"
                  value={newSupName}
                  onChange={(e) => {
                    setNewSupName(e.target.value)
                    if (!newSupCodePrefix) {
                      const words = e.target.value.trim().split(" ")
                      const code = words
                        .map((w) => w[0] || "")
                        .join("")
                        .slice(0, 3)
                        .toUpperCase()
                      setNewSupCodePrefix(code)
                    }
                  }}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="studio-new-sup-prefix"
                  className="text-xs font-semibold"
                >
                  Prefix Code (2-4 Chars) *
                </Label>
                <Input
                  id="studio-new-sup-prefix"
                  required
                  maxLength={4}
                  placeholder="e.g. ZH"
                  value={newSupCodePrefix}
                  onChange={(e) =>
                    setNewSupCodePrefix(e.target.value.toUpperCase())
                  }
                  className="h-9 font-mono text-xs font-bold"
                />
                <p className="text-[11px] text-muted-foreground">
                  Used in ART-&#123;PREFIX&#125; post codes.
                </p>
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="studio-new-sup-category"
                  className="text-xs font-semibold"
                >
                  Inventory Category
                </Label>
                <select
                  id="studio-new-sup-category"
                  value={newSupCategory}
                  onChange={(e) =>
                    setNewSupCategory(
                      e.target.value as
                        "group_packages" | "custom_packages" | "both"
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <option value="group_packages">Group Packages</option>
                  <option value="custom_packages">Custom Packages</option>
                  <option value="both">Both (Group &amp; Custom)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="studio-new-sup-comm-mode"
                  className="text-xs font-semibold"
                >
                  Default Commission Mode
                </Label>
                <select
                  id="studio-new-sup-comm-mode"
                  value={newSupCommMode}
                  onChange={(e) =>
                    setNewSupCommMode(
                      e.target.value as "included_in_flyer" | "net_plus_markup"
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <option value="included_in_flyer">
                    Mode A: Included in Flyer
                  </option>
                  <option value="net_plus_markup">Mode B: Net + Markup</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="studio-new-sup-comm-pkr"
                  className="text-xs font-semibold"
                >
                  Default Commission (PKR)
                </Label>
                <Input
                  id="studio-new-sup-comm-pkr"
                  type="number"
                  value={newSupCommPkr}
                  onChange={(e) =>
                    setNewSupCommPkr(Number(e.target.value) || 0)
                  }
                  className="h-9 font-mono text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="studio-new-sup-whatsapp"
                  className="text-xs font-semibold"
                >
                  WhatsApp Desk Number
                </Label>
                <Input
                  id="studio-new-sup-whatsapp"
                  placeholder="+923001234567"
                  value={newSupWhatsapp}
                  onChange={(e) => setNewSupWhatsapp(e.target.value)}
                  className="h-9 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="studio-new-sup-contact"
                  className="text-xs font-semibold"
                >
                  Contact Person
                </Label>
                <Input
                  id="studio-new-sup-contact"
                  placeholder="e.g. Tariq Mehmood"
                  value={newSupContact}
                  onChange={(e) => setNewSupContact(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSupplierModalOpen(false)}
                className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={newSupSaving}
                className="cursor-pointer gap-1.5 bg-primary text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {newSupSaving ? (
                  <Loader2
                    className="size-3.5 animate-spin text-gold motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Check className="size-3.5 text-gold" aria-hidden="true" />
                )}
                <span>Register Supplier</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL: QUICK EDIT EXTRACTED PACKAGE CARD                             */}
      {/* ==================================================================== */}
      <Dialog
        open={!!editingCard}
        onOpenChange={(open) => !open && setEditingCard(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {editingCard && (
            <form onSubmit={handleSaveCardEdit} className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary px-2.5 py-1 font-mono text-xs font-bold text-gold">
                    {editingCard.postCode}
                  </span>
                  <DialogTitle className="font-display text-lg font-bold text-foreground">
                    Quick Edit Card #{editingCard.cardNumber}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs">
                  Update hotel names, room sharing tariffs, flight details, or
                  wholesale commission. Supplier Net is automatically
                  recalculated.
                </DialogDescription>
              </DialogHeader>

              {/* SECTION: ACCOMMODATIONS */}
              <div className="space-y-3 rounded-xl bg-secondary/45 p-4">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Building2
                    className="size-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>Hotel Accommodations &amp; Nights</span>
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label
                      htmlFor="studio-edit-makkah-hotel"
                      className="text-[11px] font-semibold"
                    >
                      Makkah Hotel Name *
                    </Label>
                    <Input
                      id="studio-edit-makkah-hotel"
                      required
                      value={editForm.makkahHotelName}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          makkahHotelName: e.target.value,
                        }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor="studio-edit-makkah-nights"
                        className="text-[11px] font-semibold"
                      >
                        Nights
                      </Label>
                      <Input
                        id="studio-edit-makkah-nights"
                        required
                        value={editForm.makkahNights}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            makkahNights: e.target.value,
                          }))
                        }
                        className="h-8 font-mono text-xs"
                        placeholder="15N"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="studio-edit-makkah-distance"
                        className="text-[11px] font-semibold"
                      >
                        Distance
                      </Label>
                      <Input
                        id="studio-edit-makkah-distance"
                        required
                        value={editForm.makkahDistanceLabel}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            makkahDistanceLabel: e.target.value,
                          }))
                        }
                        className="h-8 text-xs"
                        placeholder="(600M)"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label
                      htmlFor="studio-edit-madinah-hotel"
                      className="text-[11px] font-semibold"
                    >
                      Madinah Hotel Name *
                    </Label>
                    <Input
                      id="studio-edit-madinah-hotel"
                      required
                      value={editForm.madinahHotelName}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          madinahHotelName: e.target.value,
                        }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor="studio-edit-madinah-nights"
                        className="text-[11px] font-semibold"
                      >
                        Nights
                      </Label>
                      <Input
                        id="studio-edit-madinah-nights"
                        required
                        value={editForm.madinahNights}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            madinahNights: e.target.value,
                          }))
                        }
                        className="h-8 font-mono text-xs"
                        placeholder="05N"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="studio-edit-madinah-distance"
                        className="text-[11px] font-semibold"
                      >
                        Distance
                      </Label>
                      <Input
                        id="studio-edit-madinah-distance"
                        required
                        value={editForm.madinahDistanceLabel}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            madinahDistanceLabel: e.target.value,
                          }))
                        }
                        className="h-8 text-xs"
                        placeholder="(400M)"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="studio-edit-meal-plan"
                    className="text-[11px] font-semibold"
                  >
                    Meal Plan
                  </Label>
                  <Input
                    id="studio-edit-meal-plan"
                    value={editForm.mealPlanLabel}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        mealPlanLabel: e.target.value,
                      }))
                    }
                    className="h-8 text-xs"
                    placeholder="Room Only / Breakfast"
                  />
                </div>
              </div>

              {/* SECTION: FLIGHT SCHEDULE */}
              <div className="space-y-3 rounded-xl bg-secondary/45 p-4">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Plane
                    className="size-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>Flight Schedule</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="space-y-1 sm:col-span-1">
                    <Label
                      htmlFor="studio-edit-out-flight"
                      className="text-[11px] font-semibold"
                    >
                      Out Flight No
                    </Label>
                    <Input
                      id="studio-edit-out-flight"
                      required
                      value={editForm.outboundFlightNo}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          outboundFlightNo: e.target.value,
                        }))
                      }
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label
                      htmlFor="studio-edit-out-date"
                      className="text-[11px] font-semibold"
                    >
                      Out Date Label
                    </Label>
                    <Input
                      id="studio-edit-out-date"
                      required
                      value={editForm.outboundDateLabel}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          outboundDateLabel: e.target.value,
                        }))
                      }
                      className="h-8 font-mono text-xs"
                      placeholder="10 NOV"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label
                      htmlFor="studio-edit-out-route"
                      className="text-[11px] font-semibold"
                    >
                      Out Route
                    </Label>
                    <Input
                      id="studio-edit-out-route"
                      required
                      value={editForm.outboundRoute}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          outboundRoute: e.target.value,
                        }))
                      }
                      className="h-8 font-mono text-xs"
                      placeholder="LHE - JED"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label
                      htmlFor="studio-edit-out-dep-time"
                      className="text-[11px] font-semibold"
                    >
                      Dep Time
                    </Label>
                    <Input
                      id="studio-edit-out-dep-time"
                      required
                      value={editForm.outboundDepTime}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          outboundDepTime: e.target.value,
                        }))
                      }
                      className="h-8 font-mono text-xs"
                      placeholder="06:35"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label
                      htmlFor="studio-edit-out-arr-time"
                      className="text-[11px] font-semibold"
                    >
                      Arr Time
                    </Label>
                    <Input
                      id="studio-edit-out-arr-time"
                      required
                      value={editForm.outboundArrTime}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          outboundArrTime: e.target.value,
                        }))
                      }
                      className="h-8 font-mono text-xs"
                      placeholder="10:35"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="space-y-1 sm:col-span-1">
                    <Label
                      htmlFor="studio-edit-ret-flight"
                      className="text-[11px] font-semibold"
                    >
                      Return Flight No
                    </Label>
                    <Input
                      id="studio-edit-ret-flight"
                      required
                      value={editForm.returnFlightNo}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          returnFlightNo: e.target.value,
                        }))
                      }
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label
                      htmlFor="studio-edit-ret-date"
                      className="text-[11px] font-semibold"
                    >
                      Return Date
                    </Label>
                    <Input
                      id="studio-edit-ret-date"
                      required
                      value={editForm.returnDateLabel}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          returnDateLabel: e.target.value,
                        }))
                      }
                      className="h-8 font-mono text-xs"
                      placeholder="01 DEC"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label
                      htmlFor="studio-edit-ret-route"
                      className="text-[11px] font-semibold"
                    >
                      Return Route
                    </Label>
                    <Input
                      id="studio-edit-ret-route"
                      required
                      value={editForm.returnRoute}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          returnRoute: e.target.value,
                        }))
                      }
                      className="h-8 font-mono text-xs"
                      placeholder="JED - LHE"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label
                      htmlFor="studio-edit-ret-dep-time"
                      className="text-[11px] font-semibold"
                    >
                      Dep Time
                    </Label>
                    <Input
                      id="studio-edit-ret-dep-time"
                      required
                      value={editForm.returnDepTime}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          returnDepTime: e.target.value,
                        }))
                      }
                      className="h-8 font-mono text-xs"
                      placeholder="11:35"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label
                      htmlFor="studio-edit-ret-arr-time"
                      className="text-[11px] font-semibold"
                    >
                      Arr Time
                    </Label>
                    <Input
                      id="studio-edit-ret-arr-time"
                      required
                      value={editForm.returnArrTime}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          returnArrTime: e.target.value,
                        }))
                      }
                      className="h-8 font-mono text-xs"
                      placeholder="18:20"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: PRICING & COMMISSION */}
              <div className="space-y-3 rounded-xl bg-accent/25 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Coins
                      className="size-3.5 text-gold-text"
                      aria-hidden="true"
                    />
                    <span>Pricing &amp; Wholesale Commission</span>
                  </h4>
                  <Badge
                    variant="outline"
                    className="border-gold-border bg-accent/50 font-mono text-[11px] font-bold text-primary"
                  >
                    Net = Retail minus Commission
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="space-y-1">
                    <Label
                      htmlFor="studio-edit-sharing-pkr"
                      className="text-[11px] font-semibold"
                    >
                      Sharing (PKR) *
                    </Label>
                    <Input
                      id="studio-edit-sharing-pkr"
                      type="number"
                      required
                      value={editForm.rawSharingPkr}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          rawSharingPkr: Number(e.target.value) || 0,
                        }))
                      }
                      className="h-8 font-mono text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="studio-edit-quad-pkr"
                      className="text-[11px] font-semibold"
                    >
                      Quad (PKR) *
                    </Label>
                    <Input
                      id="studio-edit-quad-pkr"
                      type="number"
                      required
                      value={editForm.rawQuadPkr}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          rawQuadPkr: Number(e.target.value) || 0,
                        }))
                      }
                      className="h-8 font-mono text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="studio-edit-triple-pkr"
                      className="text-[11px] font-semibold"
                    >
                      Triple (PKR) *
                    </Label>
                    <Input
                      id="studio-edit-triple-pkr"
                      type="number"
                      required
                      value={editForm.rawTriplePkr}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          rawTriplePkr: Number(e.target.value) || 0,
                        }))
                      }
                      className="h-8 font-mono text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="studio-edit-double-pkr"
                      className="text-[11px] font-semibold"
                    >
                      Double (PKR) *
                    </Label>
                    <Input
                      id="studio-edit-double-pkr"
                      type="number"
                      required
                      value={editForm.rawDoublePkr}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          rawDoublePkr: Number(e.target.value) || 0,
                        }))
                      }
                      className="h-8 font-mono text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="studio-edit-commission-pkr"
                      className="text-[11px] font-semibold text-status-success"
                    >
                      Commission (PKR) *
                    </Label>
                    <Input
                      id="studio-edit-commission-pkr"
                      type="number"
                      required
                      value={editForm.commissionPkr}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          commissionPkr: Number(e.target.value) || 0,
                        }))
                      }
                      className="h-8 border-status-success-border bg-status-success-bg/60 font-mono text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Calculation Preview Strip */}
                <div className="flex flex-wrap items-center justify-between rounded-lg bg-card/90 p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      Retail Sharing:
                    </span>
                    <span className="font-bold text-primary tabular-nums">
                      <span>PKR </span>
                      <span className="font-mono">
                        {editForm.rawSharingPkr.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      Commission Margin:
                    </span>
                    <span className="font-bold text-status-success tabular-nums">
                      <span>+PKR </span>
                      <span className="font-mono">
                        {editForm.commissionPkr.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      Net Supplier Payable:
                    </span>
                    <span className="font-bold text-foreground tabular-nums">
                      <span>PKR </span>
                      <span className="font-mono">
                        {Math.max(
                          0,
                          editForm.rawSharingPkr - editForm.commissionPkr
                        ).toLocaleString()}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION: PACKAGE SPOTLIGHT / DEDICATED IMAGE */}
              <div className="space-y-3 rounded-xl bg-secondary/45 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Camera
                      className="size-3.5 text-gold-text"
                      aria-hidden="true"
                    />
                    <span>Package Spotlight / Dedicated Image</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <input
                      id="studio-edit-card-image-file"
                      ref={editCardFileInputRef}
                      type="file"
                      accept="image/*"
                      aria-label="Upload dedicated package spotlight image from disk"
                      tabIndex={-1}
                      className="sr-only"
                      onChange={handleEditCardImageUpload}
                      disabled={editCardImageUploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={editCardImageUploading}
                      onClick={() => editCardFileInputRef.current?.click()}
                      className="h-7 cursor-pointer gap-1.5 border-gold-border px-2.5 text-xs font-semibold hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {editCardImageUploading ? (
                        <Loader2
                          className="size-3 animate-spin text-gold-text motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <Upload
                          className="size-3 text-gold-text"
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        {editCardImageUploading
                          ? "Uploading to R2…"
                          : "Upload from Disk"}
                      </span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="studio-edit-spotlight-url"
                    className="text-[11px] font-semibold"
                  >
                    Image URL (Cloudflare R2 or direct link)
                  </Label>
                  <Input
                    id="studio-edit-spotlight-url"
                    value={editForm.spotlightPosterUrl}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        spotlightPosterUrl: e.target.value,
                      }))
                    }
                    className="h-8 font-mono text-xs"
                    placeholder="https://pub-….r2.dev/posters/spotlights/…"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    If left blank, falls back to the master poster image.
                    Uploading or pasting a dedicated image updates this package
                    in 4K Social Gallery, Campaigns, and the Website.
                  </p>
                </div>

                {editForm.spotlightPosterUrl.trim() && (
                  <div className="relative h-32 w-48 overflow-hidden rounded-lg bg-secondary/70">
                    <StudioAssetPreviewMedia
                      url={editForm.spotlightPosterUrl}
                      alt="Dedicated Package Spotlight Preview"
                      size="compact"
                      imageClassName="object-cover object-top"
                    />
                    <span className="absolute right-2 bottom-1 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] text-primary-foreground">
                      Spotlight Preview
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingCard(null)}
                  className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busyKey === "saving_edit_card"}
                  className="cursor-pointer gap-1.5 bg-primary text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {busyKey === "saving_edit_card" ? (
                    <Loader2
                      className="size-3.5 animate-spin text-gold motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Check className="size-3.5 text-gold" aria-hidden="true" />
                  )}
                  <span>Save Card Changes</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL: CHANGE PACKAGE DEDICATED SPOTLIGHT IMAGE                      */}
      {/* ==================================================================== */}
      <Dialog
        open={!!imageModalCard}
        onOpenChange={(open) => {
          if (!open) {
            setImageModalCard(null)
            setImageModalUrlInput("")
            setImageModalProgress(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {imageModalCard && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary px-2.5 py-1 font-mono text-xs font-bold text-gold">
                    {imageModalCard.postCode}
                  </span>
                  <DialogTitle className="font-display text-base font-bold text-foreground">
                    Change Package Image
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs">
                  Upload a dedicated 4K image for {imageModalCard.title}. This
                  will immediately update the 4K Social Gallery, Campaigns
                  Social Scheduler, and the live Website package card!
                </DialogDescription>
              </DialogHeader>

              {/* Current Thumbnail Preview */}
              <div className="flex items-center gap-4 rounded-xl bg-secondary/50 p-3">
                <div className="relative h-24 w-18 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  <StudioAssetPreviewMedia
                    url={
                      imageModalUrlInput.trim() ||
                      imageModalCard.currentImageUrl
                    }
                    alt={imageModalCard.title}
                    size="thumb"
                    imageClassName="object-cover object-top"
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <span className="text-[11px] font-bold text-muted-foreground">
                    Live Preview
                  </span>
                  <p className="line-clamp-1 font-semibold text-foreground">
                    {imageModalCard.title}
                  </p>
                  <p className="text-[11px] font-medium text-status-success">
                    {imageModalUrlInput.trim()
                      ? "New image selected!"
                      : "Currently using current/flyer image"}
                  </p>
                </div>
              </div>

              {/* Upload or URL Inputs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="studio-image-modal-file"
                    className="text-xs font-semibold"
                  >
                    Upload Image File
                  </Label>
                  <input
                    id="studio-image-modal-file"
                    ref={imageModalFileInputRef}
                    type="file"
                    accept="image/*"
                    aria-label="Upload Image File"
                    tabIndex={-1}
                    className="sr-only"
                    onChange={handleImageModalFileUpload}
                    disabled={imageModalUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={imageModalUploading}
                    onClick={() => imageModalFileInputRef.current?.click()}
                    className="h-8 cursor-pointer gap-1.5 border-gold-border bg-accent/35 px-3 text-xs font-semibold hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {imageModalUploading ? (
                      <Loader2
                        className="size-3.5 animate-spin text-gold-text motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <Upload
                        className="size-3.5 text-gold-text"
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {imageModalUploading
                        ? "Uploading to R2…"
                        : "Direct Upload to R2"}
                    </span>
                  </Button>
                </div>

                {imageModalProgress && (
                  <p className="animate-pulse text-[11px] font-medium text-status-warning motion-reduce:animate-none">
                    {imageModalProgress}
                  </p>
                )}

                <div className="space-y-1">
                  <Label
                    htmlFor="studio-image-modal-url"
                    className="text-xs font-semibold"
                  >
                    Or Paste Image URL
                  </Label>
                  <Input
                    id="studio-image-modal-url"
                    value={imageModalUrlInput}
                    onChange={(e) => setImageModalUrlInput(e.target.value)}
                    placeholder="https://pub-….r2.dev/posters/spotlights/…"
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={imageModalUploading}
                  onClick={() => {
                    setImageModalCard(null)
                    setImageModalUrlInput("")
                    setImageModalProgress(null)
                  }}
                  className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={imageModalUploading || !imageModalUrlInput.trim()}
                  onClick={() =>
                    handleSavePackageSpotlightImage(
                      imageModalCard.cardId,
                      imageModalUrlInput
                    )
                  }
                  className="cursor-pointer gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {imageModalUploading ? (
                    <Loader2
                      className="size-3 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2
                      className="size-3 text-gold"
                      aria-hidden="true"
                    />
                  )}
                  <span>Save &amp; Sync Image</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL: CONFIRM DELETE FLYER BATCH                                    */}
      {/* ==================================================================== */}
      <Dialog
        open={!!deletingFlyer}
        onOpenChange={(open) => !open && setDeletingFlyer(null)}
      >
        <DialogContent className="sm:max-w-md">
          {deletingFlyer && (
            <div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display text-lg font-bold text-status-danger">
                  <Trash2
                    className="size-4 text-status-danger"
                    aria-hidden="true"
                  />
                  <span>Delete Poster Batch</span>
                </DialogTitle>
                <DialogDescription className="pt-1 text-xs leading-relaxed">
                  Are you sure you want to permanently delete flyer batch{" "}
                  <strong className="text-foreground">
                    &ldquo;{deletingFlyer.title}&rdquo;
                  </strong>{" "}
                  and all{" "}
                  <strong className="text-foreground">
                    {deletingFlyer.packages?.length || 0} package cards
                  </strong>
                  ? This action will permanently remove all associated 4K social
                  assets and unpublish any linked website group departures.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="mt-5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingFlyer(null)}
                  className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyKey === `del-flyer-${deletingFlyer.id}`}
                  onClick={handleDeleteFlyerBatch}
                  className="cursor-pointer gap-1.5 bg-destructive text-xs font-bold text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {busyKey === `del-flyer-${deletingFlyer.id}` ? (
                    <Loader2
                      className="size-3.5 animate-spin text-destructive-foreground motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2
                      className="size-3.5 text-destructive-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span>Permanently Delete Batch</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
