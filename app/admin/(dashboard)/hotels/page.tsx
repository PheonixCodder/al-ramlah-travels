import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Haramain Hotels Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function HotelsRedirectPage() {
  redirect("/admin/catalog?tab=hotels")
}
