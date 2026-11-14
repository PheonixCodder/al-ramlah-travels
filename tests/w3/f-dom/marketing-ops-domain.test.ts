import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  buildDefaultSheetCaption,
  buildDefaultSpotlightCaption,
  calculateOutreachCooldown,
  calculatePackageDisplayPrices,
  calculateWrappedPackagePricing,
  computeOutreachCooldownState,
} from "../../../lib/domain/marketing-ops"
import { BRAND_OFFICE_ADDRESS } from "../../../lib/constants/brand"

describe("T-011 (OD-09b): Mode B Unpriced Tier Safety & Permanent Do-Not-Contact Lock", () => {
  describe("Supplier Commission Mode B (net_plus_markup) & Mode A (included_in_flyer)", () => {
    it("keeps 0, null, undefined, and negative unpriced supplier room tiers at 0 in Mode B instead of adding commissionPkr", () => {
      const wrapped = calculateWrappedPackagePricing({
        rawSharingPkr: 0,
        rawQuadPkr: 255_000,
        rawTriplePkr: null,
        rawDoublePkr: undefined,
        commissionMode: "net_plus_markup",
        commissionPkr: 25_000,
      })

      assert.equal(wrapped.retailSharingPkr, 0)
      assert.equal(wrapped.netSharingPkr, 0)
      assert.equal(wrapped.retailQuadPkr, 280_000)
      assert.equal(wrapped.netQuadPkr, 255_000)
      assert.equal(wrapped.retailTriplePkr, 0)
      assert.equal(wrapped.netTriplePkr, 0)
      assert.equal(wrapped.retailDoublePkr, 0)
      assert.equal(wrapped.netDoublePkr, 0)

      const direct = calculatePackageDisplayPrices(
        {
          rawSharingPkr: -500,
          rawQuadPkr: 0,
          rawTriplePkr: 290_000,
          rawDoublePkr: 320_000,
        },
        "net_plus_markup",
        22_000
      )
      assert.equal(direct.finalSharingPkr, 0)
      assert.equal(direct.finalQuadPkr, 0)
      assert.equal(direct.finalTriplePkr, 312_000)
      assert.equal(direct.finalDoublePkr, 342_000)
    })

    it("preserves Mode A deduction and flags hasBelowCommissionWarning when a positive tier <= commissionPkr", () => {
      const res = calculatePackageDisplayPrices(
        {
          rawSharingPkr: 0,
          rawQuadPkr: 20_000,
          rawTriplePkr: 295_000,
          rawDoublePkr: 330_000,
        },
        "included_in_flyer",
        25_000
      )

      assert.equal(res.finalSharingPkr, 0)
      assert.equal(res.netSupplierSharingPkr, 0)
      assert.equal(res.finalQuadPkr, 20_000)
      assert.equal(res.netSupplierQuadPkr, 0)
      assert.equal(res.finalTriplePkr, 295_000)
      assert.equal(res.netSupplierTriplePkr, 270_000)
      assert.equal(res.hasBelowCommissionWarning, true)
    })

    it("renders On Request for 0-priced tiers and uses canonical OD-10 Askari 10 office address in captions", () => {
      const spotlight = buildDefaultSpotlightCaption({
        postRefCode: "ART-AM-15D-01",
        daysTitle: "15 DAYS",
        airlineName: "Saudia",
        routeText: "LHE - JED",
        outboundFlight: "SV 739",
        returnFlight: "SV 738",
        makkahHotel: "Swissotel Makkah",
        makkahNights: "08",
        madinahHotel: "Anwar Al Madinah",
        madinahNights: "06",
        sharingPricePkr: 0,
        quadPricePkr: 280_000,
        triplePricePkr: 0,
        doublePricePkr: 340_000,
      })

      assert.equal(spotlight.includes("PKR 0"), false)
      assert.equal(spotlight.includes("On Request"), true)
      assert.equal(spotlight.includes(BRAND_OFFICE_ADDRESS), true)
      assert.equal(spotlight.includes("House no 38"), false)

      const sheet = buildDefaultSheetCaption({
        postCode: "ART-AM-15D",
        daysTitle: "15 DAYS",
        airlineName: "Saudia",
        routeText: "LHE - JED",
        cardCount: 4,
        startingPricePkr: 280_000,
      })
      assert.equal(sheet.includes(BRAND_OFFICE_ADDRESS), true)
    })
  })

  describe("Permanent Do-Not-Contact Opt-Out Lock", () => {
    it("permanently blocks outreach when doNotContact=true even after an active inbound reply ('STOP')", () => {
      const outreachAt = "2026-11-10T10:00:00Z"
      const inboundStopReplyAt = "2026-11-10T10:05:00Z"
      const now = "2026-11-10T12:00:00Z"

      // Object-style call
      const blockedObj = calculateOutreachCooldown({
        lastOutreachAt: outreachAt,
        lastInboundReplyAt: inboundStopReplyAt,
        now,
        doNotContact: true,
      })
      assert.equal(blockedObj.canContact, false)
      assert.equal(blockedObj.reason, "do_not_contact")
      assert.equal(blockedObj.isLocked, true)
      assert.equal(blockedObj.isExemptActiveReply, false)
      assert.equal(blockedObj.isEligibleToMessage, false)

      // Positional-style call with interestStatus = "do_not_contact"
      const blockedPositional = computeOutreachCooldownState(
        outreachAt,
        inboundStopReplyAt,
        now,
        { interestStatus: "do_not_contact" }
      )
      assert.equal(blockedPositional.canContact, false)
      assert.equal(blockedPositional.reason, "do_not_contact")
      assert.equal(blockedPositional.isEligibleToday, false)
      assert.equal(blockedPositional.isActiveReplyExemption, false)

      // Even if never contacted or >30 days elapsed, doNotContact remains permanently locked
      const neverContactedOptOut = calculateOutreachCooldown({
        lastOutreachAt: null,
        lastInboundReplyAt: null,
        now: "2026-12-30T12:00:00Z",
        doNotContact: true,
      })
      assert.equal(neverContactedOptOut.canContact, false)
      assert.equal(neverContactedOptOut.reason, "do_not_contact")
    })

    it("still grants active_inbound_reply exemption when doNotContact is false", () => {
      const unlocked = calculateOutreachCooldown({
        lastOutreachAt: "2026-11-10T10:00:00Z",
        lastInboundReplyAt: "2026-11-10T11:00:00Z",
        now: "2026-11-11T10:00:00Z",
        doNotContact: false,
      })
      assert.equal(unlocked.canContact, true)
      assert.equal(unlocked.reason, "active_inbound_reply")
      assert.equal(unlocked.isExemptActiveReply, true)
    })
  })
})
