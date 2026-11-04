import { redirect } from "next/navigation"

export default function PostLookupRedirectPage() {
  redirect("/admin/desk?lookup=1")
}
