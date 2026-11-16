import { eq } from "drizzle-orm"
import { toNextJsHandler } from "better-auth/next-js"
import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/db"
import { user as userTable } from "@/db/schema/auth"
import { recordAuditLog } from "@/lib/audit-log"
import { auth } from "@/lib/auth"
import { extractClientIp } from "@/lib/rate-limit"

const handler = toNextJsHandler(auth)

function isPublicSignUpRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "").toLowerCase()
  return (
    normalized === "/api/auth/sign-up" ||
    normalized.startsWith("/api/auth/sign-up/")
  )
}

export async function GET(request: NextRequest): Promise<Response> {
  if (isPublicSignUpRoute(request.nextUrl.pathname)) {
    return NextResponse.json(
      {
        error: "Public account registration is disabled.",
        code: "SIGN_UP_DISABLED",
      },
      { status: 403 }
    )
  }
  return handler.GET(request)
}

export async function POST(request: NextRequest): Promise<Response> {
  const pathname = request.nextUrl.pathname

  // Defense-in-depth route-level block on public sign-up (`T-004`)
  if (isPublicSignUpRoute(pathname)) {
    await recordAuditLog({
      action: "auth.public_signup_blocked",
      entityType: "auth_endpoint",
      entityId: pathname,
      ipAddress: extractClientIp(request.headers),
    })

    return NextResponse.json(
      {
        error: "Public account registration is disabled.",
        code: "SIGN_UP_DISABLED",
      },
      { status: 403 }
    )
  }

  const response = await handler.POST(request)

  // Clear forced bootstrap password rotation flag after successful `/change-password`
  if (
    response.ok &&
    pathname.replace(/\/+$/, "").toLowerCase() === "/api/auth/change-password"
  ) {
    try {
      const session = await auth.api.getSession({ headers: request.headers })
      if (session?.user?.id) {
        await db
          .update(userTable)
          .set({ mustChangePassword: false, updatedAt: new Date() })
          .where(eq(userTable.id, session.user.id))

        await recordAuditLog({
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "auth.password_changed",
          entityType: "user",
          entityId: session.user.id,
          ipAddress: extractClientIp(request.headers),
        })
      }
    } catch {
      // Non-blocking post-hook
    }
  }

  return response
}
