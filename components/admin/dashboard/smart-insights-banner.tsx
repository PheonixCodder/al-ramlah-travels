import * as React from "react"
import Link from "next/link"
import {
  Sparkles,
  AlertTriangle,
  Building2,
  Plane,
  Users,
  ArrowRight,
  TrendingUp,
} from "lucide-react"

export interface SmartInsightItem {
  type: "warning" | "opportunity" | "info"
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export function SmartInsightsBanner({
  insights,
}: {
  insights: SmartInsightItem[]
}) {
  if (insights.length === 0) return null

  return (
    <div className="rounded-xl border border-gold/40 bg-linear-to-r from-card via-[#FAF7F0] to-gold/10 p-4 shadow-xs">
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border/80">
        <div className="flex size-7 items-center justify-center rounded-lg bg-gold/20 text-gold-foreground">
          <Sparkles className="size-4 text-gold" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold text-foreground">
            Executive Smart Insights & Operational Alerts
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Real-time intelligence automatically synthesized from pilgrim inquiries and inventory allocations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((item, idx) => (
          <div
            key={idx}
            className={`flex flex-col justify-between rounded-lg border p-3 text-xs transition-all ${
              item.type === "warning"
                ? "border-red-200 bg-red-50/70 text-red-900"
                : item.type === "opportunity"
                ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                : "border-border bg-card text-foreground"
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5 font-semibold">
                {item.type === "warning" ? (
                  <AlertTriangle className="size-3.5 shrink-0 text-red-600" />
                ) : item.type === "opportunity" ? (
                  <TrendingUp className="size-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <Building2 className="size-3.5 shrink-0 text-primary" />
                )}
                <span>{item.title}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground/90 leading-relaxed">
                {item.description}
              </p>
            </div>

            {item.actionLabel && item.actionHref && (
              <div className="mt-2.5 pt-2 border-t border-border/40">
                <Link
                  href={item.actionHref}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
