"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function AdminLoginForm() {
  const searchParams = useSearchParams()
  const rawTarget = searchParams.get("callbackUrl") || searchParams.get("from") || "/admin"
  const callbackUrl =
    rawTarget.startsWith("/admin") && !rawTarget.startsWith("//")
      ? rawTarget
      : "/admin"
  const isSessionExpired = searchParams.get("session_expired") === "1"

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

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

      // Use full navigation so the newly set session cookie is immediately read by proxy.ts
      window.location.assign(callbackUrl)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during sign in."
      setErrorMessage(msg)
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Decorative Luxury Background Elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Soft Radial Gold & Emerald Glows */}
        <div className="absolute -top-40 -left-40 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-gold/15 blur-3xl" />
        {/* Subtle Islamic Lattice Watermark */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(var(--color-primary) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Emblem & Portal Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3 flex size-16 items-center justify-center rounded-2xl border border-gold/40 bg-card p-2 shadow-md">
            <Image
              src="/logo.jpg"
              alt="Al Ramlah Travels Emblem"
              width={54}
              height={54}
              className="size-full object-contain"
              priority
            />
          </div>
          <span className="font-arabic text-sm text-gold">
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

        {/* Login Card */}
        <Card className="border-border bg-card shadow-lg">
          <CardHeader className="space-y-1.5 pb-4 text-center">
            <CardTitle className="font-display text-xl font-bold text-foreground">
              Sign In to Your Account
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Enter your corporate credentials to manage quotes, bookings, and inventory
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {isSessionExpired && !errorMessage && (
              <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <Clock className="size-4 shrink-0" />
                <AlertTitle className="text-xs font-semibold">Session Expired</AlertTitle>
                <AlertDescription className="text-xs">
                  Your session has ended or is invalid. Please sign in again.
                </AlertDescription>
              </Alert>
            )}

            {errorMessage && (
              <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <AlertTitle className="text-xs font-semibold">Authentication Error</AlertTitle>
                <AlertDescription className="text-xs">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-foreground">
                  Corporate Email
                </Label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-foreground">
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
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
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
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

        {/* Security & Regulatory Footnote */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Protected by Better Auth · Authorized Al Ramlah Travels personnel only.
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AdminLoginForm />
    </React.Suspense>
  )
}
