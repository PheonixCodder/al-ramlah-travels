import { redirect } from "next/navigation"

export default function ContentRedirectPage() {
  redirect("/admin/catalog?tab=cms")
}
