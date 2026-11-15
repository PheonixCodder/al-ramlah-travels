import * as React from "react"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { buildBreadcrumbJsonLd, JsonLd } from "@/lib/seo/json-ld"
import { cn } from "@/lib/utils"

export interface BreadcrumbEntry {
  label: string
  href: string
}

export interface PublicBreadcrumbsProps {
  items: ReadonlyArray<BreadcrumbEntry>
  className?: string
}

/**
 * Shared accessible breadcrumb trail + Schema.org `BreadcrumbList` JSON-LD (`SEO-001`, `S09-005`).
 * Built strictly on `@base-ui/react` (`render` prop via `components/ui/breadcrumb.tsx` — zero `asChild`)
 * with Haramain luxury light-theme WCAG 2.2 AA contrast tokens (`#0A3622` / `#7A5C1E` / `#4A5248`).
 */
export function PublicBreadcrumbs({
  items,
  className,
}: PublicBreadcrumbsProps): React.ReactElement | null {
  const cleaned = items.filter(
    (entry) => entry.label.trim().length > 0 && entry.href.trim().length > 0
  )
  if (cleaned.length === 0) {
    return null
  }

  const normalizedTrail: BreadcrumbEntry[] =
    cleaned[0]?.href === "/"
      ? [...cleaned]
      : [{ label: "Home", href: "/" }, ...cleaned]

  return (
    <div className={cn("w-full", className)}>
      <JsonLd data={buildBreadcrumbJsonLd(normalizedTrail)} />
      <Breadcrumb>
        <BreadcrumbList className="text-xs sm:text-sm text-[#4A5248]">
          {normalizedTrail.map((entry, idx) => {
            const isLast = idx === normalizedTrail.length - 1
            return (
              <React.Fragment key={`${entry.href}-${entry.label}`}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="font-medium text-[#0A3622]">
                      {entry.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      render={<Link href={entry.href} />}
                      className="text-[#4A5248] transition-colors hover:text-[#0A3622] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A5C1E]"
                    >
                      {entry.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast ? (
                  <BreadcrumbSeparator className="text-[#7A5C1E]" />
                ) : null}
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
