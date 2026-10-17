"use client"

import * as React from "react"
import { useState } from "react"
import { submitContactMessage } from "@/app/actions/cms"
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
} from "lucide-react"

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

const DEFAULT_AGENCY: AgencyContactInfo = {
  agencyName: "Al Ramlah Travels",
  tagline: "Sacred Journeys Crafted with Dignity & Comfort",
  primaryWhatsapp: "+923001234567",
  secondaryPhone: "+924235789012",
  supportEmail: "info@alramlahtravels.com",
  officeAddress: "Suite 402, Al-Hafeez Heights, Gulberg III, Lahore, Pakistan",
  workingHours: "Monday to Saturday, 9:00 AM to 8:00 PM PKT",
}

interface ContactSectionProps {
  settings?: AgencyContactInfo | null
}

export function ContactSection({ settings }: ContactSectionProps) {
  const info = settings || DEFAULT_AGENCY
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("General Umrah Inquiry")
  const [message, setMessage] = useState("")

  function syncPhone(val: string) {
    setPhone(val)
    if (!whatsapp || whatsapp === phone) {
      setWhatsapp(val)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await submitContactMessage({
        name,
        phone,
        whatsapp: whatsapp || undefined,
        email: email || undefined,
        subject,
        message,
      })
      setSuccess(true)
      setName("")
      setPhone("")
      setWhatsapp("")
      setEmail("")
      setMessage("")
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to send message. Please try again or WhatsApp us directly.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="contact" className="py-20 bg-muted/20 border-t border-border scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs uppercase tracking-wider font-semibold">
            Concierge Support
          </Badge>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Connect with Our Travel Directors
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Whether you are planning an executive family Umrah, organizing an extended group, or visiting our Lahore office in person, our staff is at your service.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Cards: Contact Info & Office Details (5 cols) */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-5">
              <h3 className="font-display text-xl font-bold text-foreground">
                Executive Agency Headquarters
              </h3>

              <div className="space-y-4 text-sm">
                {/* Address */}
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="size-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">
                      Physical Office
                    </span>
                    <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">
                      {info.officeAddress}
                    </p>
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
                      href={`https://wa.me/${info.primaryWhatsapp.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono font-medium text-emerald-700 hover:underline"
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
                        className="text-xs font-mono text-muted-foreground hover:text-foreground"
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

            {/* Ministry License Trust Badge */}
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 text-emerald-950 flex items-center gap-3">
              <ShieldCheck className="size-6 text-emerald-700 shrink-0" />
              <div className="text-xs leading-snug">
                <span className="font-bold block">
                  Govt. of Pakistan & Nusuk Licensed
                </span>
                Ministry of Religious Affairs License #4082. All passenger funds held in audited custodial accounts.
              </div>
            </div>
          </div>

          {/* Right Form: Interactive Contact Message Form (7 cols) */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  Send a Direct Message
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Have a specific itinerary request or flight inquiry? Our team responds within 24 hours.
                </p>
              </div>

              {success && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-800">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>
                    Thank you! Your message has been routed to our concierge team. We will call or WhatsApp you promptly.
                  </span>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-name" className="text-xs font-semibold">
                      Your Full Name
                    </Label>
                    <Input
                      id="c-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Asad Qureshi"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-email" className="text-xs font-semibold">
                      Email Address (Optional)
                    </Label>
                    <Input
                      id="c-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="asad@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-phone" className="text-xs font-semibold">
                      Phone Number
                    </Label>
                    <Input
                      id="c-phone"
                      value={phone}
                      onChange={(e) => syncPhone(e.target.value)}
                      placeholder="+92 300 1234567"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-wa" className="text-xs font-semibold">
                      WhatsApp Number
                    </Label>
                    <Input
                      id="c-wa"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+92 300 1234567"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
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
                    <option value="VIP Hajj 1447H Consultation">
                      VIP Hajj 1447H Consultation
                    </option>
                    <option value="Corporate / Institution Pilgrimage">
                      Corporate / Institution Pilgrimage
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="c-msg" className="text-xs font-semibold">
                    How can we assist your journey?
                  </Label>
                  <Textarea
                    id="c-msg"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your estimated travel month, party size, preferred hotel distance from Haram, or specific airline..."
                    required
                  />
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
