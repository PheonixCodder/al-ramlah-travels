import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  const sessionCookie =
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value

  const isLoginRoute =
    pathname === "/admin/login" || pathname === "/admin/login/"
  const isAdminRoute = pathname.startsWith("/admin")

  if (isAdminRoute) {
    if (isLoginRoute) {
      const isSessionExpired = searchParams.get("session_expired") === "1"
      if (isSessionExpired) {
        // Clear stale session cookies so expired sessions do not get redirected back to /admin in an infinite loop
        const response = NextResponse.next()
        response.cookies.delete("better-auth.session_token")
        response.cookies.delete("__Secure-better-auth.session_token")
        return response
      }

      if (sessionCookie) {
        return NextResponse.redirect(new URL("/admin", request.url))
      }
      return NextResponse.next()
    }

    if (!sessionCookie) {
      const loginUrl = new URL("/admin/login", request.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      loginUrl.searchParams.set("from", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
