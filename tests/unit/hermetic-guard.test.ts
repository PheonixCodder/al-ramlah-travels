import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import type { AddressInfo } from "node:net"
import { describe, expect, it, vi } from "vitest"
import { assertAuditSafeEnvironment } from "../helpers/audit-guard"
import {
  applyHermeticAuditEnv,
  assertHermeticFetchAllowed,
  HermeticNetworkError,
  parseEnvFileEntries,
} from "../setup/hermetic-env"

describe("Hermetic Test Environment & Outbound Network Guard (T-039)", () => {
  it("parses .env.audit entries and deletes blank KEY='' overrides so ambient OS secrets never leak", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "alramlah-hermetic-"))
    const envPath = path.join(tmpDir, ".env.audit")
    fs.writeFileSync(
      envPath,
      [
        "# Audit env fixture",
        'DATABASE_URL="postgresql://audit:audit_local_only@127.0.0.1:54329/alramlah_audit"',
        'DATABASE_URL_POOLED="postgresql://audit:audit_local_only@127.0.0.1:54329/alramlah_audit"',
        'BETTER_AUTH_SECRET="audit_local_dummy_secret_not_for_production_0123456789abcdef"',
        'ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"',
        'OPENROUTER_API_KEY=""',
        'R2_SECRET_ACCESS_KEY=""',
        'GOTENBERG_API_URL="http://127.0.0.1:3999"',
      ].join("\n"),
      "utf8"
    )

    try {
      const parsed = parseEnvFileEntries(fs.readFileSync(envPath, "utf8"))
      expect(parsed.find((e) => e.key === "OPENROUTER_API_KEY")?.value).toBe("")

      const syntheticEnv: NodeJS.ProcessEnv = {
        NODE_ENV: "development",
        OPENROUTER_API_KEY: "sk-or-v1-leaked-ambient-host-secret-key",
        R2_SECRET_ACCESS_KEY: "live-cloudflare-r2-secret-key-from-windows-os",
        COMPOSIO_API_KEY: "live-composio-key",
      }

      applyHermeticAuditEnv(syntheticEnv, envPath)

      expect(syntheticEnv.OPENROUTER_API_KEY).toBeUndefined()
      expect(syntheticEnv.R2_SECRET_ACCESS_KEY).toBeUndefined()
      expect(syntheticEnv.COMPOSIO_API_KEY).toBeUndefined()
      expect(syntheticEnv.NODE_ENV).toBe("test")
      expect(syntheticEnv.GOTENBERG_API_URL).toBe("http://127.0.0.1:3999")
      expect(syntheticEnv.DOTENV_CONFIG_PATH).toBe(envPath)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it("supports GitHub Actions CI mode when .env.audit is absent from disk", () => {
    const missingPath = path.join(
      os.tmpdir(),
      "non-existent-dir-audit-ci",
      ".env.audit"
    )
    const ciEnv: NodeJS.ProcessEnv = {
      CI: "true",
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/alramlah_ci",
      OPENROUTER_API_KEY: "sk-or-v1-accidental-ci-secret",
    }

    applyHermeticAuditEnv(ciEnv, missingPath)

    expect(ciEnv.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/alramlah_ci"
    )
    expect(ciEnv.DATABASE_URL_POOLED).toBe(
      "postgresql://postgres:postgres@localhost:5432/alramlah_ci"
    )
    expect(ciEnv.OPENROUTER_API_KEY).toBeUndefined()
    expect(ciEnv.ENCRYPTION_KEY).toHaveLength(64)
  })

  it("hard-aborts via assertAuditSafeEnvironment on cloud database or live production URLs", () => {
    const forbiddenCloudHost = `ep-shiny-glitter.us-east-2.aws.${"neon" + ".tech"}`
    expect(() =>
      assertAuditSafeEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: `postgresql://neondb_owner:secret@${forbiddenCloudHost}/neondb`,
      })
    ).toThrow(/\[AUDIT-GUARD\]|Forbidden production/i)

    expect(() =>
      assertAuditSafeEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://audit:pass@127.0.0.1:54329/alramlah_audit",
        R2_PUBLIC_URL: "https://assets.alramlahtravels.com",
      })
    ).toThrow(/\[AUDIT-GUARD\]|Forbidden production/i)
  })

  it("blocks unmocked live internet fetch with HermeticNetworkError while permitting 127.0.0.1 and vi.spyOn mocks", async () => {
    expect(() =>
      assertHermeticFetchAllowed("https://graph.facebook.com/v21.0/me")
    ).toThrow(HermeticNetworkError)

    await expect(
      fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST" })
    ).rejects.toThrow(HermeticNetworkError)

    // Real loopback HTTP server on 127.0.0.1 MUST be allowed
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ localFake: true }))
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const port = (server.address() as AddressInfo).port

    try {
      const localRes = await fetch(`http://127.0.0.1:${port}/ping`)
      expect(localRes.status).toBe(200)
      const json = (await localRes.json()) as { localFake: boolean }
      expect(json.localFake).toBe(true)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }

    // Per-test spyOn mock MUST be allowed and cleanly restored
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ mocked: true }), { status: 200 })
    )
    const mockedRes = await fetch("https://graph.facebook.com/v21.0/123/messages")
    expect(mockedRes.status).toBe(200)
    spy.mockRestore()

    // After restore, external egress is once again blocked
    await expect(
      fetch("https://graph.facebook.com/v21.0/123/messages")
    ).rejects.toThrow(HermeticNetworkError)
  })
})
