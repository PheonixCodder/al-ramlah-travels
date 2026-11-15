"use client"

import * as React from "react"
import { useState, useTransition, useEffect } from "react"
import {
  createStaffUser,
  resetStaffPassword,
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
  Shield,
  UserPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  UserCheck,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
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

function createRandomPassword(): string {
  const chars =
    "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*"
  let pass = ""
  for (let i = 0; i < 14; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
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
  const [bannerNotice, setBannerNotice] = useState<{
    type: "error" | "success"
    text: string
  } | null>(null)

  // New staff form state
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [newRole, setNewRole] = useState<"staff" | "super_admin">("staff")

  // Password reset dialog state
  const [resetTarget, setResetTarget] = useState<UserAccountData | null>(null)
  const [resetPasswordVal, setResetPasswordVal] = useState("")
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const [, startTransition] = useTransition()

  useEffect(() => {
    setUsers(initialUsers)
  }, [initialUsers])

  useEffect(() => {
    if (openAdd) {
      setError(null)
      setNewName("")
      setNewEmail("")
      setNewPassword("")
      setShowNewPassword(false)
      setNewRole("staff")
    }
  }, [openAdd])

  useEffect(() => {
    if (resetTarget) {
      setResetError(null)
      setResetPasswordVal("")
      setShowResetPassword(false)
    }
  }, [resetTarget])

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setBannerNotice(null)

    try {
      const res = await createStaffUser({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      })
      if (!res.success) {
        setError(res.error || "Failed to create staff account.")
        return
      }
      if (res.data) {
        setUsers((prev) => [res.data as UserAccountData, ...prev])
      }
      setOpenAdd(false)
      setBannerNotice({
        type: "success",
        text: `Provisioned staff account for ${newEmail.trim().toLowerCase()}.`,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user.")
    } finally {
      setLoading(false)
    }
  }

  function handleToggleActive(userId: string, current: boolean) {
    const next = !current
    setBannerNotice(null)
    startTransition(async () => {
      try {
        const res = await toggleUserActive(userId, next)
        if (!res.success) {
          setBannerNotice({
            type: "error",
            text: res.error || "Could not change account status.",
          })
          return
        }
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isActive: next } : u))
        )
        setBannerNotice({
          type: "success",
          text: next
            ? "Staff account reactivated."
            : "Staff account deactivated and active sessions revoked.",
        })
      } catch (err: unknown) {
        setBannerNotice({
          type: "error",
          text: err instanceof Error ? err.message : "Action failed.",
        })
      }
    })
  }

  function handleRoleChange(userId: string, role: "staff" | "super_admin") {
    setBannerNotice(null)
    startTransition(async () => {
      try {
        const res = await updateUserRole(userId, role)
        if (!res.success) {
          setBannerNotice({
            type: "error",
            text: res.error || "Could not change account role.",
          })
          return
        }
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role } : u))
        )
        setBannerNotice({
          type: "success",
          text: `Updated role to ${role.replace("_", " ")} and refreshed session permissions.`,
        })
      } catch (err: unknown) {
        setBannerNotice({
          type: "error",
          text: err instanceof Error ? err.message : "Role change failed.",
        })
      }
    })
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget) return
    setResetLoading(true)
    setResetError(null)

    try {
      const res = await resetStaffPassword({
        userId: resetTarget.id,
        newPassword: resetPasswordVal,
      })
      if (!res.success) {
        setResetError(res.error || "Failed to reset password.")
        return
      }
      const targetEmail = resetTarget.email
      setResetTarget(null)
      setBannerNotice({
        type: "success",
        text: `Temporary password set for ${targetEmail} and active sessions revoked.`,
      })
    } catch (err: unknown) {
      setResetError(
        err instanceof Error ? err.message : "Failed to reset password."
      )
    } finally {
      setResetLoading(false)
    }
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
            Manage agency consultants, Desk operators, and Super Administrator privileges. Deactivating or demoting an account immediately revokes its active sessions.
          </p>
        </div>

        {isSuperAdmin && (
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger
              render={
                <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer">
                  <UserPlus className="size-4" />
                  <span>Add Staff Account</span>
                </Button>
              }
            />
            <DialogContent
              key={openAdd ? "add-staff-open" : "add-staff-closed"}
              className="sm:max-w-md"
            >
              <DialogHeader>
                <DialogTitle>Add Staff Operator</DialogTitle>
                <DialogDescription>
                  Provision an authenticated consultant account without interrupting your current Super Admin session.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="u-password">
                      Temporary Password (min 10 chars)
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewPassword(createRandomPassword())
                        setShowNewPassword(true)
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-text hover:underline cursor-pointer"
                    >
                      <Sparkles className="size-3 text-gold" />
                      <span>Generate Strong Password</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="u-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 10 characters"
                      minLength={10}
                      required
                      className="font-mono pr-9"
                    />
                    <button
                      type="button"
                      aria-label={
                        showNewPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showNewPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
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
                    <option value="staff">
                      Staff Operator (Desk, Quotes & Inquiries)
                    </option>
                    <option value="super_admin">
                      Super Admin (Master Rates, Settings & RBAC)
                    </option>
                  </select>
                </div>

                <DialogFooter className="pt-2">
                  <DialogClose
                    render={<Button variant="outline" type="button" />}
                  >
                    Cancel
                  </DialogClose>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
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

      {bannerNotice && (
        <div
          className={
            bannerNotice.type === "error"
              ? "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
              : "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900"
          }
        >
          {bannerNotice.text}
        </div>
      )}

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
                {isSuperAdmin && (
                  <th className="px-5 py-3 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {users.map((u) => {
                const isSelf = u.id === currentUserId
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-muted/10 transition-colors"
                  >
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
                          <option value="super_admin">
                            Super Administrator
                          </option>
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
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="xs"
                            type="button"
                            onClick={() => setResetTarget(u)}
                            className="gap-1 cursor-pointer"
                          >
                            <KeyRound className="size-3" />
                            <span>Reset Password</span>
                          </Button>
                          {!isSelf && (
                            <Button
                              variant="outline"
                              size="xs"
                              type="button"
                              onClick={() =>
                                handleToggleActive(u.id, u.isActive)
                              }
                              className={
                                u.isActive
                                  ? "text-amber-700 hover:bg-amber-50 cursor-pointer"
                                  : "text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                              }
                            >
                              {u.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Reset Modal */}
      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setResetTarget(null)
        }}
      >
        <DialogContent
          key={resetTarget?.id ?? "reset-closed"}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Reset Staff Password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for{" "}
              <strong>{resetTarget?.email}</strong>. All existing active sessions for this user will be immediately terminated.
            </DialogDescription>
          </DialogHeader>

          {resetError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
              {resetError}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="u-reset-password">
                  New Temporary Password (min 10 chars)
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setResetPasswordVal(createRandomPassword())
                    setShowResetPassword(true)
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-text hover:underline cursor-pointer"
                >
                  <Sparkles className="size-3 text-gold" />
                  <span>Generate</span>
                </button>
              </div>
              <div className="relative">
                <Input
                  id="u-reset-password"
                  type={showResetPassword ? "text" : "password"}
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  minLength={10}
                  required
                  placeholder="Minimum 10 characters"
                  className="font-mono pr-9"
                />
                <button
                  type="button"
                  aria-label={
                    showResetPassword ? "Hide password" : "Show password"
                  }
                  onClick={() => setShowResetPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showResetPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                disabled={resetLoading}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                {resetLoading && <Loader2 className="size-4 animate-spin" />}
                <span>Save & Revoke Sessions</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
