import { z } from "zod"
import { BRAND_PRIMARY_WHATSAPP } from "../constants/brand"
import { isValidIsoCalendarDate } from "../domain/date-chaining"
import { parsePhoneE164 } from "../phone"
import {
  safeNullableAssetUrlSchema,
  safeRequiredAssetUrlSchema,
} from "./url-guards"

const isoDateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD")
  .refine(
    isValidIsoCalendarDate,
    "Must be a real Gregorian calendar date (YYYY-MM-DD)"
  )

export const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Supplier name is required").max(160),
  slug: z.string().trim().min(2).max(120),
  codePrefix: z.string().trim().min(1).max(8).toUpperCase(),
  category: z
    .enum(["group_packages", "custom_packages", "both"])
    .default("group_packages"),
  defaultCommissionMode: z
    .enum(["included_in_flyer", "net_plus_markup"])
    .default("included_in_flyer"),
  defaultCommissionPkr: z.number().int().min(0).max(50_000_000).default(22000),
  contactPerson: z.string().trim().max(120).optional().nullable(),
  whatsappNumber: z.string().trim().max(32).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const extractedFlyerCardSchema = z.object({
  id: z.string().uuid().optional(),
  cardNumber: z.string().trim().min(1).max(16),
  outboundFlightNo: z.string().trim().min(1).max(32),
  outboundDateLabel: z.string().trim().min(1).max(64),
  outboundRoute: z.string().trim().min(1).max(64),
  outboundDepTime: z.string().trim().min(1).max(32),
  outboundArrTime: z.string().trim().min(1).max(32),
  returnFlightNo: z.string().trim().min(1).max(32),
  returnDateLabel: z.string().trim().min(1).max(64),
  returnRoute: z.string().trim().min(1).max(64),
  returnDepTime: z.string().trim().min(1).max(32),
  returnArrTime: z.string().trim().min(1).max(32),
  makkahNights: z.string().trim().min(1).max(32),
  makkahHotelName: z.string().trim().min(1).max(160),
  makkahDistanceLabel: z.string().trim().min(1).max(120),
  madinahNights: z.string().trim().min(1).max(32),
  madinahHotelName: z.string().trim().min(1).max(160),
  madinahDistanceLabel: z.string().trim().min(1).max(120),
  mealPlanLabel: z.string().trim().max(80).default("Room Only").optional(),
  rawSharingPkr: z.number().int().min(0).max(500_000_000),
  rawQuadPkr: z.number().int().min(0).max(500_000_000),
  rawTriplePkr: z.number().int().min(0).max(500_000_000),
  rawDoublePkr: z.number().int().min(0).max(500_000_000),
})

export const supplierFlyerUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  rawFlyerImageUrl: safeRequiredAssetUrlSchema("Raw flyer image URL"),
  airlineName: z.string().trim().min(1).max(120),
  airlineIataCode: z.string().trim().max(8).optional(),
  airlineLogoUrl: safeNullableAssetUrlSchema("Airline logo URL"),
  durationDays: z.number().int().min(1).max(90).default(15),
  daysTitle: z.string().trim().min(1).max(64).default("15 DAYS"),
  routePill: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default("LHE - JED | JED - LHE"),
  departureCityCode: z.string().trim().max(8).default("LHE"),
  arrivalAirportCode: z.string().trim().max(8).default("JED"),
  returnAirportCode: z.string().trim().max(8).default("JED"),
  outboundBaggage: z.string().trim().max(80).optional().nullable(),
  inboundBaggage: z.string().trim().max(80).optional().nullable(),
  giftedInclusions: z
    .array(z.string().trim().min(1).max(160))
    .max(30)
    .default([]),
  commissionMode: z
    .enum(["included_in_flyer", "net_plus_markup"])
    .default("included_in_flyer"),
  commissionPkr: z.number().int().min(0).max(50_000_000).default(22000),
  receivedDate: isoDateStringSchema,
  notes: z.string().trim().max(2000).optional().nullable(),
  cards: z.array(extractedFlyerCardSchema).min(1).max(50),
})

export const marketingChannelSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  platform: z.enum([
    "whatsapp_group",
    "whatsapp_community",
    "whatsapp_status",
    "instagram",
    "facebook",
    "tiktok",
    "youtube",
  ]),
  areaTag: z.string().trim().min(1).max(80).default("Lahore"),
  senderWhatsappNumber: z.string().trim().max(32).optional().nullable(),
  externalGroupIdOrHandle: z.string().trim().max(200).optional().nullable(),
  inviteLinkOrUrl: safeNullableAssetUrlSchema("Invite link or URL"),
  memberCount: z.number().int().min(0).max(10_000_000).optional().nullable(),
  dailyTargetPosts: z.number().int().min(1).max(50).default(1),
  isActive: z.boolean().default(true),
})

export const logDistributionSchema = z.object({
  scheduledDate: isoDateStringSchema,
  channelIds: z.array(z.string().uuid()).min(1).max(200),
  postAssetId: z.string().uuid(),
  pairedFollowUpAssetId: z.string().uuid().optional().nullable(),
  stage: z
    .enum(["step_1_spotlight_hook", "step_2_all_packages", "standalone"])
    .default("step_1_spotlight_hook"),
  captionUsed: z.string().trim().max(4096).optional(),
  dispatchMode: z.enum(["manual_log", "auto_bridge"]).default("manual_log"),
})

export const outreachContactSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(2).max(120),
  whatsappNumber: z
    .string()
    .trim()
    .min(7)
    .max(32)
    .refine(
      (v) => {
        const p = parsePhoneE164(v)
        return p.valid && p.nationalDigits.length >= 9
      },
      "Enter a valid Pakistani or international WhatsApp phone number"
    ),
  secondaryPhone: z
    .string()
    .trim()
    .max(32)
    .refine(
      (v) => !v || parsePhoneE164(v).valid,
      "Secondary phone must be a valid phone number"
    )
    .optional()
    .nullable(),
  city: z.string().trim().max(100).default("Lahore"),
  areaCommunity: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .default("Askari 10"),
  sourceGroupOrChannel: z.string().trim().max(160).optional().nullable(),
  assignedWhatsappLine: z
    .string()
    .trim()
    .max(32)
    .default(BRAND_PRIMARY_WHATSAPP),
  tags: z.array(z.string().trim().min(1).max(64)).max(30).default([]),
  notes: z.string().trim().max(2000).optional().nullable(),
  doNotContact: z.boolean().default(false).optional(),
})

export const sendOutreachMessageSchema = z.object({
  contactId: z.string().uuid(),
  postAssetId: z.string().uuid().optional().nullable(),
  flyerId: z.string().uuid().optional().nullable(),
  senderWhatsappLine: z
    .string()
    .trim()
    .max(32)
    .default(BRAND_PRIMARY_WHATSAPP),
  messageText: z.string().trim().min(1).max(4096),
  forceOverrideCooldown: z.boolean().default(false).optional(),
})

export const updateExtractedFlyerCardSchema = z.object({
  id: z.string().uuid("Invalid card ID"),
  makkahHotelName: z
    .string()
    .trim()
    .min(1, "Makkah hotel name is required")
    .max(160),
  makkahNights: z.string().trim().min(1, "Makkah nights is required").max(32),
  makkahDistanceLabel: z
    .string()
    .trim()
    .min(1, "Makkah distance is required")
    .max(120),
  madinahHotelName: z
    .string()
    .trim()
    .min(1, "Madinah hotel name is required")
    .max(160),
  madinahNights: z
    .string()
    .trim()
    .min(1, "Madinah nights is required")
    .max(32),
  madinahDistanceLabel: z
    .string()
    .trim()
    .min(1, "Madinah distance is required")
    .max(120),
  mealPlanLabel: z.string().trim().max(80).optional().nullable(),
  outboundFlightNo: z
    .string()
    .trim()
    .min(1, "Outbound flight number is required")
    .max(32),
  outboundDateLabel: z
    .string()
    .trim()
    .min(1, "Outbound date label is required")
    .max(64),
  outboundRoute: z
    .string()
    .trim()
    .min(1, "Outbound route is required")
    .max(64),
  outboundDepTime: z
    .string()
    .trim()
    .min(1, "Outbound dep time is required")
    .max(32),
  outboundArrTime: z
    .string()
    .trim()
    .min(1, "Outbound arr time is required")
    .max(32),
  returnFlightNo: z
    .string()
    .trim()
    .min(1, "Return flight number is required")
    .max(32),
  returnDateLabel: z
    .string()
    .trim()
    .min(1, "Return date label is required")
    .max(64),
  returnRoute: z.string().trim().min(1, "Return route is required").max(64),
  returnDepTime: z
    .string()
    .trim()
    .min(1, "Return dep time is required")
    .max(32),
  returnArrTime: z
    .string()
    .trim()
    .min(1, "Return arr time is required")
    .max(32),
  commissionPkr: z.number().int().min(0, "Commission must be >= 0").max(50_000_000),
  rawSharingPkr: z
    .number()
    .int()
    .min(0, "Sharing price must be >= 0")
    .max(500_000_000),
  rawQuadPkr: z
    .number()
    .int()
    .min(0, "Quad price must be >= 0")
    .max(500_000_000),
  rawTriplePkr: z
    .number()
    .int()
    .min(0, "Triple price must be >= 0")
    .max(500_000_000),
  rawDoublePkr: z
    .number()
    .int()
    .min(0, "Double price must be >= 0")
    .max(500_000_000),
  spotlightPosterUrl: safeNullableAssetUrlSchema("Spotlight poster URL"),
})

export const deleteSupplierFlyerSchema = z.object({
  flyerId: z.string().uuid("Invalid flyer ID"),
})

export const publishAllFlyerCardsSchema = z.object({
  flyerId: z.string().uuid("Invalid flyer ID"),
})

export const updatePackageSpotlightImageSchema = z.object({
  cardId: z.string().uuid("Invalid package card ID"),
  imageUrl: safeRequiredAssetUrlSchema("Image URL"),
})

export type SupplierInput = z.infer<typeof supplierSchema>
export type ExtractedFlyerCardInput = z.infer<typeof extractedFlyerCardSchema>
export type SupplierFlyerUpsertInput = z.infer<typeof supplierFlyerUpsertSchema>
export type MarketingChannelInput = z.infer<typeof marketingChannelSchema>
export type LogDistributionInput = z.infer<typeof logDistributionSchema>
export type OutreachContactInput = z.infer<typeof outreachContactSchema>
export type SendOutreachMessageInput = z.infer<typeof sendOutreachMessageSchema>
export type UpdateExtractedFlyerCardInput = z.infer<
  typeof updateExtractedFlyerCardSchema
>
export type DeleteSupplierFlyerInput = z.infer<typeof deleteSupplierFlyerSchema>
export type PublishAllFlyerCardsInput = z.infer<
  typeof publishAllFlyerCardsSchema
>
export type UpdatePackageSpotlightImageInput = z.infer<
  typeof updatePackageSpotlightImageSchema
>
