"use client"

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "cn"
import {
  ensureGsapPlugins,
  gsap,
  HARAMAIN_EASE,
  HARAMAIN_GSAP_EASE,
  useGSAP,
} from "./gsap-registry"

export interface HaramainSectionRevealProps {
  children: React.ReactNode
  className?: string
  /** Subtle vertical entrance offset in pixels (applied client-side only under reduced-motion guard). */
  yOffset?: number
  /** Tween duration in seconds. */
  duration?: number
  /** Optional delay in seconds before entrance begins. */
  delay?: number
  /** Whether the ScrollTrigger entrance fires once (default: true). */
  once?: boolean
  /** Semantic container tag (default: "div"). */
  as?: "div" | "section" | "article"
}

export interface HaramainSectionRevealEffectOptions {
  yOffset?: number
  duration?: number
  delay?: number
  once?: boolean
}

export interface HaramainRevealMatchMedia {
  add: (query: string, handler: () => void | (() => void)) => unknown
  revert: () => void
}

export interface HaramainRevealGsapDeps {
  gsapApi?: {
    matchMedia: () => HaramainRevealMatchMedia
    fromTo: (
      target: HTMLElement,
      fromVars: { opacity?: number; y?: number },
      toVars: {
        opacity?: number
        y?: number
        duration?: number
        delay?: number
        ease?: string
        clearProps?: string
        scrollTrigger?: {
          trigger: HTMLElement
          start: string
          once: boolean
        }
      }
    ) => unknown
    set: (target: HTMLElement, vars: { clearProps?: string }) => unknown
  }
  ensurePlugins?: () => boolean
  win?: Pick<
    Window,
    "innerHeight" | "addEventListener" | "removeEventListener"
  > | null
}

/**
 * Configures GSAP ScrollTrigger + `prefers-reduced-motion` + `beforeprint`
 * visibility safeguards on a mounted reveal container node.
 */
export function runHaramainSectionRevealEffect(
  node: HTMLElement | null,
  options: HaramainSectionRevealEffectOptions = {},
  gsapDeps: HaramainRevealGsapDeps = {}
): () => void {
  const ensure = gsapDeps.ensurePlugins ?? ensureGsapPlugins
  if (!node || !ensure()) {
    return () => {}
  }

  const gsapApi = gsapDeps.gsapApi ?? gsap
  const win =
    gsapDeps.win !== undefined
      ? gsapDeps.win
      : typeof window !== "undefined"
        ? window
        : null

  const yOffset = options.yOffset ?? 20
  const duration = options.duration ?? 0.55
  const delay = options.delay ?? 0
  const once = options.once ?? true

  const mm = gsapApi.matchMedia()

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const handleBeforePrint = () => {
      gsapApi.set(node, { clearProps: "opacity,transform" })
    }
    if (win && typeof win.addEventListener === "function") {
      win.addEventListener("beforeprint", handleBeforePrint)
    }

    const rect = node.getBoundingClientRect()
    const viewportH = win ? win.innerHeight : 900

    if (rect.top < viewportH * 0.96) {
      gsapApi.fromTo(
        node,
        { y: Math.min(yOffset, 12) },
        {
          y: 0,
          duration: Math.min(duration, 0.36),
          delay,
          ease: HARAMAIN_GSAP_EASE,
          clearProps: "transform",
        }
      )
    } else {
      gsapApi.fromTo(
        node,
        { opacity: 0, y: yOffset },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          ease: HARAMAIN_GSAP_EASE,
          clearProps: "opacity,transform",
          scrollTrigger: {
            trigger: node,
            start: "top 96%",
            once,
          },
        }
      )
    }

    return () => {
      if (win && typeof win.removeEventListener === "function") {
        win.removeEventListener("beforeprint", handleBeforePrint)
      }
    }
  })

  mm.add("(prefers-reduced-motion: reduce)", () => {
    gsapApi.set(node, { clearProps: "opacity,transform" })
  })

  return () => {
    mm.revert()
  }
}

/**
 * SSR-visible section entrance container (`sloplint` Gate 62 compliant).
 * Emits zero inline `opacity: 0` styles during SSR, forces print visibility,
 * and bypasses spatial motion automatically when `prefers-reduced-motion: reduce` is enabled.
 */
export function HaramainSectionReveal({
  children,
  className,
  yOffset = 20,
  duration = 0.55,
  delay = 0,
  once = true,
  as = "div",
}: HaramainSectionRevealProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  useGSAP(
    () =>
      runHaramainSectionRevealEffect(containerRef.current, {
        yOffset,
        duration,
        delay,
        once,
      }),
    { scope: containerRef, dependencies: [yOffset, duration, delay, once] }
  )

  const Tag = as
  return (
    <Tag
      ref={containerRef}
      className={cn(
        "print:opacity-100! print:translate-y-0! print:transform-none!",
        className
      )}
    >
      {children}
    </Tag>
  )
}

export interface MotionPillIndicatorProps {
  layoutId: string
  className?: string
  duration?: number
}

/**
 * Shared `layoutId` active pill indicator built on `motion/react` with
 * exponential Haramain deceleration (`HARAMAIN_EASE`, zero bounce/overshoot).
 */
export function MotionPillIndicator({
  layoutId,
  className,
  duration = 0.28,
}: MotionPillIndicatorProps) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden="true"
      transition={{ duration, ease: HARAMAIN_EASE }}
      className={cn("pointer-events-none", className)}
    />
  )
}
