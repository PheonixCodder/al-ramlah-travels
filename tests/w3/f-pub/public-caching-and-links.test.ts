import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import React from "react"
import { describe, it } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import * as homePageModule from "../../../app/(public)/page"
import * as privacyPageModule from "../../../app/(public)/privacy/page"
import * as termsPageModule from "../../../app/(public)/terms/page"
import * as refundPageModule from "../../../app/(public)/refund-policy/page"
import { PublicHeader } from "../../../components/layout/public-header"
import { PublicFooter } from "../../../components/layout/public-footer"

describe("F-PUB T-057: ISR Caching (revalidate = 300), Below-Fold Dynamic Imports & Root-Relative /#... Anchors", () => {
  it("enables revalidate = 300 and removes force-dynamic across /, /privacy, /terms, and /refund-policy", async () => {
    assert.equal(homePageModule.revalidate, 300)
    assert.equal(privacyPageModule.revalidate, 300)
    assert.equal(termsPageModule.revalidate, 300)
    assert.equal(refundPageModule.revalidate, 300)

    for (const relPath of [
      "app/(public)/page.tsx",
      "app/(public)/privacy/page.tsx",
      "app/(public)/terms/page.tsx",
      "app/(public)/refund-policy/page.tsx",
    ]) {
      const content = await fs.readFile(path.join(process.cwd(), relPath), "utf8")
      assert.ok(
        !/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(content),
        `${relPath} must not export dynamic = "force-dynamic"`
      )
    }
  })

  it("code-splits heavy below-the-fold client sections via next/dynamic on app/(public)/page.tsx", async () => {
    const homeSource = await fs.readFile(
      path.join(process.cwd(), "app/(public)/page.tsx"),
      "utf8"
    )
    assert.match(homeSource, /import dynamic from "next\/dynamic"/)
    assert.match(homeSource, /dynamic\(\s*\(\)\s*=>/)
  })

  it("uses root-relative /#... section links (never bare #...) for interactive tools and crawlable hub routes in PublicHeader and PublicFooter so sub-page navigation works", () => {
    const headerHtml = renderToStaticMarkup(React.createElement(PublicHeader))
    const footerHtml = renderToStaticMarkup(React.createElement(PublicFooter))

    assert.ok(headerHtml.includes('href="/#journey-builder"'))
    assert.ok(headerHtml.includes('href="/#track-status"'))
    assert.ok(headerHtml.includes('href="/umrah-packages"'))
    assert.ok(headerHtml.includes('href="/hajj-2027"'))
    assert.ok(headerHtml.includes('href="/contact"'))
    assert.ok(
      !/href="#[^"]+"/.test(headerHtml),
      "PublicHeader must not render bare href='#...' links"
    )

    assert.ok(footerHtml.includes('href="/#journey-builder"'))
    assert.ok(footerHtml.includes('href="/#track-status"'))
    assert.ok(footerHtml.includes('href="/umrah-packages"'))
    assert.ok(footerHtml.includes('href="/hajj-2027"'))
    assert.ok(footerHtml.includes('href="/contact"'))
    assert.ok(
      !/href="#[^"]+"/.test(footerHtml),
      "PublicFooter must not render bare href='#...' links"
    )
  })
})
