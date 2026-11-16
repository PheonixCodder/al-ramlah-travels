import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import React from "react"
import { after, describe, it } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import { closeDatabasePool } from "../../../db"
import * as applicationActions from "../../../app/actions/applications"
import { PublicFooter } from "../../../components/layout/public-footer"

describe("F-PUB T-095: Deduplicated Action Exports, Clean Footer Legal Links (Zero COVID-19/Oct-2026 Modals), Contact Banner Reset & @/lib/utils cn", () => {
  after(async () => {
    await closeDatabasePool()
  })

  it("removes duplicate submitGroupBooking*/submitHajjInquiry* aliases and guards generateApplicationReference behind requireAdmin", async () => {
    const exportedKeys = Object.keys(applicationActions)

    // Canonical public actions preserved
    for (const requiredExport of [
      "submitCustomApplication",
      "submitCustomUmrahApplication",
      "submitGroupBookingApplication",
      "submitHajjInquiryApplication",
      "lookupApplicationStatus",
      "respondToApplicationQuoteAction",
      "submitPublicContactInquiryAction",
    ]) {
      assert.ok(
        exportedKeys.includes(requiredExport),
        `Expected canonical export "${requiredExport}" in app/actions/applications.ts`
      )
    }

    // Duplicate aliases removed
    for (const removedAlias of [
      "submitGroupBooking",
      "submitGroupPackageApplication",
      "submitHajjInquiry",
      "submitHajjApplication",
    ]) {
      assert.ok(
        !exportedKeys.includes(removedAlias),
        `Duplicate alias "${removedAlias}" must not be exported from app/actions/applications.ts`
      )
    }

    // Unauthenticated call to generateApplicationReference must be blocked by requireAdmin()
    await assert.rejects(async () => {
      await applicationActions.generateApplicationReference()
    })
  })

  it("replaces dead inline COVID-19 / October 2026 footer modals with /privacy, /terms, and /refund-policy links", async () => {
    const footerHtml = renderToStaticMarkup(React.createElement(PublicFooter))
    assert.ok(footerHtml.includes('href="/privacy"'))
    assert.ok(footerHtml.includes('href="/terms"'))
    assert.ok(footerHtml.includes('href="/refund-policy"'))
    assert.ok(!footerHtml.includes("COVID-19"))
    assert.ok(!footerHtml.includes("October 2026"))
    assert.ok(!footerHtml.includes("Direct Saudia Agent"))
  })

  it("clears dead agencyWhatsapp prop on CustomJourneyBuilder, resets ContactSection success state on new submit, and eliminates bare from 'cn' imports", async () => {
    const builderSrc = await fs.readFile(
      path.join(process.cwd(), "components/planner/custom-journey-builder.tsx"),
      "utf8"
    )
    assert.ok(!builderSrc.includes("agencyWhatsapp"))
    assert.match(builderSrc, /sarToPkrRate/)

    const contactSrc = await fs.readFile(
      path.join(process.cwd(), "components/public/contact-section.tsx"),
      "utf8"
    )
    assert.match(contactSrc, /setSuccess\(false\)/)

    const plannerEntries = await fs.readdir(
      path.join(process.cwd(), "components/planner")
    )
    for (const file of plannerEntries) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue
      const content = await fs.readFile(
        path.join(process.cwd(), "components/planner", file),
        "utf8"
      )
      assert.ok(
        !content.includes('from "cn"') && !content.includes("from 'cn'"),
        `${file} must import cn from @/lib/utils instead of bare "cn"`
      )
    }
  })
})
