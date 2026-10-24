import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { db } from "../db"
import * as schema from "../db/schema"

const rawOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8080",
  "http://localhost",
  "https://*.ngrok-free.app",
  "https://*.ngrok-free.dev",
  "https://*.ngrok.app",
  "https://*.ngrok.io",
  "https://*.trycloudflare.com",
  "https://*.lhr.life",
  "https://*.devtunnels.ms",
  "https://*.asse.devtunnels.ms",
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.BETTER_AUTH_URL,
].filter((origin): origin is string => Boolean(origin && origin.trim()))

const trustedOrigins = Array.from(new Set(rawOrigins))

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
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
    },
  },
  trustedOrigins,
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
