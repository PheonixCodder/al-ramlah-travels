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
  Mail,
  MapPin,
  ShieldCheck,
  Award,
  Lock,
  Compass,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"
import { ArabicText } from "@/components/public/arabic-text"
import { toWaMeUrl } from "@/components/public/public-utils"

export interface PublicFooterProps {
  agencyPhone?: string
  secondaryPhone?: string
  whatsappNumber?: string
  agencyName?: string
  legalEntityName?: string
  supportEmail?: string
  officeAddress?: string
  dtsLicense?: string | null
  moraLicense?: string | null
  iataCode?: string | null
  ntnNumber?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  youtubeUrl?: string | null
  tiktokUrl?: string | null
}

function cleanOptionalText(val: string | null | undefined): string | null {
  if (!val) return null
  const trimmed = val.trim()
  return trimmed.length > 0 ? trimmed : null
}

function cleanHttpUrl(val: string | null | undefined): string | null {
  const cleaned = cleanOptionalText(val)
  if (!cleaned) return null
  if (cleaned.startsWith("https://") || cleaned.startsWith("http://")) {
    return cleaned
  }
  return null
}

export function PublicFooter({
  agencyPhone = DEFAULT_COMPANY_INFO.primaryWhatsapp,
  secondaryPhone = DEFAULT_COMPANY_INFO.secondaryPhone,
  whatsappNumber = DEFAULT_COMPANY_INFO.primaryWhatsapp,
  agencyName = DEFAULT_COMPANY_INFO.agencyName,
  legalEntityName,
  supportEmail = DEFAULT_COMPANY_INFO.supportEmail,
  officeAddress = DEFAULT_COMPANY_INFO.officeAddress,
  dtsLicense = null,
  moraLicense = null,
  iataCode = null,
  ntnNumber = null,
  facebookUrl = null,
  instagramUrl = null,
  youtubeUrl = null,
  tiktokUrl = null,
}: PublicFooterProps = {}) {
  const currentYear = new Date().getFullYear()
  const resolvedLegalName = cleanOptionalText(legalEntityName) ?? agencyName

  const telHref = `tel:${agencyPhone.replace(/\s+/g, "")}`
  const secTelHref = `tel:${secondaryPhone.replace(/\s+/g, "")}`
  const waHref = toWaMeUrl(
    whatsappNumber,
    "Assalam o Alaikum, I would like to inquire about Al Ramlah Travels pilgrimage packages."
  )

  const licenseBadges: Array<{ label: string; value: string }> = []
  const dts = cleanOptionalText(dtsLicense)
  const mora = cleanOptionalText(moraLicense)
  const iata = cleanOptionalText(iataCode)
  const ntn = cleanOptionalText(ntnNumber)
  if (dts) licenseBadges.push({ label: "DTS License", value: dts })
  if (mora) licenseBadges.push({ label: "MoRA / HGO", value: mora })
  if (iata) licenseBadges.push({ label: "IATA", value: iata })
  if (ntn) licenseBadges.push({ label: "NTN", value: ntn })

  const socialLinks: Array<{ label: string; href: string }> = []
  const fb = cleanHttpUrl(facebookUrl)
  const ig = cleanHttpUrl(instagramUrl)
  const yt = cleanHttpUrl(youtubeUrl)
  const tt = cleanHttpUrl(tiktokUrl)
  if (fb) socialLinks.push({ label: "Facebook", href: fb })
  if (ig) socialLinks.push({ label: "Instagram", href: ig })
  if (yt) socialLinks.push({ label: "YouTube", href: yt })
  if (tt) socialLinks.push({ label: "TikTok", href: tt })

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
                <ArabicText className="text-xs font-medium text-gold">
                  سفريات الرملة · خادم ضيوف الرحمن
                </ArabicText>
              </div>
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-primary-foreground/80">
              Pakistan&apos;s luxury Haramain pilgrimage concierge. Dedicated to
              crafting serene, spiritually elevating Umrah, Hajj, and Ziyarat
              journeys with transparent pricing, handpicked Haramain hotels, and
              24/7 on-ground executive assistance.
            </p>

            <div className="pt-2">
              <ArabicText className="mb-1 block text-sm text-gold">
                لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لا شَرِيكَ لَكَ لَبَّيْكَ
              </ArabicText>
              <span className="text-xs text-primary-foreground/60 italic">
                &ldquo;At Your Service, O Lord, At Your Service&rdquo;
              </span>
            </div>

            {socialLinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-primary-foreground/10 px-3 py-1 text-xs font-medium text-primary-foreground/90 transition-colors hover:border-gold hover:text-gold"
                  >
                    <span>{social.label}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Curated Journeys */}
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-sm font-semibold tracking-wide text-gold uppercase">
              Curated Journeys
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-primary-foreground/80">
              <li>
                <Link
                  href="/#journey-builder"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-gold"
                >
                  <span>Custom Umrah Builder</span>
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link
                  href="/#group-packages"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-gold"
                >
                  <span>VIP Executive Packages</span>
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link
                  href="/#group-packages"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-gold"
                >
                  <span>Family Comfort Umrah</span>
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link
                  href="/#hajj-inquiry"
                  className="group inline-flex items-center gap-1 transition-colors hover:text-gold"
                >
                  <span>Hajj 2027 Pre-Registration</span>
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link
                  href="/#ziyarat"
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
                  href="/#track-status"
                  className="transition-colors hover:text-gold"
                >
                  Live Application Tracker
                </Link>
              </li>
              <li>
                <Link
                  href="/#journey-builder"
                  className="transition-colors hover:text-gold"
                >
                  Instant Visa Quoting
                </Link>
              </li>
              <li>
                <Link
                  href="/#journey-builder"
                  className="transition-colors hover:text-gold"
                >
                  Makkah Clock Tower Hotels
                </Link>
              </li>
              <li>
                <Link
                  href="/#journey-builder"
                  className="transition-colors hover:text-gold"
                >
                  Madinah Markaziah Stays
                </Link>
              </li>
              <li>
                <Link
                  href="/#contact"
                  className="transition-colors hover:text-gold"
                >
                  Askari 10 Executive Desk
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
              <div className="flex flex-col gap-1">
                <a
                  href={telHref}
                  className="flex items-center gap-2 transition-colors hover:text-gold"
                >
                  <Phone className="size-4 shrink-0 text-gold" />
                  <span className="font-mono tabular-nums">{agencyPhone}</span>
                </a>
                {secondaryPhone && (
                  <a
                    href={secTelHref}
                    className="flex items-center gap-2 pl-6 text-xs text-primary-foreground/75 transition-colors hover:text-gold"
                  >
                    <span className="font-mono tabular-nums">{secondaryPhone}</span>
                  </a>
                )}
              </div>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors hover:text-gold"
              >
                <MessageCircle className="size-4 shrink-0 text-emerald-400" />
                <span>WhatsApp: {whatsappNumber} (24/7 Desk)</span>
              </a>
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-2 transition-colors hover:text-gold"
              >
                <Mail className="size-4 shrink-0 text-gold" />
                <span>{supportEmail}</span>
              </a>
              <a
                href="https://www.alramlahtravels.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs transition-colors hover:text-gold"
              >
                <Compass className="size-4 shrink-0 text-gold" />
                <span>www.alramlahtravels.com</span>
              </a>
              <div className="flex items-start gap-2 pt-1 text-xs text-primary-foreground/70">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                <span>{officeAddress}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Accreditation & Verified Regulatory Licenses Strip (`T-056`, `OD-10`) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary-foreground/15 py-6">
          <div className="flex flex-wrap items-center gap-5 text-xs text-primary-foreground/85">
            <div className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-gold" />
              <span>Hajj • Umrah • Flights • Hotels • Tours</span>
            </div>
            {licenseBadges.length > 0 ? (
              licenseBadges.map((badge) => (
                <div
                  key={badge.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-primary-foreground/10 px-3 py-1 font-mono text-[11px] tabular-nums text-primary-foreground"
                >
                  <Award className="size-3.5 text-gold" />
                  <span className="font-sans font-semibold text-gold">
                    {badge.label}:
                  </span>
                  <span>{badge.value}</span>
                </div>
              ))
            ) : (
              <div className="inline-flex items-center gap-2">
                <Award className="size-4 text-gold" />
                <span>Where Purpose Meets Excellence</span>
              </div>
            )}
            <div className="inline-flex items-center gap-2">
              <Lock className="size-4 text-gold" />
              <span>TLS Encrypted Pilgrim Dossiers</span>
            </div>
          </div>
          <div className="text-xs text-primary-foreground/75">
            {officeAddress}
          </div>
        </div>

        {/* Bottom Bar: Copyright & Canonical Legal Routes */}
        <div className="flex flex-col items-center justify-between gap-4 pt-6 text-xs text-primary-foreground/65 sm:flex-row">
          <div>
            &copy; {currentYear} {resolvedLegalName}. All rights reserved.
          </div>
          <nav
            aria-label="Legal policies"
            className="flex flex-wrap items-center gap-4"
          >
            <Link
              href="/privacy"
              className="transition-colors hover:text-gold focus-visible:underline focus-visible:outline-none"
            >
              Privacy Policy
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/terms"
              className="transition-colors hover:text-gold focus-visible:underline focus-visible:outline-none"
            >
              Terms of Service
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/refund-policy"
              className="transition-colors hover:text-gold focus-visible:underline focus-visible:outline-none"
            >
              Refund &amp; Cancellation Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
