"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Home, MessageCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("[RootErrorBoundary] Unhandled segment error:", error.digest ?? error.name)
  }, [error])

  return (
    <main
      id="main-content"
      className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-16 text-foreground"
    >
      <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-gold/40 bg-primary/5 text-primary">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-widest text-gold-text uppercase">
            Al Ramlah Travels · Service Interruption
          </p>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            We encountered a temporary issue
          </h1>
          <p className="text-sm text-muted-foreground">
            Your pilgrimage itinerary and booking records remain safe. Please
            retry the page or reach our Lahore Cantt desk directly on WhatsApp.
          </p>
        </div>

        {error.digest && (
          <p className="rounded-md bg-muted px-3 py-1 font-mono text-xs text-muted-foreground tabular-nums">
            Reference ID: {error.digest}
          </p>
        )}

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            onClick={() => reset()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <RotateCcw className="size-4" />
            <span>Try Again</span>
          </Button>

          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <Home className="size-4" />
            <span>Return Home</span>
          </Button>

          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a
                href="https://wa.me/923274029701"
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <MessageCircle className="size-4" />
            <span>WhatsApp Desk</span>
          </Button>
        </div>
      </div>
    </main>
  )
}
