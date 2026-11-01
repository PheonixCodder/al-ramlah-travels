"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Share2,
  Plus,
  Send,
  CheckCircle2,
  Calendar,
  Sparkles,
  Loader2,
  MessageSquare,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  upsertMarketingChannel,
  dispatchOrLogDistribution,
} from "@/app/actions/marketing-ops"

export interface ChannelItem {
  id: string
  name: string
  platform:
    | "whatsapp_group"
    | "whatsapp_community"
    | "whatsapp_status"
    | "instagram"
    | "facebook"
    | "tiktok"
    | "youtube"
  areaTag: string
  senderWhatsappNumber?: string | null
  externalGroupIdOrHandle?: string | null
  memberCount?: number | null
  dailyTargetPosts: number
  isActive: boolean
}

export interface PostAssetItem {
  id: string
  postCode: string
  kind: "multi_package_sheet" | "single_package_spotlight" | "custom_quotation_pdf"
  title: string
  imageUrl: string
  pdfUrl?: string | null
  captionWhatsapp?: string | null
}

export interface DistributionRow {
  id: string
  scheduledDate: string
  stage: string
  status: string
  senderWhatsappLine?: string | null
  externalQueueJobId?: string | null
  postedAt?: Date | null
  channel: ChannelItem
  postAsset: PostAssetItem
  pairedFollowUpAsset?: PostAssetItem | null
}

export function DistributionClient({
  initialChannels,
  postAssets,
  initialDistributions,
}: {
  initialChannels: ChannelItem[]
  postAssets: PostAssetItem[]
  initialDistributions: DistributionRow[]
}) {
  const router = useRouter()
  const todayIso = React.useMemo(
    () => new Date().toISOString().split("T")[0]!,
    []
  )

  const [selectedDate, setSelectedDate] = React.useState(todayIso)
  const [selectedChannelIds, setSelectedChannelIds] = React.useState<string[]>(
    () => initialChannels.slice(0, 6).map((c) => c.id)
  )
  const [areaFilter, setAreaFilter] = React.useState("all")

  const spotlightAssets = React.useMemo(
    () => postAssets.filter((a) => a.kind === "single_package_spotlight"),
    [postAssets]
  )
  const sheetAssets = React.useMemo(
    () => postAssets.filter((a) => a.kind === "multi_package_sheet"),
    [postAssets]
  )

  const [step1AssetId, setStep1AssetId] = React.useState(
    spotlightAssets[0]?.id || postAssets[0]?.id || ""
  )
  const [step2AssetId, setStep2AssetId] = React.useState(
    sheetAssets[0]?.id || ""
  )
  const [stage, setStage] = React.useState<
    "step_1_spotlight_hook" | "step_2_all_packages" | "standalone"
  >("step_1_spotlight_hook")
  const [dispatchMode, setDispatchMode] = React.useState<
    "auto_bridge" | "manual_log"
  >("auto_bridge")
  const [caption, setCaption] = React.useState(
    spotlightAssets[0]?.captionWhatsapp || ""
  )
  const [isBusy, setIsBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)

  // Add Channel Form State
  const [showAddChannel, setShowAddChannel] = React.useState(false)
  const [chName, setChName] = React.useState("")
  const [chPlatform, setChPlatform] =
    React.useState<ChannelItem["platform"]>("whatsapp_group")
  const [chArea, setChArea] = React.useState("Askari 10")
  const [chSender, setChSender] = React.useState("03274029701")
  const [chMembers, setChMembers] = React.useState(450)

  const filteredChannels = React.useMemo(() => {
    return initialChannels.filter((c) => {
      if (areaFilter === "all") return true
      return c.areaTag.toLowerCase() === areaFilter.toLowerCase()
    })
  }, [initialChannels, areaFilter])

  const dateDistributions = React.useMemo(
    () =>
      initialDistributions.filter((d) => d.scheduledDate === selectedDate),
    [initialDistributions, selectedDate]
  )

  const toggleChannel = (id: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectByArea = (tag: string) => {
    const ids = initialChannels
      .filter((c) => c.areaTag.toLowerCase() === tag.toLowerCase())
      .map((c) => c.id)
    setSelectedChannelIds(ids)
  }

  const handleDispatchCampaign = async () => {
    if (!step1AssetId || selectedChannelIds.length === 0) return
    setIsBusy(true)
    setNotice(null)
    try {
      const res = await dispatchOrLogDistribution({
        scheduledDate: selectedDate,
        channelIds: selectedChannelIds,
        postAssetId: step1AssetId,
        pairedFollowUpAssetId: step2AssetId || null,
        stage,
        captionUsed: caption,
        dispatchMode,
      })
      if (res.success) {
        setNotice(
          `Successfully dispatched/logged across ${res.dispatchedCount} channel(s) for ${selectedDate}!`
        )
        router.refresh()
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chName.trim()) return
    setIsBusy(true)
    try {
      const res = await upsertMarketingChannel({
        name: chName,
        platform: chPlatform,
        areaTag: chArea,
        senderWhatsappNumber: chSender,
        memberCount: chMembers,
        dailyTargetPosts: 1,
        isActive: true,
      })
      if (res.success) {
        setChName("")
        setShowAddChannel(false)
        router.refresh()
      }
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <div className="rounded-xl border border-emerald-400 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-950 flex items-center justify-between">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. 2-Step Campaign Composer Card */}
      <Card className="border-gold/40 bg-card shadow-sm">
        <CardHeader className="bg-secondary/30 border-b border-border pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold flex items-center gap-2">
                <Sparkles className="size-4 text-gold" />
                <span>2-Step Attention-Grabber Campaign Composer</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Step 1: Hook the group with a Dedicated Single-Package Spotlight Poster → Step 2: Follow up with the All-Packages Sheet.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-gold" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 w-36 font-mono text-xs bg-white"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Step 1 Asset */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-primary">
                1. Primary Post Asset (Spotlight Hook or Sheet)
              </Label>
              <select
                value={step1AssetId}
                onChange={(e) => {
                  const id = e.target.value
                  setStep1AssetId(id)
                  const found = postAssets.find((a) => a.id === id)
                  if (found?.captionWhatsapp) {
                    setCaption(found.captionWhatsapp)
                  }
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-mono"
              >
                {postAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.postCode}] {a.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2 Paired Sheet */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-emerald-800">
                2. Paired Step-2 Follow-Up All-Packages Sheet
              </Label>
              <select
                value={step2AssetId}
                onChange={(e) => setStep2AssetId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs font-mono"
              >
                <option value="">None (Standalone Post)</option>
                {sheetAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.postCode}] {a.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Campaign Stage & Bridge Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                3. Campaign Stage &amp; Dispatch Engine
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={stage}
                  onChange={(e) =>
                    setStage(
                      e.target.value as
                        | "step_1_spotlight_hook"
                        | "step_2_all_packages"
                        | "standalone"
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="step_1_spotlight_hook">
                    Step 1: Spotlight Hook
                  </option>
                  <option value="step_2_all_packages">
                    Step 2: All-Packages Sheet
                  </option>
                  <option value="standalone">Standalone Post</option>
                </select>

                <select
                  value={dispatchMode}
                  onChange={(e) =>
                    setDispatchMode(
                      e.target.value as "auto_bridge" | "manual_log"
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="auto_bridge">
                    WACRM &amp; Postiz Auto-Queue
                  </option>
                  <option value="manual_log">Manual Check-Off Log</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              WhatsApp Group &amp; Social Caption (Includes Post Reference Code)
            </Label>
            <Textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          {/* Quick Selection Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-muted-foreground mr-1">
                Quick Select Target Groups:
              </span>
              {["Askari 10", "DHA", "Lahore", "Other Cities", "Status", "Social"].map(
                (tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => selectByArea(tag)}
                    className="rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-[11px] font-semibold hover:border-gold hover:bg-white transition-colors"
                  >
                    Select {tag}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() =>
                  setSelectedChannelIds(initialChannels.map((c) => c.id))
                }
                className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"
              >
                Select All ({initialChannels.length})
              </button>
            </div>

            <Button
              type="button"
              disabled={isBusy || selectedChannelIds.length === 0 || !step1AssetId}
              onClick={handleDispatchCampaign}
              className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 gap-2 text-xs font-bold cursor-pointer"
            >
              {isBusy ? (
                <Loader2 className="size-4 animate-spin text-gold" />
              ) : (
                <Send className="size-4 text-gold" />
              )}
              <span>
                {dispatchMode === "auto_bridge"
                  ? `Queue & Dispatch to ${selectedChannelIds.length} Channels`
                  : `Log Check-Off for ${selectedChannelIds.length} Channels`}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Daily Channel Matrix & Checklist (30+ WA Groups, 2 Statuses, Social Accounts) */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold flex items-center gap-2">
                <Share2 className="size-4 text-primary" />
                <span>
                  Daily Channel Distribution Matrix ({selectedDate}) —{" "}
                  {dateDistributions.length} Dispatches Logged
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Click any group, status, or social channel to include/exclude it in your batch dispatch, or add new communities.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="flex h-8 rounded-md border border-input bg-background px-2.5 text-xs"
              >
                <option value="all">
                  All Areas ({initialChannels.length} Channels)
                </option>
                <option value="Askari 10">Askari 10 Communities</option>
                <option value="DHA">DHA Phases 1–8</option>
                <option value="Lahore">Lahore Cantt / Johar / Bahria</option>
                <option value="Other Cities">Other Cities</option>
                <option value="Status">2 WhatsApp Status Lines</option>
                <option value="Social">Social Media Accounts</option>
              </select>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowAddChannel(!showAddChannel)}
                className="h-8 text-xs gap-1 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Add Group / Channel</span>
              </Button>
            </div>
          </div>

          {showAddChannel && (
            <form
              onSubmit={handleAddChannel}
              className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-6 items-end rounded-xl border border-gold/40 bg-gold/5 p-3"
            >
              <div className="sm:col-span-2">
                <Label className="text-[11px]">Group / Account Name *</Label>
                <Input
                  required
                  value={chName}
                  onChange={(e) => setChName(e.target.value)}
                  placeholder="e.g. Askari 10 Sector F Residents"
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px]">Platform</Label>
                <select
                  value={chPlatform}
                  onChange={(e) =>
                    setChPlatform(e.target.value as ChannelItem["platform"])
                  }
                  className="mt-1 flex h-8 w-full rounded-md border border-input bg-white px-2 text-xs"
                >
                  <option value="whatsapp_group">WhatsApp Group</option>
                  <option value="whatsapp_community">WhatsApp Community</option>
                  <option value="whatsapp_status">WhatsApp Status</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>
              <div>
                <Label className="text-[11px]">Area Tag</Label>
                <Input
                  value={chArea}
                  onChange={(e) => setChArea(e.target.value)}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px]">Sender Line &amp; Members</Label>
                <div className="flex gap-1 mt-1">
                  <select
                    value={chSender}
                    onChange={(e) => setChSender(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-white px-1.5 text-[11px] font-mono"
                  >
                    <option value="03274029701">03274029701</option>
                    <option value="03190462638">03190462638</option>
                  </select>
                  <Input
                    type="number"
                    value={chMembers}
                    onChange={(e) => setChMembers(Number(e.target.value) || 0)}
                    className="h-8 w-16 text-xs bg-white font-mono"
                  />
                </div>
              </div>
              <div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 w-full text-xs font-bold cursor-pointer"
                >
                  Save Channel
                </Button>
              </div>
            </form>
          )}
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredChannels.map((ch) => {
              const isSelected = selectedChannelIds.includes(ch.id)
              const logsToday = dateDistributions.filter(
                (d) => d.channel.id === ch.id
              )

              return (
                <div
                  key={ch.id}
                  onClick={() => toggleChannel(ch.id)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-white hover:border-gold"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 border-gold/50 text-gold-foreground uppercase font-bold"
                        >
                          {ch.areaTag}
                        </Badge>
                        {ch.senderWhatsappNumber && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            Line: {ch.senderWhatsappNumber}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-foreground mt-1 truncate">
                        {ch.name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        {ch.platform.startsWith("whatsapp") ? (
                          <MessageSquare className="size-3 text-emerald-600" />
                        ) : (
                          <Globe className="size-3 text-sky-600" />
                        )}
                        <span className="capitalize">
                          {ch.platform.replace(/_/g, " ")}
                        </span>
                        {ch.memberCount ? ` · ${ch.memberCount} members` : ""}
                      </p>
                    </div>

                    {logsToday.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        <span>Posted ({logsToday.length})</span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                        Pending Today
                      </span>
                    )}
                  </div>

                  {logsToday.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/60 flex flex-wrap gap-1">
                      {logsToday.map((log) => (
                        <span
                          key={log.id}
                          className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary"
                        >
                          {log.postAsset.postCode}
                          {log.pairedFollowUpAsset
                            ? ` → ${log.pairedFollowUpAsset.postCode}`
                            : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
