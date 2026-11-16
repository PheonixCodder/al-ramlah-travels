"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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

type AuthViewMode = "signin" | "forgot" | "reset" | "change_password"

function AdminLoginForm() {
  const searchParams = useSearchParams()
  const rawTarget =
    searchParams.get("callbackUrl") || searchParams.get("from") || "/admin"
  const callbackUrl =
    rawTarget.startsWith("/admin") && !rawTarget.startsWith("//")
      ? rawTarget
      : "/admin"
  const isSessionExpired = searchParams.get("session_expired") === "1"
  const resetTokenParam = searchParams.get("token")?.trim() || ""
  const tokenErrorParam = searchParams.get("error")?.trim() || ""
  const forceChangeParam = searchParams.get("change_password") === "1"

  const initialMode: AuthViewMode = resetTokenParam
    ? "reset"
    : forceChangeParam
      ? "change_password"
      : "signin"

  const [mode, setMode] = React.useState<AuthViewMode>(initialMode)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(
    tokenErrorParam === "INVALID_TOKEN"
      ? "This password reset link is invalid or has expired. Please request a fresh link."
      : null
  )
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null
  )

  const switchMode = (nextMode: AuthViewMode) => {
    setMode(nextMode)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      })

      if (result.error) {
        setErrorMessage(
          result.error.message ||
            "Authentication failed. Please verify your credentials."
        )
        setIsLoading(false)
        return
      }

      // Inspect live session to enforce bootstrap password rotation (OD-02 / T-043)
      const sessionRes = await authClient.getSession()
      const sessionUser = sessionRes.data?.user as
        | { mustChangePassword?: boolean }
        | undefined

      if (sessionUser?.mustChangePassword) {
        setCurrentPassword(password)
        setPassword("")
        setIsLoading(false)
        setMode("change_password")
        setSuccessMessage(
          "Bootstrap credentials verified. Please set a permanent personal password to continue."
        )
        return
      }

      window.location.assign(callbackUrl)
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during sign in."
      )
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: `${window.location.origin}/admin/login`,
        }),
      })

      if (response.status === 429) {
        setErrorMessage(
          "Too many reset attempts. Please wait a minute before trying again."
        )
        setIsLoading(false)
        return
      }

      setSuccessMessage(
        "If an active corporate account matches this email, a secure password reset link (valid for 30 minutes) has been dispatched."
      )
      setIsLoading(false)
    } catch {
      setErrorMessage(
        "Unable to reach the authentication service. Please check your connection."
      )
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (newPassword.length < 10) {
      setErrorMessage("New password must be at least 10 characters long.")
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Password confirmation does not match.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetTokenParam,
          newPassword,
        }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null
        setErrorMessage(
          body?.message ||
            "Reset link expired or invalid. Please request a new reset link."
        )
        setIsLoading(false)
        return
      }

      setNewPassword("")
      setConfirmPassword("")
      setIsLoading(false)
      setMode("signin")
      setSuccessMessage(
        "Password updated and active sessions rotated. Please sign in with your new password."
      )
    } catch {
      setErrorMessage("Failed to reset password. Please try again.")
      setIsLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

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

    setIsLoading(true)
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
        setIsLoading(false)
        return
      }

      window.location.assign(callbackUrl)
    } catch {
      setErrorMessage("Failed to change password. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-40 -bottom-40 size-96 rounded-full bg-gold/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(var(--color-primary) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <main
        id="main-content"
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3 flex size-16 items-center justify-center rounded-2xl border border-gold/40 bg-card p-2 shadow-md">
            <Image
              src="/logo.jpg"
              alt="Al Ramlah Travels Emblem"
              width={54}
              height={54}
              className="size-full object-contain"
              loading="eager"
            />
          </div>
          <span
            lang="ar"
            dir="rtl"
            className="font-arabic text-sm text-gold-text"
          >
            بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيمِ
          </span>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Al Ramlah Travels
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-primary uppercase"
            >
              Executive Admin Portal
            </Badge>
          </div>
        </div>

        <Card className="border-border bg-card shadow-lg">
          <CardHeader className="flex flex-col gap-1.5 pb-4 text-center">
            <CardTitle className="font-display text-xl font-bold text-foreground">
              {mode === "signin" && "Sign In to Your Account"}
              {mode === "forgot" && "Reset Corporate Password"}
              {mode === "reset" && "Choose a New Password"}
              {mode === "change_password" && "Mandatory Password Update"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {mode === "signin" &&
                "Enter your corporate credentials to manage quotes, bookings, and inventory"}
              {mode === "forgot" &&
                "We will send a 30-minute recovery link to your registered corporate email"}
              {mode === "reset" &&
                "Set a strong passphrase (minimum 10 characters) for your staff account"}
              {mode === "change_password" &&
                "Replace your one-time bootstrap password before accessing the dashboard"}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-2">
            {isSessionExpired && !errorMessage && !successMessage && (
              <Alert
                role="alert"
                className="border-amber-600/30 bg-amber-500/10 text-amber-900"
              >
                <Clock className="size-4 shrink-0" />
                <AlertTitle className="text-xs font-semibold">
                  Session Expired
                </AlertTitle>
                <AlertDescription className="text-xs">
                  Your session has ended or is invalid. Please sign in again.
                </AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert
                role="status"
                className="border-primary/30 bg-primary/5 text-primary"
              >
                <CheckCircle2 className="size-4 shrink-0" />
                <AlertTitle className="text-xs font-semibold">
                  Security Notice
                </AlertTitle>
                <AlertDescription className="text-xs">
                  {successMessage}
                </AlertDescription>
              </Alert>
            )}

            {errorMessage && (
              <Alert
                role="alert"
                variant="destructive"
                className="border-destructive/30 bg-destructive/10 text-destructive"
              >
                <AlertCircle className="size-4 shrink-0" />
                <AlertTitle className="text-xs font-semibold">
                  Authentication Error
                </AlertTitle>
                <AlertDescription className="text-xs">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {mode === "signin" && (
              <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="email"
                    className="text-xs font-medium text-foreground"
                  >
                    Corporate Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      aria-invalid={Boolean(errorMessage)}
                      placeholder="name@alramlahtravels.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 text-sm"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-xs font-medium text-foreground"
                    >
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      aria-invalid={Boolean(errorMessage)}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 text-sm"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Verifying Session...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {mode === "forgot" && (
              <form
                onSubmit={handleForgotPassword}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="reset-email"
                    className="text-xs font-medium text-foreground"
                  >
                    Corporate Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="name@alramlahtravels.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 text-sm"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Dispatching Link...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="size-4" />
                      <span>Send Password Reset Link</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => switchMode("signin")}
                  className="w-full text-xs text-muted-foreground"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Return to Sign In</span>
                </Button>
              </form>
            )}

            {mode === "reset" && (
              <form
                onSubmit={handleResetPassword}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="new-password"
                    className="text-xs font-medium text-foreground"
                  >
                    New Password (min. 10 characters)
                  </Label>
                  <div className="relative">
                    <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type="password"
                      required
                      minLength={10}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-9 text-sm"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="confirm-password"
                    className="text-xs font-medium text-foreground"
                  >
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <ShieldCheck className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type="password"
                      required
                      minLength={10}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 text-sm"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Updating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Save New Password</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {mode === "change_password" && (
              <form
                onSubmit={handleChangePassword}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="current-password"
                    className="text-xs font-medium text-foreground"
                  >
                    Current / Bootstrap Password
                  </Label>
                  <Input
                    id="current-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="text-sm"
                    disabled={isLoading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="rotate-new-password"
                    className="text-xs font-medium text-foreground"
                  >
                    New Personal Password (min. 10 characters)
                  </Label>
                  <Input
                    id="rotate-new-password"
                    type="password"
                    required
                    minLength={10}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="text-sm"
                    disabled={isLoading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="rotate-confirm-password"
                    className="text-xs font-medium text-foreground"
                  >
                    Confirm New Password
                  </Label>
                  <Input
                    id="rotate-confirm-password"
                    type="password"
                    required
                    minLength={10}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="text-sm"
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Rotating Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Update Password &amp; Continue</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex flex-col items-center justify-center border-t border-border pt-4 pb-4">
            <Link
              href="/"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary hover:underline"
            >
              ← Back to Public Website
            </Link>
          </CardFooter>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Protected by Better Auth · Authorized Al Ramlah Travels personnel
          only.
        </p>
      </main>
    </div>
  )
}

export function AdminLoginClient() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AdminLoginForm />
    </React.Suspense>
  )
}
