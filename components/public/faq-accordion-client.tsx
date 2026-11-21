"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDown } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
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
      className="divide-y divide-border rounded-2xl border border-border bg-card px-4 py-1 shadow-xs sm:px-6"
    >
      {faqs.map((faq, idx) => (
        <AccordionItem
          key={faq.id || `faq-${idx}`}
          value={`item-${idx}`}
          className="border-b-0 py-0.5"
        >
          <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger
              data-slot="accordion-trigger"
              className="group/faq-trigger flex min-h-11 flex-1 items-center justify-between gap-4 rounded-lg py-4 text-left text-sm font-semibold text-foreground transition-colors outline-none hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
            >
              <span className="inline-flex items-baseline gap-3">
                <span
                  aria-hidden="true"
                  className="shrink-0 font-mono text-xs font-semibold tabular-nums text-gold-text"
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span>{faq.question}</span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none group-aria-expanded/faq-trigger:rotate-180 group-aria-expanded/faq-trigger:text-primary"
              />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionContent
            keepMounted
            className="pb-4 pl-7 text-xs leading-relaxed text-muted-foreground sm:text-sm"
          >
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
