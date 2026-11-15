/**
 * Pure client-and-server safe ReDoS validator for WhatsApp keyword `REGEX` rules (`T-030`).
 * Rejects patterns `> 120` chars, backreferences (`\1`), lookarounds with inner quantifiers,
 * nested quantifiers (`(a+)+`, `(.*a){2,}`, `([a-z]+)*`), and quantified alternations (`(a|aa)+`).
 */
export function isSafeAutoReplyRegex(pattern: string): boolean {
  if (!pattern || typeof pattern !== "string") return false
  const trimmed = pattern.trim()
  if (!trimmed || trimmed.length > 120) return false

  // Reject backreferences which are non-regular and exponential on backtracking
  if (/\\[1-9]/.test(trimmed)) return false

  // Reject lookaround assertions with quantifiers inside
  if (/\(\?[<=!][^)]*[+*]/.test(trimmed)) return false

  // Walk parenthesized groups to detect nested quantifiers or overlapping quantified alternations
  const groupHasInnerQuantifier: boolean[] = []
  let escaped = false

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === "\\") {
      escaped = true
      continue
    }
    if (ch === "(") {
      groupHasInnerQuantifier.push(false)
      continue
    }
    if (ch === "+" || ch === "*") {
      if (groupHasInnerQuantifier.length > 0) {
        groupHasInnerQuantifier[groupHasInnerQuantifier.length - 1] = true
      }
      continue
    }
    if (ch === "{") {
      const closeBrace = trimmed.indexOf("}", i + 1)
      if (
        closeBrace !== -1 &&
        /^\d+(?:,\d*)?$/.test(trimmed.slice(i + 1, closeBrace))
      ) {
        if (groupHasInnerQuantifier.length > 0) {
          groupHasInnerQuantifier[groupHasInnerQuantifier.length - 1] = true
        }
      }
      continue
    }
    if (ch === ")") {
      const hadInnerQuantifier = groupHasInnerQuantifier.pop() ?? false
      const afterGroup = trimmed.slice(i + 1)
      const followedByQuantifier = /^(?:\+|\*|\?|\{\d+(?:,\d*)?\})/.test(
        afterGroup
      )
      if (hadInnerQuantifier && followedByQuantifier) {
        return false
      }
      // Propagate inner quantifier flag up to enclosing group
      if (hadInnerQuantifier && groupHasInnerQuantifier.length > 0) {
        groupHasInnerQuantifier[groupHasInnerQuantifier.length - 1] = true
      }
    }
  }

  // Also reject quantified alternation groups like `(a|aa)+` or `(foo|foobar)*`
  if (/\([^()]*\|[^()]*\)\s*(?:\+|\*|\{\d+,\d*\})/.test(trimmed)) {
    return false
  }

  try {
    new RegExp(trimmed, "i")
    return true
  } catch {
    return false
  }
}
