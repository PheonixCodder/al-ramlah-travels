import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function isAuditLocalE2eRuntime(): boolean {
  if (process.env.AUDIT_E2E_LOCAL !== "1") {
    return false
  }
  const dbUrl = process.env.DATABASE_URL?.trim() ?? ""
  const pooledUrl = process.env.DATABASE_URL_POOLED?.trim() || dbUrl
  if (!dbUrl || !pooledUrl) {
    return false
  }
  return (
    (dbUrl.includes("127.0.0.1") || dbUrl.includes("localhost")) &&
    (pooledUrl.includes("127.0.0.1") || pooledUrl.includes("localhost"))
  )
}

function buildContentSecurityPolicy(isDev: boolean): string {
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'"

  const connectSrc = [
    "'self'",
    "https://*.r2.cloudflarestorage.com",
    "https://*.r2.dev",
    "https://r2.alramlahtravels.com",
    "https://assets.alramlahtravels.com",
    "https://*.trigger.dev",
    "wss://*.trigger.dev",
  ].join(" ")

  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://r2.alramlahtravels.com",
    "https://assets.alramlahtravels.com",
    "https://*.r2.dev",
    "https://*.r2.cloudflarestorage.com",
    "https://images.unsplash.com",
    "https://plus.unsplash.com",
    "https://*.public.blob.vercel-storage.com",
    "https://lh3.googleusercontent.com",
    "https://avatars.githubusercontent.com",
  ].join(" ")

  const mediaSrc = [
    "'self'",
    "blob:",
    "https://r2.alramlahtravels.com",
    "https://assets.alramlahtravels.com",
    "https://*.r2.dev",
    "https://*.r2.cloudflarestorage.com",
  ].join(" ")

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src ${imgSrc}`,
    `media-src ${mediaSrc}`,
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://www.google.com https://maps.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")
}

function applySecurityHeaders(
  response: NextResponse,
  pathname: string,
  requestId: string
): NextResponse {
  const isDev =
    process.env.NODE_ENV === "development" || isAuditLocalE2eRuntime()

  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(isDev))
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")

  const isDocumentsSurface =
    pathname === "/documents" || pathname.startsWith("/documents/")

  response.headers.set(
    "Referrer-Policy",
    isDocumentsSurface ? "no-referrer" : "strict-origin-when-cross-origin"
  )
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  )
  response.headers.set("x-request-id", requestId)

  const isPrivateEdgeSurface =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/voucher" ||
    pathname.startsWith("/voucher/") ||
    pathname === "/quote" ||
    pathname.startsWith("/quote/") ||
    isDocumentsSurface

  if (isPrivateEdgeSurface) {
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive, nosnippet"
    )
  }

  return response
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const requestId =
    request.headers.get("x-request-id")?.trim() || crypto.randomUUID()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-request-id", requestId)

  const sessionCookie =
    request.cookies.get("__Secure-better-auth.session_token")?.value ||
    request.cookies.get("better-auth.session_token")?.value

  const isLoginRoute =
    pathname === "/admin/login" || pathname === "/admin/login/"
  const isAdminRoute = pathname.startsWith("/admin")

  if (isAdminRoute) {
    if (isLoginRoute) {
      const isSessionExpired = searchParams.get("session_expired") === "1"
      // Never delete session cookies on GET /admin/login?session_expired=1 (prevents cross-site forced-logout gadget T-047).
      // When session_expired=1 is set by server auth-guard, render the login page directly without looping back to /admin.
      if (sessionCookie && !isSessionExpired) {
        return applySecurityHeaders(
          NextResponse.redirect(new URL("/admin", request.url)),
          pathname,
          requestId
        )
      }

      return applySecurityHeaders(
        NextResponse.next({ request: { headers: requestHeaders } }),
        pathname,
        requestId
      )
    }

    if (!sessionCookie) {
      const loginUrl = new URL("/admin/login", request.url)
      if (pathname !== "/admin" && pathname !== "/admin/") {
        loginUrl.searchParams.set("callbackUrl", pathname)
      }
      return applySecurityHeaders(
        NextResponse.redirect(loginUrl),
        pathname,
        requestId
      )
    }
  }

  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    pathname,
    requestId
  )
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
