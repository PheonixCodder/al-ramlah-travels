"use client"

import * as React from "react"
import { useState, useTransition } from "react"
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

const TEMP_PASSWORD_ALPHABET =
  "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*"
const TEMP_PASSWORD_LENGTH = 14

export function createRandomPassword(): string {
  const alphabetLen = TEMP_PASSWORD_ALPHABET.length
  const maxUnbiased = 0x1_0000_0000 - (0x1_0000_0000 % alphabetLen)
  const buf = new Uint32Array(1)
  let pass = ""
  while (pass.length < TEMP_PASSWORD_LENGTH) {
    crypto.getRandomValues(buf)
    const sample = buf[0]
    if (sample !== undefined && sample < maxUnbiased) {
      pass += TEMP_PASSWORD_ALPHABET.charAt(sample % alphabetLen)
    }
  }
  return pass
}

function AddStaffFormBody({
  onCreated,
  onCancel,
}: {
  onCreated: (user: UserAccountData | undefined, email: string) => void
  onCancel: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [newRole, setNewRole] = useState<"staff" | "super_admin">("staff")

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

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
      onCreated(
        res.data ? (res.data as UserAccountData) : undefined,
        newEmail.trim().toLowerCase()
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Staff Operator</DialogTitle>
        <DialogDescription>
          Provision an authenticated consultant account without interrupting
          your current Super Admin session.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
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
              className="inline-flex cursor-pointer items-center gap-1 rounded text-[11px] font-semibold text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Sparkles className="size-3 text-gold-text" aria-hidden="true" />
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
              className="pr-9 font-mono"
            />
            <button
              type="button"
              aria-label={showNewPassword ? "Hide password" : "Show password"}
              onClick={() => setShowNewPassword((v) => !v)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {showNewPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
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
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="staff">
              Staff Operator (Desk, Quotes &amp; Inquiries)
            </option>
            <option value="super_admin">
              Super Admin (Master Rates, Settings &amp; RBAC)
            </option>
          </select>
        </div>

        <DialogFooter className="pt-2">
          <DialogClose
            render={
              <Button variant="outline" type="button" onClick={onCancel} />
            }
          >
            Cancel
          </DialogClose>
          <Button
            type="submit"
            disabled={loading}
            className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {loading && (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>Create Account</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function ResetPasswordFormBody({
  target,
  onSuccess,
}: {
  target: UserAccountData
  onSuccess: (email: string) => void
}) {
  const [resetPasswordVal, setResetPasswordVal] = useState("")
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setResetLoading(true)
    setResetError(null)

    try {
      const res = await resetStaffPassword({
        userId: target.id,
        newPassword: resetPasswordVal,
      })
      if (!res.success) {
        setResetError(res.error || "Failed to reset password.")
        return
      }
      onSuccess(target.email)
    } catch (err: unknown) {
      setResetError(
        err instanceof Error ? err.message : "Failed to reset password."
      )
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reset Staff Password</DialogTitle>
        <DialogDescription>
          Set a new temporary password for <strong>{target.email}</strong>. All
          existing active sessions for this user will be immediately terminated.
        </DialogDescription>
      </DialogHeader>

      {resetError && (
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
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
              className="inline-flex cursor-pointer items-center gap-1 rounded text-[11px] font-semibold text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Sparkles className="size-3 text-gold-text" aria-hidden="true" />
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
              className="pr-9 font-mono"
            />
            <button
              type="button"
              aria-label={showResetPassword ? "Hide password" : "Show password"}
              onClick={() => setShowResetPassword((v) => !v)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {showResetPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
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
            className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {resetLoading && (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>Save &amp; Revoke Sessions</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function UsersClient({
  initialUsers,
  currentUserId,
  currentUserRole,
}: UsersClientProps) {
  const [users, setUsers] = useState<UserAccountData[]>(initialUsers)
  const [prevInitialUsers, setPrevInitialUsers] = useState(initialUsers)
  if (prevInitialUsers !== initialUsers) {
    setPrevInitialUsers(initialUsers)
    setUsers(initialUsers)
  }

  const [openAdd, setOpenAdd] = useState(false)
  const [addFormSession, setAddFormSession] = useState(0)
  const [bannerNotice, setBannerNotice] = useState<{
    type: "error" | "success"
    text: string
  } | null>(null)

  const [resetTarget, setResetTarget] = useState<UserAccountData | null>(null)
  const [, startTransition] = useTransition()

  function handleOpenAddChange(nextOpen: boolean) {
    if (nextOpen) {
      setAddFormSession((prev) => prev + 1)
      setBannerNotice(null)
    }
    setOpenAdd(nextOpen)
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

  const isSuperAdmin = currentUserRole === "super_admin"

  return (
    <div className="space-y-6">
      {/* Header & Add User */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Staff &amp; Administrative Roles
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage agency consultants, Desk operators, and Super Administrator
            privileges. Deactivating or demoting an account immediately revokes
            its active sessions.
          </p>
        </div>

        {isSuperAdmin && (
          <Dialog open={openAdd} onOpenChange={handleOpenAddChange}>
            <DialogTrigger
              render={
                <Button className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <UserPlus className="size-4" aria-hidden="true" />
                  <span>Add Staff Account</span>
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <AddStaffFormBody
                key={`add-staff-${addFormSession}`}
                onCreated={(createdUser, email) => {
                  if (createdUser) {
                    setUsers((prev) => [createdUser, ...prev])
                  }
                  setOpenAdd(false)
                  setBannerNotice({
                    type: "success",
                    text: `Provisioned staff account for ${email}.`,
                  })
                }}
                onCancel={() => setOpenAdd(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {bannerNotice && (
        <div
          className={
            bannerNotice.type === "error"
              ? "rounded-xl border border-status-danger-border bg-status-danger-bg px-4 py-3 text-xs text-status-danger"
              : "rounded-xl border border-status-success-border bg-status-success-bg px-4 py-3 text-xs text-status-success"
          }
        >
          {bannerNotice.text}
        </div>
      )}

      {/* Users Table Card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div
          tabIndex={0}
          className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-5 py-3">User &amp; Email</th>
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
                    className="transition-colors hover:bg-muted/10 motion-reduce:transition-none"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
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
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="size-3" aria-hidden="true" />
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {isSuperAdmin && !isSelf ? (
                        <select
                          aria-label={`Role for ${u.name}`}
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(
                              u.id,
                              e.target.value as "staff" | "super_admin"
                            )
                          }
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <option value="staff">Staff Operator</option>
                          <option value="super_admin">
                            Super Administrator
                          </option>
                        </select>
                      ) : (
                        <Badge
                          className={`text-xs capitalize ${
                            u.role === "super_admin"
                              ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                              : "border-status-success-border bg-status-success-bg text-status-success"
                          }`}
                        >
                          {u.role === "super_admin" ? (
                            <Shield
                              className="mr-1 size-3"
                              aria-hidden="true"
                            />
                          ) : (
                            <UserCheck
                              className="mr-1 size-3"
                              aria-hidden="true"
                            />
                          )}
                          {u.role.replace("_", " ")}
                        </Badge>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {u.isActive ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-status-success">
                          <CheckCircle2
                            className="size-4 text-status-success"
                            aria-hidden="true"
                          />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <XCircle className="size-4" aria-hidden="true" />
                          Deactivated
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
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
                            className="cursor-pointer gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <KeyRound className="size-3" aria-hidden="true" />
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
                                  ? "cursor-pointer text-status-warning hover:bg-status-warning-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                  : "cursor-pointer text-status-success hover:bg-status-success-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
        <DialogContent className="sm:max-w-md">
          {resetTarget ? (
            <ResetPasswordFormBody
              key={resetTarget.id}
              target={resetTarget}
              onSuccess={(email) => {
                setResetTarget(null)
                setBannerNotice({
                  type: "success",
                  text: `Temporary password set for ${email} and active sessions revoked.`,
                })
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
