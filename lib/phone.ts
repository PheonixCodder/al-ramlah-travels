/**
 * Shared phone normalization and formatting utilities.
 * Usable across both Server Components and Client Components (isomorphic).
 */

/**
 * Formats a raw phone string into a clean numeric string for WhatsApp links (`https://wa.me/{number}`)
 * and Meta API calls, normalizing common Pakistani and international formats:
 * - Strips all non-digit characters.
 * - Strips leading "00" from international dialing codes (e.g. "0092..." -> "92...", "00966..." -> "966...").
 * - Converts national mobile format "03xx..." (11 digits) to E.164 without plus: "923xx...".
 */
export function formatWhatsAppPhone(raw: string | null | undefined): string {
  if (!raw) return ""
  let cleaned = raw.replace(/\D/g, "")
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2)
  }
  if (cleaned.startsWith("03") && cleaned.length === 11) {
    cleaned = `92${cleaned.slice(1)}`
  }
  return cleaned
}
