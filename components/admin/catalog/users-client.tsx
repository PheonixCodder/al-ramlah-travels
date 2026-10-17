"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import {
  createStaffUser,
  toggleUserActive,
  updateUserRole,
} from "@/app/actions/catalog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Shield,
  ShieldAlert,
  UserPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  UserCheck,
} from "lucide-react"

export interface UserAccountData {
  id: string
  name: string
  email: string
  role: "super_admin" | "staff"
  isActive: boolean
  createdAt: Date | string
}

interface UsersClientProps {
  initialUsers: UserAccountData[]
  currentUserId: string
  currentUserRole: string
}

export function UsersClient({
  initialUsers,
  currentUserId,
  currentUserRole,
}: UsersClientProps) {
  const [users, setUsers] = useState<UserAccountData[]>(initialUsers)
  const [openAdd, setOpenAdd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New staff form state
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState<"staff" | "super_admin">("staff")

  const [isPending, startTransition] = useTransition()

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await createStaffUser({
        name: newName,
        email: newEmail,
        role: newRole,
      })
      if (res.data) {
        setUsers((prev) => [res.data as UserAccountData, ...prev])
      }
      setOpenAdd(false)
      setNewName("")
      setNewEmail("")
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to create user.")
    } finally {
      setLoading(false)
    }
  }

  function handleToggleActive(userId: string, current: boolean) {
    const next = !current
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isActive: next } : u))
    )
    startTransition(async () => {
      try {
        await toggleUserActive(userId, next)
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Action failed")
      }
    })
  }

  function handleRoleChange(userId: string, role: "staff" | "super_admin") {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u))
    )
    startTransition(async () => {
      try {
        await updateUserRole(userId, role)
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Action failed")
      }
    })
  }

  const isSuperAdmin = currentUserRole === "super_admin"

  return (
    <div className="space-y-6">
      {/* Header & Add User */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Staff & Administrative Roles
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage agency operators, quote worksheet reviewers, and super administrator privileges.
          </p>
        </div>

        {isSuperAdmin && (
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger
              render={
                <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  <UserPlus className="size-4" />
                  <span>Add Staff Account</span>
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Staff Operator</DialogTitle>
                <DialogDescription>
                  Create an administrative account for quote review and inquiry processing.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-3.5 py-2">
                <div className="space-y-1">
                  <Label htmlFor="u-name">Full Name</Label>
                  <Input
                    id="u-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Tariq Mehmood"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="u-email">Work Email</Label>
                  <Input
                    id="u-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="tariq@alramlahtravels.com"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="u-role">Role Assignment</Label>
                  <select
                    id="u-role"
                    value={newRole}
                    onChange={(e) =>
                      setNewRole(e.target.value as "staff" | "super_admin")
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
                  >
                    <option value="staff">Staff Operator (Quotes & Inquiries)</option>
                    <option value="super_admin">
                      Super Admin (Full System Access)
                    </option>
                  </select>
                </div>

                <DialogFooter className="pt-2">
                  <DialogClose render={<Button variant="outline" type="button" />}>
                    Cancel
                  </DialogClose>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    <span>Create Account</span>
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Users Table Card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">User & Email</th>
                <th className="px-5 py-3">Role Privilege</th>
                <th className="px-5 py-3">Account Status</th>
                <th className="px-5 py-3">Joined Date</th>
                {isSuperAdmin && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {users.map((u) => {
                const isSelf = u.id === currentUserId
                return (
                  <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {u.name}
                            </span>
                            {isSelf && (
                              <Badge variant="outline" className="text-[10px]">
                                You
                              </Badge>
                            )}
                          </div>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Mail className="size-3" />
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {isSuperAdmin && !isSelf ? (
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(
                              u.id,
                              e.target.value as "staff" | "super_admin"
                            )
                          }
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium shadow-xs focus-visible:outline-ring"
                        >
                          <option value="staff">Staff Operator</option>
                          <option value="super_admin">Super Administrator</option>
                        </select>
                      ) : (
                        <Badge
                          className={`capitalize text-xs ${
                            u.role === "super_admin"
                              ? "bg-amber-100 text-amber-950 border-amber-300"
                              : "bg-emerald-100 text-emerald-950 border-emerald-300"
                          }`}
                        >
                          {u.role === "super_admin" ? (
                            <Shield className="size-3 mr-1" />
                          ) : (
                            <UserCheck className="size-3 mr-1" />
                          )}
                          {u.role.replace("_", " ")}
                        </Badge>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {u.isActive ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="size-4 text-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <XCircle className="size-4" />
                          Deactivated
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs font-mono text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {isSuperAdmin && (
                      <td className="px-5 py-4 text-right">
                        {!isSelf && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleToggleActive(u.id, u.isActive)}
                            className={
                              u.isActive
                                ? "text-amber-700 hover:bg-amber-50"
                                : "text-emerald-700 hover:bg-emerald-50"
                            }
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
