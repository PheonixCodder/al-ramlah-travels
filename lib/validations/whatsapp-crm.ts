import { z } from "zod"

export const upsertWhatsappAccountSchema = z.object({
  id: z.string().uuid("Invalid Account ID").optional(),
  name: z.string().min(1, "Account name is required").max(100).default("Al Ramlah Primary"),
  phoneNumberId: z
    .string()
    .min(1, "Phone Number ID is required")
    .max(64, "Phone Number ID is too long"),
  wabaId: z
    .string()
    .min(1, "WABA ID is required")
    .max(64, "WABA ID is too long"),
  displayPhoneNumber: z
    .string()
    .min(1, "Display Phone Number is required")
    .max(32),
  accessToken: z.string().min(1, "Meta System User Access Token is required"),
  webhookVerifyToken: z
    .string()
    .min(1, "Webhook verify token is required")
    .default(() => "art_wa_token_" + Math.random().toString(36).slice(2, 10)),
  pin: z
    .string()
    .regex(/^\d{6}$/, "Two-step verification PIN must be exactly 6 digits")
    .optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(true),
})

export type UpsertWhatsappAccountInput = z.infer<typeof upsertWhatsappAccountSchema>

export const sendWhatsappConversationReplySchema = z
  .object({
    conversationId: z.string().uuid("Invalid Conversation ID"),
    messageType: z.enum(["text", "image", "document", "template"]),
    text: z.string().optional(),
    mediaUrl: z.string().url("Valid media URL required").optional(),
    mediaFilename: z.string().optional(),
    caption: z.string().optional(),
    templateName: z.string().optional(),
    templateLanguage: z.string().default("en_US"),
    templateParams: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
    contextMessageId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.messageType === "text") {
        return !!data.text && data.text.trim().length > 0
      }
      if (data.messageType === "image" || data.messageType === "document") {
        return !!data.mediaUrl
      }
      if (data.messageType === "template") {
        return !!data.templateName
      }
      return true
    },
    {
      message: "Required content is missing for the chosen message type",
    }
  )

export type SendWhatsappConversationReplyInput = z.infer<
  typeof sendWhatsappConversationReplySchema
>

export const sendApplicationLuxuryPdfSchema = z.object({
  applicationId: z.string().uuid("Invalid Application ID"),
  phoneNumberOverride: z.string().optional(),
})

export type SendApplicationLuxuryPdfInput = z.infer<
  typeof sendApplicationLuxuryPdfSchema
>

export const upsertQuickReplySchema = z.object({
  id: z.string().uuid().optional(),
  accountId: z.string().uuid("Account ID is required"),
  shortcut: z
    .string()
    .min(1, "Shortcut is required")
    .max(64)
    .regex(
      /^\/?[a-zA-Z0-9_-]+$/,
      "Shortcut must only contain alphanumeric characters, underscores, or hyphens (e.g. /umrah-rates)"
    )
    .transform((s) => (s.startsWith("/") ? s : `/${s}`)),
  title: z.string().min(1, "Title is required").max(128),
  category: z.string().min(1).max(32).default("general"),
  bodyText: z.string().min(1, "Body text is required").max(4096),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

export type UpsertQuickReplyInput = z.infer<typeof upsertQuickReplySchema>

export const deleteQuickReplySchema = z.object({
  id: z.string().uuid("Invalid Quick Reply ID"),
})

export const createWhatsappBroadcastSchema = z.object({
  accountId: z.string().uuid("Account ID is required"),
  name: z.string().min(1, "Broadcast name is required").max(255),
  templateId: z.string().uuid("Template ID is required"),
  recipientPhones: z
    .array(z.string().min(5, "Invalid phone number"))
    .min(1, "At least one recipient phone number is required"),
  scheduledAt: z.string().datetime().optional().nullable(),
})

export type CreateWhatsappBroadcastInput = z.infer<
  typeof createWhatsappBroadcastSchema
>

// Webhook validation
export const metaWebhookQuerySchema = z.object({
  "hub.mode": z.string(),
  "hub.verify_token": z.string(),
  "hub.challenge": z.string(),
})

export const metaWebhookMessageStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string(),
  recipient_id: z.string().optional(),
  errors: z
    .array(
      z.object({
        code: z.number(),
        title: z.string().optional(),
        message: z.string().optional(),
        error_data: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
})

export const metaWebhookInboundMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  image: z
    .object({
      id: z.string().optional(),
      mime_type: z.string().optional(),
      sha256: z.string().optional(),
      caption: z.string().optional(),
    })
    .optional(),
  document: z
    .object({
      id: z.string().optional(),
      filename: z.string().optional(),
      mime_type: z.string().optional(),
      sha256: z.string().optional(),
      caption: z.string().optional(),
    })
    .optional(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
      list_reply: z
        .object({ id: z.string(), title: z.string(), description: z.string().optional() })
        .optional(),
    })
    .optional(),
  button: z.object({ text: z.string(), payload: z.string().optional() }).optional(),
  context: z.object({ id: z.string().optional() }).optional(),
})

export const metaWebhookChangeValueSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  metadata: z.object({
    display_phone_number: z.string().optional(),
    phone_number_id: z.string(),
  }),
  contacts: z
    .array(
      z.object({
        profile: z.object({ name: z.string().optional() }).optional(),
        wa_id: z.string(),
      })
    )
    .optional(),
  messages: z.array(metaWebhookInboundMessageSchema).optional(),
  statuses: z.array(metaWebhookMessageStatusSchema).optional(),
})

export const metaWebhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: metaWebhookChangeValueSchema,
          field: z.string(),
        })
      ),
    })
  ),
})
