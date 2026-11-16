import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ORACLE_DIR = path.resolve(__dirname, "../../../../scripts/oracle-gotenberg")

describe("F-INFRA T-051: Oracle Cloud Always Free Gotenberg Hardening & Font/SSRF Lockdown", () => {
  it("T-051: pins gotenberg:8.17.x, disables Chromium JS, blocks IMDS/RFC1918/localhost, and sets non-Swarm Compose limits", () => {
    const composeRaw = fs.readFileSync(
      path.join(ORACLE_DIR, "docker-compose.yml"),
      "utf8"
    )

    assert.match(
      composeRaw,
      /image:\s*gotenberg\/gotenberg:8\.17(\.\d+)?\b/,
      "docker-compose.yml must pin gotenberg/gotenberg:8.17(.x) instead of floating :8"
    )
    assert.ok(
      composeRaw.includes("--chromium-disable-javascript=true"),
      "Gotenberg must run with --chromium-disable-javascript=true"
    )
    assert.ok(
      !composeRaw.includes("--chromium-disable-javascript=false"),
      "Gotenberg must not leave JavaScript enabled"
    )
    assert.match(
      composeRaw,
      /--chromium-allow-list=\^data:\|\^https:\/\//,
      "Gotenberg must enforce --chromium-allow-list=^data:|^https://"
    )
    assert.ok(
      composeRaw.includes("--chromium-deny-list=") &&
        composeRaw.includes("169\\.254") &&
        composeRaw.includes("127\\.") &&
        composeRaw.includes("192\\.168\\.") &&
        composeRaw.includes("localhost"),
      "Gotenberg --chromium-deny-list must block 169.254.169.254 IMDS, RFC1918, and localhost"
    )
    assert.match(composeRaw, /^\s*mem_limit:\s*\S+/m, "Must set non-Swarm mem_limit")
    assert.match(composeRaw, /^\s*cpus:\s*\S+/m, "Must set non-Swarm cpus")
    assert.match(composeRaw, /^\s*shm_size:\s*\S+/m, "Must set shm_size for 4K Chromium canvases")
    assert.match(
      composeRaw,
      /\$\{GOTENBERG_API_KEY:\?[^}]+\}/,
      "Caddy GOTENBERG_API_KEY must fail closed if unset via ${GOTENBERG_API_KEY:?...}"
    )
    assert.match(
      composeRaw,
      /internal:\s*true/,
      "Gotenberg internal Docker bridge must set internal: true to prevent internet egress"
    )
  })

  it("T-051 & OD-07: installs Noto Arabic/Urdu + Amiri + Inter fonts, hardens Caddy bearer auth without secret echoes, removes c:/dev links, and documents OCI PAYG", () => {
    const caddyRaw = fs.readFileSync(path.join(ORACLE_DIR, "Caddyfile"), "utf8")
    const setupRaw = fs.readFileSync(
      path.join(ORACLE_DIR, "setup-oracle-arm.sh"),
      "utf8"
    )
    const readmeRaw = fs.readFileSync(path.join(ORACLE_DIR, "README.md"), "utf8")
    const envExampleRaw = fs.readFileSync(
      path.join(ORACLE_DIR, ".env.example"),
      "utf8"
    )

    // Caddyfile bearer auth + body cap + log redaction
    assert.match(caddyRaw, /Authorization\s+"Bearer\s+\{\$GOTENBERG_API_KEY\}"/)
    assert.match(caddyRaw, /max_size\s+20MB/i)
    assert.match(caddyRaw, /respond\s+.*"Unauthorized"\s+401|respond\s+"Unauthorized"\s+401/)

    // setup-oracle-arm.sh installs Arabic/Urdu + Inter fonts & never echoes GOTENBERG_API_KEY
    for (const pkg of [
      "fonts-noto-core",
      "fonts-hosny-amiri",
      "fonts-noto-color-emoji",
      "fonts-inter",
    ]) {
      assert.ok(
        setupRaw.includes(pkg),
        `setup-oracle-arm.sh must install ${pkg}`
      )
    }
    assert.ok(
      !setupRaw.includes('Gotenberg API Key:${NC}     ${GOTENBERG_API_KEY}') &&
        !setupRaw.includes('GOTENBERG_API_KEY="${GOTENBERG_API_KEY}"'),
      "setup-oracle-arm.sh must never echo plaintext GOTENBERG_API_KEY to terminal stdout"
    )

    // README & .env.example contain zero hardcoded C:\dev or file:///C:/dev paths and document PAYG Always Free
    for (const [name, content] of [
      ["README.md", readmeRaw],
      ["setup-oracle-arm.sh", setupRaw],
      ["Caddyfile", caddyRaw],
      [".env.example", envExampleRaw],
    ] as const) {
      assert.ok(
        !/c:[/\\]dev/i.test(content),
        `${name} must contain zero hardcoded c:/dev or C:\\dev workstation paths`
      )
    }

    assert.match(
      readmeRaw,
      /Pay-As-You-Go|PAYG/i,
      "README.md must document Oracle PAYG Always Free setup ($0 without idle VM reclamation)"
    )
  })
})
