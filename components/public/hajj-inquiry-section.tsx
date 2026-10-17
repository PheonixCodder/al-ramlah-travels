"use client"

import * as React from "react"
import { useState } from "react"
import Image from "next/image"
import { submitHajjInquiry } from "@/app/actions/groups"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  ShieldCheck,
  CheckCircle2,
  Tent,
  Building,
  Sparkles,
  Phone,
  MessageCircle,
  Loader2,
  Users,
  Compass,
} from "lucide-react"

export interface HajjInquirySectionProps {
  departureCities?: { cityName: string; airportCode: string }[]
  agencyWhatsapp?: string
}

export function HajjInquirySection({
  departureCities,
  agencyWhatsapp = "+923001234567",
}: HajjInquirySectionProps = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmedRef, setConfirmedRef] = useState<string | null>(null)

  // Form State
  const [hajjCategory, setHajjCategory] = useState<string>(
    "VIP Majar Al-Kabsh Mina Camp"
  )
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerWhatsapp, setCustomerWhatsapp] = useState("")
  const [customerCity, setCustomerCity] = useState(
    departureCities?.[0]?.cityName ?? "Lahore"
  )
  const [customerEmail, setCustomerEmail] = useState("")
  const [adults, setAdults] = useState<number>(2)
  const [children, setChildren] = useState<number>(0)
  const [infants, setInfants] = useState<number>(0)
  const [notes, setNotes] = useState("")

  function syncPhone(val: string) {
    setCustomerPhone(val)
    if (!customerWhatsapp || customerWhatsapp === customerPhone) {
      setCustomerWhatsapp(val)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await submitHajjInquiry({
        hajjConsultationType: hajjCategory,
        passengers: { adults, children, infants },
        contact: {
          customerName,
          customerPhone,
          customerWhatsapp,
          customerCity,
          customerEmail: customerEmail || undefined,
        },
        notes: notes || undefined,
      })

      if (res.success) {
        setConfirmedRef(res.referenceNumber)
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to submit inquiry.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      id="hajj-inquiry"
      className="relative overflow-hidden bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 py-24 text-white scroll-mt-16"
    >
      {/* Background Islamic Pattern Subtle Overlay */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#C5A059_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-black/40 px-4 py-1.5 backdrop-blur-md">
            <span
              dir="rtl"
              className="font-arabic text-base text-gold font-medium"
            >
              حَجٌّ مَبْرُورٌ وَذَنْبٌ مَغْفُورٌ
            </span>
          </div>

          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Hajj 1447H / 2026 Executive Consultations
          </h2>

          <p className="text-white/80 text-sm sm:text-base leading-relaxed">
            Due to Saudi Ministry of Hajj & Umrah quotas and mandatory Maktab tent regulations, premium Hajj arrangements cannot be purchased via automated online checkouts. We provide confidential, one-on-one executive consultations to assess VIP Maktab allotments, Nusuk documentation, and private Mina accommodations.
          </p>
        </div>

        {/* 3 Maktab Tiers Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Card 1: Majar Al-Kabsh VIP */}
          <div
            onClick={() => setHajjCategory("VIP Majar Al-Kabsh Mina Camp")}
            className={`cursor-pointer rounded-2xl border p-6 backdrop-blur-md transition-all ${
              hajjCategory === "VIP Majar Al-Kabsh Mina Camp"
                ? "border-gold bg-black/40 ring-2 ring-gold/40 shadow-xl shadow-gold/10"
                : "border-white/10 bg-black/25 hover:border-white/30"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-gold/20 text-gold border border-gold/40">
                  <Sparkles className="size-5" />
                </span>
                <Badge className="bg-gold text-emerald-950 font-bold text-[10px]">
                  Category A+
                </Badge>
              </div>

              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-white">
                  VIP Majar Al-Kabsh Tents
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Footsteps from the Jamarat bridge. Solid drywall gypsum tents, private ensuite washrooms, European buffet, and dedicated scholar guides.
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 text-xs font-semibold text-gold">
                Recommended for VIPs & Elderly Pilgrims
              </div>
            </div>
          </div>

          {/* Card 2: Shisha / Near Jamarat */}
          <div
            onClick={() => setHajjCategory("Shisha Near Jamarat Executive")}
            className={`cursor-pointer rounded-2xl border p-6 backdrop-blur-md transition-all ${
              hajjCategory === "Shisha Near Jamarat Executive"
                ? "border-gold bg-black/40 ring-2 ring-gold/40 shadow-xl shadow-gold/10"
                : "border-white/10 bg-black/25 hover:border-white/30"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <Building className="size-5" />
                </span>
                <Badge className="bg-emerald-900 text-emerald-100 border-emerald-400 text-[10px]">
                  Executive Building
                </Badge>
              </div>

              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-white">
                  Shisha Near Jamarat
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Walking distance building accommodation prior to Mina days, combined with upgraded Zone 1 Mina tents and private coach transit.
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 text-xs font-semibold text-emerald-300">
                Comfort & Quick Jamarat Access
              </div>
            </div>
          </div>

          {/* Card 3: Aziziyah Executive */}
          <div
            onClick={() => setHajjCategory("Aziziyah Standard & Upgraded Camp")}
            className={`cursor-pointer rounded-2xl border p-6 backdrop-blur-md transition-all ${
              hajjCategory === "Aziziyah Standard & Upgraded Camp"
                ? "border-gold bg-black/40 ring-2 ring-gold/40 shadow-xl shadow-gold/10"
                : "border-white/10 bg-black/25 hover:border-white/30"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  <Tent className="size-5" />
                </span>
                <Badge className="bg-blue-900 text-blue-100 border-blue-400 text-[10px]">
                  Standard Maktab
                </Badge>
              </div>

              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-white">
                  Aziziyah & Traditional Maktab
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Budget-optimized arrangement with Aziziyah building stay, standard government Maktab tents, and organized group shuttle transit.
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 text-xs font-semibold text-blue-300">
                High Value & Community Guidance
              </div>
            </div>
          </div>
        </div>

        {/* Consultation Callback Form */}
        <div className="mx-auto max-w-3xl rounded-3xl border border-gold/30 bg-black/50 p-6 sm:p-10 backdrop-blur-xl shadow-2xl">
          {confirmedRef ? (
            <div className="space-y-6 py-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold/20 text-gold border border-gold/40">
                <CheckCircle2 className="size-8" />
              </div>

              <div className="space-y-2">
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Consultation Request Received
                </h3>
                <p className="text-sm text-white/80 max-w-md mx-auto">
                  Your Hajj 1447H consultation request has been assigned directly to our Senior Hajj Director.
                </p>
              </div>

              <div className="mx-auto max-w-sm rounded-xl border border-gold/40 bg-black/60 p-4 space-y-1">
                <span className="text-[11px] font-semibold text-gold uppercase tracking-wider">
                  Confidential Inquiry Reference
                </span>
                <div className="font-mono text-2xl font-extrabold text-white">
                  {confirmedRef}
                </div>
              </div>

              <p className="text-xs text-white/70 max-w-sm mx-auto">
                Due to Hajj quota sensitivity, our director will contact you via WhatsApp and telephone to review your passport and Nusuk requirements.
              </p>

              <div className="pt-2 flex justify-center">
                <a
                  href={`https://wa.me/${agencyWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `Assalam-o-Alaikum, I submitted Hajj inquiry ${confirmedRef} for ${hajjCategory}. Please connect me with the Hajj Director.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-emerald-950 hover:bg-gold/90 shadow-lg"
                >
                  <MessageCircle className="size-4" />
                  <span>Connect with Hajj Desk on WhatsApp</span>
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-semibold text-gold uppercase tracking-wider">
                  Request VIP Hajj Consultation
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  Selected Category: {hajjCategory}
                </h3>
              </div>

              {error && (
                <div className="rounded-lg bg-red-950/80 border border-red-500/50 p-3 text-xs text-red-200">
                  {error}
                </div>
              )}

              {/* Lead Pilgrim Name & City */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="h-name" className="text-xs text-white/90">
                    Lead Pilgrim Full Name
                  </Label>
                  <Input
                    id="h-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Al-Haj Tariq Mansoor"
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-city" className="text-xs text-white/90">
                    City in Pakistan
                  </Label>
                  {departureCities && departureCities.length > 0 ? (
                    <select
                      id="h-city"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-gold focus:outline-none"
                      required
                    >
                      {departureCities.map((c) => (
                        <option
                          key={c.airportCode}
                          value={c.cityName}
                          className="bg-emerald-950 text-white"
                        >
                          {c.cityName} ({c.airportCode})
                        </option>
                      ))}
                      <option value="Other" className="bg-emerald-950 text-white">
                        Other City in Pakistan
                      </option>
                    </select>
                  ) : (
                    <Input
                      id="h-city"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      placeholder="e.g. Lahore / Islamabad / Karachi"
                      className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                      required
                    />
                  )}
                </div>
              </div>

              {/* Phone & WhatsApp */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="h-phone" className="text-xs text-white/90">
                    Phone Number
                  </Label>
                  <Input
                    id="h-phone"
                    value={customerPhone}
                    onChange={(e) => syncPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-wa" className="text-xs text-white/90">
                    WhatsApp Number
                  </Label>
                  <Input
                    id="h-wa"
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                    required
                  />
                </div>
              </div>

              {/* Email & Travellers */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="h-email" className="text-xs text-white/90">
                    Email Address (Optional)
                  </Label>
                  <Input
                    id="h-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="tariq@example.com"
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-adults" className="text-xs text-white/90">
                    Adults (12+)
                  </Label>
                  <Input
                    id="h-adults"
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                    className="border-white/20 bg-white/10 text-white focus:border-gold"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-kids" className="text-xs text-white/90">
                    Kids (&lt;12)
                  </Label>
                  <Input
                    id="h-kids"
                    type="number"
                    min={0}
                    value={children}
                    onChange={(e) => setChildren(Number(e.target.value))}
                    className="border-white/20 bg-white/10 text-white focus:border-gold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="h-notes" className="text-xs text-white/90">
                  Special Accommodation or Nusuk Inquiries
                </Label>
                <Textarea
                  id="h-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Inquire about private Jamarat tent allotments, wheelchair assistants, or overseas Pakistani quota..."
                  className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-gold"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2 bg-gold py-3 text-sm font-bold text-emerald-950 hover:bg-gold/90 shadow-lg"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                <span>Request Confidential Hajj Consultation</span>
              </Button>

              <p className="text-center text-[11px] text-white/60">
                🔒 Strictly confidential. We respect Nusuk & MORA compliance; no public card payments are accepted for Hajj quotas.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
