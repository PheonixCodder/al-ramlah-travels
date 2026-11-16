import { z } from "zod"
import { formatWhatsAppPhone, parsePhoneE164, toWhatsappJid } from "../phone"

/**
 * Sanitizes an incoming Pakistani or international phone number for WhatsApp pairing code request (`T-049`):
 * - Delegates to `@/lib/phone` E.164 SSoT.
 * - Converts local Pakistani numbers (`03214629700` or `3214629700`) to `923214629700`.
 * - Preserves international numbers (`+44 (0) 7911 123456` -> `447911123456`, `+1 (555) 123-4567` -> `15551234567`, `+966 50 123 4567` -> `966501234567`).
 * - Returns `""` on empty/non-phone inputs.
 */
export function sanitizePhoneNumberForPairing(phone: string): string {
  if (!phone || typeof phone !== "string") return ""
  return formatWhatsAppPhone(phone)
}

/**
 * Formats an 8-character pairing code into a user-friendly `XXXX-XXXX` string.
 */
export function formatPairingCode(code: string): string {
  const clean = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`
  }
  return code
}

/**
 * Normalizes an incoming WhatsApp JID (`T-049`):
 * - Any JID matching `/^status@broadcast(:.*)?$/i` is normalized to literal `"status@broadcast"`.
 * - Group/channel/LID JIDs (`@g.us`, `@newsletter`, `@lid`) are preserved cleanly.
 * - Direct user JIDs (`@s.whatsapp.net`) and bare phone numbers are normalized through E.164 SSoT
 *   (e.g. `"0327-4029701"` -> `"923274029701@s.whatsapp.net"`).
 */
export function normalizeStatusJid(jid: string): string {
  return toWhatsappJid(jid)
}

/**
 * Pacing delay ranges in seconds for ban-safe humanized broadcasting.
 */
export const PACING_TIERS = {
  fast: { minSec: 10, maxSec: 20, label: "Fast (10–20s) — Best for 3–5 VIP Groups" },
  safe: { minSec: 25, maxSec: 45, label: "Safe (25–45s) — Recommended Daily Schedule" },
  ultra_safe: { minSec: 45, maxSec: 90, label: "Ultra-Safe (45–90s) — For 30+ Groups" },
} as const

export type PacingTier = keyof typeof PACING_TIERS

export function getPacingDelayRange(
  tier: PacingTier = "safe",
  minOverride?: number,
  maxOverride?: number
): { minSec: number; maxSec: number } {
  if (minOverride && maxOverride && maxOverride >= minOverride) {
    return { minSec: minOverride, maxSec: maxOverride }
  }
  const preset = PACING_TIERS[tier] || PACING_TIERS.safe
  return { minSec: preset.minSec, maxSec: preset.maxSec }
}

export function getRandomPacingDelayMs(minSec: number, maxSec: number): number {
  const safeMin = Math.max(0, Math.floor(minSec))
  const safeMax = Math.max(safeMin, Math.floor(maxSec))
  const minMs = safeMin * 1000
  const maxMs = safeMax * 1000
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

export const startLinkedDeviceConnectionSchema = z
  .object({
    sessionKey: z.string().trim().min(1).max(64).default("default"),
    mode: z.enum(["qr", "pairing_code"]),
    phoneNumber: z.string().trim().max(32).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "pairing_code") {
      const parsed = parsePhoneE164(data.phoneNumber)
      if (!parsed.valid || parsed.nationalDigits.length < 9) {
        ctx.addIssue({
          code: "custom",
          path: ["phoneNumber"],
          message:
            "A valid Pakistani or international E.164 phone number is required for pairing code mode",
        })
      }
    }
  })

export type StartLinkedDeviceConnectionInput = z.infer<
  typeof startLinkedDeviceConnectionSchema
>

export const disconnectLinkedDeviceSchema = z.object({
  sessionKey: z.string().trim().min(1).max(64).default("default"),
})

export const syncRealWhatsappGroupsSchema = z.object({
  sessionKey: z.string().trim().min(1).max(64).default("default"),
})

export const createLinkedDeviceSessionSlotSchema = z.object({
  label: z.string().trim().min(2, "Label must be at least 2 characters").max(100),
  sessionKey: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(
      /^[a-z0-9_-]+$/,
      "Session key can only contain lowercase letters, numbers, hyphens, and underscores"
    )
    .optional(),
})

export type CreateLinkedDeviceSessionSlotInput = z.infer<
  typeof createLinkedDeviceSessionSlotSchema
>

export const updateLinkedDeviceSessionSlotSchema = z.object({
  sessionKey: z.string().trim().min(1, "Session key is required").max(64),
  label: z.string().trim().min(2, "Label must be at least 2 characters").max(100),
})

export type UpdateLinkedDeviceSessionSlotInput = z.infer<
  typeof updateLinkedDeviceSessionSlotSchema
>

export const updateLinkedDeviceSessionLabelSchema = updateLinkedDeviceSessionSlotSchema
export type UpdateLinkedDeviceSessionLabelInput = UpdateLinkedDeviceSessionSlotInput

export const deleteLinkedDeviceSessionSlotSchema = z.object({
  sessionKey: z.string().trim().min(1, "Session key is required").max(64),
})

export type DeleteLinkedDeviceSessionSlotInput = z.infer<
  typeof deleteLinkedDeviceSessionSlotSchema
>

export const dispatchAutomatedWhatsappGroupsCampaignSchema = z
  .object({
    postAssetId: z.string().uuid("Invalid Post Asset ID"),
    caption: z.string().trim().min(1, "Caption cannot be empty").max(4096),
    channelIds: z
      .array(z.string().uuid())
      .min(1, "Select at least 1 WhatsApp channel")
      .max(200),
    pacingTier: z.enum(["fast", "safe", "ultra_safe"]).default("safe"),
    minDelaySec: z.number().int().min(1).max(300).optional(),
    maxDelaySec: z.number().int().min(1).max(600).optional(),
    sessionKey: z.string().trim().min(1).max(64).default("auto"),
  })
  .superRefine((data, ctx) => {
    if (
      data.minDelaySec !== undefined &&
      data.maxDelaySec !== undefined &&
      data.maxDelaySec < data.minDelaySec
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxDelaySec"],
        message: "maxDelaySec must be greater than or equal to minDelaySec",
      })
    }
  })

export type DispatchAutomatedWhatsappGroupsCampaignInput = z.infer<
  typeof dispatchAutomatedWhatsappGroupsCampaignSchema
>
