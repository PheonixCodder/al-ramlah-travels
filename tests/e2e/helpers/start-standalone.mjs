import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const HELPERS_DIR = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(HELPERS_DIR, "../../..")
const STANDALONE_DIR = path.join(WEB_ROOT, ".next", "standalone")
const STANDALONE_SERVER = path.join(STANDALONE_DIR, "server.js")

if (!fs.existsSync(STANDALONE_SERVER)) {
  throw new Error(
    `[E2E-STANDALONE] Missing ${STANDALONE_SERVER}. Run 'next build' before starting standalone E2E server.`
  )
}

const buildIdPath = path.join(WEB_ROOT, ".next", "BUILD_ID")
const currentBuildId = fs.existsSync(buildIdPath)
  ? fs.readFileSync(buildIdPath, "utf8").trim()
  : ""
const syncedMarkerPath = path.join(STANDALONE_DIR, ".e2e-synced-build-id")
const syncedBuildId = fs.existsSync(syncedMarkerPath)
  ? fs.readFileSync(syncedMarkerPath, "utf8").trim()
  : ""

const dstStatic = path.join(STANDALONE_DIR, ".next", "static")
if (!currentBuildId || currentBuildId !== syncedBuildId || !fs.existsSync(dstStatic)) {
  const srcStatic = path.join(WEB_ROOT, ".next", "static")
  if (fs.existsSync(srcStatic)) {
    fs.cpSync(srcStatic, dstStatic, { recursive: true, force: true })
  }
  const srcPublic = path.join(WEB_ROOT, "public")
  const dstPublic = path.join(STANDALONE_DIR, "public")
  if (fs.existsSync(srcPublic)) {
    fs.cpSync(srcPublic, dstPublic, { recursive: true, force: true })
  }
  if (currentBuildId) {
    fs.writeFileSync(syncedMarkerPath, currentBuildId, "utf8")
  }
}

// Ensure `@img` inside `.next/standalone/node_modules/@img` includes native `libvips*.dll`/`.so` omitted by NFT
const srcImgPkg = path.join(WEB_ROOT, "node_modules", "@img")
const dstImgPkg = path.join(STANDALONE_DIR, "node_modules", "@img")
const dstLibvipsWin = path.join(
  dstImgPkg,
  "sharp-libvips-win32-x64",
  "lib",
  "libvips-42.dll"
)
if (
  fs.existsSync(srcImgPkg) &&
  (process.platform === "win32" ? !fs.existsSync(dstLibvipsWin) : !fs.existsSync(dstImgPkg))
) {
  fs.cpSync(srcImgPkg, dstImgPkg, { recursive: true, force: true })
}

// Loopback-only guard when `npm run build` ran prior to `AUDIT_E2E_LOCAL=1`
const dbUrl = process.env.DATABASE_URL ?? ""
if (
  process.env.AUDIT_E2E_LOCAL === "1" &&
  (dbUrl.includes("127.0.0.1") || dbUrl.includes("localhost"))
) {
  const port = process.env.PORT || "3123"
  const serverSrc = fs.readFileSync(STANDALONE_SERVER, "utf8")
  const emptyAllowed = '"allowedOrigins":[]'
  if (serverSrc.includes(emptyAllowed)) {
    const patched = serverSrc.replace(
      emptyAllowed,
      `"allowedOrigins":["127.0.0.1:${port}","localhost:${port}","127.0.0.1","localhost"]`
    )
    fs.writeFileSync(STANDALONE_SERVER, patched, "utf8")
  }

  const serverChunksDir = path.join(STANDALONE_DIR, ".next", "server", "chunks")
  if (fs.existsSync(serverChunksDir)) {
    for (const name of fs.readdirSync(serverChunksDir)) {
      if (!name.endsWith(".js")) continue
      const chunkFile = path.join(serverChunksDir, name)
      const chunkText = fs.readFileSync(chunkFile, "utf8")
      if (chunkText.includes("upgrade-insecure-requests")) {
        fs.writeFileSync(
          chunkFile,
          chunkText.replace(/["']upgrade-insecure-requests["']/g, '""'),
          "utf8"
        )
      }
    }
  }

  // Drop build-time prerendered `/` snapshot inside standalone so first request after
  // `globalSetup` `ensureE2eBaselineFixtures()` renders `/` fresh against seeded E2E DB.
  const serverAppDir = path.join(STANDALONE_DIR, ".next", "server", "app")
  for (const entryName of ["index.html", "index.rsc", "index.meta", "index.segments"]) {
    const entryPath = path.join(serverAppDir, entryName)
    if (fs.existsSync(entryPath)) {
      fs.rmSync(entryPath, { recursive: true, force: true })
    }
  }
}

process.env.HOSTNAME = "127.0.0.1"
process.env.PORT = process.env.PORT || "3123"

await import(pathToFileURL(STANDALONE_SERVER).href)
