import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Supplier Flyer Studio Redirect | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

export default function SupplierFlyersRedirectPage() {
  redirect("/admin/studio?tab=studio")
}
