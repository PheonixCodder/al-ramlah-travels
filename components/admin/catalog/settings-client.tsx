"use client"

import * as React from "react"
import { useState } from "react"
import { updateAgencySettings } from "@/app/actions/catalog"
import { DEFAULT_OFFICE_ADDRESS } from "@/lib/company-info"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Phone,
  MapPin,
  Save,
  Loader2,
  CheckCircle2,
  Globe,
  Coins,
  ShieldCheck,
  Landmark,
  Lock,
} from "lucide-react"

export interface AgencySettingsData {
  agencyName: string
  legalEntityName?: string | null
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
  dtsLicense?: string | null
  moraLicense?: string | null
  iataCode?: string | null
  ntnNumber?: string | null
  bankName?: string | null
  accountTitle?: string | null
  officialIban?: string | null
  ibanVerified?: boolean
}

interface SettingsClientProps {
  initialSettings?: AgencySettingsData | null
  isSuperAdmin?: boolean
}

export function SettingsClient({
  initialSettings,
  isSuperAdmin = true,
}: SettingsClientProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [agencyName, setAgencyName] = useState(
    initialSettings?.agencyName ?? "Al Ramlah Travels"
  )
  const [legalEntityName, setLegalEntityName] = useState(
    initialSettings?.legalEntityName ??
      initialSettings?.agencyName ??
      "Al Ramlah Travels"
  )
  const [tagline, setTagline] = useState(
    initialSettings?.tagline ?? "Where Purpose Meets Excellence"
  )
  const [primaryWhatsapp, setPrimaryWhatsapp] = useState(
    initialSettings?.primaryWhatsapp ?? "03274029701"
  )
  const [secondaryPhone, setSecondaryPhone] = useState(
    initialSettings?.secondaryPhone ?? "03190462638"
  )
  const [supportEmail, setSupportEmail] = useState(
    initialSettings?.supportEmail ?? "alramlahtravels@gmail.com"
  )
  const [officeAddress, setOfficeAddress] = useState(
    initialSettings?.officeAddress ?? DEFAULT_OFFICE_ADDRESS
  )
  const [workingHours, setWorkingHours] = useState(
    initialSettings?.workingHours ??
      "Monday to Saturday: 9:00 AM to 8:00 PM PKT"
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
  const [tiktokUrl, setTiktokUrl] = useState(initialSettings?.tiktokUrl ?? "")

  // Regulatory & Official Banking (`OD-10`, `T-077`)
  const [dtsLicense, setDtsLicense] = useState(
    initialSettings?.dtsLicense ?? ""
  )
  const [moraLicense, setMoraLicense] = useState(
    initialSettings?.moraLicense ?? ""
  )
  const [iataCode, setIataCode] = useState(initialSettings?.iataCode ?? "")
  const [ntnNumber, setNtnNumber] = useState(initialSettings?.ntnNumber ?? "")
  const [bankName, setBankName] = useState(initialSettings?.bankName ?? "")
  const [accountTitle, setAccountTitle] = useState(
    initialSettings?.accountTitle ?? "Al Ramlah Travels"
  )
  const [officialIban, setOfficialIban] = useState(
    initialSettings?.officialIban ?? ""
  )
  const [ibanVerified, setIbanVerified] = useState<boolean>(
    initialSettings?.ibanVerified ?? false
  )

  const [prevInitialSettings, setPrevInitialSettings] =
    useState(initialSettings)
  if (prevInitialSettings !== initialSettings) {
    setPrevInitialSettings(initialSettings)
    if (initialSettings) {
      setAgencyName(initialSettings.agencyName ?? "Al Ramlah Travels")
      setLegalEntityName(
        initialSettings.legalEntityName ??
          initialSettings.agencyName ??
          "Al Ramlah Travels"
      )
      setTagline(initialSettings.tagline ?? "Where Purpose Meets Excellence")
      setPrimaryWhatsapp(initialSettings.primaryWhatsapp ?? "03274029701")
      setSecondaryPhone(initialSettings.secondaryPhone ?? "03190462638")
      setSupportEmail(
        initialSettings.supportEmail ?? "alramlahtravels@gmail.com"
      )
      setOfficeAddress(initialSettings.officeAddress ?? DEFAULT_OFFICE_ADDRESS)
      setWorkingHours(
        initialSettings.workingHours ??
          "Monday to Saturday: 9:00 AM to 8:00 PM PKT"
      )
      setSlaOverdueHours(initialSettings.slaOverdueHours ?? 24)
      setSarToPkrRate(initialSettings.sarToPkrRate ?? 75)
      setMapsEmbedUrl(initialSettings.mapsEmbedUrl ?? "")
      setFacebookUrl(initialSettings.facebookUrl ?? "")
      setInstagramUrl(initialSettings.instagramUrl ?? "")
      setYoutubeUrl(initialSettings.youtubeUrl ?? "")
      setTiktokUrl(initialSettings.tiktokUrl ?? "")
      setDtsLicense(initialSettings.dtsLicense ?? "")
      setMoraLicense(initialSettings.moraLicense ?? "")
      setIataCode(initialSettings.iataCode ?? "")
      setNtnNumber(initialSettings.ntnNumber ?? "")
      setBankName(initialSettings.bankName ?? "")
      setAccountTitle(initialSettings.accountTitle ?? "Al Ramlah Travels")
      setOfficialIban(initialSettings.officialIban ?? "")
      setIbanVerified(initialSettings.ibanVerified ?? false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSuperAdmin) return
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await updateAgencySettings({
        agencyName,
        legalEntityName,
        tagline,
        primaryWhatsapp,
        secondaryPhone: secondaryPhone || "",
        supportEmail,
        officeAddress,
        workingHours,
        slaOverdueHours,
        sarToPkrRate,
        mapsEmbedUrl: mapsEmbedUrl || "",
        facebookUrl: facebookUrl || "",
        instagramUrl: instagramUrl || "",
        youtubeUrl: youtubeUrl || "",
        tiktokUrl: tiktokUrl || "",
        dtsLicense: dtsLicense || "",
        moraLicense: moraLicense || "",
        iataCode: iataCode || "",
        ntnNumber: ntnNumber || "",
        bankName: bankName || "",
        accountTitle: accountTitle || "",
        officialIban: officialIban || "",
        ibanVerified: Boolean(officialIban.trim()) && ibanVerified,
      })
      if (!res.success) {
        setError(res.error || "Failed to update agency settings.")
        return
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3500)
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
          Agency Settings, Regulatory Licenses &amp; Banking SSoT
        </h1>
        <p className="text-sm text-muted-foreground">
          Single source of truth for Lahore HQ contact coordinates,
          DTS/MORA/IATA/NTN regulatory credentials, verified remittance IBAN,
          and SAR-to-PKR exchange rate.
        </p>
      </div>

      {!isSuperAdmin && (
        <div className="flex items-center gap-2.5 rounded-xl border border-status-warning-border bg-status-warning-bg p-4 text-xs text-status-warning">
          <Lock
            className="size-4 shrink-0 text-status-warning"
            aria-hidden="true"
          />
          <span>
            Read-only view: Only a <strong>Super Administrator</strong> may
            modify agency legal, regulatory, banking, or global forex settings.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-status-danger-border bg-status-danger-bg p-4 text-xs text-status-danger">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-status-success-border bg-status-success-bg p-4 text-xs text-status-success">
          <CheckCircle2
            className="size-4 shrink-0 text-status-success"
            aria-hidden="true"
          />
          <span>
            Agency settings updated across all public pages and luxury PDFs.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={!isSuperAdmin || loading} className="space-y-6">
          {/* Brand & Legal Identity Card */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="size-4 text-gold-text" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">
                Brand &amp; Legal Entity Identity
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-name">Public Brand Name</Label>
                <Input
                  id="as-name"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Al Ramlah Travels"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-legal-name">
                  Registered Legal Entity Name
                </Label>
                <Input
                  id="as-legal-name"
                  value={legalEntityName}
                  onChange={(e) => setLegalEntityName(e.target.value)}
                  placeholder="Al Ramlah Travels (Pvt.) Ltd."
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-tagline">Marketing Tagline</Label>
                <Input
                  id="as-tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Where Purpose Meets Excellence"
                  required
                />
              </div>
            </div>
          </div>

          {/* Regulatory Credentials Card (`OD-10`) */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className="size-4 text-status-success"
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-foreground">
                  Government &amp; Industry Accreditations
                </h2>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Displayed on footer &amp; legal pages only when populated
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="as-dts">DTS License No.</Label>
                <Input
                  id="as-dts"
                  value={dtsLicense}
                  onChange={(e) => setDtsLicense(e.target.value)}
                  placeholder="Leave blank until issued"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-mora">
                  MORA Enlistment / Hajj Quota No.
                </Label>
                <Input
                  id="as-mora"
                  value={moraLicense}
                  onChange={(e) => setMoraLicense(e.target.value)}
                  placeholder="Leave blank until issued"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-iata">IATA Numeric Code</Label>
                <Input
                  id="as-iata"
                  value={iataCode}
                  onChange={(e) => setIataCode(e.target.value)}
                  placeholder="e.g. 27-3-XXXX"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-ntn">FBR NTN Number</Label>
                <Input
                  id="as-ntn"
                  value={ntnNumber}
                  onChange={(e) => setNtnNumber(e.target.value)}
                  placeholder="e.g. 1234567-8"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Official Corporate Remittance & IBAN Governance (`OD-10`, `T-080`) */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Landmark
                  className="size-4 text-gold-text"
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-foreground">
                  Official Corporate Bank &amp; IBAN Governance
                </h2>
              </div>
              <Badge
                variant="outline"
                className={
                  ibanVerified && officialIban.trim()
                    ? "border-status-success-border bg-status-success-bg text-[11px] text-status-success"
                    : "border-status-warning-border bg-status-warning-bg text-[11px] text-status-warning"
                }
              >
                {ibanVerified && officialIban.trim()
                  ? "IBAN Verified for PDF Quotations"
                  : "Lahore HQ Verification Mode (IBAN Hidden on PDFs)"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-bank-name">Bank Name</Label>
                <Input
                  id="as-bank-name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Meezan Bank Limited"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-acc-title">Corporate Account Title</Label>
                <Input
                  id="as-acc-title"
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                  placeholder="Al Ramlah Travels"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-iban">Official 24-Char PK IBAN</Label>
                <Input
                  id="as-iban"
                  value={officialIban}
                  onChange={(e) =>
                    setOfficialIban(e.target.value.toUpperCase())
                  }
                  placeholder="PK36MEZN0000000123456789"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-secondary/50 p-3 text-xs">
              <input
                type="checkbox"
                checked={ibanVerified && Boolean(officialIban.trim())}
                disabled={!officialIban.trim()}
                onChange={(e) => setIbanVerified(e.target.checked)}
                className="mt-0.5 size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <div>
                <span className="block font-semibold text-foreground">
                  Confirm IBAN is verified by Finance &amp; authorize printing
                  on pilgrim PDF quotations
                </span>
                <span className="text-muted-foreground">
                  When unchecked, pilgrim quotations display a safe Lahore HQ
                  bank-verification instruction instead of an unverified account
                  number.
                </span>
              </div>
            </label>
          </div>

          {/* Contact Communications Card */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Phone
                className="size-4 text-status-success"
                aria-hidden="true"
              />
              <h2 className="text-base font-semibold text-foreground">
                Contact &amp; Inquiries
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="as-wa">Primary WhatsApp Contact</Label>
                <Input
                  id="as-wa"
                  value={primaryWhatsapp}
                  onChange={(e) => setPrimaryWhatsapp(e.target.value)}
                  placeholder="03274029701"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-phone">Secondary Landline / Mobile</Label>
                <Input
                  id="as-phone"
                  value={secondaryPhone ?? ""}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                  placeholder="03190462638"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-email">Official Support Email</Label>
                <Input
                  id="as-email"
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="alramlahtravels@gmail.com"
                  required
                />
              </div>
            </div>
          </div>

          {/* Physical Office & Operations */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <MapPin
                className="size-4 text-status-warning"
                aria-hidden="true"
              />
              <h2 className="text-base font-semibold text-foreground">
                Lahore HQ Location, Forex &amp; SLA
              </h2>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="as-address">Verified Office Street Address</Label>
              <Input
                id="as-address"
                value={officeAddress}
                onChange={(e) => setOfficeAddress(e.target.value)}
                placeholder={DEFAULT_OFFICE_ADDRESS}
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
                  placeholder="Monday to Saturday: 9:00 AM to 8:00 PM PKT"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-sla">
                  Quote SLA Overdue Threshold (Hours)
                </Label>
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
                  <Coins
                    className="size-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  <Label htmlFor="as-sar" className="font-semibold">
                    SAR to PKR Rate (1 SAR = PKR)
                  </Label>
                </div>
                <Input
                  id="as-sar"
                  type="number"
                  step="0.01"
                  min={1}
                  value={sarToPkrRate}
                  onChange={(e) => setSarToPkrRate(Number(e.target.value))}
                  required
                  className="font-mono font-bold text-foreground"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="as-maps">Google Maps Link / Embed URL</Label>
              <Input
                id="as-maps"
                value={mapsEmbedUrl ?? ""}
                onChange={(e) => setMapsEmbedUrl(e.target.value)}
                placeholder="https://maps.google.com/?q=Sector+C+Askari+10+Airport+Road+Lahore+Cantt"
              />
            </div>
          </div>

          {/* Social Media Links */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Globe className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">
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
                  placeholder="https://facebook.com/alramlahtravels"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-ig">Instagram URL</Label>
                <Input
                  id="as-ig"
                  value={instagramUrl ?? ""}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/alramlahtravels"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-yt">YouTube URL</Label>
                <Input
                  id="as-yt"
                  value={youtubeUrl ?? ""}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/@alramlahtravels"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-tk">TikTok URL</Label>
                <Input
                  id="as-tk"
                  value={tiktokUrl ?? ""}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="https://tiktok.com/@alramlahtravels"
                />
              </div>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="cursor-pointer gap-2 bg-primary px-6 py-2.5 text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {loading ? (
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                <span>Save Agency Settings</span>
              </Button>
            </div>
          )}
        </fieldset>
      </form>
    </div>
  )
}
