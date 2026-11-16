import { additionalFiles } from "@trigger.dev/build/extensions/core"
import { defineConfig } from "@trigger.dev/sdk"
import { assertTriggerWorkerEnv } from "./lib/trigger/env"

/**
 * Trigger.dev Cloud v4 configuration for Al Ramlah Travels (`T-072`).
 *
 * - Bundles `public/logo*` via `additionalFiles` so Gotenberg poster & quotation PDF
 *   renderers always embed the Haramain emblem inside ephemeral Cloud containers (`A18-003`).
 * - Verifies required worker environment variables on Cloud run initialization (`A18-004`).
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID?.trim() || "proj_wceqpgjdgrgramynogwe",
  runtime: "node",
  logLevel: "info",
  dirs: ["./trigger"],
  maxDuration: 300,
  machine: "medium-1x",
  build: {
    external: ["sharp"],
    extensions: [additionalFiles({ files: ["public/logo*"] })],
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 15_000,
      factor: 2,
      randomize: true,
    },
  },
  init: async ({ ctx }) => {
    if (ctx.environment.type !== "DEVELOPMENT") {
      assertTriggerWorkerEnv(process.env)
    }
  },
})
