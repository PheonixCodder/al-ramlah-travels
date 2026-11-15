import dns from "node:dns"
import fs from "node:fs"
import path from "node:path"

/**
 * Hermetic runtime preload for the Playwright E2E Next.js child process:
 * 1. Blocks `fs.statSync` / `fs.readFileSync` / `fs.existsSync` on `.env` / `.env.local` / `.env.development*` / `.env.production*`
 *    in the project root so `@next/env` and `dotenv` can NEVER read live secrets from `.env`.
 * 2. Rewrites outbound `fetch()` calls targeting external provider hosts (`graph.facebook.com`, `openrouter.ai`,
 *    `generativelanguage.googleapis.com`, `assets.alramlahtravels.com`, `open.tiktokapis.com`, `*.googleapis.com`)
 *    to the local E2E mock server (`http://127.0.0.1:3998/__upstream/<host><path>`).
 * 3. Rejects any unexpected non-loopback external HTTP egress.
 */

const BLOCKED_DOTENV_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.test",
  ".env.test.local",
])

const cwdResolved = path.resolve(process.cwd()).toLowerCase()

function isBlockedDotenvFile(filePathLike) {
  if (typeof filePathLike !== "string" && !(filePathLike instanceof URL)) {
    return false
  }
  const strPath =
    filePathLike instanceof URL ? filePathLike.pathname : String(filePathLike)
  const resolved = path.resolve(strPath)
  const dirLower = path.dirname(resolved).toLowerCase()
  const baseLower = path.basename(resolved).toLowerCase()
  return dirLower === cwdResolved && BLOCKED_DOTENV_BASENAMES.has(baseLower)
}

function createEnoentError(target) {
  const err = new Error(`ENOENT: no such file or directory, open '${String(target)}'`)
  Object.assign(err, { code: "ENOENT", errno: -4058, syscall: "open", path: String(target) })
  return err
}

const origStatSync = fs.statSync.bind(fs)
fs.statSync = function patchedStatSync(target, ...rest) {
  if (isBlockedDotenvFile(target)) {
    if (rest[0] && typeof rest[0] === "object" && rest[0].throwIfNoEntry === false) {
      return undefined
    }
    throw createEnoentError(target)
  }
  return origStatSync(target, ...rest)
}

const origReadFileSync = fs.readFileSync.bind(fs)
fs.readFileSync = function patchedReadFileSync(target, ...rest) {
  if (isBlockedDotenvFile(target)) {
    throw createEnoentError(target)
  }
  return origReadFileSync(target, ...rest)
}

const origExistsSync = fs.existsSync.bind(fs)
fs.existsSync = function patchedExistsSync(target) {
  if (isBlockedDotenvFile(target)) {
    return false
  }
  return origExistsSync(target)
}

const MOCK_ORIGIN = process.env.E2E_MOCK_ORIGIN || "http://127.0.0.1:3998"
const ALLOWED_LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]", "0.0.0.0"])
const INTERCEPTED_UPSTREAM_HOSTS = new Set([
  "graph.facebook.com",
  "openrouter.ai",
  "generativelanguage.googleapis.com",
  "assets.alramlahtravels.com",
  "r2.alramlahtravels.com",
  "pub-audit-test.r2.dev",
  "images.unsplash.com",
  "plus.unsplash.com",
  "open.tiktokapis.com",
  "oauth2.googleapis.com",
  "www.googleapis.com",
  "mybusinessaccountmanagement.googleapis.com",
  "mybusinessbusinessinformation.googleapis.com",
])

const SSRF_MOCK_HOSTS = new Set([
  "assets.alramlahtravels.com",
  "r2.alramlahtravels.com",
  "pub-audit-test.r2.dev",
])

const origDnsPromisesLookup = dns.promises.lookup.bind(dns.promises)
dns.promises.lookup = async function hermeticDnsLookup(hostname, options) {
  const hostLower = String(hostname || "").toLowerCase()
  if (SSRF_MOCK_HOSTS.has(hostLower)) {
    const synthetic = { address: "93.184.216.34", family: 4 }
    if (options && typeof options === "object" && options.all) {
      return [synthetic]
    }
    return synthetic
  }
  return origDnsPromisesLookup(hostname, options)
}

const originalFetch = globalThis.fetch.bind(globalThis)

globalThis.fetch = async function hermeticE2eFetch(input, init) {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return originalFetch(input, init)
  }

  const hostLower = parsed.hostname.toLowerCase()
  if (ALLOWED_LOCAL_HOSTS.has(hostLower)) {
    return originalFetch(input, init)
  }

  if (INTERCEPTED_UPSTREAM_HOSTS.has(hostLower)) {
    const mockTarget = `${MOCK_ORIGIN}/__upstream/${hostLower}${parsed.pathname}${parsed.search}`
    const mergedHeaders = new Headers(
      input instanceof Request ? input.headers : undefined
    )
    if (init?.headers) {
      const extra = new Headers(init.headers)
      extra.forEach((value, key) => {
        mergedHeaders.set(key, value)
      })
    }
    mergedHeaders.set("x-mock-original-url", rawUrl)

    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET")
    const body =
      init?.body !== undefined
        ? init.body
        : input instanceof Request && method !== "GET" && method !== "HEAD"
          ? await input.clone().arrayBuffer()
          : undefined

    return originalFetch(mockTarget, {
      ...init,
      method,
      headers: mergedHeaders,
      body,
    })
  }

  throw new Error(
    `[E2E-HERMETIC-FETCH] Blocked unexpected external network request to ${hostLower} (${rawUrl})`
  )
}
