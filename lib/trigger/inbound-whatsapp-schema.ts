import { z } from "zod"

export const processInboundWhatsappPayloadSchema = z.object({
  messageId: z.string().min(1, "messageId is required"),
  accountId: z.string().min(1, "accountId is required"),
  conversationId: z.string().min(1, "conversationId is required"),
  senderPhone: z.string().min(1, "senderPhone is required"),
  contactDisplayName: z.string().optional(),
  wamid: z.string().min(1, "wamid is required"),
  bodyText: z.string(),
  msgType: z.string(),
  rawMediaId: z.string().nullable().optional(),
  mediaMimeType: z.string().nullable().optional(),
  interactiveReplyId: z.string().nullable().optional(),
  detectedPostCode: z.string().nullable().optional(),
  linkedApplicationId: z.string().nullable().optional(),
  outreachContactId: z.string().nullable().optional(),
})

export type ProcessInboundWhatsappPayload = z.infer<
  typeof processInboundWhatsappPayloadSchema
>

export interface ProcessInboundWhatsappResult {
  success: boolean
  messageId: string
  conversationId: string
  mediaMirrored: boolean
  mediaUrl?: string
  intentCategory?: string
  intentConfidence?: number
  autoReplyTriggered: boolean
  autoReplyRuleId?: string
  error?: string
}
