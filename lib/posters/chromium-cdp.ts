import type { ChildProcess } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type WebSocket from "ws"
import {
  escapeAttr,
  escapeHtml,
  sanitizeSafeUrl,
} from "@/lib/security/html-escape"

function getChromeCandidates(): string[] {
  return [
    process.env.CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()))
}

export async function findChromeExecutable(): Promise<string> {
  for (const candidate of getChromeCandidates()) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Try next candidate
    }
  }
  throw new Error(
    "Could not locate Google Chrome or Microsoft Edge executable for local CDP rendering."
  )
}

interface CachedCompanyLogo {
  base64: string
  mimeType: "image/png" | "image/jpeg"
}

let cachedCompanyLogo: CachedCompanyLogo | null = null

async function loadCompanyLogo(): Promise<CachedCompanyLogo> {
  if (cachedCompanyLogo) {
    return cachedCompanyLogo
  }

  const candidates: Array<{
    filePath: string
    mimeType: "image/png" | "image/jpeg"
  }> = [
    {
      filePath: path.join(process.cwd(), "public", "logo-icon.png"),
      mimeType: "image/png",
    },
    {
      filePath: path.join(process.cwd(), "public", "logo.jpg"),
      mimeType: "image/jpeg",
    },
  ]

  for (const candidate of candidates) {
    try {
      const buf = await fs.readFile(/*turbopackIgnore: true*/ candidate.filePath)
      const loaded: CachedCompanyLogo = {
        base64: buf.toString("base64"),
        mimeType: candidate.mimeType,
      }
      cachedCompanyLogo = loaded
      return loaded
    } catch {
      // Continue to fallback logo candidate
    }
  }

  return { base64: "", mimeType: "image/png" }
}

export async function getCompanyLogoBase64(): Promise<string> {
  const logo = await loadCompanyLogo()
  return logo.base64
}

export async function getCompanyLogoDataUri(): Promise<string> {
  const logo = await loadCompanyLogo()
  if (!logo.base64) {
    return ""
  }
  return `data:${logo.mimeType};base64,${logo.base64}`
}

export function resetCompanyLogoCacheForTests(): void {
  cachedCompanyLogo = null
}

export const AIRLINE_SVG_LOGOS: Record<string, string> = {
  SV: `<svg viewBox="0 0 280 78" width="235" height="65" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(8, 4)">
    <path d="M45 44 C24 44, 8 33, 0 18 C14 25, 29 28, 45 28 C61 28, 76 25, 90 18 C82 33, 66 44, 45 44 Z" fill="#006C35"/>
    <path d="M45 54 C26 54, 12 46, 3 34 C16 40, 30 43, 45 43 C60 43, 74 40, 87 34 C78 46, 64 54, 45 54 Z" fill="#006C35"/>
    <polygon points="45,46 33,66 45,61 57,66" fill="#006C35"/>
    <circle cx="45" cy="18" r="14" fill="#006C35"/>
    <path d="M45 19 L45 9 M45 11 C40 9, 36 11, 34 14 M45 11 C50 9, 54 11, 56 14 M45 14 C41 13, 38 15, 36 18 M45 14 C49 13, 52 15, 54 18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M36 25 L54 17 M54 25 L36 17" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
  </g>
  <text x="112" y="50" font-family="'Inter', 'Noto Sans', sans-serif" font-size="38" font-weight="800" font-style="italic" fill="#006C35" letter-spacing="-0.5">Saudia</text>
</svg>`,
  PA: `<svg viewBox="0 0 280 78" width="235" height="65" xmlns="http://www.w3.org/2000/svg">
  <text x="20" y="52" font-family="'Inter', 'Noto Sans', sans-serif" font-size="44" font-weight="900" fill="#6B7280" letter-spacing="-1">air<tspan fill="#003893">blue</tspan></text>
</svg>`,
  PK: `<svg viewBox="0 0 280 78" width="235" height="65" xmlns="http://www.w3.org/2000/svg">
  <text x="35" y="48" font-family="'Caladea', Georgia, serif" font-size="44" font-weight="800" fill="#005238" letter-spacing="3">PIA</text>
  <text x="35" y="65" font-family="'Inter', sans-serif" font-size="11" font-weight="700" fill="#9A7433" letter-spacing="1.5">PAKISTAN INTERNATIONAL</text>
</svg>`,
}

export function getAirlineBadgeHtml(
  airlineName: string,
  airlineIataCode?: string | null,
  airlineLogoDataUri?: string | null
): string {
  const safeLogoSrc = sanitizeSafeUrl(airlineLogoDataUri, {
    allowDataImage: true,
  })
  if (safeLogoSrc) {
    return `<img class="airline-img" src="${safeLogoSrc}" alt="${escapeAttr(airlineName)}">`
  }
  const code = (airlineIataCode || "").trim().toUpperCase()
  const lowerName = airlineName.toLowerCase()
  if (code === "PA" || lowerName.includes("airblue")) {
    return AIRLINE_SVG_LOGOS.PA!
  }
  if (
    code === "PK" ||
    lowerName.includes("pia") ||
    lowerName.includes("pakistan")
  ) {
    return AIRLINE_SVG_LOGOS.PK!
  }
  if (code === "SV" || lowerName.includes("saudia")) {
    return AIRLINE_SVG_LOGOS.SV!
  }
  return `<svg viewBox="0 0 280 78" width="235" height="65" xmlns="http://www.w3.org/2000/svg">
    <text x="140" y="48" text-anchor="middle" font-family="'Inter', sans-serif" font-size="30" font-weight="900" fill="#0C2633">${escapeHtml(airlineName.toUpperCase())}</text>
  </svg>`
}

interface CdpMessageEnvelope {
  id?: number
  result?: unknown
  error?: { message?: string }
}

class CdpSession {
  private readonly ws: WebSocket
  private nextId = 1
  private readonly pending = new Map<
    number,
    {
      resolve: (val: unknown) => void
      reject: (err: Error) => void
      timer: NodeJS.Timeout
    }
  >()
  private readonly onMessage: (raw: WebSocket.RawData) => void
  private readonly onCloseOrError: (reason?: unknown) => void

  constructor(ws: WebSocket) {
    this.ws = ws

    this.onMessage = (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as CdpMessageEnvelope
        if (typeof msg.id === "number" && this.pending.has(msg.id)) {
          const entry = this.pending.get(msg.id)!
          this.pending.delete(msg.id)
          clearTimeout(entry.timer)
          if (msg.error) {
            entry.reject(new Error(msg.error.message || "CDP command failed"))
          } else {
            entry.resolve(msg.result)
          }
        }
      } catch {
        // Ignore malformed CDP event frame
      }
    }

    this.onCloseOrError = (reason) => {
      const err =
        reason instanceof Error
          ? reason
          : new Error("Chromium CDP WebSocket closed before command completed")
      this.rejectAllPending(err)
    }

    this.ws.on("message", this.onMessage)
    this.ws.on("error", this.onCloseOrError)
    this.ws.on("close", this.onCloseOrError)
  }

  send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 15_000
  ): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(
          new Error(`CDP command "${method}" timed out after ${timeoutMs}ms`)
        )
      }, timeoutMs)

      this.pending.set(id, {
        resolve: resolve as (val: unknown) => void,
        reject,
        timer,
      })

      try {
        this.ws.send(JSON.stringify({ id, method, params }))
      } catch (sendErr) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(
          sendErr instanceof Error
            ? sendErr
            : new Error(`Failed to send CDP command "${method}"`)
        )
      }
    })
  }

  private rejectAllPending(err: Error): void {
    for (const [id, entry] of this.pending.entries()) {
      clearTimeout(entry.timer)
      this.pending.delete(id)
      entry.reject(err)
    }
  }

  close(): void {
    this.rejectAllPending(new Error("CDP session closed"))
    this.ws.off("message", this.onMessage)
    this.ws.off("error", this.onCloseOrError)
    this.ws.off("close", this.onCloseOrError)
    try {
      this.ws.close()
    } catch {
      // Ignore close error
    }
  }
}

export interface RenderHtmlOptions {
  html: string
  width?: number
  height?: number
  deviceScaleFactor?: number
  capturePng?: boolean
  capturePdf?: boolean
  timeoutMs?: number
  traceId?: string
}

export interface RenderHtmlOutput {
  pngBuffer?: Buffer
  pdfBuffer?: Buffer
}

async function terminateChromeProcess(proc: ChildProcess): Promise<void> {
  try {
    proc.stdout?.destroy()
    proc.stderr?.destroy()
  } catch {
    // Ignore stream destroy errors
  }

  if (proc.exitCode !== null || proc.killed) {
    return
  }

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL")
      } catch {
        // Ignore kill error
      }
      resolve()
    }, 1500)

    proc.once("exit", () => {
      clearTimeout(timer)
      resolve()
    })

    try {
      proc.kill("SIGKILL")
    } catch {
      clearTimeout(timer)
      resolve()
    }
  })
}

/**
 * Local development-only fallback renderer via Headless Chromium DevTools Protocol (CDP).
 * Hard-blocked in `NODE_ENV=production` unless `ALLOW_LOCAL_CDP_DEV=1` is explicitly set.
 */
export async function renderHtmlViaChromiumCdp(
  options: RenderHtmlOptions
): Promise<RenderHtmlOutput> {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_CDP_DEV !== "1"
  ) {
    throw new Error(
      "Local Chromium CDP rendering is disabled in production. Configure GOTENBERG_API_URL (or set ALLOW_LOCAL_CDP_DEV=1 only in isolated local debugging)."
    )
  }

  const wantPng = options.capturePng !== false
  const wantPdf = options.capturePdf !== false
  if (!wantPng && !wantPdf) {
    return {}
  }

  const { spawn } = (await import(
    /*webpackIgnore: true*/ /*turbopackIgnore: true*/ "node:child_process"
  )) as typeof import("node:child_process")
  const wsModule = (await import(
    /*webpackIgnore: true*/ /*turbopackIgnore: true*/ "ws"
  )) as { default: typeof WebSocket }
  const WebSocketCtor = wsModule.default

  const chromeBin = await findChromeExecutable()
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "alramlah_cdp_4k_")
  )

  const width = options.width ?? 1080
  const height = options.height ?? 1520
  const deviceScaleFactor = options.deviceScaleFactor ?? 3
  const cmdTimeoutMs = Math.max(3000, options.timeoutMs ?? 20_000)

  const proc = spawn(
    /*turbopackIgnore: true*/ chromeBin,
    [
      "--headless=new",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--hide-scrollbars",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  )

  let cdp: CdpSession | null = null
  try {
    const wsEndpoint = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timed out waiting for Chrome DevTools WS URL")),
        10_000
      )
      let stderrBuf = ""
      const cleanupListeners = () => {
        proc.stderr?.off("data", onData)
        proc.stdout?.off("data", onData)
        proc.off("error", onError)
        proc.off("exit", onPrematureExit)
      }
      const onData = (chunk: Buffer) => {
        stderrBuf += chunk.toString("utf8")
        const match = stderrBuf.match(
          /ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-z0-9-]+/i
        )
        if (match?.[0]) {
          clearTimeout(timeout)
          cleanupListeners()
          resolve(match[0])
        }
      }
      const onError = (err: Error) => {
        clearTimeout(timeout)
        cleanupListeners()
        reject(err)
      }
      const onPrematureExit = (code: number | null) => {
        clearTimeout(timeout)
        cleanupListeners()
        reject(
          new Error(
            `Chromium exited prematurely before opening DevTools socket (code: ${String(code)})`
          )
        )
      }
      proc.stderr?.on("data", onData)
      proc.stdout?.on("data", onData)
      proc.once("error", onError)
      proc.once("exit", onPrematureExit)
    })

    const portMatch = wsEndpoint.match(/127\.0\.0\.1:(\d+)/)
    const port = portMatch?.[1] ?? "9222"

    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(5000),
    })
    const targets = (await listRes.json()) as Array<{
      type: string
      webSocketDebuggerUrl: string
    }>
    const pageTarget = targets.find((t) => t.type === "page") ?? targets[0]
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error("No Chromium page target available")
    }

    const ws = new WebSocketCtor(pageTarget.webSocketDebuggerUrl)
    await new Promise<void>((resolve, reject) => {
      const openTimer = setTimeout(
        () => reject(new Error("Timed out opening Chromium CDP WebSocket")),
        5000
      )
      ws.once("open", () => {
        clearTimeout(openTimer)
        resolve()
      })
      ws.once("error", (err) => {
        clearTimeout(openTimer)
        reject(err)
      })
    })

    cdp = new CdpSession(ws)
    await cdp.send("Page.enable", {}, cmdTimeoutMs)
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width,
        height,
        deviceScaleFactor,
        mobile: false,
      },
      cmdTimeoutMs
    )

    const frameTree = await cdp.send<{
      frameTree: { frame: { id: string } }
    }>("Page.getFrameTree", {}, cmdTimeoutMs)
    const frameId = frameTree.frameTree.frame.id

    await cdp.send(
      "Page.setDocumentContent",
      {
        frameId,
        html: options.html,
      },
      cmdTimeoutMs
    )

    await new Promise((r) => setTimeout(r, 450))

    const output: RenderHtmlOutput = {}

    if (wantPng) {
      const shot = await cdp.send<{ data: string }>(
        "Page.captureScreenshot",
        {
          format: "png",
          captureBeyondViewport: false,
        },
        cmdTimeoutMs
      )
      output.pngBuffer = Buffer.from(shot.data, "base64")
    }

    if (wantPdf) {
      const pdfRes = await cdp.send<{ data: string }>(
        "Page.printToPDF",
        {
          landscape: false,
          displayHeaderFooter: false,
          printBackground: true,
          preferCSSPageSize: true,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        },
        cmdTimeoutMs
      )
      output.pdfBuffer = Buffer.from(pdfRes.data, "base64")
    }

    return output
  } finally {
    cdp?.close()
    await terminateChromeProcess(proc)
    try {
      await fs.rm(userDataDir, { recursive: true, force: true })
    } catch {
      // Ignore temporary directory cleanup error
    }
  }
}
