"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, LayoutDashboard, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AdminDashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error(
      "[AdminDashboardErrorBoundary] Unhandled admin workspace error:",
      error.digest ?? error.name
    )
  }, [error])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-[65vh] w-full items-center justify-center px-4 py-12 text-foreground"
    >
      <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center shadow-md">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-gold/40 bg-primary/5 text-primary">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-widest text-gold-text uppercase">
            Al Ramlah Travels · Executive Portal
          </p>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Unable to load this operational view
          </h1>
          <p className="text-sm text-muted-foreground">
            Pilgrim applications, quotations, and CRM records remain intact.
            Retry this view or return to the Executive Overview dashboard.
          </p>
        </div>

        {error.digest && (
          <p className="rounded-md bg-muted px-3 py-1 font-mono text-xs text-muted-foreground tabular-nums">
            Diagnostic Ref: {error.digest}
          </p>
        )}

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            onClick={() => reset()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <RotateCcw className="size-4" />
            <span>Retry View</span>
          </Button>

          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin" />}
          >
            <LayoutDashboard className="size-4" />
            <span>Back to Overview</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
