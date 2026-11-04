import { redirect } from "next/navigation"

export default function GroupsRedirectPage() {
  redirect("/admin/studio?tab=packages")
}
