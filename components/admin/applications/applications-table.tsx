import * as React from "react"
import Link from "next/link"
import {
  Plane,
  Building2,
  Car,
  Compass,
  FileCheck,
  Calendar,
  Users,
  MessageSquare,
  ArrowUpRight,
  MapPin,
  Clock,
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge, TabularPrice } from "@/components/layout/status-badge"
import { formatWhatsAppPhone } from "@/lib/phone"

export interface ApplicationRowItem {
  id: string
  referenceNumber: string
  source: "custom_builder" | "group_booking" | "hajj_inquiry"
  status:
    | "pending_quote"
    | "quoted"
    | "revision_requested"
    | "approved"
    | "rejected"
    | "cancelled"
  presetMode: string
  customerName: string
  customerPhone: string
  customerWhatsapp: string
  customerCity: string
  adults: number
  children: number
  infants: number
  totalPassportCount: number
  bedAndSeatCount: number
  includeVisa: boolean
  includeFlights: boolean
  includeHotels: boolean
  includeTransport: boolean
  includeZiyarat: boolean
  ksaArrivalDate: string | null
  ksaDepartureDate: string | null
  totalKsaDays: number | null
  calculatedVisaTotalPkr: number | null
  createdAt: Date
  quotes?: {
    id: string
    grandTotalPkr: number
    paymentStatus: string
    quotedAt: Date | null
  }[]
  departureCity?: {
    cityName: string
    airportCode: string
  } | null
  groupPackage?: {
    title: string
  } | null
}

export function ApplicationsTable({
  applications,
}: {
  applications: ApplicationRowItem[]
}) {
  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Clock className="size-6" />
        </div>
        <h3 className="mt-4 font-display text-base font-bold text-foreground">
          No Applications Found
        </h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          No pilgrim inquiries match your active search or filter criteria. Try adjusting your filters.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div
        tabIndex={0}
        aria-label="Applications table"
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Table>
          <TableHeader className="bg-secondary/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[140px] text-xs font-semibold text-foreground">
                Reference
              </TableHead>
              <TableHead className="min-w-[190px] text-xs font-semibold text-foreground">
                Pilgrim Contact
              </TableHead>
              <TableHead className="min-w-[160px] text-xs font-semibold text-foreground">
                Source & Mode
              </TableHead>
              <TableHead className="min-w-[180px] text-xs font-semibold text-foreground">
                Dates & Pilgrims
              </TableHead>
              <TableHead className="min-w-[130px] text-xs font-semibold text-foreground">
                Pillars
              </TableHead>
              <TableHead className="min-w-[170px] text-xs font-semibold text-foreground">
                Status
              </TableHead>
              <TableHead className="min-w-[130px] text-right text-xs font-semibold text-foreground">
                Grand Total
              </TableHead>
              <TableHead className="w-[120px] text-right text-xs font-semibold text-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => {
              const latestQuote = app.quotes?.[0]
              const hasActiveQuote =
                latestQuote && latestQuote.grandTotalPkr > 0

              // Format clean dates
              const arrivalStr = app.ksaArrivalDate
                ? new Date(app.ksaArrivalDate).toLocaleDateString("en-PK", {
                    month: "short",
                    day: "numeric",
                  })
                : null
              const departureStr = app.ksaDepartureDate
                ? new Date(app.ksaDepartureDate).toLocaleDateString("en-PK", {
                    month: "short",
                    day: "numeric",
                  })
                : null

              // Sanitize WhatsApp link
              const cleanWaPhone = formatWhatsAppPhone(app.customerWhatsapp || app.customerPhone)
              const waLink = `https://wa.me/${cleanWaPhone}`

              return (
                <TableRow
                  key={app.id}
                  className="transition-colors hover:bg-muted/40"
                >
                  {/* Reference Number */}
                  <TableCell className="font-mono text-xs font-bold text-primary">
                    <Link
                      href={`/admin/applications/${app.id}`}
                      className="inline-flex items-center gap-1 rounded hover:text-primary/80 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {app.referenceNumber}
                    </Link>
                    <div className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                      {new Date(app.createdAt).toLocaleDateString("en-PK", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </TableCell>

                  {/* Pilgrim Contact */}
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {app.customerName}
                      </span>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3 text-muted-foreground" aria-hidden="true" />
                          {app.customerCity}
                        </span>
                        <span>•</span>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded text-status-success hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          title="Open WhatsApp chat"
                        >
                          <MessageSquare className="size-3" aria-hidden="true" />
                          <span className="font-mono text-[11px] tabular-nums">
                            {app.customerPhone}
                          </span>
                        </a>
                      </div>
                    </div>
                  </TableCell>

                  {/* Source & Mode */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {app.source === "custom_builder" ? (
                        <Badge
                          variant="outline"
                          className="w-fit border-primary/20 bg-primary/5 text-[11px] font-medium text-primary"
                        >
                          Custom Builder
                        </Badge>
                      ) : app.source === "group_booking" ? (
                        <Badge
                          variant="outline"
                          className="w-fit border-gold-border/60 bg-accent text-[11px] font-medium text-gold-foreground"
                        >
                          Group Package
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="w-fit border-border bg-secondary text-[11px] font-medium text-foreground"
                        >
                          Hajj Inquiry
                        </Badge>
                      )}
                      <span className="max-w-[140px] truncate text-[11px] text-muted-foreground">
                        {app.groupPackage?.title ||
                          app.presetMode.replace(/_/g, " ")}
                      </span>
                    </div>
                  </TableCell>

                  {/* Dates & Pilgrims */}
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs">
                      {arrivalStr && departureStr ? (
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          <Calendar className="size-3 text-muted-foreground" aria-hidden="true" />
                          <span>
                            {arrivalStr} to {departureStr}
                          </span>
                          {app.totalKsaDays && (
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              ({app.totalKsaDays}d)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Flexible Dates
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3" aria-hidden="true" />
                        <span>
                          {app.totalPassportCount} Pax ({app.bedAndSeatCount} Beds
                          {app.infants > 0 ? `, ${app.infants} Inf` : ""})
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Active Pillars */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span
                        title={app.includeVisa ? "Visa Included" : "No Visa"}
                        className={`rounded-md p-1 ${app.includeVisa ? "bg-primary/10 text-primary" : "text-muted-foreground/30"}`}
                      >
                        <FileCheck className="size-3.5" aria-hidden="true" />
                      </span>
                      <span
                        title={
                          app.includeFlights
                            ? "Flights Included"
                            : "No Flights"
                        }
                        className={`rounded-md p-1 ${app.includeFlights ? "bg-status-info-bg text-status-info" : "text-muted-foreground/30"}`}
                      >
                        <Plane className="size-3.5" aria-hidden="true" />
                      </span>
                      <span
                        title={
                          app.includeHotels ? "Hotels Included" : "No Hotels"
                        }
                        className={`rounded-md p-1 ${app.includeHotels ? "bg-status-warning-bg text-status-warning" : "text-muted-foreground/30"}`}
                      >
                        <Building2 className="size-3.5" aria-hidden="true" />
                      </span>
                      <span
                        title={
                          app.includeTransport
                            ? "Transport Included"
                            : "No Transport"
                        }
                        className={`rounded-md p-1 ${app.includeTransport ? "bg-status-success-bg text-status-success" : "text-muted-foreground/30"}`}
                      >
                        <Car className="size-3.5" aria-hidden="true" />
                      </span>
                      <span
                        title={
                          app.includeZiyarat
                            ? "Ziyarat Included"
                            : "No Ziyarat"
                        }
                        className={`rounded-md p-1 ${app.includeZiyarat ? "bg-accent text-gold-text" : "text-muted-foreground/30"}`}
                      >
                        <Compass className="size-3.5" aria-hidden="true" />
                      </span>
                    </div>
                  </TableCell>

                  {/* Status Badge + SLA Warning */}
                  <TableCell>
                    <StatusBadge
                      status={app.status}
                      createdAt={app.createdAt}
                      showSlaWarning={true}
                    />
                  </TableCell>

                  {/* Grand Total */}
                  <TableCell className="text-right">
                    {hasActiveQuote ? (
                      <div className="flex flex-col items-end">
                        <TabularPrice
                          amount={latestQuote.grandTotalPkr}
                          className="text-sm font-bold text-foreground"
                        />
                        {latestQuote.paymentStatus === "paid_in_full" && (
                          <span className="text-[11px] font-semibold text-status-success">
                            Paid Full
                          </span>
                        )}
                        {latestQuote.paymentStatus === "deposit_paid" && (
                          <span className="text-[11px] font-semibold text-status-info">
                            Deposit Verified
                          </span>
                        )}
                        {latestQuote.paymentStatus === "partially_paid" && (
                          <span className="text-[11px] font-semibold text-status-warning">
                            Partial Deposit
                          </span>
                        )}
                      </div>
                    ) : app.calculatedVisaTotalPkr && app.includeVisa ? (
                      <div className="flex flex-col items-end">
                        <TabularPrice
                          amount={app.calculatedVisaTotalPkr}
                          className="font-mono text-xs text-muted-foreground"
                        />
                        <span className="text-[11px] text-muted-foreground/80 italic">
                          Visa Calc
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Pending
                      </span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-xs font-medium hover:border-gold hover:bg-accent/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      render={
                        <Link href={`/admin/applications/${app.id}`} />
                      }
                      nativeButton={false}
                    >
                      <span>Worksheet</span>
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
