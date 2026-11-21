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
  tone?: "light" | "dark"
  className?: string
}

/**
 * Shared accessible breadcrumb trail and Schema.org `BreadcrumbList` JSON-LD (`SEO-001`, `Spec 0027`).
 * Built strictly on `@base-ui/react` (`render` prop via `components/ui/breadcrumb.tsx`)
 * with semantic Haramain tokens and WCAG 2.2 AA contrast on both light ivory and dark emerald surfaces.
 */
export function PublicBreadcrumbs({
  items,
  tone = "light",
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

  const isDark = tone === "dark"

  return (
    <div className={cn("w-full", className)}>
      <JsonLd data={buildBreadcrumbJsonLd(normalizedTrail)} />
      <Breadcrumb>
        <BreadcrumbList
          className={cn(
            "text-xs sm:text-sm",
            isDark ? "text-sidebar-foreground/80" : "text-muted-foreground"
          )}
        >
          {normalizedTrail.map((entry, idx) => {
            const isLast = idx === normalizedTrail.length - 1
            return (
              <React.Fragment key={`${entry.href}-${entry.label}`}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage
                      className={cn(
                        "font-medium",
                        isDark ? "text-gold" : "text-primary"
                      )}
                    >
                      {entry.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      render={<Link href={entry.href} />}
                      className={cn(
                        "inline-flex min-h-6 items-center rounded-sm transition-colors motion-reduce:transition-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2",
                        isDark
                          ? "text-sidebar-foreground/80 hover:text-white focus-visible:outline-gold"
                          : "text-muted-foreground hover:text-primary focus-visible:outline-primary"
                      )}
                    >
                      {entry.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast ? (
                  <BreadcrumbSeparator
                    className={isDark ? "text-gold/75" : "text-gold-text"}
                  />
                ) : null}
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
