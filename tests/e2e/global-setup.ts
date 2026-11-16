import fs from "node:fs"
import path from "node:path"
import { chromium } from "@playwright/test"
import {
  clearAuthRateLimits,
  closeE2eDb,
  E2E_PASSWORD,
  E2E_STAFF_EMAIL,
  E2E_SUPER_ADMIN_EMAIL,
  ensureE2eBaselineFixtures,
} from "./helpers/db"
import {
  applyHermeticAuditEnvToProcess,
  E2E_APP_ORIGIN,
  WEB_ROOT,
} from "./helpers/env"
import { instrumentBrowserContext } from "./helpers/fixture"

export const SUPERADMIN_AUTH_FILE = path.resolve(
  WEB_ROOT,
  "test-results/.auth/superadmin.json"
)
export const STAFF_AUTH_FILE = path.resolve(
  WEB_ROOT,
  "test-results/.auth/staff.json"
)
export const FIXTURES_SUMMARY_FILE = path.resolve(
  WEB_ROOT,
  "test-results/.auth/fixtures.json"
)

async function createStorageStateForUser(
  email: string,
  password: string,
  targetPath: string
): Promise<void> {
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ baseURL: E2E_APP_ORIGIN })
    const res = await context.request.post("/api/auth/sign-in/email", {
      headers: {
        Origin: E2E_APP_ORIGIN,
        "Content-Type": "application/json",
      },
      data: {
        email,
        password,
      },
    })

    if (!res.ok()) {
      const errText = await res.text()
      throw new Error(
        `[E2E-GLOBAL-SETUP] Sign-in failed for ${email}: HTTP ${res.status()} ${errText}`
      )
    }

    await context.storageState({ path: targetPath })
    await context.close()
  } finally {
    await browser.close()
  }
}

export default async function globalSetup(): Promise<void> {
  applyHermeticAuditEnvToProcess()

  const authDir = path.dirname(SUPERADMIN_AUTH_FILE)
  fs.mkdirSync(authDir, { recursive: true })

  const summary = await ensureE2eBaselineFixtures()
  fs.writeFileSync(
    FIXTURES_SUMMARY_FILE,
    JSON.stringify(summary, null, 2),
    "utf8"
  )

  await clearAuthRateLimits()
  await createStorageStateForUser(
    E2E_SUPER_ADMIN_EMAIL,
    E2E_PASSWORD,
    SUPERADMIN_AUTH_FILE
  )
  await createStorageStateForUser(E2E_STAFF_EMAIL, E2E_PASSWORD, STAFF_AUTH_FILE)
  await clearAuthRateLimits()
  await closeE2eDb()

  // Pre-warm homepage SSR/Turbopack compilation once so Test #1 starts hot
  const warmupBrowser = await chromium.launch()
  try {
    const warmupCtx = await warmupBrowser.newContext({
      baseURL: E2E_APP_ORIGIN,
    })
    await instrumentBrowserContext(warmupCtx)
    const warmupPage = await warmupCtx.newPage()
    await warmupPage
      .goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 })
      .catch(() => undefined)
    await warmupCtx.close()
  } finally {
    await warmupBrowser.close()
  }
}
