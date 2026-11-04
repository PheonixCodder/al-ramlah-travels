import { redirect } from "next/navigation"

export default function FlightsRedirectPage() {
  redirect("/admin/catalog?tab=flights")
}
