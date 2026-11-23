"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import type { LenisOptions } from "lenis"
import { ReactLenis, useLenis, type LenisRef } from "lenis/react"
import { MotionConfig } from "motion/react"
import {
  ensureGsapPlugins,
  gsap,
  HARAMAIN_EASE,
  ScrollTrigger,
} from "./gsap-registry"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

const HARAMAIN_MOTION_TRANSITION = {
  duration: 0.32,
  ease: HARAMAIN_EASE,
} as const

const PREVENT_LENIS_SLOTS = new Set([
  "select-content",
  "command-list",
  "popover-content",
  "dialog-content",
  "sheet-content",
])

/**
 * Pure Lenis `prevent` predicate isolating Base UI portals, modal/dialog drawers,
 * listboxes, command palettes, and nested scrollable containers (`Spec 0026` AC-3).
 */
export function shouldPreventLenisScroll(node: HTMLElement): boolean {
  if (
    node.hasAttribute("data-lenis-prevent") ||
    node.hasAttribute("data-lenis-prevent-wheel") ||
    node.hasAttribute("data-base-ui-portal")
  ) {
    return true
  }

  const role = node.getAttribute("role")
  if (role === "dialog" || role === "listbox") {
    return true
  }

  const slot = node.dataset?.slot ?? node.getAttribute("data-slot")
  if (slot && PREVENT_LENIS_SLOTS.has(slot)) {
    return true
  }

  if (typeof window !== "undefined") {
    if (
      typeof document !== "undefined" &&
      (node === document.body || node === document.documentElement)
    ) {
      return false
    }
    if (node.scrollHeight > node.clientHeight + 1) {
      const overflowY = window.getComputedStyle(node).overflowY
      if (/^(auto|scroll|overlay)$/.test(overflowY)) {
        return true
      }
    }
  }

  return false
}

/**
 * Module-level stable Lenis options so `ReactLenis` never re-instantiates across re-renders.
 */
export const LENIS_ROOT_OPTIONS: LenisOptions = {
  autoRaf: false,
  lerp: 0.11,
  smoothWheel: true,
  syncTouch: false,
  anchors: { offset: -80 },
  prevent: shouldPreventLenisScroll,
}

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {}
  }
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onStoreChange)
    return () => mediaQuery.removeEventListener("change", onStoreChange)
  }
  mediaQuery.addListener(onStoreChange)
  return () => mediaQuery.removeListener(onStoreChange)
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function getReducedMotionServerSnapshot(): boolean {
  return false
}

function LenisGsapSync({
  lenisRef,
}: {
  lenisRef: React.RefObject<LenisRef | null>
}) {
  const lenis = useLenis()
  const pathname = usePathname()

  React.useEffect(() => {
    const activeLenis = lenis ?? lenisRef.current?.lenis
    if (!activeLenis || !ensureGsapPlugins()) {
      return
    }

    activeLenis.on("scroll", ScrollTrigger.update)

    const update = (time: number) => {
      const current = lenisRef.current?.lenis ?? activeLenis
      current.raf(time * 1000)
    }

    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(update)
      activeLenis.off("scroll", ScrollTrigger.update)
    }
  }, [lenis, lenisRef])

  React.useEffect(() => {
    if (!ensureGsapPlugins()) return
    if (ScrollTrigger.getAll().length > 0) {
      ScrollTrigger.refresh()
    }
  }, [pathname])

  return null
}

/**
 * Public storefront motion & single-RAF Lenis + GSAP ScrollTrigger provider.
 * Disables smooth scroll interpolation on `/voucher/**` print views and when
 * `prefers-reduced-motion: reduce` is active (`Spec 0026` AC-2, AC-3, AC-4).
 */
export function PublicMotionProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const lenisRef = React.useRef<LenisRef | null>(null)
  const prefersReducedMotion = React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  )

  const isVoucherRoute = Boolean(pathname?.startsWith("/voucher"))
  const shouldEnableLenis = !isVoucherRoute && !prefersReducedMotion

  if (!shouldEnableLenis) {
    return (
      <MotionConfig reducedMotion="user" transition={HARAMAIN_MOTION_TRANSITION}>
        {children}
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user" transition={HARAMAIN_MOTION_TRANSITION}>
      <ReactLenis ref={lenisRef} root options={LENIS_ROOT_OPTIONS}>
        <LenisGsapSync lenisRef={lenisRef} />
        {children}
      </ReactLenis>
    </MotionConfig>
  )
}

export const PublicMotionAndScrollProvider = PublicMotionProvider
