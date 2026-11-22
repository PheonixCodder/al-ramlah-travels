import * as React from "react"
import Link from "next/link"
import { Boxes, Calendar, ArrowRight } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { computeSafeOccupancyPercent } from "./overview-metrics"

export interface GroupDepartureOccupancyItem {
  id: string
  batchCode: string
  departureDate: string
  returnDate: string
  totalSeats: number
  bookedSeats: number
  status: "open" | "filling_fast" | "sold_out" | "closed"
  package: {
    title: string
    tier: string
    durationDays: number
  }
}

export function GroupOccupancyCard({
  departures,
}: {
  departures: GroupDepartureOccupancyItem[]
}) {
  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Boxes className="size-4 text-primary" aria-hidden="true" />
              <span>Group Departures Seat Allotment</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Live capacity monitoring for upcoming active Umrah batches
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-semibold hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            render={<Link href="/admin/catalog?tab=groups" />}
            nativeButton={false}
          >
            <span>All Batches</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-4">
        {departures.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground italic">
            No upcoming active group departure batches found.
          </p>
        ) : (
          departures.map((batch) => {
            const safeTotalSeats = Math.max(0, Math.floor(batch.totalSeats || 0))
            const safeBookedSeats = Math.max(
              0,
              Math.floor(batch.bookedSeats || 0)
            )
            const percentFilled = computeSafeOccupancyPercent(
              safeBookedSeats,
              safeTotalSeats
            )

            return (
              <div
                key={batch.id}
                className="rounded-lg bg-secondary/60 p-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {batch.package.title}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-border bg-background font-mono text-[11px] tabular-nums"
                      >
                        {batch.batchCode}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                      <Calendar className="size-3" aria-hidden="true" />
                      <span>
                        {batch.departureDate} to {batch.returnDate} (
                        {batch.package.durationDays}d)
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[11px] font-semibold capitalize ${
                      batch.status === "sold_out" || batch.status === "closed"
                        ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                        : batch.status === "filling_fast"
                          ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                          : "border-status-success-border bg-status-success-bg text-status-success"
                    }`}
                  >
                    {batch.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Seat Progress Bar (`totalSeats === 0` guarded against NaN% / Infinity%) */}
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground tabular-nums">
                      Booked: {safeBookedSeats} / {safeTotalSeats} Seats
                    </span>
                    <span className="font-mono font-bold text-foreground tabular-nums">
                      {percentFilled}% Filled
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full ${
                        percentFilled >= 100
                          ? "bg-status-danger"
                          : percentFilled >= 75
                            ? "bg-status-warning"
                            : "bg-status-success"
                      }`}
                      style={{ width: `${percentFilled}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
