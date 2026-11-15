import { type ExtendedPaymentStatus } from "@/db/schema/applications"

export type VoucherBannerLabel =
  | "PAID IN FULL"
  | "DEPOSIT VERIFIED — BALANCE DUE"

export type AdminVoucherGateEvaluation =
  | {
      allowed: true
      effectivePaymentStatus: "deposit_paid" | "paid_in_full"
      paymentBanner: VoucherBannerLabel
      grandTotalPkr: number
      verifiedAmountPaidPkr: number
      balanceDuePkr: number
    }
  | {
      allowed: false
      reason:
        | "unapproved_status"
        | "missing_quote"
        | "awaiting_verified_deposit"
      message: string
    }

/**
 * Evaluates whether an application dossier is eligible to display/print an
 * Official Confirmation Voucher (`T-023`, `OD-04`):
 * Strictly requires `applicationStatus === "approved"` AND
 * `effectivePaymentStatus IN ("deposit_paid", "paid_in_full")` with positive verified payment.
 */
export function evaluateAdminVoucherGate(params: {
  applicationStatus: string
  quoteGrandTotalPkr?: number | null
  quoteDepositRequiredPkr?: number | null
  quoteAmountPaidPkr?: number | null
  quotePaymentStatus?: string | null
  verifiedPaymentsSumPkr?: number | null
}): AdminVoucherGateEvaluation {
  if (params.applicationStatus !== "approved") {
    return {
      allowed: false,
      reason: "unapproved_status",
      message: `Confirmation vouchers can only be issued for Approved bookings (current status: "${params.applicationStatus.replace(/_/g, " ")}").`,
    }
  }

  const grandTotalPkr = Math.max(0, Math.floor(params.quoteGrandTotalPkr ?? 0))
  if (grandTotalPkr <= 0) {
    return {
      allowed: false,
      reason: "missing_quote",
      message:
        "Confirmation vouchers require a finalized quotation with a positive PKR total.",
    }
  }

  const depositRequiredPkr = Math.max(
    0,
    Math.floor(params.quoteDepositRequiredPkr ?? 0)
  )
  const ledgerSum =
    params.verifiedPaymentsSumPkr !== undefined &&
    params.verifiedPaymentsSumPkr !== null
      ? Math.max(0, Math.floor(params.verifiedPaymentsSumPkr))
      : null

  const verifiedAmountPaidPkr =
    ledgerSum !== null && ledgerSum > 0
      ? Math.min(grandTotalPkr, ledgerSum)
      : Math.min(grandTotalPkr, Math.max(0, Math.floor(params.quoteAmountPaidPkr ?? 0)))

  let effectivePaymentStatus: ExtendedPaymentStatus
  if (verifiedAmountPaidPkr <= 0) {
    effectivePaymentStatus = "unpaid"
  } else if (verifiedAmountPaidPkr >= grandTotalPkr) {
    effectivePaymentStatus = "paid_in_full"
  } else if (depositRequiredPkr > 0 && verifiedAmountPaidPkr < depositRequiredPkr) {
    effectivePaymentStatus = "partially_paid"
  } else if (
    params.quotePaymentStatus === "deposit_paid" ||
    params.quotePaymentStatus === "paid_in_full" ||
    (ledgerSum !== null && ledgerSum > 0)
  ) {
    effectivePaymentStatus = "deposit_paid"
  } else {
    effectivePaymentStatus = "partially_paid"
  }

  if (
    effectivePaymentStatus !== "deposit_paid" &&
    effectivePaymentStatus !== "paid_in_full"
  ) {
    return {
      allowed: false,
      reason: "awaiting_verified_deposit",
      message:
        depositRequiredPkr > 0
          ? `Awaiting verified deposit of at least PKR ${depositRequiredPkr.toLocaleString("en-PK")} (currently verified: PKR ${verifiedAmountPaidPkr.toLocaleString("en-PK")}).`
          : "Awaiting verified deposit or full settlement in the payment ledger before issuing a Confirmation Voucher.",
    }
  }

  const balanceDuePkr = Math.max(0, grandTotalPkr - verifiedAmountPaidPkr)
  const paymentBanner: VoucherBannerLabel =
    effectivePaymentStatus === "paid_in_full" && balanceDuePkr === 0
      ? "PAID IN FULL"
      : "DEPOSIT VERIFIED — BALANCE DUE"

  return {
    allowed: true,
    effectivePaymentStatus,
    paymentBanner,
    grandTotalPkr,
    verifiedAmountPaidPkr,
    balanceDuePkr,
  }
}

/**
 * Pure helper computing initial `QuoteWorksheetForm` pillar totals so `group_booking`
 * package totals (`grandTotalPkr > 0` with `0` across individual pillars) are never zeroed (`T-022`).
 */
export function deriveInitialWorksheetPillars(params: {
  source?: string
  includeVisa: boolean
  includeFlights: boolean
  calculatedVisaTotalPkr?: number | null
  initialQuote?: {
    visaTotalPkr: number
    flightsTotalPkr: number
    makkahHotelTotalPkr: number
    madinahHotelTotalPkr: number
    transportTotalPkr: number
    ziyaratTotalPkr: number
    discountPkr: number
    grandTotalPkr: number
  } | null
}): {
  visaTotalPkr: number
  flightsTotalPkr: number
  makkahHotelTotalPkr: number
  madinahHotelTotalPkr: number
  transportTotalPkr: number
  ziyaratTotalPkr: number
  discountPkr: number
} {
  const q = params.initialQuote
  if (!q) {
    return {
      visaTotalPkr: params.calculatedVisaTotalPkr || 0,
      flightsTotalPkr: 0,
      makkahHotelTotalPkr: 0,
      madinahHotelTotalPkr: 0,
      transportTotalPkr: 0,
      ziyaratTotalPkr: 0,
      discountPkr: 0,
    }
  }

  const existingPillarSum =
    (q.visaTotalPkr || 0) +
    (q.flightsTotalPkr || 0) +
    (q.makkahHotelTotalPkr || 0) +
    (q.madinahHotelTotalPkr || 0) +
    (q.transportTotalPkr || 0) +
    (q.ziyaratTotalPkr || 0)

  if (existingPillarSum === 0 && q.grandTotalPkr > 0) {
    const targetSubtotal = q.grandTotalPkr + (q.discountPkr || 0)
    const visaPortion = params.includeVisa
      ? Math.min(targetSubtotal, Math.max(0, params.calculatedVisaTotalPkr || 0))
      : 0
    const remainder = Math.max(0, targetSubtotal - visaPortion)

    return {
      visaTotalPkr: visaPortion,
      flightsTotalPkr: params.includeFlights ? remainder : 0,
      makkahHotelTotalPkr: params.includeFlights ? 0 : remainder,
      madinahHotelTotalPkr: 0,
      transportTotalPkr: 0,
      ziyaratTotalPkr: 0,
      discountPkr: q.discountPkr || 0,
    }
  }

  return {
    visaTotalPkr: q.visaTotalPkr || 0,
    flightsTotalPkr: q.flightsTotalPkr || 0,
    makkahHotelTotalPkr: q.makkahHotelTotalPkr || 0,
    madinahHotelTotalPkr: q.madinahHotelTotalPkr || 0,
    transportTotalPkr: q.transportTotalPkr || 0,
    ziyaratTotalPkr: q.ziyaratTotalPkr || 0,
    discountPkr: q.discountPkr || 0,
  }
}
