import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Transport Fleet Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function TransportRedirectPage() {
  redirect("/admin/catalog?tab=transport")
}
