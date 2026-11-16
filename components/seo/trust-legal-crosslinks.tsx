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
      className="mt-10 rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-8 shadow-xs space-y-5"
    >
      <div className="space-y-2">
        <h2 className="font-display text-lg font-bold text-[#0A3622]">
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
                    ? "inline-flex min-h-6 items-center rounded-full border border-[#0A3622] bg-[#0A3622] px-4 py-1.5 text-xs font-semibold text-white"
                    : "inline-flex min-h-6 items-center rounded-full border border-[#E6DEC8] bg-[#FAF7F0] px-4 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#7A5C1E] hover:text-[#7A5C1E] transition-colors"
                }
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="border-t border-[#E6DEC8] pt-4 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#7A5C1E] block">
          Explore Haramain Services &amp; Support
        </span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm font-semibold">
          {HUB_LINKS.map((hub) => (
            <Link
              key={hub.href}
              href={hub.href}
              className="inline-flex min-h-6 items-center text-[#0A3622] underline decoration-[#7A5C1E]/60 underline-offset-4 hover:text-[#7A5C1E]"
            >
              {hub.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
}
