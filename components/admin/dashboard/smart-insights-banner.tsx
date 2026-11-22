import * as React from "react"
import Link from "next/link"
import {
  Sparkles,
  AlertTriangle,
  Building2,
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
    <div className="rounded-xl border border-gold-border/60 bg-linear-to-r from-background via-secondary/50 to-accent/35 p-4 shadow-xs">
      <div className="mb-3 flex items-center gap-2 border-b border-border/80 pb-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-accent text-gold-text">
          <Sparkles className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold text-foreground">
            Executive Smart Insights &amp; Operational Alerts
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
            className={`flex flex-col justify-between rounded-lg p-3 text-xs ${
              item.type === "warning"
                ? "bg-status-danger-bg text-status-danger"
                : item.type === "opportunity"
                  ? "bg-status-success-bg text-status-success"
                  : "bg-secondary/80 text-foreground"
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5 font-semibold">
                {item.type === "warning" ? (
                  <AlertTriangle className="size-3.5 shrink-0 text-status-danger" aria-hidden="true" />
                ) : item.type === "opportunity" ? (
                  <TrendingUp className="size-3.5 shrink-0 text-status-success" aria-hidden="true" />
                ) : (
                  <Building2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                )}
                <span>{item.title}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>

            {item.actionLabel && item.actionHref && (
              <div className="mt-2.5 border-t border-border/50 pt-2">
                <Link
                  href={item.actionHref}
                  className="inline-flex items-center gap-1 rounded font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
