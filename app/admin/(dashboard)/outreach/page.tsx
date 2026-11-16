import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "14-Day VIP Outreach Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function OutreachRedirectPage() {
  redirect("/admin/campaigns?tab=outreach")
}
