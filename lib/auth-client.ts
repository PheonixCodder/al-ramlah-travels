import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"
import type { auth } from "./auth"

const resolvedBaseUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://127.0.0.1:3000"

export const authClient = createAuthClient({
  baseURL: resolvedBaseUrl,
  plugins: [inferAdditionalFields<typeof auth>()],
})

export const { signIn, signOut, signUp, useSession, getSession } = authClient
