import { redirect } from "next/navigation"

export default function TransportRedirectPage() {
  redirect("/admin/catalog?tab=transport")
}
