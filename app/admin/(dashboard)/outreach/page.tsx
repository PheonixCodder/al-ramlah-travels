import { redirect } from "next/navigation"

export default function OutreachRedirectPage() {
  redirect("/admin/campaigns?tab=outreach")
}
