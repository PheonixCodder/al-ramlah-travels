import crypto from "node:crypto"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { hashPassword } from "better-auth/crypto"
import { nextCookies } from "better-auth/next-js"
import { eq } from "drizzle-orm"
import { db, withTransaction } from "../db"
import * as schema from "../db/schema"
import { recordAuditLog } from "./audit-log"
import { isAuditLocalE2eMode } from "./env"
import { logger } from "./logger"
import { sendPasswordResetEmail } from "./security/mailer"

function buildTrustedOrigins(): string[] {
  const isProduction =
    process.env.NODE_ENV === "production" && !isAuditLocalE2eMode()
  const configured = [
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.BETTER_AUTH_URL?.trim(),
  ].filter((origin): origin is string => Boolean(origin))

  if (isProduction) {
    return Array.from(new Set(configured))
  }

  return Array.from(
    new Set([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      ...configured,
    ])
  )
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 256,
    resetPasswordTokenExpiresIn: 60 * 30,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        recipientName: user.name,
        resetUrl: url,
        expiresInMinutes: 30,
      })
      await recordAuditLog({
        actorId: user.id,
        action: "auth.password_reset_requested",
        entityType: "user",
        entityId: user.id,
      })
    },
    onPasswordReset: async ({ user }) => {
      await db
        .update(schema.user)
        .set({ mustChangePassword: false, updatedAt: new Date() })
        .where(eq(schema.user.id, user.id))

      await recordAuditLog({
        actorId: user.id,
        action: "auth.password_reset_completed",
        entityType: "user",
        entityId: user.id,
      })
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 5,
      },
      "/request-password-reset": {
        window: 60,
        max: 3,
      },
      "/forget-password": {
        window: 60,
        max: 3,
      },
      "/reset-password": {
        window: 60,
        max: 5,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 12,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "staff",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
    },
  },
  advanced: {
    useSecureCookies:
      process.env.NODE_ENV === "production" && !isAuditLocalE2eMode(),
    defaultCookieAttributes: {
      sameSite: "lax",
      httpOnly: true,
    },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
      disableIpTracking: false,
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (sessionData) => {
          const liveUser = await db.query.user.findFirst({
            where: eq(schema.user.id, sessionData.userId),
            columns: { id: true, isActive: true },
          })
          if (!liveUser || !liveUser.isActive) {
            logger.warn("Blocked session creation for inactive or missing user", {
              userId: sessionData.userId,
            })
            return false
          }
          return { data: sessionData }
        },
        after: async (createdSession) => {
          await recordAuditLog({
            actorId: createdSession.userId,
            action: "auth.session_created",
            entityType: "session",
            entityId: createdSession.id,
            ipAddress: createdSession.ipAddress ?? null,
          })
        },
      },
    },
  },
  trustedOrigins: buildTrustedOrigins(),
  plugins: [nextCookies()],
})

/**
 * Server-only internal provisioning helper used by `db/seed.ts` and `super_admin` staff invites
 * while public `/api/auth/sign-up` remains permanently locked (`disableSignUp: true`, `T-004`).
 */
export async function provisionStaffAccountInternal(params: {
  email: string
  password: string
  name: string
  role: "super_admin" | "staff"
  mustChangePassword?: boolean
}): Promise<{ id: string; email: string; created: boolean }> {
  const normalizedEmail = params.email.trim().toLowerCase()
  const existing = await db.query.user.findFirst({
    where: eq(schema.user.email, normalizedEmail),
    columns: { id: true, email: true },
  })

  if (existing) {
    return { id: existing.id, email: existing.email, created: false }
  }

  if (params.password.length < 10) {
    throw new Error("Bootstrap password must be at least 10 characters long.")
  }

  const passwordHash = await hashPassword(params.password)
  const userId = crypto.randomUUID()
  const now = new Date()

  await withTransaction(async (tx) => {
    await tx.insert(schema.user).values({
      id: userId,
      email: normalizedEmail,
      name: params.name.trim(),
      emailVerified: true,
      role: params.role,
      isActive: true,
      mustChangePassword: params.mustChangePassword ?? true,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(schema.account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })
  })

  return { id: userId, email: normalizedEmail, created: true }
}

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
