import { z } from "zod"

export const QUOTE_PAYMENT_STATUSES = [
  "unpaid",
  "deposit_paid",
  "partially_paid",
  "paid_in_full",
  "refunded",
] as const

export type QuotePaymentStatus = (typeof QUOTE_PAYMENT_STATUSES)[number]

export const quotePaymentStatusSchema = z.enum(QUOTE_PAYMENT_STATUSES)

type LegacyDrizzlePaymentStatus = "unpaid" | "partially_paid" | "paid_in_full"

/**
 * Runtime-validates all 5 canonical `QuotePaymentStatus` values (`unpaid`, `deposit_paid`,
 * `partially_paid`, `paid_in_full`, `refunded`) while preserving TypeScript assignability
 * with Drizzle's `paymentStatusEnum` column type (`T-050`).
 */
const drizzleCompatiblePaymentStatusField = z
  .enum(QUOTE_PAYMENT_STATUSES)
  .default("unpaid") as unknown as z.ZodDefault<
  z.ZodType<LegacyDrizzlePaymentStatus, QuotePaymentStatus | undefined>
>

export const APPLICATION_PIPELINE_STATUSES = [
  "pending_quote",
  "quoted",
  "revision_requested",
  "approved",
  "rejected",
  "cancelled",
] as const

export type ApplicationPipelineStatus =
  (typeof APPLICATION_PIPELINE_STATUSES)[number]

type LegacyDrizzleApplicationStatus =
  | "pending_quote"
  | "quoted"
  | "approved"
  | "rejected"
  | "cancelled"

const drizzleCompatibleAppStatusField = z.enum(
  APPLICATION_PIPELINE_STATUSES
) as unknown as z.ZodType<
  LegacyDrizzleApplicationStatus,
  ApplicationPipelineStatus
>

const MAX_QUOTE_LINE_PKR = 500_000_000

export const quoteUpdateSchema = z
  .object({
    applicationId: z.string().uuid("Invalid application ID"),
    visaTotalPkr: z
      .number()
      .int()
      .min(0, "Visa total cannot be negative")
      .max(MAX_QUOTE_LINE_PKR),
    flightsTotalPkr: z
      .number()
      .int()
      .min(0, "Flights total cannot be negative")
      .max(MAX_QUOTE_LINE_PKR),
    makkahHotelTotalPkr: z
      .number()
      .int()
      .min(0, "Makkah hotel total cannot be negative")
      .max(MAX_QUOTE_LINE_PKR),
    madinahHotelTotalPkr: z
      .number()
      .int()
      .min(0, "Madinah hotel total cannot be negative")
      .max(MAX_QUOTE_LINE_PKR),
    transportTotalPkr: z
      .number()
      .int()
      .min(0, "Transport total cannot be negative")
      .max(MAX_QUOTE_LINE_PKR),
    ziyaratTotalPkr: z
      .number()
      .int()
      .min(0, "Ziyarat total cannot be negative")
      .max(MAX_QUOTE_LINE_PKR),
    discountPkr: z
      .number()
      .int()
      .min(0, "Discount cannot be negative")
      .max(MAX_QUOTE_LINE_PKR)
      .default(0),
    supplierId: z.string().uuid().optional().nullable().or(z.literal("")),
    supplierNetCostPkr: z
      .number()
      .int()
      .min(0, "Supplier net cost cannot be negative")
      .max(MAX_QUOTE_LINE_PKR)
      .default(0)
      .optional(),
    commissionPkr: z
      .number()
      .int()
      .min(0, "Commission cannot be negative")
      .max(100_000_000)
      .default(25000)
      .optional(),
    /** Super-admin override flag required when quoting below B2B `supplierNetCostPkr` (`T-050`) */
    allowBelowNetCost: z.boolean().default(false).optional(),
    depositRequiredPkr: z
      .number()
      .int()
      .min(0, "Deposit required cannot be negative")
      .max(MAX_QUOTE_LINE_PKR)
      .default(0)
      .optional(),
    expectedVersion: z.number().int().min(1).optional(),
    quoteNotesCustomer: z.string().trim().max(2000).optional(),
    internalNotesAdmin: z.string().trim().max(2000).optional(),
    paymentStatus: drizzleCompatiblePaymentStatusField,
    amountPaidPkr: z
      .number()
      .int()
      .min(0, "Amount paid cannot be negative")
      .max(MAX_QUOTE_LINE_PKR)
      .default(0),
    validUntilDays: z.number().int().min(1).max(30).default(7),
  })
  .superRefine((data, ctx) => {
    const subtotalPkr =
      data.visaTotalPkr +
      data.flightsTotalPkr +
      data.makkahHotelTotalPkr +
      data.madinahHotelTotalPkr +
      data.transportTotalPkr +
      data.ziyaratTotalPkr

    // 1. Discount cannot exceed subtotal (`T-050`)
    if (data.discountPkr > subtotalPkr) {
      ctx.addIssue({
        code: "custom",
        path: ["discountPkr"],
        message: `Discount (PKR ${data.discountPkr.toLocaleString()}) cannot exceed itemized subtotal (PKR ${subtotalPkr.toLocaleString()})`,
      })
    }

    const grandTotalPkr = Math.max(0, subtotalPkr - data.discountPkr)
    const netCostPkr = data.supplierNetCostPkr ?? 0

    // 2. Supplier net-cost floor unless `allowBelowNetCost === true` (`T-050`)
    if (netCostPkr > 0 && !data.allowBelowNetCost && grandTotalPkr < netCostPkr) {
      ctx.addIssue({
        code: "custom",
        path: ["supplierNetCostPkr"],
        message: `Grand total (PKR ${grandTotalPkr.toLocaleString()}) cannot be below supplier net cost (PKR ${netCostPkr.toLocaleString()}) without super_admin override (allowBelowNetCost)`,
      })
    }

    // 3. Deposit required cannot exceed grand total
    const depositRequired = data.depositRequiredPkr ?? 0
    if (grandTotalPkr > 0 && depositRequired > grandTotalPkr) {
      ctx.addIssue({
        code: "custom",
        path: ["depositRequiredPkr"],
        message: "Deposit required cannot exceed quote grand total",
      })
    }

    // 4. Payment status <-> amountPaidPkr invariants (`T-050`)
    const status = data.paymentStatus as unknown as QuotePaymentStatus
    if (status === "unpaid" && data.amountPaidPkr > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountPaidPkr"],
        message: "Unpaid quotes must have amountPaidPkr equal to 0",
      })
    } else if (
      (status === "deposit_paid" || status === "partially_paid") &&
      data.amountPaidPkr <= 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["amountPaidPkr"],
        message: `${status} requires amountPaidPkr greater than 0`,
      })
    } else if (
      (status === "deposit_paid" || status === "partially_paid") &&
      grandTotalPkr > 0 &&
      data.amountPaidPkr >= grandTotalPkr
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentStatus"],
        message:
          "Amount paid equals or exceeds grand total; set paymentStatus to paid_in_full",
      })
    } else if (status === "paid_in_full") {
      if (grandTotalPkr <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["paymentStatus"],
          message: "Cannot mark a PKR 0 quote as paid_in_full",
        })
      } else if (data.amountPaidPkr !== grandTotalPkr) {
        ctx.addIssue({
          code: "custom",
          path: ["amountPaidPkr"],
          message: `paid_in_full requires amountPaidPkr (PKR ${data.amountPaidPkr.toLocaleString()}) to match grandTotalPkr (PKR ${grandTotalPkr.toLocaleString()})`,
        })
      }
    } else if (status === "refunded" && data.amountPaidPkr < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountPaidPkr"],
        message: "Refunded amountPaidPkr cannot be negative",
      })
    }

    if (
      status !== "refunded" &&
      status !== "paid_in_full" &&
      grandTotalPkr > 0 &&
      data.amountPaidPkr > grandTotalPkr
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["amountPaidPkr"],
        message: "Amount paid cannot exceed quote grand total",
      })
    }
  })

export const applicationStatusUpdateSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  status: drizzleCompatibleAppStatusField,
  assignedStaffUserId: z.string().trim().max(128).optional(),
})

export const recordApplicationPaymentSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  quoteId: z.string().uuid("Invalid quote ID"),
  amountPkr: z
    .number()
    .int()
    .min(1, "Payment amount must be greater than PKR 0")
    .max(MAX_QUOTE_LINE_PKR),
  paymentMethod: z
    .enum([
      "bank_transfer",
      "cash_lahore_hq",
      "cheque_pay_order",
      "online_gateway",
      "other",
    ])
    .default("bank_transfer"),
  bankReference: z.string().trim().max(128).optional().nullable(),
  receiptR2Key: z.string().trim().max(512).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type QuoteUpdateInput = z.infer<typeof quoteUpdateSchema>
export type QuoteUpdateInputRaw = z.input<typeof quoteUpdateSchema>
export type ApplicationStatusUpdateInput = z.infer<
  typeof applicationStatusUpdateSchema
>
export type RecordApplicationPaymentInput = z.infer<
  typeof recordApplicationPaymentSchema
>
