import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const SETUP_DIR = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(SETUP_DIR, "../..")
const AUDIT_ENV_PATH = path.resolve(WEB_ROOT, ".env.audit")

const SENSITIVE_KEYS_TO_SCRUB = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_API_TOKEN",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "TRIGGER_SECRET_KEY",
  "NEXT_PUBLIC_TRIGGER_PUBLIC_API_KEY",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "COMPOSIO_API_KEY",
  "RESEND_API_KEY",
]

const SAFE_AUDIT_DEFAULTS = {
  DATABASE_URL: "postgresql://audit:audit_local_only@127.0.0.1:54329/alramlah_audit",
  DATABASE_URL_POOLED: "postgresql://audit:audit_local_only@127.0.0.1:54329/alramlah_audit",
  BETTER_AUTH_SECRET: "audit_local_dummy_secret_not_for_production_0123456789abcdef",
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NODE_ENV: "test",
  ALRAMLAH_AUDIT_ENV: "1",
  WHATSAPP_MOCK_MODE: "true",
  META_APP_ID: "audit_mock_meta_app_id",
  META_APP_SECRET: "audit_mock_meta_app_secret",
  WHATSAPP_VERIFY_TOKEN: "audit_mock_verify_token",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  R2_BUCKET_NAME: "audit-local-bucket",
  R2_PUBLIC_URL: "http://127.0.0.1:3000/uploads/r2-local",
  TRIGGER_PROJECT_ID: "proj_audit_mock",
  GOTENBERG_API_URL: "http://127.0.0.1:3999",
  GOTENBERG_API_KEY: "audit_mock_gotenberg_key",
  TIKTOK_REDIRECT_BASE_URL: "http://127.0.0.1:3000",
}

function buildSanitizedChildEnv() {
  const childEnv = { ...process.env }
  const preserveCiDb =
    childEnv.CI === "true" && childEnv.DATABASE_URL ? childEnv.DATABASE_URL.trim() : null

  for (const key of SENSITIVE_KEYS_TO_SCRUB) {
    delete childEnv[key]
  }

  if (fs.existsSync(AUDIT_ENV_PATH)) {
    childEnv.DOTENV_CONFIG_PATH = AUDIT_ENV_PATH
    const lines = fs.readFileSync(AUDIT_ENV_PATH, "utf8").split(/\r?\n/)
    for (const rawLine of lines) {
      const trimmed = rawLine.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx <= 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
        (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
      ) {
        val = val.slice(1, -1)
      }
      if (val === "") {
        delete childEnv[key]
      } else {
        childEnv[key] = val
      }
    }
    if (preserveCiDb) {
      childEnv.DATABASE_URL = preserveCiDb
      childEnv.DATABASE_URL_POOLED = preserveCiDb
    }
  } else {
    childEnv.DOTENV_CONFIG_PATH = path.resolve(WEB_ROOT, ".env.audit.hermetic-empty")
    if (childEnv.DATABASE_URL && !childEnv.DATABASE_URL_POOLED) {
      childEnv.DATABASE_URL_POOLED = childEnv.DATABASE_URL
    }
    for (const [k, v] of Object.entries(SAFE_AUDIT_DEFAULTS)) {
      if (!childEnv[k] || !childEnv[k].trim()) {
        childEnv[k] = v
      }
    }
  }

  childEnv.NODE_ENV = "test"
  childEnv.ALRAMLAH_AUDIT_ENV = "1"
  return childEnv
}

function collectTestFiles(dirPath, recursive = false) {
  if (!fs.existsSync(dirPath)) return []
  const results = []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory() && recursive) {
      results.push(...collectTestFiles(fullPath, true))
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      results.push(path.relative(WEB_ROOT, fullPath).split(path.sep).join("/"))
    }
  }
  return results.sort()
}

const sanitizedEnv = buildSanitizedChildEnv()

// Validate DB URL before spawning anything
for (const dbVar of ["DATABASE_URL", "DATABASE_URL_POOLED"]) {
  const val = sanitizedEnv[dbVar] || ""
  if (!val || /neon\.tech/i.test(val)) {
    console.error(`[HERMETIC-RUNNER] Refusing to run tests: unsafe or missing ${dbVar}`)
    process.exit(1)
  }
}

const legacyFiles = collectTestFiles(path.join(WEB_ROOT, "tests"), false)
const w3Files = collectTestFiles(path.join(WEB_ROOT, "tests", "w3"), true)
const nodeTestFiles = [...legacyFiles, ...w3Files]

console.log(
  `\n================================================================================\n` +
    `[1/2] Running Node Test Runner (Hermetic): ${legacyFiles.length} legacy + ${w3Files.length} W3 files (${nodeTestFiles.length} total)\n` +
    `================================================================================`
)

const tsxCli = path.join(WEB_ROOT, "node_modules", "tsx", "dist", "cli.mjs")
const nodeTestRun = spawnSync(
  process.execPath,
  [
    "--max-old-space-size=4096",
    tsxCli,
    "--import",
    "./tests/setup/hermetic-env.ts",
    "--test",
    "--test-concurrency=1",
    "--test-force-exit",
    ...nodeTestFiles,
  ],
  {
    cwd: WEB_ROOT,
    env: sanitizedEnv,
    stdio: "inherit",
  }
)

const nodeExitCode = nodeTestRun.status ?? 1

console.log(
  `\n================================================================================\n` +
    `[2/2] Running Vitest Runner (Hermetic): tests/unit/** + tests/integration/**\n` +
    `================================================================================`
)

const vitestCli = path.join(WEB_ROOT, "node_modules", "vitest", "vitest.mjs")
const vitestRun = spawnSync(
  process.execPath,
  ["--max-old-space-size=4096", vitestCli, "run"],
  {
    cwd: WEB_ROOT,
    env: sanitizedEnv,
    stdio: "inherit",
  }
)

const vitestExitCode = vitestRun.status ?? 1

console.log(
  `\n================================================================================\n` +
    `[SUMMARY] Hermetic Test Suite Summary\n` +
    `  - Node Runner (${legacyFiles.length} legacy + ${w3Files.length} W3 files): ${nodeExitCode === 0 ? "PASS" : `FAIL (exit ${nodeExitCode})`}\n` +
    `  - Vitest Runner (unit + integration): ${vitestExitCode === 0 ? "PASS" : `FAIL (exit ${vitestExitCode})`}\n` +
    `================================================================================\n`
)

if (nodeExitCode !== 0 || vitestExitCode !== 0) {
  process.exit(nodeExitCode !== 0 ? nodeExitCode : vitestExitCode)
}
