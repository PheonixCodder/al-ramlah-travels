"use client"

import * as React from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export interface FaqAccordionItemData {
  id: string
  category?: string
  question: string
  answer: string
}

export interface FaqAccordionClientProps {
  faqs: ReadonlyArray<FaqAccordionItemData>
}

/**
 * Minimal interactive leaf island for homepage FAQs (`SEO-023`, `S03-001`).
 * Uses Base UI `keepMounted` so 100% of FAQ answers remain present in initial SSR HTML
 * for 1:1 Schema.org `FAQPage` parity and AI/search crawler indexing.
 */
export function FaqAccordionClient({
  faqs,
}: FaqAccordionClientProps): React.ReactElement | null {
  if (faqs.length === 0) {
    return null
  }

  return (
    <Accordion
      defaultValue={["item-0"]}
      className="rounded-2xl border border-border bg-card p-2 sm:p-4 shadow-xs"
    >
      {faqs.map((faq, idx) => (
        <AccordionItem
          key={faq.id || `faq-${idx}`}
          value={`item-${idx}`}
          className="px-2"
        >
          <AccordionTrigger className="min-h-6 text-left font-semibold text-sm sm:text-base text-foreground hover:text-primary py-4">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent
            keepMounted
            className="text-xs sm:text-sm text-muted-foreground leading-relaxed pb-4"
          >
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
