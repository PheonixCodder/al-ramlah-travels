import fs from "node:fs"
import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"
import { FIXTURES_SUMMARY_FILE } from "../global-setup"
import type { E2eSeedFixturesSummary } from "./db"
import { E2E_MOCK_ORIGIN } from "./env"
import type { FaultRule, RecordedMockRequest } from "./mock-servers"

export function readE2eFixturesSummary(): E2eSeedFixturesSummary {
  const raw = fs.readFileSync(FIXTURES_SUMMARY_FILE, "utf8")
  return JSON.parse(raw) as E2eSeedFixturesSummary
}

export async function assertZeroSeriousOrCriticalAxeViolations(
  page: Page
): Promise<void> {
  await expect
    .poll(async () => (await page.title()).trim().length, { timeout: 5_000 })
    .toBeGreaterThan(0)

  const builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
  ])

  const results = await builder.analyze()
  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  )

  expect(
    blocking,
    `Expected 0 critical/serious WCAG 2.2 AA violations on ${page.url()}, found:\n${blocking
      .map(
        (v) =>
          `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join("; ")})`
      )
      .join("\n")}`
  ).toEqual([])
}

export async function clearMockRequests(): Promise<void> {
  const res = await fetch(`${E2E_MOCK_ORIGIN}/__mock/requests`, {
    method: "DELETE",
  })
  expect(res.ok).toBe(true)
}

export async function getMockRequests(
  contains?: string
): Promise<RecordedMockRequest[]> {
  const url = contains
    ? `${E2E_MOCK_ORIGIN}/__mock/requests?contains=${encodeURIComponent(contains)}`
    : `${E2E_MOCK_ORIGIN}/__mock/requests`
  const res = await fetch(url)
  expect(res.ok).toBe(true)
  const data = (await res.json()) as { requests: RecordedMockRequest[] }
  return data.requests
}

export async function injectMockFault(rule: FaultRule): Promise<void> {
  const res = await fetch(`${E2E_MOCK_ORIGIN}/__mock/fault`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(rule),
  })
  expect(res.ok).toBe(true)
}
