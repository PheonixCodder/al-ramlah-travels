"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateSarToPkrRate, updateVisaRate } from "@/app/actions/catalog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeftRight,
  CheckCircle2,
  Coins,
  FileCheck,
  Info,
  Loader2,
  Save,
} from "lucide-react"

export interface VisaRateData {
  id: string
  tier: "short_term" | "long_term"
  label: string
  maxDays: number
  pricePkr: number
  priceSar: number
  withoutMasarPriceSar: number
  withMasar10DaysSar: number
  withMasar15DaysSar: number
  withMasar21DaysSar: number
  withMasar28DaysSar: number
  notes?: string | null
  updatedAt?: Date | string | null
}

interface VisaClientProps {
  initialRates: VisaRateData[]
  initialSarToPkrRate?: number
}

const DEFAULT_SHORT_TERM_RATE: VisaRateData = {
  id: "",
  tier: "short_term",
  label: "Standard Umrah Visa (Up to 30 Days)",
  maxDays: 30,
  pricePkr: 42500,
  priceSar: 470,
  withoutMasarPriceSar: 470,
  withMasar10DaysSar: 500,
  withMasar15DaysSar: 515,
  withMasar21DaysSar: 530,
  withMasar28DaysSar: 545,
  notes:
    "Includes Saudi Ministry electronic visa processing & mandatory health coverage.",
  updatedAt: null,
}

const DEFAULT_LONG_TERM_RATE: VisaRateData = {
  id: "",
  tier: "long_term",
  label: "Extended Stay Umrah / Tourist Visa (90 Days)",
  maxDays: 90,
  pricePkr: 56000,
  priceSar: 470,
  withoutMasarPriceSar: 470,
  withMasar10DaysSar: 500,
  withMasar15DaysSar: 515,
  withMasar21DaysSar: 530,
  withMasar28DaysSar: 545,
  notes:
    "Extended stay allowance over 30 days up to maximum configured stay threshold.",
  updatedAt: null,
}

function hydrateVisaTiers(incoming: VisaRateData[]): VisaRateData[] {
  const existingShort = incoming.find((r) => r.tier === "short_term")
  const existingLong = incoming.find((r) => r.tier === "long_term")
  return [
    existingShort ?? { ...DEFAULT_SHORT_TERM_RATE },
    existingLong ?? { ...DEFAULT_LONG_TERM_RATE },
  ]
}

export function VisaClient({
  initialRates,
  initialSarToPkrRate = 75,
}: VisaClientProps) {
  const router = useRouter()
  const [rates, setRates] = useState<VisaRateData[]>(() =>
    hydrateVisaTiers(initialRates)
  )
  const [prevInitialRates, setPrevInitialRates] = useState(initialRates)
  if (prevInitialRates !== initialRates) {
    setPrevInitialRates(initialRates)
    setRates(hydrateVisaTiers(initialRates))
  }

  const [savingTier, setSavingTier] = useState<
    "short_term" | "long_term" | null
  >(null)
  const [savedSuccessTier, setSavedSuccessTier] = useState<
    "short_term" | "long_term" | null
  >(null)
  const [errorTier, setErrorTier] = useState<{
    tier: "short_term" | "long_term"
    message: string
  } | null>(null)

  const [sarToPkrRate, setSarToPkrRate] = useState<number>(initialSarToPkrRate)
  const [prevInitialSarToPkrRate, setPrevInitialSarToPkrRate] =
    useState(initialSarToPkrRate)
  if (prevInitialSarToPkrRate !== initialSarToPkrRate) {
    setPrevInitialSarToPkrRate(initialSarToPkrRate)
    setSarToPkrRate(initialSarToPkrRate)
  }

  const [savingForex, setSavingForex] = useState(false)
  const [forexSaved, setForexSaved] = useState(false)
  const [forexError, setForexError] = useState<string | null>(null)

  const shortTerm =
    rates.find((r) => r.tier === "short_term") ?? DEFAULT_SHORT_TERM_RATE
  const longTerm =
    rates.find((r) => r.tier === "long_term") ?? DEFAULT_LONG_TERM_RATE

  async function handleSave(rate: VisaRateData) {
    setSavingTier(rate.tier)
    setErrorTier(null)
    setSavedSuccessTier(null)

    try {
      const res = await updateVisaRate({
        id: rate.id || undefined,
        tier: rate.tier,
        maxDays: rate.maxDays,
        pricePkr: rate.pricePkr,
        priceSar: rate.priceSar ?? 470,
        withoutMasarPriceSar: rate.withoutMasarPriceSar ?? 470,
        withMasar10DaysSar: rate.withMasar10DaysSar ?? 500,
        withMasar15DaysSar: rate.withMasar15DaysSar ?? 515,
        withMasar21DaysSar: rate.withMasar21DaysSar ?? 530,
        withMasar28DaysSar: rate.withMasar28DaysSar ?? 545,
        label: rate.label,
        notes: rate.notes || undefined,
      })

      if (!res.success) {
        setErrorTier({
          tier: rate.tier,
          message: res.error || "Failed to update visa price.",
        })
        return
      }

      if (res.data) {
        const persisted = res.data
        setRates((prev) =>
          prev.map((r) =>
            r.tier === rate.tier
              ? {
                  ...r,
                  id: persisted.id,
                  maxDays: persisted.maxDays,
                  label: persisted.label,
                  pricePkr: persisted.pricePkr,
                  updatedAt: persisted.updatedAt,
                }
              : r
          )
        )
      }

      setSavedSuccessTier(rate.tier)
      router.refresh()
      setTimeout(() => setSavedSuccessTier(null), 3000)
    } catch (err: unknown) {
      setErrorTier({
        tier: rate.tier,
        message:
          err instanceof Error ? err.message : "Failed to update visa price.",
      })
    } finally {
      setSavingTier(null)
    }
  }

  async function handleSaveForex(e: React.FormEvent) {
    e.preventDefault()
    setSavingForex(true)
    setForexError(null)
    setForexSaved(false)

    try {
      const res = await updateSarToPkrRate({ sarToPkrRate })
      if (!res.success) {
        setForexError(res.error || "Failed to update SAR to PKR exchange rate.")
        return
      }
      setForexSaved(true)
      router.refresh()
      setTimeout(() => setForexSaved(false), 3000)
    } catch (err: unknown) {
      setForexError(
        err instanceof Error
          ? err.message
          : "Failed to update SAR to PKR exchange rate."
      )
    } finally {
      setSavingForex(false)
    }
  }

  function updateField(
    tier: "short_term" | "long_term",
    field: keyof VisaRateData,
    val: unknown
  ) {
    setRates((prev) =>
      prev.map((r) => (r.tier === tier ? { ...r, [field]: val } : r))
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Visa Pricing, Forex &amp; Stay Thresholds
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure Saudi Ministry electronic Umrah visa fees, SAR-to-PKR master
          conversion rate, stay duration thresholds, and Masar platform costs.
        </p>
      </div>

      {/* Master SAR to PKR Exchange Rate Editor */}
      <form
        onSubmit={handleSaveForex}
        className="space-y-3 rounded-xl border border-gold-border bg-card p-5 shadow-xs"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold-border bg-accent/50 text-gold-text">
              <ArrowLeftRight className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Master SAR → PKR Conversion Rate
              </h3>
              <p className="text-xs text-muted-foreground">
                Used across Admin Quote Worksheets, SAR hotel/transport
                matrices, and Masar visa cost conversions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="sar-to-pkr-rate"
                className="text-xs font-semibold whitespace-nowrap"
              >
                1 SAR =
              </Label>
              <div className="relative w-36">
                <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">
                  PKR
                </span>
                <Input
                  id="sar-to-pkr-rate"
                  type="number"
                  step="0.01"
                  min={1}
                  max={10000}
                  value={sarToPkrRate}
                  onChange={(e) => setSarToPkrRate(Number(e.target.value))}
                  className="h-9 pl-11 font-mono text-sm font-bold tabular-nums"
                  required
                />
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-border bg-muted/30 text-[11px] tabular-nums"
            >
              470 SAR ≈ PKR{" "}
              {Math.round(470 * (sarToPkrRate || 0)).toLocaleString()}
            </Badge>
            <Button
              type="submit"
              size="sm"
              disabled={savingForex}
              className="cursor-pointer gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {savingForex ? (
                <Loader2
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : forexSaved ? (
                <CheckCircle2
                  className="size-3.5 text-gold"
                  aria-hidden="true"
                />
              ) : (
                <Save className="size-3.5" aria-hidden="true" />
              )}
              <span>{forexSaved ? "Forex Saved" : "Save SAR Rate"}</span>
            </Button>
          </div>
        </div>

        {forexError && (
          <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
            {forexError}
          </div>
        )}
      </form>

      {/* Domain Rule Explanatory Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-status-warning-border bg-status-warning-bg p-4 text-xs text-status-warning sm:text-sm">
        <Info
          className="mt-0.5 size-5 shrink-0 text-status-warning"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p className="font-semibold text-status-warning">
            Automated Tier Rule &amp; Quoting Guarantee
          </p>
          <p className="text-xs leading-relaxed text-status-warning">
            The public Custom Journey Builder <strong>never</strong> displays a
            manual visa-tier dropdown to customers. The server automatically
            compares <strong>KSA Arrival Date</strong> and{" "}
            <strong>KSA Departure Date</strong>: durations up to{" "}
            <strong>{shortTerm.maxDays} days</strong> automatically apply the
            Short-Term rate; stays over {shortTerm.maxDays} days (up to{" "}
            <strong>{longTerm.maxDays} days</strong>) apply the Long-Term rate.
            Only <strong>Visa Only</strong> mode displays an immediate
            guaranteed PKR checkout total; in multi-service journeys, this rate
            is pre-filled in the Admin Quote Worksheet.
          </p>
        </div>
      </div>

      {/* Cards Grid: Short-Term vs Long-Term */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Short Term Visa Card */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg border border-status-success-border bg-status-success-bg text-status-success">
                  <FileCheck className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Short-Term Tourist/Umrah Visa
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    KSA Stay: 1 to {shortTerm.maxDays} Days
                  </span>
                </div>
              </div>
              <Badge className="border-status-success-border bg-status-success-bg text-xs font-semibold text-status-success tabular-nums">
                &le; {shortTerm.maxDays} Days
              </Badge>
            </div>

            {!shortTerm.id && (
              <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-2.5 text-xs text-status-warning">
                Not yet initialized in database: click{" "}
                <strong>Initialize Short-Term Rate</strong> below to persist.
              </div>
            )}

            {errorTier?.tier === "short_term" && (
              <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
                {errorTier.message}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="st-label" className="text-xs">
                    Display Label
                  </Label>
                  <Input
                    id="st-label"
                    value={shortTerm.label}
                    onChange={(e) =>
                      updateField("short_term", "label", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-max-days" className="text-xs">
                    Max Stay (Days)
                  </Label>
                  <Input
                    id="st-max-days"
                    type="number"
                    min={1}
                    max={365}
                    value={shortTerm.maxDays}
                    onChange={(e) =>
                      updateField(
                        "short_term",
                        "maxDays",
                        Number(e.target.value)
                      )
                    }
                    className="font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="st-price" className="text-xs font-semibold">
                  Customer Guaranteed Rate (PKR)
                </Label>
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    PKR
                  </span>
                  <Input
                    id="st-price"
                    type="number"
                    min={0}
                    value={shortTerm.pricePkr}
                    onChange={(e) =>
                      updateField(
                        "short_term",
                        "pricePkr",
                        Number(e.target.value)
                      )
                    }
                    className="pl-12 font-mono text-base font-bold text-status-success tabular-nums"
                  />
                </div>
              </div>

              {/* Masar Ground & Base SAR Rates Matrix */}
              <div className="space-y-2.5 rounded-lg bg-secondary/55 p-3">
                <div className="flex items-center gap-1.5 border-b border-border/60 pb-1.5 text-xs font-semibold text-foreground">
                  <Coins
                    className="size-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>Masar Platform &amp; Ministry SAR Cost Breakdown</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="st-without-masar" className="text-[11px]">
                      Without Masar (SAR)
                    </Label>
                    <Input
                      id="st-without-masar"
                      type="number"
                      min={0}
                      value={shortTerm.withoutMasarPriceSar ?? 470}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        updateField("short_term", "withoutMasarPriceSar", v)
                        updateField("short_term", "priceSar", v)
                      }}
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="st-with-masar-10" className="text-[11px]">
                      With Masar 10-Days (SAR)
                    </Label>
                    <Input
                      id="st-with-masar-10"
                      type="number"
                      min={0}
                      value={shortTerm.withMasar10DaysSar ?? 500}
                      onChange={(e) =>
                        updateField(
                          "short_term",
                          "withMasar10DaysSar",
                          Number(e.target.value)
                        )
                      }
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="st-with-masar-15" className="text-[11px]">
                      With Masar 15-Days (SAR)
                    </Label>
                    <Input
                      id="st-with-masar-15"
                      type="number"
                      min={0}
                      value={shortTerm.withMasar15DaysSar ?? 515}
                      onChange={(e) =>
                        updateField(
                          "short_term",
                          "withMasar15DaysSar",
                          Number(e.target.value)
                        )
                      }
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="st-with-masar-21" className="text-[11px]">
                      With Masar 21-Days (SAR)
                    </Label>
                    <Input
                      id="st-with-masar-21"
                      type="number"
                      min={0}
                      value={shortTerm.withMasar21DaysSar ?? 530}
                      onChange={(e) =>
                        updateField(
                          "short_term",
                          "withMasar21DaysSar",
                          Number(e.target.value)
                        )
                      }
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="st-with-masar-28" className="text-[11px]">
                      With Masar 28-Days (SAR)
                    </Label>
                    <Input
                      id="st-with-masar-28"
                      type="number"
                      min={0}
                      value={shortTerm.withMasar28DaysSar ?? 545}
                      onChange={(e) =>
                        updateField(
                          "short_term",
                          "withMasar28DaysSar",
                          Number(e.target.value)
                        )
                      }
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="st-notes" className="text-xs">
                  Customer Disclaimers &amp; Inclusions
                </Label>
                <Textarea
                  id="st-notes"
                  rows={2}
                  value={shortTerm.notes ?? ""}
                  onChange={(e) =>
                    updateField("short_term", "notes", e.target.value)
                  }
                  placeholder="Includes mandatory Saudi medical insurance coverage"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className="text-[11px] text-muted-foreground">
              {shortTerm.updatedAt
                ? `Last updated: ${new Date(shortTerm.updatedAt).toLocaleDateString()}`
                : "Default template ready"}
            </span>
            <Button
              type="button"
              onClick={() => handleSave(shortTerm)}
              disabled={savingTier === "short_term"}
              className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {savingTier === "short_term" ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : savedSuccessTier === "short_term" ? (
                <CheckCircle2 className="size-4 text-gold" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              <span>
                {savedSuccessTier === "short_term"
                  ? "Rate Saved!"
                  : shortTerm.id
                    ? "Save Short-Term Rate"
                    : "Initialize Short-Term Rate"}
              </span>
            </Button>
          </div>
        </div>

        {/* Long Term Visa Card */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg border border-status-warning-border bg-status-warning-bg text-status-warning">
                  <FileCheck className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Long-Term Extended Visa
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    KSA Stay: {shortTerm.maxDays + 1} to {longTerm.maxDays} Days
                  </span>
                </div>
              </div>
              <Badge className="border-status-warning-border bg-status-warning-bg text-xs font-semibold text-status-warning tabular-nums">
                &gt; {shortTerm.maxDays} Days (Max {longTerm.maxDays}d)
              </Badge>
            </div>

            {!longTerm.id && (
              <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-2.5 text-xs text-status-warning">
                Not yet initialized in database: click{" "}
                <strong>Initialize Long-Term Rate</strong> below to persist.
              </div>
            )}

            {errorTier?.tier === "long_term" && (
              <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
                {errorTier.message}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="lt-label" className="text-xs">
                    Display Label
                  </Label>
                  <Input
                    id="lt-label"
                    value={longTerm.label}
                    onChange={(e) =>
                      updateField("long_term", "label", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lt-max-days" className="text-xs">
                    Max Stay (Days)
                  </Label>
                  <Input
                    id="lt-max-days"
                    type="number"
                    min={31}
                    max={365}
                    value={longTerm.maxDays}
                    onChange={(e) =>
                      updateField(
                        "long_term",
                        "maxDays",
                        Number(e.target.value)
                      )
                    }
                    className="font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lt-price" className="text-xs font-semibold">
                  Customer Guaranteed Rate (PKR)
                </Label>
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    PKR
                  </span>
                  <Input
                    id="lt-price"
                    type="number"
                    min={0}
                    value={longTerm.pricePkr}
                    onChange={(e) =>
                      updateField(
                        "long_term",
                        "pricePkr",
                        Number(e.target.value)
                      )
                    }
                    className="pl-12 font-mono text-base font-bold text-status-warning tabular-nums"
                  />
                </div>
              </div>

              {/* Masar Ground & Base SAR Rates Matrix */}
              <div className="space-y-2.5 rounded-lg bg-secondary/55 p-3">
                <div className="flex items-center gap-1.5 border-b border-border/60 pb-1.5 text-xs font-semibold text-foreground">
                  <Coins
                    className="size-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>Masar Platform &amp; Ministry SAR Cost Breakdown</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="lt-without-masar" className="text-[11px]">
                      Without Masar (SAR)
                    </Label>
                    <Input
                      id="lt-without-masar"
                      type="number"
                      min={0}
                      value={longTerm.withoutMasarPriceSar ?? 470}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        updateField("long_term", "withoutMasarPriceSar", v)
                        updateField("long_term", "priceSar", v)
                      }}
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lt-with-masar-10" className="text-[11px]">
                      With Masar 10-Days (SAR)
                    </Label>
                    <Input
                      id="lt-with-masar-10"
                      type="number"
                      min={0}
                      value={longTerm.withMasar10DaysSar ?? 500}
                      onChange={(e) =>
                        updateField(
                          "long_term",
                          "withMasar10DaysSar",
                          Number(e.target.value)
                        )
                      }
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lt-with-masar-15" className="text-[11px]">
                      With Masar 15-Days (SAR)
                    </Label>
                    <Input
                      id="lt-with-masar-15"
                      type="number"
                      min={0}
                      value={longTerm.withMasar15DaysSar ?? 515}
                      onChange={(e) =>
                        updateField(
                          "long_term",
                          "withMasar15DaysSar",
                          Number(e.target.value)
                        )
                      }
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lt-with-masar-21" className="text-[11px]">
                      With Masar 21-Days (SAR)
                    </Label>
                    <Input
                      id="lt-with-masar-21"
                      type="number"
                      min={0}
                      value={longTerm.withMasar21DaysSar ?? 530}
                      onChange={(e) =>
                        updateField(
                          "long_term",
                          "withMasar21DaysSar",
                          Number(e.target.value)
                        )
                      }
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="lt-with-masar-28" className="text-[11px]">
                      With Masar 28-Days (SAR)
                    </Label>
                    <Input
                      id="lt-with-masar-28"
                      type="number"
                      min={0}
                      value={longTerm.withMasar28DaysSar ?? 545}
                      onChange={(e) =>
                        updateField(
                          "long_term",
                          "withMasar28DaysSar",
                          Number(e.target.value)
                        )
                      }
                      className="h-8 font-mono text-xs tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lt-notes" className="text-xs">
                  Customer Disclaimers &amp; Inclusions
                </Label>
                <Textarea
                  id="lt-notes"
                  rows={2}
                  value={longTerm.notes ?? ""}
                  onChange={(e) =>
                    updateField("long_term", "notes", e.target.value)
                  }
                  placeholder="Multiple-entry extended 1-year tourist e-visa with 90-day stay allowance"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className="text-[11px] text-muted-foreground">
              {longTerm.updatedAt
                ? `Last updated: ${new Date(longTerm.updatedAt).toLocaleDateString()}`
                : "Default template ready"}
            </span>
            <Button
              type="button"
              onClick={() => handleSave(longTerm)}
              disabled={savingTier === "long_term"}
              className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {savingTier === "long_term" ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : savedSuccessTier === "long_term" ? (
                <CheckCircle2 className="size-4 text-gold" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              <span>
                {savedSuccessTier === "long_term"
                  ? "Rate Saved!"
                  : longTerm.id
                    ? "Save Long-Term Rate"
                    : "Initialize Long-Term Rate"}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
