import { redirect } from "next/navigation"

export default function SocialRedirectPage() {
  redirect("/admin/campaigns?tab=social")
}
