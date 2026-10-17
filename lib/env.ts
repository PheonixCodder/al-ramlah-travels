import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .regex(
      /^postgres(ql)?:\/\//,
      "DATABASE_URL must be a valid PostgreSQL connection string"
    ),
  DATABASE_URL_POOLED: z
    .string()
    .min(1, "DATABASE_URL_POOLED is required")
    .regex(
      /^postgres(ql)?:\/\//,
      "DATABASE_URL_POOLED must be a valid PostgreSQL connection string"
    ),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters long"),
  BETTER_AUTH_URL: z
    .string()
    .url("BETTER_AUTH_URL must be a valid URL")
    .default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsedEnv.error.format(), null, 2)
  )
  throw new Error("Invalid environment variables. See console above.")
}

export const env = parsedEnv.data
