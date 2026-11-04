import { redirect } from "next/navigation"

export default function HotelsRedirectPage() {
  redirect("/admin/catalog?tab=hotels")
}
