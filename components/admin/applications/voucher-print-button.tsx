"use client"

import * as React from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function VoucherPrintButton() {
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
    >
      <Printer className="size-3.5" />
      <span>Print / Save as PDF</span>
    </Button>
  )
}
