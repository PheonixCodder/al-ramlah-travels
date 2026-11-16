"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface MandatoryPasswordChangeGateProps {
  userEmail?: string | null
  loginHref?: string
}

/**
 * Non-dismissible password rotation gate rendered by `AdminDashboardLayout`
 * whenever `session.user.mustChangePassword === true` (`T-043` / `T-092`).
 * Blocks dashboard `{children}` server-side and posts directly to `/api/auth/change-password`
 * (aligned with `app/admin/(auth)/login/page.tsx?change_password=1` without `proxy.ts` redirect loops).
 */
export function MandatoryPasswordChangeGate({
  userEmail,
  loginHref = "/admin/login?change_password=1",
}: MandatoryPasswordChangeGateProps) {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (newPassword.length < 10) {
      setErrorMessage("New password must be at least 10 characters long.")
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Password confirmation does not match.")
      return
    }
    if (newPassword === currentPassword) {
      setErrorMessage(
        "New password must be different from your temporary bootstrap password."
      )
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null
        setErrorMessage(
          body?.message || "Unable to update password. Check current password."
        )
        setIsSubmitting(false)
        return
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      router.refresh()
    } catch {
      setErrorMessage("Failed to rotate password. Please try again.")
      setIsSubmitting(false)
    }
  }

  const handleSignOutToLogin = async () => {
    try {
      await authClient.signOut()
    } catch {
      // Ignore sign-out transport errors and navigate to login screen
    }
    router.push(loginHref)
  }

  return (
    <div
      role="region"
      aria-labelledby="mandatory-password-rotation-heading"
      className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center py-8"
    >
      <Card className="w-full border-gold/40 bg-card shadow-lg">
        <CardHeader className="flex flex-col gap-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-gold/40 bg-primary/5 text-primary">
            <KeyRound className="size-6" aria-hidden="true" />
          </div>
          <p className="text-[11px] font-semibold tracking-widest text-gold-text uppercase">
            Security Policy · Bootstrap Rotation Required
          </p>
          <CardTitle
            id="mandatory-password-rotation-heading"
            className="font-display text-xl font-bold text-foreground"
          >
            Mandatory Password Update
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {userEmail ? (
              <>
                Account <span className="font-mono font-medium text-foreground">{userEmail}</span>{" "}
                is using a temporary credential. Set a permanent personal password
                (minimum 10 characters) to unlock operational hubs.
              </>
            ) : (
              "Replace your temporary bootstrap password (minimum 10 characters) before accessing operational hubs."
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {errorMessage && (
            <Alert
              role="alert"
              variant="destructive"
              className="border-destructive/30 bg-destructive/10 text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" />
              <AlertTitle className="text-xs font-semibold">
                Password Update Required
              </AlertTitle>
              <AlertDescription id="password-gate-error" className="text-xs">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="gate-current-password"
                className="text-xs font-medium text-foreground"
              >
                Current / Temporary Password
              </Label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="gate-current-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? "password-gate-error" : undefined}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-9 text-sm"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="gate-new-password"
                className="text-xs font-medium text-foreground"
              >
                New Personal Password (min. 10 characters)
              </Label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="gate-new-password"
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? "password-gate-error" : undefined}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 text-sm"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="gate-confirm-password"
                className="text-xs font-medium text-foreground"
              >
                Confirm New Password
              </Label>
              <div className="relative">
                <ShieldCheck
                  aria-hidden="true"
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="gate-confirm-password"
                  type="password"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? "password-gate-error" : undefined}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 text-sm"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Update Password &amp; Unlock Portal</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 pb-4">
          <Link
            href={loginHref}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Open Login Rotation Form
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSignOutToLogin}
            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
