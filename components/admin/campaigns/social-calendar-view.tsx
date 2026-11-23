"use client"

import * as React from "react"
import Image from "next/image"
import {
  Calendar as CalendarIcon,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Plus,
  AlertCircle,
  Loader2,
  List,
  MapPin,
  Play,
  Smartphone,
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
} from "@/lib/social/time-slots"
import { rescheduleSocialPostAction } from "@/app/actions/social-scheduler"
import type { ScheduledPostItem } from "@/components/admin/hubs/campaigns-hub-client"
import type { SocialProviderId } from "@/lib/social/types"

export type SocialCalendarViewMode = "month" | "week" | "agenda"

/**
 * Pure UTC calendar navigation helper that anchors to day 1 before shifting
 * months so Jan 31 / Mar 31 never skips February (`T-089`).
 */
export function navigateCalendarDate(
  current: Date,
  direction: -1 | 1,
  mode: SocialCalendarViewMode
): Date {
  const d = new Date(current.getTime())
  if (mode === "month") {
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() + direction)
  } else {
    d.setUTCDate(d.getUTCDate() + direction * 7)
  }
  return d
}

interface SocialCalendarViewProps {
  scheduledPosts: ScheduledPostItem[]
  initialNowMs?: number
  onSelectSlot?: (dateKey: string, timeSlot: string) => void
  onSelectPost?: (post: ScheduledPostItem) => void
  onRefresh?: () => void
}

const PROVIDER_ICON_MAP: Record<
  SocialProviderId,
  React.ComponentType<{ className?: string }>
> = {
  instagram: Camera,
  facebook: Globe,
  tiktok: Film,
  youtube: Play,
  gmb: MapPin,
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

function renderProviderIcon(provider: SocialProviderId, className = "size-3") {
  const IconComponent = PROVIDER_ICON_MAP[provider] || Smartphone
  return <IconComponent className={className} aria-hidden="true" />
}

export function SocialCalendarView({
  scheduledPosts,
  initialNowMs,
  onSelectSlot,
  onSelectPost,
  onRefresh,
}: SocialCalendarViewProps) {
  const [viewMode, setViewMode] =
    React.useState<SocialCalendarViewMode>("month")
  const [seedNowMs, setSeedNowMs] = React.useState<number>(
    () => initialNowMs ?? Date.now()
  )
  const [currentDate, setCurrentDate] = React.useState<Date>(
    () => new Date(initialNowMs ?? Date.now())
  )

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setSeedNowMs(Date.now())
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const todayPktKey = React.useMemo(
    () => formatPktDateKey(new Date(seedNowMs)),
    [seedNowMs]
  )

  // Reschedule dialog state
  const [reschedulingPost, setReschedulingPost] =
    React.useState<ScheduledPostItem | null>(null)
  const [newDateInput, setNewDateInput] = React.useState<string>("")
  const [newSlotInput, setNewSlotInput] = React.useState<string>("11:00")
  const [isRescheduling, setIsRescheduling] = React.useState<boolean>(false)
  const [rescheduleError, setRescheduleError] = React.useState<string | null>(
    null
  )

  // Current year & month for month view
  const currentYear = currentDate.getUTCFullYear()
  const currentMonth = currentDate.getUTCMonth() + 1 // 1-12

  const handlePrev = () => {
    setCurrentDate((prev) => navigateCalendarDate(prev, -1, viewMode))
  }

  const handleNext = () => {
    setCurrentDate((prev) => navigateCalendarDate(prev, 1, viewMode))
  }

  const handleToday = () => {
    const nowMs = Date.now()
    setSeedNowMs(nowMs)
    setCurrentDate(new Date(nowMs))
  }

  // Generate cells
  const dayCells = React.useMemo(() => {
    if (viewMode === "month") {
      return generateCalendarGridDays(currentYear, currentMonth)
    }
    return generateWeekGridDays(currentDate)
  }, [viewMode, currentYear, currentMonth, currentDate])

  // Agenda cells (current month active days or current 7-day week)
  const agendaCells = React.useMemo(() => {
    if (viewMode === "month") {
      return dayCells.filter((c) => c.isCurrentMonth)
    }
    return generateWeekGridDays(currentDate)
  }, [viewMode, dayCells, currentDate])

  // Bucket posts by PKT date key
  const postsByDate = React.useMemo(() => {
    return bucketPostsByPktDate(scheduledPosts)
  }, [scheduledPosts])

  // Reschedule handler
  const handleOpenReschedule = (
    post: ScheduledPostItem,
    e: React.MouseEvent
  ) => {
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
      return `${firstCell.dayNumber} ${formatPktDate(firstCell.dateUtcStart, "short")} to ${lastCell.dayNumber} ${formatPktDate(lastCell.dateUtcStart, "short")} (PKT)`
    }
    return "Weekly Calendar (PKT)"
  }, [viewMode, currentMonth, currentYear, dayCells])

  const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  const renderAgendaList = (className?: string) => (
    <div className={className}>
      <div className="flex flex-col gap-2.5">
        {agendaCells.map((cell) => {
          const postsForDay = postsByDate.get(cell.dateKey) || []
          const isToday = cell.dateKey === todayPktKey
          return (
            <div
              key={`agenda-${cell.dateKey}`}
              className={`flex flex-col gap-2 rounded-xl p-3 ${
                isToday
                  ? "bg-primary/5 ring-1 ring-primary/35"
                  : "bg-secondary/50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex size-6 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground"
                    }`}
                  >
                    {cell.dayNumber}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {formatPktDate(cell.dateUtcStart, "short")}
                  </span>
                  {isToday && (
                    <Badge className="bg-primary text-[10px] text-primary-foreground">
                      Today (PKT)
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {DEFAULT_PKT_POSTING_SLOTS.map((slot) => {
                    const hourNum = parseInt(slot.split(":")[0] || "11", 10)
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
                        className="inline-flex cursor-pointer items-center gap-0.5 rounded border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-gold-border hover:bg-accent/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                      >
                        <Plus
                          className="size-2.5 text-gold-text"
                          aria-hidden="true"
                        />
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {postsForDay.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No posts queued: tap a peak PKT slot above to schedule.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {postsForDay.map((post) => {
                    const postTimePkt = formatPktTime12h(
                      new Date(post.scheduledFor)
                    )
                    const targetProviders = Array.from(
                      new Set(post.targets.map((t) => t.integration.provider))
                    ) as SocialProviderId[]

                    return (
                      <div
                        key={post.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-background p-2 text-xs transition-colors hover:bg-accent/30 motion-reduce:transition-none"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectPost && onSelectPost(post)}
                          className="min-w-0 flex-1 cursor-pointer rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-primary">
                              {post.postAsset?.postCode || "POST"}
                            </span>
                            <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                              <Clock className="size-2.5" aria-hidden="true" />
                              {postTimePkt}
                            </span>
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              {targetProviders.map((p) => (
                                <span
                                  key={p}
                                  title={p}
                                  aria-label={p}
                                  className="inline-flex items-center"
                                >
                                  {renderProviderIcon(p, "size-3")}
                                </span>
                              ))}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {post.caption}
                          </p>
                        </button>

                        {(post.status === "scheduled" ||
                          post.status === "draft") && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenReschedule(post, e)}
                            className="inline-flex min-h-6 shrink-0 cursor-pointer items-center rounded px-1.5 text-[11px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                          >
                            Move
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Calendar Header Controls */}
      <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl bg-secondary/60 p-3.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarIcon
            className="size-5 shrink-0 text-gold-text"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-bold text-foreground">
              {headerLabel}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Peak Umrah windows: 11:00 AM, 4:00 PM &amp; 9:00 PM Asia/Karachi
              (UTC+5)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {/* Navigation Controls */}
          <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background">
            <button
              type="button"
              onClick={handlePrev}
              className="cursor-pointer p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
              title="Previous"
              aria-label="Previous period"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="cursor-pointer border-x border-border px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="cursor-pointer p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
              title="Next"
              aria-label="Next period"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("agenda")}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors active:opacity-90 motion-reduce:transition-none ${
                viewMode === "agenda"
                  ? "bg-primary text-primary-foreground shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  : "text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              }`}
            >
              <List className="size-3" aria-hidden="true" />
              <span>Agenda</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-colors active:opacity-90 motion-reduce:transition-none ${
                viewMode === "week"
                  ? "bg-primary text-primary-foreground shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  : "text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-colors active:opacity-90 motion-reduce:transition-none ${
                viewMode === "month"
                  ? "bg-primary text-primary-foreground shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  : "text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {viewMode === "agenda" ? (
        renderAgendaList()
      ) : (
        <>
          {/* Mobile Compact Agenda View at 320px/375px (< md) */}
          {renderAgendaList("md:hidden")}

          {/* Desktop / Tablet 7-Column Calendar Grid with Horizontal Overflow Guard */}
          <div
            tabIndex={0}
            aria-label="Social publishing calendar grid"
            className="hidden overflow-x-auto pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:block"
          >
            <div className="flex min-w-[680px] flex-col gap-2">
              {/* Weekday Names Header */}
              <div className="grid grid-cols-7 gap-1 border-b border-border/80 py-1 text-center font-display text-xs font-bold text-muted-foreground">
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
                  const isToday = cell.dateKey === todayPktKey
                  const isDimmed = !cell.isCurrentMonth && viewMode === "month"

                  return (
                    <div
                      key={cell.dateKey}
                      className={`flex min-w-0 flex-col rounded-xl p-2 transition-colors motion-reduce:transition-none ${
                        isToday
                          ? "bg-primary/5 ring-1 ring-primary/35"
                          : isDimmed
                            ? "bg-muted/40"
                            : "bg-secondary/45 hover:bg-secondary/70"
                      }`}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                        <span
                          className={`flex size-6 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                            isToday
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-foreground"
                          }`}
                        >
                          {cell.dayNumber}
                        </span>

                        {postsForDay.length > 0 && (
                          <Badge
                            variant="outline"
                            className="border-gold-border px-1.5 py-0 font-sans text-[10px] font-semibold text-primary tabular-nums"
                          >
                            {postsForDay.length} post
                            {postsForDay.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>

                      {/* Day Posts List */}
                      <div className="flex min-h-[90px] flex-1 flex-col gap-1.5 overflow-y-auto py-1.5">
                        {postsForDay.map((post) => {
                          const postTimePkt = formatPktTime12h(
                            new Date(post.scheduledFor)
                          )
                          const targetProviders = Array.from(
                            new Set(
                              post.targets.map((t) => t.integration.provider)
                            )
                          ) as SocialProviderId[]

                          const statusColor =
                            post.status === "completed"
                              ? "bg-status-success-bg text-status-success border-status-success-border"
                              : post.status === "publishing"
                                ? "bg-status-warning-bg text-status-warning border-status-warning-border animate-pulse motion-reduce:animate-none"
                                : post.status === "failed"
                                  ? "bg-status-danger-bg text-status-danger border-status-danger-border"
                                  : "bg-background text-primary border-border"

                          const thumbnail =
                            post.mediaUrls[0] || post.postAsset?.imageUrl || ""
                          const thumbnailImageUrl =
                            getRenderableImagePreviewUrl(thumbnail)

                          return (
                            <div
                              key={post.id}
                              className={`group/post flex items-center gap-1 rounded-lg border p-1.5 text-left text-xs shadow-2xs transition-colors motion-reduce:transition-none ${statusColor}`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  onSelectPost && onSelectPost(post)
                                }
                                className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                {thumbnailImageUrl ? (
                                  <div className="relative size-7 shrink-0 overflow-hidden rounded bg-muted">
                                    <Image
                                      src={thumbnailImageUrl}
                                      alt={
                                        post.postAsset?.title ||
                                        "Scheduled post media"
                                      }
                                      fill
                                      sizes="28px"
                                      className="object-cover"
                                      unoptimized
                                    />
                                  </div>
                                ) : (
                                  <div className="flex size-7 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                    {thumbnail && isPdfAssetUrl(thumbnail) ? (
                                      <FileText
                                        className="size-3.5"
                                        aria-hidden="true"
                                      />
                                    ) : thumbnail ? (
                                      <Film
                                        className="size-3.5"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <ImageIcon
                                        className="size-3.5"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="truncate font-mono text-[10px] font-bold">
                                      {post.postAsset?.postCode || "POST"}
                                    </span>
                                    <span className="flex shrink-0 items-center gap-0.5 text-[9px] font-medium text-muted-foreground tabular-nums">
                                      <Clock
                                        className="size-2.5"
                                        aria-hidden="true"
                                      />
                                      {postTimePkt}
                                    </span>
                                  </div>

                                  <div className="mt-0.5 flex items-center gap-1">
                                    {targetProviders.map((p) => (
                                      <span
                                        key={p}
                                        title={p}
                                        aria-label={p}
                                        className="inline-flex items-center"
                                      >
                                        {renderProviderIcon(p, "size-2.5")}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </button>

                              {(post.status === "scheduled" ||
                                post.status === "draft") && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenReschedule(post, e)}
                                  className="shrink-0 cursor-pointer rounded px-1 text-[10px] font-semibold text-primary opacity-100 transition-opacity hover:underline focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none sm:opacity-0 sm:group-focus-within/post:opacity-100 sm:group-hover/post:opacity-100"
                                  title="Reschedule Post"
                                >
                                  Move
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Peak Slot Buttons */}
                      <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-1">
                        {DEFAULT_PKT_POSTING_SLOTS.map((slot) => {
                          const [h] = slot.split(":")
                          const hourNum = parseInt(h || "11", 10)
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
                              className="inline-flex min-h-6 min-w-6 cursor-pointer items-center gap-0.5 rounded border border-border/70 bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-gold-border hover:bg-accent/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                              title={`Queue new post on ${cell.dateKey} at ${slot} PKT`}
                            >
                              <Plus
                                className="size-2.5 text-gold-text"
                                aria-hidden="true"
                              />
                              <span>{label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reschedule Modal */}
      {reschedulingPost && (
        <Dialog
          open={Boolean(reschedulingPost)}
          onOpenChange={(open) => !open && setReschedulingPost(null)}
        >
          <DialogContent className="max-w-md border-gold-border bg-card shadow-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-base font-bold">
                <Clock className="size-4 text-gold-text" aria-hidden="true" />
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

            <div className="flex flex-col gap-4 py-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="reschedule-date"
                  className="text-xs font-semibold"
                >
                  Date (PKT)
                </Label>
                <Input
                  id="reschedule-date"
                  type="date"
                  value={newDateInput}
                  onChange={(e) => setNewDateInput(e.target.value)}
                  className="h-8 border-border bg-background text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
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
                      className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors active:opacity-90 motion-reduce:transition-none ${
                        newSlotInput === s.slot
                          ? "border-primary bg-primary text-primary-foreground shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                          : "border-border bg-background text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="reschedule-time"
                  className="text-xs font-semibold"
                >
                  Or Custom Time (HH:mm)
                </Label>
                <Input
                  id="reschedule-time"
                  type="time"
                  value={newSlotInput}
                  onChange={(e) => setNewSlotInput(e.target.value)}
                  className="h-8 border-border bg-background font-mono text-xs"
                />
              </div>

              {rescheduleError && (
                <div className="flex items-center gap-1.5 rounded-lg bg-status-danger-bg p-2.5 text-xs font-medium text-status-danger">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
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
                className="h-8 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isRescheduling}
                onClick={handleConfirmReschedule}
                className="h-8 cursor-pointer gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRescheduling && (
                  <Loader2
                    className="size-3.5 animate-spin text-gold motion-reduce:animate-none"
                    aria-hidden="true"
                  />
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
