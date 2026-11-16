import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Ziyarat Landmarks Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function ZiyaratRedirectPage() {
  redirect("/admin/catalog?tab=ziyarat")
}
