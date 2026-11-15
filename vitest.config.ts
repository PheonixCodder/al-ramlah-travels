import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": ROOT_DIR,
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup/hermetic-env.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
    exclude: [
      "node_modules/**",
      ".next/**",
      "tests/e2e/**",
      "wt-*/**",
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "lib/**/*.ts",
        "app/actions/**/*.ts",
        "app/api/**/*.ts",
        "trigger/**/*.ts",
      ],
    },
  },
})
