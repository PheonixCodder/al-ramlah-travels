import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "WhatsApp Queue Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function DistributionRedirectPage() {
  redirect("/admin/campaigns?tab=whatsapp")
}
