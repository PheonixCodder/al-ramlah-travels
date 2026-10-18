"use client"

import * as React from "react"
import { useState } from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "cn"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface PlannerDatePickerProps {
  value: string // Format: YYYY-MM-DD
  onChange: (isoDate: string) => void
  minDate?: string // Format: YYYY-MM-DD
  label?: string
  badgeText?: string
  disabled?: boolean
  className?: string
  placeholder?: string
  id?: string
}

/**
 * Parses YYYY-MM-DD string into a local Date object without UTC timezone shifts.
 */
export function parseLocalIsoDate(isoStr: string): Date {
  const parts = isoStr.split("-").map(Number)
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2])
  }
  return new Date()
}

/**
 * Formats a local Date object into a YYYY-MM-DD string without UTC timezone shifts.
 */
export function formatToLocalIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Formats a YYYY-MM-DD string into a clean display format (e.g. "15 Nov 2026").
 */
export function formatDisplayDate(isoStr: string): string {
  if (!isoStr) return ""
  try {
    const d = parseLocalIsoDate(isoStr)
    return format(d, "dd MMM yyyy")
  } catch {
    return isoStr
  }
}

export function PlannerDatePicker({
  value,
  onChange,
  minDate,
  label,
  badgeText,
  disabled = false,
  className,
  placeholder = "Select date",
  id,
}: PlannerDatePickerProps) {
  const [open, setOpen] = useState(false)

  const selectedDate = React.useMemo(() => {
    return value ? parseLocalIsoDate(value) : undefined
  }, [value])

  const formattedDisplay = React.useMemo(() => {
    return value ? formatDisplayDate(value) : ""
  }, [value])

  const minDateObj = React.useMemo(() => {
    if (!minDate) return undefined
    const d = parseLocalIsoDate(minDate)
    d.setHours(0, 0, 0, 0)
    return d
  }, [minDate])

  const triggerButton = (
    <PopoverTrigger
      render={
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors hover:bg-white hover:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059] disabled:opacity-50 disabled:pointer-events-none",
            className
          )}
        />
      }
    >
      <span className="flex items-center gap-1.5 truncate">
        <CalendarIcon className="size-3.5 text-[#C5A059] shrink-0" />
        <span className={cn("truncate", !formattedDisplay && "text-[#686E65]")}>
          {formattedDisplay || placeholder}
        </span>
      </span>
      {badgeText && (
        <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#0A3622] border border-[#E6DEC8]">
          {badgeText}
        </span>
      )}
    </PopoverTrigger>
  )

  const datePickerContent = (
    <Popover open={open} onOpenChange={setOpen}>
      {triggerButton}
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-2.5 border-[#E6DEC8] bg-white shadow-xl shadow-[#0A3622]/10 rounded-2xl z-50"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(day) => {
            if (day) {
              onChange(formatToLocalIso(day))
              setOpen(false)
            }
          }}
          disabled={(date) => {
            if (!minDateObj) return false
            const target = new Date(date)
            target.setHours(0, 0, 0, 0)
            return target.getTime() < minDateObj.getTime()
          }}
          autoFocus
          classNames={{
            today: "rounded-md bg-[#FAF7F0] font-bold text-[#8F6E2A] border border-[#E6DEC8]",
          }}
        />
      </PopoverContent>
    </Popover>
  )

  if (label) {
    return (
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center justify-between">
          <label
            htmlFor={id}
            className="block text-[11px] font-medium text-[#686E65]"
          >
            {label}
          </label>
          {badgeText && !disabled && (
            <span className="text-[9px] font-bold text-[#8F6E2A] bg-[#FAF7F0] px-1.5 py-0.5 rounded border border-[#E6DEC8]">
              {badgeText}
            </span>
          )}
        </div>
        {datePickerContent}
      </div>
    )
  }

  return datePickerContent
}
