"use client"

import * as React from "react"
import { useState } from "react"
import { updateAgencySettings } from "@/app/actions/catalog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldAlert,
  Save,
  Loader2,
  CheckCircle2,
  Globe,
  Coins,
} from "lucide-react"

export interface AgencySettingsData {
  agencyName: string
  tagline: string
  primaryWhatsapp: string
  secondaryPhone?: string | null
  supportEmail: string
  officeAddress: string
  mapsEmbedUrl?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  youtubeUrl?: string | null
  tiktokUrl?: string | null
  workingHours: string
  slaOverdueHours: number
  sarToPkrRate: number
}

interface SettingsClientProps {
  initialSettings?: AgencySettingsData | null
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [agencyName, setAgencyName] = useState(
    initialSettings?.agencyName ?? "Al Ramlah Travels"
  )
  const [tagline, setTagline] = useState(
    initialSettings?.tagline ??
      "Sacred Journeys Crafted with Dignity & Comfort"
  )
  const [primaryWhatsapp, setPrimaryWhatsapp] = useState(
    initialSettings?.primaryWhatsapp ?? "+923001234567"
  )
  const [secondaryPhone, setSecondaryPhone] = useState(
    initialSettings?.secondaryPhone ?? "+924235789012"
  )
  const [supportEmail, setSupportEmail] = useState(
    initialSettings?.supportEmail ?? "info@alramlahtravels.com"
  )
  const [officeAddress, setOfficeAddress] = useState(
    initialSettings?.officeAddress ??
      "Suite 402, Al-Hafeez Heights, Gulberg III, Lahore, Pakistan"
  )
  const [workingHours, setWorkingHours] = useState(
    initialSettings?.workingHours ??
      "Monday to Saturday, 9:00 AM to 8:00 PM PKT"
  )
  const [slaOverdueHours, setSlaOverdueHours] = useState(
    initialSettings?.slaOverdueHours ?? 24
  )
  const [sarToPkrRate, setSarToPkrRate] = useState(
    initialSettings?.sarToPkrRate ?? 75
  )
  const [mapsEmbedUrl, setMapsEmbedUrl] = useState(
    initialSettings?.mapsEmbedUrl ?? ""
  )
  const [facebookUrl, setFacebookUrl] = useState(
    initialSettings?.facebookUrl ?? ""
  )
  const [instagramUrl, setInstagramUrl] = useState(
    initialSettings?.instagramUrl ?? ""
  )
  const [youtubeUrl, setYoutubeUrl] = useState(
    initialSettings?.youtubeUrl ?? ""
  )
  const [tiktokUrl, setTiktokUrl] = useState(
    initialSettings?.tiktokUrl ?? ""
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      await updateAgencySettings({
        agencyName,
        tagline,
        primaryWhatsapp,
        secondaryPhone: secondaryPhone || undefined,
        supportEmail,
        officeAddress,
        workingHours,
        slaOverdueHours,
        sarToPkrRate,
        mapsEmbedUrl: mapsEmbedUrl || undefined,
        facebookUrl: facebookUrl || undefined,
        instagramUrl: instagramUrl || undefined,
        youtubeUrl: youtubeUrl || undefined,
        tiktokUrl: tiktokUrl || undefined,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to update agency settings.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Agency Settings & Brand Info
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure agency contact numbers, office location, quote SLA threshold, global currency conversion rate, and public branding.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-800">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>Agency settings updated successfully across the platform!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Brand Identity Card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Building2 className="size-4 text-gold" />
            <h2 className="font-semibold text-base text-foreground">
              Brand Identity
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="as-name">Agency Legal Name</Label>
              <Input
                id="as-name"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-tagline">Marketing Tagline</Label>
              <Input
                id="as-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Contact Communications Card */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Phone className="size-4 text-emerald-700" />
            <h2 className="font-semibold text-base text-foreground">
              Contact & Inquiries
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-wa">Primary WhatsApp Contact</Label>
              <Input
                id="as-wa"
                value={primaryWhatsapp}
                onChange={(e) => setPrimaryWhatsapp(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-phone">Secondary Landline / Office Phone</Label>
              <Input
                id="as-phone"
                value={secondaryPhone ?? ""}
                onChange={(e) => setSecondaryPhone(e.target.value)}
                placeholder="+924235789012"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-email">Official Support Email</Label>
              <Input
                id="as-email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Physical Office & Operations */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <MapPin className="size-4 text-amber-700" />
            <h2 className="font-semibold text-base text-foreground">
              Office Location, Currency & Operations
            </h2>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="as-address">Office Street Address</Label>
            <Input
              id="as-address"
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-hours">Working / Support Hours</Label>
              <Input
                id="as-hours"
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-sla">Quote SLA Overdue Threshold (Hours)</Label>
              <Input
                id="as-sla"
                type="number"
                min={1}
                max={168}
                value={slaOverdueHours}
                onChange={(e) => setSlaOverdueHours(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Coins className="size-3.5 text-gold" />
                <Label htmlFor="as-sar" className="font-semibold">
                  SAR to PKR Rate (1 SAR = PKR)
                </Label>
              </div>
              <Input
                id="as-sar"
                type="number"
                min={1}
                value={sarToPkrRate}
                onChange={(e) => setSarToPkrRate(Number(e.target.value))}
                required
                className="font-mono font-bold text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="as-maps">Google Maps Embed URL</Label>
            <Input
              id="as-maps"
              value={mapsEmbedUrl ?? ""}
              onChange={(e) => setMapsEmbedUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
        </div>

        {/* Social Media Links */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Globe className="size-4 text-primary" />
            <h2 className="font-semibold text-base text-foreground">
              Social Media Channels
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="as-fb">Facebook URL</Label>
              <Input
                id="as-fb"
                value={facebookUrl ?? ""}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-ig">Instagram URL</Label>
              <Input
                id="as-ig"
                value={instagramUrl ?? ""}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-yt">YouTube URL</Label>
              <Input
                id="as-yt"
                value={youtubeUrl ?? ""}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-tk">TikTok URL</Label>
              <Input
                id="as-tk"
                value={tiktokUrl ?? ""}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="https://tiktok.com/@..."
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            <span>Save Agency Settings</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
