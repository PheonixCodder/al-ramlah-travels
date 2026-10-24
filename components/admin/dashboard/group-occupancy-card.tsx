import * as React from "react"
import Link from "next/link"
import { Boxes, Calendar, ArrowRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
              <Boxes className="size-4 text-primary" />
              <span>Group Departures Seat Allotment</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Live capacity monitoring for fixed Umrah departure batches
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-semibold hover:border-gold"
            render={<Link href="/admin/groups" />}
            nativeButton={false}
          >
            <span>All Batches</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {departures.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-4">
            No active group departure batches found.
          </p>
        ) : (
          departures.map((batch) => {
            const percentFilled = Math.min(
              100,
              Math.round((batch.bookedSeats / batch.totalSeats) * 100)
            )

            return (
              <div
                key={batch.id}
                className="rounded-lg border border-border bg-secondary/20 p-3 text-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {batch.package.title}
                      </span>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] border-border bg-card"
                      >
                        {batch.batchCode}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <Calendar className="size-3" />
                      <span>
                        {batch.departureDate} → {batch.returnDate} (
                        {batch.package.durationDays}d)
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold uppercase ${
                      batch.status === "sold_out"
                        ? "border-red-300 bg-red-100 text-red-800"
                        : batch.status === "filling_fast"
                        ? "border-amber-300 bg-amber-100 text-amber-800"
                        : "border-emerald-300 bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {batch.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Seat Progress Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">
                      Booked: {batch.bookedSeats} / {batch.totalSeats} Seats
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {percentFilled}% Filled
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full transition-all rounded-full ${
                        percentFilled >= 100
                          ? "bg-red-600"
                          : percentFilled >= 75
                          ? "bg-amber-500"
                          : "bg-emerald-600"
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
