"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import NextImage, { type ImageProps } from "next/image"

const Image = (
  typeof NextImage === "object" &&
  NextImage !== null &&
  "default" in NextImage &&
  (NextImage as { default?: React.ComponentType<ImageProps> }).default
    ? (NextImage as { default: React.ComponentType<ImageProps> }).default
    : NextImage
) as React.ComponentType<ImageProps>
import {
  Phone,
  MessageCircle,
  MapPin,
  Search,
  Sparkles,
  Menu,
  Compass,
  Package,
  Layers,
  Building2,
  FileCheck,
  HelpCircle,
  ArrowRight,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet"
import { BRAND_ARABIC_NAME } from "@/lib/constants/brand"
import {
  DEFAULT_COMPANY_INFO,
  formatPkPhoneDisplay,
  toTelHref,
} from "@/lib/company-info"
import { ArabicText } from "@/components/public/arabic-text"
import { MotionPillIndicator } from "@/components/motion"
import {
  computeHaramainPrayerTimes,
  toWaMeUrl,
} from "@/components/public/public-utils"
import { cn } from "@/lib/utils"

export const HEADER_NAV_LINKS = [
  { title: "Umrah Packages", href: "/umrah-packages", icon: Package },
  { title: "Umrah Visa", href: "/umrah-visa", icon: FileCheck },
  { title: "Hajj 2027", href: "/hajj-2027", icon: Layers },
  { title: "Makkah Hotels", href: "/hotels/makkah", icon: Building2 },
  { title: "Ziyarat", href: "/ziyarat", icon: Compass },
  { title: "FAQ", href: "/faq", icon: HelpCircle },
  { title: "Contact", href: "/contact", icon: MessageCircle },
] as const

export function isHeaderNavLinkActive(
  pathname: string | null | undefined,
  href: string
): boolean {
  if (!pathname) return false
  if (href === "/hotels/makkah" && pathname.startsWith("/hotels/")) {
    return true
  }
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
}

interface PublicHeaderProps {
  agencyPhone?: string
  secondaryPhone?: string
  whatsappNumber?: string
  officeAddress?: string
}

export function PublicHeader({
  agencyPhone = DEFAULT_COMPANY_INFO.primaryWhatsapp,
  secondaryPhone = DEFAULT_COMPANY_INFO.secondaryPhone,
  whatsappNumber = DEFAULT_COMPANY_INFO.primaryWhatsapp,
  officeAddress = DEFAULT_COMPANY_INFO.officeAddress,
}: PublicHeaderProps = {}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [isDocked, setIsDocked] = React.useState(false)
  const [prayerSchedule, setPrayerSchedule] = React.useState(() =>
    computeHaramainPrayerTimes()
  )

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setPrayerSchedule(computeHaramainPrayerTimes())
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Topbar scrolls away naturally 1:1 in document flow over the first 36px while <header> docks cleanly at top: 0
  React.useEffect(() => {
    const syncScrollState = () => {
      setIsDocked(window.scrollY > 36)
    }

    syncScrollState()
    window.addEventListener("scroll", syncScrollState, { passive: true })
    return () => window.removeEventListener("scroll", syncScrollState)
  }, [])

  const telHref = toTelHref(agencyPhone)
  const secTelHref = toTelHref(secondaryPhone)
  const primaryDisplay = formatPkPhoneDisplay(agencyPhone)
  const secondaryDisplay = secondaryPhone
    ? formatPkPhoneDisplay(secondaryPhone)
    : ""
  const waHref = toWaMeUrl(
    whatsappNumber,
    "Assalam o Alaikum, I would like to inquire about Al Ramlah Travels pilgrimage packages."
  )

  return (
    <>
      {/* 1. Top Utility Strip — Normal document flow (h-9 = 2.25rem); scrolls away naturally 1:1 with page */}
      <div className="w-full border-b border-primary-foreground/10 bg-primary px-4 text-xs text-primary-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex h-9 max-w-7xl flex-nowrap items-center justify-between gap-3">
          {/* Left: Contact Hotlines & Concierge Location */}
          <div className="flex min-w-0 items-center gap-2.5 whitespace-nowrap sm:gap-3.5">
            <a
              href={telHref}
              className="inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-sm transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              <Phone
                className="size-3.5 shrink-0 text-gold"
                aria-hidden="true"
              />
              <span className="font-mono font-medium tabular-nums">
                {primaryDisplay}
              </span>
            </a>
            {secondaryDisplay && (
              <>
                <span
                  className="hidden text-primary-foreground/35 xl:inline"
                  aria-hidden="true"
                >
                  ·
                </span>
                <a
                  href={secTelHref}
                  className="hidden min-h-6 shrink-0 items-center gap-1.5 rounded-sm text-primary-foreground/90 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 xl:inline-flex motion-reduce:transition-none"
                >
                  <span className="font-mono tabular-nums">
                    {secondaryDisplay}
                  </span>
                </a>
              </>
            )}
            <span
              className="hidden h-3.5 w-px shrink-0 bg-primary-foreground/20 lg:inline-block"
              aria-hidden="true"
            />
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden min-h-6 shrink-0 items-center gap-1.5 rounded-sm transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 lg:inline-flex motion-reduce:transition-none"
            >
              <MessageCircle
                className="size-3.5 shrink-0 text-gold"
                aria-hidden="true"
              />
              <span>24/7 Pilgrim Support</span>
            </a>
            <span
              className="hidden h-3.5 w-px shrink-0 bg-primary-foreground/20 xl:inline-block"
              aria-hidden="true"
            />
            <Link
              href="/#contact"
              title={officeAddress}
              className="hidden min-h-6 min-w-0 items-center gap-1.5 rounded-sm text-primary-foreground/85 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 xl:inline-flex motion-reduce:transition-none"
            >
              <MapPin
                className="size-3.5 shrink-0 text-gold"
                aria-hidden="true"
              />
              <span className="truncate">Askari 10, Lahore Cantt</span>
            </Link>
          </div>

          {/* Right: Zero-CLS Fixed-Width Haramain Prayer Time Pill (`OD-08`, `SEO-030`) & Quick Jump */}
          <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            <div
              className="hidden min-h-6 w-[296px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-gold/35 bg-sidebar/55 px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary-foreground md:inline-flex"
              title="Umm al-Qura astronomical Makkah & Madinah Haramain prayer schedule in Arabia Standard Time (AST / UTC+3)"
            >
              <Clock className="size-3 shrink-0 text-gold" aria-hidden="true" />
              <span className="text-primary-foreground/80">Next:</span>
              <span
                className="font-semibold text-gold"
                suppressHydrationWarning
              >
                {prayerSchedule.nextPrayerName}
              </span>
              <ArabicText
                className="text-[11px] text-gold"
                suppressHydrationWarning
              >
                {prayerSchedule.nextPrayerArabic}
              </ArabicText>
              <span className="text-primary-foreground/95 tabular-nums">
                <span
                  className="font-mono tabular-nums"
                  suppressHydrationWarning
                >
                  {prayerSchedule.makkahTime24}
                </span>
                {" · "}
                <span
                  className="font-mono tabular-nums"
                  suppressHydrationWarning
                >
                  {prayerSchedule.madinahTime24}
                </span>{" "}
                AST
              </span>
              <span className="sr-only" suppressHydrationWarning>
                Makkah {prayerSchedule.makkahTime24}, Madinah{" "}
                {prayerSchedule.madinahTime24} AST
              </span>
            </div>
            <Link
              href="/#track-status"
              className="inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-full border border-gold/30 bg-primary-foreground/10 px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary-foreground transition-colors hover:border-gold/60 hover:bg-primary-foreground/15 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              <Search className="size-3 shrink-0 text-gold" aria-hidden="true" />
              <span>Track Application</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Sticky Main Header — Docks permanently at top: 0 keeping full navigation intact */}
      <header
        className={cn(
          "sticky top-0 z-40 w-full border-b bg-background transition-[border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
          isDocked
            ? "border-border shadow-xs shadow-primary/6"
            : "border-border/85"
        )}
      >
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Bilingual Title */}
          <Link
            href="/"
            className="group flex min-h-11 min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85"
          >
            <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gold-border bg-primary p-1 shadow-xs transition-colors group-hover:border-gold sm:size-12 motion-reduce:transition-none">
              <Image
                src="/logo-mark.png"
                alt="Al Ramlah Travels Emblem"
                width={44}
                height={44}
                loading="eager"
                className="size-full object-contain"
              />
            </div>
            <div className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="truncate font-display text-lg leading-tight font-bold tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-xl motion-reduce:transition-none">
                Al Ramlah Travels
              </span>
              <ArabicText className="text-xs leading-none font-semibold tracking-wide text-gold-text">
                {BRAND_ARABIC_NAME}
              </ArabicText>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-0.5 xl:flex"
          >
            {HEADER_NAV_LINKS.map((link) => {
              const isActive = isHeaderNavLinkActive(pathname, link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative inline-flex min-h-9 items-center rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                    isActive
                      ? "font-semibold text-primary"
                      : "text-foreground/80 hover:bg-secondary/60 hover:text-primary"
                  )}
                >
                  <span>{link.title}</span>
                  {isActive ? (
                    <MotionPillIndicator
                      layoutId="public-header-active-nav"
                      className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-gold"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-gold/60 transition-transform group-hover:scale-x-100 motion-reduce:scale-x-0 motion-reduce:transition-none"
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Action CTA + Mobile Menu Button */}
          <div className="flex items-center gap-2.5">
            <Button
              render={<Link href="/#journey-builder" />}
              nativeButton={false}
              className="hidden min-h-9 gap-1.5 border border-gold-border/60 bg-primary whitespace-nowrap text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-50 sm:inline-flex"
            >
              <Sparkles
                className="size-4 shrink-0 text-gold"
                aria-hidden="true"
              />
              <span>Plan Your Journey</span>
            </Button>

            {/* Mobile / Tablet Navigation Drawer */}
            <div className="xl:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Toggle navigation menu"
                      className="border-border bg-card text-foreground hover:border-gold-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
                    />
                  }
                >
                  <Menu className="size-5" aria-hidden="true" />
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="flex w-full max-w-xs flex-col justify-between bg-card p-6 sm:max-w-sm"
                >
                  <div>
                    <SheetHeader className="border-b border-border p-0 pb-6 text-left">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gold-border bg-primary p-1">
                          <Image
                            src="/logo-mark.png"
                            alt="Al Ramlah Travels Emblem"
                            width={36}
                            height={36}
                            loading="eager"
                            className="size-full object-contain"
                          />
                        </div>
                        <div className="flex flex-col items-start gap-0.5">
                          <SheetTitle className="font-display text-base leading-tight font-bold text-foreground">
                            Al Ramlah Travels
                          </SheetTitle>
                          <SheetDescription>
                            <ArabicText className="text-xs leading-none font-medium text-gold-text">
                              {BRAND_ARABIC_NAME}
                            </ArabicText>
                          </SheetDescription>
                        </div>
                      </div>
                    </SheetHeader>

                    {/* Mobile Haramain Prayer Pill */}
                    <div className="mt-4 rounded-lg border border-gold-border/60 bg-secondary/60 px-3 py-2 text-xs text-foreground">
                      <div className="flex items-center justify-between font-medium">
                        <span className="inline-flex items-center gap-1.5 text-primary">
                          <Clock
                            className="size-3.5 text-gold-text"
                            aria-hidden="true"
                          />
                          <span suppressHydrationWarning>
                            Next Salah: {prayerSchedule.nextPrayerName}
                          </span>
                        </span>
                        <ArabicText
                          className="text-xs font-semibold text-gold-text"
                          suppressHydrationWarning
                        >
                          {prayerSchedule.nextPrayerArabic}
                        </ArabicText>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                        Makkah{" "}
                        <span
                          className="font-mono tabular-nums"
                          suppressHydrationWarning
                        >
                          {prayerSchedule.makkahTime24}
                        </span>
                        {" · "}Madinah{" "}
                        <span
                          className="font-mono tabular-nums"
                          suppressHydrationWarning
                        >
                          {prayerSchedule.madinahTime24}
                        </span>{" "}
                        AST
                      </p>
                    </div>

                    {/* Navigation Items */}
                    <div className="flex flex-col gap-1 py-4">
                      {HEADER_NAV_LINKS.map((link) => {
                        const isActive = isHeaderNavLinkActive(
                          pathname,
                          link.href
                        )
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex min-h-10 items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none",
                              isActive
                                ? "border border-gold-border bg-secondary font-semibold text-primary"
                                : "text-foreground hover:bg-secondary hover:text-primary"
                            )}
                          >
                            <span className="flex items-center gap-3">
                              <link.icon
                                className="size-4 text-gold-text"
                                aria-hidden="true"
                              />
                              {link.title}
                            </span>
                            <ArrowRight
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </Link>
                        )
                      })}
                      <Link
                        href="/#track-status"
                        onClick={() => setMobileOpen(false)}
                        className="flex min-h-10 items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                      >
                        <span className="flex items-center gap-3">
                          <Search
                            className="size-4 text-gold-text"
                            aria-hidden="true"
                          />
                          Track Application Status
                        </span>
                        <ArrowRight
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </Link>
                    </div>
                  </div>

                  {/* Drawer Footer Actions */}
                  <div className="flex flex-col gap-3 border-t border-border pt-6">
                    <Button
                      render={<Link href="/#journey-builder" />}
                      nativeButton={false}
                      onClick={() => setMobileOpen(false)}
                      className="min-h-10 w-full justify-center gap-2 bg-primary whitespace-nowrap text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Sparkles
                        className="size-4 text-gold"
                        aria-hidden="true"
                      />
                      <span>Plan Your Journey</span>
                    </Button>

                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium whitespace-nowrap text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                    >
                      <MessageCircle
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      <span>WhatsApp Concierge</span>
                    </a>

                    <div className="flex flex-col gap-0.5 pt-1 text-center text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground/85">
                        Where Purpose Meets Excellence
                      </span>
                      <span>
                        Hajj, Umrah, Flights, Hotels, and Ziyarat Tours
                      </span>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
