import { redirect } from "next/navigation"

export default function MessagesRedirectPage() {
  redirect("/admin/desk?tab=inbox")
}
