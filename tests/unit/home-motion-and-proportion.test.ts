import "../setup/hermetic-env"
import * as React from "react"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import PublicLayout from "@/app/(public)/layout"
import HomePage from "@/app/(public)/page"
import * as MotionBarrel from "@/components/motion"
import {
  ensureGsapPlugins,
  HARAMAIN_EASE,
  HARAMAIN_GSAP_EASE,
  HaramainSectionReveal,
  LENIS_ROOT_OPTIONS,
  MotionPillIndicator,
  PublicMotionAndScrollProvider,
  PublicMotionProvider,
  shouldPreventLenisScroll,
} from "@/components/motion"
import { runHaramainSectionRevealEffect } from "@/components/motion/haramain-reveal"

const UNIT_DIR = path.dirname(fileURLToPath(import.meta.url))
const WEB_DIR = path.resolve(UNIT_DIR, "../..")

const HOME_SECTION_SOURCE_PATHS = [
  "components/public/hero-slider.tsx",
  "components/public/group-packages-section.tsx",
  "components/public/hajj-inquiry-section.tsx",
  "components/public/status-tracker.tsx",
  "components/public/marketing-sections.tsx",
  "components/public/marketing-client-islands.tsx",
  "components/public/faq-accordion-client.tsx",
  "components/seo/trust-home-overview.tsx",
  "components/public/contact-section.tsx",
] as const

const MOTION_IMPORTING_FILES = [
  "components/motion/public-motion-provider.tsx",
  "components/motion/haramain-reveal.tsx",
  "components/public/hajj-inquiry-section.tsx",
  "components/public/status-tracker.tsx",
  "components/public/marketing-client-islands.tsx",
] as const

interface ElementStubOptions {
  attributes?: Record<string, string>
  dataset?: Record<string, string>
  scrollHeight?: number
  clientHeight?: number
}

function createElementStub({
  attributes = {},
  dataset = {},
  scrollHeight = 100,
  clientHeight = 100,
}: ElementStubOptions = {}): HTMLElement {
  return {
    hasAttribute: (name: string) => Object.hasOwn(attributes, name),
    getAttribute: (name: string) =>
      Object.hasOwn(attributes, name) ? attributes[name]! : null,
    dataset,
    scrollHeight,
    clientHeight,
  } as unknown as HTMLElement
}

describe("Spec 0026: Home Page Redesign, Single-RAF Motion & Proportion Invariants", () => {
  // covers: AC-1
  it("AC-1: enforces zero-touch Custom Journey Builder lock and preserved #journey-builder invocation", () => {
    const plannerDiff = execFileSync(
      "git",
      ["diff", "--name-only", "--", "components/planner"],
      { cwd: WEB_DIR, encoding: "utf8" }
    )
    expect(plannerDiff.trim()).toBe("")

    const pageSource = fs.readFileSync(
      path.join(WEB_DIR, "app/(public)/page.tsx"),
      "utf8"
    )
    expect(pageSource).toContain(
      "const sanitizedPlannerProps = sanitizeHomePlannerCatalog("
    )
    expect(pageSource).toMatch(
      /<div id="journey-builder" className="scroll-mt-20">\s*<CustomJourneyBuilder[\s\S]*?visaRates=\{sanitizedPlannerProps\.visaRates\}[\s\S]*?\/>\s*<\/div>/
    )
  })

  // covers: AC-2, AC-3, AC-4
  it("AC-2, AC-3 & AC-4: enforces single-RAF Lenis options, Base UI portal scroll guard, and Node SSR GSAP safety", () => {
    expect(LENIS_ROOT_OPTIONS.autoRaf).toBe(false)
    expect(LENIS_ROOT_OPTIONS.syncTouch).toBe(false)
    expect(LENIS_ROOT_OPTIONS.anchors).toEqual({ offset: -80 })
    expect(PublicMotionAndScrollProvider).toBe(PublicMotionProvider)

    const publicLayoutSource = fs.readFileSync(
      path.join(WEB_DIR, "app/(public)/layout.tsx"),
      "utf8"
    )
    const adminLayoutSource = fs.readFileSync(
      path.join(WEB_DIR, "app/admin/layout.tsx"),
      "utf8"
    )
    expect(publicLayoutSource).toContain("PublicMotionProvider")
    expect(adminLayoutSource).not.toContain("PublicMotionProvider")
    expect(adminLayoutSource).not.toContain("lenis")

    // Base UI portals, explicit opt-outs, modals/listboxes, and scrollable slots yield to native scroll
    expect(
      shouldPreventLenisScroll(
        createElementStub({ attributes: { "data-base-ui-portal": "" } })
      )
    ).toBe(true)
    expect(
      shouldPreventLenisScroll(
        createElementStub({ attributes: { "data-lenis-prevent": "" } })
      )
    ).toBe(true)
    expect(
      shouldPreventLenisScroll(
        createElementStub({ attributes: { "data-lenis-prevent-wheel": "" } })
      )
    ).toBe(true)
    expect(
      shouldPreventLenisScroll(
        createElementStub({ attributes: { role: "dialog" } })
      )
    ).toBe(true)
    expect(
      shouldPreventLenisScroll(
        createElementStub({ attributes: { role: "listbox" } })
      )
    ).toBe(true)
    expect(
      shouldPreventLenisScroll(
        createElementStub({ dataset: { slot: "popover-content" } })
      )
    ).toBe(true)
    expect(
      shouldPreventLenisScroll(
        createElementStub({ dataset: { slot: "select-content" } })
      )
    ).toBe(true)
    expect(
      shouldPreventLenisScroll(
        createElementStub({ dataset: { slot: "command-list" } })
      )
    ).toBe(true)

    // Normal non-portal, non-scrollable elements allow Lenis smooth scroll
    expect(shouldPreventLenisScroll(createElementStub())).toBe(false)
    expect(
      shouldPreventLenisScroll(
        createElementStub({
          attributes: { role: "region" },
          dataset: { slot: "card" },
          scrollHeight: 420,
          clientHeight: 420,
        })
      )
    ).toBe(false)

    // GSAP plugin registration safely no-ops in Node SSR
    expect(typeof window).toBe("undefined")
    expect(ensureGsapPlugins()).toBe(false)
  })

  // covers: AC-1, AC-4, AC-5, AC-9
  it("AC-4, AC-5 & AC-9: renders HomePage SSR markup with single <h1>, #journey-builder/#custom-journey, TrustHomeOverview ledger, and zero SSR opacity:0", async () => {
    const html = renderToStaticMarkup(await HomePage())

    const h1Count = (html.match(/<h1\b/gi) ?? []).length
    expect(h1Count).toBe(1)

    expect(html).toContain('id="journey-builder"')
    expect(html).toContain('id="custom-journey"')

    // Duplicate Section 6B table removed while TrustHomeOverview ledger & 4 Guarantees remain
    expect(html).not.toContain(
      "Verified Haramain Pilgrimage Rules &amp; Dedicated Hub Directory"
    )
    expect(html).not.toContain(
      "Verified Haramain Pilgrimage Rules & Dedicated Hub Directory"
    )
    expect(html).toContain(
      "Umrah Packages, Saudi Visas &amp; Haramain Services from Pakistan"
    )
    expect(html).toContain("<table")
    expect(html).toContain("4 Core Haramain Booking Guarantees")

    // sloplint Gate 62: SSR copy and cards must never emit inline opacity:0 at rest
    const htmlWithoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "")
    expect(htmlWithoutScripts).not.toMatch(/style="[^"]*opacity:\s*0(?![.\d])/i)
    expect(htmlWithoutScripts).not.toMatch(/opacity:\s*0(?![.\d])/i)
  })

  // covers: AC-6, AC-7, AC-8, AC-9, AC-10
  it("AC-6..AC-10: enforces anti-slop transition-all ban, motion/react standardization, and balanced section architecture across Home sources", () => {
    for (const relPath of HOME_SECTION_SOURCE_PATHS) {
      const source = fs.readFileSync(path.join(WEB_DIR, relPath), "utf8")
      expect(
        source,
        `${relPath} must not contain transition-all`
      ).not.toContain("transition-all")
      expect(
        source,
        `${relPath} must import from "motion/react", never "framer-motion"`
      ).not.toMatch(/from\s+["']framer-motion["']/)
    }

    for (const relPath of MOTION_IMPORTING_FILES) {
      const source = fs.readFileSync(path.join(WEB_DIR, relPath), "utf8")
      expect(
        source,
        `${relPath} must import Motion from "motion/react"`
      ).toMatch(/from\s+["']motion\/react["']/)
    }

    const hajjSource = fs.readFileSync(
      path.join(WEB_DIR, "components/public/hajj-inquiry-section.tsx"),
      "utf8"
    )
    expect(hajjSource).toContain("xl:grid-cols-4")

    const groupSource = fs.readFileSync(
      path.join(WEB_DIR, "components/public/group-packages-section.tsx"),
      "utf8"
    )
    expect(groupSource).toContain("useEmblaCarousel")

    const trackerSource = fs.readFileSync(
      path.join(WEB_DIR, "components/public/status-tracker.tsx"),
      "utf8"
    )
    expect(trackerSource).toContain("AnimatePresence")

    const faqSource = fs.readFileSync(
      path.join(WEB_DIR, "components/public/faq-accordion-client.tsx"),
      "utf8"
    )
    expect(faqSource).toContain("keepMounted")
  })

  // covers: AC-2, AC-4
  it("exports non-overshooting Haramain easing curves and complete motion barrel bindings", () => {
    expect(HARAMAIN_EASE).toEqual([0.16, 1, 0.3, 1])
    expect(HARAMAIN_EASE.every((point) => point >= 0 && point <= 1)).toBe(true)
    expect(HARAMAIN_GSAP_EASE).toBe("power3.out")
    expect(MotionBarrel.gsap).toBeDefined()
    expect(MotionBarrel.ScrollTrigger).toBeDefined()
    expect(MotionBarrel.useGSAP).toBeDefined()
    expect(MotionBarrel.HaramainSectionReveal).toBe(HaramainSectionReveal)
    expect(MotionBarrel.MotionPillIndicator).toBe(MotionPillIndicator)
  })

  // covers: AC-3
  it("isolates scrollable overflow containers in browser environments while never blocking documentElement or body", () => {
    const originalWindow = Reflect.get(globalThis, "window")
    const originalDocument = Reflect.get(globalThis, "document")

    const fakeBody = createElementStub({
      scrollHeight: 9000,
      clientHeight: 900,
    })
    const fakeDocEl = createElementStub({
      scrollHeight: 9000,
      clientHeight: 900,
    })
    const overflowAutoBox = createElementStub({
      scrollHeight: 420,
      clientHeight: 200,
    })
    const overflowHiddenBox = createElementStub({
      scrollHeight: 420,
      clientHeight: 200,
    })
    const subpixelEqualBox = createElementStub({
      scrollHeight: 201,
      clientHeight: 200,
    })

    try {
      Reflect.set(globalThis, "document", {
        body: fakeBody,
        documentElement: fakeDocEl,
      })
      Reflect.set(globalThis, "window", {
        getComputedStyle: (el: HTMLElement) => ({
          overflowY: el === overflowHiddenBox ? "hidden" : "auto",
        }),
      })

      expect(shouldPreventLenisScroll(fakeBody)).toBe(false)
      expect(shouldPreventLenisScroll(fakeDocEl)).toBe(false)
      expect(shouldPreventLenisScroll(overflowAutoBox)).toBe(true)
      expect(shouldPreventLenisScroll(overflowHiddenBox)).toBe(false)
      expect(shouldPreventLenisScroll(subpixelEqualBox)).toBe(false)
      expect(
        shouldPreventLenisScroll(
          createElementStub({ dataset: { slot: "dialog-content" } })
        )
      ).toBe(true)
      expect(
        shouldPreventLenisScroll(
          createElementStub({ dataset: { slot: "sheet-content" } })
        )
      ).toBe(true)
    } finally {
      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalThis, "window")
      } else {
        Reflect.set(globalThis, "window", originalWindow)
      }
      if (originalDocument === undefined) {
        Reflect.deleteProperty(globalThis, "document")
      } else {
        Reflect.set(globalThis, "document", originalDocument)
      }
    }
  })

  // covers: AC-2, AC-4
  it("renders HaramainSectionReveal semantic tags and aria-hidden MotionPillIndicator at full SSR visibility", () => {
    const sectionHtml = renderToStaticMarkup(
      React.createElement(
        HaramainSectionReveal,
        { as: "section", className: "haramain-block" },
        React.createElement("h2", null, "Sacred Sanctuary")
      )
    )
    const articleHtml = renderToStaticMarkup(
      React.createElement(
        HaramainSectionReveal,
        { as: "article" },
        React.createElement("p", null, "Courtyard proximity")
      )
    )
    const pillHtml = renderToStaticMarkup(
      React.createElement(MotionPillIndicator, {
        layoutId: "test-pill",
        className: "bg-gold",
      })
    )

    expect(sectionHtml).toContain("<section ")
    expect(sectionHtml).toContain("haramain-block")
    expect(sectionHtml).toContain("print:opacity-100!")
    expect(sectionHtml).toContain("Sacred Sanctuary")
    expect(sectionHtml).not.toMatch(/opacity:\s*0(?![.\d])/i)
    expect(articleHtml).toContain("<article ")
    expect(articleHtml).toContain("print:opacity-100!")
    expect(pillHtml).toContain('aria-hidden="true"')
  })

  // covers: AC-2, AC-4, Minor 2
  it("runs HaramainSectionReveal ScrollTrigger, beforeprint cleanup, and reduced-motion clearing cleanly", () => {
    const createMockDeps = (activeQuery: string, rectTop: number) => {
      const fromToCalls: Array<{
        target: HTMLElement
        fromVars: Record<string, unknown>
        toVars: Record<string, unknown>
      }> = []
      const setCalls: Array<{
        target: HTMLElement
        vars: Record<string, unknown>
      }> = []
      const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
      const cleanups: Array<() => void> = []
      let reverted = false

      const fakeNode = {
        getBoundingClientRect: () => ({ top: rectTop }),
      } as unknown as HTMLElement

      const fakeWin = {
        innerHeight: 900,
        addEventListener: (
          type: string,
          listener: EventListenerOrEventListenerObject
        ) => {
          const set = listeners.get(type) ?? new Set()
          set.add(listener)
          listeners.set(type, set)
        },
        removeEventListener: (
          type: string,
          listener: EventListenerOrEventListenerObject
        ) => {
          listeners.get(type)?.delete(listener)
        },
      }

      const gsapApi = {
        matchMedia: () => ({
          add: (query: string, handler: () => void | (() => void)) => {
            if (query === activeQuery) {
              const maybeCleanup = handler()
              if (typeof maybeCleanup === "function") {
                cleanups.push(maybeCleanup)
              }
            }
          },
          revert: () => {
            reverted = true
            for (const fn of cleanups) fn()
          },
        }),
        fromTo: (
          target: HTMLElement,
          fromVars: Record<string, unknown>,
          toVars: Record<string, unknown>
        ) => {
          fromToCalls.push({ target, fromVars, toVars })
        },
        set: (target: HTMLElement, vars: Record<string, unknown>) => {
          setCalls.push({ target, vars })
        },
      }

      return {
        fakeNode,
        fakeWin,
        gsapApi,
        fromToCalls,
        setCalls,
        listeners,
        isReverted: () => reverted,
      }
    }

    // 1. Below-the-fold (no-preference): ScrollTrigger once:true + clearProps + beforeprint listener/cleanup
    const belowFold = createMockDeps("(prefers-reduced-motion: no-preference)", 1400)
    const cleanupBelow = runHaramainSectionRevealEffect(
      belowFold.fakeNode,
      { yOffset: 20, duration: 0.55, delay: 0, once: true },
      {
        gsapApi: belowFold.gsapApi,
        ensurePlugins: () => true,
        win: belowFold.fakeWin,
      }
    )

    expect(belowFold.fromToCalls).toHaveLength(1)
    expect(belowFold.fromToCalls[0]?.fromVars).toEqual({ opacity: 0, y: 20 })
    expect(belowFold.fromToCalls[0]?.toVars).toEqual({
      opacity: 1,
      y: 0,
      duration: 0.55,
      delay: 0,
      ease: HARAMAIN_GSAP_EASE,
      clearProps: "opacity,transform",
      scrollTrigger: {
        trigger: belowFold.fakeNode,
        start: "top 96%",
        once: true,
      },
    })

    const beforePrintListeners = belowFold.listeners.get("beforeprint")
    expect(beforePrintListeners?.size).toBe(1)
    for (const listener of beforePrintListeners ?? []) {
      if (typeof listener === "function") {
        listener({ type: "beforeprint" } as Event)
      }
    }
    expect(belowFold.setCalls).toEqual([
      {
        target: belowFold.fakeNode,
        vars: { clearProps: "opacity,transform" },
      },
    ])

    cleanupBelow()
    expect(belowFold.isReverted()).toBe(true)
    expect(belowFold.listeners.get("beforeprint")?.size).toBe(0)

    // 2. Above-the-fold (no-preference): transform-only reveal without opacity:0
    const aboveFold = createMockDeps("(prefers-reduced-motion: no-preference)", 120)
    const cleanupAbove = runHaramainSectionRevealEffect(
      aboveFold.fakeNode,
      { yOffset: 20, duration: 0.55, delay: 0.1, once: true },
      {
        gsapApi: aboveFold.gsapApi,
        ensurePlugins: () => true,
        win: aboveFold.fakeWin,
      }
    )
    expect(aboveFold.fromToCalls).toHaveLength(1)
    expect(aboveFold.fromToCalls[0]?.fromVars).toEqual({ y: 12 })
    expect(aboveFold.fromToCalls[0]?.toVars).toEqual({
      y: 0,
      duration: 0.36,
      delay: 0.1,
      ease: HARAMAIN_GSAP_EASE,
      clearProps: "transform",
    })
    cleanupAbove()

    // 3. Reduced motion: clears opacity/transform immediately with zero fromTo animations
    const reduced = createMockDeps("(prefers-reduced-motion: reduce)", 1400)
    const cleanupReduced = runHaramainSectionRevealEffect(
      reduced.fakeNode,
      { yOffset: 20, duration: 0.55, delay: 0, once: true },
      {
        gsapApi: reduced.gsapApi,
        ensurePlugins: () => true,
        win: reduced.fakeWin,
      }
    )
    expect(reduced.fromToCalls).toHaveLength(0)
    expect(reduced.setCalls).toEqual([
      {
        target: reduced.fakeNode,
        vars: { clearProps: "opacity,transform" },
      },
    ])
    cleanupReduced()
    expect(reduced.isReverted()).toBe(true)
  })

  // covers: AC-2, AC-9
  it("renders PublicMotionProvider and PublicLayout shell with header, main landmark, footer, and zero wholesale SAR keys", async () => {
    const providerHtml = renderToStaticMarkup(
      React.createElement(
        PublicMotionProvider,
        null,
        React.createElement("div", { id: "motion-child" }, "Pilgrim Content")
      )
    )
    expect(providerHtml).toContain('id="motion-child"')
    expect(providerHtml).toContain("Pilgrim Content")

    const layoutTree = await PublicLayout({
      children: React.createElement(
        "section",
        { id: "child-page" },
        "Storefront Child"
      ),
    })
    const layoutHtml = renderToStaticMarkup(layoutTree)

    expect(layoutHtml).toContain("<main")
    expect(layoutHtml).toContain('id="child-page"')
    expect(layoutHtml).toContain("Storefront Child")
    expect(layoutHtml).toContain("Al Ramlah Travels")
    expect(layoutHtml).not.toContain("sharingPriceSar")
    expect(layoutHtml).not.toContain("withoutMasarPriceSar")
  })
})
