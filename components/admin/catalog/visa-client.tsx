"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { updateVisaRate } from "@/app/actions/catalog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  FileCheck,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Save,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react"

export interface VisaRateData {
  id: string
  tier: "short_term" | "long_term"
  label: string
  maxDays: number
  pricePkr: number
  notes?: string | null
  updatedAt: Date | string
}

interface VisaClientProps {
  initialRates: VisaRateData[]
}

export function VisaClient({ initialRates }: VisaClientProps) {
  const [rates, setRates] = useState<VisaRateData[]>(initialRates)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<{ id: string; message: string } | null>(
    null
  )

  const shortTerm = rates.find((r) => r.tier === "short_term")
  const longTerm = rates.find((r) => r.tier === "long_term")

  async function handleSave(rate: VisaRateData) {
    setSavingId(rate.id)
    setErrorId(null)
    setSavedSuccessId(null)

    try {
      await updateVisaRate({
        id: rate.id,
        pricePkr: rate.pricePkr,
        label: rate.label,
        notes: rate.notes || undefined,
      })
      setSavedSuccessId(rate.id)
      setTimeout(() => setSavedSuccessId(null), 3000)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorId({ id: rate.id, message: err.message })
      } else {
        setErrorId({ id: rate.id, message: "Failed to update visa price." })
      }
    } finally {
      setSavingId(null)
    }
  }

  function updateField(id: string, field: keyof VisaRateData, val: any) {
    setRates((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Visa Pricing & Regulations
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure Saudi Ministry of Hajj & Umrah electronic tourist/umrah visa fees per pilgrim passport.
        </p>
      </div>

      {/* Domain Rule Explanatory Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-950 sm:text-sm">
        <Info className="size-5 shrink-0 text-amber-700 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-900">
            Automated Tier Rule & Quoting Guarantee
          </p>
          <p className="text-amber-800 leading-relaxed text-xs">
            The public Custom Journey Builder <strong>never</strong> displays a manual visa-tier dropdown to customers.
            The server automatically compares <strong>KSA Arrival Date</strong> and <strong>KSA Departure Date</strong>:
            durations up to 30 days automatically apply the Short-Term rate; stays over 30 days (up to 90 days) apply the Long-Term rate.
            Furthermore, only <strong>Visa Only</strong> mode displays an immediate guaranteed PKR checkout total; in multi-service journeys, this rate is locked into the Admin Quote Worksheet.
          </p>
        </div>
      </div>

      {/* Cards Grid: Short-Term vs Long-Term */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Short Term Visa Card */}
        {shortTerm && (
          <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <FileCheck className="size-4" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">
                      Short-Term Tourist/Umrah Visa
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      KSA Stay: 1 to 30 Days
                    </span>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-xs">
                  $\le 30$ Days
                </Badge>
              </div>

              {errorId?.id === shortTerm.id && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
                  {errorId.message}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="st-label" className="text-xs">
                    Display Label
                  </Label>
                  <Input
                    id="st-label"
                    value={shortTerm.label}
                    onChange={(e) =>
                      updateField(shortTerm.id, "label", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="st-price" className="text-xs font-semibold">
                    Rate per Passport (PKR)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      PKR
                    </span>
                    <Input
                      id="st-price"
                      type="number"
                      min={0}
                      value={shortTerm.pricePkr}
                      onChange={(e) =>
                        updateField(
                          shortTerm.id,
                          "pricePkr",
                          Number(e.target.value)
                        )
                      }
                      className="pl-12 font-mono text-base font-bold text-emerald-800"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="st-notes" className="text-xs">
                    Customer Disclaimers & Inclusions
                  </Label>
                  <Textarea
                    id="st-notes"
                    rows={3}
                    value={shortTerm.notes ?? ""}
                    onChange={(e) =>
                      updateField(shortTerm.id, "notes", e.target.value)
                    }
                    placeholder="Includes mandatory Saudi COVID & medical insurance coverage..."
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 mt-6">
              <span className="text-[11px] text-muted-foreground">
                Last updated: {new Date(shortTerm.updatedAt).toLocaleDateString()}
              </span>
              <Button
                onClick={() => handleSave(shortTerm)}
                disabled={savingId === shortTerm.id}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {savingId === shortTerm.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : savedSuccessId === shortTerm.id ? (
                  <CheckCircle2 className="size-4 text-emerald-400" />
                ) : (
                  <Save className="size-4" />
                )}
                <span>
                  {savedSuccessId === shortTerm.id
                    ? "Rate Saved!"
                    : "Save Short-Term Rate"}
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Long Term Visa Card */}
        {longTerm && (
          <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                    <FileCheck className="size-4" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">
                      Long-Term Extended Visa
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      KSA Stay: 31 to 90 Days
                    </span>
                  </div>
                </div>
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs">
                  $&gt; 30$ Days
                </Badge>
              </div>

              {errorId?.id === longTerm.id && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
                  {errorId.message}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lt-label" className="text-xs">
                    Display Label
                  </Label>
                  <Input
                    id="lt-label"
                    value={longTerm.label}
                    onChange={(e) =>
                      updateField(longTerm.id, "label", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lt-price" className="text-xs font-semibold">
                    Rate per Passport (PKR)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      PKR
                    </span>
                    <Input
                      id="lt-price"
                      type="number"
                      min={0}
                      value={longTerm.pricePkr}
                      onChange={(e) =>
                        updateField(
                          longTerm.id,
                          "pricePkr",
                          Number(e.target.value)
                        )
                      }
                      className="pl-12 font-mono text-base font-bold text-amber-900"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lt-notes" className="text-xs">
                    Customer Disclaimers & Inclusions
                  </Label>
                  <Textarea
                    id="lt-notes"
                    rows={3}
                    value={longTerm.notes ?? ""}
                    onChange={(e) =>
                      updateField(longTerm.id, "notes", e.target.value)
                    }
                    placeholder="Multiple-entry extended 1-year tourist e-visa with 90-day stay allowance..."
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 mt-6">
              <span className="text-[11px] text-muted-foreground">
                Last updated: {new Date(longTerm.updatedAt).toLocaleDateString()}
              </span>
              <Button
                onClick={() => handleSave(longTerm)}
                disabled={savingId === longTerm.id}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {savingId === longTerm.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : savedSuccessId === longTerm.id ? (
                  <CheckCircle2 className="size-4 text-emerald-400" />
                ) : (
                  <Save className="size-4" />
                )}
                <span>
                  {savedSuccessId === longTerm.id
                    ? "Rate Saved!"
                    : "Save Long-Term Rate"}
                </span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
