import { z } from "zod"

/**
 * Runtime Zod validators & safe fallbacks for structured JSONB columns (`T-079` / `A04-015`).
 * Prevents malformed, legacy `'{}'::jsonb`, or `'null'::jsonb` payloads from throwing `TypeError`
 * at Server Component or PDF rendering boundaries.
 */

export const stringArrayJsonbSchema = z.array(z.string())

export const privateRoomAllocationSchema = z.object({
  double: z.number().int().min(0).default(0),
  triple: z.number().int().min(0).default(0),
  quad: z.number().int().min(0).default(0),
})

export type PrivateRoomAllocation = z.infer<typeof privateRoomAllocationSchema>

export const multiHotelOptionSchema = z.object({
  pkgCode: z.string().default("PKG"),
  label: z.string().default("Package Option"),
  makkahHotelName: z.string().default(""),
  makkahDistance: z.string().default(""),
  madinahHotelName: z.string().default(""),
  madinahDistance: z.string().default(""),
  sharingPricePkr: z.number().nonnegative().default(0),
  quadPricePkr: z.number().nonnegative().default(0),
  triplePricePkr: z.number().nonnegative().default(0),
  doublePricePkr: z.number().nonnegative().default(0),
})

export type MultiHotelOption = z.infer<typeof multiHotelOptionSchema>

export const whatsappInternalNoteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  note: z.string(),
  createdAt: z.string(),
})

export const whatsappIntakeFlowStateSchema = z.object({
  step: z
    .enum([
      "IDLE",
      "AWAITING_MONTH",
      "AWAITING_PILGRIMS",
      "AWAITING_HOTEL_TIER",
      "COMPLETED",
    ])
    .default("IDLE"),
  month: z.string().optional(),
  pilgrimCount: z.string().optional(),
  hotelTier: z.string().optional(),
  applicationId: z.string().optional(),
  startedAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export function parseStringArrayJsonb(raw: unknown): string[] {
  const parsed = stringArrayJsonbSchema.safeParse(raw)
  return parsed.success ? parsed.data : []
}

export function parsePrivateRoomAllocationJsonb(
  raw: unknown
): PrivateRoomAllocation {
  const parsed = privateRoomAllocationSchema.safeParse(raw)
  return parsed.success ? parsed.data : { double: 0, triple: 0, quad: 0 }
}

export function parseMultiHotelOptionsJsonb(raw: unknown): MultiHotelOption[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const valid: MultiHotelOption[] = []
  for (const item of raw) {
    const parsed = multiHotelOptionSchema.safeParse(item)
    if (parsed.success) {
      valid.push(parsed.data)
    }
  }
  return valid
}

export function parseRecordJsonb(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {}
  }
  return raw as Record<string, unknown>
}

export function parseWhatsappInternalNotesJsonb(
  raw: unknown
): Array<z.infer<typeof whatsappInternalNoteSchema>> {
  if (!Array.isArray(raw)) {
    return []
  }
  const valid: Array<z.infer<typeof whatsappInternalNoteSchema>> = []
  for (const item of raw) {
    const parsed = whatsappInternalNoteSchema.safeParse(item)
    if (parsed.success) {
      valid.push(parsed.data)
    }
  }
  return valid
}

export function parseWhatsappIntakeFlowStateJsonb(
  raw: unknown
): z.infer<typeof whatsappIntakeFlowStateSchema> {
  const parsed = whatsappIntakeFlowStateSchema.safeParse(raw)
  return parsed.success ? parsed.data : { step: "IDLE" }
}
