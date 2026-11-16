import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Staff Role Accounts Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function UsersRedirectPage() {
  redirect("/admin/settings?tab=staff")
}
