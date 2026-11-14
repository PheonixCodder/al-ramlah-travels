import { queue } from "@trigger.dev/sdk"

/**
 * Protects the Oracle Cloud Always Free Gotenberg Chromium instance (1GB–2GB RAM)
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
