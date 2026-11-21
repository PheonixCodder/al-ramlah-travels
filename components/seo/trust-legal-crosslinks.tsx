import * as React from "react"
import Link from "next/link"

export interface TrustLegalCrosslinksProps {
  currentPath: "/privacy" | "/terms" | "/refund-policy"
}

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" as const },
  { label: "Terms of Service", href: "/terms" as const },
  { label: "Cancellation & Refund Policy", href: "/refund-policy" as const },
]

const HUB_LINKS = [
  { label: "Umrah Packages", href: "/umrah-packages" },
  { label: "Saudi Umrah Visa", href: "/umrah-visa" },
  { label: "Hajj 2027 Guide", href: "/hajj-2027" },
  { label: "Pilgrimage FAQs", href: "/faq" },
  { label: "About Lahore Office", href: "/about" },
  { label: "Contact Concierge", href: "/contact" },
]

/**
 * Shared sibling legal policy navigation & commercial hub cross-links (`SEO-028`).
 */
export function TrustLegalCrosslinks({
  currentPath,
}: TrustLegalCrosslinksProps): React.ReactElement {
  return (
    <aside
      aria-label="Legal policies and pilgrimage planning links"
      className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8"
    >
      <div className="flex flex-col gap-2.5">
        <h2 className="font-display text-lg font-bold text-primary">
          Official Legal &amp; Compliance Documents
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {LEGAL_LINKS.map((item) => {
            const isActive = item.href === currentPath
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "inline-flex min-h-8 items-center rounded-full border border-primary bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                    : "inline-flex min-h-8 items-center rounded-full border border-border bg-secondary/55 px-4 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-gold-border hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                }
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-xs font-semibold text-gold-text">
          Explore Haramain Services &amp; Support
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold sm:text-sm">
          {HUB_LINKS.map((hub) => (
            <Link
              key={hub.href}
              href={hub.href}
              className="inline-flex min-h-6 items-center text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
            >
              {hub.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
}
