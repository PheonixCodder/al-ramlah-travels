import assert from "node:assert/strict"
import React from "react"
import { after, describe, it } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import { closeDatabasePool } from "../../../db"
import RefundPolicyPage from "../../../app/(public)/refund-policy/page"
import TermsOfServicePage from "../../../app/(public)/terms/page"
import { PublicFooter } from "../../../components/layout/public-footer"
import { MarketingSections } from "../../../components/public/marketing-sections"

describe("F-PUB T-056 (OD-10): /refund-policy, Hardened /terms, Verified Agency Licenses & Zero Fabricated Testimonials", () => {
  after(async () => {
    await closeDatabasePool()
  })

  it("renders dedicated /refund-policy and hardened /terms covering non-refundable KSA visas, airline fare rules, cancellation schedule & Lahore jurisdiction", async () => {
    const refundEl = await RefundPolicyPage()
    const refundHtml = renderToStaticMarkup(refundEl)

    assert.match(refundHtml, /Cancellation &amp; Refund Policy|Cancellation & Refund Policy/)
    assert.match(refundHtml, /non-refundable/i)
    assert.match(refundHtml, /30 or more days/i)
    assert.match(refundHtml, /Ramadan/i)
    assert.match(refundHtml, /Lahore,\s*Punjab/i)

    const termsEl = await TermsOfServicePage()
    const termsHtml = renderToStaticMarkup(termsEl)

    assert.match(termsHtml, /Terms of Service/i)
    assert.match(termsHtml, /non-refundable/i)
    assert.match(termsHtml, /Lahore,\s*Punjab/i)
    assert.match(termsHtml, /\/refund-policy/)
  })

  it("displays regulatory license numbers in PublicFooter ONLY when populated in agency_settings (OD-10)", () => {
    const unpopulatedHtml = renderToStaticMarkup(
      React.createElement(PublicFooter, {
        dtsLicense: null,
        moraLicense: "",
        iataCode: "   ",
        ntnNumber: null,
      })
    )
    assert.ok(!unpopulatedHtml.includes("DTS License:"))
    assert.ok(!unpopulatedHtml.includes("MoRA HGO:"))
    assert.ok(!unpopulatedHtml.includes("IATA:"))
    assert.ok(!unpopulatedHtml.includes("NTN:"))

    const populatedHtml = renderToStaticMarkup(
      React.createElement(PublicFooter, {
        dtsLicense: "DTS-LHR-9988",
        moraLicense: "MORA-4411",
        iataCode: "27-3-1234",
        ntnNumber: "8765432-1",
      })
    )
    assert.ok(populatedHtml.includes("DTS-LHR-9988"))
    assert.ok(populatedHtml.includes("MORA-4411"))
    assert.ok(populatedHtml.includes("27-3-1234"))
    assert.ok(populatedHtml.includes("8765432-1"))
  })

  it("removes fabricated DEFAULT_TESTIMONIALS so testimonials section renders ONLY when verified DB testimonials exist", () => {
    const emptyTestimonialsHtml = renderToStaticMarkup(
      React.createElement(MarketingSections, {
        testimonials: [],
      })
    )

    assert.ok(!emptyTestimonialsHtml.includes("Pilgrim Stories &amp; Reflections"))
    assert.ok(!emptyTestimonialsHtml.includes("Pilgrim Stories & Reflections"))
    assert.ok(!emptyTestimonialsHtml.includes("Tariq Mehmood"))
    assert.ok(!emptyTestimonialsHtml.includes("Ayesha Siddiqui"))

    const verifiedTestimonialsHtml = renderToStaticMarkup(
      React.createElement(MarketingSections, {
        testimonials: [
          {
            id: "test-rev-1",
            pilgrimName: "Alhaj Kamran Sheikh",
            city: "Lahore",
            quote: "Seamless Haramain hospitality and punctual GMC transfers.",
            packageOrJourneyType: "Custom 5-Star Umrah",
            rating: 5,
          },
        ],
      })
    )
    assert.ok(verifiedTestimonialsHtml.includes("Alhaj Kamran Sheikh"))
    assert.ok(verifiedTestimonialsHtml.includes("Seamless Haramain hospitality"))
  })
})
