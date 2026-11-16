import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Airlines & Gateways Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function FlightsRedirectPage() {
  redirect("/admin/catalog?tab=flights")
}
