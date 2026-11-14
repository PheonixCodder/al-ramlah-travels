import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Compass,
  Lock,
  MessageCircle,
  Plane,
  ShieldCheck,
  Users,
} from "lucide-react"
import { ArabicText } from "@/components/public/arabic-text"
import { toWaMeUrl } from "@/components/public/public-utils"
import { resolvePublicVoucherByToken } from "@/components/public/voucher-loader"
import { VoucherPrintButton } from "@/components/public/voucher-print-button"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Official Pilgrimage Confirmation Voucher | Al Ramlah Travels",
  description:
    "Cryptographically verified Haramain service confirmation voucher issued by Al Ramlah Travels.",
  robots: {
    index: false,
    follow: false,
  },
}

interface PublicVoucherPageProps {
  params: Promise<{ token: string }>
}

export default async function PublicVoucherPage({
  params,
}: PublicVoucherPageProps) {
  const { token } = await params
  const resolved = await resolvePublicVoucherByToken(token)

  if (!resolved.allowed) {
    if (resolved.httpStatus === 404) {
      notFound()
    }

    const waHref = toWaMeUrl(
      resolved.companyInfo.primaryWhatsapp,
      `Assalam-o-Alaikum Al Ramlah Travels, I am following up on deposit verification for my approved pilgrimage dossier ${resolved.referenceNumber}.`
    )

    return (
      <div
        data-voucher-status="403"
        className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="rounded-3xl border-2 border-[#C5A059]/50 bg-white p-8 text-center shadow-lg space-y-5">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#92400E] border border-[#C5A059]/40">
            <Lock className="size-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block rounded-full bg-[#FAF7F0] border border-[#C5A059]/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#8F6E2A]">
              403 · Voucher Security Gate
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0A3622]">
              {resolved.reason === "awaiting_deposit"
                ? "Official Voucher Unlocks Upon Deposit Verification"
                : "Confirmation Voucher Not Yet Active"}
            </h1>
            <p className="text-sm text-[#686E65] max-w-lg mx-auto leading-relaxed">
              {resolved.reason === "awaiting_deposit"
                ? `Dossier ${resolved.referenceNumber} has been accepted, and your reservation is queued with our Haramain desk. For pilgrim protection, official hotel, airline, and transport confirmation vouchers are issued strictly once deposit or full payment verification is recorded.`
                : `Dossier ${resolved.referenceNumber} has not yet reached final approved & deposit-verified status.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#0A3622] px-6 py-3 text-xs sm:text-sm font-bold text-white hover:bg-[#0F4C31] transition-colors"
            >
              <MessageCircle className="size-4 text-[#C5A059]" />
              <span>Share Payment Receipt on WhatsApp</span>
            </a>

            <Link
              href="/#track-status"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-5 py-3 text-xs sm:text-sm font-semibold text-[#0A3622] hover:bg-white transition-colors"
            >
              Return to Live Status Tracker
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { application: app, companyInfo, qrSpec } = resolved
  const isPaidFull = resolved.paymentStatus === "paid_in_full"

  return (
    <div
      data-voucher-status="200"
      className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 print:p-0"
    >
      {/* Top Action Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/#track-status"
          className="text-xs sm:text-sm font-semibold text-[#0A3622] hover:underline"
        >
          &larr; Return to Application Status Tracker
        </Link>
        <VoucherPrintButton />
      </div>

      {/* Main Luxury Haramain Confirmation Voucher */}
      <article className="overflow-hidden rounded-3xl border-2 border-[#C5A059]/60 bg-white shadow-xl print:rounded-none print:border print:shadow-none">
        {/* Sacred Bismillah Header */}
        <header className="bg-gradient-to-r from-[#062417] via-[#0A3622] to-[#062417] px-6 py-7 text-white sm:px-10 border-b-4 border-[#C5A059]">
          <div className="text-center pb-4 border-b border-white/15">
            <ArabicText className="text-xl sm:text-2xl text-[#C5A059]">
              بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </ArabicText>
          </div>

          <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C5A059]/20 border border-[#C5A059]/50 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#FAF7F0]">
                <ShieldCheck className="size-3.5 text-[#C5A059]" />
                Official Haramain Service Voucher
              </span>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {resolved.legalEntityName}
              </h1>
              <p className="text-xs text-white/80 max-w-md">
                {companyInfo.officeAddress}
              </p>
              <p className="text-xs text-[#C5A059] font-mono tabular-nums">
                Hotline: {companyInfo.hotlineDisplay} · {companyInfo.supportEmail}
              </p>
            </div>

            {/* Cryptographic QR Verification Card */}
            <div className="flex items-center gap-4 self-start md:self-auto rounded-2xl border border-[#C5A059]/50 bg-[#FAF7F0] p-3 text-[#0A3622] shadow-md">
              <svg
                viewBox={`0 0 ${qrSpec.viewBoxSize} ${qrSpec.viewBoxSize}`}
                width={88}
                height={88}
                role="img"
                aria-label={`Verification QR code for voucher ${app.referenceNumber}`}
                className="shrink-0 rounded-lg border border-[#E6DEC8] bg-[#FAF7F0]"
              >
                <rect
                  width={qrSpec.viewBoxSize}
                  height={qrSpec.viewBoxSize}
                  fill="#FAF7F0"
                />
                <path d={qrSpec.pathData} fill="#0A3622" />
              </svg>
              <div className="space-y-1 pr-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8F6E2A]">
                  Booking Reference
                </span>
                <span className="block font-mono text-base sm:text-lg font-black text-[#0A3622] tabular-nums">
                  {app.referenceNumber}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#065F46]">
                  <CheckCircle2 className="size-3" />
                  QR Capability Signed
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Payment Verification Status Banner (OD-04) */}
        <div
          className={
            isPaidFull
              ? "bg-[#D1FAE5] border-b border-[#059669]/30 px-6 py-3.5 sm:px-10 flex flex-wrap items-center justify-between gap-2 text-[#065F46]"
              : "bg-[#FEF3C7] border-b border-[#D97706]/30 px-6 py-3.5 sm:px-10 flex flex-wrap items-center justify-between gap-2 text-[#92400E]"
          }
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold tracking-wide">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{resolved.paymentBanner}</span>
          </div>
          <div className="font-mono text-xs sm:text-sm font-bold tabular-nums">
            {isPaidFull ? (
              <span>
                Total Settled: PKR {resolved.grandTotalPkr.toLocaleString()} (Quote #
                {resolved.quoteNumber})
              </span>
            ) : (
              <span>
                Verified Paid: PKR {resolved.amountPaidPkr.toLocaleString()} · Balance
                Due: PKR {resolved.balanceDuePkr.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Voucher Body */}
        <div className="p-6 sm:p-10 space-y-8">
          {/* Pilgrim & Travel Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-5">
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8F6E2A]">
                <Users className="size-3.5 text-[#C5A059]" />
                Lead Pilgrim &amp; Party
              </span>
              <p className="text-base font-bold text-[#0A3622]">
                {app.customerName}
              </p>
              <p className="text-xs text-[#686E65]">
                City: {app.customerCity} · {app.adults} Adult(s)
                {app.children > 0 ? `, ${app.children} Child(ren)` : ""}
                {app.infants > 0 ? `, ${app.infants} Infant(s)` : ""} (
                <span className="tabular-nums">
                  {app.totalPassportCount} Passports · {app.bedAndSeatCount} Beds/Seats
                </span>
                )
              </p>
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8F6E2A]">
                <Calendar className="size-3.5 text-[#C5A059]" />
                Kingdom Travel Window
              </span>
              <p className="text-base font-bold text-[#0A3622] tabular-nums">
                {app.ksaArrivalDate ?? "Scheduled"} &rarr;{" "}
                {app.ksaDepartureDate ?? "Scheduled"}
              </p>
              <p className="text-xs text-[#686E65]">
                {app.groupPackageTitle
                  ? `${app.groupPackageTitle}${
                      app.groupDepartureCode
                        ? ` (Batch ${app.groupDepartureCode})`
                        : ""
                    }`
                  : [
                      app.entryAirport ? `Entry: ${app.entryAirport}` : null,
                      app.exitAirport ? `Exit: ${app.exitAirport}` : null,
                      app.calculatedVisaTier
                        ? `Visa: ${app.calculatedVisaTier.replace("_", " ")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Custom Haramain Dossier"}
              </p>
            </div>
          </div>

          {/* Flight Routing (if included) */}
          {app.includeFlights && (
            <section className="space-y-2.5">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0A3622]">
                <Plane className="size-4 text-[#C5A059]" />
                Confirmed Flight Routing Parameters
              </h2>
              <div className="rounded-2xl border border-[#E6DEC8] bg-white p-4 text-xs sm:text-sm text-[#1A1D1A] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-[#0A3622]">
                    Origin Gateway:
                  </span>{" "}
                  {app.departureCityLabel ?? "Pakistan International Gateway"}
                </div>
                <div>
                  <span className="font-semibold text-[#0A3622]">
                    KSA Sectors:
                  </span>{" "}
                  {app.entryAirport ?? "JED"} / {app.exitAirport ?? "MED"}
                </div>
                <div>
                  <span className="font-semibold text-[#0A3622]">Carrier:</span>{" "}
                  {app.airlineLabel ?? "Agency Confirmed Allocation"}
                </div>
              </div>
            </section>
          )}

          {/* Hotel Stays */}
          {app.includeHotels && app.hotelStays.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0A3622]">
                <Building2 className="size-4 text-[#C5A059]" />
                Haramain Accommodation Schedule
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {app.hotelStays.map((stay) => (
                  <div
                    key={stay.stayOrder}
                    className="rounded-2xl border border-[#E6DEC8] bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-[#0A3622] px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                          Stay {stay.stayOrder} ·{" "}
                          {stay.city === "makkah" ? "Makkah" : "Madinah"}
                        </span>
                        {stay.starRating && (
                          <span className="text-[11px] font-semibold text-[#8F6E2A]">
                            {stay.starRating}-Star
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-[#0A3622]">
                        {stay.hotelName}
                      </h3>
                      {stay.distanceLabel && (
                        <p className="text-xs text-[#686E65]">
                          {stay.distanceLabel}
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right text-xs space-y-1 tabular-nums">
                      <p className="font-bold text-[#1A1D1A]">
                        {stay.checkInDate} &rarr; {stay.checkOutDate} ({stay.nights}{" "}
                        {stay.nights === 1 ? "Night" : "Nights"})
                      </p>
                      <p className="text-[#8F6E2A] font-semibold capitalize">
                        {stay.roomCategory} Allocation ·{" "}
                        {stay.mealPlan.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ground Transport */}
          {app.includeTransport && app.transportSegments.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0A3622]">
                <Car className="size-4 text-[#C5A059]" />
                Kingdom Ground Fleet &amp; Transfers
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {app.transportSegments.map((seg) => (
                  <div
                    key={seg.segmentOrder}
                    className="rounded-2xl border border-[#E6DEC8] bg-white p-3.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#0A3622]">
                        Leg {seg.segmentOrder}: {seg.sectorLabel}
                      </span>
                      <span className="rounded-full bg-[#FAF7F0] border border-[#C5A059]/40 px-2 py-0.5 text-[10px] font-bold text-[#8F6E2A] uppercase">
                        {seg.serviceType}
                      </span>
                    </div>
                    <p className="text-[#686E65] tabular-nums">
                      {seg.vehicleQuantity} &times; {seg.vehicleName}
                      {seg.scheduledDate ? ` · ${seg.scheduledDate}` : ""}
                      {seg.pickupTime ? ` · ${seg.pickupTime}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ziyarat */}
          {app.includeZiyarat && app.ziyaratPlaceNames.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0A3622]">
                <Compass className="size-4 text-[#C5A059]" />
                Guided Sacred Ziyarat Sanctuaries
              </h2>
              <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0]/50 p-4">
                {app.ziyaratPlaceNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-[#E6DEC8] bg-white px-3 py-1 text-xs font-medium text-[#0A3622]"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Verified Regulatory Credentials & Emergency Footer */}
          <footer className="border-t border-[#E6DEC8] pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[11px] text-[#686E65]">
            <div className="space-y-1">
              <p className="font-semibold text-[#0A3622]">
                24/7 Haramain Pilgrim Assistance: {companyInfo.hotlineDisplay}
              </p>
              <p>
                Present this voucher along with valid passports and Umrah eVisas at
                check-in and ground dispatch points.
              </p>
            </div>
            {(resolved.licenses.dtsLicense ||
              resolved.licenses.moraLicense ||
              resolved.licenses.iataCode ||
              resolved.licenses.ntnNumber) && (
              <div className="flex flex-wrap gap-2">
                {resolved.licenses.dtsLicense && (
                  <span className="rounded-md border border-[#E6DEC8] bg-[#FAF7F0] px-2 py-1 font-mono text-[10px] font-semibold text-[#0A3622]">
                    DTS: {resolved.licenses.dtsLicense}
                  </span>
                )}
                {resolved.licenses.moraLicense && (
                  <span className="rounded-md border border-[#E6DEC8] bg-[#FAF7F0] px-2 py-1 font-mono text-[10px] font-semibold text-[#0A3622]">
                    MoRA: {resolved.licenses.moraLicense}
                  </span>
                )}
                {resolved.licenses.iataCode && (
                  <span className="rounded-md border border-[#E6DEC8] bg-[#FAF7F0] px-2 py-1 font-mono text-[10px] font-semibold text-[#0A3622]">
                    IATA: {resolved.licenses.iataCode}
                  </span>
                )}
                {resolved.licenses.ntnNumber && (
                  <span className="rounded-md border border-[#E6DEC8] bg-[#FAF7F0] px-2 py-1 font-mono text-[10px] font-semibold text-[#0A3622]">
                    NTN: {resolved.licenses.ntnNumber}
                  </span>
                )}
              </div>
            )}
          </footer>
        </div>
      </article>
    </div>
  )
}
