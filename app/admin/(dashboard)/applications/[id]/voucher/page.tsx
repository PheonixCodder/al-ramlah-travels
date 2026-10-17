import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { eq, desc, asc, inArray } from "drizzle-orm"
import { Printer, ArrowLeft, ShieldCheck, CheckCircle2, Phone, Mail, MapPin } from "lucide-react"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { Button } from "@/components/ui/button"

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

  const application = await db.query.applications.findFirst({
    where: eq(schema.applications.id, id),
    with: {
      quotes: {
        orderBy: [desc(schema.applicationQuotes.version)],
      },
      hotelStays: {
        with: {
          hotel: true,
        },
        orderBy: [asc(schema.applicationHotelStays.stayOrder)],
      },
      transportSegments: {
        with: {
          sector: true,
          vehicle: true,
        },
        orderBy: [asc(schema.applicationTransportSegments.segmentOrder)],
      },
      departureCity: true,
      preferredAirline: true,
      ziyaratVehicle: true,
      groupPackage: true,
    },
  })

  if (!application) {
    notFound()
  }

  const latestQuote = application.quotes?.[0]
  const grandTotal = latestQuote?.grandTotalPkr || application.calculatedVisaTotalPkr || 0
  const amountPaid = latestQuote?.amountPaidPkr || 0
  const balanceDue = Math.max(0, grandTotal - amountPaid)

  const formatPkr = (val: number) =>
    new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(val)

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 sm:p-8 font-sans print:p-0 print:m-0">
      {/* Non-printed utility top navigation */}
      <div className="mb-6 flex items-center justify-between print:hidden max-w-4xl mx-auto">
        <Link
          href={`/admin/applications/${application.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Worksheet</span>
        </Link>

        <div className="flex items-center gap-2">
          <PrintTriggerButton />
        </div>
      </div>

      {/* Printable Official Voucher Document (A4 Container) */}
      <div className="mx-auto max-w-4xl border border-slate-200 bg-white p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Header / Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-[#0A3622] pb-6">
          <div className="flex items-center gap-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-[#C5A059] p-1">
              <Image
                src="/logo-icon.png"
                alt="Al Ramlah Travels Logo"
                width={64}
                height={64}
                className="size-full object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#0A3622]">
                AL RAMLAH TRAVELS
              </h1>
              <p className="font-arabic text-sm text-[#C5A059]">
                سفريات الرملة لخدمات الحج والعمرة
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                IATA Accredited Agency · Ministry of Hajj & Umrah License #4082
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block rounded border border-[#C5A059] bg-[#FAF7F0] px-3 py-1 font-mono text-xs font-bold text-[#0A3622]">
              CONFIRMATION VOUCHER
            </span>
            <div className="mt-2 font-mono text-xs text-slate-600">
              <span className="text-slate-400 block text-[10px]">Reference Number:</span>
              <span className="text-sm font-bold text-slate-900">{application.referenceNumber}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Issued: {new Date().toLocaleDateString("en-PK", { dateStyle: "long" })}
            </div>
          </div>
        </div>

        {/* Pilgrim & Journey Summary Grid */}
        <div className="mt-6 grid grid-cols-2 gap-6 bg-[#FAF7F0] p-4 rounded-lg border border-slate-200 text-xs">
          <div>
            <span className="font-semibold text-[#0A3622] block uppercase tracking-wider text-[10px] mb-1">
              Lead Pilgrim Manifest
            </span>
            <p className="font-bold text-sm text-slate-900">{application.customerName}</p>
            <p className="text-slate-600 font-mono mt-0.5">{application.customerPhone}</p>
            <p className="text-slate-600">{application.customerCity}, Pakistan</p>
            <div className="mt-2 font-semibold text-slate-800">
              {application.totalPassportCount} Total Pilgrims ({application.adults} Adults, {application.children} Children, {application.infants} Infants)
            </div>
          </div>

          <div>
            <span className="font-semibold text-[#0A3622] block uppercase tracking-wider text-[10px] mb-1">
              Journey Specifications
            </span>
            <p className="text-slate-700">
              <span className="font-semibold">KSA Travel Dates:</span>{" "}
              {application.ksaArrivalDate || "TBD"} → {application.ksaDepartureDate || "TBD"}{" "}
              ({application.totalKsaDays || "?"} Days)
            </p>
            <p className="text-slate-700 mt-0.5">
              <span className="font-semibold">Visa Tier:</span>{" "}
              {application.calculatedVisaTier === "long_term" ? "Long-Term (>30d)" : "Short-Term (≤30d)"}
            </p>
            <p className="text-slate-700 mt-0.5">
              <span className="font-semibold">Package Type:</span>{" "}
              {application.groupPackage?.title || application.presetMode.replace(/_/g, " ")}
            </p>
            <p className="text-slate-700 mt-0.5">
              <span className="font-semibold">Booking Status:</span>{" "}
              <span className="font-bold uppercase text-emerald-800">{application.status.replace(/_/g, " ")}</span>
            </p>
          </div>
        </div>

        {/* Hotel Stays Schedule */}
        {application.includeHotels && application.hotelStays.length > 0 && (
          <div className="mt-6">
            <h3 className="font-serif text-sm font-bold text-[#0A3622] border-b border-slate-200 pb-1 uppercase tracking-wider">
              Hotel Accommodations Schedule
            </h3>
            <table className="w-full text-left text-xs mt-2 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2 px-3">City</th>
                  <th className="py-2 px-3">Hotel Name</th>
                  <th className="py-2 px-3">Check-In</th>
                  <th className="py-2 px-3">Check-Out</th>
                  <th className="py-2 px-3">Nights</th>
                  <th className="py-2 px-3">Room Category</th>
                </tr>
              </thead>
              <tbody>
                {application.hotelStays.map((stay) => (
                  <tr key={stay.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-semibold uppercase">{stay.city}</td>
                    <td className="py-2 px-3">
                      <span className="font-semibold">{stay.hotel.name}</span>
                      <span className="text-[10px] text-slate-500 block">{stay.hotel.distanceLabel}</span>
                    </td>
                    <td className="py-2 px-3 font-mono">{stay.checkInDate}</td>
                    <td className="py-2 px-3 font-mono">{stay.checkOutDate}</td>
                    <td className="py-2 px-3 font-mono">{stay.nights}N</td>
                    <td className="py-2 px-3 capitalize">
                      {stay.roomCategory} · {stay.mealPlan.replace(/_/g, " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Transport Schedule */}
        {application.includeTransport && application.transportSegments.length > 0 && (
          <div className="mt-6">
            <h3 className="font-serif text-sm font-bold text-[#0A3622] border-b border-slate-200 pb-1 uppercase tracking-wider">
              Ground Transport & Transfer Schedule
            </h3>
            <table className="w-full text-left text-xs mt-2 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2 px-3">Leg</th>
                  <th className="py-2 px-3">Sector</th>
                  <th className="py-2 px-3">Vehicle Details</th>
                  <th className="py-2 px-3">Service Type</th>
                  <th className="py-2 px-3">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {application.transportSegments.map((seg, idx) => (
                  <tr key={seg.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-mono font-bold">#{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold">{seg.sector.label}</td>
                    <td className="py-2 px-3">
                      {seg.vehicleQuantity}x {seg.vehicle.name} ({seg.vehicle.seatCapacity} Seats)
                    </td>
                    <td className="py-2 px-3 capitalize">{seg.serviceType} VIP</td>
                    <td className="py-2 px-3 font-mono">
                      {seg.scheduledDate || "As per flight"} {seg.pickupTime ? `· ${seg.pickupTime}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Itemized Financial Summary & Payment Stamp */}
        <div className="mt-8 grid grid-cols-2 gap-8 items-start border-t-2 border-slate-200 pt-6">
          {/* Notes & Terms */}
          <div className="text-xs text-slate-600 space-y-2">
            <span className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] block">
              Terms & Important Instructions:
            </span>
            <p>1. Valid passport with minimum 6 months validity required prior to flight departure.</p>
            <p>2. Hotel standard check-in time is 16:00 and check-out is 12:00 noon as per Saudi Arabian tourism regulations.</p>
            <p>3. Zamzam water allowance is subject to Saudi airport aviation guidelines.</p>
            {latestQuote?.quoteNotesCustomer && (
              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
                <span className="font-bold block mb-0.5">Special Inclusions:</span>
                {latestQuote.quoteNotesCustomer}
              </div>
            )}
          </div>

          {/* Financial Breakdown Card */}
          <div className="rounded-lg border-2 border-[#0A3622] bg-[#FAF7F0] p-4 text-xs">
            <span className="font-serif font-bold text-[#0A3622] uppercase tracking-wider block border-b border-slate-200 pb-2">
              Financial Summary (PKR)
            </span>
            <div className="space-y-1.5 py-2 font-mono">
              {latestQuote?.visaTotalPkr ? (
                <div className="flex justify-between">
                  <span className="text-slate-600">Umrah Visa Fees:</span>
                  <span className="font-semibold">PKR {formatPkr(latestQuote.visaTotalPkr)}</span>
                </div>
              ) : null}
              {latestQuote?.flightsTotalPkr ? (
                <div className="flex justify-between">
                  <span className="text-slate-600">Airline Airfare:</span>
                  <span className="font-semibold">PKR {formatPkr(latestQuote.flightsTotalPkr)}</span>
                </div>
              ) : null}
              {latestQuote?.makkahHotelTotalPkr ? (
                <div className="flex justify-between">
                  <span className="text-slate-600">Makkah Hotel:</span>
                  <span className="font-semibold">PKR {formatPkr(latestQuote.makkahHotelTotalPkr)}</span>
                </div>
              ) : null}
              {latestQuote?.madinahHotelTotalPkr ? (
                <div className="flex justify-between">
                  <span className="text-slate-600">Madinah Hotel:</span>
                  <span className="font-semibold">PKR {formatPkr(latestQuote.madinahHotelTotalPkr)}</span>
                </div>
              ) : null}
              {latestQuote?.transportTotalPkr ? (
                <div className="flex justify-between">
                  <span className="text-slate-600">Ground Transfers:</span>
                  <span className="font-semibold">PKR {formatPkr(latestQuote.transportTotalPkr)}</span>
                </div>
              ) : null}
              {latestQuote?.ziyaratTotalPkr ? (
                <div className="flex justify-between">
                  <span className="text-slate-600">Sacred Ziyarat:</span>
                  <span className="font-semibold">PKR {formatPkr(latestQuote.ziyaratTotalPkr)}</span>
                </div>
              ) : null}
              {latestQuote?.discountPkr ? (
                <div className="flex justify-between text-amber-800">
                  <span>Courtesy Discount:</span>
                  <span>-PKR {formatPkr(latestQuote.discountPkr)}</span>
                </div>
              ) : null}
            </div>

            <div className="flex justify-between border-t-2 border-[#0A3622] pt-2 font-bold text-sm text-[#0A3622]">
              <span>GRAND TOTAL:</span>
              <span className="font-mono text-base">PKR {formatPkr(grandTotal)}</span>
            </div>

            <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] font-mono flex justify-between text-slate-700">
              <span>Amount Received:</span>
              <span>PKR {formatPkr(amountPaid)}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono font-bold text-slate-900">
              <span>Balance Due:</span>
              <span>PKR {formatPkr(balanceDue)}</span>
            </div>

            <div className="mt-3 text-center rounded bg-emerald-100/70 border border-emerald-300 py-1 text-[11px] font-semibold text-emerald-900 uppercase tracking-wide">
              Payment Status: {latestQuote?.paymentStatus.replace(/_/g, " ") || "Pending"}
            </div>
          </div>
        </div>

        {/* Agency Sign-off & Stamp Footer */}
        <div className="mt-12 flex items-end justify-between border-t border-slate-200 pt-6 text-xs text-slate-500">
          <div>
            <p className="font-semibold text-slate-800">Al Ramlah Travels Back Office Operations</p>
            <p>24/7 Pilgrim Support: +92 300 1234567 · info@alramlahtravels.com</p>
            <p>Suite 401, Al-Manara Executive Towers, Shahrah-e-Faisal, Karachi</p>
          </div>

          <div className="text-center">
            <div className="inline-block size-20 rounded-full border-2 border-dashed border-[#C5A059] p-2 text-center">
              <span className="text-[9px] font-bold text-[#0A3622] uppercase block mt-2">
                AL RAMLAH
              </span>
              <span className="text-[8px] text-[#C5A059] font-mono block">
                VERIFIED
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">Authorized Agency Seal</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PrintTriggerButton() {
  "use client"
  return (
    <Button
      onClick={() => window.print()}
      className="bg-[#0A3622] text-white hover:bg-[#0A3622]/90 text-xs font-semibold gap-1.5"
    >
      <Printer className="size-3.5" />
      <span>Print / Save as PDF</span>
    </Button>
  )
}
