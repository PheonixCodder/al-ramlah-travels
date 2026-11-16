import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import React from "react"
import { describe, it } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import { ArabicText } from "../../../components/public/arabic-text"
import { computeHaramainPrayerTimes } from "../../../components/public/public-utils"
import { PublicHeader } from "../../../components/layout/public-header"
import { HeroSlider } from "../../../components/public/hero-slider"

describe("F-PUB T-085 (OD-08): <ArabicText lang='ar' dir='rtl'>, Zero-Network Haramain Prayer Schedule, Reduced Motion & Form ARIA", () => {
  it("wraps sacred Arabic text in <span lang='ar' dir='rtl'> via <ArabicText> and renders Haramain prayer pill in PublicHeader", () => {
    const arabicHtml = renderToStaticMarkup(
      React.createElement(ArabicText, null, "لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ")
    )
    assert.match(arabicHtml, /<span[^>]*lang="ar"[^>]*dir="rtl"/)
    assert.ok(arabicHtml.includes("لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ"))

    const headerHtml = renderToStaticMarkup(React.createElement(PublicHeader))
    assert.match(headerHtml, /lang="ar"/)
    assert.match(headerHtml, /dir="rtl"/)
    assert.match(headerHtml, /Makkah/i)
    assert.match(headerHtml, /Madinah/i)
    assert.match(headerHtml, /AST/)
  })

  it("computes strictly ordered 24h AST Umm al-Qura prayer times for Makkah & Madinah with zero network requests (OD-08)", () => {
    const sampleDates = [
      new Date("2026-03-21T08:15:00Z"), // Vernal equinox
      new Date("2026-06-21T14:30:00Z"), // Summer solstice
      new Date("2026-12-21T20:45:00Z"), // Winter solstice
    ]

    for (const dt of sampleDates) {
      const schedule = computeHaramainPrayerTimes(dt)
      assert.match(schedule.astClock24, /^\d{2}:\d{2}$/)
      assert.match(schedule.makkahTime24, /^\d{2}:\d{2}$/)
      assert.match(schedule.madinahTime24, /^\d{2}:\d{2}$/)

      for (const cityPrayers of [schedule.makkahPrayers, schedule.madinahPrayers]) {
        assert.ok(cityPrayers.Fajr < cityPrayers.Dhuhr)
        assert.ok(cityPrayers.Dhuhr < cityPrayers.Asr)
        assert.ok(cityPrayers.Asr < cityPrayers.Maghrib)
        assert.ok(cityPrayers.Maghrib < cityPrayers.Isha)
      }
    }
  })

  it("honors prefers-reduced-motion in HeroSlider and applies tabular-nums & aria-invalid across public forms", async () => {
    const heroSource = await fs.readFile(
      path.join(process.cwd(), "components/public/hero-slider.tsx"),
      "utf8"
    )
    assert.match(heroSource, /prefers-reduced-motion:\s*reduce/)

    const heroHtml = renderToStaticMarkup(React.createElement(HeroSlider, { slides: [] }))
    assert.match(heroHtml, /lang="ar"/)
    assert.match(heroHtml, /dir="rtl"/)

    for (const relForm of [
      "components/public/status-tracker.tsx",
      "components/public/group-booking-modal.tsx",
      "components/public/hajj-inquiry-section.tsx",
      "components/public/contact-section.tsx",
      "components/planner/review-and-submit-step.tsx",
      "components/planner/lead-capture-dialog.tsx",
    ]) {
      const src = await fs.readFile(path.join(process.cwd(), relForm), "utf8")
      assert.match(
        src,
        /aria-invalid/,
        `${relForm} must bind aria-invalid on validated inputs`
      )
      assert.match(
        src,
        /role="alert"/,
        `${relForm} must announce errors via role="alert"`
      )
    }

    const liveSummarySrc = await fs.readFile(
      path.join(process.cwd(), "components/planner/live-summary-card.tsx"),
      "utf8"
    )
    assert.match(liveSummarySrc, /tabular-nums/)
  })
})
