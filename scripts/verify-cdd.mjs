import fs from "node:fs"
import path from "node:path"

const SCRIPT_DIR =
  import.meta.dirname ??
  path.dirname(
    decodeURIComponent(
      new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
    )
  )
const WEB_DIR = path.resolve(SCRIPT_DIR, "..")
const REPO_ROOT = path.resolve(WEB_DIR, "..")

const PER_AGENTS_MAX_BYTES = 24_000
const TOTAL_AGENTS_MAX_BYTES = 120_000
const VALID_SCOPE_STATUSES = new Set([
  "done",
  "in-progress",
  "planned",
  "existing",
  "dropped",
])
const WALK_SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".agents",
  ".claude",
  ".trigger",
  "playwright-report",
  "test-results",
  "coverage",
  "dist",
  "build",
])
const CANONICAL_DESIGN_HEADINGS = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation & Depth",
  "Shapes",
  "Components",
  "Do's and Don'ts",
]

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
}

function hasExactCaseFile(dirPath, exactName) {
  if (!fs.existsSync(dirPath)) return false
  try {
    return fs.readdirSync(dirPath).includes(exactName)
  } catch {
    return false
  }
}

function stripMarkdownCode(markdown) {
  const withoutFences = markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, (m) =>
    m.replace(/[^\n]/g, "")
  )
  return withoutFences.replace(/`[^`\n]+`/g, "")
}

/**
 * Extracts relative markdown links `[label](target)` while ignoring external URLs,
 * hash-only anchors, and code blocks, and supporting balanced parentheses in Next.js
 * route groups such as `app/(public)/AGENTS.md`.
 */
function extractRelativeMarkdownLinks(markdown) {
  const cleaned = stripMarkdownCode(markdown)
  const links = []
  const lines = cleaned.split("\n")

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    let pos = 0

    while (pos < line.length) {
      const bracketClose = line.indexOf("](", pos)
      if (bracketClose === -1) break

      const openParen = bracketClose + 1
      let cursor = openParen + 1
      let rawTarget = ""

      if (line[cursor] === "<") {
        const angleClose = line.indexOf(">", cursor + 1)
        if (angleClose === -1) {
          pos = bracketClose + 2
          continue
        }
        rawTarget = line.slice(cursor + 1, angleClose).trim()
        const closingParen = line.indexOf(")", angleClose + 1)
        pos = closingParen === -1 ? angleClose + 1 : closingParen + 1
      } else {
        let depth = 1
        while (cursor < line.length && depth > 0) {
          const ch = line[cursor]
          if (ch === "\\") {
            cursor += 2
            continue
          }
          if (ch === "(") depth++
          else if (ch === ")") depth--
          if (depth > 0) cursor++
        }
        if (depth !== 0) {
          pos = bracketClose + 2
          continue
        }
        rawTarget = line.slice(openParen + 1, cursor).trim()
        pos = cursor + 1
      }

      if (!rawTarget) continue

      const titleMatch = rawTarget.match(/^(\S+?)\s+["'][\s\S]*["']$/)
      const targetNoTitle = (titleMatch ? titleMatch[1] : rawTarget).trim()
      if (!targetNoTitle || targetNoTitle.startsWith("#")) continue
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(targetNoTitle)) continue

      const noHash = targetNoTitle.split("#")[0].split("?")[0].trim()
      if (!noHash) continue

      let cleanTarget = noHash
      try {
        cleanTarget = decodeURIComponent(noHash)
      } catch {
        cleanTarget = noHash
      }

      links.push({
        line: lineIdx + 1,
        rawTarget: targetNoTitle,
        cleanTarget,
      })
    }
  }

  return links
}

function collectGovernanceDirs(dirPath, results) {
  if (!fs.existsSync(dirPath)) return
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const hasAgents = entries.some((e) => e.isFile() && e.name === "AGENTS.md")
  const hasClaude = entries.some((e) => e.isFile() && e.name === "CLAUDE.md")
  if (hasAgents || hasClaude) {
    results.push({ dirPath, hasAgents, hasClaude })
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (WALK_SKIP_DIRS.has(entry.name) || entry.name.startsWith("wt-")) continue
    collectGovernanceDirs(path.join(dirPath, entry.name), results)
  }
}

function relToRepo(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/")
}

function parseYamlFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)
  return match ? match[1] : null
}

// =============================================================================
// CHECK 1: Rules Budget & Link Integrity
// =============================================================================
function checkRulesBudgetAndLinks() {
  const failures = []
  const dirMap = new Map()

  for (const requiredDir of [REPO_ROOT, WEB_DIR]) {
    dirMap.set(requiredDir, {
      dirPath: requiredDir,
      hasAgents: hasExactCaseFile(requiredDir, "AGENTS.md"),
      hasClaude: hasExactCaseFile(requiredDir, "CLAUDE.md"),
    })
  }

  const discoveredWeb = []
  collectGovernanceDirs(WEB_DIR, discoveredWeb)
  for (const item of discoveredWeb) {
    dirMap.set(item.dirPath, item)
  }

  let totalBytes = 0
  let agentsCount = 0
  let linksChecked = 0

  for (const { dirPath, hasAgents, hasClaude } of dirMap.values()) {
    const relDir = relToRepo(dirPath) || "."
    if (!hasAgents) {
      failures.push(`Missing AGENTS.md in ${relDir}`)
      continue
    }
    if (!hasClaude) {
      failures.push(`Missing paired CLAUDE.md in ${relDir}`)
    }

    const agentsPath = path.join(dirPath, "AGENTS.md")
    const size = fs.statSync(agentsPath).size
    agentsCount++
    totalBytes += size

    if (size >= PER_AGENTS_MAX_BYTES) {
      failures.push(
        `${relToRepo(agentsPath)} exceeds ${PER_AGENTS_MAX_BYTES} byte cap (${size} bytes)`
      )
    }

    const content = readUtf8(agentsPath)
    const links = extractRelativeMarkdownLinks(content)
    for (const link of links) {
      linksChecked++
      const resolved = path.resolve(dirPath, link.cleanTarget)
      if (!fs.existsSync(resolved)) {
        failures.push(
          `${relToRepo(agentsPath)}:${link.line} broken link "${link.rawTarget}" -> ${relToRepo(resolved)}`
        )
      }
    }
  }

  if (totalBytes >= TOTAL_AGENTS_MAX_BYTES) {
    failures.push(
      `Total AGENTS.md size ${totalBytes} bytes exceeds healthy budget (${TOTAL_AGENTS_MAX_BYTES} bytes)`
    )
  }

  return {
    id: 1,
    name: "Rules Budget & Link Integrity",
    passed: failures.length === 0,
    detail: `${agentsCount} AGENTS.md (${totalBytes}B), ${linksChecked} links`,
    failures,
  }
}

// =============================================================================
// CHECK 2: Skills Registry & Frontmatter
// =============================================================================
function checkSkillsRegistryAndFrontmatter() {
  const failures = []
  const skillsJsonPath = path.join(REPO_ROOT, ".agents", "skills.json")
  const canonicalSkillsDir = path.join(WEB_DIR, ".agents", "skills")

  if (!fs.existsSync(skillsJsonPath)) {
    failures.push("Missing ../.agents/skills.json")
  } else {
    try {
      const parsed = JSON.parse(readUtf8(skillsJsonPath))
      const entries = Array.isArray(parsed.entries) ? parsed.entries : []
      const resolvesToCanonical = entries.some((entry) => {
        if (!entry || typeof entry.path !== "string") return false
        const resolved = path.resolve(REPO_ROOT, entry.path)
        return path.normalize(resolved).toLowerCase() === path.normalize(canonicalSkillsDir).toLowerCase()
      })
      if (!resolvesToCanonical) {
        failures.push(
          `../.agents/skills.json does not resolve to ${relToRepo(canonicalSkillsDir)}`
        )
      }
    } catch (err) {
      failures.push(`Invalid JSON in ../.agents/skills.json: ${err.message}`)
    }
  }

  let skillDirs = []
  if (!fs.existsSync(canonicalSkillsDir)) {
    failures.push(`Missing canonical skills directory ${relToRepo(canonicalSkillsDir)}`)
  } else {
    skillDirs = fs
      .readdirSync(canonicalSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()

    if (skillDirs.length === 0) {
      failures.push(`No skill directories found in ${relToRepo(canonicalSkillsDir)}`)
    }

    for (const dirName of skillDirs) {
      const skillDir = path.join(canonicalSkillsDir, dirName)
      if (!hasExactCaseFile(skillDir, "SKILL.md")) {
        failures.push(`Missing SKILL.md in ${relToRepo(skillDir)}`)
        continue
      }

      const md = readUtf8(path.join(skillDir, "SKILL.md"))
      const fm = parseYamlFrontmatter(md)
      if (!fm) {
        failures.push(`${relToRepo(skillDir)}/SKILL.md missing YAML frontmatter`)
        continue
      }

      const hasName = /^name:\s*["']?[^"'\n\s>|\-]+.*$/m.test(fm)
      const hasInlineDesc = /^description:\s*(?![>|]\s*$)["']?\S+.*$/m.test(fm)
      const hasBlockDesc =
        /^description:\s*[>|][+-]?\s*\n(?:[ \t]+\S.*\n?)+/m.test(fm)

      if (!hasName) {
        failures.push(`${relToRepo(skillDir)}/SKILL.md missing frontmatter "name:"`)
      }
      if (!hasInlineDesc && !hasBlockDesc) {
        failures.push(
          `${relToRepo(skillDir)}/SKILL.md missing frontmatter "description:"`
        )
      }
    }
  }

  return {
    id: 2,
    name: "Skills Registry & Frontmatter",
    passed: failures.length === 0,
    detail: `${skillDirs.length} skills verified`,
    failures,
  }
}

function normalizeMcpCommand(triggerCfg) {
  let command = String(triggerCfg?.command ?? "").trim()
  let args = Array.isArray(triggerCfg?.args) ? triggerCfg.args.map(String) : []
  if (
    command.toLowerCase() === "cmd" &&
    args[0]?.toLowerCase() === "/c" &&
    args.length > 1
  ) {
    command = args[1]
    args = args.slice(2)
  }
  return { command, args }
}

// =============================================================================
// CHECK 3: Multi-Harness MCP Parity
// =============================================================================
function checkMultiHarnessMcpParity() {
  const failures = []
  const targets = [
    path.join(REPO_ROOT, ".mcp.json"),
    path.join(WEB_DIR, ".mcp.json"),
    path.join(REPO_ROOT, ".gemini", "settings.json"),
    path.join(REPO_ROOT, ".agents", "plugins", "al-ramlah-workspace", "plugin.json"),
    path.join(REPO_ROOT, ".agents", "plugins", "al-ramlah-workspace", "mcp_config.json"),
  ]

  const deadPathPatterns = [
    /nvm4w[\\/]+nodejs[\\/]+node_modules[\\/]+trigger\.dev/i,
    /[A-Za-z]:[\\/]+nvm4w[\\/]+/i,
    /[A-Za-z]:[\\/]+Users[\\/]+[^\\/\\s"]+/i,
  ]

  const triggerFingerprints = []
  let validCount = 0

  for (const filePath of targets) {
    const rel = relToRepo(filePath)
    if (!fs.existsSync(filePath)) {
      failures.push(`Missing MCP/plugin config: ${rel}`)
      continue
    }

    const raw = readUtf8(filePath)
    for (const pattern of deadPathPatterns) {
      if (pattern.test(raw)) {
        failures.push(`${rel} contains hardcoded machine-specific path matching ${pattern}`)
      }
    }

    try {
      const parsed = JSON.parse(raw)
      validCount++
      const triggerCfg = parsed?.mcpServers?.trigger
      if (triggerCfg) {
        const normalized = normalizeMcpCommand(triggerCfg)
        triggerFingerprints.push({
          rel,
          command: normalized.command,
          args: JSON.stringify(normalized.args),
        })
      }
    } catch (err) {
      failures.push(`Invalid JSON in ${rel}: ${err.message}`)
    }
  }

  if (triggerFingerprints.length > 1) {
    const first = triggerFingerprints[0]
    for (const item of triggerFingerprints.slice(1)) {
      if (item.command !== first.command || item.args !== first.args) {
        failures.push(
          `Trigger MCP mismatch: ${item.rel} (${item.command} ${item.args}) !== ${first.rel} (${first.command} ${first.args})`
        )
      }
    }
  }

  return {
    id: 3,
    name: "Multi-Harness MCP Parity",
    passed: failures.length === 0,
    detail: `${validCount}/${targets.length} configs valid`,
    failures,
  }
}

// =============================================================================
// CHECK 4: Design CDD Integrity (DESIGN.md & PRODUCT.md)
// =============================================================================
function checkDesignCddIntegrity() {
  const failures = []
  const designLocations = [
    { dir: WEB_DIR, label: "web/DESIGN.md" },
    { dir: REPO_ROOT, label: "DESIGN.md" },
  ]
  const productLocations = [
    { dir: WEB_DIR, label: "web/PRODUCT.md" },
    { dir: REPO_ROOT, label: "PRODUCT.md" },
  ]

  let checked = 0

  for (const loc of designLocations) {
    if (!hasExactCaseFile(loc.dir, "DESIGN.md")) {
      failures.push(`Missing exact-case ${loc.label}`)
      continue
    }
    checked++
    const content = readUtf8(path.join(loc.dir, "DESIGN.md"))
    const fm = parseYamlFrontmatter(content)
    if (!fm) {
      failures.push(`${loc.label} missing YAML frontmatter (--- ... ---)`)
    } else {
      for (const key of ["name", "colors", "typography", "components"]) {
        if (!new RegExp(`^${key}:`, "m").test(fm)) {
          failures.push(`${loc.label} frontmatter missing required key "${key}:"`)
        }
      }
    }

    for (const heading of CANONICAL_DESIGN_HEADINGS) {
      const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      if (!new RegExp(`^##\\s+${escaped}\\s*$`, "m").test(content)) {
        failures.push(`${loc.label} missing canonical Stitch heading "## ${heading}"`)
      }
    }
  }

  for (const loc of productLocations) {
    if (!hasExactCaseFile(loc.dir, "PRODUCT.md")) {
      failures.push(`Missing exact-case ${loc.label}`)
      continue
    }
    checked++
    const content = readUtf8(path.join(loc.dir, "PRODUCT.md"))
    const preamble = content.split("\n").slice(0, 6).join("\n")
    const startsWithMarker =
      content.trimStart().startsWith("<!-- impeccable:product-schema 1 -->") ||
      /^<!-- impeccable:product-schema 1 -->$/m.test(preamble)
    if (!startsWithMarker) {
      failures.push(
        `${loc.label} must start with <!-- impeccable:product-schema 1 -->`
      )
    }
  }

  return {
    id: 4,
    name: "Design CDD Integrity (DESIGN.md & PRODUCT.md)",
    passed: failures.length === 0,
    detail: `${checked}/4 design docs present`,
    failures,
  }
}

// =============================================================================
// CHECK 5: SDD Artifacts Presence & INDEX Links
// =============================================================================
function checkSddArtifactsPresence() {
  const failures = []
  const required = [
    path.join(WEB_DIR, "docs", "CONSTITUTION.md"),
    path.join(WEB_DIR, "docs", "INDEX.md"),
    path.join(WEB_DIR, "docs", "specs", "_TEMPLATE.md"),
    path.join(WEB_DIR, "test-preferences.json"),
  ]

  let present = 0
  for (const filePath of required) {
    if (!fs.existsSync(filePath)) {
      failures.push(`Missing SDD artifact: ${relToRepo(filePath)}`)
    } else {
      present++
    }
  }

  const prefsPath = path.join(WEB_DIR, "test-preferences.json")
  if (fs.existsSync(prefsPath)) {
    try {
      const prefs = JSON.parse(readUtf8(prefsPath))
      if (!prefs.tool && !prefs.gate) {
        failures.push("web/test-preferences.json must define 'tool' or 'gate'")
      }
      if (!prefs.packageManager || !prefs.testDir || !prefs.runCommand) {
        failures.push(
          "web/test-preferences.json missing packageManager, testDir, or runCommand"
        )
      }
    } catch (err) {
      failures.push(`Invalid JSON in web/test-preferences.json: ${err.message}`)
    }
  }

  const indexPath = path.join(WEB_DIR, "docs", "INDEX.md")
  let linkCount = 0
  if (fs.existsSync(indexPath)) {
    const indexDir = path.dirname(indexPath)
    const links = extractRelativeMarkdownLinks(readUtf8(indexPath))
    linkCount = links.length
    for (const link of links) {
      const resolved = path.resolve(indexDir, link.cleanTarget)
      if (!fs.existsSync(resolved)) {
        failures.push(
          `web/docs/INDEX.md:${link.line} broken link "${link.rawTarget}" -> ${relToRepo(resolved)}`
        )
      }
    }
  }

  return {
    id: 5,
    name: "SDD Artifacts Presence",
    passed: failures.length === 0,
    detail: `${present}/4 artifacts, ${linkCount} INDEX links`,
    failures,
  }
}

// =============================================================================
// CHECK 6: Scope Table vs. Heading Status Parity
// =============================================================================
function parseScopeFeatureStatuses(scopeText) {
  const tableRows = new Map()
  const atGlanceMatch = scopeText.match(/## At a glance\n([\s\S]*?)(?:\n## |\n$)/)
  if (atGlanceMatch) {
    for (const line of atGlanceMatch[1].split("\n")) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("|")) continue
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim())
      if (cells.length < 4) continue
      if (!/^\d+$/.test(cells[0])) continue
      const id = Number(cells[0])
      const status = cells[3].toLowerCase()
      tableRows.set(id, { id, feature: cells[1], phase: cells[2], status })
    }
  }

  const headingRows = new Map()
  const lines = scopeText.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^###\s+(\d+)\.\s+(.+)$/)
    if (!m) continue
    const id = Number(m[1])
    const parts = m[2].split("·").slice(1).map((p) => p.trim().toLowerCase())
    const matchedStatuses = parts.filter((p) => VALID_SCOPE_STATUSES.has(p))
    headingRows.set(id, {
      id,
      line: i + 1,
      raw: lines[i],
      status: matchedStatuses.length === 1 ? matchedStatuses[0] : null,
      matchedStatuses,
    })
  }

  return { tableRows, headingRows }
}

function checkScopeParity() {
  const failures = []
  const scopePath = path.join(WEB_DIR, "docs", "scope", "scope.md")
  if (!fs.existsSync(scopePath)) {
    return {
      id: 6,
      name: "Scope Table vs. Heading Status Parity",
      passed: false,
      detail: "scope.md missing",
      failures: ["Missing web/docs/scope/scope.md"],
    }
  }

  const scopeText = readUtf8(scopePath)
  const { tableRows, headingRows } = parseScopeFeatureStatuses(scopeText)

  if (tableRows.size === 0) {
    failures.push("No rows parsed under ## At a glance in web/docs/scope/scope.md")
  }

  for (const [id, row] of tableRows) {
    if (!VALID_SCOPE_STATUSES.has(row.status)) {
      failures.push(`scope.md table #${id} has invalid status "${row.status}"`)
    }
    const heading = headingRows.get(id)
    if (!heading) {
      failures.push(`scope.md table #${id} has no matching ### ${id}. heading`)
      continue
    }
    if (!heading.status) {
      failures.push(
        `scope.md:${heading.line} heading #${id} lacks unambiguous status (${heading.matchedStatuses.join(", ") || "none"})`
      )
      continue
    }
    if (row.status !== heading.status) {
      failures.push(
        `scope.md #${id} status mismatch: table="${row.status}" vs heading="${heading.status}" (line ${heading.line})`
      )
    }
  }

  for (const [id, heading] of headingRows) {
    if (!tableRows.has(id)) {
      failures.push(
        `scope.md:${heading.line} heading #${id} (${heading.status ?? "unknown"}) missing from ## At a glance table`
      )
    }
  }

  return {
    id: 6,
    name: "Scope Table vs. Heading Status Parity",
    passed: failures.length === 0,
    detail: `${tableRows.size} table rows vs ${headingRows.size} headings`,
    failures,
  }
}

// =============================================================================
// CHECK 7: Spec Lifecycle & 0026+ Contract Gate
// =============================================================================
function checkSpecLifecycleAndContract() {
  const failures = []
  const specsDir = path.join(WEB_DIR, "docs", "specs")
  if (!fs.existsSync(specsDir)) {
    return {
      id: 7,
      name: "Spec Lifecycle & 0026+ Contract Gate",
      passed: false,
      detail: "docs/specs missing",
      failures: ["Missing web/docs/specs directory"],
    }
  }

  const scopePath = path.join(WEB_DIR, "docs", "scope", "scope.md")
  const doneSpecsInScope = new Set()
  if (fs.existsSync(scopePath)) {
    const scopeText = readUtf8(scopePath)
    const { headingRows } = parseScopeFeatureStatuses(scopeText)
    const lines = scopeText.split("\n")
    let currentFeatureId = null
    for (const line of lines) {
      const h = line.match(/^###\s+(\d+)\.\s+/)
      if (h) currentFeatureId = Number(h[1])
      if (currentFeatureId !== null) {
        const specLink = line.match(
          /docs\/specs\/(\d{4}-[^)\s]+(?:\.md|\/index\.md))/
        )
        if (specLink && headingRows.get(currentFeatureId)?.status === "done") {
          doneSpecsInScope.add(specLink[1])
        }
      }
    }
  }

  const specEntries = []
  for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
    if (entry.isFile() && /^\d{4}-.*\.md$/.test(entry.name)) {
      specEntries.push({
        relName: entry.name,
        absPath: path.join(specsDir, entry.name),
      })
    } else if (entry.isDirectory() && /^\d{4}-/.test(entry.name)) {
      const indexFile = path.join(specsDir, entry.name, "index.md")
      if (fs.existsSync(indexFile)) {
        specEntries.push({
          relName: `${entry.name}/index.md`,
          absPath: indexFile,
        })
      } else {
        failures.push(
          `web/docs/specs/${entry.name}/ directory spec is missing index.md`
        )
      }
    }
  }
  specEntries.sort((a, b) => a.relName.localeCompare(b.relName))

  let futureCount = 0
  for (const { relName: file, absPath } of specEntries) {
    const specNum = Number.parseInt(file.slice(0, 4), 10)
    const content = readUtf8(absPath)
    const header = content.split("\n").slice(0, 25).join("\n")
    const statusMatch = header.match(/^\s*(?:[-*]\s*)?\*\*Status\*\*:\s*(.+)$/m)

    if (!statusMatch || !statusMatch[1].trim()) {
      failures.push(`web/docs/specs/${file} missing **Status**: metadata line`)
      continue
    }

    const statusValue = statusMatch[1].trim()

    if (specNum <= 25) {
      if (specNum <= 23) {
        if (/^(Proposed|Approved(?:\s*\(Implemented\))?|In Progress)\b/i.test(statusValue)) {
          failures.push(
            `web/docs/specs/${file} has stale status "${statusValue}" (expected Accepted (Implemented))`
          )
        } else if (!/^(Accepted|Superseded)\b/i.test(statusValue)) {
          failures.push(
            `web/docs/specs/${file} has unexpected status "${statusValue}"`
          )
        }
      } else {
        if (/^(Proposed|In Progress)\b/i.test(statusValue)) {
          failures.push(
            `web/docs/specs/${file} has unfinished status "${statusValue}"`
          )
        }
      }
      if (doneSpecsInScope.has(file) && /^(Proposed|In Progress)\b/i.test(statusValue)) {
        failures.push(
          `web/docs/specs/${file} is linked to a "done" feature in scope.md but status is "${statusValue}"`
        )
      }
    } else {
      futureCount++
      if (!/^(Proposed|In Progress|Accepted|Assumed|Superseded)\b/i.test(statusValue)) {
        failures.push(
          `web/docs/specs/${file} invalid 0026+ status "${statusValue}"`
        )
      }
      if (!/\bAC-1\b/.test(content)) {
        failures.push(`web/docs/specs/${file} missing required AC-1 acceptance criterion`)
      }
      if (!/Owned Paths/i.test(content)) {
        failures.push(`web/docs/specs/${file} missing required Owned Paths boundary`)
      }
      if (!/Value Sourcing/i.test(content)) {
        failures.push(`web/docs/specs/${file} missing required Value Sourcing section`)
      }
    }
  }

  return {
    id: 7,
    name: "Spec Lifecycle & 0026+ Contract Gate",
    passed: failures.length === 0,
    detail: `${specEntries.length} specs (${futureCount} 0026+)`,
    failures,
  }
}

function main() {
  const results = [
    checkRulesBudgetAndLinks(),
    checkSkillsRegistryAndFrontmatter(),
    checkMultiHarnessMcpParity(),
    checkDesignCddIntegrity(),
    checkSddArtifactsPresence(),
    checkScopeParity(),
    checkSpecLifecycleAndContract(),
  ]

  console.log("\nAl Ramlah Travels — CDD & SDD Governance Verification")
  console.log("=".repeat(86))
  console.log(
    `${"#".padEnd(3)} ${"Check".padEnd(45)} ${"Status".padEnd(8)} Details`
  )
  console.log("-".repeat(86))
  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL"
    console.log(
      `${String(r.id).padEnd(3)} ${r.name.padEnd(45)} ${status.padEnd(8)} ${r.detail}`
    )
  }
  console.log("=".repeat(86))

  const failedChecks = results.filter((r) => !r.passed)
  if (failedChecks.length > 0) {
    console.error("\nFailures:")
    for (const r of failedChecks) {
      console.error(`\n[${r.id}] ${r.name}:`)
      for (const msg of r.failures) {
        console.error(`  - ${msg}`)
      }
    }
    console.error("")
    process.exit(1)
  }

  console.log("\nAll 7 CDD & SDD governance gates passed.\n")
  process.exit(0)
}

main()
