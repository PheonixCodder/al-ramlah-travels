import * as React from "react"
import Link from "next/link"
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
  Mail,
  MapPin,
  ShieldCheck,
  Award,
  Lock,
  Compass,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react"
import { BRAND_ARABIC_NAME, BRAND_WEBSITE_DOMAIN } from "@/lib/constants/brand"
import {
  DEFAULT_COMPANY_INFO,
  formatPkPhoneDisplay,
  toTelHref,
} from "@/lib/company-info"
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

const UMRAH_AND_HAJJ_LINKS = [
  { label: "Group Umrah Packages", href: "/umrah-packages" },
  { label: "Umrah Packages from Lahore", href: "/umrah-packages/from-lahore" },
  {
    label: "Umrah Packages from Karachi",
    href: "/umrah-packages/from-karachi",
  },
  {
    label: "Umrah Packages from Islamabad",
    href: "/umrah-packages/from-islamabad",
  },
  { label: "Saudi Umrah Visa Rates", href: "/umrah-visa" },
  { label: "Hajj 2027 Pre-Registration", href: "/hajj-2027" },
] as const

const HOTELS_AND_ZIYARAT_LINKS = [
  { label: "Makkah Courtyard & Shuttle Hotels", href: "/hotels/makkah" },
  { label: "Madinah Markaziyah Hotels", href: "/hotels/madinah" },
  { label: "Haramain Ziyarat Guide", href: "/ziyarat" },
  { label: "Sacred Makkah Ziyarat Places", href: "/ziyarat/makkah" },
  { label: "Sacred Madinah Ziyarat Places", href: "/ziyarat/madinah" },
  { label: "Custom Umrah Itinerary Builder", href: "/#journey-builder" },
] as const

const AGENCY_AND_TRUST_LINKS = [
  { label: "About Al Ramlah Travels", href: "/about" },
  { label: "Contact Lahore Cantt Office", href: "/contact" },
  { label: "Umrah, Visa & Hajj FAQs", href: "/faq" },
  { label: "Track Application Status", href: "/#track-status" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Refund & Cancellation Policy", href: "/refund-policy" },
] as const

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
  facebookUrl = DEFAULT_COMPANY_INFO.facebookUrl,
  instagramUrl = DEFAULT_COMPANY_INFO.instagramUrl,
  youtubeUrl = DEFAULT_COMPANY_INFO.youtubeUrl,
  tiktokUrl = DEFAULT_COMPANY_INFO.tiktokUrl,
}: PublicFooterProps = {}) {
  const currentYear = new Date().getFullYear()
  const resolvedLegalName = cleanOptionalText(legalEntityName) ?? agencyName

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
    <footer className="relative overflow-hidden border-t border-sidebar-border bg-primary text-primary-foreground">
      {/* Decorative Islamic Geometric Pattern Watermark */}
      <div
        aria-hidden="true"
        className="bg-haramain-dark-pattern pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-primary-foreground/15 pb-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {/* Column 1: Entity & Verified Askari 10 NAP */}
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="inline-flex min-h-6 items-center gap-3 rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-gold/40 bg-card p-1 shadow-md">
                <Image
                  src="/logo.jpg"
                  alt={`${agencyName} Emblem`}
                  width={44}
                  height={44}
                  loading="eager"
                  className="size-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xl font-bold tracking-tight text-primary-foreground">
                  {agencyName}
                </span>
                <ArabicText className="text-xs font-medium text-gold">
                  {BRAND_ARABIC_NAME}
                </ArabicText>
              </div>
            </Link>

            <p className="text-sm leading-relaxed text-primary-foreground/80">
              Pakistan&apos;s luxury Haramain pilgrimage concierge at Askari 10,
              Lahore Cantt. Transparent PKR Umrah packages, Saudi e-visas,
              handpicked Haramain hotels, and guided Ziyarat tours.
            </p>

            <div className="flex flex-col gap-1.5 text-sm text-primary-foreground/85">
              <a
                href={telHref}
                className="inline-flex min-h-6 items-center gap-2 rounded-sm py-0.5 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
              >
                <Phone
                  className="size-4 shrink-0 text-gold"
                  aria-hidden="true"
                />
                <span className="font-mono tabular-nums">{primaryDisplay}</span>
              </a>
              {secondaryDisplay && (
                <a
                  href={secTelHref}
                  className="inline-flex min-h-6 items-center gap-2 rounded-sm py-0.5 pl-6 text-xs text-primary-foreground/80 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
                >
                  <span className="font-mono tabular-nums">
                    {secondaryDisplay}
                  </span>
                </a>
              )}
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-6 items-center gap-2 rounded-sm py-0.5 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
              >
                <MessageCircle
                  className="size-4 shrink-0 text-gold"
                  aria-hidden="true"
                />
                <span>WhatsApp 24/7 Desk</span>
              </a>
              <a
                href={`mailto:${supportEmail}`}
                className="inline-flex min-h-6 items-center gap-2 rounded-sm py-0.5 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
              >
                <Mail
                  className="size-4 shrink-0 text-gold"
                  aria-hidden="true"
                />
                <span>{supportEmail}</span>
              </a>
              <Link
                href="/"
                className="inline-flex min-h-6 items-center gap-2 rounded-sm py-0.5 font-mono text-xs transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
              >
                <Compass
                  className="size-4 shrink-0 text-gold"
                  aria-hidden="true"
                />
                <span>{BRAND_WEBSITE_DOMAIN}</span>
              </Link>
              <div className="flex items-start gap-2 pt-1 text-xs text-primary-foreground/75">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-gold"
                  aria-hidden="true"
                />
                <span>{officeAddress}</span>
              </div>
            </div>

            {socialLinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-6 items-center gap-1 rounded-full border border-gold/30 bg-primary-foreground/10 px-3 py-1 text-xs font-medium whitespace-nowrap text-primary-foreground/90 transition-colors hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
                  >
                    <span>{social.label}</span>
                    <ExternalLink
                      className="size-3 shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Umrah & Hajj Hubs */}
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-base font-semibold text-gold">
              Umrah &amp; Hajj Hubs
            </h3>
            <ul className="flex flex-col gap-2 text-sm text-primary-foreground/80">
              {UMRAH_AND_HAJJ_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group inline-flex min-h-6 items-center gap-1 rounded-sm py-0.5 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
                  >
                    <span>{item.label}</span>
                    <ArrowUpRight
                      className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Haramain Stays & Ziyarat */}
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-base font-semibold text-gold">
              Hotels &amp; Ziyarat Guides
            </h3>
            <ul className="flex flex-col gap-2 text-sm text-primary-foreground/80">
              {HOTELS_AND_ZIYARAT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group inline-flex min-h-6 items-center gap-1 rounded-sm py-0.5 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
                  >
                    <span>{item.label}</span>
                    <ArrowUpRight
                      className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Agency Trust & Policies */}
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-base font-semibold text-gold">
              Agency &amp; Pilgrim Trust
            </h3>
            <ul className="flex flex-col gap-2 text-sm text-primary-foreground/80">
              {AGENCY_AND_TRUST_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group inline-flex min-h-6 items-center gap-1 rounded-sm py-0.5 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
                  >
                    <span>{item.label}</span>
                    <ArrowUpRight
                      className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="pt-3">
              <ArabicText className="mb-1 block text-sm text-gold">
                لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لا شَرِيكَ لَكَ
                لَبَّيْكَ
              </ArabicText>
              <span className="text-xs text-primary-foreground/70 italic">
                &ldquo;At Your Service, O Lord, At Your Service&rdquo;
              </span>
            </div>
          </div>
        </div>

        {/* Accreditation & Verified Regulatory Licenses Strip (`T-056`, `OD-10`) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary-foreground/15 py-6">
          <div className="flex flex-wrap items-center gap-5 text-xs text-primary-foreground/85">
            <div className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-gold" aria-hidden="true" />
              <span>Hajj, Umrah, Flights, Hotels, and Tours</span>
            </div>
            {licenseBadges.length > 0 ? (
              licenseBadges.map((badge) => (
                <div
                  key={badge.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-primary-foreground/10 px-3 py-1 text-[11px] text-primary-foreground"
                >
                  <Award className="size-3.5 text-gold" aria-hidden="true" />
                  <span className="font-semibold text-gold">
                    {badge.label}:
                  </span>
                  <span className="font-mono tabular-nums">{badge.value}</span>
                </div>
              ))
            ) : (
              <div className="inline-flex items-center gap-2">
                <Award className="size-4 text-gold" aria-hidden="true" />
                <span>Where Purpose Meets Excellence</span>
              </div>
            )}
            <div className="inline-flex items-center gap-2">
              <Lock className="size-4 text-gold" aria-hidden="true" />
              <span>TLS Encrypted Pilgrim Dossiers</span>
            </div>
          </div>
          <div className="text-xs text-primary-foreground/75">
            {officeAddress}
          </div>
        </div>

        {/* Bottom Bar: Copyright & Canonical Legal Routes */}
        <div className="flex flex-col items-center justify-between gap-4 pt-6 text-xs text-primary-foreground/75 sm:flex-row">
          <div>
            &copy; {currentYear} {resolvedLegalName}. All rights reserved.
          </div>
          <nav
            aria-label="Legal policies"
            className="flex flex-wrap items-center gap-4"
          >
            <Link
              href="/privacy"
              className="inline-flex min-h-6 items-center rounded-sm py-0.5 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              Privacy Policy
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/terms"
              className="inline-flex min-h-6 items-center rounded-sm py-0.5 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              Terms of Service
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/refund-policy"
              className="inline-flex min-h-6 items-center rounded-sm py-0.5 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              Refund &amp; Cancellation Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
