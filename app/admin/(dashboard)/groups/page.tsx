import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Group Packages Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function GroupsRedirectPage() {
  redirect("/admin/studio?tab=packages")
}
