import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Core 5 Social Hub Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function SocialRedirectPage() {
  redirect("/admin/campaigns?tab=social")
}
