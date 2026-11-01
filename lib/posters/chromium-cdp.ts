import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import WebSocket from "ws"

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean) as string[]

export async function findChromeExecutable(): Promise<string> {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Try next
    }
  }
  throw new Error(
    "Could not locate Google Chrome or Microsoft Edge executable for 4K CDP rendering."
  )
}

export async function getCompanyLogoBase64(): Promise<string> {
  const candidates = [
    path.join(process.cwd(), "public", "logo-icon.png"),
    path.join(process.cwd(), "public", "logo.jpg"),
  ]
  for (const p of candidates) {
    try {
      const buf = await fs.readFile(/*turbopackIgnore: true*/ p)
      return buf.toString("base64")
    } catch {
      // continue
    }
  }
  return ""
}

export const AIRLINE_SVG_LOGOS: Record<string, string> = {
  SV: `<svg viewBox="0 0 280 78" width="235" height="65" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(8, 4)">
    <path d="M45 44 C24 44, 8 33, 0 18 C14 25, 29 28, 45 28 C61 28, 76 25, 90 18 C82 33, 66 44, 45 44 Z" fill="#006C35"/>
    <path d="M45 54 C26 54, 12 46, 3 34 C16 40, 30 43, 45 43 C60 43, 74 40, 87 34 C78 46, 64 54, 45 54 Z" fill="#189B52"/>
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
  if (airlineLogoDataUri) {
    return `<img class="airline-img" src="${airlineLogoDataUri}" alt="${airlineName}">`
  }
  const code = (airlineIataCode || "").trim().toUpperCase()
  const lowerName = airlineName.toLowerCase()
  if (code === "PA" || lowerName.includes("airblue")) {
    return AIRLINE_SVG_LOGOS.PA!
  }
  if (code === "PK" || lowerName.includes("pia") || lowerName.includes("pakistan")) {
    return AIRLINE_SVG_LOGOS.PK!
  }
  if (code === "SV" || lowerName.includes("saudia")) {
    return AIRLINE_SVG_LOGOS.SV!
  }
  return `<svg viewBox="0 0 280 78" width="235" height="65" xmlns="http://www.w3.org/2000/svg">
    <text x="140" y="48" text-anchor="middle" font-family="'Inter', sans-serif" font-size="30" font-weight="900" fill="#0C2633">${airlineName.toUpperCase()}</text>
  </svg>`
}

class CdpSession {
  private ws: WebSocket
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (val: unknown) => void; reject: (err: Error) => void }
  >()

  constructor(ws: WebSocket) {
    this.ws = ws
    this.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw))
        if (msg.id && this.pending.has(msg.id)) {
          const entry = this.pending.get(msg.id)!
          this.pending.delete(msg.id)
          if (msg.error) {
            entry.reject(new Error(msg.error.message || "CDP Error"))
          } else {
            entry.resolve(msg.result)
          }
        }
      } catch {
        // ignore malformed frame
      }
    })
  }

  send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (val: unknown) => void,
        reject,
      })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    this.ws.close()
  }
}

export interface RenderHtmlOptions {
  html: string
  width?: number
  height?: number
  deviceScaleFactor?: number
  capturePng?: boolean
  capturePdf?: boolean
}

export interface RenderHtmlOutput {
  pngBuffer?: Buffer
  pdfBuffer?: Buffer
}

/**
 * Renders HTML/CSS/SVG via Headless Chromium DevTools Protocol (CDP)
 * at exact 4K resolution (`1080x1520` @ `deviceScaleFactor: 3` = `3240x4560` px)
 * and/or infinite-resolution Vector PDF, matching the Python Gemini skills 100%.
 */
export async function renderHtmlViaChromiumCdp(
  options: RenderHtmlOptions
): Promise<RenderHtmlOutput> {
  const chromeBin = await findChromeExecutable()
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "alramlah_cdp_4k_")
  )

  const width = options.width ?? 1080
  const height = options.height ?? 1520
  const deviceScaleFactor = options.deviceScaleFactor ?? 3

  const proc = spawn(
    /*turbopackIgnore: true*/ chromeBin,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--hide-scrollbars",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  )

  try {
    const wsEndpoint = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timed out waiting for Chrome DevTools WS URL")),
        12000
      )
      let stderrBuf = ""
      const onData = (chunk: Buffer) => {
        stderrBuf += chunk.toString("utf8")
        const match = stderrBuf.match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-z0-9-]+/i)
        if (match) {
          clearTimeout(timeout)
          resolve(match[0])
        }
      }
      proc.stderr.on("data", onData)
      proc.stdout.on("data", onData)
      proc.on("error", (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    const portMatch = wsEndpoint.match(/127\.0\.0\.1:(\d+)/)
    const port = portMatch ? portMatch[1] : "9222"

    // Fetch first page target WebSocket URL
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`)
    const targets = (await listRes.json()) as Array<{
      type: string
      webSocketDebuggerUrl: string
    }>
    const pageTarget = targets.find((t) => t.type === "page") || targets[0]
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error("No Chromium page target available")
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve())
      ws.once("error", reject)
    })

    const cdp = new CdpSession(ws)
    await cdp.send("Page.enable")
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor,
      mobile: false,
    })

    const frameTree = await cdp.send<{
      frameTree: { frame: { id: string } }
    }>("Page.getFrameTree")
    const frameId = frameTree.frameTree.frame.id

    await cdp.send("Page.setDocumentContent", {
      frameId,
      html: options.html,
    })

    // Allow fonts & SVG layout to settle (matching Python skill 600ms delay)
    await new Promise((r) => setTimeout(r, 650))

    const output: RenderHtmlOutput = {}

    if (options.capturePng !== false) {
      const shot = await cdp.send<{ data: string }>("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      })
      output.pngBuffer = Buffer.from(shot.data, "base64")
    }

    if (options.capturePdf !== false) {
      const pdfRes = await cdp.send<{ data: string }>("Page.printToPDF", {
        landscape: false,
        displayHeaderFooter: false,
        printBackground: true,
        preferCSSPageSize: true,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
      })
      output.pdfBuffer = Buffer.from(pdfRes.data, "base64")
    }

    cdp.close()
    return output
  } finally {
    try {
      proc.kill()
    } catch {
      // ignore
    }
    try {
      await fs.rm(userDataDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}
