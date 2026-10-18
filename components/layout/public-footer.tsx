import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  ShieldCheck,
  Award,
  Lock,
  Compass,
  ArrowUpRight,
} from "lucide-react"

export function PublicFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative overflow-hidden border-t border-primary-foreground/10 bg-primary text-primary-foreground">
      {/* Decorative Islamic Geometric Pattern Watermark */}
      <div className="bg-haramain-dark-pattern pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-primary-foreground/15 pb-12 md:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          {/* Column 1: Brand & Sacred Mission (2 cols on lg) */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Link href="/" className="flex items-center gap-3">
              <div className="size-12 overflow-hidden rounded-xl border border-gold/40 bg-card p-1 shadow-md">
                <Image
                  src="/logo.jpg"
                  alt="Al Ramlah Travels Emblem"
                  width={44}
                  height={44}
                  className="size-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xl font-bold tracking-tight text-primary-foreground">
                  Al Ramlah Travels
                </span>
                <span className="font-arabic text-xs font-medium text-gold">
                  سفريات الرملة · خادم ضيوف الرحمن
                </span>
              </div>
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-primary-foreground/80">
              Pakistan&apos;s premier luxury pilgrimage concierge. Dedicated to
              crafting serene, spiritually elevating Umrah, Hajj, and Ziyarat
              journeys with transparent pricing, handpicked 5-star Haramain
              hotels, and 24/7 on-ground executive assistance.
            </p>

            <div className="pt-2">
              <span className="mb-1 block font-arabic text-sm text-gold">
                لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لا شَرِيكَ لَكَ
                لَبَّيْكَ
              </span>
              <span className="text-xs text-primary-foreground/60 italic">
                &ldquo;At Your Service, O Lord, At Your Service&rdquo;
              </span>
            </div>
          </div>

          {/* Column 2: Curated Journeys */}
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-sm font-semibold tracking-wide text-gold uppercase">
              Curated Journeys
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-primary-foreground/80">
              <li>
                <Link
                  href="#journey-builder"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-gold"
                >
                  <span>Custom Umrah Builder</span>
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link
                  href="#group-packages"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-gold"
                >
                  <span>VIP Executive Packages</span>
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link
                  href="#group-packages"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-gold"
                >
                  <span>Family Comfort Umrah</span>
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link
                  href="#hajj-inquiry"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-gold"
                >
                  <span>Hajj 2026 Registration</span>
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link
                  href="#ziyarat"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-gold"
                >
                  <span>Historical Ziyarat Tours</span>
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Pilgrim Services */}
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-sm font-semibold tracking-wide text-gold uppercase">
              Pilgrim Services
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-primary-foreground/80">
              <li>
                <Link
                  href="#track-status"
                  className="transition-colors hover:text-gold"
                >
                  Live Application Tracker
                </Link>
              </li>
              <li>
                <Link
                  href="#journey-builder"
                  className="transition-colors hover:text-gold"
                >
                  Instant Visa Quoting
                </Link>
              </li>
              <li>
                <Link
                  href="#hotels"
                  className="transition-colors hover:text-gold"
                >
                  Makkah Clock Tower Hotels
                </Link>
              </li>
              <li>
                <Link
                  href="#hotels"
                  className="transition-colors hover:text-gold"
                >
                  Madinah Markaziah Stays
                </Link>
              </li>
              <li>
                <Link
                  href="#contact"
                  className="transition-colors hover:text-gold"
                >
                  VIP Ground Transport
                </Link>
              </li>
              <li>
                <Link
                  href="/admin"
                  className="pt-1 text-xs text-primary-foreground/50 transition-colors hover:text-gold"
                >
                  Staff Operations Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Concierge & Headquarters */}
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-sm font-semibold tracking-wide text-gold uppercase">
              Pilgrim Concierge
            </h3>
            <div className="flex flex-col gap-2.5 text-sm text-primary-foreground/80">
              <a
                href="tel:+923001234567"
                className="flex items-center gap-2 transition-colors hover:text-gold"
              >
                <Phone className="size-4 shrink-0 text-gold" />
                <span className="font-mono tabular-nums">+92 300 1234567</span>
              </a>
              <a
                href="https://wa.me/923001234567"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors hover:text-gold"
              >
                <MessageCircle className="size-4 shrink-0 text-emerald-400" />
                <span>WhatsApp: 24/7 Ground Team</span>
              </a>
              <a
                href="mailto:concierge@alramlahtravels.com"
                className="flex items-center gap-2 transition-colors hover:text-gold"
              >
                <Mail className="size-4 shrink-0 text-gold" />
                <span>concierge@alramlahtravels.com</span>
              </a>
              <div className="flex items-start gap-2 pt-1 text-xs text-primary-foreground/70">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                <span>Al Hafeez Heights, Gulberg III, Lahore, Pakistan</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-primary-foreground/70">
                <Compass className="mt-0.5 size-4 shrink-0 text-gold" />
                <span>KSA Liaison Office: Ibrahim Al Khalil Rd, Makkah</span>
              </div>
            </div>
          </div>
        </div>

        {/* Accreditation & Regulatory Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary-foreground/15 py-6">
          <div className="flex flex-wrap items-center gap-6 text-xs text-primary-foreground/80">
            <div className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-gold" />
              <span>Ministry of Hajj & Umrah Licensed Operator # 4082</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <Award className="size-4 text-gold" />
              <span>IATA Accredited Passenger Agent (# 27-2-1234-5)</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <Lock className="size-4 text-gold" />
              <span>256-Bit SSL Encrypted Verification</span>
            </div>
          </div>
          <div className="text-xs text-primary-foreground/60">
            National Tax Number (NTN): 7824192-3
          </div>
        </div>

        {/* Bottom Bar: Copyright & Legal */}
        <div className="flex flex-col items-center justify-between gap-4 pt-6 text-xs text-primary-foreground/60 sm:flex-row">
          <div>
            &copy; {currentYear} Al Ramlah Travels Pvt. Ltd. All rights
            reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link href="#privacy" className="transition-colors hover:text-gold">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="#terms" className="transition-colors hover:text-gold">
              Terms of Pilgrimage
            </Link>
            <span>·</span>
            <Link
              href="#disclaimer"
              className="transition-colors hover:text-gold"
            >
              Visa Regulations
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
