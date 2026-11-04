"use client"

import * as React from "react"
import Link from "next/link"
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Sparkles,
  AlertTriangle,
  FileEdit,
  Printer,
  Users,
  Plane,
  Phone,
  ArrowUpRight,
  X,
  MessageSquare,
  Building2,
  Calendar,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TabularPrice } from "@/components/layout/status-badge"
import { updateApplicationStatus } from "@/app/actions/quotes"
import { formatWhatsAppPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"

export type KanbanColumnId =
  | "new"
  | "pending_quote"
  | "quoted"
  | "approved"
  | "rejected_cancelled"

export interface KanbanApplicationItem {
  id: string
  referenceNumber: string
  source: "custom_builder" | "group_booking" | "hajj_inquiry"
  status: "pending_quote" | "quoted" | "approved" | "rejected" | "cancelled"
  presetMode?: string
  customerName: string
  customerPhone: string
  customerWhatsapp?: string
  customerCity?: string
  adults: number
  children: number
  infants: number
  totalPassportCount?: number
  bedAndSeatCount?: number
  includeVisa?: boolean
  includeFlights?: boolean
  includeHotels?: boolean
  includeTransport?: boolean
  includeZiyarat?: boolean
  sourcePostCode?: string | null
  createdAt: Date | string
  quotes?: {
    id: string
    grandTotalPkr: number
    paymentStatus: string
    quotedAt?: Date | null
  }[]
  departureCity?: {
    cityName: string
    airportCode: string
  } | null
  groupPackage?: {
    title: string
  } | null
}

interface ColumnConfig {
  id: KanbanColumnId
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  badgeClass: string
  columnClass: string
  headerBg: string
}

const KANBAN_COLUMNS: ColumnConfig[] = [
  {
    id: "new",
    title: "New",
    subtitle: "Fresh inquiries & WhatsApp leads",
    icon: Sparkles,
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    columnClass: "border-amber-200/80 bg-amber-50/20",
    headerBg: "bg-amber-50/80 border-amber-200 text-amber-950",
  },
  {
    id: "pending_quote",
    title: "Pending Quote",
    subtitle: "Active pricing & worksheet costing",
    icon: Clock,
    badgeClass: "bg-amber-200 text-amber-950 border-amber-400",
    columnClass: "border-amber-300/80 bg-amber-100/15",
    headerBg: "bg-amber-100/70 border-amber-300 text-amber-950",
  },
  {
    id: "quoted",
    title: "Quoted",
    subtitle: "Formal proposal dispatched to pilgrim",
    icon: Send,
    badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
    columnClass: "border-sky-200/80 bg-sky-50/20",
    headerBg: "bg-sky-50/80 border-sky-200 text-sky-950",
  },
  {
    id: "approved",
    title: "Approved",
    subtitle: "Deposit received & seats confirmed",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
    columnClass: "border-emerald-200/80 bg-emerald-50/20",
    headerBg: "bg-emerald-50/80 border-emerald-200 text-emerald-950",
  },
  {
    id: "rejected_cancelled",
    title: "Rejected / Cancelled",
    subtitle: "Declined quotes & client cancellations",
    icon: XCircle,
    badgeClass: "bg-slate-200 text-slate-800 border-slate-300",
    columnClass: "border-slate-200 bg-slate-50/30",
    headerBg: "bg-slate-100/80 border-slate-200 text-slate-800",
  },
]

function mapAppToColumn(app: KanbanApplicationItem): KanbanColumnId {
  if (app.status === "quoted") return "quoted"
  if (app.status === "approved") return "approved"
  if (app.status === "rejected" || app.status === "cancelled") {
    return "rejected_cancelled"
  }
  // For pending_quote: if inquiry has grandTotalPkr > 0 it is under active pricing
  const latestQuote = app.quotes?.[0]
  if (latestQuote && latestQuote.grandTotalPkr > 0) {
    return "pending_quote"
  }
  return "new"
}

interface ApplicationsKanbanBoardProps {
  applications: KanbanApplicationItem[]
  slaHours?: number
}

export function ApplicationsKanbanBoard({
  applications,
  slaHours = 24,
}: ApplicationsKanbanBoardProps) {
  // Map of all items for O(1) lookup
  const [itemsMap, setItemsMap] = React.useState<Map<string, KanbanApplicationItem>>(() => {
    const map = new Map<string, KanbanApplicationItem>()
    applications.forEach((app) => map.set(app.id, app))
    return map
  })

  // Columns state: columnId -> array of item IDs
  const [columns, setColumns] = React.useState<Record<KanbanColumnId, string[]>>(() => {
    const initial: Record<KanbanColumnId, string[]> = {
      new: [],
      pending_quote: [],
      quoted: [],
      approved: [],
      rejected_cancelled: [],
    }
    applications.forEach((app) => {
      const col = mapAppToColumn(app)
      initial[col].push(app.id)
    })
    return initial
  })

  // Synchronize when applications prop changes externally
  React.useEffect(() => {
    const map = new Map<string, KanbanApplicationItem>()
    const nextCols: Record<KanbanColumnId, string[]> = {
      new: [],
      pending_quote: [],
      quoted: [],
      approved: [],
      rejected_cancelled: [],
    }
    applications.forEach((app) => {
      map.set(app.id, app)
      const col = mapAppToColumn(app)
      nextCols[col].push(app.id)
    })
    setItemsMap(map)
    setColumns(nextCols)
  }, [applications])

  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [preDragSnapshot, setPreDragSnapshot] = React.useState<Record<KanbanColumnId, string[]> | null>(null)
  const [errorBanner, setErrorBanner] = React.useState<{ message: string; cardRef?: string } | null>(null)
  const [, startTransition] = React.useTransition()

  // Pointer sensor with 5px threshold so clicks open Quote Worksheet without dragging
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  })
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
  const sensors = useSensors(pointerSensor, keyboardSensor)

  const findContainer = React.useCallback(
    (id: string): KanbanColumnId | null => {
      if (id in columns) return id as KanbanColumnId
      for (const colId of Object.keys(columns) as KanbanColumnId[]) {
        if (columns[colId].includes(id)) {
          return colId
        }
      }
      return null
    },
    [columns]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string
    setActiveId(id)
    setPreDragSnapshot(JSON.parse(JSON.stringify(columns)))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(over.id as string)

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return
    }

    setColumns((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]
      const activeIndex = activeItems.indexOf(active.id as string)
      const overIndex = overItems.indexOf(over.id as string)

      let newIndex: number
      if (over.id in prev) {
        newIndex = overItems.length
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height
        const modifier = isBelowOverItem ? 1 : 0
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length
      }

      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter((item) => item !== active.id),
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          prev[activeContainer][activeIndex],
          ...prev[overContainer].slice(newIndex),
        ],
      }
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) {
      if (preDragSnapshot) setColumns(preDragSnapshot)
      setPreDragSnapshot(null)
      return
    }

    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(over.id as string)

    if (!activeContainer || !overContainer) {
      if (preDragSnapshot) setColumns(preDragSnapshot)
      setPreDragSnapshot(null)
      return
    }

    // Sort order update within same container
    if (activeContainer === overContainer) {
      const activeIndex = columns[activeContainer].indexOf(active.id as string)
      const overIndex = columns[overContainer].indexOf(over.id as string)
      if (activeIndex !== overIndex) {
        setColumns((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], activeIndex, overIndex),
        }))
      }
      setPreDragSnapshot(null)
      return
    }

    // Moved to a new column -> execute server transition
    const movedAppId = active.id as string
    const targetCol = overContainer
    const targetStatus: "pending_quote" | "quoted" | "approved" | "rejected" =
      targetCol === "new"
        ? "pending_quote"
        : targetCol === "pending_quote"
          ? "pending_quote"
          : targetCol === "quoted"
            ? "quoted"
            : targetCol === "approved"
              ? "approved"
              : "rejected"

    const app = itemsMap.get(movedAppId)
    const snapshotToRevert = preDragSnapshot

    startTransition(async () => {
      try {
        const res = await updateApplicationStatus({
          applicationId: movedAppId,
          status: targetStatus,
        })

        if (!res.success) {
          // Revert cleanly with inline error banner
          if (snapshotToRevert) {
            setColumns(snapshotToRevert)
          }
          setErrorBanner({
            message:
              res.error ||
              "Status transition was rejected. Please review quote worksheet and seat allocations.",
            cardRef: app?.referenceNumber,
          })
        } else {
          // Update cached app status in itemsMap
          setErrorBanner(null)
          if (app) {
            app.status = targetStatus
            itemsMap.set(movedAppId, { ...app, status: targetStatus })
          }
        }
      } catch (err) {
        if (snapshotToRevert) {
          setColumns(snapshotToRevert)
        }
        setErrorBanner({
          message:
            err instanceof Error ? err.message : "Failed to execute column transition.",
          cardRef: app?.referenceNumber,
        })
      } finally {
        setPreDragSnapshot(null)
      }
    })
  }

  const activeCard = activeId ? itemsMap.get(activeId) : null

  return (
    <div className="flex flex-col gap-4">
      {/* Inline Rollback Error Banner */}
      {errorBanner && (
        <div className="relative flex items-center justify-between rounded-xl border border-red-400 bg-red-50/95 p-3.5 text-xs text-red-950 shadow-sm animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <AlertTriangle className="size-4" />
            </div>
            <div>
              <span className="font-semibold text-red-900">
                {errorBanner.cardRef ? `Action Blocked for [${errorBanner.cardRef}]: ` : "Action Blocked: "}
              </span>
              <span>{errorBanner.message}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="rounded-md p-1 text-red-600 transition-colors hover:bg-red-100 hover:text-red-900"
            aria-label="Dismiss alert"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* DndContext & Board Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5 xl:gap-5">
          {KANBAN_COLUMNS.map((col) => {
            const itemIds = columns[col.id] || []
            const columnApps = itemIds
              .map((id) => itemsMap.get(id))
              .filter((a): a is KanbanApplicationItem => Boolean(a))

            // Calculate total pipeline PKR for the column
            const columnTotalPkr = columnApps.reduce((acc, app) => {
              const quote = app.quotes?.[0]
              return acc + (quote?.grandTotalPkr || 0)
            }, 0)

            return (
              <KanbanColumn
                key={col.id}
                config={col}
                apps={columnApps}
                totalPkr={columnTotalPkr}
                slaHours={slaHours}
              />
            )
          })}
        </div>

        {/* Drag Overlay with Gold/Emerald Elevation */}
        <DragOverlay>
          {activeCard ? (
            <div className="w-72 rotate-1 scale-102 opacity-95 shadow-2xl ring-2 ring-primary">
              <KanbanCardItem card={activeCard} slaHours={slaHours} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ==========================================
// KANBAN COLUMN COMPONENT
// ==========================================

interface KanbanColumnProps {
  config: ColumnConfig
  apps: KanbanApplicationItem[]
  totalPkr: number
  slaHours: number
}

function KanbanColumn({ config, apps, totalPkr, slaHours }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: config.id,
  })

  const Icon = config.icon

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[640px] flex-col rounded-2xl border p-2.5 transition-colors duration-200",
        config.columnClass,
        isOver && "ring-2 ring-primary ring-offset-2 bg-secondary/50"
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          "mb-3 flex flex-col gap-1.5 rounded-xl border p-3 shadow-2xs",
          config.headerBg
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-primary" />
            <span className="font-display text-sm font-bold tracking-tight">
              {config.title}
            </span>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums shadow-2xs",
              config.badgeClass
            )}
          >
            {apps.length}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="truncate">{config.subtitle}</span>
          {totalPkr > 0 && (
            <span className="font-mono font-semibold text-foreground shrink-0 tabular-nums">
              <TabularPrice amount={totalPkr} />
            </span>
          )}
        </div>
      </div>

      {/* Cards List with SortableContext */}
      <SortableContext
        items={apps.map((a) => a.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
          {apps.map((app) => (
            <SortableKanbanCard key={app.id} card={app} slaHours={slaHours} />
          ))}

          {apps.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
              Drop inquiries here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ==========================================
// SORTABLE CARD ITEM WRAPPER
// ==========================================

function SortableKanbanCard({
  card,
  slaHours,
}: {
  card: KanbanApplicationItem
  slaHours: number
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCardItem card={card} slaHours={slaHours} />
    </div>
  )
}

// ==========================================
// LUXURY KANBAN CARD ITEM
// ==========================================

function KanbanCardItem({
  card,
  slaHours,
  isOverlay = false,
}: {
  card: KanbanApplicationItem
  slaHours: number
  isOverlay?: boolean
}) {
  const latestQuote = card.quotes?.[0]
  const grandTotal = latestQuote?.grandTotalPkr ?? 0

  // SLA Overdue check: only applies to pending quotes older than slaHours (default 24h)
  const isOverdue = React.useMemo(() => {
    if (card.status !== "pending_quote") return false
    const createdTime = new Date(card.createdAt).getTime()
    return Date.now() - createdTime > slaHours * 60 * 60 * 1000
  }, [card.status, card.createdAt, slaHours])

  const hoursElapsed = Math.floor(
    (Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60)
  )

  const cleanPhone = formatWhatsAppPhone(card.customerWhatsapp || card.customerPhone)
  const waUrl = `https://wa.me/${cleanPhone}`

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs transition-all hover:border-primary/50 hover:shadow-md",
        isOverlay && "border-primary bg-card/95 shadow-xl",
        isOverdue && "border-red-300 bg-red-50/20 hover:border-red-400"
      )}
    >
      {/* Top Meta Strip: Reference + Source + SLA Indicator */}
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <Link
          href={`/admin/applications/${card.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono font-bold tracking-tight text-primary hover:underline flex items-center gap-1"
        >
          {card.referenceNumber}
          <ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        <div className="flex items-center gap-1 shrink-0">
          {/* Source Badges */}
          {card.sourcePostCode ? (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-900 text-[10px] px-1.5 py-0 h-4 font-mono"
            >
              Post Ref
            </Badge>
          ) : card.source === "custom_builder" ? (
            <Badge
              variant="outline"
              className="border-emerald-300 bg-emerald-50 text-emerald-900 text-[10px] px-1.5 py-0 h-4"
            >
              Builder
            </Badge>
          ) : card.source === "group_booking" ? (
            <Badge
              variant="outline"
              className="border-sky-300 bg-sky-50 text-sky-900 text-[10px] px-1.5 py-0 h-4"
            >
              Group
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-purple-300 bg-purple-50 text-purple-900 text-[10px] px-1.5 py-0 h-4"
            >
              Hajj
            </Badge>
          )}

          {/* SLA Overdue Badge */}
          {isOverdue && (
            <span
              title={`Inquiry has exceeded ${slaHours}h quoting SLA (${hoursElapsed}h elapsed)`}
              className="inline-flex animate-pulse items-center gap-1 rounded-full border border-red-300 bg-red-100 px-1.5 py-0 text-[10px] font-bold text-red-700 shadow-2xs select-none"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-red-600" />
              <span>{hoursElapsed}h+</span>
            </span>
          )}
        </div>
      </div>

      {/* Pilgrim Header */}
      <div className="flex flex-col">
        <Link
          href={`/admin/applications/${card.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-display text-sm font-bold text-foreground transition-colors hover:text-primary leading-tight"
        >
          {card.customerName}
        </Link>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span className="truncate">{card.customerCity || "Pakistan"}</span>
          <span className="text-border">·</span>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-mono text-[11px]"
            title="Chat on WhatsApp"
          >
            <Phone className="size-2.5" />
            <span>{card.customerPhone}</span>
          </a>
        </div>
      </div>

      {/* Pilgrim Party Breakdown & Flight City */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground bg-secondary/40 rounded-lg p-1.5">
        <div className="flex items-center gap-1 font-medium text-foreground">
          <Users className="size-3 text-primary shrink-0" />
          <span>
            {card.adults}A · {card.children}C · {card.infants}I
          </span>
        </div>
        {card.departureCity && (
          <>
            <span className="text-border">·</span>
            <div className="flex items-center gap-1 truncate">
              <Plane className="size-3 text-muted-foreground shrink-0" />
              <span>{card.departureCity.airportCode}</span>
            </div>
          </>
        )}
        {card.groupPackage && (
          <>
            <span className="text-border">·</span>
            <span className="truncate max-w-[120px]" title={card.groupPackage.title}>
              {card.groupPackage.title}
            </span>
          </>
        )}
      </div>

      {/* Quoted PKR Amount & Primary Action Links */}
      <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
        <div>
          {grandTotal > 0 ? (
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Quoted Total
              </span>
              <TabularPrice amount={grandTotal} className="text-sm font-bold text-primary" />
            </div>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-medium"
            >
              Rate Pending
            </Badge>
          )}
        </div>

        {/* 1-Click Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Printable Luxury Voucher Link (when approved) */}
          {card.status === "approved" && (
            <Button
              variant="outline"
              size="xs"
              className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
              render={
                <Link
                  href={`/admin/applications/${card.id}/voucher`}
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  title="Print Official Umrah Luxury Voucher"
                />
              }
            >
              <Printer className="size-3" />
              <span>Voucher</span>
            </Button>
          )}

          {/* Quote Worksheet Link */}
          <Button
            variant="secondary"
            size="xs"
            className="border border-border/80 text-foreground hover:bg-secondary font-medium"
            render={
              <Link
                href={`/admin/applications/${card.id}`}
                onClick={(e) => e.stopPropagation()}
                title="Open Quoting Worksheet"
              />
            }
          >
            <FileEdit className="size-3" />
            <span>Worksheet</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
