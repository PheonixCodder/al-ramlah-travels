import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Website CMS & FAQs Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function ContentRedirectPage() {
  redirect("/admin/catalog?tab=cms")
}
