import { revalidatePath } from "next/cache"

export const PUBLIC_SEO_PATHS = [
  "/",
  "/umrah-packages",
  "/umrah-packages/from-lahore",
  "/umrah-packages/from-karachi",
  "/umrah-packages/from-islamabad",
  "/hajj-2027",
  "/umrah-visa",
  "/hotels/makkah",
  "/hotels/madinah",
  "/ziyarat",
  "/ziyarat/makkah",
  "/ziyarat/madinah",
  "/about",
  "/contact",
  "/faq",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/sitemap.xml",
] as const

export type PublicSeoPath = (typeof PUBLIC_SEO_PATHS)[number]

/**
 * Revalidates all public SEO hubs, city/guide spokes, `/sitemap.xml`, and optional package slugs
 * when catalog, group departure, CMS, flyer, or agency settings records mutate (`SEO-007`, `S01-005`).
 * Wrapped in `try/catch` so direct Server Action test invocations outside Next.js request stores never throw.
 */
export function revalidatePublicSeoPaths(
  extraPathsOrSlugs?: ReadonlyArray<string | null | undefined>
): void {
  const uniquePaths = new Set<string>(PUBLIC_SEO_PATHS)

  if (extraPathsOrSlugs) {
    for (const raw of extraPathsOrSlugs) {
      const trimmed = (raw ?? "").trim()
      if (!trimmed) continue
      if (trimmed.startsWith("/")) {
        uniquePaths.add(trimmed)
      } else {
        uniquePaths.add(`/umrah-packages/${trimmed}`)
      }
    }
  }

  for (const targetPath of uniquePaths) {
    try {
      revalidatePath(targetPath)
    } catch {
      // Safe no-op outside Next.js incremental cache runtime (e.g. unit/integration tests)
    }
  }

  try {
    revalidatePath("/umrah-packages/[slug]", "page")
  } catch {
    // Safe no-op outside Next.js incremental cache runtime
  }
}
