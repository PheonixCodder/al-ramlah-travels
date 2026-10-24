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

const isSkip =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.NEXT_PHASE === "phase-production-build"

const parsedEnv = envSchema.safeParse(process.env)

let envData: z.infer<typeof envSchema>

if (!parsedEnv.success) {
  if (isSkip) {
    console.warn(
      "⚠️ Skipping strict environment validation (SKIP_ENV_VALIDATION=1 or phase-production-build)"
    )
    envData = {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      DATABASE_URL_POOLED:
        process.env.DATABASE_URL_POOLED ||
        "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ||
        "build_placeholder_secret_at_least_32_characters_long",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
      NEXT_PUBLIC_APP_URL:
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      NODE_ENV:
        (process.env.NODE_ENV as "development" | "test" | "production") ||
        "development",
    }
  } else {
    console.error(
      "❌ Invalid environment variables:",
      JSON.stringify(parsedEnv.error.format(), null, 2)
    )
    throw new Error("Invalid environment variables. See console above.")
  }
} else {
  envData = parsedEnv.data
}

export const env = envData
