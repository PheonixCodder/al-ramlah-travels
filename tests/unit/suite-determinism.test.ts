import { describe, expect, it } from "vitest"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"
import { addDays, chainItineraryDates } from "@/lib/domain/date-chaining"
import { calculateVisaTierAndCost } from "@/lib/domain/visa-calc"
import {
  findNextFreePostingSlot,
  formatPktDateKey,
  formatPktTime,
  parsePktDateTimeLocal,
  parsePktSlotToUtc,
} from "@/lib/social/time-slots"
import { isWithinPktBusinessHours } from "@/lib/whatsapp/auto-responder"
import { computeOutreachCooldownState } from "@/lib/domain/marketing-ops"

describe("Timezone & Boundary Determinism Across PKT, KSA & UTC (T-093)", () => {
  const standardVisaTiers = {
    shortTermPricePkr: 42500,
    longTermPricePkr: 68000,
  }

  it("evaluates KSA visa duration boundaries deterministically at UTC/KSA/PKT midnight transitions", () => {
    // Exact 30-day inclusive stay -> short_term
    const day30 = calculateVisaTierAndCost(
      "2026-11-01",
      "2026-11-30",
      2,
      standardVisaTiers
    )
    expect(day30.totalKsaDays).toBe(30)
    expect(day30.tier).toBe("short_term")
    expect(day30.totalVisaCostPkr).toBe(85000)

    // Exact 31-day inclusive stay -> long_term
    const day31 = calculateVisaTierAndCost(
      "2026-11-01",
      "2026-12-01",
      2,
      standardVisaTiers
    )
    expect(day31.totalKsaDays).toBe(31)
    expect(day31.tier).toBe("long_term")
    expect(day31.totalVisaCostPkr).toBe(136000)

    // Year-end leap/non-leap boundary chaining
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29")
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01")

    const chained = chainItineraryDates("makkah_madinah", "2026-12-28", [
      { city: "makkah", nights: 5 },
      { city: "madinah", nights: 4 },
    ])
    expect(chained.entryAirport).toBe("JED")
    expect(chained.chainedStays[0]?.checkOutDate).toBe("2027-01-02")
    expect(chained.chainedStays[1]?.checkInDate).toBe("2027-01-02")
    expect(chained.finalDepartureDate).toBe("2027-01-06")
  })

  it("anchors PKT (Asia/Karachi, UTC+5) slot parsing and business hours independent of host OS TZ", () => {
    // 2026-11-15 19:30 UTC === 2026-11-16 00:30 PKT (next calendar day in Lahore, outside 09:00-21:00 PKT)
    const utcLateEvening = new Date("2026-11-15T19:30:00.000Z")
    expect(formatPktDateKey(utcLateEvening)).toBe("2026-11-16")
    expect(formatPktTime(utcLateEvening)).toBe("00:30")
    expect(isWithinPktBusinessHours(utcLateEvening, "09:00", "21:00")).toBe(false)

    // 2026-11-15 04:00 UTC === 2026-11-15 09:00 PKT (exact opening boundary)
    const pktOpenBoundary = new Date("2026-11-15T04:00:00.000Z")
    expect(isWithinPktBusinessHours(pktOpenBoundary, "09:00", "21:00")).toBe(true)

    // 2026-11-15 03:59 UTC === 2026-11-15 08:59 PKT (1 minute before opening)
    const pktOneMinBefore = new Date("2026-11-15T03:59:00.000Z")
    expect(isWithinPktBusinessHours(pktOneMinBefore, "09:00", "21:00")).toBe(false)

    // KSA (Asia/Riyadh, UTC+3) 22:30 AST === 19:30 UTC === 00:30 PKT next day
    const parsedFromLocalInput = parsePktDateTimeLocal("2026-11-16T11:00")
    expect(parsedFromLocalInput.toISOString()).toBe("2026-11-16T06:00:00.000Z")

    const anchorNow = new Date("2026-11-15T05:50:00.000Z") // 10:50 PKT (< 15m lead to 11:00 PKT)
    const nextSlot = findNextFreePostingSlot([], anchorNow)
    // Skips 11:00 PKT (only 10m away) -> selects 16:00 PKT (11:00 UTC)
    expect(nextSlot.toISOString()).toBe(
      parsePktSlotToUtc("2026-11-15", "16:00").toISOString()
    )
  })

  it("evaluates 14-day outreach cooldowns against frozen timestamps with zero Date.now() drift", () => {
    const frozenNow = new Date("2026-11-20T12:00:00.000Z")
    const thirteenDaysAgo = new Date("2026-11-07T12:00:01.000Z")
    const fourteenDaysAgo = new Date("2026-11-06T12:00:00.000Z")

    const blocked = computeOutreachCooldownState(thirteenDaysAgo, null, frozenNow)
    expect(blocked.isEligibleToday).toBe(false)
    expect(blocked.daysRemaining).toBeGreaterThanOrEqual(1)

    const allowed = computeOutreachCooldownState(fourteenDaysAgo, null, frozenNow)
    expect(allowed.isEligibleToday).toBe(true)
    expect(allowed.daysRemaining).toBe(0)
  })

  it("enforces Askari 10, Lahore Cantt canonical brand NAP across company defaults (OD-10)", () => {
    expect(DEFAULT_COMPANY_INFO.officeAddress).toContain("Askari 10")
    expect(DEFAULT_COMPANY_INFO.officeAddress).toContain("Airport Road, Lahore Cantt")
    expect(DEFAULT_COMPANY_INFO.officeAddress).not.toMatch(/DHA|Rawalpindi|Chaklala/i)
    expect(DEFAULT_COMPANY_INFO.ibanVerified).toBe(false)
  })
})
