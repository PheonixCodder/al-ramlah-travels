import { redirect } from "next/navigation"

export default function SupplierFlyersRedirectPage() {
  redirect("/admin/studio?tab=studio")
}
