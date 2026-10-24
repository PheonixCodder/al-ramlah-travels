import { headers } from "next/headers"
import { auth, type Session } from "./auth"

/**
 * Retrieves the current user session from the incoming request headers.
 */
export async function getServerSession(): Promise<Session | null> {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({
    headers: reqHeaders,
  })
  return session
}

/**
 * Asserts that the incoming request has a valid, active administrative session (staff or super_admin).
 * Throws an Error if unauthorized or forbidden.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await getServerSession()

  if (!session || !session.user) {
    throw new Error("Unauthorized: Admin access required")
  }

  const user = session.user as Session["user"] & {
    role?: string
    isActive?: boolean
  }

  if (user.isActive === false) {
    throw new Error("Forbidden: Account is deactivated")
  }

  if (user.role !== "super_admin" && user.role !== "staff") {
    throw new Error("Forbidden: Administrative privilege required")
  }

  return session
}

/**
 * Asserts that the incoming request has a valid, active super_admin session.
 * Throws an Error if unauthorized or forbidden.
 */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await requireAdmin()

  const user = session.user as Session["user"] & {
    role?: string
  }

  if (user.role !== "super_admin") {
    throw new Error("Forbidden: Super Administrator privilege required")
  }

  return session
}
