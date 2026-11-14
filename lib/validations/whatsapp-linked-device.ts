import { z } from "zod"

/**
 * Sanitizes an incoming Pakistani or international phone number for WhatsApp pairing code request.
 * - Strips all non-digit characters.
 * - Converts local Pakistani numbers (e.g. `03214629700` or `3214629700`) to E.164 without plus: `923214629700`.
 */
export function sanitizePhoneNumberForPairing(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("00")) {
    return digits.slice(2)
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `92${digits.slice(1)}`
  }
  if (!digits.startsWith("92") && digits.length === 10) {
    return `92${digits}`
  }
  return digits
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
 * Normalizes an incoming WhatsApp JID.
 * - Any JID matching /^status@broadcast(:.*)?$/ is normalized to literal "status@broadcast".
 * - If the JID lacks an "@" domain, strips non-digits and appends "@s.whatsapp.net".
 */
export function normalizeStatusJid(jid: string): string {
  const trimmed = jid.trim()
  if (/^status@broadcast(:.*)?$/.test(trimmed)) {
    return "status@broadcast"
  }
  if (!trimmed.includes("@")) {
    const digits = trimmed.replace(/\D/g, "")
    return `${digits}@s.whatsapp.net`
  }
  return trimmed
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
  const minMs = minSec * 1000
  const maxMs = maxSec * 1000
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

export const startLinkedDeviceConnectionSchema = z.object({
  sessionKey: z.string().default("default"),
  mode: z.enum(["qr", "pairing_code"]),
  phoneNumber: z.string().optional(),
})

export type StartLinkedDeviceConnectionInput = z.infer<
  typeof startLinkedDeviceConnectionSchema
>

export const disconnectLinkedDeviceSchema = z.object({
  sessionKey: z.string().default("default"),
})

export const syncRealWhatsappGroupsSchema = z.object({
  sessionKey: z.string().default("default"),
})

export const createLinkedDeviceSessionSlotSchema = z.object({
  label: z.string().min(2, "Label must be at least 2 characters").max(100),
  sessionKey: z
    .string()
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
  sessionKey: z.string().min(1, "Session key is required"),
  label: z.string().min(2, "Label must be at least 2 characters").max(100),
})

export type UpdateLinkedDeviceSessionSlotInput = z.infer<
  typeof updateLinkedDeviceSessionSlotSchema
>

export const updateLinkedDeviceSessionLabelSchema = updateLinkedDeviceSessionSlotSchema
export type UpdateLinkedDeviceSessionLabelInput = UpdateLinkedDeviceSessionSlotInput

export const deleteLinkedDeviceSessionSlotSchema = z.object({
  sessionKey: z.string().min(1, "Session key is required"),
})

export type DeleteLinkedDeviceSessionSlotInput = z.infer<
  typeof deleteLinkedDeviceSessionSlotSchema
>

export const dispatchAutomatedWhatsappGroupsCampaignSchema = z.object({
  postAssetId: z.string().uuid("Invalid Post Asset ID"),
  caption: z.string().min(1, "Caption cannot be empty"),
  channelIds: z.array(z.string().uuid()).min(1, "Select at least 1 WhatsApp channel"),
  pacingTier: z.enum(["fast", "safe", "ultra_safe"]).default("safe"),
  minDelaySec: z.number().int().min(1).max(300).optional(),
  maxDelaySec: z.number().int().min(1).max(600).optional(),
  sessionKey: z.string().default("auto"),
})

export type DispatchAutomatedWhatsappGroupsCampaignInput = z.infer<
  typeof dispatchAutomatedWhatsappGroupsCampaignSchema
>
