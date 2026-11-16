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
  type Announcements,
  type DraggableAttributes,
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
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"
import { CSS } from "@dnd-kit/utilities"
import {
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Send,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  FileEdit,
  Printer,
  Users,
  Plane,
  Phone,
  ArrowUpRight,
  X,
  GripVertical,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TabularPrice } from "@/components/layout/status-badge"
import { updateApplicationStatus } from "@/app/actions/quotes"
import { formatWhatsAppPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"

export const KANBAN_COLUMN_IDS = [
  "pending_quote",
  "quoted",
  "revision_requested",
  "approved",
  "rejected",
  "cancelled",
] as const

export type KanbanColumnId = (typeof KANBAN_COLUMN_IDS)[number]

export type KanbanApplicationStatus =
  | "pending_quote"
  | "quoted"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "cancelled"

export interface KanbanApplicationItem {
  id: string
  referenceNumber: string
  source: "custom_builder" | "group_booking" | "hajj_inquiry"
  status: KanbanApplicationStatus
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

export interface ColumnConfig {
  id: KanbanColumnId
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  badgeClass: string
  columnClass: string
  headerBg: string
}

export const KANBAN_COLUMNS: ColumnConfig[] = [
  {
    id: "pending_quote",
    title: "Pending Quote",
    subtitle: "Fresh inquiries & active costing",
    icon: Clock,
    badgeClass: "bg-amber-200 text-amber-950 border-amber-400",
    columnClass: "border-amber-300/80 bg-amber-50/20",
    headerBg: "bg-amber-100/70 border-amber-300 text-amber-950",
  },
  {
    id: "quoted",
    title: "Quoted",
    subtitle: "Formal proposal dispatched",
    icon: Send,
    badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
    columnClass: "border-sky-200/80 bg-sky-50/20",
    headerBg: "bg-sky-50/80 border-sky-200 text-sky-950",
  },
  {
    id: "revision_requested",
    title: "Revision Requested",
    subtitle: "Pilgrim requested changes",
    icon: RotateCcw,
    badgeClass: "bg-purple-100 text-purple-900 border-purple-300",
    columnClass: "border-purple-200/80 bg-purple-50/20",
    headerBg: "bg-purple-50/80 border-purple-200 text-purple-950",
  },
  {
    id: "approved",
    title: "Approved",
    subtitle: "Confirmed & seats reserved",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
    columnClass: "border-emerald-200/80 bg-emerald-50/20",
    headerBg: "bg-emerald-50/80 border-emerald-200 text-emerald-950",
  },
  {
    id: "rejected",
    title: "Rejected",
    subtitle: "Declined proposals",
    icon: XCircle,
    badgeClass: "bg-red-100 text-red-900 border-red-300",
    columnClass: "border-red-200/80 bg-red-50/15",
    headerBg: "bg-red-50/80 border-red-200 text-red-950",
  },
  {
    id: "cancelled",
    title: "Cancelled",
    subtitle: "Cancelled bookings",
    icon: Ban,
    badgeClass: "bg-slate-200 text-slate-800 border-slate-300",
    columnClass: "border-slate-200 bg-slate-50/30",
    headerBg: "bg-slate-100/80 border-slate-200 text-slate-800",
  },
]

/**
 * Maps an application status 1-to-1 to its canonical Kanban column (`T-059`):
 * - `pending_quote` unifies fresh (`new`) and active costing inquiries so dragging never no-ops
 * - `revision_requested` gets its own dedicated column
 * - `cancelled` and `rejected` remain strictly distinct
 */
export function mapAppToColumn(
  app: Pick<KanbanApplicationItem, "status">
): KanbanColumnId {
  switch (app.status) {
    case "quoted":
      return "quoted"
    case "revision_requested":
      return "revision_requested"
    case "approved":
      return "approved"
    case "rejected":
      return "rejected"
    case "cancelled":
      return "cancelled"
    case "pending_quote":
    default:
      return "pending_quote"
  }
}

export function groupApplicationsByKanbanColumn<
  T extends Pick<KanbanApplicationItem, "id" | "status">,
>(apps: readonly T[]): Record<KanbanColumnId, string[]> {
  const grouped: Record<KanbanColumnId, string[]> = {
    pending_quote: [],
    quoted: [],
    revision_requested: [],
    approved: [],
    rejected: [],
    cancelled: [],
  }
  for (const app of apps) {
    const col = mapAppToColumn(app)
    grouped[col].push(app.id)
  }
  return grouped
}

function cloneColumnsRecord(
  source: Record<KanbanColumnId, string[]>
): Record<KanbanColumnId, string[]> {
  return {
    pending_quote: [...source.pending_quote],
    quoted: [...source.quoted],
    revision_requested: [...source.revision_requested],
    approved: [...source.approved],
    rejected: [...source.rejected],
    cancelled: [...source.cancelled],
  }
}

interface ApplicationsKanbanBoardProps {
  applications: KanbanApplicationItem[]
  slaHours?: number
}

export function ApplicationsKanbanBoard({
  applications,
  slaHours = 24,
}: ApplicationsKanbanBoardProps) {
  const [itemsMap, setItemsMap] = React.useState<
    Map<string, KanbanApplicationItem>
  >(() => {
    const map = new Map<string, KanbanApplicationItem>()
    applications.forEach((app) => map.set(app.id, app))
    return map
  })

  const [columns, setColumns] = React.useState<Record<KanbanColumnId, string[]>>(
    () => groupApplicationsByKanbanColumn(applications)
  )

  React.useEffect(() => {
    const map = new Map<string, KanbanApplicationItem>()
    applications.forEach((app) => map.set(app.id, app))
    setItemsMap(map)
    setColumns(groupApplicationsByKanbanColumn(applications))
  }, [applications])

  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [preDragSnapshot, setPreDragSnapshot] = React.useState<Record<
    KanbanColumnId,
    string[]
  > | null>(null)
  const [errorBanner, setErrorBanner] = React.useState<{
    message: string
    cardRef?: string
  } | null>(null)
  const [isTransitioning, startTransition] = React.useTransition()

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
      for (const colId of KANBAN_COLUMN_IDS) {
        if (columns[colId].includes(id)) {
          return colId
        }
      }
      return null
    },
    [columns]
  )

  const commitColumnMove = React.useCallback(
    (
      movedAppId: string,
      targetStatus: KanbanColumnId,
      snapshotToRevert: Record<KanbanColumnId, string[]>
    ) => {
      const app = itemsMap.get(movedAppId)
      startTransition(async () => {
        try {
          const res = await updateApplicationStatus({
            applicationId: movedAppId,
            status: targetStatus,
          })

          if (!res.success) {
            setColumns(snapshotToRevert)
            setErrorBanner({
              message:
                res.error ||
                "Status transition was rejected. Please review quote worksheet and seat allocations.",
              cardRef: app?.referenceNumber,
            })
          } else {
            setErrorBanner(null)
            setItemsMap((prev) => {
              const next = new Map(prev)
              const current = next.get(movedAppId)
              if (current) {
                next.set(movedAppId, { ...current, status: targetStatus })
              }
              return next
            })
          }
        } catch (err) {
          setColumns(snapshotToRevert)
          setErrorBanner({
            message:
              err instanceof Error
                ? err.message
                : "Failed to execute column transition.",
            cardRef: app?.referenceNumber,
          })
        } finally {
          setPreDragSnapshot(null)
        }
      })
    },
    [itemsMap]
  )

  const handleSelectStatusChange = React.useCallback(
    (appId: string, targetCol: KanbanColumnId) => {
      const currentCol = findContainer(appId)
      if (!currentCol || currentCol === targetCol) return

      const snapshot = cloneColumnsRecord(columns)
      setColumns((prev) => ({
        ...prev,
        [currentCol]: prev[currentCol].filter((id) => id !== appId),
        [targetCol]: [appId, ...prev[targetCol].filter((id) => id !== appId)],
      }))
      commitColumnMove(appId, targetCol, snapshot)
    },
    [columns, commitColumnMove, findContainer]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    setActiveId(id)
    setPreDragSnapshot(cloneColumnsRecord(columns))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeItemId = String(active.id)
    const overItemId = String(over.id)
    const activeContainer = findContainer(activeItemId)
    const overContainer = findContainer(overItemId)

    if (
      !activeContainer ||
      !overContainer ||
      activeContainer === overContainer
    ) {
      return
    }

    setColumns((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]
      const activeIndex = activeItems.indexOf(activeItemId)
      if (activeIndex === -1) {
        return prev
      }
      const overIndex = overItems.indexOf(overItemId)

      let newIndex: number
      if (overItemId in prev) {
        newIndex = overItems.length
      } else {
        const isBelowOverItem =
          Boolean(active.rect.current.translated) &&
          (active.rect.current.translated?.top ?? 0) >
            over.rect.top + over.rect.height
        const modifier = isBelowOverItem ? 1 : 0
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length
      }

      const movedId = activeItems[activeIndex]
      const deduplicatedOver = overItems.filter((id) => id !== movedId)
      const clampedIndex = Math.min(newIndex, deduplicatedOver.length)

      return {
        ...prev,
        [activeContainer]: activeItems.filter((item) => item !== activeItemId),
        [overContainer]: [
          ...deduplicatedOver.slice(0, clampedIndex),
          movedId,
          ...deduplicatedOver.slice(clampedIndex),
        ],
      }
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) {
      if (preDragSnapshot) setColumns(preDragSnapshot)
      setPreDragSnapshot(null)
      return
    }

    const activeItemId = String(active.id)
    const overItemId = String(over.id)
    const originContainer = preDragSnapshot
      ? KANBAN_COLUMN_IDS.find((col) =>
          preDragSnapshot[col].includes(activeItemId)
        ) ?? findContainer(activeItemId)
      : findContainer(activeItemId)
    const overContainer = findContainer(overItemId)

    if (!originContainer || !overContainer) {
      if (preDragSnapshot) setColumns(preDragSnapshot)
      setPreDragSnapshot(null)
      return
    }

    if (originContainer === overContainer) {
      const currentContainer = findContainer(activeItemId)
      if (currentContainer) {
        const activeIndex = columns[currentContainer].indexOf(activeItemId)
        const overIndex = columns[currentContainer].indexOf(overItemId)
        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          setColumns((prev) => ({
            ...prev,
            [currentContainer]: arrayMove(
              prev[currentContainer],
              activeIndex,
              overIndex
            ),
          }))
        }
      }
      setPreDragSnapshot(null)
      return
    }

    const snapshotToRevert = preDragSnapshot ?? cloneColumnsRecord(columns)
    commitColumnMove(activeItemId, overContainer, snapshotToRevert)
  }

  const announcements: Announcements = React.useMemo(
    () => ({
      onDragStart({ active }) {
        const card = itemsMap.get(String(active.id))
        return `Picked up application ${card?.referenceNumber ?? String(active.id)}.`
      },
      onDragOver({ active, over }) {
        const card = itemsMap.get(String(active.id))
        if (!over) {
          return `Application ${card?.referenceNumber ?? String(active.id)} is no longer over a droppable column.`
        }
        const colId = findContainer(String(over.id))
        const colTitle =
          KANBAN_COLUMNS.find((c) => c.id === colId)?.title ?? String(over.id)
        return `Application ${card?.referenceNumber ?? String(active.id)} moved over ${colTitle} column.`
      },
      onDragEnd({ active, over }) {
        const card = itemsMap.get(String(active.id))
        if (!over) {
          return `Dropped application ${card?.referenceNumber ?? String(active.id)} without changing status.`
        }
        const colId = findContainer(String(over.id))
        const colTitle =
          KANBAN_COLUMNS.find((c) => c.id === colId)?.title ?? String(over.id)
        return `Dropped application ${card?.referenceNumber ?? String(active.id)} into ${colTitle}.`
      },
      onDragCancel({ active }) {
        const card = itemsMap.get(String(active.id))
        return `Cancelled dragging application ${card?.referenceNumber ?? String(active.id)}.`
      },
    }),
    [findContainer, itemsMap]
  )

  const activeCard = activeId ? itemsMap.get(activeId) : null

  return (
    <div className="flex flex-col gap-4">
      {/* Inline Rollback Error Banner */}
      {errorBanner && (
        <div
          role="alert"
          className="relative flex items-center justify-between rounded-xl border border-red-400 bg-red-50/95 p-3.5 text-xs text-red-950 shadow-sm animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <AlertTriangle className="size-4" />
            </div>
            <div>
              <span className="font-semibold text-red-900">
                {errorBanner.cardRef
                  ? `Action Blocked for [${errorBanner.cardRef}]: `
                  : "Action Blocked: "}
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
        id="desk-kanban-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 xl:gap-4">
          {KANBAN_COLUMNS.map((col) => {
            const itemIds = columns[col.id] || []
            const columnApps = itemIds
              .map((id) => itemsMap.get(id))
              .filter((a): a is KanbanApplicationItem => Boolean(a))

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
                isTransitioning={isTransitioning}
                onSelectStatusChange={handleSelectStatusChange}
              />
            )
          })}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeCard ? (
            <div className="w-72 rotate-1 scale-102 opacity-95 shadow-2xl ring-2 ring-primary">
              <KanbanCardItem
                card={activeCard}
                slaHours={slaHours}
                isOverlay
              />
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
  isTransitioning: boolean
  onSelectStatusChange: (appId: string, targetCol: KanbanColumnId) => void
}

function KanbanColumn({
  config,
  apps,
  totalPkr,
  slaHours,
  isTransitioning,
  onSelectStatusChange,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: config.id,
  })

  const Icon = config.icon

  return (
    <section
      ref={setNodeRef}
      aria-label={`${config.title} column (${apps.length} applications)`}
      className={cn(
        "flex min-h-[580px] flex-col rounded-2xl border p-2.5 transition-colors duration-200",
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
            <SortableKanbanCard
              key={app.id}
              card={app}
              slaHours={slaHours}
              isTransitioning={isTransitioning}
              onSelectStatusChange={onSelectStatusChange}
            />
          ))}

          {apps.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
              Drop inquiries here
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  )
}

// ==========================================
// SORTABLE CARD ITEM WRAPPER
// ==========================================

function SortableKanbanCard({
  card,
  slaHours,
  isTransitioning,
  onSelectStatusChange,
}: {
  card: KanbanApplicationItem
  slaHours: number
  isTransitioning: boolean
  onSelectStatusChange: (appId: string, targetCol: KanbanColumnId) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
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
    <div ref={setNodeRef} style={style}>
      <KanbanCardItem
        card={card}
        slaHours={slaHours}
        dragHandleRef={setActivatorNodeRef}
        dragAttributes={attributes}
        dragListeners={listeners}
        isTransitioning={isTransitioning}
        onSelectStatusChange={onSelectStatusChange}
      />
    </div>
  )
}

// ==========================================
// LUXURY KANBAN CARD ITEM (WCAG SEPARATED DRAG HANDLE)
// ==========================================

function KanbanCardItem({
  card,
  slaHours,
  isOverlay = false,
  dragHandleRef,
  dragAttributes,
  dragListeners,
  isTransitioning = false,
  onSelectStatusChange,
}: {
  card: KanbanApplicationItem
  slaHours: number
  isOverlay?: boolean
  dragHandleRef?: (element: HTMLElement | null) => void
  dragAttributes?: DraggableAttributes
  dragListeners?: SyntheticListenerMap
  isTransitioning?: boolean
  onSelectStatusChange?: (appId: string, targetCol: KanbanColumnId) => void
}) {
  const latestQuote = card.quotes?.[0]
  const grandTotal = latestQuote?.grandTotalPkr ?? 0
  const paymentStatus = latestQuote?.paymentStatus ?? "unpaid"

  const voucherReady =
    card.status === "approved" &&
    grandTotal > 0 &&
    (paymentStatus === "deposit_paid" || paymentStatus === "paid_in_full")

  const createdMs = React.useMemo(
    () => new Date(card.createdAt).getTime(),
    [card.createdAt]
  )

  const elapsedMs = Number.isFinite(createdMs)
    ? Math.max(0, Date.now() - createdMs)
    : 0
  const hoursElapsed = Math.floor(elapsedMs / (1000 * 60 * 60))
  const isFreshInquiry =
    card.status === "pending_quote" && grandTotal <= 0 && hoursElapsed < 2
  const isOverdue =
    card.status === "pending_quote" &&
    elapsedMs > slaHours * 60 * 60 * 1000

  const isWhatsAppIntake = card.referenceNumber
    .toUpperCase()
    .startsWith("ART-WA-")

  const cleanPhone = formatWhatsAppPhone(
    card.customerWhatsapp || card.customerPhone
  )
  const waUrl = `https://wa.me/${cleanPhone}`
  const currentColumn = mapAppToColumn(card)

  return (
    <article
      aria-label={`Application ${card.referenceNumber} for ${card.customerName}`}
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs transition-all hover:border-primary/50 hover:shadow-md",
        isOverlay && "border-primary bg-card/95 shadow-xl",
        isOverdue && "border-red-300 bg-red-50/20 hover:border-red-400"
      )}
    >
      {/* Top Meta Strip: Dedicated Drag Handle + Reference + Source + SLA Indicator */}
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <div className="flex items-center gap-1 min-w-0">
          <button
            ref={dragHandleRef}
            type="button"
            aria-label={`Drag application ${card.referenceNumber}`}
            className="inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
            {...(dragAttributes ?? {})}
            {...(dragListeners ?? {})}
          >
            <GripVertical className="size-3.5" />
          </button>

          <Link
            href={`/admin/applications/${card.id}`}
            className="font-mono font-bold tracking-tight text-primary hover:underline flex items-center gap-1 truncate"
          >
            <span className="truncate">{card.referenceNumber}</span>
            <ArrowUpRight className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isFreshInquiry && (
            <Badge
              variant="outline"
              className="border-amber-400 bg-amber-100 text-amber-950 text-[10px] px-1.5 py-0 h-4 inline-flex items-center gap-0.5"
            >
              <Sparkles className="size-2.5" />
              <span>New</span>
            </Badge>
          )}

          {isWhatsAppIntake ? (
            <Badge
              variant="outline"
              className="border-emerald-400 bg-emerald-100 text-emerald-950 text-[10px] px-1.5 py-0 h-4 font-mono"
            >
              WA Intake
            </Badge>
          ) : card.sourcePostCode ? (
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

          {isOverdue && (
            <span
              title={`Inquiry has exceeded ${slaHours}h quoting SLA (${hoursElapsed}h elapsed)`}
              className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-1.5 py-0 text-[10px] font-bold text-red-900 shadow-2xs select-none"
            >
              <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-red-600 motion-reduce:animate-none" />
              <span>{hoursElapsed}h+</span>
            </span>
          )}
        </div>
      </div>

      {/* Pilgrim Header */}
      <div className="flex flex-col">
        <Link
          href={`/admin/applications/${card.id}`}
          dir="auto"
          className="font-display text-sm font-bold text-foreground transition-colors hover:text-primary leading-tight"
        >
          {card.customerName}
        </Link>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span dir="auto" className="truncate">
            {card.customerCity || "Pakistan"}
          </span>
          <span className="text-border">·</span>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
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
            <span
              className="truncate max-w-[120px]"
              title={card.groupPackage.title}
            >
              {card.groupPackage.title}
            </span>
          </>
        )}
      </div>

      {/* Keyboard-Accessible Column Status Mover (`T-086` WCAG keyboard parity) */}
      {!isOverlay && onSelectStatusChange && (
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`kanban-move-${card.id}`}
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Stage
          </label>
          <select
            id={`kanban-move-${card.id}`}
            aria-label={`Move application ${card.referenceNumber} to status`}
            value={currentColumn}
            disabled={isTransitioning}
            onChange={(e) =>
              onSelectStatusChange(
                card.id,
                e.target.value as KanbanColumnId
              )
            }
            className="h-6 rounded-md border border-border bg-background px-1.5 text-[11px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            {KANBAN_COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>
                {col.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Quoted PKR Amount & Primary Action Links */}
      <div className="mt-0.5 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
        <div>
          {grandTotal > 0 ? (
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Quoted Total
              </span>
              <TabularPrice
                amount={grandTotal}
                className="text-sm font-bold text-primary"
              />
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
          {voucherReady && (
            <Button
              variant="outline"
              size="xs"
              className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
              render={
                <Link
                  href={`/admin/applications/${card.id}/voucher`}
                  target="_blank"
                  title="Print Official Umrah Luxury Voucher"
                />
              }
              nativeButton={false}
            >
              <Printer className="size-3" />
              <span>Voucher</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="xs"
            className="border border-border/80 text-foreground hover:bg-secondary font-medium"
            render={
              <Link
                href={`/admin/applications/${card.id}`}
                title="Open Quoting Worksheet"
              />
            }
            nativeButton={false}
          >
            <FileEdit className="size-3" />
            <span>Worksheet</span>
          </Button>
        </div>
      </div>
    </article>
  )
}
