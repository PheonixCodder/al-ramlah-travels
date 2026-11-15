import { defineConfig, devices } from "@playwright/test"
import {
  applyHermeticAuditEnvToProcess,
  E2E_APP_ORIGIN,
  E2E_APP_PORT,
  E2E_MOCK_ORIGIN,
} from "./tests/e2e/helpers/env"

const hermeticChildEnv = applyHermeticAuditEnvToProcess()

export default defineConfig({
  testDir: "./tests/e2e",
  tsconfig: "./tests/e2e/tsconfig.json",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  globalTimeout: 1_800_000,
  expect: {
    timeout: 15_000,
  },
  outputDir: "./test-results/artifacts",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: E2E_APP_ORIGIN,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command:
        "node ./node_modules/tsx/dist/cli.mjs ./tests/e2e/helpers/mock-server-daemon.ts",
      url: `${E2E_MOCK_ORIGIN}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: hermeticChildEnv,
    },
    {
      command:
        "node --import ./tests/e2e/helpers/next-fetch-interceptor.mjs ./tests/e2e/helpers/start-standalone.mjs",
      url: `${E2E_APP_ORIGIN}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...hermeticChildEnv,
        HOSTNAME: "127.0.0.1",
        PORT: String(E2E_APP_PORT),
        NODE_ENV: "production",
        AUDIT_E2E_LOCAL: "1",
      },
    },
  ],
})
