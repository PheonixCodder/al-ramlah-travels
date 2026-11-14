"use client"

import * as React from "react"
import Image from "next/image"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Share2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
  Smartphone,
  Layers,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DEFAULT_PKT_POSTING_SLOTS,
  bucketPostsByPktDate,
  formatPktDate,
  formatPktDateKey,
  formatPktTime12h,
  generateCalendarGridDays,
  generateWeekGridDays,
  parsePktSlotToUtc,
  type CalendarDayCell,
} from "@/lib/social/time-slots"
import { rescheduleSocialPostAction } from "@/app/actions/social-scheduler"
import type { ScheduledPostItem } from "@/components/admin/hubs/campaigns-hub-client"
import type { SocialProviderId } from "@/lib/social/types"

interface SocialCalendarViewProps {
  scheduledPosts: ScheduledPostItem[]
  onSelectSlot?: (dateKey: string, timeSlot: string) => void
  onSelectPost?: (post: ScheduledPostItem) => void
  onRefresh?: () => void
}

const PROVIDER_ICONS: Record<SocialProviderId, string> = {
  instagram: "📸",
  facebook: "📘",
  tiktok: "🎵",
  youtube: "▶️",
  gmb: "📍",
}

export function SocialCalendarView({
  scheduledPosts,
  onSelectSlot,
  onSelectPost,
  onRefresh,
}: SocialCalendarViewProps) {
  const [viewMode, setViewMode] = React.useState<"month" | "week">("month")
  const [currentDate, setCurrentDate] = React.useState<Date>(() => new Date())

  // Reschedule dialog state
  const [reschedulingPost, setReschedulingPost] =
    React.useState<ScheduledPostItem | null>(null)
  const [newDateInput, setNewDateInput] = React.useState<string>("")
  const [newSlotInput, setNewSlotInput] = React.useState<string>("11:00")
  const [isRescheduling, setIsRescheduling] = React.useState<boolean>(false)
  const [rescheduleError, setRescheduleError] = React.useState<string | null>(null)

  // Current year & month for month view
  const currentYear = currentDate.getUTCFullYear()
  const currentMonth = currentDate.getUTCMonth() + 1 // 1-12

  // Month navigation
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (viewMode === "month") {
        d.setUTCMonth(d.getUTCMonth() - 1)
      } else {
        d.setUTCDate(d.getUTCDate() - 7)
      }
      return d
    })
  }

  const handleNext = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (viewMode === "month") {
        d.setUTCMonth(d.getUTCMonth() + 1)
      } else {
        d.setUTCDate(d.getUTCDate() + 7)
      }
      return d
    })
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Generate cells
  const dayCells = React.useMemo(() => {
    if (viewMode === "month") {
      return generateCalendarGridDays(currentYear, currentMonth)
    }
    return generateWeekGridDays(currentDate)
  }, [viewMode, currentYear, currentMonth, currentDate])

  // Bucket posts by PKT date key
  const postsByDate = React.useMemo(() => {
    return bucketPostsByPktDate(scheduledPosts)
  }, [scheduledPosts])

  // Reschedule handler
  const handleOpenReschedule = (post: ScheduledPostItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setReschedulingPost(post)
    const d = new Date(post.scheduledFor)
    setNewDateInput(formatPktDateKey(d))
    setNewSlotInput("11:00")
    setRescheduleError(null)
  }

  const handleConfirmReschedule = async () => {
    if (!reschedulingPost || !newDateInput) return
    setIsRescheduling(true)
    setRescheduleError(null)

    try {
      const newUtcDate = parsePktSlotToUtc(newDateInput, newSlotInput)
      const res = await rescheduleSocialPostAction({
        postId: reschedulingPost.id,
        newScheduledFor: newUtcDate,
      })

      if (res.success) {
        setReschedulingPost(null)
        if (onRefresh) onRefresh()
      } else {
        setRescheduleError(res.error || "Failed to reschedule post")
      }
    } catch (err: unknown) {
      setRescheduleError(
        err instanceof Error ? err.message : "Failed to reschedule post"
      )
    } finally {
      setIsRescheduling(false)
    }
  }

  const headerLabel = React.useMemo(() => {
    if (viewMode === "month") {
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ]
      return `${monthNames[currentMonth - 1]} ${currentYear} (PKT)`
    }
    const firstCell = dayCells[0]
    const lastCell = dayCells[dayCells.length - 1]
    if (firstCell && lastCell) {
      return `${firstCell.dayNumber} ${formatPktDate(firstCell.dateUtcStart, "short")} — ${lastCell.dayNumber} ${formatPktDate(lastCell.dateUtcStart, "short")} (PKT)`
    }
    return "Weekly Calendar (PKT)"
  }, [viewMode, currentMonth, currentYear, dayCells])

  const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  return (
    <div className="flex flex-col gap-4">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gradient-to-r from-[#0A3622]/5 via-background to-[#C5A059]/5 p-3.5 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-5 text-[#C5A059]" />
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              {headerLabel}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Peak Umrah windows: 11:00 AM, 4:00 PM &amp; 9:00 PM Asia/Karachi (UTC+5)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {/* Navigation Controls */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold hover:bg-muted text-foreground transition-colors border-x border-border cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Next"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-secondary p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "week"
                  ? "bg-[#0A3622] text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "month"
                  ? "bg-[#0A3622] text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 gap-1 text-center font-display text-xs font-bold text-muted-foreground py-1 border-b border-border/80">
        {weekDayNames.map((name) => (
          <div key={name}>{name}</div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div
        className={`grid grid-cols-7 gap-1.5 ${
          viewMode === "week" ? "min-h-[460px]" : "min-h-[620px]"
        }`}
      >
        {dayCells.map((cell) => {
          const postsForDay = postsByDate.get(cell.dateKey) || []
          const isDimmed = !cell.isCurrentMonth && viewMode === "month"

          return (
            <div
              key={cell.dateKey}
              className={`rounded-xl border flex flex-col p-2 transition-all ${
                cell.isToday
                  ? "border-[#0A3622] bg-[#0A3622]/[0.02] ring-1 ring-[#0A3622]/30"
                  : isDimmed
                  ? "border-border/40 bg-muted/20 opacity-60"
                  : "border-border bg-card hover:border-[#C5A059]/40"
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                <span
                  className={`text-xs font-bold rounded-full size-6 flex items-center justify-center ${
                    cell.isToday
                      ? "bg-[#0A3622] text-white shadow-xs"
                      : "text-foreground"
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {postsForDay.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-[#C5A059]/60 text-[#0A3622] font-mono"
                  >
                    {postsForDay.length} post{postsForDay.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              {/* Day Posts List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 py-1.5 min-h-[90px]">
                {postsForDay.map((post) => {
                  const postTimePkt = formatPktTime12h(
                    new Date(post.scheduledFor)
                  )
                  const targetProviders = Array.from(
                    new Set(post.targets.map((t) => t.integration.provider))
                  ) as SocialProviderId[]

                  const statusColor =
                    post.status === "completed"
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                      : post.status === "publishing"
                      ? "bg-amber-500/10 text-amber-700 border-amber-500/30 animate-pulse"
                      : post.status === "failed"
                      ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
                      : "bg-[#0A3622]/10 text-[#0A3622] border-[#0A3622]/30"

                  const thumbnail =
                    post.mediaUrls[0] || post.postAsset?.imageUrl || ""

                  return (
                    <div
                      key={post.id}
                      onClick={() => onSelectPost && onSelectPost(post)}
                      className={`group/card rounded-lg border p-1.5 text-left text-xs bg-background shadow-xs hover:shadow-md transition-all cursor-pointer ${statusColor}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {thumbnail ? (
                          <div className="relative size-7 shrink-0 rounded overflow-hidden bg-muted">
                            <Image
                              src={thumbnail}
                              alt="thumb"
                              fill
                              sizes="28px"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="size-7 shrink-0 rounded bg-muted flex items-center justify-center text-[10px]">
                            📸
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold truncate">
                              {post.postAsset?.postCode || "POST"}
                            </span>
                            <span className="text-[9px] font-medium text-muted-foreground flex items-center gap-0.5">
                              <Clock className="size-2.5" />
                              {postTimePkt}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-0.5">
                            <div className="flex items-center gap-0.5 text-[10px]">
                              {targetProviders.map((p) => (
                                <span key={p} title={p}>
                                  {PROVIDER_ICONS[p] || "📱"}
                                </span>
                              ))}
                            </div>

                            {(post.status === "scheduled" ||
                              post.status === "draft") && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenReschedule(post, e)}
                                className="opacity-0 group-hover/card:opacity-100 text-[10px] text-primary hover:underline font-semibold"
                                title="Reschedule Post"
                              >
                                Move
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Peak Slot Buttons */}
              <div className="pt-1 border-t border-border/40 flex flex-wrap gap-1">
                {DEFAULT_PKT_POSTING_SLOTS.map((slot) => {
                  const [h] = slot.split(":")
                  const hourNum = parseInt(h, 10)
                  const label =
                    hourNum === 11
                      ? "11 AM"
                      : hourNum === 16
                      ? "4 PM"
                      : "9 PM"

                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() =>
                        onSelectSlot && onSelectSlot(cell.dateKey, slot)
                      }
                      className="text-[9px] px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground hover:text-foreground hover:bg-[#C5A059]/15 hover:border-[#C5A059]/60 transition-all font-mono cursor-pointer flex items-center gap-0.5"
                      title={`Queue new post on ${cell.dateKey} at ${slot} PKT`}
                    >
                      <Plus className="size-2 text-[#C5A059]" />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Reschedule Modal */}
      {reschedulingPost && (
        <Dialog
          open={Boolean(reschedulingPost)}
          onOpenChange={(open) => !open && setReschedulingPost(null)}
        >
          <DialogContent className="max-w-md bg-card border-[#C5A059]/50 shadow-xl">
            <DialogHeader>
              <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
                <Clock className="size-4 text-[#C5A059]" />
                <span>Reschedule Post</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Move post{" "}
                <span className="font-mono font-bold text-foreground">
                  {reschedulingPost.postAsset?.postCode || reschedulingPost.id}
                </span>{" "}
                to a new date and time in Pakistan Standard Time (PKT).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="reschedule-date" className="text-xs font-semibold">
                  Date (PKT)
                </Label>
                <Input
                  id="reschedule-date"
                  type="date"
                  value={newDateInput}
                  onChange={(e) => setNewDateInput(e.target.value)}
                  className="h-8 text-xs border-border bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Peak Time Slot (PKT)
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { slot: "11:00", label: "11:00 AM" },
                    { slot: "16:00", label: "04:00 PM" },
                    { slot: "21:00", label: "09:00 PM" },
                  ].map((s) => (
                    <button
                      key={s.slot}
                      type="button"
                      onClick={() => setNewSlotInput(s.slot)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        newSlotInput === s.slot
                          ? "bg-[#0A3622] text-white border-[#0A3622] shadow-xs"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reschedule-time" className="text-xs font-semibold">
                  Or Custom Time (HH:mm)
                </Label>
                <Input
                  id="reschedule-time"
                  type="time"
                  value={newSlotInput}
                  onChange={(e) => setNewSlotInput(e.target.value)}
                  className="h-8 text-xs border-border bg-background font-mono"
                />
              </div>

              {rescheduleError && (
                <div className="rounded-lg bg-destructive/10 text-destructive text-xs p-2.5 font-medium flex items-center gap-1.5">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{rescheduleError}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReschedulingPost(null)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isRescheduling}
                onClick={handleConfirmReschedule}
                className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 text-xs h-8 font-semibold cursor-pointer gap-1.5"
              >
                {isRescheduling && (
                  <Loader2 className="size-3.5 animate-spin text-[#C5A059]" />
                )}
                <span>Confirm Reschedule</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
