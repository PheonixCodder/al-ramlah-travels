"use client"

import * as React from "react"
import { MessageCircle } from "lucide-react"

export function WhatsAppFab() {
  const whatsappUrl =
    "https://wa.me/923001234567?text=Assalam%20o%20Alaikum%2C%20I%20would%20like%20to%20inquire%20about%20Al%20Ramlah%20Travels%20pilgrimage%20packages."

  return (
    <div className="group fixed right-6 bottom-6 z-50 flex items-center">
      {/* Tooltip Label on Hover (Desktop) */}
      <span className="pointer-events-none mr-3 hidden translate-x-2 transform rounded-full border border-gold/40 bg-primary/95 px-3.5 py-1.5 text-xs font-medium whitespace-nowrap text-primary-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:inline-block">
        24/7 Pilgrim Concierge · Direct WhatsApp
      </span>

      {/* WhatsApp Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact Al Ramlah Travels on WhatsApp"
        className="relative flex size-14 items-center justify-center rounded-full border-2 border-gold/60 bg-emerald-600 text-white shadow-xl transition-all duration-300 hover:scale-110 hover:bg-emerald-500 focus-visible:ring-3 focus-visible:ring-gold focus-visible:outline-none"
      >
        {/* Pulsing Online Ping Indicator */}
        <span className="absolute -top-0.5 -right-0.5 flex size-4.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-3.5 rounded-full border-2 border-primary bg-emerald-400" />
        </span>

        {/* WhatsApp Icon */}
        <MessageCircle className="size-7 fill-white/10 stroke-[2.2]" />
      </a>
    </div>
  )
}
