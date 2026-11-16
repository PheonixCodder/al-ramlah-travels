import { z } from "zod"

export const socialProviderIdSchema = z.enum([
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "gmb",
])

export const socialPostFormatSchema = z.enum(["FEED", "REEL", "STORY"])

export const socialPostTypeSchema = z.enum([
  "single_image",
  "carousel",
  "video",
  "story",
  "offer",
])

export const socialCampaignStageSchema = z.enum([
  "step_1_spotlight_hook",
  "step_2_all_packages",
  "standalone",
])

export const callToActionTypeSchema = z.enum([
  "BOOK",
  "ORDER",
  "SHOP",
  "LEARN_MORE",
  "SIGN_UP",
  "CALL",
])

export const socialOfferDetailsSchema = z.object({
  couponCode: z.string().optional(),
  redeemUrl: z.string().url().optional(),
  terms: z.string().optional(),
})

export const platformCaptionOverrideSchema = z.object({
  caption: z.string().max(63206).optional(),
  firstComment: z.string().max(2200).optional(),
})

export const platformCaptionsSchema = z
  .object({
    instagram: platformCaptionOverrideSchema.optional(),
    facebook: platformCaptionOverrideSchema.optional(),
    tiktok: platformCaptionOverrideSchema.optional(),
    youtube: platformCaptionOverrideSchema.optional(),
    gmb: platformCaptionOverrideSchema.optional(),
  })
  .default({})

export const engagementPlugConfigSchema = z.object({
  enabled: z.boolean().default(false),
  minLikes: z.number().int().min(0).default(25),
  minViews: z.number().int().min(0).default(500),
  plugText: z.string().min(1, "Engagement plug copy is required").max(2200),
  triggeredAt: z.string().optional().nullable(),
})

export const followUpPostSchema = z.object({
  caption: z.string().min(1, "Follow-up post caption is required").max(63206),
  postAssetId: z.string().uuid().optional(),
  mediaUrls: z.array(z.string().url()).default([]),
  postType: socialPostTypeSchema.default("carousel"),
  postFormat: socialPostFormatSchema.default("FEED"),
  firstComment: z.string().max(2200).optional().nullable(),
  title: z.string().max(100).optional(),
})

export const createScheduledPostSchema = z.object({
  postAssetId: z.string().uuid().optional(),
  caption: z.string().min(1, "Post caption is required").max(63206),
  postType: socialPostTypeSchema.default("single_image"),
  postFormat: socialPostFormatSchema.default("FEED"),
  firstComment: z.string().max(2200).optional().nullable(),
  platformCaptions: platformCaptionsSchema.optional(),
  engagementPlugConfig: engagementPlugConfigSchema.optional().nullable(),
  mediaUrls: z.array(z.string().url()).default([]),
  campaignStage: socialCampaignStageSchema.default("standalone"),
  scheduledFor: z.coerce.date().refine((d) => !isNaN(d.getTime()), {
    message: "Valid scheduled date is required",
  }),
  targetIntegrationIds: z
    .array(z.string().uuid())
    .min(1, "Please select at least one social channel target"),
  twoStepDelayMinutes: z.number().int().min(1).max(10080).default(180),
  publishNow: z.boolean().default(false),
  title: z.string().max(100).optional(),
  callToActionUrl: z.string().url().optional().or(z.literal("")),
  callToActionType: callToActionTypeSchema.optional(),
  offerDetails: socialOfferDetailsSchema.optional(),
  followUpPost: followUpPostSchema.optional(),
})

export const scheduleSocialPostSchema = createScheduledPostSchema

export const rescheduleSocialPostSchema = z.object({
  postId: z.string().uuid("Valid scheduled post ID is required"),
  newScheduledFor: z.coerce.date().refine((d) => !isNaN(d.getTime()), {
    message: "Valid scheduled date is required",
  }),
})

export const generateSocialCaptionsCopilotSchema = z.object({
  postCode: z.string().optional(),
  title: z.string().optional(),
  campaignStage: socialCampaignStageSchema.optional(),
  postFormat: socialPostFormatSchema.optional(),
  sharingPricePkr: z.number().int().nonnegative().optional().nullable(),
  quadPricePkr: z.number().int().nonnegative().optional().nullable(),
  triplePricePkr: z.number().int().nonnegative().optional().nullable(),
  doublePricePkr: z.number().int().nonnegative().optional().nullable(),
  makkahHotelName: z.string().optional().nullable(),
  madinahHotelName: z.string().optional().nullable(),
  nightsMakkah: z.number().int().positive().optional().nullable(),
  nightsMadinah: z.number().int().positive().optional().nullable(),
  airlineName: z.string().optional().nullable(),
  customNotes: z.string().optional().nullable(),
})

export const selectSocialAccountCandidateSchema = z.object({
  provider: socialProviderIdSchema.optional(),
  integrationId: z.string().uuid().optional(),
  internalAccountId: z
    .string()
    .min(1, "Please select a valid account / page / location ID"),
})

export const syncSocialPostAnalyticsSchema = z
  .object({
    scheduledPostId: z.string().uuid().optional(),
    postId: z.string().uuid().optional(),
  })
  .refine((val) => Boolean(val.scheduledPostId || val.postId), {
    message: "Valid scheduled post ID is required",
  })

export const refreshSocialIntegrationTokenSchema = z.object({
  integrationId: z.string().uuid().optional(),
  withinHours: z.number().int().min(1).max(720).optional(),
})

export const generateArtFirstCommentSchema = z.object({
  postAssetId: z.string().uuid().optional(),
  postCode: z.string().min(1).optional(),
  title: z.string().optional(),
  quadPricePkr: z.number().int().nonnegative().optional().nullable(),
  triplePricePkr: z.number().int().nonnegative().optional().nullable(),
  doublePricePkr: z.number().int().nonnegative().optional().nullable(),
  sharingPricePkr: z.number().int().nonnegative().optional().nullable(),
  makkahHotelName: z.string().optional().nullable(),
  madinahHotelName: z.string().optional().nullable(),
  whatsappNumber: z.string().optional(),
})

export const cancelScheduledPostSchema = z.object({
  postId: z.string().uuid("Valid scheduled post ID is required"),
})

export const retryFailedPostTargetSchema = z.object({
  targetId: z.string().uuid("Valid target ID is required"),
})

export const disconnectSocialIntegrationSchema = z.object({
  integrationId: z.string().uuid("Valid integration ID is required"),
})

export const saveManualSocialIntegrationSchema = z.object({
  provider: socialProviderIdSchema,
  name: z.string().min(1, "Account label / name is required"),
  handle: z.string().optional(),
  internalAccountId: z
    .string()
    .min(1, "Internal Account / Page / Channel ID is required"),
  accessToken: z.string().min(1, "Access token is required"),
  refreshToken: z.string().optional(),
  tokenExpiresInDays: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateScheduledPostInput = z.infer<typeof createScheduledPostSchema>
export type FollowUpPostInput = z.infer<typeof followUpPostSchema>
export type SelectSocialAccountCandidateInput = z.infer<
  typeof selectSocialAccountCandidateSchema
>
export type SyncSocialPostAnalyticsInput = z.infer<
  typeof syncSocialPostAnalyticsSchema
>
export type RefreshSocialIntegrationTokenInput = z.infer<
  typeof refreshSocialIntegrationTokenSchema
>
export type GenerateArtFirstCommentInput = z.infer<
  typeof generateArtFirstCommentSchema
>
export type CancelScheduledPostInput = z.infer<typeof cancelScheduledPostSchema>
export type RetryFailedPostTargetInput = z.infer<
  typeof retryFailedPostTargetSchema
>
export type DisconnectSocialIntegrationInput = z.infer<
  typeof disconnectSocialIntegrationSchema
>
export type SaveManualSocialIntegrationInput = z.infer<
  typeof saveManualSocialIntegrationSchema
>
export type RescheduleSocialPostInput = z.infer<
  typeof rescheduleSocialPostSchema
>
export type GenerateSocialCaptionsCopilotInput = z.infer<
  typeof generateSocialCaptionsCopilotSchema
>
export type PlatformCaptionOverrideInput = z.infer<
  typeof platformCaptionOverrideSchema
>
export type PlatformCaptionsInput = z.infer<typeof platformCaptionsSchema>
export type EngagementPlugConfigInput = z.infer<typeof engagementPlugConfigSchema>

