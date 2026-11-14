import dns from "node:dns"
import net from "node:net"

export class SSRFBlockedError extends Error {
  public readonly code = "SSRF_BLOCKED"

  constructor(message: string) {
    super(message)
    this.name = "SSRFBlockedError"
  }
}

export interface SafeExternalUrlOptions {
  allowedHosts?: string[]
  allowHttpInDev?: boolean
  resolveDns?: boolean
  dnsLookup?: (
    hostname: string
  ) => Promise<Array<{ address: string; family: number }>>
}

function parseIpv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  const nums = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return -1
    const val = Number(part)
    return val >= 0 && val <= 255 ? val : -1
  })
  if (nums.some((n) => n < 0)) return null
  return [nums[0]!, nums[1]!, nums[2]!, nums[3]!]
}

export function isPrivateOrReservedIpv4(ip: string): boolean {
  const octets = parseIpv4Octets(ip)
  if (!octets) return true
  const [a, b, c] = octets

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true
  // 10.0.0.0/8 (RFC1918 private)
  if (a === 10) return true
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true
  // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true
  // 172.16.0.0/12 (RFC1918 private)
  if (a === 172 && b >= 16 && b <= 31) return true
  // 192.0.0.0/24 & 192.0.2.0/24 (IETF / TEST-NET-1)
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true
  // 192.168.0.0/16 (RFC1918 private)
  if (a === 192 && b === 168) return true
  // 198.18.0.0/15 (Benchmarking) & 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return true
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved / Broadcast)
  if (a >= 224) return true

  return false
}

export function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().replace(/^\[|\]$/g, "").split("%")[0] ?? ""
  const version = net.isIP(ip)
  if (version === 4) {
    return isPrivateOrReservedIpv4(ip)
  }
  if (version !== 6) {
    return true
  }

  const normalized = ip.toLowerCase()
  if (normalized === "::" || normalized === "::1") {
    return true
  }

  // IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.startsWith("::ffff:")) {
    const tail = normalized.slice("::ffff:".length)
    if (net.isIPv4(tail)) {
      return isPrivateOrReservedIpv4(tail)
    }
    const hexParts = tail.split(":")
    if (hexParts.length === 2) {
      const hi = Number.parseInt(hexParts[0] ?? "", 16)
      const lo = Number.parseInt(hexParts[1] ?? "", 16)
      if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
        const mappedV4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
        return isPrivateOrReservedIpv4(mappedV4)
      }
    }
    return true
  }

  // Unique Local Addresses fc00::/7 (fc00..fdff)
  if (/^f[cd][0-9a-f]{2}:/.test(normalized) || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true
  }

  // Link-Local fe80::/10 (fe80..febf)
  if (/^fe[89ab][0-9a-f]?:/.test(normalized)) {
    return true
  }

  // Documentation 2001:db8::/32 & Multicast ff00::/8
  if (normalized.startsWith("2001:db8:") || normalized.startsWith("ff")) {
    return true
  }

  return false
}

function hostMatchesAllowlist(hostname: string, allowedHosts: string[]): boolean {
  const lowerHost = hostname.toLowerCase()
  return allowedHosts.some((pattern) => {
    const clean = pattern.trim().toLowerCase()
    if (!clean) return false
    if (clean.startsWith("*.")) {
      const suffix = clean.slice(1) // ".r2.dev"
      return lowerHost.endsWith(suffix) && lowerHost.length > suffix.length
    }
    return lowerHost === clean
  })
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "kubernetes.default",
  "kubernetes.default.svc",
])

/**
 * Validates an outbound URL against local path traversal, non-HTTPS schemes,
 * internal hostnames, RFC1918/loopback/link-local/metadata IPs, and DNS rebinding.
 */
export async function assertSafeExternalUrl(
  rawUrl: string,
  options: SafeExternalUrlOptions = {}
): Promise<URL> {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    throw new SSRFBlockedError("External URL must be a non-empty string")
  }

  const trimmed = rawUrl.trim()

  // Reject local file paths, UNC paths, Windows drive paths, and relative traversal
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    trimmed.startsWith(".") ||
    /^[a-zA-Z]:[\\/]/.test(trimmed)
  ) {
    throw new SSRFBlockedError("Local filesystem paths are forbidden")
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new SSRFBlockedError("Malformed URL")
  }

  const allowHttp =
    Boolean(options.allowHttpInDev) && process.env.NODE_ENV !== "production"

  if (
    parsed.protocol !== "https:" &&
    !(allowHttp && parsed.protocol === "http:")
  ) {
    throw new SSRFBlockedError(
      `Disallowed URL protocol "${parsed.protocol}" (expected https:)`
    )
  }

  if (parsed.username || parsed.password) {
    throw new SSRFBlockedError("Embedded URL credentials are forbidden")
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (
    !hostname ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    throw new SSRFBlockedError(`Blocked internal hostname "${hostname}"`)
  }

  // Reject numeric/octal/hex IP encodings and direct private IP literals
  if (net.isIP(hostname) !== 0 || /^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) {
    if (net.isIP(hostname) === 0 || isPrivateOrReservedIp(hostname)) {
      throw new SSRFBlockedError(
        `Blocked private, loopback, or reserved IP literal "${hostname}"`
      )
    }
  }

  if (options.allowedHosts && options.allowedHosts.length > 0) {
    if (!hostMatchesAllowlist(hostname, options.allowedHosts)) {
      throw new SSRFBlockedError(
        `Hostname "${hostname}" is not in the permitted outbound host allowlist`
      )
    }
  }

  const shouldResolveDns = options.resolveDns !== false && net.isIP(hostname) === 0
  if (shouldResolveDns) {
    const lookupFn =
      options.dnsLookup ??
      ((host: string) => dns.promises.lookup(host, { all: true, verbatim: true }))

    let records: Array<{ address: string; family: number }>
    try {
      records = await lookupFn(hostname)
    } catch {
      throw new SSRFBlockedError(`Unable to resolve DNS for "${hostname}"`)
    }

    if (!records || records.length === 0) {
      throw new SSRFBlockedError(`DNS lookup returned zero records for "${hostname}"`)
    }

    for (const record of records) {
      if (isPrivateOrReservedIp(record.address)) {
        throw new SSRFBlockedError(
          `DNS resolution for "${hostname}" pointed to blocked private/reserved IP`
        )
      }
    }
  }

  return parsed
}
