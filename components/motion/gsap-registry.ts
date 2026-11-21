"use client"

import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"

/**
 * Canonical Haramain deceleration curve for Motion for React (`sloplint` Gate 12 safe: zero overshoot).
 */
export const HARAMAIN_EASE = [0.16, 1, 0.3, 1] as const

/**
 * Canonical GSAP easing curve paired with `HARAMAIN_EASE`.
 */
export const HARAMAIN_GSAP_EASE = "power3.out" as const

let pluginsRegistered = false

/**
 * Idempotently registers GSAP plugins in browser environments only.
 * Guards Node SSR (`renderToStaticMarkup`) from executing DOM registration.
 */
export function ensureGsapPlugins(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  if (!pluginsRegistered) {
    gsap.registerPlugin(ScrollTrigger, useGSAP)
    pluginsRegistered = true
  }
  return true
}

export { gsap, ScrollTrigger, useGSAP }
