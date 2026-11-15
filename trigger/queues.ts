import { queue } from "@trigger.dev/sdk"

/**
 * Protects the Oracle Cloud Always Free Gotenberg Chromium instance
 * from concurrent 4K screenshot / multi-page PDF OOM spikes.
 */
export const gotenbergQueue = queue({
  name: "gotenberg-render-queue",
  concurrencyLimit: 2,
})

/**
 * Guarantees strict FIFO execution across WhatsApp template broadcasts so two
 * overlapping campaigns never interleave and violate Meta's 25–50 msg/min anti-ban pacing.
 */
export const whatsappBroadcastQueue = queue({
  name: "whatsapp-broadcast-queue",
  concurrencyLimit: 1,
})

/**
 * Bounds concurrent outbound media uploads to Instagram, Facebook, TikTok, YouTube, and GMB.
 */
export const socialPublishQueue = queue({
  name: "social-publish-queue",
  concurrencyLimit: 5,
})

/**
 * Caps concurrent multimodal Gemini / OpenRouter supplier flyer extraction runs (`T-072`).
 */
export const aiExtractionQueue = queue({
  name: "ai-extraction-queue",
  concurrencyLimit: 3,
})

/**
 * Caps concurrent AI Quoting Copilot runs so LLM rate limits and Neon pool slots stay bounded (`T-072`).
 */
export const quotingCopilotQueue = queue({
  name: "quoting-copilot-queue",
  concurrencyLimit: 3,
})

/**
 * Bounds concurrent Meta WhatsApp inbound webhook tasks (`concurrencyLimit: 10`), paired with
 * per-conversation `concurrencyKey: conversationId` at dispatch time so messages from the same
 * pilgrim execute strictly in arrival order (`T-072`).
 */
export const inboundWhatsappQueue = queue({
  name: "inbound-whatsapp-queue",
  concurrencyLimit: 10,
})

/**
 * Bounds concurrent Meta Graph media downloads & Cloudflare R2 uploads (`T-072`).
 */
export const mediaMirrorQueue = queue({
  name: "whatsapp-media-mirror-queue",
  concurrencyLimit: 5,
})

/**
 * Serializes WhatsApp Group / Status manual-assisted distribution queue transitions (`T-072`, `T-073`).
 */
export const whatsappGroupCampaignQueue = queue({
  name: "whatsapp-group-campaign-queue",
  concurrencyLimit: 1,
})

/**
 * Overlap guard (`concurrencyLimit: 1`) for scheduled maintenance, token refresh, SLA, and
 * retention cron jobs (`T-074`).
 */
export const scheduledMaintenanceQueue = queue({
  name: "scheduled-maintenance-queue",
  concurrencyLimit: 1,
})
