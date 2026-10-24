"use client"

import * as React from "react"
import { useState } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface PublicFooterProps {
  agencyPhone?: string
  whatsappNumber?: string
  agencyName?: string
  supportEmail?: string
  officeAddress?: string
}

export function PublicFooter({
  agencyPhone = "+92 300 1234567",
  whatsappNumber = "+923001234567",
  agencyName = "Al Ramlah Travels",
  supportEmail = "info@alramlahtravels.com",
  officeAddress = "Suite 402, Al-Hafeez Heights, Gulberg III, Lahore, Pakistan",
}: PublicFooterProps = {}) {
  const currentYear = new Date().getFullYear()
  const [modalType, setModalType] = useState<
    "privacy" | "terms" | "disclaimer" | null
  >(null)

  const normalizedWhatsapp = whatsappNumber
    .replace(/\D/g, "")
    .replace(/^03/, "923")
  const telHref = `tel:${agencyPhone.replace(/\s+/g, "")}`
  const waHref = `https://wa.me/${normalizedWhatsapp || "923001234567"}?text=Assalam%20o%20Alaikum%2C%20I%20would%20like%20to%20inquire%20about%20Al%20Ramlah%20Travels%20pilgrimage%20packages.`

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
                  alt={`${agencyName} Emblem`}
                  width={44}
                  height={44}
                  className="size-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xl font-bold tracking-tight text-primary-foreground">
                  {agencyName}
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
                  href="#journey-builder"
                  className="transition-colors hover:text-gold"
                >
                  Makkah Clock Tower Hotels
                </Link>
              </li>
              <li>
                <Link
                  href="#journey-builder"
                  className="transition-colors hover:text-gold"
                >
                  Madinah Markaziah Stays
                </Link>
              </li>
              <li>
                <Link
                  href="#journey-builder"
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
                href={telHref}
                className="flex items-center gap-2 transition-colors hover:text-gold"
              >
                <Phone className="size-4 shrink-0 text-gold" />
                <span className="font-mono tabular-nums">{agencyPhone}</span>
              </a>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors hover:text-gold"
              >
                <MessageCircle className="size-4 shrink-0 text-emerald-400" />
                <span>WhatsApp: 24/7 Ground Team</span>
              </a>
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-2 transition-colors hover:text-gold"
              >
                <Mail className="size-4 shrink-0 text-gold" />
                <span>{supportEmail}</span>
              </a>
              <div className="flex items-start gap-2 pt-1 text-xs text-primary-foreground/70">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                <span>{officeAddress}</span>
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
            &copy; {currentYear} {agencyName} Pvt. Ltd. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setModalType("privacy")}
              className="transition-colors hover:text-gold focus:outline-none"
            >
              Privacy Policy
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setModalType("terms")}
              className="transition-colors hover:text-gold focus:outline-none"
            >
              Terms of Pilgrimage
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setModalType("disclaimer")}
              className="transition-colors hover:text-gold focus:outline-none"
            >
              Visa Regulations
            </button>
          </div>
        </div>
      </div>

      {/* Informational Legal Dialogs */}
      <Dialog
        open={Boolean(modalType)}
        onOpenChange={(open) => !open && setModalType(null)}
      >
        <DialogContent className="sm:max-w-lg bg-white text-[#1A1D1A] border-[#E6DEC8] p-6 max-h-[85vh] overflow-y-auto">
          {modalType === "privacy" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-[#0A3622]">
                  Privacy Policy &amp; Pilgrim Data Protection
                </DialogTitle>
                <DialogDescription className="text-xs text-[#686E65]">
                  Last updated: October 2026 · Ministry of Hajj &amp; Umrah Compliance
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-3 text-xs leading-relaxed text-[#1A1D1A]">
                <p>
                  At <strong>{agencyName}</strong>, the sanctity of your personal
                  data and travel documents is handled with utmost reverence and
                  strict technical safeguards.
                </p>
                <h4 className="font-bold text-[#0A3622]">1. Passport &amp; Identification</h4>
                <p>
                  Passport scans, national identity numbers, and biometric
                  records collected for Umrah visa issuance are transmitted
                  directly to the Saudi Ministry of Foreign Affairs (MOFA) and
                  Masar platform via 256-bit SSL encrypted channels.
                </p>
                <h4 className="font-bold text-[#0A3622]">2. Payment Confidentiality</h4>
                <p>
                  We do not sell, barter, or disclose pilgrim contact details,
                  payment records, or itinerary schedules to any third-party
                  marketing entities.
                </p>
                <h4 className="font-bold text-[#0A3622]">3. Data Retention</h4>
                <p>
                  In accordance with IATA and regulatory requirements, flight
                  and hotel booking vouchers are archived securely for audit and
                  tax verification purposes.
                </p>
              </div>
            </>
          )}

          {modalType === "terms" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-[#0A3622]">
                  Terms of Pilgrimage &amp; Service Agreement
                </DialogTitle>
                <DialogDescription className="text-xs text-[#686E65]">
                  Standard Pilgrimage Service Terms &amp; Conditions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-3 text-xs leading-relaxed text-[#1A1D1A]">
                <h4 className="font-bold text-[#0A3622]">1. Quotation &amp; Provisional Holds</h4>
                <p>
                  Submissions through our Custom Journey Builder and Group
                  Booking modules constitute a provisional reservation request.
                  Final pricing and seat confirmation become binding upon
                  review and official quotation issuance by our executive desk.
                </p>
                <h4 className="font-bold text-[#0A3622]">2. Hotel Check-In &amp; Occupancy</h4>
                <p>
                  Check-in and check-out times follow standard Saudi hospitality
                  protocols (typically 4:00 PM check-in and 12:00 PM check-out).
                  Room allocations strictly count Adults and Children for beds;
                  infants are accommodated on existing bedding.
                </p>
                <h4 className="font-bold text-[#0A3622]">3. Flight &amp; Transit Schedules</h4>
                <p>
                  Airline schedule adjustments, baggage allowances, and flight
                  timing revisions are governed by the respective operating
                  carrier under IATA conditions of carriage.
                </p>
              </div>
            </>
          )}

          {modalType === "disclaimer" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-[#0A3622]">
                  Saudi Umrah &amp; Hajj Visa Regulations
                </DialogTitle>
                <DialogDescription className="text-xs text-[#686E65]">
                  Statutory guidelines enforced by the Ministry of Foreign Affairs (KSA)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-3 text-xs leading-relaxed text-[#1A1D1A]">
                <h4 className="font-bold text-[#0A3622]">1. Passport Validity</h4>
                <p>
                  All pilgrims (including infants and children) must hold a
                  machine-readable passport with a minimum validity of 6 months
                  from the intended date of arrival in the Kingdom of Saudi Arabia.
                </p>
                <h4 className="font-bold text-[#0A3622]">2. Duration Tiers</h4>
                <p>
                  Saudi tourist/electronic visas and Umrah visas issued for stays
                  up to 30 days qualify for short-term rate tiers. Stays exceeding
                  30 days require extended authorization tiers subject to MOFA
                  approvals.
                </p>
                <h4 className="font-bold text-[#0A3622]">3. Mandatory Insurance</h4>
                <p>
                  Every issued visa incorporates compulsory comprehensive health
                  and emergency medical insurance covering COVID-19 and emergency
                  hospitalization across licensed healthcare facilities in KSA.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </footer>
  )
}
