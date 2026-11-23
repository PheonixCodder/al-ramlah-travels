"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { submitPublicContactInquiryAction } from "@/app/actions/applications"
import { toWaMeUrl } from "@/components/public/public-utils"
import { readStoredAttribution } from "@/lib/seo/utm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react"
import {
  DEFAULT_COMPANY_INFO,
  formatPkPhoneDisplay,
  toTelHref,
} from "@/lib/company-info"

export interface AgencyContactInfo {
  agencyName: string
  tagline: string
  primaryWhatsapp: string
  secondaryPhone?: string | null
  supportEmail: string
  officeAddress: string
  workingHours: string
  mapsEmbedUrl?: string | null
  dtsLicense?: string | null
  moraLicense?: string | null
  iataCode?: string | null
  ntnNumber?: string | null
}

interface ContactSectionProps {
  settings?: AgencyContactInfo | null
}

function cleanLicenseValue(val?: string | null): string | null {
  if (!val) return null
  const trimmed = val.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function ContactSection({ settings }: ContactSectionProps) {
  const info = settings || DEFAULT_COMPANY_INFO
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("General Umrah Inquiry")
  const [message, setMessage] = useState("")
  const [honeypot, setHoneypot] = useState("")

  function syncPhone(val: string) {
    setPhone(val)
    if (!whatsapp || whatsapp === phone) {
      setWhatsapp(val)
    }
    if (fieldErrors.phone) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next.phone
        return next
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setSuccess(false)
    setError(null)
    setFieldErrors({})

    try {
      const res = await submitPublicContactInquiryAction({
        name,
        phone,
        whatsapp: whatsapp || undefined,
        email: email || undefined,
        subject,
        message,
        honeypot,
        attribution: readStoredAttribution(),
      })

      if (!res.success) {
        setSuccess(false)
        setError(
          res.error || "Please review the highlighted fields and try again."
        )
        setFieldErrors(res.fieldErrors ?? {})
        return
      }

      setSuccess(true)
      setError(null)
      setFieldErrors({})
      setName("")
      setPhone("")
      setWhatsapp("")
      setEmail("")
      setMessage("")
    } catch (err: unknown) {
      setSuccess(false)
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send message. Please try again or WhatsApp us directly."
      )
    } finally {
      setLoading(false)
    }
  }

  const primaryWaHref = toWaMeUrl(
    info.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels! I would like to connect with your Lahore concierge desk regarding pilgrimage services."
  )
  const primaryTelHref = toTelHref(info.primaryWhatsapp)
  const primaryDisplay = formatPkPhoneDisplay(info.primaryWhatsapp)
  const secondaryTelHref = info.secondaryPhone
    ? toTelHref(info.secondaryPhone)
    : null
  const secondaryDisplay = info.secondaryPhone
    ? formatPkPhoneDisplay(info.secondaryPhone)
    : null

  const safeMapsUrl =
    info.mapsEmbedUrl && info.mapsEmbedUrl.startsWith("https://")
      ? info.mapsEmbedUrl
      : DEFAULT_COMPANY_INFO.mapsEmbedUrl

  // OD-10: Only render verified regulatory licenses when explicitly set in agencySettings
  const verifiedLicenses: Array<{ label: string; value: string }> = []
  const dts = cleanLicenseValue(info.dtsLicense)
  const mora = cleanLicenseValue(info.moraLicense)
  const iata = cleanLicenseValue(info.iataCode)
  const ntn = cleanLicenseValue(info.ntnNumber)
  if (dts) verifiedLicenses.push({ label: "DTS License", value: dts })
  if (mora) verifiedLicenses.push({ label: "MoRA / HGO", value: mora })
  if (iata) verifiedLicenses.push({ label: "IATA", value: iata })
  if (ntn) verifiedLicenses.push({ label: "NTN", value: ntn })

  return (
    <section
      id="contact"
      aria-labelledby="home-contact-heading"
      className="scroll-mt-20 border-t border-border bg-secondary/45 py-14 sm:py-16"
    >
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
        {/* Editorial Left-Aligned Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2
              id="home-contact-heading"
              className="font-display text-2xl font-bold tracking-tight text-primary text-balance sm:text-3xl lg:text-4xl"
            >
              Connect with Our Lahore Cantt Travel Directors
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Whether you are coordinating a family Umrah, organizing an
              extended group, or visiting our Askari 10 headquarters in person,
              our ticketing desk responds within 24 hours.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/contact"
              className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 sm:text-sm"
            >
              <span>Visit Full Lahore Cantt Office &amp; Directions Guide</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Left Panel: Deep Haramain Emerald Askari 10 HQ Card (5 cols) */}
          <div className="flex min-w-0 flex-col justify-between gap-6 rounded-2xl bg-primary p-6 text-primary-foreground shadow-xs sm:p-8 lg:col-span-5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-xl font-bold text-primary-foreground sm:text-2xl">
                  Executive Agency Headquarters
                </h3>
                <p className="text-xs text-primary-foreground/80 sm:text-sm">
                  Askari 10, Airport Road, Lahore Cantt
                </p>
              </div>

              <div className="flex flex-col gap-4 text-sm">
                {/* Address */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-primary-foreground/10 text-gold">
                    <MapPin className="size-4" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="block font-semibold text-primary-foreground">
                      Physical Office (Lahore HQ)
                    </span>
                    <p className="text-xs leading-relaxed text-primary-foreground/85">
                      {info.officeAddress}
                    </p>
                    {safeMapsUrl && (
                      <a
                        href={safeMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-6 items-center gap-1 pt-0.5 text-xs font-semibold text-gold underline decoration-gold/50 underline-offset-4 transition-colors hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
                      >
                        <span>Open Askari 10 Lahore HQ on Google Maps</span>
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>

                {/* WhatsApp + E.164 Call */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-primary-foreground/10 text-gold">
                    <MessageCircle className="size-4" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="block font-semibold text-primary-foreground">
                      Primary WhatsApp &amp; Hotline
                    </span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <a
                        href={primaryWaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-6 items-center gap-1.5 font-medium text-gold underline decoration-gold/50 underline-offset-4 transition-colors hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
                      >
                        <span>WhatsApp</span>
                        <span className="font-mono tabular-nums">
                          {primaryDisplay}
                        </span>
                      </a>
                      <a
                        href={primaryTelHref}
                        className="inline-flex min-h-6 items-center gap-1.5 text-primary-foreground/85 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
                      >
                        <span>Call</span>
                        <span className="font-mono tabular-nums">
                          {primaryDisplay}
                        </span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Secondary Telephone */}
                {secondaryTelHref && secondaryDisplay && (
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-primary-foreground/10 text-gold">
                      <Phone className="size-4" aria-hidden="true" />
                    </div>
                    <div>
                      <span className="block font-semibold text-primary-foreground">
                        Office Telephone
                      </span>
                      <a
                        href={secondaryTelHref}
                        className="inline-flex min-h-6 items-center font-mono text-xs tabular-nums text-primary-foreground/85 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
                      >
                        {secondaryDisplay}
                      </a>
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-primary-foreground/10 text-gold">
                    <Mail className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="block font-semibold text-primary-foreground">
                      Official Inquiries Email
                    </span>
                    <a
                      href={`mailto:${info.supportEmail}`}
                      className="inline-flex min-h-6 items-center text-xs text-primary-foreground/85 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
                    >
                      {info.supportEmail}
                    </a>
                  </div>
                </div>

                {/* Working Hours */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-primary-foreground/10 text-gold">
                    <Clock className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="block font-semibold text-primary-foreground">
                      Operating Schedule
                    </span>
                    <p className="mt-0.5 text-xs text-primary-foreground/85">
                      {info.workingHours}
                    </p>
                  </div>
                </div>
              </div>

              {verifiedLicenses.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-primary-foreground/15 pt-4">
                  {verifiedLicenses.map((lic) => (
                    <span
                      key={lic.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-primary-foreground/10 px-2.5 py-1 text-xs text-primary-foreground"
                    >
                      <Award
                        className="size-3 text-gold"
                        aria-hidden="true"
                      />
                      <strong className="font-semibold text-gold">
                        {lic.label}:
                      </strong>
                      <span className="font-mono tabular-nums">
                        {lic.value}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Integrated Concierge Promise */}
            <div className="flex items-start gap-3 border-t border-primary-foreground/15 pt-4 text-xs leading-relaxed text-primary-foreground/90">
              <ShieldCheck
                className="mt-0.5 size-5 shrink-0 text-gold"
                aria-hidden="true"
              />
              <div>
                <span className="block font-bold text-gold">
                  Where Purpose Meets Excellence
                </span>
                Dedicated pilgrim concierge for Hajj, Umrah, flights, hotels,
                and Ziyarat tours with 24/7 on-ground assistance.
              </div>
            </div>
          </div>

          {/* Right Panel: Alabaster Direct Concierge Inquiry Form (7 cols) */}
          <div className="flex min-w-0 flex-col lg:col-span-7">
            <div className="flex h-full flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
              <div>
                <h3 className="font-display text-xl font-bold text-foreground sm:text-2xl">
                  Send a Direct Message
                </h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Have a specific itinerary request or flight inquiry? Our team
                  responds within 24 hours.
                </p>
              </div>

              {success && !error && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 p-4 text-xs text-primary sm:text-sm"
                >
                  <CheckCircle2
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    Thank you! Your message has been routed to our Lahore
                    concierge team. We will call or WhatsApp you promptly.
                  </span>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive sm:text-sm"
                >
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
                noValidate
              >
                {/* Hidden Honeypot Anti-Spam Trap (`T-055`) */}
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="c-website">Company Website</label>
                  <input
                    id="c-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="c-name" className="text-xs font-semibold">
                      Your Full Name *
                    </Label>
                    <Input
                      id="c-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Asad Qureshi"
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={
                        fieldErrors.name ? "c-name-error" : undefined
                      }
                      className="min-h-11 bg-background focus-visible:outline-2 focus-visible:outline-primary"
                      required
                    />
                    {fieldErrors.name && (
                      <p
                        id="c-name-error"
                        className="text-xs font-medium text-destructive"
                      >
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="c-email" className="text-xs font-semibold">
                      Email Address (Optional)
                    </Label>
                    <Input
                      id="c-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="asad@example.com"
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={
                        fieldErrors.email ? "c-email-error" : undefined
                      }
                      className="min-h-11 bg-background focus-visible:outline-2 focus-visible:outline-primary"
                    />
                    {fieldErrors.email && (
                      <p
                        id="c-email-error"
                        className="text-xs font-medium text-destructive"
                      >
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="c-phone" className="text-xs font-semibold">
                      Phone Number *
                    </Label>
                    <Input
                      id="c-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => syncPhone(e.target.value)}
                      placeholder="0327 4029701 or +44 7911 123456"
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={
                        fieldErrors.phone ? "c-phone-error" : undefined
                      }
                      className="min-h-11 bg-background font-mono tabular-nums focus-visible:outline-2 focus-visible:outline-primary"
                      required
                    />
                    {fieldErrors.phone && (
                      <p
                        id="c-phone-error"
                        className="text-xs font-medium text-destructive"
                      >
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="c-wa" className="text-xs font-semibold">
                      WhatsApp Number
                    </Label>
                    <Input
                      id="c-wa"
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="0327 4029701"
                      aria-invalid={Boolean(fieldErrors.whatsapp)}
                      aria-describedby={
                        fieldErrors.whatsapp ? "c-wa-error" : undefined
                      }
                      className="min-h-11 bg-background font-mono tabular-nums focus-visible:outline-2 focus-visible:outline-primary"
                    />
                    {fieldErrors.whatsapp && (
                      <p
                        id="c-wa-error"
                        className="text-xs font-medium text-destructive"
                      >
                        {fieldErrors.whatsapp}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="c-sub" className="text-xs font-semibold">
                    Inquiry Subject
                  </Label>
                  <select
                    id="c-sub"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={loading}
                    className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="General Umrah Inquiry">
                      General Umrah Inquiry
                    </option>
                    <option value="Custom Family Package Quote">
                      Custom Family Package Quote
                    </option>
                    <option value="Group Departure Booking">
                      Group Departure Booking
                    </option>
                    <option value="Hajj 2027 Pre-Registration (Maktab A+ / A / B / C)">
                      Hajj 2027 Pre-Registration (Maktab A+ / A / B / C)
                    </option>
                    <option value="Corporate / Institution Pilgrimage">
                      Corporate / Institution Pilgrimage
                    </option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="c-msg" className="text-xs font-semibold">
                    How can we assist your journey? *
                  </Label>
                  <Textarea
                    id="c-msg"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your estimated travel month, party size, preferred hotel distance from Haram, or specific airline..."
                    aria-invalid={Boolean(fieldErrors.message)}
                    aria-describedby={
                      fieldErrors.message ? "c-msg-error" : undefined
                    }
                    className="bg-background focus-visible:outline-2 focus-visible:outline-primary"
                    required
                  />
                  {fieldErrors.message && (
                    <p
                      id="c-msg-error"
                      className="text-xs font-medium text-destructive"
                    >
                      {fieldErrors.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="min-h-11 w-full gap-2 bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  <span>Send Inquiry to Concierge</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
