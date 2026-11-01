"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Plus,
  Upload,
  Wand2,
  Image as ImageIcon,
  FileText,
  Globe,
  CheckCircle2,
  Loader2,
  Building2,
  Coins,
  ExternalLink,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  upsertSupplier,
  uploadRawFlyerFileAction,
  extractSupplierFlyerDraftAction,
  upsertSupplierFlyerWithPackages,
  generateMultiPackageSheetForFlyer,
  generateSingleSpotlightForCard,
  publishFlyerCardToPublicGroupPackages,
} from "@/app/actions/marketing-ops"
import { calculateWrappedPackagePricing } from "@/lib/domain/marketing-ops"
import type { ExtractedFlyerCardInput } from "@/lib/validations/marketing"

export interface SupplierRow {
  id: string
  name: string
  slug: string
  codePrefix: string
  category: "group_packages" | "custom_packages" | "both"
  defaultCommissionMode: "included_in_flyer" | "net_plus_markup"
  defaultCommissionPkr: number
  contactPerson?: string | null
  whatsappNumber?: string | null
  isActive: boolean
}

export interface FlyerPackageRow {
  id: string
  cardNumber: string
  postCode: string
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
}

export interface FlyerRow {
  id: string
  supplierId: string
  title: string
  rawFlyerImageUrl: string
  airlineName: string
  airlineIataCode?: string | null
  durationDays: number
  daysTitle: string
  routePill: string
  outboundBaggage?: string | null
  inboundBaggage?: string | null
  giftedInclusions: string[]
  commissionMode: "included_in_flyer" | "net_plus_markup"
  commissionPkr: number
  receivedDate: string
  multiSheetImageUrl?: string | null
  multiSheetPdfUrl?: string | null
  status: string
  supplier: SupplierRow
  packages: FlyerPackageRow[]
}

export function SupplierFlyersClient({
  initialSuppliers,
  initialFlyers,
}: {
  initialSuppliers: SupplierRow[]
  initialFlyers: FlyerRow[]
}) {
  const router = useRouter()

  const [activeTab, setActiveTab] = React.useState<
    "flyer_vault" | "ingest_studio" | "suppliers"
  >("flyer_vault")

  const [notice, setNotice] = React.useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)

  // New Supplier Form State
  const [supName, setSupName] = React.useState("")
  const [supPrefix, setSupPrefix] = React.useState("")
  const [supCategory, setSupCategory] = React.useState<
    "group_packages" | "custom_packages" | "both"
  >("group_packages")
  const [supCommMode, setSupCommMode] = React.useState<
    "included_in_flyer" | "net_plus_markup"
  >("included_in_flyer")
  const [supCommPkr, setSupCommPkr] = React.useState(22000)
  const [supWhatsapp, setSupWhatsapp] = React.useState("")

  // Flyer Ingestion Studio State
  const [selectedSupplierId, setSelectedSupplierId] = React.useState(
    initialSuppliers[0]?.id || ""
  )
  const [flyerTitle, setFlyerTitle] = React.useState(
    "Ammaar 21 Days Airblue Umrah Packages"
  )
  const [rawImageUrl, setRawImageUrl] = React.useState(
    "/uploads/sample-posts/ammaar-raw-17cards.jpg"
  )
  const [airlineName, setAirlineName] = React.useState("Airblue")
  const [airlineIata, setAirlineIata] = React.useState("PA")
  const [durationDays, setDurationDays] = React.useState(21)
  const [daysTitle, setDaysTitle] = React.useState("21 DAYS")
  const [routePill, setRoutePill] = React.useState("LHE - JED | JED - LHE")
  const [outboundBaggage, setOutboundBaggage] = React.useState("20 Kg + 7 Kg")
  const [inboundBaggage, setInboundBaggage] = React.useState(
    "30 Kg + 7 Kg + 5 Ltr Zamzam"
  )
  const [commissionMode, setCommissionMode] = React.useState<
    "included_in_flyer" | "net_plus_markup"
  >("included_in_flyer")
  const [commissionPkr, setCommissionPkr] = React.useState(22000)
  const [receivedDate, setReceivedDate] = React.useState(
    new Date().toISOString().split("T")[0]!
  )
  const [cards, setCards] = React.useState<ExtractedFlyerCardInput[]>([
    {
      cardNumber: "01",
      outboundFlightNo: "PA 470",
      outboundDateLabel: "10 NOV",
      outboundRoute: "LHE - JED",
      outboundDepTime: "06:35",
      outboundArrTime: "10:35",
      returnFlightNo: "PA 471",
      returnDateLabel: "01 DEC",
      returnRoute: "JED - LHE",
      returnDepTime: "11:35",
      returnArrTime: "18:20",
      makkahNights: "15N",
      makkahHotelName: "Dar Al Khalil Al Rushad",
      makkahDistanceLabel: "(600M)",
      madinahNights: "05N",
      madinahHotelName: "Emaar Taiba",
      madinahDistanceLabel: "(400M)",
      mealPlanLabel: "Room Only",
      rawSharingPkr: 269899,
      rawQuadPkr: 279899,
      rawTriplePkr: 298899,
      rawDoublePkr: 334899,
    },
  ])

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusyKey("upload")
    setNotice(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadRawFlyerFileAction(fd)
      if (res.success && res.url) {
        setRawImageUrl(res.url)
        setNotice({
          type: "success",
          text: `Uploaded raw supplier flyer (${res.storage.toUpperCase()}): ${res.url}`,
        })
      } else {
        setNotice({ type: "error", text: res.error || "Upload failed" })
      }
    } finally {
      setBusyKey(null)
    }
  }

  const handleLoadPresetOrExtract = async (
    presetKey?: "ammaar_airblue_21d" | "upsky_saudia_15d"
  ) => {
    setBusyKey("extract")
    setNotice(null)
    try {
      const sup = initialSuppliers.find((s) => s.id === selectedSupplierId)
      const res = await extractSupplierFlyerDraftAction({
        imageUrl: rawImageUrl,
        supplierSlug: sup?.slug,
        presetKey,
      })
      if (res.success && res.draft) {
        const d = res.draft
        setFlyerTitle(d.title)
        setAirlineName(d.airlineName)
        setAirlineIata(d.airlineIataCode)
        setDurationDays(d.durationDays)
        setDaysTitle(d.daysTitle)
        setRoutePill(d.routePill)
        setOutboundBaggage(d.outboundBaggage)
        setInboundBaggage(d.inboundBaggage)
        setCards(d.cards)
        setNotice({
          type: "success",
          text: `Extracted ${d.cards.length} package tiers into the workbench.`,
        })
      } else {
        setNotice({ type: "error", text: res.error || "Extraction failed" })
      }
    } finally {
      setBusyKey(null)
    }
  }

  const handleSaveFlyer = async () => {
    if (!selectedSupplierId) {
      setNotice({ type: "error", text: "Please select a supplier first." })
      return
    }
    setBusyKey("save_flyer")
    setNotice(null)
    try {
      const res = await upsertSupplierFlyerWithPackages({
        supplierId: selectedSupplierId,
        title: flyerTitle,
        rawFlyerImageUrl: rawImageUrl,
        airlineName,
        airlineIataCode: airlineIata,
        durationDays,
        daysTitle,
        routePill,
        departureCityCode: "LHE",
        arrivalAirportCode: "JED",
        returnAirportCode: "JED",
        outboundBaggage,
        inboundBaggage,
        giftedInclusions: [
          "Visa",
          "Insurance",
          "Hotel",
          "Return Ticket",
          "Transport",
        ],
        commissionMode,
        commissionPkr,
        receivedDate,
        cards,
      })

      if (res.success) {
        setNotice({
          type: "success",
          text: "Supplier flyer and all wrapped package cards saved with deterministic Post Reference Codes!",
        })
        setActiveTab("flyer_vault")
        router.refresh()
      } else {
        setNotice({ type: "error", text: res.error || "Failed to save flyer" })
      }
    } finally {
      setBusyKey(null)
    }
  }

  const handleRenderMultiSheet = async (flyerId: string) => {
    setBusyKey(`sheet-${flyerId}`)
    setNotice(null)
    try {
      const res = await generateMultiPackageSheetForFlyer(flyerId)
      if (res.success) {
        setNotice({
          type: "success",
          text: `4K Multi-Package Sheet [${res.postCode}] rendered via Headless Chromium!`,
        })
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to render 4K sheet",
        })
      }
    } finally {
      setBusyKey(null)
    }
  }

  const handleRenderSpotlight = async (pkgId: string, postCode: string) => {
    setBusyKey(`spot-${pkgId}`)
    setNotice(null)
    try {
      const res = await generateSingleSpotlightForCard(pkgId)
      if (res.success) {
        setNotice({
          type: "success",
          text: `4K Single-Package Spotlight Poster [${postCode}] rendered via Headless Chromium!`,
        })
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to render 4K spotlight poster",
        })
      }
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
        setNotice({
          type: "success",
          text: `Package [${postCode}] published live to Public Website Group Packages!`,
        })
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Failed to publish package",
        })
      }
    } finally {
      setBusyKey(null)
    }
  }

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusyKey("create_supplier")
    setNotice(null)
    try {
      const slug = supName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
      const res = await upsertSupplier({
        name: supName,
        slug,
        codePrefix: supPrefix.toUpperCase(),
        category: supCategory,
        defaultCommissionMode: supCommMode,
        defaultCommissionPkr: supCommPkr,
        whatsappNumber: supWhatsapp,
        isActive: true,
      })
      if (res.success) {
        setSupName("")
        setSupPrefix("")
        setSupWhatsapp("")
        setNotice({
          type: "success",
          text: `Supplier "${res.supplier?.name}" saved.`,
        })
        router.refresh()
      } else {
        setNotice({ type: "error", text: res.error || "Failed to save supplier" })
      }
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Button
          type="button"
          variant={activeTab === "flyer_vault" ? "default" : "outline"}
          onClick={() => setActiveTab("flyer_vault")}
          className="gap-2 text-xs font-semibold cursor-pointer"
        >
          <Sparkles className="size-3.5 text-gold" />
          <span>Wrapped Flyers &amp; 4K Spotlight Vault ({initialFlyers.length})</span>
        </Button>

        <Button
          type="button"
          variant={activeTab === "ingest_studio" ? "default" : "outline"}
          onClick={() => setActiveTab("ingest_studio")}
          className="gap-2 text-xs font-semibold cursor-pointer"
        >
          <Wand2 className="size-3.5 text-gold" />
          <span>Ingest &amp; Wrap New Supplier Flyer</span>
        </Button>

        <Button
          type="button"
          variant={activeTab === "suppliers" ? "default" : "outline"}
          onClick={() => setActiveTab("suppliers")}
          className="gap-2 text-xs font-semibold cursor-pointer"
        >
          <Building2 className="size-3.5 text-gold" />
          <span>B2B Suppliers Directory ({initialSuppliers.length})</span>
        </Button>
      </div>

      {notice && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-medium flex items-center justify-between ${
            notice.type === "error"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-emerald-300 bg-emerald-50 text-emerald-900"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[11px] underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: WRAPPED FLYERS & 4K SPOTLIGHT VAULT                */}
      {/* ========================================================= */}
      {activeTab === "flyer_vault" && (
        <div className="flex flex-col gap-6">
          {initialFlyers.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <Sparkles className="mx-auto size-8 text-gold mb-2" />
                <h3 className="font-display text-base font-bold">
                  No Supplier Flyers Ingested Yet
                </h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Click &quot;Ingest &amp; Wrap New Supplier Flyer&quot; to wrap your first Ammaar or Upsky Travels flyer.
                </p>
                <Button
                  type="button"
                  onClick={() => setActiveTab("ingest_studio")}
                  className="gap-2"
                >
                  <Plus className="size-4" />
                  <span>Ingest First Flyer</span>
                </Button>
              </CardContent>
            </Card>
          ) : (
            initialFlyers.map((flyer) => (
              <Card
                key={flyer.id}
                className="border-border bg-card shadow-sm overflow-hidden"
              >
                <CardHeader className="bg-secondary/30 border-b border-border pb-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge className="bg-primary text-gold font-bold text-[10px] uppercase">
                          Supplier: {flyer.supplier?.name} (
                          {flyer.supplier?.codePrefix})
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
                          {flyer.commissionMode === "included_in_flyer"
                            ? `Mode A: Commission Included (PKR ${flyer.commissionPkr.toLocaleString()})`
                            : `Mode B: Net + PKR ${flyer.commissionPkr.toLocaleString()} Markup`}
                        </Badge>
                      </div>
                      <CardTitle className="font-display text-lg font-bold text-foreground">
                        {flyer.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Received: {flyer.receivedDate} · {flyer.packages.length}{" "}
                        Extracted Package Cards · Baggage:{" "}
                        {flyer.outboundBaggage || "20Kg"} Out /{" "}
                        {flyer.inboundBaggage || "30Kg + Zamzam"} In
                      </CardDescription>
                    </div>

                    {/* 4K Multi-Package Sheet Actions (Skill 2) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={flyer.rawFlyerImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                      >
                        <ImageIcon className="size-3.5 text-muted-foreground" />
                        <span>View Raw Supplier Flyer</span>
                      </a>

                      <Button
                        type="button"
                        size="sm"
                        disabled={busyKey === `sheet-${flyer.id}`}
                        onClick={() => handleRenderMultiSheet(flyer.id)}
                        className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 text-xs font-semibold gap-1.5 cursor-pointer"
                      >
                        {busyKey === `sheet-${flyer.id}` ? (
                          <Loader2 className="size-3.5 animate-spin text-gold" />
                        ) : (
                          <Sparkles className="size-3.5 text-gold" />
                        )}
                        <span>
                          {flyer.multiSheetImageUrl
                            ? "Re-Render 4K All-Packages Sheet"
                            : "Render 4K All-Packages Sheet (Skill 2)"}
                        </span>
                      </Button>

                      {flyer.multiSheetImageUrl && (
                        <a
                          href={flyer.multiSheetImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gold bg-gold/15 px-3 py-1.5 text-xs font-bold text-primary hover:bg-gold/25"
                        >
                          <span>4K Sheet PNG</span>
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
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-3">Post Ref Code</th>
                          <th className="py-2 pr-3">Flight Schedule</th>
                          <th className="py-2 pr-3">Makkah &amp; Madinah Hotels</th>
                          <th className="py-2 pr-3 text-right">
                            Supplier Net (Sharing)
                          </th>
                          <th className="py-2 pr-3 text-right">
                            Al Ramlah Retail (S / Q / T / D)
                          </th>
                          <th className="py-2 text-right">
                            Skill 3 Spotlight &amp; Public Sync
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {flyer.packages.map((pkg) => (
                          <tr
                            key={pkg.id}
                            className="hover:bg-secondary/20 transition-colors"
                          >
                            <td className="py-3 pr-3 align-top">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 font-mono text-xs font-bold text-gold">
                                {pkg.postCode}
                              </span>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Card #{pkg.cardNumber} · Margin: PKR{" "}
                                {pkg.commissionPkr.toLocaleString()}
                              </div>
                            </td>

                            <td className="py-3 pr-3 align-top">
                              <div className="font-mono font-bold text-foreground">
                                {pkg.outboundFlightNo} ({pkg.outboundDateLabel})
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {pkg.outboundRoute} · {pkg.outboundDepTime}-
                                {pkg.outboundArrTime}
                              </div>
                              <div className="font-mono font-semibold text-foreground mt-1">
                                {pkg.returnFlightNo} ({pkg.returnDateLabel})
                              </div>
                            </td>

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

                            <td className="py-3 pr-3 text-right align-top font-mono">
                              <div className="text-muted-foreground">
                                PKR {pkg.netSharingPkr.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-emerald-700 font-semibold">
                                +PKR {pkg.commissionPkr.toLocaleString()} Comm.
                              </div>
                            </td>

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

                            <td className="py-3 text-right align-top">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busyKey === `spot-${pkg.id}`}
                                  onClick={() =>
                                    handleRenderSpotlight(pkg.id, pkg.postCode)
                                  }
                                  className="h-7 px-2.5 text-[11px] font-semibold border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                                >
                                  {busyKey === `spot-${pkg.id}` ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="size-3 text-gold" />
                                  )}
                                  <span>
                                    {pkg.spotlightPosterUrl
                                      ? "Re-Render 4K Spotlight"
                                      : "4K Single Spotlight (Skill 3)"}
                                  </span>
                                </Button>

                                {pkg.spotlightPosterUrl && (
                                  <a
                                    href={pkg.spotlightPosterUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md bg-[#0A3622] px-2.5 py-1 text-[11px] font-bold text-gold hover:bg-[#0A3622]/90"
                                  >
                                    <span>View 4K Poster</span>
                                    <ExternalLink className="size-2.5" />
                                  </a>
                                )}

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busyKey === `pub-${pkg.id}`}
                                  onClick={() =>
                                    handlePublishToWebsite(pkg.id, pkg.postCode)
                                  }
                                  className="h-7 px-2.5 text-[11px] font-semibold border-gold/50 bg-gold/10 text-foreground hover:bg-gold/20 cursor-pointer"
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
                                      ? "Synced to Website"
                                      : "Publish to Website"}
                                  </span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: INGEST & WRAP NEW SUPPLIER FLYER STUDIO            */}
      {/* ========================================================= */}
      {activeTab === "ingest_studio" && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="bg-secondary/30 border-b border-border">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="font-display text-lg font-bold">
                  AI Supplier Flyer Ingestion &amp; Dual-Commission Workbench
                </CardTitle>
                <CardDescription className="text-xs">
                  Upload a raw flyer image from Ammaar or Upsky Travels, extract all package cards, and choose Commission Mode A or Mode B.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyKey === "extract"}
                  onClick={() =>
                    handleLoadPresetOrExtract("ammaar_airblue_21d")
                  }
                  className="text-xs font-semibold gap-1.5 border-gold/50 bg-gold/10 cursor-pointer"
                >
                  <Wand2 className="size-3.5 text-gold" />
                  <span>Load Ammaar 21D Airblue Flyer</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyKey === "extract"}
                  onClick={() => handleLoadPresetOrExtract("upsky_saudia_15d")}
                  className="text-xs font-semibold gap-1.5 border-primary/30 bg-primary/5 cursor-pointer"
                >
                  <Wand2 className="size-3.5 text-primary" />
                  <span>Load Upsky 15D Saudia Flyer</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-5">
            {/* Row 1: Supplier, Title, Upload Raw Image */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  1. B2B Wholesale Supplier
                </Label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                >
                  {initialSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.codePrefix})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  2. Flyer Batch Title
                </Label>
                <Input
                  value={flyerTitle}
                  onChange={(e) => setFlyerTitle(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  3. Raw Supplier Flyer Image (Cloudflare R2 / Local)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={rawImageUrl}
                    onChange={(e) => setRawImageUrl(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-xs font-semibold hover:bg-secondary/80">
                    <Upload className="size-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Row 2: Airline, Duration, Route, Baggage */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <div className="space-y-1">
                <Label className="text-[11px]">Airline Name</Label>
                <Input
                  value={airlineName}
                  onChange={(e) => setAirlineName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">IATA Code</Label>
                <Input
                  value={airlineIata}
                  onChange={(e) => setAirlineIata(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Duration (Days)</Label>
                <Input
                  type="number"
                  value={durationDays}
                  onChange={(e) => {
                    const d = Number(e.target.value) || 15
                    setDurationDays(d)
                    setDaysTitle(`${d} DAYS`)
                  }}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Route Pill</Label>
                <Input
                  value={routePill}
                  onChange={(e) => setRoutePill(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Outbound Baggage</Label>
                <Input
                  value={outboundBaggage}
                  onChange={(e) => setOutboundBaggage(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Return Baggage</Label>
                <Input
                  value={inboundBaggage}
                  onChange={(e) => setInboundBaggage(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Row 3: Dual Commission Mode Selector (PKR 20,000 - 25,000) */}
            <div className="rounded-xl border border-gold/50 bg-gold/5 p-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="size-4 text-gold" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    B2B Commission Pricing Mode (PKR 20,000 – 25,000 Target)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold">
                    Commission per Seat (PKR):
                  </Label>
                  <Input
                    type="number"
                    value={commissionPkr}
                    onChange={(e) =>
                      setCommissionPkr(Number(e.target.value) || 0)
                    }
                    className="w-28 h-8 font-mono text-xs font-bold"
                  />
                  <Input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-36 h-8 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCommissionMode("included_in_flyer")}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    commissionMode === "included_in_flyer"
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-white hover:border-gold"
                  }`}
                >
                  <div className="text-xs font-bold text-primary">
                    Mode A: Commission Already Included in Supplier Flyer Price
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Posters print the exact flyer price. System deducts PKR{" "}
                    {commissionPkr.toLocaleString()} internally to track net
                    payable to supplier.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCommissionMode("net_plus_markup")}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    commissionMode === "net_plus_markup"
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-white hover:border-gold"
                  }`}
                >
                  <div className="text-xs font-bold text-primary">
                    Mode B: Net Wholesale Flyer — Add Our PKR{" "}
                    {commissionPkr.toLocaleString()} Markup
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Supplier flyer shows net wholesale rates. System auto-adds
                    PKR {commissionPkr.toLocaleString()} to Sharing, Quad,
                    Triple, and Double on generated posters.
                  </p>
                </button>
              </div>
            </div>

            {/* Row 4: Extracted Package Cards Editable Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Extracted Package Tiers ({cards.length} Cards)
                </h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCards((prev) => [
                      ...prev,
                      {
                        cardNumber: String(prev.length + 1).padStart(2, "0"),
                        outboundFlightNo: "PA 470",
                        outboundDateLabel: "25 NOV",
                        outboundRoute: "LHE - JED",
                        outboundDepTime: "06:35",
                        outboundArrTime: "10:35",
                        returnFlightNo: "PA 471",
                        returnDateLabel: "16 DEC",
                        returnRoute: "JED - LHE",
                        returnDepTime: "11:35",
                        returnArrTime: "18:20",
                        makkahNights: "15N",
                        makkahHotelName: "Makkah Courtyard Hotel",
                        makkahDistanceLabel: "(450M)",
                        madinahNights: "05N",
                        madinahHotelName: "Madinah Haram Hotel",
                        madinahDistanceLabel: "(300M)",
                        mealPlanLabel: "Room Only",
                        rawSharingPkr: 269899,
                        rawQuadPkr: 279899,
                        rawTriplePkr: 298899,
                        rawDoublePkr: 334899,
                      },
                    ])
                  }
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="size-3.5" />
                  <span>Add Package Card Row</span>
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Out / Ret Dates</th>
                      <th className="p-2 text-left">Makkah Hotel</th>
                      <th className="p-2 text-left">Madinah Hotel</th>
                      <th className="p-2 text-left">Raw Sharing</th>
                      <th className="p-2 text-left">Raw Quad</th>
                      <th className="p-2 text-left">Raw Triple</th>
                      <th className="p-2 text-left">Raw Double</th>
                      <th className="p-2 text-right">Poster Retail Sharing</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {cards.map((card, idx) => {
                      const computed = calculateWrappedPackagePricing({
                        rawSharingPkr: card.rawSharingPkr,
                        rawQuadPkr: card.rawQuadPkr,
                        rawTriplePkr: card.rawTriplePkr,
                        rawDoublePkr: card.rawDoublePkr,
                        commissionMode,
                        commissionPkr,
                      })
                      return (
                        <tr key={idx}>
                          <td className="p-2 font-mono font-bold">
                            {card.cardNumber}
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Input
                                value={card.outboundDateLabel}
                                onChange={(e) => {
                                  const next = [...cards]
                                  next[idx] = {
                                    ...card,
                                    outboundDateLabel: e.target.value,
                                  }
                                  setCards(next)
                                }}
                                className="h-7 w-20 text-[11px] font-mono"
                              />
                              <Input
                                value={card.returnDateLabel}
                                onChange={(e) => {
                                  const next = [...cards]
                                  next[idx] = {
                                    ...card,
                                    returnDateLabel: e.target.value,
                                  }
                                  setCards(next)
                                }}
                                className="h-7 w-20 text-[11px] font-mono"
                              />
                            </div>
                          </td>
                          <td className="p-2">
                            <Input
                              value={card.makkahHotelName}
                              onChange={(e) => {
                                const next = [...cards]
                                next[idx] = {
                                  ...card,
                                  makkahHotelName: e.target.value,
                                }
                                setCards(next)
                              }}
                              className="h-7 text-[11px]"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={card.madinahHotelName}
                              onChange={(e) => {
                                const next = [...cards]
                                next[idx] = {
                                  ...card,
                                  madinahHotelName: e.target.value,
                                }
                                setCards(next)
                              }}
                              className="h-7 text-[11px]"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={card.rawSharingPkr}
                              onChange={(e) => {
                                const next = [...cards]
                                next[idx] = {
                                  ...card,
                                  rawSharingPkr: Number(e.target.value) || 0,
                                }
                                setCards(next)
                              }}
                              className="h-7 w-24 font-mono text-[11px]"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={card.rawQuadPkr}
                              onChange={(e) => {
                                const next = [...cards]
                                next[idx] = {
                                  ...card,
                                  rawQuadPkr: Number(e.target.value) || 0,
                                }
                                setCards(next)
                              }}
                              className="h-7 w-24 font-mono text-[11px]"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={card.rawTriplePkr}
                              onChange={(e) => {
                                const next = [...cards]
                                next[idx] = {
                                  ...card,
                                  rawTriplePkr: Number(e.target.value) || 0,
                                }
                                setCards(next)
                              }}
                              className="h-7 w-24 font-mono text-[11px]"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={card.rawDoublePkr}
                              onChange={(e) => {
                                const next = [...cards]
                                next[idx] = {
                                  ...card,
                                  rawDoublePkr: Number(e.target.value) || 0,
                                }
                                setCards(next)
                              }}
                              className="h-7 w-24 font-mono text-[11px]"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-primary">
                            PKR {computed.retailSharingPkr.toLocaleString()}
                          </td>
                          <td className="p-2 text-right">
                            {cards.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCards(cards.filter((_, i) => i !== idx))
                                }
                                className="text-red-600 hover:text-red-800 p-1"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                disabled={busyKey === "save_flyer"}
                onClick={handleSaveFlyer}
                className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 gap-2 text-xs font-bold px-6 cursor-pointer"
              >
                {busyKey === "save_flyer" ? (
                  <Loader2 className="size-4 animate-spin text-gold" />
                ) : (
                  <Sparkles className="size-4 text-gold" />
                )}
                <span>
                  Save Wrapped Supplier Flyer &amp; Generate Post Codes
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================= */}
      {/* TAB 3: B2B SUPPLIERS DIRECTORY                            */}
      {/* ========================================================= */}
      {activeTab === "suppliers" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-3">
            {initialSuppliers.map((sup) => (
              <Card key={sup.id} className="border-border bg-card shadow-xs">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold rounded bg-primary px-2 py-0.5 text-gold">
                        {sup.codePrefix}
                      </span>
                      <h3 className="font-display text-base font-bold text-foreground">
                        {sup.name}
                      </h3>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {sup.category.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Default Commission: PKR{" "}
                      {sup.defaultCommissionPkr.toLocaleString()} (
                      {sup.defaultCommissionMode === "included_in_flyer"
                        ? "Mode A: Included in Flyer"
                        : "Mode B: Net + Markup"}
                      )
                      {sup.whatsappNumber ? ` · WA: ${sup.whatsappNumber}` : ""}
                    </p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300">
                    Active Partner
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-5">
            <Card className="border-border bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="font-display text-base font-bold">
                  Add New B2B Wholesale Supplier
                </CardTitle>
                <CardDescription className="text-xs">
                  Register a new travel consolidator providing group or custom Umrah packages.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateSupplier} className="space-y-3">
                  <div>
                    <Label className="text-xs">Company Name *</Label>
                    <Input
                      required
                      value={supName}
                      onChange={(e) => setSupName(e.target.value)}
                      placeholder="e.g. Al-Haramain Consolidators"
                      className="text-xs mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Post Code Prefix *</Label>
                      <Input
                        required
                        maxLength={6}
                        value={supPrefix}
                        onChange={(e) =>
                          setSupPrefix(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. AHC"
                        className="text-xs font-mono uppercase mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Category</Label>
                      <select
                        value={supCategory}
                        onChange={(e) =>
                          setSupCategory(
                            e.target.value as
                              | "group_packages"
                              | "custom_packages"
                              | "both"
                          )
                        }
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                      >
                        <option value="group_packages">Group Packages</option>
                        <option value="custom_packages">Custom Packages</option>
                        <option value="both">Both Group &amp; Custom</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Default Commission Mode</Label>
                      <select
                        value={supCommMode}
                        onChange={(e) =>
                          setSupCommMode(
                            e.target.value as
                              | "included_in_flyer"
                              | "net_plus_markup"
                          )
                        }
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                      >
                        <option value="included_in_flyer">
                          Mode A: Included in Flyer
                        </option>
                        <option value="net_plus_markup">
                          Mode B: Net + Markup
                        </option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Default Commission (PKR)</Label>
                      <Input
                        type="number"
                        value={supCommPkr}
                        onChange={(e) =>
                          setSupCommPkr(Number(e.target.value) || 22000)
                        }
                        className="text-xs font-mono mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Supplier WhatsApp</Label>
                    <Input
                      value={supWhatsapp}
                      onChange={(e) => setSupWhatsapp(e.target.value)}
                      placeholder="0300 1234567"
                      className="text-xs mt-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={busyKey === "create_supplier"}
                    className="w-full gap-2 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Save B2B Supplier</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
