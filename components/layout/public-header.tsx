"use client"

import * as React from "react"
import Link from "next/link"
import NextImage, { type ImageProps } from "next/image"

const Image = (
  typeof NextImage === "function"
    ? NextImage
    : (NextImage as { default: React.ComponentType<ImageProps> }).default
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
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"
import { ArabicText } from "@/components/public/arabic-text"
import {
  computeHaramainPrayerTimes,
  toWaMeUrl,
} from "@/components/public/public-utils"

const NAV_LINKS = [
  { title: "Custom Umrah", href: "/#journey-builder", icon: Compass },
  { title: "Group Packages", href: "/#group-packages", icon: Package },
  { title: "Hajj 2027", href: "/#hajj-inquiry", icon: Layers },
  { title: "Ziyarat Guides", href: "/#ziyarat", icon: Compass },
  { title: "Track Request", href: "/#track-status", icon: Search },
  { title: "Concierge", href: "/#contact", icon: MessageCircle },
]

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
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [prayerSchedule, setPrayerSchedule] = React.useState(() =>
    computeHaramainPrayerTimes()
  )

  React.useEffect(() => {
    setPrayerSchedule(computeHaramainPrayerTimes())
    const timer = window.setInterval(() => {
      setPrayerSchedule(computeHaramainPrayerTimes())
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const telHref = `tel:${agencyPhone.replace(/\s+/g, "")}`
  const secTelHref = `tel:${secondaryPhone.replace(/\s+/g, "")}`
  const waHref = toWaMeUrl(
    whatsappNumber,
    "Assalam o Alaikum, I would like to inquire about Al Ramlah Travels pilgrimage packages."
  )

  return (
    <div className="w-full">
      {/* Top Utility Strip */}
      <div className="border-b border-primary-foreground/10 bg-primary px-4 py-2 text-xs text-primary-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {/* Left: Contact Hotlines */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href={telHref}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-gold"
            >
              <Phone className="size-3.5 shrink-0 text-gold" />
              <span className="font-mono tabular-nums">{agencyPhone}</span>
            </a>
            {secondaryPhone && (
              <>
                <span className="text-primary-foreground/30">·</span>
                <a
                  href={secTelHref}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-gold"
                >
                  <span className="font-mono tabular-nums">{secondaryPhone}</span>
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
              className="inline-flex items-center gap-1.5 transition-colors hover:text-gold"
            >
              <MessageCircle className="size-3.5 shrink-0 text-emerald-400" />
              <span>24/7 Pilgrim Support</span>
            </a>
            <span className="hidden text-primary-foreground/30 xl:inline">
              |
            </span>
            <span className="hidden items-center gap-1 text-primary-foreground/80 xl:inline-flex">
              <MapPin className="size-3.5 shrink-0 text-gold" />
              <span>{officeAddress}</span>
            </span>
          </div>

          {/* Right: Zero-Network Haramain Prayer Time Pill (`OD-08`) & Quick Jump */}
          <div className="flex items-center gap-3">
            <div
              className="hidden items-center gap-1.5 rounded-full border border-gold/25 bg-primary-foreground/10 px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground/95 md:inline-flex"
              title="Umm al-Qura astronomical Haramain prayer schedule in Arabia Standard Time (AST / UTC+3)"
            >
              <Clock className="size-3 shrink-0 text-gold" />
              <span>Haramain Next:</span>
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
                Makkah {prayerSchedule.makkahTime24} · Madinah{" "}
                {prayerSchedule.madinahTime24} AST
              </span>
            </div>
            <Link
              href="/#track-status"
              className="inline-flex items-center gap-1 text-[11px] font-medium underline underline-offset-4 transition-colors hover:text-gold"
            >
              <Search className="size-3 shrink-0" />
              <span>Track Application</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Bilingual Title */}
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <div className="relative size-13 shrink-0 overflow-hidden rounded-xl border border-gold/30 bg-card shadow-xs transition-transform group-hover:scale-105">
              <Image
                src="/logo.jpg"
                alt="Al Ramlah Travels Emblem"
                width={40}
                height={44}
                className="size-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-xl">
                Al Ramlah Travels
              </span>
              <ArabicText className="text-xs font-semibold tracking-wide text-gold">
                الرملة للسفر والسياحة
              </ArabicText>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 lg:flex"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="group relative px-3.5 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
              >
                {link.title}
                <span className="absolute inset-x-3.5 -bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-gold transition-transform group-hover:scale-x-100" />
              </Link>
            ))}
          </nav>

          {/* Action CTA + Mobile Menu Button */}
          <div className="flex items-center gap-3">
            <Button
              render={<Link href="/#journey-builder" />}
              nativeButton={false}
              className="hidden gap-1.5 border border-gold/30 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 sm:inline-flex"
            >
              <Sparkles className="size-4 shrink-0 text-gold" />
              <span>Plan Your Journey</span>
            </Button>

            {/* Mobile Navigation Drawer */}
            <div className="lg:hidden">
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
                            className="size-full object-contain"
                          />
                        </div>
                        <div>
                          <SheetTitle className="font-display text-base font-bold text-foreground">
                            Al Ramlah Travels
                          </SheetTitle>
                          <SheetDescription>
                            <ArabicText className="text-xs font-medium text-gold">
                              الرملة للسفر والسياحة
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
                          className="text-xs font-semibold text-gold"
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
                      {NAV_LINKS.map((link) => (
                        <Link
                          key={link.title}
                          href={link.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center justify-between rounded-lg px-3.5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary hover:text-primary"
                        >
                          <span className="flex items-center gap-3">
                            <link.icon className="size-4 text-gold" />
                            {link.title}
                          </span>
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Drawer Footer Actions */}
                  <div className="flex flex-col gap-3 border-t border-border pt-6">
                    <Button
                      render={<Link href="/#journey-builder" />}
                      nativeButton={false}
                      onClick={() => setMobileOpen(false)}
                      className="w-full justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Sparkles className="size-4 text-gold" />
                      Plan Your Journey
                    </Button>

                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
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
