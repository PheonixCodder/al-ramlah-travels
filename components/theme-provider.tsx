"use client"

import * as React from "react"

export const LOCKED_THEME_CONFIG = {
  forcedTheme: "light",
  defaultTheme: "light",
  enableSystem: false,
  disableTransitionOnChange: true,
} as const

export interface LockedThemeContextValue {
  theme: "light"
  resolvedTheme: "light"
  forcedTheme: "light"
  systemTheme: "light"
  enableSystem: false
  disableTransitionOnChange: true
}

const LockedThemeContext = React.createContext<LockedThemeContextValue>({
  theme: "light",
  resolvedTheme: "light",
  forcedTheme: "light",
  systemTheme: "light",
  enableSystem: false,
  disableTransitionOnChange: true,
})

export function useTheme(): LockedThemeContextValue {
  return React.useContext(LockedThemeContext)
}

export interface ThemeProviderProps {
  children: React.ReactNode
  forcedTheme?: "light"
  defaultTheme?: "light"
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
  attribute?: string
}

/**
 * Single Luxury Haramain Light Theme Provider (`T-092` / `design.md` §2).
 * Hard-locks `forcedTheme="light"`, `enableSystem={false}`, and `disableTransitionOnChange`
 * so OS dark mode or stale client classes can never override the Warm Ivory / Deep Emerald palette.
 */
export function ThemeProvider({
  children,
  forcedTheme = "light",
  enableSystem = false,
  disableTransitionOnChange = true,
}: ThemeProviderProps) {
  const lockedValue = React.useMemo<LockedThemeContextValue>(
    () => ({
      theme: "light",
      resolvedTheme: "light",
      forcedTheme: forcedTheme === "light" ? "light" : "light",
      systemTheme: "light",
      enableSystem: enableSystem ? false : false,
      disableTransitionOnChange: disableTransitionOnChange ? true : true,
    }),
    [forcedTheme, enableSystem, disableTransitionOnChange]
  )

  React.useEffect(() => {
    const root = document.documentElement
    let styleEl: HTMLStyleElement | null = null

    if (LOCKED_THEME_CONFIG.disableTransitionOnChange) {
      styleEl = document.createElement("style")
      styleEl.appendChild(
        document.createTextNode(
          "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}"
        )
      )
      document.head.appendChild(styleEl)
    }

    root.classList.remove("dark")
    root.classList.add("light")
    root.dataset.theme = LOCKED_THEME_CONFIG.forcedTheme
    root.style.colorScheme = LOCKED_THEME_CONFIG.forcedTheme

    let rafId: number | null = null
    if (styleEl) {
      void window.getComputedStyle(document.body)
      rafId = window.requestAnimationFrame(() => {
        styleEl?.remove()
      })
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      styleEl?.remove()
    }
  }, [])

  return (
    <LockedThemeContext.Provider value={lockedValue}>
      <div
        data-forced-theme={LOCKED_THEME_CONFIG.forcedTheme}
        data-enable-system={String(LOCKED_THEME_CONFIG.enableSystem)}
        data-disable-transition-on-change={String(
          LOCKED_THEME_CONFIG.disableTransitionOnChange
        )}
        className="contents"
      >
        {children}
      </div>
    </LockedThemeContext.Provider>
  )
}
