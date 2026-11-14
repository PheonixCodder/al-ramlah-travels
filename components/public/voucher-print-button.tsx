"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function VoucherPrintButton() {
  return (
    <Button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") {
          window.print()
        }
      }}
      className="gap-2 bg-[#0A3622] text-white hover:bg-[#0F4C31] print:hidden"
    >
      <Printer className="size-4 text-[#C5A059]" />
      <span>Print / Save PDF Voucher</span>
    </Button>
  )
}
