import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderLuxuryOgCard,
} from "@/lib/seo/og-card"

export const alt =
  "Al Ramlah Travels — Umrah Packages Pakistan, Saudi E-Visas & Hajj 2027"
export const size = OG_IMAGE_SIZE
export const contentType = OG_IMAGE_CONTENT_TYPE

export default function OpenGraphImage() {
  return renderLuxuryOgCard({
    eyebrow: "Where Purpose Meets Excellence",
    title: "Umrah Packages Pakistan & Hajj 2027 Concierge",
    subtitle:
      "Fixed-departure group batches from Lahore, Karachi & Islamabad, custom 5-pillar Haramain itineraries, and Saudi Umrah e-visas in PKR.",
    badges: [
      "Lahore Cantt HQ",
      "LHE · KHI · ISB Departures",
      "Courtyard & Shuttle Hotels",
      "Hajj 2027 Pre-Registration",
    ],
  })
}
