import * as React from "react"
import {
  PublicBreadcrumbs,
  type BreadcrumbEntry,
} from "@/components/layout/breadcrumbs"
import { ArabicText } from "@/components/public/arabic-text"
import { cn } from "@/lib/utils"

export interface PublicPageHeroProps {
  variant?: "persuade-emerald" | "persuade-ivory" | "read"
  breadcrumbs: ReadonlyArray<BreadcrumbEntry>
  title: string
  description: React.ReactNode
  arabicInvocation?: string
  actions?: React.ReactNode
  aside?: React.ReactNode
  className?: string
}

/**
 * Shared Server Component editorial header for secondary public hubs, guides, and policy pages (`Spec 0027` AC-2).
 * Injects zero generic English boilerplate so sibling city, hotel, and Ziyarat spokes preserve >= 60% 4-gram uniqueness.
 */
export function PublicPageHero({
  variant = "read",
  breadcrumbs,
  title,
  description,
  arabicInvocation,
  actions,
  aside,
  className,
}: PublicPageHeroProps): React.ReactElement {
  const isEmerald = variant === "persuade-emerald"
  const isPersuadeIvory = variant === "persuade-ivory"

  return (
    <header
      className={cn(
        "relative w-full overflow-hidden border-b",
        isEmerald
          ? "border-sidebar-border bg-sidebar text-sidebar-foreground"
          : isPersuadeIvory
            ? "border-border bg-secondary/55 text-foreground"
            : "border-border bg-background text-foreground",
        className
      )}
    >
      {isEmerald ? (
        <div
          aria-hidden="true"
          className="bg-haramain-dark-pattern pointer-events-none absolute inset-0 opacity-55"
        />
      ) : null}

      <div
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 sm:px-6 lg:px-8",
          variant === "read" ? "py-8 sm:py-10" : "py-10 sm:py-12 lg:py-14"
        )}
      >
        <PublicBreadcrumbs
          items={breadcrumbs}
          tone={isEmerald ? "dark" : "light"}
        />

        <div
          className={cn(
            "grid grid-cols-1 gap-6 lg:items-end",
            aside ? "lg:grid-cols-12 lg:gap-8" : ""
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-col gap-3.5",
              aside ? "lg:col-span-7" : "max-w-4xl"
            )}
          >
            {arabicInvocation ? (
              <div
                className={cn(
                  "inline-flex self-start items-center border-b pb-1",
                  isEmerald ? "border-gold/45" : "border-gold-border"
                )}
              >
                <ArabicText
                  className={cn(
                    "text-base font-semibold leading-snug sm:text-lg",
                    isEmerald ? "text-gold" : "text-primary"
                  )}
                >
                  {arabicInvocation}
                </ArabicText>
              </div>
            ) : null}

            <h1
              className={cn(
                "font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.625rem] lg:leading-[1.14]",
                isEmerald ? "text-white" : "text-primary"
              )}
            >
              {title}
            </h1>

            <div
              className={cn(
                "max-w-3xl text-sm leading-relaxed sm:text-base",
                isEmerald
                  ? "text-sidebar-foreground/85"
                  : "text-muted-foreground"
              )}
            >
              {description}
            </div>

            {actions ? (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {actions}
              </div>
            ) : null}
          </div>

          {aside ? (
            <div className="min-w-0 lg:col-span-5">{aside}</div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
