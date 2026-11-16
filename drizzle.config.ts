import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import { defineConfig } from "drizzle-kit"

if (!process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
  const explicitEnvFile = process.env.DOTENV_CONFIG_PATH?.trim()
  if (explicitEnvFile && fs.existsSync(explicitEnvFile)) {
    dotenv.config({ path: explicitEnvFile })
  } else {
    const defaultEnvPath = path.resolve(process.cwd(), ".env")
    if (fs.existsSync(defaultEnvPath)) {
      dotenv.config({ path: defaultEnvPath })
    }
  }
}

const migrationDatabaseUrl =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  ""

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationDatabaseUrl,
  },
})
