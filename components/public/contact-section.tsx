"use client"

import * as React from "react"
import { useState } from "react"
import { submitPublicContactInquiryAction } from "@/app/actions/applications"
import { toWaMeUrl } from "@/components/public/public-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  MessageCircle,
  Send,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
} from "lucide-react"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"

export interface AgencyContactInfo {
  agencyName: string
  tagline: string
  primaryWhatsapp: string
  secondaryPhone?: string | null
  supportEmail: string
  officeAddress: string
  workingHours: string
  mapsEmbedUrl?: string | null
}

interface ContactSectionProps {
  settings?: AgencyContactInfo | null
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

    // T-095: Always clear prior success/error banners before evaluating a new submission
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
      })

      if (!res.success) {
        setSuccess(false)
        setError(
          res.error ||
            "Please review the highlighted fields and try again."
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

  const safeMapsUrl =
    info.mapsEmbedUrl && info.mapsEmbedUrl.startsWith("https://")
      ? info.mapsEmbedUrl
      : DEFAULT_COMPANY_INFO.mapsEmbedUrl

  return (
    <section
      id="contact"
      className="py-20 bg-muted/20 border-t border-border scroll-mt-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col gap-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto flex flex-col gap-3">
          <Badge className="self-center bg-primary/10 text-primary border-primary/20 text-xs uppercase tracking-wider font-semibold">
            Concierge Support
          </Badge>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Connect with Our Travel Directors
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Whether you are planning an executive family Umrah, organizing an extended group, or visiting our Lahore Cantt headquarters in person, our team is at your service.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Cards: Contact Info & Office Details (5 cols) */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col gap-5">
              <h3 className="font-display text-xl font-bold text-foreground">
                Executive Agency Headquarters
              </h3>

              <div className="flex flex-col gap-4 text-sm">
                {/* Address */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="size-4" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-foreground block">
                      Physical Office (Lahore HQ)
                    </span>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {info.officeAddress}
                    </p>
                    {safeMapsUrl && (
                      <a
                        href={safeMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline pt-0.5"
                      >
                        <span>Open Askari 10 Lahore HQ on Google Maps</span>
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <MessageCircle className="size-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">
                      Primary WhatsApp Desk
                    </span>
                    <a
                      href={primaryWaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono tabular-nums font-medium text-emerald-700 hover:underline"
                    >
                      {info.primaryWhatsapp}
                    </a>
                  </div>
                </div>

                {/* Telephone */}
                {info.secondaryPhone && (
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
                      <Phone className="size-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-foreground block">
                        Office Telephone
                      </span>
                      <a
                        href={`tel:${info.secondaryPhone}`}
                        className="text-xs font-mono tabular-nums text-muted-foreground hover:text-foreground"
                      >
                        {info.secondaryPhone}
                      </a>
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Mail className="size-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">
                      Official Inquiries Email
                    </span>
                    <a
                      href={`mailto:${info.supportEmail}`}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {info.supportEmail}
                    </a>
                  </div>
                </div>

                {/* Working Hours */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">
                      Operating Schedule
                    </span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {info.workingHours}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Badge */}
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 text-emerald-950 flex items-center gap-3">
              <ShieldCheck className="size-6 text-emerald-700 shrink-0" />
              <div className="text-xs leading-snug">
                <span className="font-bold block">
                  Where Purpose Meets Excellence
                </span>
                Hajj • Umrah • Flights • Hotels • Tours. Dedicated pilgrim concierge, transparent pricing, and 24/7 on-ground assistance.
              </div>
            </div>
          </div>

          {/* Right Form: Interactive Contact Message Form (7 cols) */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs flex flex-col gap-6">
              <div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  Send a Direct Message
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Have a specific itinerary request or flight inquiry? Our team responds within 24 hours.
                </p>
              </div>

              {success && !error && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-800"
                >
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>
                    Thank you! Your message has been routed to our Lahore concierge team. We will call or WhatsApp you promptly.
                  </span>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800"
                >
                  <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
                      aria-describedby={fieldErrors.name ? "c-name-error" : undefined}
                      required
                    />
                    {fieldErrors.name && (
                      <p id="c-name-error" className="text-[11px] font-medium text-red-700">
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
                      aria-describedby={fieldErrors.email ? "c-email-error" : undefined}
                    />
                    {fieldErrors.email && (
                      <p id="c-email-error" className="text-[11px] font-medium text-red-700">
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
                      aria-describedby={fieldErrors.phone ? "c-phone-error" : undefined}
                      required
                    />
                    {fieldErrors.phone && (
                      <p id="c-phone-error" className="text-[11px] font-medium text-red-700">
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
                      aria-describedby={fieldErrors.whatsapp ? "c-wa-error" : undefined}
                    />
                    {fieldErrors.whatsapp && (
                      <p id="c-wa-error" className="text-[11px] font-medium text-red-700">
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
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
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
                    <option value="Hajj 2027 Pre-Registration (Maktab A / B / C)">
                      Hajj 2027 Pre-Registration (Maktab A / B / C)
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
                    aria-describedby={fieldErrors.message ? "c-msg-error" : undefined}
                    required
                  />
                  {fieldErrors.message && (
                    <p id="c-msg-error" className="text-[11px] font-medium text-red-700">
                      {fieldErrors.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full gap-2 bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
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
