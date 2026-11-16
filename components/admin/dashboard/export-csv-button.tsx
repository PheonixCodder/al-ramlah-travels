"use client"

import * as React from "react"
import { Download, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { exportApplicationsCsvAction } from "@/app/actions/quotes"
import {
  buildSanitizedCsv,
  formatPktDateTimeLabel,
  sanitizeCsvCell,
} from "./overview-metrics"

export { sanitizeCsvCell, buildSanitizedCsv }

export interface ExportRecord {
  referenceNumber: string
  customerName: string
  customerPhone: string
  customerCity: string
  source: string
  status: string
  travelDates: string
  passports: number
  grandTotalPkr: number
  createdAt: string
}

export interface ExportCsvButtonProps {
  data?: ExportRecord[]
  filename?: string
  canExport?: boolean
  fromDate?: string
  toDate?: string
  status?:
    | "pending_quote"
    | "quoted"
    | "revision_requested"
    | "approved"
    | "rejected"
    | "cancelled"
}

function triggerBrowserCsvDownload(csvContent: string, downloadFilename: string) {
  const csvBlob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(csvBlob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", downloadFilename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function ExportCsvButton({
  data,
  filename = "al-ramlah-applications-export.csv",
  canExport = true,
  fromDate,
  toDate,
  status,
}: ExportCsvButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false)
  const [exportError, setExportError] = React.useState<string | null>(null)

  if (!canExport) {
    return null
  }

  const handleDownloadCsv = async () => {
    setExportError(null)

    if (data && data.length > 0) {
      const headers = [
        "Reference Number",
        "Customer Name",
        "Customer Phone",
        "City",
        "Intake Source",
        "Status",
        "Travel Dates",
        "Total Pilgrims",
        "Grand Total (PKR)",
        "Submission Date (PKT)",
      ]
      const rows = data.map((item) => [
        item.referenceNumber,
        item.customerName,
        item.customerPhone,
        item.customerCity,
        item.source,
        item.status,
        item.travelDates,
        item.passports,
        item.grandTotalPkr,
        formatPktDateTimeLabel(item.createdAt) || item.createdAt,
      ])
      triggerBrowserCsvDownload(buildSanitizedCsv(headers, rows), filename)
      return
    }

    setIsExporting(true)
    try {
      const res = await exportApplicationsCsvAction({
        fromDate,
        toDate,
        status,
      })
      if (!res.success) {
        setExportError(res.error || "Failed to export CSV.")
        return
      }
      triggerBrowserCsvDownload(res.csvContent, res.filename || filename)
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to export CSV."
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={isExporting}
        onClick={handleDownloadCsv}
        className="border-border bg-card text-xs font-semibold hover:border-gold gap-1.5"
      >
        {isExporting ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : (
          <Download className="size-3.5 text-muted-foreground" />
        )}
        <span>{isExporting ? "Exporting..." : "Export CSV Report"}</span>
      </Button>
      {exportError && (
        <span role="alert" className="text-[11px] font-medium text-red-700">
          {exportError}
        </span>
      )}
    </div>
  )
}
