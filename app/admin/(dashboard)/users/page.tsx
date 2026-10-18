import * as React from "react"
import { db } from "@/db"
import { user } from "@/db/schema"
import { desc } from "drizzle-orm"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { UsersClient, UserAccountData } from "@/components/admin/catalog/users-client"

export const metadata = {
  title: "Staff & Administrative Roles | Al Ramlah Travels Admin",
}

export default async function AdminUsersPage() {
  const session = await requireSuperAdmin()
  const allUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))

  const currentUser = session.user as { id: string; role?: string }

  return (
    <UsersClient
      initialUsers={allUsers as unknown as UserAccountData[]}
      currentUserId={currentUser.id}
      currentUserRole={currentUser.role ?? "staff"}
    />
  )
}
