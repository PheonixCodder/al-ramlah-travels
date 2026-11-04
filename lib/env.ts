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

  // Cloudflare R2 Object Storage (Presigned Uploads, 4K Posters, Social JPEGs & Luxury PDFs)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Multimodal AI Extraction Gateway (Direct Google Gemini Primary + OpenRouter Secondary)
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Trigger.dev Cloud Durable Background Jobs & Schedules
  TRIGGER_SECRET_KEY: z.string().optional(),
  TRIGGER_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_TRIGGER_PUBLIC_API_KEY: z.string().optional(),

  // Oracle Cloud Always Free Gotenberg Rendering Microservice
  GOTENBERG_API_URL: z.string().optional(),
  GOTENBERG_API_KEY: z.string().optional(),

  // AES-256-GCM Token Encryption Key (64-hex chars / 32 bytes; falls back safely in dev/test)
  ENCRYPTION_KEY: z.string().optional(),

  // Official Meta WhatsApp Cloud API (Native wacrm Port)
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  // Native Social Publishing OAuth Credentials (Ported Postiz Core 5)
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_BASE_URL: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),

  // Composio Managed OAuth Bridge (Zero-Config Instagram & Facebook Pages)
  COMPOSIO_API_KEY: z.string().optional(),

  // Legacy Optional Bridge Fallbacks
  POSTIZ_API_URL: z.string().optional(),
  POSTIZ_API_KEY: z.string().optional(),
  WACRM_API_URL: z.string().optional(),
  WACRM_API_KEY: z.string().optional(),
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
