import * as React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  MapPin,
  Phone,
  Plane,
  Building2,
  Car,
  Compass,
  ShieldCheck,
} from "lucide-react"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { getCompanyInfo } from "@/lib/company-info"
import { TabularPrice } from "@/components/layout/status-badge"
import { VoucherPrintButton } from "@/components/admin/applications/voucher-print-button"
import { evaluateAdminVoucherGate } from "@/components/admin/applications/voucher-gate"
import { buildQrSvgPath } from "@/components/public/voucher-loader"

export const metadata = {
  title: "Official Pilgrim Confirmation Voucher | Al Ramlah Travels",
}

const uuidParamSchema = z.string().uuid()

interface VoucherPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ApplicationVoucherPage({
  params,
}: VoucherPageProps) {
  await requireAdmin()
  const { id } = await params

  const parsedId = uuidParamSchema.safeParse(id)
  if (!parsedId.success) {
    notFound()
  }

  const [app, settingsRows, verifiedSumRows] = await Promise.all([
    db.query.applications.findFirst({
      where: eq(schema.applications.id, parsedId.data),
      with: {
        quotes: {
          orderBy: [desc(schema.applicationQuotes.version)],
          limit: 1,
        },
        hotelStays: {
          orderBy: [asc(schema.applicationHotelStays.stayOrder)],
          with: { hotel: true },
        },
        transportSegments: {
          orderBy: [asc(schema.applicationTransportSegments.segmentOrder)],
          with: { sector: true, vehicle: true },
        },
        departureCity: true,
        preferredAirline: true,
        groupPackage: {
          with: {
            makkahHotel: true,
            madinahHotel: true,
            airline: true,
          },
        },
        groupDeparture: true,
      },
    }),
    db.select().from(schema.agencySettings).limit(1),
    db
      .select({
        verifiedTotal: sql<number>`COALESCE(SUM(${schema.applicationPayments.amountPkr}), 0)::bigint`,
      })
      .from(schema.applicationPayments)
      .where(
        and(
          eq(schema.applicationPayments.applicationId, parsedId.data),
          sql`${schema.applicationPayments.verifiedAt} IS NOT NULL`
        )
      ),
  ])

  if (!app) {
    notFound()
  }

  const ziyaratPlaces =
    app.selectedZiyaratPlaceIds && app.selectedZiyaratPlaceIds.length > 0
      ? await db.query.ziyaratPlaces
          .findMany({
            where: inArray(
              schema.ziyaratPlaces.id,
              app.selectedZiyaratPlaceIds
            ),
          })
          .catch(() => [])
      : []

  const company = getCompanyInfo(settingsRows[0] ?? null)
  const latestQuote = app.quotes[0]
  const verifiedLedgerSum = Number(verifiedSumRows[0]?.verifiedTotal ?? 0)

  const gate = evaluateAdminVoucherGate({
    applicationStatus: app.status,
    quoteGrandTotalPkr: latestQuote?.grandTotalPkr ?? null,
    quoteDepositRequiredPkr: latestQuote?.depositRequiredPkr ?? null,
    quoteAmountPaidPkr: latestQuote?.amountPaidPkr ?? null,
    quotePaymentStatus: latestQuote?.paymentStatus ?? null,
    verifiedPaymentsSumPkr: verifiedLedgerSum > 0 ? verifiedLedgerSum : null,
  })

  // Strict Voucher Gating (`T-023`, `OD-04`): NEVER render confirmation/verified badges on unpaid or unapproved dossiers
  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-2xl py-10 px-4">
        <div className="mb-5">
          <Link
            href={`/admin/applications/${app.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Dossier &amp; Quote Worksheet</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-amber-400 bg-amber-100 text-amber-900">
              <Lock className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-amber-950">
                Voucher Issuance Locked
              </h1>
              <p className="text-xs text-amber-900/90 font-mono">
                Reference: {app.referenceNumber} • Current Status:{" "}
                {app.status.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          <p className="text-xs text-amber-950 leading-relaxed">
            {gate.message}
          </p>

          <p className="text-[11px] text-amber-900/80">
            Per Al Ramlah Travels governance (`OD-04`), official travel vouchers
            are unlocked strictly when the application status is{" "}
            <strong>Approved</strong> and verified deposit or full payment is
            recorded in the ledger.
          </p>

          <div>
            <Link
              href={`/admin/applications/${app.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A3622] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A3622]/90"
            >
              <ArrowLeft className="size-3.5" />
              <span>Return to Quote Worksheet</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const baseAppUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://alramlahtravels.com"
  ).replace(/\/+$/, "")
  const qrVerificationUrl = app.voucherToken
    ? `${baseAppUrl}/voucher/${encodeURIComponent(app.voucherToken)}`
    : `${baseAppUrl}/#track-status`
  const qrSpec = buildQrSvgPath(qrVerificationUrl)

  const licenses: string[] = []
  if (company.dtsLicense) licenses.push(`DTS: ${company.dtsLicense}`)
  if (company.moraLicense) licenses.push(`MORA: ${company.moraLicense}`)
  if (company.iataCode) licenses.push(`IATA: ${company.iataCode}`)
  if (company.ntnNumber) licenses.push(`NTN: ${company.ntnNumber}`)

  return (
    <div className="mx-auto max-w-4xl py-2 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } }`}</style>

      {/* Top Action Bar (Hidden in Print) */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/admin/applications/${app.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dossier &amp; Worksheet</span>
        </Link>

        <VoucherPrintButton />
      </div>

      {/* Printable A4 Luxury Voucher Card */}
      <div className="overflow-hidden rounded-2xl border-2 border-[#C5A059]/60 bg-white text-[#1A1D1A] shadow-xl print:rounded-none print:border print:shadow-none">
        {/* Header Ribbon */}
        <div className="border-b-4 border-[#C5A059] bg-[#0A3622] px-8 py-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-arabic text-2xl text-[#C5A059]">
                  سفريات الرملة
                </span>
                <span className="text-[#C5A059]">•</span>
                <span className="font-display text-2xl font-bold tracking-wide text-white uppercase">
                  {company.agencyName}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/80">{company.tagline}</p>
            </div>

            <div className="flex flex-col sm:items-end">
              <span className="text-[11px] font-semibold tracking-widest text-[#C5A059] uppercase">
                OFFICIAL PILGRIMAGE VOUCHER
              </span>
              <span className="mt-0.5 font-mono text-xl font-bold text-white">
                {app.referenceNumber}
              </span>
              <div
                className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  gate.paymentBanner === "PAID IN FULL"
                    ? "bg-emerald-500/25 text-emerald-200 border border-emerald-300/40"
                    : "bg-[#C5A059]/25 text-[#F6E3B4] border border-[#C5A059]/60"
                }`}
              >
                <CheckCircle2 className="size-3" />
                <span>{gate.paymentBanner}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="space-y-6 p-8">
          {/* 1. Pilgrim & Journey Summary */}
          <div className="grid grid-cols-1 gap-6 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-5 sm:grid-cols-3">
            <div>
              <span className="text-[11px] font-semibold tracking-wider text-[#686E65] uppercase block">
                Lead Pilgrim
              </span>
              <p
                className="mt-1 font-display text-base font-bold text-[#0A3622]"
                dir="auto"
              >
                {app.customerName}
              </p>
              <p className="text-xs text-[#686E65]" dir="auto">
                {app.customerCity} • {app.customerPhone}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold tracking-wider text-[#686E65] uppercase block">
                KSA Stay Dates
              </span>
              <p className="mt-1 text-sm font-bold text-[#1A1D1A]">
                {app.ksaArrivalDate && app.ksaDepartureDate
                  ? `${app.ksaArrivalDate} → ${app.ksaDepartureDate}`
                  : app.groupDeparture
                    ? `${app.groupDeparture.departureDate} → ${app.groupDeparture.returnDate}`
                    : "Confirmed per Flight Ticket"}
              </p>
              <p className="text-xs text-[#686E65]">
                {app.totalKsaDays ? `${app.totalKsaDays} Days` : "Confirmed"} •{" "}
                {app.calculatedVisaTier === "long_term"
                  ? "Long-Term Visa"
                  : "Short-Term Visa"}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold tracking-wider text-[#686E65] uppercase block">
                Passenger Manifest
              </span>
              <p className="mt-1 text-sm font-bold text-[#1A1D1A]">
                {app.totalPassportCount} Total Passports
              </p>
              <p className="text-xs text-[#686E65]">
                {app.adults} Adults, {app.children} Children, {app.infants}{" "}
                Infants ({app.bedAndSeatCount} Beds/Seats)
              </p>
            </div>
          </div>

          {/* 2. Flight Details */}
          {app.includeFlights && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-display text-sm font-bold tracking-wider text-[#0A3622] uppercase border-b border-[#E6DEC8] pb-1.5">
                <Plane className="size-4 text-[#C5A059]" />
                <span>Flight &amp; Airport Routing</span>
              </h3>
              <div className="grid grid-cols-2 gap-4 pt-1 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-[#686E65] block">Departure Origin</span>
                  <span className="font-semibold">
                    {app.departureCity
                      ? `${app.departureCity.cityName} (${app.departureCity.airportCode})`
                      : "Confirmed"}
                  </span>
                </div>
                <div>
                  <span className="text-[#686E65] block">Entry / Exit KSA</span>
                  <span className="font-semibold">
                    In: {app.entryAirport || "JED"} / Out:{" "}
                    {app.exitAirport || "JED"}
                  </span>
                </div>
                <div>
                  <span className="text-[#686E65] block">Route &amp; Cabin</span>
                  <span className="font-semibold capitalize">
                    {app.flightRouteType || "Direct"} •{" "}
                    {app.cabinClass || "Economy"}
                  </span>
                </div>
                <div>
                  <span className="text-[#686E65] block">Airline</span>
                  <span className="font-semibold">
                    {app.preferredAirline?.name ||
                      app.groupPackage?.airline?.name ||
                      "Confirmed Carrier"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3. Hotel Stays */}
          {app.includeHotels && app.hotelStays.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-display text-sm font-bold tracking-wider text-[#0A3622] uppercase border-b border-[#E6DEC8] pb-1.5">
                <Building2 className="size-4 text-[#C5A059]" />
                <span>Confirmed Hotel Accommodations</span>
              </h3>
              <div className="space-y-2.5 pt-1">
                {app.hotelStays.map((stay, idx) => (
                  <div
                    key={stay.id}
                    className="flex flex-col justify-between gap-2 rounded-lg border border-[#E6DEC8] p-3 text-xs sm:flex-row sm:items-center"
                  >
                    <div>
                      <span className="text-[10px] font-bold tracking-wider text-[#0A3622] uppercase">
                        Stay {idx + 1} • {stay.city}
                      </span>
                      <p
                        className="font-display text-sm font-bold text-[#1A1D1A]"
                        dir="auto"
                      >
                        {stay.hotel.name} ({stay.hotel.starRating}★)
                      </p>
                      <span className="text-[11px] text-[#686E65]">
                        {stay.hotel.distanceLabel}
                      </span>
                    </div>
                    <div className="sm:text-right">
                      <span className="font-mono font-semibold block">
                        {stay.checkInDate} → {stay.checkOutDate} ({stay.nights}{" "}
                        Nights)
                      </span>
                      <span className="text-[11px] text-[#686E65] capitalize">
                        {stay.roomCategory} Rooms •{" "}
                        {(stay.mealPlan || "room_only").replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Ground Transport */}
          {app.includeTransport && app.transportSegments.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-display text-sm font-bold tracking-wider text-[#0A3622] uppercase border-b border-[#E6DEC8] pb-1.5">
                <Car className="size-4 text-[#C5A059]" />
                <span>Ground Transfers</span>
              </h3>
              <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                {app.transportSegments.map((seg, i) => (
                  <div
                    key={seg.id}
                    className="rounded-lg border border-[#E6DEC8] p-2.5 text-xs"
                  >
                    <span className="font-semibold text-[#1A1D1A] block">
                      {i + 1}. {seg.sector.label}
                    </span>
                    <span className="text-[11px] text-[#686E65]">
                      {seg.vehicleQuantity}x {seg.vehicle.name} (
                      {seg.serviceType})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Ziyarat */}
          {app.includeZiyarat && ziyaratPlaces.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-display text-sm font-bold tracking-wider text-[#0A3622] uppercase border-b border-[#E6DEC8] pb-1.5">
                <Compass className="size-4 text-[#C5A059]" />
                <span>Sacred Ziyarat Sites</span>
              </h3>
              <div className="flex flex-wrap gap-2 pt-1">
                {ziyaratPlaces.map((place) => (
                  <span
                    key={place.id}
                    className="rounded-md border border-[#E6DEC8] bg-[#FAF7F0] px-2.5 py-1 text-xs font-medium"
                  >
                    {place.name} ({place.arabicName})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 6. Verified Financial Statement + QR Verification (`T-023`, `T-086`) */}
          <div className="grid grid-cols-1 gap-5 rounded-xl border-2 border-[#0A3622]/20 bg-[#FAF7F0] p-5 sm:grid-cols-12">
            <div className="space-y-2 sm:col-span-9">
              <div className="flex items-center justify-between border-b border-[#E6DEC8] pb-2">
                <span className="font-display text-sm font-bold tracking-wider text-[#0A3622] uppercase">
                  Verified Financial Summary (PKR)
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    gate.paymentBanner === "PAID IN FULL"
                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      : "bg-amber-100 text-amber-950 border border-amber-300"
                  }`}
                >
                  {gate.paymentBanner}
                </span>
              </div>

              <div className="space-y-1.5 text-xs pt-1">
                <div className="flex justify-between">
                  <span className="text-[#686E65]">Total Approved Package</span>
                  <TabularPrice
                    amount={gate.grandTotalPkr}
                    className="font-bold text-[#1A1D1A]"
                  />
                </div>
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Verified Ledger Receipts</span>
                  <TabularPrice amount={gate.verifiedAmountPaidPkr} />
                </div>
                <div className="flex justify-between border-t border-[#E6DEC8] pt-2 text-sm font-bold text-[#0A3622]">
                  <span>Remaining Balance Due</span>
                  <TabularPrice amount={gate.balanceDuePkr} />
                </div>
              </div>

              {latestQuote?.quoteNotesCustomer && (
                <p
                  className="mt-2 border-t border-[#E6DEC8] pt-2 text-xs text-[#686E65]"
                  dir="auto"
                >
                  <strong className="text-[#1A1D1A]">Inclusions &amp; Remarks:</strong>{" "}
                  {latestQuote.quoteNotesCustomer}
                </p>
              )}
            </div>

            {/* Scannable Verification QR */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#E6DEC8] bg-white p-3 sm:col-span-3">
              <svg
                viewBox={`0 0 ${qrSpec.viewBoxSize} ${qrSpec.viewBoxSize}`}
                className="size-24 text-[#0A3622]"
                role="img"
                aria-label={`Verification QR code for ${app.referenceNumber}`}
              >
                <rect
                  width={qrSpec.viewBoxSize}
                  height={qrSpec.viewBoxSize}
                  fill="#FFFFFF"
                />
                <path d={qrSpec.pathData} fill="#0A3622" />
              </svg>
              <span className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#0A3622]">
                <ShieldCheck className="size-3 text-[#C5A059]" />
                <span>Scan to Verify</span>
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#E6DEC8] bg-[#FAF7F0] px-8 py-4 text-xs text-[#686E65]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-[#0A3622] shrink-0" />
              <span>{company.officeAddress}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3 text-[#0A3622]" />
                {company.primaryWhatsapp}
                {company.secondaryPhone ? ` / ${company.secondaryPhone}` : ""}
              </span>
              <span>•</span>
              <span>{company.supportEmail}</span>
            </div>
          </div>
          {licenses.length > 0 && (
            <div className="mt-1.5 border-t border-[#E6DEC8]/70 pt-1.5 text-[10px] font-mono text-[#686E65]">
              {licenses.join(" • ")}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
