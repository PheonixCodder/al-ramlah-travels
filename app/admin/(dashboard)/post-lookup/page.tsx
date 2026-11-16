import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Post Reverse-Lookup Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function PostLookupRedirectPage() {
  redirect("/admin/desk?lookup=1")
}
