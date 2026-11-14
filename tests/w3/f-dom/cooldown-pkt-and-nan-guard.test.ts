import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  calculateOutreachCooldown,
  countOutreachSentOnPktDay,
  startOfPktDayUtc,
  toPktDateKey,
} from "../../../lib/domain/marketing-ops"

describe("T-081: Outreach Cooldown NaN RangeError Guard & Asia/Karachi (UTC+05:00) Boundaries", () => {
  it("guards malformed date strings ('invalid', '', '2026-02-31', NaN Date) without throwing RangeError", () => {
    const malformedInputs: Array<Date | string> = [
      "invalid",
      "",
      "   ",
      "2026-02-31T10:00:00Z",
      new Date("not-a-valid-date"),
    ]

    for (const bad of malformedInputs) {
      assert.doesNotThrow(() => {
        const res = calculateOutreachCooldown(
          bad,
          "invalid-reply-ts",
          "2026-11-14T10:00:00Z"
        )
        assert.equal(res.canContact, false)
        assert.equal(res.reason, "invalid_date")
        assert.equal(res.isLocked, true)
        assert.equal(res.isEligibleToMessage, false)
        assert.equal(res.cooldownUntil, null)
        assert.equal(res.cooldownUntilIso, null)
        assert.equal(Number.isNaN(res.daysRemaining), false)
        assert.equal(res.statusLabel.includes("NaN"), false)
      })
    }

    // Malformed `now` also fails closed without throwing
    const badNow = calculateOutreachCooldown(
      "2026-11-01T10:00:00Z",
      null,
      "invalid"
    )
    assert.equal(badNow.canContact, false)
    assert.equal(badNow.reason, "invalid_date")

    // Valid `lastOutreachAt` + malformed `lastInboundReplyAt` ignores bad reply without throwing
    const badReplyIgnored = calculateOutreachCooldown(
      "2026-11-10T10:00:00Z",
      "invalid",
      "2026-11-12T10:00:00Z"
    )
    assert.equal(badReplyIgnored.canContact, false)
    assert.equal(badReplyIgnored.reason, "cooldown_active")
  })

  it("maps 18:30 UTC (23:30 PKT), 19:30 UTC (00:30 PKT+1), and 23:30 UTC (04:30 PKT+1) to exact Asia/Karachi calendar days", () => {
    assert.equal(toPktDateKey("2026-11-01T18:30:00Z"), "2026-11-01")
    assert.equal(toPktDateKey("2026-11-01T19:30:00Z"), "2026-11-02")
    assert.equal(toPktDateKey("2026-11-01T23:30:00Z"), "2026-11-02")

    // Start of PKT day 2026-11-02 is 2026-11-01T19:00:00.000Z
    assert.equal(
      startOfPktDayUtc("2026-11-01T23:30:00Z")?.toISOString(),
      "2026-11-01T19:00:00.000Z"
    )
  })

  it("enforces daily outreach cap across PKT midnight (19:00 UTC) rather than UTC midnight", () => {
    const sentLog = [
      "2026-11-01T18:10:00Z", // 23:10 PKT Nov 01
      "2026-11-01T18:45:00Z", // 23:45 PKT Nov 01
      "invalid",
    ]

    // At 18:55 UTC (23:55 PKT Nov 01), 2 sends occurred on PKT day 2026-11-01 -> cap of 2 reached!
    assert.equal(countOutreachSentOnPktDay(sentLog, "2026-11-01T18:55:00Z"), 2)
    const cappedBeforePktMidnight = calculateOutreachCooldown({
      lastOutreachAt: null,
      now: "2026-11-01T18:55:00Z",
      sentTimestamps: sentLog,
      dailyCap: 2,
    })
    assert.equal(cappedBeforePktMidnight.canContact, false)
    assert.equal(cappedBeforePktMidnight.reason, "daily_cap_reached")

    // At 19:30 UTC (00:30 PKT Nov 02) and 23:30 UTC (04:30 PKT Nov 02), PKT day rolled over -> 0 sends today!
    assert.equal(countOutreachSentOnPktDay(sentLog, "2026-11-01T19:30:00Z"), 0)
    assert.equal(countOutreachSentOnPktDay(sentLog, "2026-11-01T23:30:00Z"), 0)
    const resetAfterPktMidnight = calculateOutreachCooldown({
      lastOutreachAt: null,
      now: "2026-11-01T19:30:00Z",
      sentTimestamps: sentLog,
      dailyCap: 2,
    })
    assert.equal(resetAfterPktMidnight.canContact, true)
    assert.equal(resetAfterPktMidnight.reason, "never_contacted")
  })

  it("evaluates 14-day cooldown unlock at Asia/Karachi midnight (00:00 PKT = 19:00 UTC prior day)", () => {
    // Outreach at 18:30 UTC Nov 01 = 23:30 PKT Nov 01 -> unlocks at 00:00 PKT Nov 15 (2026-11-14T19:00:00Z)
    const lateEveningPktOutreach = "2026-11-01T18:30:00Z"

    const stillLockedEndDay13Pkt = calculateOutreachCooldown(
      lateEveningPktOutreach,
      null,
      "2026-11-14T18:59:59Z" // 23:59:59 PKT Nov 14
    )
    assert.equal(stillLockedEndDay13Pkt.canContact, false)
    assert.equal(stillLockedEndDay13Pkt.reason, "cooldown_active")
    assert.equal(stillLockedEndDay13Pkt.daysRemaining, 1)

    const unlockedMorningDay14Pkt = calculateOutreachCooldown(
      lateEveningPktOutreach,
      null,
      "2026-11-15T04:00:00Z" // 09:00 AM PKT Nov 15
    )
    assert.equal(unlockedMorningDay14Pkt.canContact, true)
    assert.equal(unlockedMorningDay14Pkt.reason, "cooldown_complete")

    // Outreach at 19:30 UTC Nov 01 = 00:30 PKT Nov 02 -> unlocks at 00:00 PKT Nov 16 (2026-11-15T19:00:00Z)
    const afterPktMidnightOutreach = "2026-11-01T19:30:00Z"
    const lockedAt2330UtcNov14 = calculateOutreachCooldown(
      afterPktMidnightOutreach,
      null,
      "2026-11-14T23:30:00Z" // 04:30 PKT Nov 15 (Day 13 in PKT!)
    )
    assert.equal(lockedAt2330UtcNov14.canContact, false)
    assert.equal(lockedAt2330UtcNov14.daysRemaining, 1)

    const unlockedAt1930UtcNov15 = calculateOutreachCooldown(
      afterPktMidnightOutreach,
      null,
      "2026-11-15T19:30:00Z" // 00:30 PKT Nov 16 (Day 14 in PKT!)
    )
    assert.equal(unlockedAt1930UtcNov15.canContact, true)
    assert.equal(unlockedAt1930UtcNov15.reason, "cooldown_complete")
  })
})
