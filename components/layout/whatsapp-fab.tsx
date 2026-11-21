"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"
import { toWaMeUrl } from "@/components/public/public-utils"
import {
  formatWhatsAppAttributionSuffix,
  readStoredAttribution,
} from "@/lib/seo/utm"

interface WhatsAppFabProps {
  whatsappNumber?: string
}

const BASE_GREETING =
  "Assalam o Alaikum, I would like to inquire about Al Ramlah Travels pilgrimage packages."

const NOOP_SUBSCRIBE = () => () => {}

export function WhatsAppFab({
  whatsappNumber = DEFAULT_COMPANY_INFO.primaryWhatsapp,
}: WhatsAppFabProps = {}) {
  const pathname = usePathname()
  const attributionSuffix = React.useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => formatWhatsAppAttributionSuffix(readStoredAttribution(), pathname),
    () => ""
  )

  const whatsappUrl = toWaMeUrl(
    whatsappNumber,
    `${BASE_GREETING}${attributionSuffix}`
  )

  return (
    <div className="group fixed right-6 bottom-6 z-50 flex items-center">
      {/* Tooltip Label on Hover (Desktop) */}
      <span className="pointer-events-none mr-3 hidden translate-x-2 rounded-full border border-gold-border bg-primary px-3.5 py-1.5 text-xs font-medium whitespace-nowrap text-primary-foreground opacity-0 shadow-lg transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transform-none motion-reduce:transition-none sm:inline-block">
        24/7 Pilgrim Concierge · Direct WhatsApp
      </span>

      {/* WhatsApp Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact Al Ramlah Travels on WhatsApp"
        className="relative flex size-14 items-center justify-center rounded-full border-2 border-gold bg-primary text-primary-foreground shadow-lg transition-[background-color,transform] duration-200 hover:scale-105 hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
      >
        {/* Pulsing Online Ping Indicator */}
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex size-4.5"
        >
          <span className="absolute inline-flex size-full rounded-full bg-gold opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex size-3.5 rounded-full border-2 border-primary bg-gold" />
        </span>

        {/* WhatsApp Icon */}
        <MessageCircle
          className="size-7 fill-primary-foreground/10 stroke-[2.2]"
          aria-hidden="true"
        />
      </a>
    </div>
  )
}
