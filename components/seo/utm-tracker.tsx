"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { captureFirstTouchAttribution } from "@/lib/seo/utm"

/**
 * First-touch UTM, landing-page, and external HTTP referrer listener (`SEO-004`, `S14-002`).
 * Must be mounted inside `<Suspense fallback={null}>` in `app/(public)/layout.tsx`
 * so public pages preserve full static / ISR rendering without dynamic searchParams bailout.
 */
export function UtmTracker(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()

  useEffect(() => {
    captureFirstTouchAttribution({
      pathname: pathname || "/",
      search: searchString ? `?${searchString}` : "",
    })
  }, [pathname, searchString])

  return null
}
