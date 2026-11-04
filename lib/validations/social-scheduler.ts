import { z } from "zod"

export const socialProviderIdSchema = z.enum([
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "gmb",
])

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

export const followUpPostSchema = z.object({
  caption: z.string().min(1, "Follow-up post caption is required").max(63206),
  postAssetId: z.string().uuid().optional(),
  mediaUrls: z.array(z.string().url()).default([]),
  postType: socialPostTypeSchema.default("carousel"),
  title: z.string().max(100).optional(),
})

export const createScheduledPostSchema = z.object({
  postAssetId: z.string().uuid().optional(),
  caption: z.string().min(1, "Post caption is required").max(63206),
  postType: socialPostTypeSchema.default("single_image"),
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
