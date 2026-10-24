"use client"

import * as React from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"

interface ExportRecord {
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

export function ExportCsvButton({
  data,
  filename = "al-ramlah-applications-export.csv",
}: {
  data: ExportRecord[]
  filename?: string
}) {
  const downloadCsv = () => {
    if (data.length === 0) return

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
      "Submission Date",
    ]

    const csvRows: string[] = []
    csvRows.push(headers.map((h) => `"${h}"`).join(","))

    for (const item of data) {
      const values = [
        item.referenceNumber,
        item.customerName,
        item.customerPhone,
        item.customerCity,
        item.source,
        item.status,
        item.travelDates,
        item.passports,
        item.grandTotalPkr,
        item.createdAt,
      ]
      csvRows.push(
        values
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
    }

    const csvBlob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(csvBlob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={downloadCsv}
      className="border-border bg-card text-xs font-semibold hover:border-gold gap-1.5"
    >
      <Download className="size-3.5 text-muted-foreground" />
      <span>Export CSV Report</span>
    </Button>
  )
}
