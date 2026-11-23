import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { buildNextConfig } from "../../../next.config"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, "../../..")

describe("F-PLAT: Dependencies, Next Config, Docker/Nginx & Repo Hygiene (T-001, T-002, T-044, T-045, T-047, T-094)", () => {
  it("T-001 & T-047: enforces patched Next.js >=16.4.x, pino in dependencies, shadcn in devDependencies, and removes unused cn/react-is", () => {
    const pkgRaw = fs.readFileSync(path.join(WEB_ROOT, "package.json"), "utf8")
    const pkg = JSON.parse(pkgRaw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    const deps = pkg.dependencies ?? {}
    const devDeps = pkg.devDependencies ?? {}

    const nextVer = (deps.next ?? "").replace(/^[\^~]/, "")
    const [majorStr, minorStr] = nextVer.split(".")
    assert.equal(Number(majorStr), 16)
    assert.ok(
      Number(minorStr) >= 4,
      `Expected next >= 16.4.0, got ${deps.next}`
    )

    assert.ok(deps.pino, "pino must be explicitly declared in dependencies")
    assert.ok(deps.pg, "pg must be declared in dependencies for local/CI TCP driver")
    assert.ok(deps.resend, "resend must be declared in dependencies")
    assert.equal(deps.shadcn, undefined, "shadcn CLI must not be in production dependencies")
    assert.ok(devDeps.shadcn, "shadcn CLI must live in devDependencies")
    assert.equal(deps.cn, undefined, "unused 'cn' package must be removed")
    assert.equal(deps["react-is"], undefined, "unused 'react-is' must be removed")
    assert.ok(
      !/^[\^~]/.test(deps["@whiskeysockets/baileys"] ?? ""),
      "@whiskeysockets/baileys must be pinned to an exact version if present"
    )
  })

  it("T-002 & T-045: locks next.config.ts production image allowlist, blocks tunnel origins, aligns bodySizeLimit, and excludes .env/uploads from NFT", async () => {
    const prodConfig = buildNextConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://alramlahtravels.com",
      BETTER_AUTH_URL: "https://alramlahtravels.com",
      R2_PUBLIC_URL: "https://cdn.alramlahtravels.com",
      VERCEL_URL: "",
      VERCEL_PROJECT_PRODUCTION_URL: "",
    })

    const patterns = prodConfig.images?.remotePatterns ?? []
    assert.ok(patterns.length > 0)
    for (const pattern of patterns) {
      assert.equal(pattern.protocol, "https")
      assert.ok(
        !pattern.hostname.includes("**"),
        `Wildcard '**' forbidden in remotePatterns: ${pattern.hostname}`
      )
    }

    const allowedOrigins =
      prodConfig.experimental?.serverActions?.allowedOrigins ?? []
    assert.deepEqual(allowedOrigins, [
      "alramlahtravels.com",
      "www.alramlahtravels.com",
      "al-ramlah-travels.vercel.app",
      "*.vercel.app",
    ])
    for (const origin of allowedOrigins) {
      assert.ok(
        !/ngrok|trycloudflare|devtunnels|localhost|127\.0\.0\.1/i.test(origin),
        `Tunnel or loopback origin forbidden in production: ${origin}`
      )
    }
    assert.equal(
      prodConfig.experimental?.serverActions?.bodySizeLimit,
      "4mb"
    )
    assert.equal(prodConfig.allowedDevOrigins, undefined)

    const traceExcludes = prodConfig.outputFileTracingExcludes?.["/*"] ?? []
    assert.ok(traceExcludes.includes("./.env*"))
    assert.ok(traceExcludes.includes("./public/uploads/**/*"))

    const redirects = await prodConfig.redirects!()
    assert.ok(redirects.length >= 13)
    assert.ok(
      redirects.some(
        (r) =>
          r.source === "/admin/hotels" &&
          r.destination === "/admin/catalog?tab=hotels" &&
          r.permanent === true
      )
    )
  })

  it("T-044 & T-094: removes pnpm lockfiles, cleans tsconfig exclusions, scrubs .mcp.json Windows paths, and hardens .gitignore", () => {
    assert.equal(
      fs.existsSync(path.join(WEB_ROOT, "pnpm-lock.yaml")),
      false,
      "pnpm-lock.yaml must be deleted"
    )
    assert.equal(
      fs.existsSync(path.join(WEB_ROOT, "pnpm-workspace.yaml")),
      false,
      "pnpm-workspace.yaml must be deleted"
    )
    assert.equal(
      fs.existsSync(
        path.join(
          WEB_ROOT,
          "public/uploads/sample-posts/zahoor-adil-rafi-quotation.pdf"
        )
      ),
      false,
      "Real client PII quotation PDF must be removed from public/uploads"
    )

    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(WEB_ROOT, "tsconfig.json"), "utf8")
    ) as { exclude?: string[] }
    const excludes = tsconfig.exclude ?? []
    assert.ok(excludes.includes("../services"))
    assert.ok(excludes.includes(".trigger"))
    assert.ok(excludes.includes("public/uploads"))

    const mcpRaw = fs.readFileSync(path.join(WEB_ROOT, ".mcp.json"), "utf8")
    assert.ok(
      !/[cC]:\\/.test(mcpRaw),
      ".mcp.json must not contain hardcoded Windows drive paths"
    )

    const gitignore = fs.readFileSync(path.join(WEB_ROOT, ".gitignore"), "utf8")
    assert.match(gitignore, /\.env\*/)
    assert.match(gitignore, /!\.env\.example/)
    assert.match(gitignore, /\.trigger\//)
    assert.match(gitignore, /\.next-dev\.log/)
    assert.match(gitignore, /tsconfig\.tsbuildinfo/)
    assert.match(gitignore, /public\/uploads\/r2-local\//)
  })

  it("T-045: Dockerfile uses node:22-alpine + non-root user + HEALTHCHECK, .dockerignore excludes .env*, and nginx.conf enforces TLS & rate-limits", () => {
    const dockerfile = fs.readFileSync(
      path.join(WEB_ROOT, "Dockerfile"),
      "utf8"
    )
    assert.match(dockerfile, /FROM node:22-alpine/)
    assert.ok(!dockerfile.includes("node:20-alpine"))
    assert.match(dockerfile, /USER nextjs/)
    assert.match(dockerfile, /HEALTHCHECK/)
    assert.match(dockerfile, /\/api\/health/)

    const dockerignore = fs.readFileSync(
      path.join(WEB_ROOT, ".dockerignore"),
      "utf8"
    )
    assert.match(dockerignore, /\.env\*/)

    const nginxConf = fs.readFileSync(
      path.join(WEB_ROOT, "nginx/nginx.conf"),
      "utf8"
    )
    assert.match(nginxConf, /listen 443 ssl/)
    assert.match(nginxConf, /return 301 https:\/\/\$host\$request_uri/)
    assert.match(nginxConf, /limit_req_zone/)
    assert.match(nginxConf, /client_max_body_size 25m/)
  })
})
