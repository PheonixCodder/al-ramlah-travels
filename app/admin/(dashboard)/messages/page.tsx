import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Contact Inquiries Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function MessagesRedirectPage() {
  redirect("/admin/catalog?tab=messages")
}
