"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Database,
  Cloud,
  FileText,
  Mail,
  MessageCircle,
  Share2,
  Cpu,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getSystemConfigHealthAction } from "@/app/actions/catalog"
import type {
  ConfigHealthSnapshot,
  ConfigSubsystemHealth,
} from "@/components/admin/settings/config-health"
import { cn } from "@/lib/utils"

interface ConfigHealthPanelProps {
  initialSnapshot: ConfigHealthSnapshot
}

function getSubsystemIcon(id: ConfigSubsystemHealth["id"]) {
  switch (id) {
    case "database":
      return Database
    case "vault_and_auth":
      return ShieldCheck
    case "r2":
      return Cloud
    case "gotenberg":
      return FileText
    case "resend":
      return Mail
    case "waba":
      return MessageCircle
    case "social_oauth":
      return Share2
    case "trigger":
      return Cpu
    case "ai":
      return Sparkles
  }
}

export function ConfigHealthPanel({ initialSnapshot }: ConfigHealthPanelProps) {
  const [snapshot, setSnapshot] =
    useState<ConfigHealthSnapshot>(initialSnapshot)
  const [isRefreshing, startTransition] = useTransition()
  const [refreshError, setRefreshError] = useState<string | null>(null)

  function handleRefresh() {
    setRefreshError(null)
    startTransition(async () => {
      try {
        const res = await getSystemConfigHealthAction()
        if (res.success && res.data) {
          setSnapshot(res.data)
        }
      } catch (err: unknown) {
        setRefreshError(
          err instanceof Error
            ? err.message
            : "Could not refresh configuration health."
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary Header Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Activity className="size-5 text-emerald-700" />
            <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
              Cloud & Security Configuration Readiness
            </h2>
            <Badge
              className={cn(
                "text-xs font-semibold",
                snapshot.overallReady
                  ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                  : "bg-amber-100 text-amber-950 border-amber-300"
              )}
            >
              {snapshot.readyCount} / {snapshot.totalSubsystems} Subsystems Ready
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Zero-secret readiness audit across PostgreSQL, AES-256-GCM Token Vault, Cloudflare R2, Oracle Gotenberg, Resend, Meta WABA, Core 5 Social OAuth, Trigger.dev, and Multimodal AI. Secret values are never transmitted to the browser.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2 shrink-0 cursor-pointer"
        >
          <RefreshCw
            className={cn("size-4", isRefreshing && "animate-spin")}
          />
          <span>Re-Check Readiness</span>
        </Button>
      </div>

      {refreshError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {refreshError}
        </div>
      )}

      {/* 9-Subsystem Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.subsystems.map((sub) => {
          const Icon = getSubsystemIcon(sub.id)
          return (
            <Card
              key={sub.id}
              className={cn(
                "border shadow-xs transition-colors",
                sub.status === "ready"
                  ? "border-emerald-200/80 bg-card"
                  : sub.status === "partial"
                  ? "border-amber-200/90 bg-card"
                  : "border-rose-200/90 bg-card"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg border",
                        sub.status === "ready"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : sub.status === "partial"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-rose-200 bg-rose-50 text-rose-800"
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-foreground">
                        {sub.title}
                      </CardTitle>
                      <CardDescription className="text-[11px] leading-snug mt-0.5">
                        {sub.description}
                      </CardDescription>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] font-semibold uppercase tracking-wider",
                      sub.status === "ready"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                        : sub.status === "partial"
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-rose-300 bg-rose-50 text-rose-900"
                    )}
                  >
                    {sub.status === "ready"
                      ? "Ready"
                      : sub.status === "partial"
                      ? "Partial"
                      : "Missing"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-muted/20 px-3 py-1">
                  {sub.checks.map((chk) => (
                    <div
                      key={chk.key}
                      className="flex items-center justify-between gap-2 py-1.5 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-foreground block truncate">
                          {chk.label}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {chk.key}
                          {chk.requiredInProd ? " · required" : " · optional"}
                        </span>
                      </div>

                      {chk.configured ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700 shrink-0">
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                          <span>Set</span>
                        </span>
                      ) : chk.requiredInProd ? (
                        <span className="inline-flex items-center gap-1 font-medium text-rose-700 shrink-0">
                          <XCircle className="size-3.5 text-rose-600" />
                          <span>Unset</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-700 shrink-0">
                          <AlertTriangle className="size-3.5 text-amber-600" />
                          <span>Unset</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {sub.summaryNote}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
