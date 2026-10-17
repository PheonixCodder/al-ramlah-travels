"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Phone,
  MessageCircle,
  MapPin,
  ShieldCheck,
  Search,
  Sparkles,
  Menu,
  Compass,
  CalendarCheck,
  Package,
  Layers,
  ArrowRight,
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

const NAV_LINKS = [
  { title: "Custom Umrah", href: "#journey-builder", icon: Compass },
  { title: "Group Packages", href: "#group-packages", icon: Package },
  { title: "Hajj 2026", href: "#hajj-inquiry", icon: Layers },
  { title: "Ziyarat Guides", href: "#ziyarat", icon: Compass },
  { title: "Track Request", href: "#track-status", icon: Search },
  { title: "Concierge", href: "#contact", icon: MessageCircle },
]

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="w-full">
      {/* Top Utility Strip */}
      <div className="border-b border-primary-foreground/10 bg-primary px-4 py-2 text-xs text-primary-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {/* Left: Contact Hotlines */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href="tel:+923001234567"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-gold"
            >
              <Phone className="size-3.5 shrink-0 text-gold" />
              <span className="font-mono tabular-nums">+92 300 1234567</span>
            </a>
            <span className="hidden text-primary-foreground/30 sm:inline">
              |
            </span>
            <a
              href="https://wa.me/923001234567?text=Assalam%20o%20Alaikum%2C%20I%20would%20like%20to%20inquire%20about%20Al%20Ramlah%20Travels%20pilgrimage%20packages."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-gold"
            >
              <MessageCircle className="size-3.5 shrink-0 text-emerald-400" />
              <span>24/7 Pilgrim Support</span>
            </a>
            <span className="hidden text-primary-foreground/30 md:inline">
              |
            </span>
            <span className="hidden items-center gap-1 text-primary-foreground/80 md:inline-flex">
              <MapPin className="size-3.5 shrink-0 text-gold" />
              <span>Lahore Head Office · Gulberg III</span>
            </span>
          </div>

          {/* Right: Regulatory Badges & Quick Jump */}
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded bg-primary-foreground/10 px-2 py-0.5 text-[11px] font-medium text-primary-foreground/90 lg:inline-flex">
              <ShieldCheck className="size-3.5 shrink-0 text-gold" />
              <span>Govt. Licensed #4082 · IATA Accredited</span>
            </span>
            <Link
              href="#track-status"
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
            <div className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-gold/30 bg-card p-1 shadow-xs transition-transform group-hover:scale-105">
              <Image
                src="/logo-icon.png"
                alt="Al Ramlah Travels Emblem"
                width={40}
                height={40}
                className="size-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-xl">
                Al Ramlah Travels
              </span>
              <span className="font-arabic text-xs font-semibold tracking-wide text-gold">
                الرملة للسفر والسياحة
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
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
              render={<Link href="#journey-builder" />}
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
                            src="/logo-icon.png"
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
                          <SheetDescription className="font-arabic text-xs font-medium text-gold">
                            الرملة للسفر والسياحة
                          </SheetDescription>
                        </div>
                      </div>
                    </SheetHeader>

                    {/* Navigation Items */}
                    <div className="flex flex-col gap-1 py-6">
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
                      render={<Link href="#journey-builder" />}
                      nativeButton={false}
                      onClick={() => setMobileOpen(false)}
                      className="w-full justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Sparkles className="size-4 text-gold" />
                      Plan Your Journey
                    </Button>

                    <a
                      href="https://wa.me/923001234567?text=Assalam%20o%20Alaikum%2C%20I%20would%20like%20to%20inquire%20about%20Al%20Ramlah%20Travels%20pilgrimage%20packages."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <MessageCircle className="size-4 text-emerald-600" />
                      WhatsApp Concierge
                    </a>

                    <div className="pt-1 text-center text-[11px] text-muted-foreground">
                      Govt. Licensed Umrah Operator # 4082 · IATA Accredited
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
