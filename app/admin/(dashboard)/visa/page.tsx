import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Saudi Visa Tariffs Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function VisaRedirectPage() {
  redirect("/admin/catalog?tab=visa")
}
