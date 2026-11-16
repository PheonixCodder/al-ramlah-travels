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
  const [prayerSchedule, setPrayerSchedule] = React.useState(() =>
    computeHaramainPrayerTimes()
  )

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setPrayerSchedule(computeHaramainPrayerTimes())
    }, 60_000)
    return () => window.clearInterval(timer)
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
    <div className="w-full">
      {/* Top Utility Strip */}
      <div className="border-b border-primary-foreground/10 bg-primary px-4 py-1.5 text-xs text-primary-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {/* Left: Contact Hotlines */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href={telHref}
              className="inline-flex min-h-6 items-center gap-1.5 transition-colors hover:text-gold"
            >
              <Phone className="size-3.5 shrink-0 text-gold" />
              <span className="font-mono tabular-nums">{primaryDisplay}</span>
            </a>
            {secondaryDisplay && (
              <>
                <span className="text-primary-foreground/30">·</span>
                <a
                  href={secTelHref}
                  className="inline-flex min-h-6 items-center gap-1.5 transition-colors hover:text-gold"
                >
                  <span className="font-mono tabular-nums">
                    {secondaryDisplay}
                  </span>
                </a>
              </>
            )}
            <span className="hidden text-primary-foreground/30 sm:inline">
              |
            </span>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-6 items-center gap-1.5 transition-colors hover:text-gold"
            >
              <MessageCircle className="size-3.5 shrink-0 text-emerald-400" />
              <span>24/7 Pilgrim Support</span>
            </a>
            <span className="hidden text-primary-foreground/30 2xl:inline">
              |
            </span>
            <span className="hidden items-center gap-1 text-primary-foreground/80 2xl:inline-flex">
              <MapPin className="size-3.5 shrink-0 text-gold" />
              <span>{officeAddress}</span>
            </span>
          </div>

          {/* Right: Zero-CLS Fixed-Width Haramain Prayer Time Pill (`OD-08`, `SEO-030`) & Quick Jump */}
          <div className="flex items-center gap-3">
            <div
              className="hidden min-h-6 w-[296px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-gold/25 bg-primary-foreground/10 px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary-foreground/95 md:inline-flex"
              title="Umm al-Qura astronomical Makkah & Madinah Haramain prayer schedule in Arabia Standard Time (AST / UTC+3)"
            >
              <Clock className="size-3 shrink-0 text-gold" />
              <span>Next:</span>
              <span className="font-semibold text-gold" suppressHydrationWarning>
                {prayerSchedule.nextPrayerName}
              </span>
              <ArabicText
                className="text-[11px] text-gold/90"
                suppressHydrationWarning
              >
                {prayerSchedule.nextPrayerArabic}
              </ArabicText>
              <span
                className="font-mono tabular-nums text-primary-foreground/90"
                suppressHydrationWarning
              >
                {prayerSchedule.makkahTime24} · {prayerSchedule.madinahTime24} AST
              </span>
              <span className="sr-only" suppressHydrationWarning>
                Makkah {prayerSchedule.makkahTime24}, Madinah{" "}
                {prayerSchedule.madinahTime24} AST
              </span>
            </div>
            <Link
              href="/#track-status"
              className="inline-flex min-h-6 items-center gap-1 text-[11px] font-medium whitespace-nowrap underline underline-offset-4 transition-colors hover:text-gold"
            >
              <Search className="size-3 shrink-0" />
              <span>Track Application</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Bilingual Title */}
          <Link
            href="/"
            className="group flex min-h-6 shrink-0 items-center gap-3"
          >
            <div className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-gold/30 bg-card p-0.5 shadow-xs transition-transform group-hover:scale-105">
              <Image
                src="/logo.jpg"
                alt="Al Ramlah Travels Emblem"
                width={40}
                height={40}
                loading="eager"
                className="size-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-xl">
                Al Ramlah Travels
              </span>
              <ArabicText className="text-xs font-semibold tracking-wide text-gold-text">
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
                    "group relative inline-flex min-h-6 items-center px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "font-semibold text-primary"
                      : "text-foreground/80 hover:text-primary"
                  )}
                >
                  {link.title}
                  <span
                    className={cn(
                      "absolute inset-x-3 -bottom-0.5 h-0.5 origin-left rounded-full bg-gold transition-transform",
                      isActive
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100"
                    )}
                  />
                </Link>
              )
            })}
          </nav>

          {/* Action CTA + Mobile Menu Button */}
          <div className="flex items-center gap-2.5">
            <Button
              render={<Link href="/#journey-builder" />}
              nativeButton={false}
              className="hidden min-h-9 gap-1.5 border border-gold/30 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 sm:inline-flex"
            >
              <Sparkles className="size-4 shrink-0 text-gold" />
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
                    />
                  }
                >
                  <Menu className="size-5" />
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="flex w-full max-w-xs flex-col justify-between bg-card p-6 sm:max-w-sm"
                >
                  <div>
                    <SheetHeader className="border-b border-border p-0 pb-6 text-left">
                      <div className="flex items-center gap-3">
                        <div className="size-10 overflow-hidden rounded-lg border border-gold/40 bg-background p-1">
                          <Image
                            src="/logo.jpg"
                            alt="Al Ramlah Travels Emblem"
                            width={36}
                            height={36}
                            loading="eager"
                            className="size-full object-contain"
                          />
                        </div>
                        <div>
                          <SheetTitle className="font-display text-base font-bold text-foreground">
                            Al Ramlah Travels
                          </SheetTitle>
                          <SheetDescription>
                            <ArabicText className="text-xs font-medium text-gold-text">
                              {BRAND_ARABIC_NAME}
                            </ArabicText>
                          </SheetDescription>
                        </div>
                      </div>
                    </SheetHeader>

                    {/* Mobile Haramain Prayer Pill */}
                    <div className="mt-4 rounded-lg border border-gold/25 bg-secondary/60 px-3 py-2 text-xs text-foreground">
                      <div className="flex items-center justify-between font-medium">
                        <span className="inline-flex items-center gap-1.5 text-primary">
                          <Clock className="size-3.5 text-gold" />
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
                      <p
                        className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground"
                        suppressHydrationWarning
                      >
                        Makkah {prayerSchedule.makkahTime24} · Madinah{" "}
                        {prayerSchedule.madinahTime24} AST
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
                              "flex min-h-10 items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                              isActive
                                ? "border border-gold/40 bg-secondary font-semibold text-primary"
                                : "text-foreground hover:bg-secondary hover:text-primary"
                            )}
                          >
                            <span className="flex items-center gap-3">
                              <link.icon className="size-4 text-gold" />
                              {link.title}
                            </span>
                            <ArrowRight className="size-4 text-muted-foreground" />
                          </Link>
                        )
                      })}
                      <Link
                        href="/#track-status"
                        onClick={() => setMobileOpen(false)}
                        className="flex min-h-10 items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary hover:text-primary"
                      >
                        <span className="flex items-center gap-3">
                          <Search className="size-4 text-gold" />
                          Track Application Status
                        </span>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </Link>
                    </div>
                  </div>

                  {/* Drawer Footer Actions */}
                  <div className="flex flex-col gap-3 border-t border-border pt-6">
                    <Button
                      render={<Link href="/#journey-builder" />}
                      nativeButton={false}
                      onClick={() => setMobileOpen(false)}
                      className="min-h-10 w-full justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Sparkles className="size-4 text-gold" />
                      Plan Your Journey
                    </Button>

                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <MessageCircle className="size-4 text-emerald-600" />
                      WhatsApp Concierge
                    </a>

                    <div className="pt-1 text-center text-[11px] text-muted-foreground">
                      Where Purpose Meets Excellence · Hajj • Umrah • Flights • Hotels • Tours
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
    </div>
  )
}
