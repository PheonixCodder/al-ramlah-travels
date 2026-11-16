import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const UNIT_DIR = path.dirname(fileURLToPath(import.meta.url))
const RUNBOOKS_DIR = path.resolve(UNIT_DIR, "../../docs/audit/runbooks")

const EXPECTED_RUNBOOK_PREFIXES = [
  "RB-01-",
  "RB-02-",
  "RB-03-",
  "RB-04-",
  "RB-05-",
  "RB-06-",
  "RB-07-",
  "RB-08-",
  "RB-09-",
  "RB-10-",
] as const

describe("Operational Runbooks Presence & Structure (T-097)", () => {
  it("contains all 10 non-empty RB-01..RB-10 runbooks with scrypt, ENCRYPTION_KEY_PREVIOUS, and PITR procedures", () => {
    expect(fs.existsSync(RUNBOOKS_DIR)).toBe(true)

    const entries = fs
      .readdirSync(RUNBOOKS_DIR)
      .filter((name) => name.endsWith(".md"))
      .sort()

    expect(entries.length).toBeGreaterThanOrEqual(10)

    const combinedTexts: string[] = []

    for (const prefix of EXPECTED_RUNBOOK_PREFIXES) {
      const match = entries.find((name) => name.startsWith(prefix))
      expect(match, `Missing runbook starting with ${prefix}`).toBeDefined()

      const filePath = path.join(RUNBOOKS_DIR, match!)
      const content = fs.readFileSync(filePath, "utf8").trim()
      expect(
        content.length,
        `Runbook ${match} must be substantive (>500 chars)`
      ).toBeGreaterThan(500)
      expect(content.startsWith("#")).toBe(true)
      combinedTexts.push(content)
    }

    const corpus = combinedTexts.join("\n")
    expect(corpus).toMatch(/scrypt/i)
    expect(corpus).toMatch(/ENCRYPTION_KEY_PREVIOUS/)
    expect(corpus).toMatch(/PITR/)
    expect(corpus).toContain("Askari 10")
    expect(corpus).not.toMatch(/sk-or-v1-[A-Za-z0-9]{16,}/)
    expect(corpus).not.toMatch(/npg_[A-Za-z0-9]{12,}/)
  })
})
