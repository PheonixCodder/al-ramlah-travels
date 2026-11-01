import { z } from "zod"

export const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Supplier name is required"),
  slug: z.string().trim().min(2),
  codePrefix: z.string().trim().min(1).max(8).toUpperCase(),
  category: z
    .enum(["group_packages", "custom_packages", "both"])
    .default("group_packages"),
  defaultCommissionMode: z
    .enum(["included_in_flyer", "net_plus_markup"])
    .default("included_in_flyer"),
  defaultCommissionPkr: z.number().int().min(0).default(22000),
  contactPerson: z.string().optional().nullable(),
  whatsappNumber: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export const extractedFlyerCardSchema = z.object({
  id: z.string().uuid().optional(),
  cardNumber: z.string().trim().min(1),
  outboundFlightNo: z.string().trim().min(1),
  outboundDateLabel: z.string().trim().min(1),
  outboundRoute: z.string().trim().min(1),
  outboundDepTime: z.string().trim().min(1),
  outboundArrTime: z.string().trim().min(1),
  returnFlightNo: z.string().trim().min(1),
  returnDateLabel: z.string().trim().min(1),
  returnRoute: z.string().trim().min(1),
  returnDepTime: z.string().trim().min(1),
  returnArrTime: z.string().trim().min(1),
  makkahNights: z.string().trim().min(1),
  makkahHotelName: z.string().trim().min(1),
  makkahDistanceLabel: z.string().trim().min(1),
  madinahNights: z.string().trim().min(1),
  madinahHotelName: z.string().trim().min(1),
  madinahDistanceLabel: z.string().trim().min(1),
  mealPlanLabel: z.string().default("Room Only").optional(),
  rawSharingPkr: z.number().int().min(0),
  rawQuadPkr: z.number().int().min(0),
  rawTriplePkr: z.number().int().min(0),
  rawDoublePkr: z.number().int().min(0),
})

export const supplierFlyerUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  title: z.string().trim().min(2),
  rawFlyerImageUrl: z.string().min(1),
  airlineName: z.string().trim().min(1),
  airlineIataCode: z.string().trim().max(8).optional(),
  airlineLogoUrl: z.string().optional().nullable(),
  durationDays: z.number().int().min(1).default(15),
  daysTitle: z.string().trim().min(1).default("15 DAYS"),
  routePill: z.string().trim().min(1).default("LHE - JED | JED - LHE"),
  departureCityCode: z.string().trim().max(8).default("LHE"),
  arrivalAirportCode: z.string().trim().max(8).default("JED"),
  returnAirportCode: z.string().trim().max(8).default("JED"),
  outboundBaggage: z.string().optional().nullable(),
  inboundBaggage: z.string().optional().nullable(),
  giftedInclusions: z.array(z.string()).default([]),
  commissionMode: z
    .enum(["included_in_flyer", "net_plus_markup"])
    .default("included_in_flyer"),
  commissionPkr: z.number().int().min(0).default(22000),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional().nullable(),
  cards: z.array(extractedFlyerCardSchema).min(1),
})

export const marketingChannelSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2),
  platform: z.enum([
    "whatsapp_group",
    "whatsapp_community",
    "whatsapp_status",
    "instagram",
    "facebook",
    "tiktok",
    "youtube",
  ]),
  areaTag: z.string().trim().min(1).default("Lahore"),
  senderWhatsappNumber: z.string().optional().nullable(),
  externalGroupIdOrHandle: z.string().optional().nullable(),
  inviteLinkOrUrl: z.string().optional().nullable(),
  memberCount: z.number().int().min(0).optional().nullable(),
  dailyTargetPosts: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
})

export const logDistributionSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channelIds: z.array(z.string().uuid()).min(1),
  postAssetId: z.string().uuid(),
  pairedFollowUpAssetId: z.string().uuid().optional().nullable(),
  stage: z
    .enum(["step_1_spotlight_hook", "step_2_all_packages", "standalone"])
    .default("step_1_spotlight_hook"),
  captionUsed: z.string().optional(),
  dispatchMode: z.enum(["manual_log", "auto_bridge"]).default("manual_log"),
})

export const outreachContactSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(2),
  whatsappNumber: z.string().trim().min(7),
  secondaryPhone: z.string().optional().nullable(),
  city: z.string().trim().default("Lahore"),
  areaCommunity: z.string().optional().nullable().default("Askari 10"),
  sourceGroupOrChannel: z.string().optional().nullable(),
  assignedWhatsappLine: z.string().default("03274029701"),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
})

export const sendOutreachMessageSchema = z.object({
  contactId: z.string().uuid(),
  postAssetId: z.string().uuid().optional().nullable(),
  flyerId: z.string().uuid().optional().nullable(),
  senderWhatsappLine: z.string().default("03274029701"),
  messageText: z.string().trim().min(1),
  forceOverrideCooldown: z.boolean().default(false).optional(),
})

export type SupplierInput = z.infer<typeof supplierSchema>
export type ExtractedFlyerCardInput = z.infer<typeof extractedFlyerCardSchema>
export type SupplierFlyerUpsertInput = z.infer<typeof supplierFlyerUpsertSchema>
export type MarketingChannelInput = z.infer<typeof marketingChannelSchema>
export type LogDistributionInput = z.infer<typeof logDistributionSchema>
export type OutreachContactInput = z.infer<typeof outreachContactSchema>
export type SendOutreachMessageInput = z.infer<typeof sendOutreachMessageSchema>
