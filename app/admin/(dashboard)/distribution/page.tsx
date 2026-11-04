import { redirect } from "next/navigation"

export default function DistributionRedirectPage() {
  redirect("/admin/campaigns?tab=social")
}
