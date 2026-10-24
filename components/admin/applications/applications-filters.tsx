"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search, X, Filter } from "lucide-react"

import { Input } from "@/components/ui/input"

interface ApplicationsFiltersProps {
  currentQuery?: string
  currentStatus?: string
  currentSource?: string
  currentFilter?: string
  countsByStatus: Record<string, number>
}

const STATUS_TABS = [
  { key: "all", label: "All Inquiries" },
  { key: "pending_quote", label: "Pending Quote" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
]

const SOURCE_OPTIONS = [
  { key: "all", label: "All Sources" },
  { key: "custom_builder", label: "Custom Builder" },
  { key: "group_booking", label: "Group Booking" },
  { key: "hajj_inquiry", label: "Hajj Inquiry" },
]

export function ApplicationsFilters({
  currentQuery = "",
  currentStatus = "all",
  currentSource = "all",
  currentFilter,
  countsByStatus,
}: ApplicationsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = React.useState(currentQuery)

  const updateFilters = (updates: {
    q?: string
    status?: string
    source?: string
    filter?: string
  }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (updates.q !== undefined) {
      if (updates.q) params.set("q", updates.q)
      else params.delete("q")
    }

    if (updates.status !== undefined) {
      if (updates.status && updates.status !== "all") {
        params.set("status", updates.status)
        // Critical: Do NOT preserve filter=overdue when navigating away from pending_quote
        if (updates.status !== "pending_quote") {
          params.delete("filter")
        }
      } else {
        params.delete("status")
        params.delete("filter")
      }
    }

    if (updates.source !== undefined) {
      if (updates.source && updates.source !== "all") params.set("source", updates.source)
      else params.delete("source")
    }

    if (updates.filter !== undefined) {
      if (updates.filter) params.set("filter", updates.filter)
      else params.delete("filter")
    }

    params.delete("page") // reset to page 1 on filter change
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ q: searchTerm.trim() })
  }

  const clearSearch = () => {
    setSearchTerm("")
    updateFilters({ q: "" })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Bar: Search Input & Source Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="admin-global-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search reference (ART-...), pilgrim name, phone, city..."
            className="pl-9 pr-8 text-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </form>

        {/* Source Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Source:</span>
          {SOURCE_OPTIONS.map((src) => {
            const isSelected = currentSource === src.key
            return (
              <button
                key={src.key}
                type="button"
                onClick={() => updateFilters({ source: src.key })}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                {src.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Overdue Active Filter Indicator */}
      {(currentFilter === "overdue" || searchParams.get("filter") === "overdue") && (
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 shadow-2xs">
            <span>Filtered by: SLA Overdue (&gt;24h)</span>
            <button
              type="button"
              onClick={() => updateFilters({ filter: "" })}
              className="inline-flex size-4 items-center justify-center rounded-full bg-red-200 text-red-900 transition-colors hover:bg-red-300"
              title="Clear Overdue Filter"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-1">
        {STATUS_TABS.map((tab) => {
          const isSelected = currentStatus === tab.key
          const count = countsByStatus[tab.key] ?? 0

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateFilters({ status: tab.key })}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                isSelected
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-semibold ${
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
