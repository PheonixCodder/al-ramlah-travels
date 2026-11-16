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
  accessToken: z.string().optional(),
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
  autoReplyEnabled: z.boolean().optional(),
  autoReplyCooldownMinutes: z.number().int().min(0).max(10080).optional(),
  accountRole: z
    .enum(["COEXISTENCE_FOUNDER", "DEDICATED_AGENT", "PRIMARY_CLOUD"])
    .optional(),
  isOnBizApp: z.boolean().optional(),
  intentFilterEnabled: z.boolean().optional(),
  embeddedSignupConfigId: z.string().max(128).optional().nullable(),
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
    headerMediaUrl: z
      .string()
      .url("Valid header media URL required")
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v && v.trim() ? v.trim() : null)),
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
  accountId: z.string().uuid("Invalid Account ID").optional(),
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
export const upsertWhatsappQuickReplySchema = upsertQuickReplySchema
export type UpsertWhatsappQuickReplyInput = UpsertQuickReplyInput

export const deleteQuickReplySchema = z.object({
  id: z.string().uuid("Invalid Quick Reply ID"),
})

export const deleteWhatsappQuickReplySchema = deleteQuickReplySchema
export type DeleteWhatsappQuickReplyInput = z.infer<typeof deleteQuickReplySchema>

export const broadcastRecipientItemSchema = z.object({
  phone: z.string().min(5, "Invalid phone number"),
  name: z.string().optional().nullable(),
  templateParams: z
    .union([z.array(z.string()), z.record(z.string(), z.unknown())])
    .optional(),
})

export type BroadcastRecipientItemInput = z.infer<
  typeof broadcastRecipientItemSchema
>

export const createWhatsappBroadcastSchema = z
  .object({
    accountId: z.string().uuid("Account ID is required"),
    name: z.string().min(1, "Broadcast name is required").max(255),
    templateId: z.string().uuid("Template ID is required"),
    recipientPhones: z
      .array(z.string().min(5, "Invalid phone number"))
      .optional()
      .default([]),
    recipients: z.array(broadcastRecipientItemSchema).optional().default([]),
    csvText: z.string().optional().nullable(),
    headerMediaUrl: z
      .string()
      .url("Valid media URL required")
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    defaultTemplateParams: z
      .union([z.array(z.string()), z.record(z.string(), z.unknown())])
      .optional()
      .default({}),
    scheduledAt: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) =>
      (Array.isArray(data.recipientPhones) && data.recipientPhones.length > 0) ||
      (Array.isArray(data.recipients) && data.recipients.length > 0) ||
      (typeof data.csvText === "string" && data.csvText.trim().length > 0),
    {
      message: "At least one recipient phone, recipient list, or CSV text is required",
      path: ["recipientPhones"],
    }
  )

export type CreateWhatsappBroadcastInput = z.infer<
  typeof createWhatsappBroadcastSchema
>

// ==========================================
// Phase 3 (Spec 0019): Conversation Pin, Archive, Assignment & Internal Notes
// ==========================================

export const toggleWhatsappConversationPinSchema = z.object({
  conversationId: z.string().uuid("Invalid Conversation ID"),
  isPinned: z.boolean(),
})

export type ToggleWhatsappConversationPinInput = z.infer<
  typeof toggleWhatsappConversationPinSchema
>

export const toggleWhatsappConversationArchiveSchema = z.object({
  conversationId: z.string().uuid("Invalid Conversation ID"),
  isArchived: z.boolean(),
})

export type ToggleWhatsappConversationArchiveInput = z.infer<
  typeof toggleWhatsappConversationArchiveSchema
>

export const assignWhatsappConversationAgentSchema = z.object({
  conversationId: z.string().uuid("Invalid Conversation ID"),
  assignedUserId: z
    .string()
    .min(1)
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v && v.trim() ? v.trim() : null)),
})

export type AssignWhatsappConversationAgentInput = z.infer<
  typeof assignWhatsappConversationAgentSchema
>

export const addWhatsappConversationInternalNoteSchema = z.object({
  conversationId: z.string().uuid("Invalid Conversation ID"),
  note: z
    .string()
    .trim()
    .min(1, "Note cannot be empty")
    .max(2000, "Note max 2000 characters"),
})

export type AddWhatsappConversationInternalNoteInput = z.infer<
  typeof addWhatsappConversationInternalNoteSchema
>

export const retryFailedWhatsappBroadcastSchema = z.object({
  broadcastId: z.string().uuid("Invalid Broadcast ID"),
})

export type RetryFailedWhatsappBroadcastInput = z.infer<
  typeof retryFailedWhatsappBroadcastSchema
>

export const getWhatsappBroadcastDetailsSchema = z.object({
  broadcastId: z.string().uuid("Invalid Broadcast ID"),
})

export type GetWhatsappBroadcastDetailsInput = z.infer<
  typeof getWhatsappBroadcastDetailsSchema
>

// ==========================================
// Phase 2: Interactive Buttons & List Menus
// ==========================================

export const interactiveReplyButtonSchema = z.object({
  id: z.string().min(1, "Button ID is required").max(256, "Button ID max 256 chars"),
  title: z
    .string()
    .min(1, "Button title is required")
    .max(20, "Meta enforces max 20 characters for reply button title"),
})

export type InteractiveReplyButtonInput = z.infer<typeof interactiveReplyButtonSchema>

export const sendInteractiveButtonsSchema = z
  .object({
    conversationId: z.string().uuid("Invalid Conversation ID"),
    headerText: z.string().max(60, "Header text max 60 characters").optional(),
    bodyText: z
      .string()
      .min(1, "Body text is required")
      .max(1024, "Body text max 1024 characters"),
    footerText: z.string().max(60, "Footer text max 60 characters").optional(),
    buttons: z
      .array(interactiveReplyButtonSchema)
      .min(1, "At least 1 button is required")
      .max(3, "Meta allows at most 3 reply buttons per message"),
    contextMessageId: z.string().optional(),
  })
  .refine(
    (data) => {
      const ids = data.buttons.map((b) => b.id.trim())
      return new Set(ids).size === ids.length
    },
    { message: "Interactive button IDs must be unique", path: ["buttons"] }
  )

export type SendInteractiveButtonsInput = z.infer<typeof sendInteractiveButtonsSchema>

export const interactiveListRowSchema = z.object({
  id: z.string().min(1, "Row ID is required").max(200, "Row ID max 200 characters"),
  title: z
    .string()
    .min(1, "Row title is required")
    .max(24, "Meta enforces max 24 characters for list row title"),
  description: z
    .string()
    .max(72, "Meta enforces max 72 characters for list row description")
    .optional(),
})

export type InteractiveListRowInput = z.infer<typeof interactiveListRowSchema>

export const interactiveListSectionSchema = z.object({
  title: z
    .string()
    .min(1, "Section title is required")
    .max(24, "Meta enforces max 24 characters for section title"),
  rows: z.array(interactiveListRowSchema).min(1, "Section must have at least 1 row"),
})

export type InteractiveListSectionInput = z.infer<typeof interactiveListSectionSchema>

export const sendInteractiveListSchema = z
  .object({
    conversationId: z.string().uuid("Invalid Conversation ID"),
    headerText: z.string().max(60, "Header text max 60 characters").optional(),
    bodyText: z
      .string()
      .min(1, "Body text is required")
      .max(1024, "Body text max 1024 characters"),
    footerText: z.string().max(60, "Footer text max 60 characters").optional(),
    buttonText: z
      .string()
      .min(1, "Button text is required")
      .max(20, "Meta enforces max 20 characters for list menu button text"),
    sections: z
      .array(interactiveListSectionSchema)
      .min(1, "At least 1 section is required")
      .max(10, "Maximum 10 sections allowed"),
    contextMessageId: z.string().optional(),
  })
  .refine(
    (data) => {
      const totalRows = data.sections.reduce((acc, s) => acc + s.rows.length, 0)
      return totalRows >= 1 && totalRows <= 10
    },
    {
      message: "Interactive list message must contain between 1 and 10 total rows across all sections",
      path: ["sections"],
    }
  )

export type SendInteractiveListInput = z.infer<typeof sendInteractiveListSchema>

// ==========================================
// Phase 2: Reactions, Read Receipts & Auto-Responder Toggle
// ==========================================

export const sendWhatsappReactionSchema = z.object({
  conversationId: z.string().uuid("Invalid Conversation ID"),
  messageId: z.string().min(1, "Target WABA message ID is required"),
  emoji: z.string().max(16, "Invalid emoji"),
})

export type SendWhatsappReactionInput = z.infer<typeof sendWhatsappReactionSchema>

export const markConversationAsReadSchema = z.object({
  conversationId: z.string().uuid("Invalid Conversation ID"),
  messageId: z.string().optional(),
})

export type MarkConversationAsReadInput = z.infer<typeof markConversationAsReadSchema>

export const toggleWhatsappAutoResponderSchema = z.object({
  accountId: z.string().uuid("Invalid Account ID").optional(),
  enabled: z.boolean(),
  cooldownMinutes: z.number().int().min(0).max(10080).optional(),
})

export type ToggleWhatsappAutoResponderInput = z.infer<
  typeof toggleWhatsappAutoResponderSchema
>

export const triggerManualMediaMirrorSchema = z.object({
  messageId: z.string().uuid("Invalid Message ID"),
})

export type TriggerManualMediaMirrorInput = z.infer<
  typeof triggerManualMediaMirrorSchema
>

// ==========================================
// Phase 2: Meta Template Lifecycle Creation & Deletion
// ==========================================

export const metaTemplateButtonSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("QUICK_REPLY"),
    text: z.string().min(1).max(25),
  }),
  z.object({
    type: z.literal("URL"),
    text: z.string().min(1).max(25),
    url: z.string().url(),
  }),
  z.object({
    type: z.literal("PHONE_NUMBER"),
    text: z.string().min(1).max(25),
    phone_number: z.string().min(5).max(24),
  }),
])

export const createWhatsappTemplateSchema = z.object({
  accountId: z.string().uuid("Invalid Account ID").optional(),
  name: z
    .string()
    .min(1, "Template name is required")
    .max(512)
    .regex(
      /^[a-z0-9_]+$/,
      "Template name must contain only lowercase letters, numbers, and underscores"
    ),
  language: z.string().min(2).max(16).default("en_US"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("MARKETING"),
  headerText: z.string().max(60).optional(),
  bodyText: z.string().min(1, "Template body text is required").max(1024),
  footerText: z.string().max(60).optional(),
  buttons: z.array(metaTemplateButtonSchema).max(10).optional(),
})

export type CreateWhatsappTemplateInput = z.infer<typeof createWhatsappTemplateSchema>

export const deleteWhatsappTemplateSchema = z.object({
  accountId: z.string().uuid("Invalid Account ID").optional(),
  templateId: z.string().uuid("Invalid Template ID").optional(),
  name: z
    .string()
    .min(1, "Template name is required")
    .regex(/^[a-z0-9_]+$/, "Template name must be lowercase alphanumeric and underscores")
    .optional(),
})

export type DeleteWhatsappTemplateInput = z.infer<typeof deleteWhatsappTemplateSchema>

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
  audio: z
    .object({
      id: z.string().optional(),
      mime_type: z.string().optional(),
      sha256: z.string().optional(),
      voice: z.boolean().optional(),
    })
    .optional(),
  video: z
    .object({
      id: z.string().optional(),
      mime_type: z.string().optional(),
      sha256: z.string().optional(),
      caption: z.string().optional(),
    })
    .optional(),
  sticker: z
    .object({
      id: z.string().optional(),
      mime_type: z.string().optional(),
      sha256: z.string().optional(),
      animated: z.boolean().optional(),
    })
    .optional(),
  reaction: z
    .object({
      message_id: z.string(),
      emoji: z.string().optional(),
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
  messaging_product: z.literal("whatsapp").optional(),
  metadata: z
    .object({
      display_phone_number: z.string().optional(),
      phone_number_id: z.string(),
    })
    .optional(),
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
  event: z.string().optional(),
  message_template_id: z.union([z.string(), z.number()]).optional(),
  message_template_name: z.string().optional(),
  message_template_language: z.string().optional(),
  reason: z.string().nullable().optional(),
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

// ==========================================
// Slice 36 (Spec 0017): Custom Keyword Auto-Reply Rules & Greeting Settings
// ==========================================

export const whatsappAutoReplyMatchTypeSchema = z.enum([
  "CONTAINS",
  "EXACT",
  "STARTS_WITH",
  "REGEX",
])

export type WhatsappAutoReplyMatchTypeInput = z.infer<
  typeof whatsappAutoReplyMatchTypeSchema
>

export const upsertWhatsappAutoReplyRuleSchema = z.object({
  id: z.string().uuid("Invalid Rule ID").optional(),
  accountId: z.string().uuid("Invalid Account ID").optional().nullable(),
  name: z
    .string()
    .trim()
    .min(1, "Rule name is required")
    .max(120, "Rule name max 120 characters"),
  matchType: whatsappAutoReplyMatchTypeSchema.default("CONTAINS"),
  keywords: z
    .array(z.string().trim().min(1, "Keyword cannot be empty"))
    .min(1, "At least one keyword is required"),
  responseText: z
    .string()
    .trim()
    .min(1, "Response text is required")
    .max(4096, "Response text max 4096 characters"),
  mediaUrl: z
    .string()
    .url("Valid media URL required")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  mediaFilename: z
    .string()
    .max(128)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  interactiveButtons: z
    .array(interactiveReplyButtonSchema)
    .max(3, "Meta allows at most 3 reply buttons per message")
    .optional()
    .default([]),
  priority: z.number().int().min(0).max(10000).default(50),
  cooldownMinutes: z.number().int().min(0).max(10080).default(60),
  isActive: z.boolean().default(true),
})

export type UpsertWhatsappAutoReplyRuleInput = z.infer<
  typeof upsertWhatsappAutoReplyRuleSchema
>

export const deleteWhatsappAutoReplyRuleSchema = z.object({
  id: z.string().uuid("Invalid Rule ID"),
})

export type DeleteWhatsappAutoReplyRuleInput = z.infer<
  typeof deleteWhatsappAutoReplyRuleSchema
>

export const toggleWhatsappAutoReplyRuleSchema = z.object({
  id: z.string().uuid("Invalid Rule ID"),
  isActive: z.boolean(),
})

export type ToggleWhatsappAutoReplyRuleInput = z.infer<
  typeof toggleWhatsappAutoReplyRuleSchema
>

export const updateWhatsappGreetingSettingsSchema = z.object({
  accountId: z.string().uuid("Invalid Account ID").optional(),
  autoReplyEnabled: z.boolean().default(true),
  autoReplyCooldownMinutes: z.number().int().min(0).max(10080).default(60),
  welcomeGreetingEnabled: z.boolean().default(true),
  welcomeGreetingText: z.string().max(4096).optional().nullable(),
  awayGreetingEnabled: z.boolean().default(true),
  awayGreetingText: z.string().max(4096).optional().nullable(),
  businessHoursStart: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):([0-5]\d)$/,
      "Start time must be in HH:MM 24-hour format (e.g. 09:00)"
    )
    .default("09:00"),
  businessHoursEnd: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):([0-5]\d)$/,
      "End time must be in HH:MM 24-hour format (e.g. 21:00)"
    )
    .default("21:00"),
})

export type UpdateWhatsappGreetingSettingsInput = z.infer<
  typeof updateWhatsappGreetingSettingsSchema
>

