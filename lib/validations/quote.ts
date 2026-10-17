import { z } from "zod"

export const quoteUpdateSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  visaTotalPkr: z.number().int().min(0, "Visa total cannot be negative"),
  flightsTotalPkr: z.number().int().min(0, "Flights total cannot be negative"),
  makkahHotelTotalPkr: z
    .number()
    .int()
    .min(0, "Makkah hotel total cannot be negative"),
  madinahHotelTotalPkr: z
    .number()
    .int()
    .min(0, "Madinah hotel total cannot be negative"),
  transportTotalPkr: z
    .number()
    .int()
    .min(0, "Transport total cannot be negative"),
  ziyaratTotalPkr: z.number().int().min(0, "Ziyarat total cannot be negative"),
  discountPkr: z.number().int().min(0).default(0),
  quoteNotesCustomer: z.string().max(2000).optional(),
  internalNotesAdmin: z.string().max(2000).optional(),
  paymentStatus: z
    .enum(["unpaid", "partially_paid", "paid_in_full"])
    .default("unpaid"),
  amountPaidPkr: z.number().int().min(0).default(0),
  validUntilDays: z.number().int().min(1).max(30).default(7),
})

export const applicationStatusUpdateSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  status: z.enum([
    "pending_quote",
    "quoted",
    "approved",
    "rejected",
    "cancelled",
  ]),
  assignedStaffUserId: z.string().optional(),
})

export type QuoteUpdateInput = z.infer<typeof quoteUpdateSchema>
export type ApplicationStatusUpdateInput = z.infer<
  typeof applicationStatusUpdateSchema
>
