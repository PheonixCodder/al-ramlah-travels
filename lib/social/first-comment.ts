export interface ArtFirstCommentPlugInput {
  postCode: string
  title?: string | null
  quadPricePkr?: number | null
  triplePricePkr?: number | null
  doublePricePkr?: number | null
  sharingPricePkr?: number | null
  makkahHotelName?: string | null
  madinahHotelName?: string | null
  whatsappNumber?: string | null
}

function formatPkr(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString("en-US")}`
}

function normalizeWhatsappDigits(raw?: string | null): string {
  const cleaned = (raw || "923274029701").replace(/\D/g, "")
  if (cleaned.startsWith("03") && cleaned.length === 11) {
    return `92${cleaned.slice(1)}`
  }
  return cleaned || "923274029701"
}

/**
 * Builds a high-converting First-Comment auto-plug containing the package's ART-... reference code,
 * Quad/Triple/Double PKR pricing, optional hotel summary, and a 1-tap WhatsApp click-to-chat inquiry URL.
 */
export function buildArtFirstCommentPlug(
  input: ArtFirstCommentPlugInput
): string {
  const rawCode = input.postCode.trim()
  const normalizedCode = rawCode.toUpperCase().startsWith("ART-")
    ? rawCode
    : `ART-${rawCode}`

  const lines: string[] = []

  const headerTitle = input.title?.trim()
    ? `🕋 ${input.title.trim()} — Ref: ${normalizedCode}`
    : `🕋 Instant Package Inquiry — Ref: ${normalizedCode}`
  lines.push(headerTitle)

  const rateParts: string[] = []
  if (typeof input.sharingPricePkr === "number" && input.sharingPricePkr > 0) {
    rateParts.push(`Sharing: ${formatPkr(input.sharingPricePkr)}`)
  }
  if (typeof input.quadPricePkr === "number" && input.quadPricePkr > 0) {
    rateParts.push(`Quad: ${formatPkr(input.quadPricePkr)}`)
  }
  if (typeof input.triplePricePkr === "number" && input.triplePricePkr > 0) {
    rateParts.push(`Triple: ${formatPkr(input.triplePricePkr)}`)
  }
  if (typeof input.doublePricePkr === "number" && input.doublePricePkr > 0) {
    rateParts.push(`Double: ${formatPkr(input.doublePricePkr)}`)
  }

  if (rateParts.length > 0) {
    lines.push(`💰 ${rateParts.join(" | ")}`)
  }

  const hotelParts: string[] = []
  if (input.makkahHotelName?.trim()) {
    hotelParts.push(`Makkah: ${input.makkahHotelName.trim()}`)
  }
  if (input.madinahHotelName?.trim()) {
    hotelParts.push(`Madinah: ${input.madinahHotelName.trim()}`)
  }
  if (hotelParts.length > 0) {
    lines.push(`🏨 ${hotelParts.join(" • ")}`)
  }

  const phone = normalizeWhatsappDigits(input.whatsappNumber)
  const prefillText = `Assalamu Alaikum Al Ramlah Travels, I want details for package ${normalizedCode}`
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(prefillText)}`

  lines.push(`📲 Tap here for instant 3-page PDF itinerary & booking on WhatsApp:`)
  lines.push(waUrl)

  return lines.join("\n")
}
