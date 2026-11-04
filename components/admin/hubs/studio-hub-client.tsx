"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Sparkles,
  Wand2,
  Globe,
  Upload,
  Image as ImageIcon,
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
import {
  GroupsClient,
  type PackageWithRelations,
} from "@/components/admin/catalog/groups-client"
import {
  ingestFinishedPosterOrFlyerAction,
  updateExtractedFlyerCardAction,
  deleteSupplierFlyerAction,
  publishFlyerCardToPublicGroupPackages,
  publishAllFlyerCardsToPublicGroupPackagesAction,
  updatePackageSpotlightImageAction,
  upsertSupplier,
} from "@/app/actions/marketing-ops"
import { calculateWrappedPackagePricing } from "@/lib/domain/marketing-ops"
import { cn } from "@/lib/utils"

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
  suppliers: SupplierRecord[]
  supplierFlyers: SupplierFlyerRecord[]
  postAssets: PostAssetRecord[]
  groupPackages: PackageWithRelations[]
  airlines: { id: string; name: string; iataCode: string }[]
  hotels: { id: string; name: string; city: string; starRating: number }[]
  departureCities: { id: string; cityName: string; airportCode: string }[]
}

export type StudioTabKey = "studio" | "vault" | "packages"

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
      errorJson.error || `Upload authorization failed (HTTP ${presignRes.status})`
    )
  }

  const { uploadUrl, publicUrl, key } = (await presignRes.json()) as {
    uploadUrl: string
    publicUrl: string
    key: string
  }

  onProgress?.(45, "Streaming file directly to Cloudflare R2 (zero 4.5MB limit)...")

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
  initialTab = "studio",
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

  const validTabs: StudioTabKey[] = ["studio", "vault", "packages"]

  const activeTab: StudioTabKey = React.useMemo(() => {
    const urlTab = searchParams.get("tab") as StudioTabKey | null
    if (urlTab && validTabs.includes(urlTab)) {
      return urlTab
    }
    if (initialTab && validTabs.includes(initialTab as StudioTabKey)) {
      return initialTab as StudioTabKey
    }
    return "studio"
  }, [searchParams, initialTab])

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

  React.useEffect(() => {
    setFlyersList(initialFlyers)
  }, [initialFlyers])

  React.useEffect(() => {
    setAssetsList(initialAssets)
  }, [initialAssets])

  React.useEffect(() => {
    setSuppliersList(initialSuppliers)
  }, [initialSuppliers])

  const [notice, setNotice] = React.useState<{
    type: "success" | "error" | "info"
    text: string
  } | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)

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
        setSuppliersList((prev) => [...prev, created])
        setSelectedSupplierId(created.id)
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
  // TAB 1: 4K POSTER INGESTION WORKBENCH STATE
  // ----------------------------------------------------------------------
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>(
    initialSuppliers[0]?.id || ""
  )
  const [commissionPkr, setCommissionPkr] = React.useState<number>(22000)
  const [departureCityCode, setDepartureCityCode] = React.useState<string>("LHE")

  const [posterFile, setPosterFile] = React.useState<File | null>(null)
  const [posterDirectUrl, setPosterDirectUrl] = React.useState<string>("")
  const [uploadProgress, setUploadProgress] = React.useState<number>(0)
  const [uploadStatus, setUploadStatus] = React.useState<string>("")

  // Sync supplier default commission when supplier changes
  React.useEffect(() => {
    const s = suppliersList.find((sup) => sup.id === selectedSupplierId)
    if (s) {
      setCommissionPkr(s.defaultCommissionPkr || 22000)
    }
  }, [selectedSupplierId, suppliersList])

  // ----------------------------------------------------------------------
  // HANDLERS: FINISHED 4K POSTER INGESTION
  // ----------------------------------------------------------------------
  const handleIngestPoster = async () => {
    if (!selectedSupplierId) {
      setNotice({ type: "error", text: "Please select a wholesale supplier." })
      return
    }

    setBusyKey("ingest_poster")
    setNotice(null)
    setUploadProgress(5)
    setUploadStatus("Preparing finished poster ingestion...")

    try {
      let finalMediaUrl = posterDirectUrl.trim()

      if (posterFile) {
        const uploadResult = await uploadFileDirectToR2(
          posterFile,
          "posters/finished",
          (pct, text) => {
            setUploadProgress(pct)
            setUploadStatus(text)
          }
        )
        finalMediaUrl = uploadResult.publicUrl
      }

      if (!finalMediaUrl) {
        setNotice({
          type: "error",
          text: "Please provide a 4K poster image/PDF file or direct URL.",
        })
        return
      }

      setUploadStatus("Invoking Gemini Ultra Multimodal AI extraction & 1080p social optimizer...")

      const res = await ingestFinishedPosterOrFlyerAction({
        supplierId: selectedSupplierId,
        mediaUrl: finalMediaUrl,
        ingestionMode: "gemini_ultra_poster",
        commissionMode: "included_in_flyer",
        commissionPkr,
        departureCityCode,
      })

      if (res.success) {
        setNotice({
          type: "success",
          text: `✨ Successfully ingested 4K poster! Preserved 4K asset, generated 1080p social JPEG, and extracted ${res.packagesCount} package cards.`,
        })
        setPosterFile(null)
        setPosterDirectUrl("")
        setUploadProgress(0)
        setUploadStatus("")
        router.refresh()
        switchTab("vault")
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to ingest finished poster.",
        })
      }
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Ingestion failed.",
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
  const [editingCard, setEditingCard] = React.useState<SupplierFlyerPackageRecord | null>(null)
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
  const [deletingFlyer, setDeletingFlyer] = React.useState<SupplierFlyerRecord | null>(null)

  // Dedicated Package Spotlight Image Modal State
  const [imageModalCard, setImageModalCard] = React.useState<{
    cardId: string
    postCode: string
    currentImageUrl: string
    title: string
  } | null>(null)
  const [imageModalUrlInput, setImageModalUrlInput] = React.useState("")
  const [imageModalUploading, setImageModalUploading] = React.useState(false)
  const [imageModalProgress, setImageModalProgress] = React.useState<string | null>(null)
  const imageModalFileInputRef = React.useRef<HTMLInputElement | null>(null)

  const [editCardImageUploading, setEditCardImageUploading] = React.useState(false)
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
        text: err instanceof Error ? err.message : "Failed to update package image.",
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
        text: err instanceof Error ? err.message : "Failed to upload package image.",
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
        (_percent, _statusText) => {}
      )
      setEditForm((prev) => ({ ...prev, spotlightPosterUrl: publicUrl }))
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to upload package image.",
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
        text: err instanceof Error ? err.message : "Failed to update package card.",
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
        setFlyersList((prev) => prev.filter((f) => f.id !== deletingFlyer.id))
        setAssetsList((prev) => prev.filter((a) => a.flyerId !== deletingFlyer.id))
        setNotice({
          type: "success",
          text: `Flyer batch "${deletingFlyer.title}" and associated assets deleted successfully.`,
        })
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
        text: err instanceof Error ? err.message : "Failed to delete flyer batch.",
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
                      res.groupPackageId || card.publishedGroupPackageId || "optimistic-published",
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

  // Filtered flyers in Vault
  const filteredFlyers = React.useMemo(() => {
    return flyersList.filter((flyer) => {
      const matchesSupplier =
        vaultSupplierFilter === "all" || flyer.supplierId === vaultSupplierFilter

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
        vaultSupplierFilter === "all" || asset.supplierId === vaultSupplierFilter

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
      {/* FLAGSHIP HARAMAIN LUXURY HEADER & TOP TABS                           */}
      {/* ==================================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-r from-[#0A3622] via-[#0F4C31] to-[#0A3622] p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gold">
                <Sparkles className="size-3 text-gold" />
                Hub 1 · Multimodal AI &amp; 4K Chromium Studio
              </span>
              <span className="text-xs text-white/70">
                /admin/studio
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              4K Poster &amp; Package Studio
            </h1>
            <p className="mt-1.5 text-xs text-white/80 max-w-2xl leading-relaxed sm:text-sm">
              Drop your finished 4K Gemini Ultra posters or PDFs. Streams directly to Cloudflare R2, auto-generates 1080×1520 social JPEGs, extracts every package card &amp; ART-... code via AI, tracks wholesale commission vs. supplier net cost, and publishes to your website in 1 click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSupplierModalOpen(true)}
              className="border-gold/40 bg-white/10 text-white hover:bg-white/20 text-xs font-semibold gap-1.5 cursor-pointer backdrop-blur-xs"
            >
              <Building2 className="size-3.5 text-gold" />
              <span>+ Add B2B Supplier</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/admin/campaigns?tab=social")}
              className="bg-gold hover:bg-gold/90 text-primary font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              <Share2 className="size-3.5" />
              <span>Go to Campaigns Hub</span>
            </Button>
          </div>
        </div>

        {/* Subtle Decorative Elements */}
        <div className="absolute -right-10 -bottom-10 size-48 rounded-full bg-gold/10 blur-2xl pointer-events-none" />
      </div>

      {/* ==================================================================== */}
      {/* URL-SYNCED TABS SWITCHER                                             */}
      {/* ==================================================================== */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Button
          type="button"
          variant={activeTab === "studio" ? "default" : "outline"}
          onClick={() => switchTab("studio")}
          className={cn(
            "gap-2 text-xs font-semibold cursor-pointer transition-all",
            activeTab === "studio"
              ? "bg-[#0A3622] text-white hover:bg-[#0A3622]/90 shadow-xs"
              : "border-border hover:border-gold"
          )}
        >
          <Sparkles className="size-3.5 text-gold" />
          <span>Upload 4K Poster &amp; Extract</span>
        </Button>

        <Button
          type="button"
          variant={activeTab === "vault" ? "default" : "outline"}
          onClick={() => switchTab("vault")}
          className={cn(
            "gap-2 text-xs font-semibold cursor-pointer transition-all",
            activeTab === "vault"
              ? "bg-[#0A3622] text-white hover:bg-[#0A3622]/90 shadow-xs"
              : "border-border hover:border-gold"
          )}
        >
          <Layers className="size-3.5 text-gold" />
          <span>4K Posters &amp; Extracted Cards Vault</span>
          <Badge
            variant="secondary"
            className="ml-1 px-1.5 py-0 text-[10px] font-mono font-bold bg-white/20 text-inherit"
          >
            {flyersList.length} Posters · {assetsList.length} Assets
          </Badge>
        </Button>

        <Button
          type="button"
          variant={activeTab === "packages" ? "default" : "outline"}
          onClick={() => switchTab("packages")}
          className={cn(
            "gap-2 text-xs font-semibold cursor-pointer transition-all",
            activeTab === "packages"
              ? "bg-[#0A3622] text-white hover:bg-[#0A3622]/90 shadow-xs"
              : "border-border hover:border-gold"
          )}
        >
          <Globe className="size-3.5 text-gold" />
          <span>Live Website Group Packages &amp; Batches</span>
          <Badge
            variant="secondary"
            className="ml-1 px-1.5 py-0 text-[10px] font-mono font-bold bg-white/20 text-inherit"
          >
            {groupPackages.length} Packages
          </Badge>
        </Button>
      </div>

      {/* Operational Notice Banner */}
      {notice && (
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border p-3.5 text-xs font-medium shadow-xs transition-all",
            notice.type === "error"
              ? "border-red-300 bg-red-50 text-red-900"
              : notice.type === "info"
                ? "border-blue-300 bg-blue-50 text-blue-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
          )}
        >
          <div className="flex items-center gap-2">
            {notice.type === "error" ? (
              <AlertCircle className="size-4 shrink-0 text-red-600" />
            ) : notice.type === "info" ? (
              <AlertCircle className="size-4 shrink-0 text-blue-600" />
            ) : (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[11px] underline ml-4 hover:opacity-75 cursor-pointer font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: FINISHED 4K POSTER / PDF INGESTION STUDIO                     */}
      {/* ==================================================================== */}
      {activeTab === "studio" && (
        <div className="flex flex-col gap-6">
          <Card className="border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="bg-secondary/30 border-b border-border pb-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="size-4 text-gold" />
                    <span>Finished 4K Poster / Vector PDF Ingestion Studio</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Zero re-rendering: Preserves your master 4K artwork byte-for-byte, generates progressive sRGB 1080p social preview, and indexes all package cards for reverse search.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-gold/50 bg-gold/10 text-xs font-mono font-bold text-primary self-start sm:self-auto">
                  Direct-to-R2 Streaming Enabled
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
              {/* Configuration Row: Supplier & Commission & City */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">1. Wholesale Supplier</Label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
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
                      className="shrink-0"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    2. Commission Margin per Seat (PKR)
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={commissionPkr}
                      onChange={(e) => setCommissionPkr(Number(e.target.value) || 0)}
                      className="text-xs font-mono font-bold h-9"
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-muted-foreground uppercase font-bold">
                      Mode A: Included
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Deducted internally to calculate net payable to supplier.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">3. Origin Departure City</Label>
                  <select
                    value={departureCityCode}
                    onChange={(e) => setDepartureCityCode(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    {departureCities.map((c) => (
                      <option key={c.id} value={c.airportCode}>
                        {c.cityName} ({c.airportCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multimodal Dropzone for 4K Poster */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  4. Master 4K Poster File (PNG, JPEG, WebP, or Vector PDF)
                </Label>
                <div className="rounded-xl border-2 border-dashed border-gold/40 bg-gold/5 p-6 text-center hover:bg-gold/10 transition-colors">
                  <Upload className="mx-auto size-8 text-gold mb-2" />
                  <div className="text-xs font-semibold text-foreground">
                    {posterFile ? (
                      <span className="font-mono text-emerald-800 font-bold">
                        Selected: {posterFile.name} ({(posterFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    ) : (
                      <span>Drag and drop your 4K Ultra Poster, or click to browse</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 mb-3">
                    Supports direct-to-R2 upload up to 50MB. Recommended resolution: 3240×4560 px.
                  </p>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0A3622] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A3622]/90 shadow-xs">
                    <FileUp className="size-3.5 text-gold" />
                    <span>{posterFile ? "Change File" : "Select 4K Poster / PDF"}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) setPosterFile(f)
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Or Enter Direct URL */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Or Direct Media URL:
                  </span>
                  <Input
                    placeholder="/uploads/sample-posts/ammaar-raw-17cards.jpg or https://..."
                    value={posterDirectUrl}
                    onChange={(e) => setPosterDirectUrl(e.target.value)}
                    className="text-xs font-mono h-8"
                  />
                </div>
              </div>

              {/* Upload Progress Bar */}
              {uploadProgress > 0 && (
                <div className="space-y-1 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin text-gold" />
                      {uploadStatus}
                    </span>
                    <span className="font-mono font-bold text-primary">
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
                    busyKey === "ingest_poster" || (!posterFile && !posterDirectUrl.trim())
                  }
                  onClick={handleIngestPoster}
                  className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 font-bold text-xs gap-2 px-6 h-10 cursor-pointer shadow-sm"
                >
                  {busyKey === "ingest_poster" ? (
                    <Loader2 className="size-4 animate-spin text-gold" />
                  ) : (
                    <Sparkles className="size-4 text-gold" />
                  )}
                  <span>Ingest 4K Poster &amp; Run AI Multimodal Extraction</span>
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
            <Card className="p-4 border-border bg-card shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Ingested Posters
              </span>
              <div className="text-xl font-bold font-mono text-primary mt-1">
                {flyersList.length}
              </div>
            </Card>
            <Card className="p-4 border-border bg-card shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Extracted Package Cards
              </span>
              <div className="text-xl font-bold font-mono text-foreground mt-1">
                {totalCardsCount}
              </div>
            </Card>
            <Card className="p-4 border-border bg-card shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                4K Posters &amp; Assets Vault
              </span>
              <div className="text-xl font-bold font-mono text-gold mt-1">
                {assetsList.length}
              </div>
            </Card>
            <Card className="p-4 border-border bg-card shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Live Website Packages
              </span>
              <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                {groupPackages.length}
              </div>
            </Card>
          </div>

          {/* Search, Filter & View Mode Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[240px] max-w-sm flex-1">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by Post Ref (ART-...), Hotel, Airline, Date..."
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>

              <select
                value={vaultSupplierFilter}
                onChange={(e) => setVaultSupplierFilter(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
              >
                <option value="all">All Suppliers ({suppliersList.length})</option>
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
                variant={vaultViewMode === "flyers_cards" ? "default" : "outline"}
                onClick={() => setVaultViewMode("flyers_cards")}
                className="text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <Layers className="size-3.5" />
                <span>Poster Batches &amp; Cards</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant={vaultViewMode === "assets_gallery" ? "default" : "outline"}
                onClick={() => setVaultViewMode("assets_gallery")}
                className="text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <ImageIcon className="size-3.5" />
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
                    <Sparkles className="mx-auto size-8 text-gold mb-2" />
                    <h3 className="font-display text-base font-bold text-foreground">
                      No Poster Batches Found
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      {vaultSearch || vaultSupplierFilter !== "all"
                        ? "Try clearing your search query or supplier filter."
                        : "No 4K posters ingested yet. Switch to Tab 1 to drop your first 4K poster or PDF."}
                    </p>
                    <Button
                      type="button"
                      onClick={() => switchTab("studio")}
                      className="gap-2 text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Upload First 4K Poster</span>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredFlyers.map((flyer) => {
                  const sheetAsset = assetsList.find(
                    (a) => a.flyerId === flyer.id && a.kind === "multi_package_sheet"
                  )
                  const totalFlyerCards = flyer.packages?.length || 0
                  const publishedFlyerCardsCount =
                    flyer.packages?.filter((p) => Boolean(p.publishedGroupPackageId))
                      .length || 0
                  const allCardsPublished =
                    totalFlyerCards > 0 &&
                    publishedFlyerCardsCount === totalFlyerCards

                  return (
                    <Card
                      key={flyer.id}
                      className="border-border bg-card shadow-sm overflow-hidden"
                    >
                      {/* Flyer Card Header */}
                      <CardHeader className="bg-secondary/30 border-b border-border pb-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <Badge className="bg-[#0A3622] text-gold font-bold text-[10px] uppercase">
                                Supplier: {flyer.supplier?.name} ({flyer.supplier?.codePrefix})
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-gold/50 bg-gold/10 text-xs font-mono font-bold text-foreground"
                              >
                                {flyer.airlineName} · {flyer.daysTitle} ({flyer.routePill})
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-emerald-600/30 bg-emerald-50 text-emerald-800 text-[11px] font-semibold"
                              >
                                Mode A: Comm Included (PKR {flyer.commissionPkr.toLocaleString()})
                              </Badge>
                              {flyer.ingestionSource && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] uppercase font-mono"
                                >
                                  {flyer.ingestionSource.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="font-display text-lg font-bold text-foreground">
                              {flyer.title}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Received: {flyer.receivedDate} · {flyer.packages?.length || 0} Package Cards · Baggage: {flyer.outboundBaggage || "20Kg"} Out / {flyer.inboundBaggage || "30Kg + Zamzam"} In
                            </CardDescription>
                          </div>

                          {/* Master Assets & Batch Actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* 1-Click Bulk Publish All Cards to Website */}
                            {totalFlyerCards > 0 && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={busyKey === `pub-all-${flyer.id}`}
                                onClick={() =>
                                  handlePublishAllToWebsite(flyer.id, flyer.title)
                                }
                                className={cn(
                                  "text-xs font-bold gap-1.5 cursor-pointer shadow-xs",
                                  allCardsPublished
                                    ? "border-emerald-600/40 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border"
                                    : "bg-emerald-800 text-white hover:bg-emerald-900 border border-emerald-700"
                                )}
                              >
                                {busyKey === `pub-all-${flyer.id}` ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : allCardsPublished ? (
                                  <CheckCircle2 className="size-3.5 text-emerald-700" />
                                ) : (
                                  <Globe className="size-3.5 text-gold" />
                                )}
                                <span>
                                  {busyKey === `pub-all-${flyer.id}`
                                    ? "Syncing All Cards..."
                                    : allCardsPublished
                                      ? `All ${totalFlyerCards} Synced to Web`
                                      : publishedFlyerCardsCount > 0
                                        ? `Publish Remaining ${totalFlyerCards - publishedFlyerCardsCount} Cards to Web`
                                        : `Publish All ${totalFlyerCards} Cards to Web`}
                                </span>
                              </Button>
                            )}

                            <a
                              href={flyer.multiSheetImageUrl || flyer.rawFlyerImageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                            >
                              <ImageIcon className="size-3.5 text-muted-foreground" />
                              <span>View 4K Poster</span>
                            </a>

                            {flyer.socialReadySheetJpegUrl && (
                              <a
                                href={flyer.socialReadySheetJpegUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-600/40 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                              >
                                <span>1080p Social JPEG</span>
                                <ExternalLink className="size-3" />
                              </a>
                            )}

                            {flyer.multiSheetPdfUrl && (
                              <a
                                href={flyer.multiSheetPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                              >
                                <FileText className="size-3.5 text-gold" />
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
                                className="border-gold text-foreground hover:bg-gold/15 text-xs font-semibold gap-1 cursor-pointer"
                              >
                                <Share2 className="size-3.5 text-gold" />
                                <span>Schedule</span>
                              </Button>
                            )}

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingFlyer(flyer)}
                              className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 text-xs font-semibold gap-1.5 cursor-pointer ml-auto"
                            >
                              <Trash2 className="size-3.5 text-red-600" />
                              <span>Delete Poster Batch</span>
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      {/* Package Cards Table */}
                      <CardContent className="p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <th className="py-2.5 pr-3">Post Ref Code</th>
                                <th className="py-2.5 pr-3">Flight Schedule</th>
                                <th className="py-2.5 pr-3">Makkah &amp; Madinah Hotels</th>
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
                                    className="hover:bg-secondary/20 transition-colors"
                                  >
                                    {/* Post Code & Identifier */}
                                    <td className="py-3 pr-3 align-top">
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 rounded-md bg-[#0A3622] px-2.5 py-1 font-mono text-xs font-bold text-gold">
                                          {pkg.postCode}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            copyToClipboard(pkg.postCode, pkg.id)
                                          }
                                          className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                                          title="Copy Post Code"
                                        >
                                          {copiedCode === pkg.id ? (
                                            <Check className="size-3 text-emerald-600" />
                                          ) : (
                                            <Copy className="size-3" />
                                          )}
                                        </button>
                                      </div>
                                      <div className="text-[10px] text-muted-foreground mt-1">
                                        Card #{pkg.cardNumber} · Margin: PKR{" "}
                                        {pkg.commissionPkr.toLocaleString()}
                                      </div>
                                    </td>

                                    {/* Flight Schedule */}
                                    <td className="py-3 pr-3 align-top">
                                      <div className="font-mono font-bold text-foreground">
                                        {pkg.outboundFlightNo} ({pkg.outboundDateLabel})
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        {pkg.outboundRoute} · {pkg.outboundDepTime}-{pkg.outboundArrTime}
                                      </div>
                                      <div className="font-mono font-semibold text-foreground mt-1">
                                        {pkg.returnFlightNo} ({pkg.returnDateLabel})
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
                                        <span className="font-bold text-emerald-800">
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
                                          className="text-[10px] px-1.5 py-0 border-gold/40 text-muted-foreground"
                                        >
                                          {pkg.mealPlanLabel || "Room Only"}
                                        </Badge>
                                      </div>
                                    </td>

                                    {/* Supplier Net Price */}
                                    <td className="py-3 pr-3 text-right align-top font-mono">
                                      <div className="text-muted-foreground">
                                        PKR {pkg.netSharingPkr.toLocaleString()}
                                      </div>
                                      <div className="text-[10px] text-emerald-700 font-semibold">
                                        +PKR {pkg.commissionPkr.toLocaleString()} Comm.
                                      </div>
                                    </td>

                                    {/* Al Ramlah Retail Price */}
                                    <td className="py-3 pr-3 text-right align-top font-mono">
                                      <div className="font-bold text-primary text-sm">
                                        S: {pkg.retailSharingPkr.toLocaleString()}
                                      </div>
                                      <div className="text-[11px] text-foreground">
                                        Q: {pkg.retailQuadPkr.toLocaleString()} · T:{" "}
                                        {pkg.retailTriplePkr.toLocaleString()}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        D: {pkg.retailDoublePkr.toLocaleString()}
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
                                          onClick={() => openEditCardDialog(pkg)}
                                          className="h-7 px-2 text-[11px] font-semibold border-border hover:border-gold hover:bg-gold/10 cursor-pointer gap-1"
                                          title="Quick Edit Card details, hotels or prices"
                                        >
                                          <Pencil className="size-3 text-gold" />
                                          <span>Edit Card</span>
                                        </Button>

                                        {/* Preview Poster */}
                                        {(pkg.spotlightPosterUrl || flyer.multiSheetImageUrl || flyer.rawFlyerImageUrl) && (
                                          <a
                                            href={pkg.spotlightPosterUrl || flyer.multiSheetImageUrl || flyer.rawFlyerImageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded-md bg-[#0A3622] px-2 py-1 text-[11px] font-bold text-gold hover:bg-[#0A3622]/90"
                                          >
                                            <span>4K Poster</span>
                                            <ExternalLink className="size-2.5" />
                                          </a>
                                        )}

                                        {/* Publish to Website */}
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={busyKey === `pub-${pkg.id}`}
                                          onClick={() =>
                                            handlePublishToWebsite(pkg.id, pkg.postCode)
                                          }
                                          className={cn(
                                            "h-7 px-2 text-[11px] font-semibold cursor-pointer",
                                            pkg.publishedGroupPackageId
                                              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                              : "border-gold/50 bg-gold/10 text-foreground hover:bg-gold/20"
                                          )}
                                        >
                                          {busyKey === `pub-${pkg.id}` ? (
                                            <Loader2 className="size-3 animate-spin" />
                                          ) : pkg.publishedGroupPackageId ? (
                                            <CheckCircle2 className="size-3 text-emerald-700" />
                                          ) : (
                                            <Globe className="size-3 text-gold" />
                                          )}
                                          <span>
                                            {pkg.publishedGroupPackageId
                                              ? "Synced to Web"
                                              : "1-Click Publish"}
                                          </span>
                                        </Button>

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
                                            className="h-7 px-2 text-[11px] font-semibold text-primary hover:bg-gold/15 cursor-pointer gap-1"
                                            title="Schedule in Campaigns Studio"
                                          >
                                            <Share2 className="size-3 text-gold" />
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
                    <ImageIcon className="mx-auto size-8 text-gold mb-2" />
                    <h3 className="font-display text-base font-bold text-foreground">
                      No 4K Posters or Assets in Vault
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Ingest finished 4K posters from Tab 1 to populate this vault.
                    </p>
                    <Button
                      type="button"
                      onClick={() => setVaultViewMode("flyers_cards")}
                      className="text-xs font-semibold gap-1.5 cursor-pointer"
                    >
                      <Layers className="size-3.5" />
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
                        className="border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between hover:border-gold/60 transition-all"
                      >
                        <div>
                          {/* Thumbnail Container */}
                          <div className="relative aspect-[3/4] w-full bg-secondary/50 overflow-hidden border-b border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={asset.imageUrl}
                              alt={asset.title}
                              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                            />
                            <div className="absolute top-2 left-2 flex items-center gap-1.5">
                              <span className="rounded-md bg-[#0A3622] px-2 py-0.5 font-mono text-[11px] font-bold text-gold shadow-sm">
                                {asset.postCode}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[9px] uppercase font-bold bg-white/90 text-foreground backdrop-blur-xs"
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
                                  className="h-6 px-2 text-[10px] font-bold bg-black/75 text-white hover:bg-black/90 border border-white/20 shadow-xs gap-1 cursor-pointer backdrop-blur-xs"
                                  title="Change dedicated image for this package"
                                >
                                  <Camera className="size-3 text-gold" />
                                  <span>Change Image</span>
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="p-4 space-y-2">
                            <h4 className="font-display text-sm font-bold text-foreground line-clamp-1">
                              {asset.title}
                            </h4>
                            <p className="text-[11px] text-muted-foreground">
                              Supplier: {asset.supplier?.name || "B2B Wholesale"} · Created:{" "}
                              {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : "Active"}
                            </p>
                          </div>
                        </div>

                        {/* Action Pills Footer */}
                        <div className="p-4 pt-0 border-t border-border/60 bg-secondary/15 flex flex-wrap items-center justify-between gap-2 mt-2">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={asset.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-[#0A3622] px-2 py-1 text-[11px] font-bold text-gold hover:bg-[#0A3622]/90"
                            >
                              <span>4K PNG</span>
                              <ExternalLink className="size-2.5" />
                            </a>

                            {asset.pdfUrl && (
                              <a
                                href={asset.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary"
                              >
                                <FileText className="size-2.5 text-gold" />
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
                                className="h-7 px-2 text-[11px] font-semibold gap-1 cursor-pointer border-border hover:border-gold hover:bg-gold/10"
                                title="Change dedicated package image"
                              >
                                <Camera className="size-3 text-gold" />
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
                                copyToClipboard(asset.captionWhatsapp || "", asset.id)
                              }
                              className="h-7 px-2 text-[11px] gap-1 cursor-pointer"
                              title="Copy WhatsApp Caption"
                            >
                              {copiedCode === asset.id ? (
                                <Check className="size-3 text-emerald-600" />
                              ) : (
                                <Copy className="size-3" />
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
                            className="h-7 px-2.5 text-[11px] font-bold bg-gold text-primary hover:bg-gold/90 gap-1 cursor-pointer shadow-xs"
                          >
                            <Share2 className="size-3" />
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
      {/* TAB 3: LIVE WEBSITE GROUP PACKAGES & SEAT BATCHES                     */}
      {/* ==================================================================== */}
      {activeTab === "packages" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                <Globe className="size-4 text-emerald-700" />
                <span>Live Website Group Packages &amp; Departure Batches Desk</span>
              </h3>
              <p className="text-xs text-emerald-900/80 mt-0.5">
                Manage all public group packages published on the homepage, track real-time seat occupancy meters, and configure seasonal flight batches.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => switchTab("vault")}
              className="border-emerald-700 text-emerald-900 hover:bg-emerald-100 text-xs font-semibold gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Sparkles className="size-3.5 text-gold" />
              <span>Publish More from Vault</span>
            </Button>
          </div>

          <GroupsClient
            initialPackages={groupPackages}
            airlines={airlines}
            hotels={hotels}
            departureCities={departureCities}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD NEW B2B SUPPLIER (BASE UI RENDER PROP COMPLIANT)          */}
      {/* ==================================================================== */}
      <Dialog open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateSupplier}>
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Building2 className="size-4 text-gold" />
                <span>Register New Wholesale Supplier</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Add an authorized B2B wholesale partner (e.g. Ammaar, Upsky Travels, Zahoor Travels) for automated flyer wrapping and deterministic Post Codes.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Supplier Name *</Label>
                <Input
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
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Prefix Code (2-4 Chars) *
                </Label>
                <Input
                  required
                  maxLength={4}
                  placeholder="e.g. ZH"
                  value={newSupCodePrefix}
                  onChange={(e) => setNewSupCodePrefix(e.target.value.toUpperCase())}
                  className="text-xs font-mono font-bold h-9 uppercase"
                />
                <p className="text-[10px] text-muted-foreground">
                  Used in ART-&#123;PREFIX&#125;-... post codes.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Inventory Category</Label>
                <select
                  value={newSupCategory}
                  onChange={(e) =>
                    setNewSupCategory(
                      e.target.value as "group_packages" | "custom_packages" | "both"
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                >
                  <option value="group_packages">Group Packages</option>
                  <option value="custom_packages">Custom Packages</option>
                  <option value="both">Both (Group &amp; Custom)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Default Commission Mode</Label>
                <select
                  value={newSupCommMode}
                  onChange={(e) =>
                    setNewSupCommMode(
                      e.target.value as "included_in_flyer" | "net_plus_markup"
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                >
                  <option value="included_in_flyer">
                    Mode A: Included in Flyer
                  </option>
                  <option value="net_plus_markup">Mode B: Net + Markup</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Default Commission (PKR)
                </Label>
                <Input
                  type="number"
                  value={newSupCommPkr}
                  onChange={(e) => setNewSupCommPkr(Number(e.target.value) || 0)}
                  className="text-xs font-mono font-bold h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">WhatsApp Desk Number</Label>
                <Input
                  placeholder="+923001234567"
                  value={newSupWhatsapp}
                  onChange={(e) => setNewSupWhatsapp(e.target.value)}
                  className="text-xs font-mono h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Contact Person</Label>
                <Input
                  placeholder="e.g. Tariq Mehmood"
                  value={newSupContact}
                  onChange={(e) => setNewSupContact(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSupplierModalOpen(false)}
                className="cursor-pointer text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={newSupSaving}
                className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
              >
                {newSupSaving ? (
                  <Loader2 className="size-3.5 animate-spin text-gold" />
                ) : (
                  <Check className="size-3.5 text-gold" />
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
      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {editingCard && (
            <form onSubmit={handleSaveCardEdit} className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#0A3622] px-2.5 py-1 font-mono text-xs font-bold text-gold">
                    {editingCard.postCode}
                  </span>
                  <DialogTitle className="font-display text-lg font-bold text-foreground">
                    Quick Edit Card #{editingCard.cardNumber}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs">
                  Update hotel names, room sharing tariffs, flight details, or wholesale commission. Supplier Net is automatically recalculated.
                </DialogDescription>
              </DialogHeader>

              {/* SECTION: ACCOMMODATIONS */}
              <div className="space-y-3 rounded-xl border border-border bg-secondary/15 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-gold" />
                  <span>Hotel Accommodations &amp; Nights</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[11px] font-semibold">Makkah Hotel Name *</Label>
                    <Input
                      required
                      value={editForm.makkahHotelName}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, makkahHotelName: e.target.value }))
                      }
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Nights</Label>
                      <Input
                        required
                        value={editForm.makkahNights}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, makkahNights: e.target.value }))
                        }
                        className="text-xs font-mono h-8"
                        placeholder="15N"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Distance</Label>
                      <Input
                        required
                        value={editForm.makkahDistanceLabel}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            makkahDistanceLabel: e.target.value,
                          }))
                        }
                        className="text-xs h-8"
                        placeholder="(600M)"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[11px] font-semibold">Madinah Hotel Name *</Label>
                    <Input
                      required
                      value={editForm.madinahHotelName}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, madinahHotelName: e.target.value }))
                      }
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Nights</Label>
                      <Input
                        required
                        value={editForm.madinahNights}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, madinahNights: e.target.value }))
                        }
                        className="text-xs font-mono h-8"
                        placeholder="05N"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Distance</Label>
                      <Input
                        required
                        value={editForm.madinahDistanceLabel}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            madinahDistanceLabel: e.target.value,
                          }))
                        }
                        className="text-xs h-8"
                        placeholder="(400M)"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Meal Plan</Label>
                  <Input
                    value={editForm.mealPlanLabel}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, mealPlanLabel: e.target.value }))
                    }
                    className="text-xs h-8"
                    placeholder="Room Only / Breakfast"
                  />
                </div>
              </div>

              {/* SECTION: FLIGHT SCHEDULE */}
              <div className="space-y-3 rounded-xl border border-border bg-secondary/15 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Plane className="size-3.5 text-gold" />
                  <span>Flight Schedule</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-[10px] font-semibold">Out Flight No</Label>
                    <Input
                      required
                      value={editForm.outboundFlightNo}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, outboundFlightNo: e.target.value }))
                      }
                      className="text-xs font-mono h-8"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-[10px] font-semibold">Out Date Label</Label>
                    <Input
                      required
                      value={editForm.outboundDateLabel}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, outboundDateLabel: e.target.value }))
                      }
                      className="text-xs font-mono h-8"
                      placeholder="10 NOV"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-[10px] font-semibold">Out Route</Label>
                    <Input
                      required
                      value={editForm.outboundRoute}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, outboundRoute: e.target.value }))
                      }
                      className="text-xs font-mono h-8"
                      placeholder="LHE - JED"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-[10px] font-semibold">Dep Time</Label>
                    <Input
                      required
                      value={editForm.outboundDepTime}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, outboundDepTime: e.target.value }))
                      }
                      className="text-xs font-mono h-8"
                      placeholder="06:35"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-[10px] font-semibold">Arr Time</Label>
                    <Input
                      required
                      value={editForm.outboundArrTime}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, outboundArrTime: e.target.value }))
                      }
                      className="text-xs font-mono h-8"
                      placeholder="10:35"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-[10px] font-semibold">Return Flight No</Label>
                    <Input
                      required
                      value={editForm.returnFlightNo}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, returnFlightNo: e.target.value }))
                      }
                      className="text-xs font-mono h-8"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-[10px] font-semibold">Return Date</Label>
                    <Input
                      required
                      value={editForm.returnDateLabel}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, returnDateLabel: e.target.value }))
                      }
                      className="text-xs font-mono h-8"
                      placeholder="01 DEC"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-[10px] font-semibold">Return Route</Label>
                    <Input
                      required
                      value={editForm.returnRoute}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, returnRoute: e.target.value }))
                      }
                      className="text-xs font-mono h-8"
                      placeholder="JED - LHE"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-[10px] font-semibold">Dep Time</Label>
                    <Input
                      required
                      value={editForm.returnDepTime}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, returnDepTime: e.target.value }))
                      }
                      className="text-xs font-mono h-8"
                      placeholder="11:35"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-[10px] font-semibold">Arr Time</Label>
                    <Input
                      required
                      value={editForm.returnArrTime}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, returnArrTime: e.target.value }))
                      }
                      className="text-xs font-mono h-8"
                      placeholder="18:20"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: PRICING & COMMISSION */}
              <div className="space-y-3 rounded-xl border border-gold/40 bg-gold/5 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Coins className="size-3.5 text-gold" />
                    <span>Pricing &amp; Wholesale Commission</span>
                  </h4>
                  <Badge variant="outline" className="border-gold/60 bg-gold/15 text-[10px] font-mono font-bold text-primary">
                    Net = Retail - Commission
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Sharing (PKR) *</Label>
                    <Input
                      type="number"
                      required
                      value={editForm.rawSharingPkr}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          rawSharingPkr: Number(e.target.value) || 0,
                        }))
                      }
                      className="text-xs font-mono font-bold h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Quad (PKR) *</Label>
                    <Input
                      type="number"
                      required
                      value={editForm.rawQuadPkr}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          rawQuadPkr: Number(e.target.value) || 0,
                        }))
                      }
                      className="text-xs font-mono font-bold h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Triple (PKR) *</Label>
                    <Input
                      type="number"
                      required
                      value={editForm.rawTriplePkr}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          rawTriplePkr: Number(e.target.value) || 0,
                        }))
                      }
                      className="text-xs font-mono font-bold h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Double (PKR) *</Label>
                    <Input
                      type="number"
                      required
                      value={editForm.rawDoublePkr}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          rawDoublePkr: Number(e.target.value) || 0,
                        }))
                      }
                      className="text-xs font-mono font-bold h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-emerald-800">
                      Commission (PKR) *
                    </Label>
                    <Input
                      type="number"
                      required
                      value={editForm.commissionPkr}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          commissionPkr: Number(e.target.value) || 0,
                        }))
                      }
                      className="text-xs font-mono font-bold h-8 border-emerald-600/40 bg-emerald-50/50"
                    />
                  </div>
                </div>

                {/* Calculation Preview Strip */}
                <div className="flex flex-wrap items-center justify-between rounded-lg bg-white/80 p-2.5 text-xs border border-gold/30">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Retail Sharing:</span>
                    <span className="font-mono font-bold text-primary">
                      PKR {editForm.rawSharingPkr.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Commission Margin:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      +PKR {editForm.commissionPkr.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Net Supplier Payable:</span>
                    <span className="font-mono font-bold text-foreground">
                      PKR {Math.max(0, editForm.rawSharingPkr - editForm.commissionPkr).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION: PACKAGE SPOTLIGHT / DEDICATED IMAGE */}
              <div className="space-y-3 rounded-xl border border-border bg-secondary/15 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Camera className="size-3.5 text-gold" />
                    <span>Package Spotlight / Dedicated Image</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <input
                      ref={editCardFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditCardImageUpload}
                      disabled={editCardImageUploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={editCardImageUploading}
                      onClick={() => editCardFileInputRef.current?.click()}
                      className="h-7 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer border-gold/40 hover:bg-gold/10"
                    >
                      {editCardImageUploading ? (
                        <Loader2 className="size-3 animate-spin text-gold" />
                      ) : (
                        <Upload className="size-3 text-gold" />
                      )}
                      <span>
                        {editCardImageUploading
                          ? "Uploading to R2..."
                          : "Upload from Disk"}
                      </span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">
                    Image URL (Cloudflare R2 or direct link)
                  </Label>
                  <Input
                    value={editForm.spotlightPosterUrl}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        spotlightPosterUrl: e.target.value,
                      }))
                    }
                    className="text-xs font-mono h-8"
                    placeholder="https://pub-....r2.dev/posters/spotlights/..."
                  />
                  <p className="text-[10px] text-muted-foreground">
                    If left blank, falls back to the master poster image. Uploading or pasting a dedicated image updates this package in 4K Social Gallery, Campaigns, and the Website.
                  </p>
                </div>

                {editForm.spotlightPosterUrl && (
                  <div className="relative h-32 w-48 rounded-lg overflow-hidden border border-border bg-secondary/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editForm.spotlightPosterUrl}
                      alt="Dedicated Package Spotlight Preview"
                      className="w-full h-full object-cover object-top"
                    />
                    <span className="absolute bottom-1 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[9px] text-white">
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
                  className="cursor-pointer text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busyKey === "saving_edit_card"}
                  className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
                >
                  {busyKey === "saving_edit_card" ? (
                    <Loader2 className="size-3.5 animate-spin text-gold" />
                  ) : (
                    <Check className="size-3.5 text-gold" />
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
                  <span className="rounded-md bg-[#0A3622] px-2.5 py-1 font-mono text-xs font-bold text-gold">
                    {imageModalCard.postCode}
                  </span>
                  <DialogTitle className="font-display text-base font-bold text-foreground">
                    Change Package Image
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs">
                  Upload a dedicated 4K image for {imageModalCard.title}. This will immediately update the 4K Social Gallery, Campaigns Social Scheduler, and the live Website package card!
                </DialogDescription>
              </DialogHeader>

              {/* Current Thumbnail Preview */}
              <div className="flex items-center gap-4 p-3 rounded-xl border border-border bg-secondary/30">
                <div className="relative h-24 w-18 shrink-0 rounded-lg overflow-hidden border border-border bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageModalUrlInput || imageModalCard.currentImageUrl}
                    alt={imageModalCard.title}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Live Preview
                  </span>
                  <p className="font-semibold text-foreground line-clamp-1">
                    {imageModalCard.title}
                  </p>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    {imageModalUrlInput ? "New image selected!" : "Currently using current/flyer image"}
                  </p>
                </div>
              </div>

              {/* Upload or URL Inputs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Upload Image File</Label>
                  <input
                    ref={imageModalFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageModalFileUpload}
                    disabled={imageModalUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={imageModalUploading}
                    onClick={() => imageModalFileInputRef.current?.click()}
                    className="h-8 px-3 text-xs font-semibold gap-1.5 cursor-pointer border-gold/50 bg-gold/10 hover:bg-gold/20"
                  >
                    {imageModalUploading ? (
                      <Loader2 className="size-3.5 animate-spin text-gold" />
                    ) : (
                      <Upload className="size-3.5 text-gold" />
                    )}
                    <span>{imageModalUploading ? "Uploading to R2..." : "Direct Upload to R2"}</span>
                  </Button>
                </div>

                {imageModalProgress && (
                  <p className="text-[11px] text-amber-700 animate-pulse font-medium">
                    {imageModalProgress}
                  </p>
                )}

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Or Paste Image URL</Label>
                  <Input
                    value={imageModalUrlInput}
                    onChange={(e) => setImageModalUrlInput(e.target.value)}
                    placeholder="https://pub-....r2.dev/posters/spotlights/..."
                    className="text-xs font-mono h-8"
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
                  className="cursor-pointer text-xs"
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold cursor-pointer gap-1.5"
                >
                  {imageModalUploading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3 text-gold" />
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
      <Dialog open={!!deletingFlyer} onOpenChange={(open) => !open && setDeletingFlyer(null)}>
        <DialogContent className="sm:max-w-md">
          {deletingFlyer && (
            <div>
              <DialogHeader>
                <DialogTitle className="font-display text-lg font-bold text-red-600 flex items-center gap-2">
                  <Trash2 className="size-4 text-red-600" />
                  <span>Delete Poster Batch</span>
                </DialogTitle>
                <DialogDescription className="text-xs pt-1 leading-relaxed">
                  Are you sure you want to permanently delete flyer batch{" "}
                  <strong className="text-foreground">&ldquo;{deletingFlyer.title}&rdquo;</strong> and all{" "}
                  <strong className="text-foreground">{deletingFlyer.packages?.length || 0} package cards</strong>?
                  This action will permanently remove all associated 4K social assets and unpublish any linked website group departures.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="mt-5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingFlyer(null)}
                  className="cursor-pointer text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyKey === `del-flyer-${deletingFlyer.id}`}
                  onClick={handleDeleteFlyerBatch}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
                >
                  {busyKey === `del-flyer-${deletingFlyer.id}` ? (
                    <Loader2 className="size-3.5 animate-spin text-white" />
                  ) : (
                    <Trash2 className="size-3.5 text-white" />
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
