import { cache } from "react"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { db } from "@/db"
import { session as sessionTable, user as userTable } from "@/db/schema/auth"
import { auth, type Session } from "./auth"

async function verifySessionWithHeaders(reqHeaders: Headers): Promise<{
  session: Session | null
  deactivated: boolean
}> {
  const rawSession = await auth.api.getSession({
    headers: reqHeaders,
  })

  if (!rawSession || !rawSession.user?.id) {
    return { session: null, deactivated: false }
  }

  const liveUser = await db.query.user.findFirst({
    where: eq(userTable.id, rawSession.user.id),
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  })

  if (!liveUser || !liveUser.isActive) {
    await db
      .delete(sessionTable)
      .where(eq(sessionTable.userId, rawSession.user.id))
      .catch(() => undefined)
    return { session: null, deactivated: true }
  }

  const hydratedSession: Session = {
    ...rawSession,
    user: {
      ...rawSession.user,
      name: liveUser.name,
      email: liveUser.email,
      role: liveUser.role,
      isActive: liveUser.isActive,
      mustChangePassword: liveUser.mustChangePassword,
    },
  }

  return { session: hydratedSession, deactivated: false }
}

/**
 * Request-memoized session + live PostgreSQL `user` status verification (`T-004`).
 * Ensures deactivated (`isActive = false`) or demoted staff accounts lose access
 * immediately on the very next request rather than surviving cookie lifetime.
 */
const resolveVerifiedRequestSession = cache(
  async (): Promise<{
    session: Session | null
    deactivated: boolean
  }> => {
    const reqHeaders = await headers()
    return verifySessionWithHeaders(reqHeaders)
  }
)

/**
 * Retrieves the current verified user session from incoming request headers, or `null`.
 */
export async function getServerSession(): Promise<Session | null> {
  const { session } = await resolveVerifiedRequestSession()
  return session
}

/**
 * Non-throwing helper for route handlers (e.g. `/api/health?deep=1`) that inspect
 * whether the caller holds an active `staff` or `super_admin` session.
 */
export async function getAuthenticatedAdminOrNull(
  explicitHeaders?: Headers
): Promise<Session | null> {
  let session: Session | null = null
  if (explicitHeaders) {
    const resolved = await verifySessionWithHeaders(explicitHeaders)
    session = resolved.session
  } else {
    try {
      const resolved = await resolveVerifiedRequestSession()
      session = resolved.session
    } catch {
      return null
    }
  }
  if (!session?.user) {
    return null
  }
  if (session.user.role !== "super_admin" && session.user.role !== "staff") {
    return null
  }
  return session
}

/**
 * Asserts that the incoming request has a valid, active administrative session (`staff` or `super_admin`).
 * Throws an Error if unauthorized, deactivated, or lacking role privileges.
 */
export async function requireAdmin(): Promise<Session> {
  const { session, deactivated } = await resolveVerifiedRequestSession()

  if (deactivated) {
    throw new Error("Forbidden: Account is deactivated")
  }

  if (!session || !session.user) {
    throw new Error("Unauthorized: Admin access required")
  }

  if (session.user.isActive === false) {
    throw new Error("Forbidden: Account is deactivated")
  }

  if (session.user.role !== "super_admin" && session.user.role !== "staff") {
    throw new Error("Forbidden: Administrative privilege required")
  }

  return session
}

/**
 * Asserts that the incoming request has a valid, active `super_admin` session.
 */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await requireAdmin()

  if (session.user.role !== "super_admin") {
    throw new Error("Forbidden: Super Administrator privilege required")
  }

  return session
}
