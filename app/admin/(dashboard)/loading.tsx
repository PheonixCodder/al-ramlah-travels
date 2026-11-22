import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminDashboardLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading Al Ramlah Travels operational workspace"
      className="flex w-full flex-col gap-6"
    >
      <span className="sr-only">
        Loading Al Ramlah Travels operational workspace…
      </span>

      {/* Header bar skeleton */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-32 bg-muted" />
          <Skeleton className="h-7 w-64 max-w-full bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg bg-muted" />
          <Skeleton className="h-9 w-36 rounded-lg bg-muted" />
        </div>
      </div>

      {/* 4 Luxury KPI metric cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 bg-muted" />
              <Skeleton className="size-8 rounded-lg bg-muted" />
            </div>
            <Skeleton className="h-7 w-28 bg-muted" />
            <Skeleton className="h-3 w-36 bg-muted" />
          </div>
        ))}
      </div>

      {/* Main operational table / hub panel skeleton */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <Skeleton className="h-5 w-48 bg-muted" />
          <Skeleton className="h-8 w-56 max-w-full rounded-lg bg-muted" />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((rowIdx) => (
            <Skeleton key={rowIdx} className="h-12 w-full rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}
