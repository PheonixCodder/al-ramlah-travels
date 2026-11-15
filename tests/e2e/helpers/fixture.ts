import "./next-fetch-interceptor.mjs"
import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test"

// Valid 1x1 transparent PNG
export const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
)

const instrumentedContexts = new WeakSet<BrowserContext>()
const instrumentedPages = new WeakSet<Page>()

export function instrumentPage(page: Page): Page {
  if (instrumentedPages.has(page)) {
    return page
  }
  instrumentedPages.add(page)

  const originalGoto = page.goto.bind(page)
  page.goto = async (url, options) => {
    const response = await originalGoto(url, {
      waitUntil: "domcontentloaded",
      ...options,
    })
    if (!options?.waitUntil || options.waitUntil === "domcontentloaded") {
      await page
        .waitForFunction(
          () => {
            const candidates = document.querySelectorAll(
              "button, a, input, main, form, [id]"
            )
            for (let i = 0; i < candidates.length; i += 1) {
              const el = candidates[i]
              if (Object.keys(el).some((k) => k.startsWith("__react"))) {
                return true
              }
            }
            return candidates.length === 0
          },
          undefined,
          { timeout: 30_000 }
        )
        .catch(() => undefined)
    }
    return response
  }

  return page
}

export async function instrumentBrowserContext(
  context: BrowserContext
): Promise<BrowserContext> {
  if (instrumentedContexts.has(context)) {
    return context
  }
  instrumentedContexts.add(context)

  for (const existingPage of context.pages()) {
    instrumentPage(existingPage)
  }
  context.on("page", (newPage) => {
    instrumentPage(newPage)
  })

  await context.route("**/_next/image*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
      body: ONE_BY_ONE_PNG,
    })
  })

  await context.route(/^https?:\/\//i, async (route) => {
    const reqUrl = route.request().url()
    let parsed: URL
    try {
      parsed = new URL(reqUrl)
    } catch {
      await route.continue()
      return
    }

    const host = parsed.hostname.toLowerCase()
    if (host === "127.0.0.1" || host === "localhost" || host === "::1") {
      await route.continue()
      return
    }

    // Hermetically fulfill external browser asset/font requests in <1ms so window `load` + React hydration finish immediately
    const resourceType = route.request().resourceType()
    if (resourceType === "stylesheet" || host.includes("fonts.googleapis.com")) {
      await route.fulfill({
        status: 200,
        contentType: "text/css; charset=utf-8",
        body: "",
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: ONE_BY_ONE_PNG,
    })
  })

  return context
}

export const test = base.extend({
  context: async ({ context }, runFixture) => {
    await instrumentBrowserContext(context)
    await runFixture(context)
  },
  browser: async ({ browser }, runFixture) => {
    const origNewContext = browser.newContext.bind(browser)
    const patchedBrowser = new Proxy(browser, {
      get(target, prop, receiver) {
        if (prop === "newContext") {
          return async (...args: Parameters<typeof origNewContext>) => {
            const ctx = await origNewContext(...args)
            return instrumentBrowserContext(ctx)
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
    await runFixture(patchedBrowser)
  },
})

export { expect, type APIRequestContext }
