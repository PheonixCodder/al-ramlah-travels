import { redirect } from "next/navigation"

export default function ZiyaratRedirectPage() {
  redirect("/admin/catalog?tab=ziyarat")
}
