import type { MetadataRoute } from "next"
import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { CANONICAL_ORIGIN } from "@/lib/seo/metadata"

export const revalidate = 3600

const FALLBACK_LAST_MODIFIED = new Date("2026-11-15T00:00:00.000Z")

interface SitemapFreshnessSnapshot {
  agencyUpdatedAt: Date
  umrahUpdatedAt: Date
  hajjUpdatedAt: Date
  visaUpdatedAt: Date
  makkahHotelsUpdatedAt: Date
  madinahHotelsUpdatedAt: Date
  ziyaratUpdatedAt: Date
  faqUpdatedAt: Date
  activePackages: Array<{
    slug: string
    lastModified: Date
  }>
}

function toSafeDate(candidate: unknown, fallback: Date): Date {
  if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
    return candidate
  }
  if (typeof candidate === "string" || typeof candidate === "number") {
    const parsed = new Date(candidate)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return fallback
}

function maxDate(...dates: Date[]): Date {
  let latest = FALLBACK_LAST_MODIFIED
  for (const d of dates) {
    if (d.getTime() > latest.getTime()) {
      latest = d
    }
  }
  return latest
}

async function loadSitemapFreshness(): Promise<SitemapFreshnessSnapshot> {
  try {
    const [
      agencyRows,
      hajjMaxRows,
      visaMaxRows,
      hotelMaxRows,
      ziyaratMaxRows,
      faqMaxRows,
      pkgRows,
      depMaxRows,
    ] = await Promise.all([
      db
        .select({ updatedAt: schema.agencySettings.updatedAt })
        .from(schema.agencySettings)
        .where(eq(schema.agencySettings.id, "default"))
        .limit(1),
      db
        .select({
          latest: sql<Date | null>`MAX(${schema.hajjPackages.updatedAt})`,
        })
        .from(schema.hajjPackages)
        .where(eq(schema.hajjPackages.isActive, true)),
      db
        .select({
          latest: sql<Date | null>`MAX(${schema.visaRates.updatedAt})`,
        })
        .from(schema.visaRates),
      db
        .select({
          city: schema.hotels.city,
          latest: sql<Date | null>`MAX(${schema.hotels.updatedAt})`,
        })
        .from(schema.hotels)
        .where(eq(schema.hotels.isActive, true))
        .groupBy(schema.hotels.city),
      db
        .select({
          latest: sql<Date | null>`MAX(${schema.ziyaratPlaces.updatedAt})`,
        })
        .from(schema.ziyaratPlaces)
        .where(eq(schema.ziyaratPlaces.isActive, true)),
      db
        .select({
          latest: sql<Date | null>`MAX(${schema.faqs.updatedAt})`,
        })
        .from(schema.faqs)
        .where(eq(schema.faqs.isActive, true)),
      db
        .select({
          id: schema.groupPackages.id,
          slug: schema.groupPackages.slug,
          updatedAt: schema.groupPackages.updatedAt,
        })
        .from(schema.groupPackages)
        .where(eq(schema.groupPackages.isActive, true)),
      db
        .select({
          packageId: schema.groupDepartures.packageId,
          latest: sql<Date | null>`MAX(${schema.groupDepartures.updatedAt})`,
        })
        .from(schema.groupDepartures)
        .groupBy(schema.groupDepartures.packageId),
    ])

    const depMaxByPkg = new Map<string, Date>()
    for (const row of depMaxRows) {
      depMaxByPkg.set(
        row.packageId,
        toSafeDate(row.latest, FALLBACK_LAST_MODIFIED)
      )
    }

    const activePackages = pkgRows
      .filter((pkg) => Boolean(pkg.slug?.trim()))
      .map((pkg) => {
        const pkgDate = toSafeDate(pkg.updatedAt, FALLBACK_LAST_MODIFIED)
        const depDate = depMaxByPkg.get(pkg.id) ?? FALLBACK_LAST_MODIFIED
        return {
          slug: pkg.slug.trim(),
          lastModified: maxDate(pkgDate, depDate),
        }
      })

    const makkahHotelRow = hotelMaxRows.find((r) => r.city === "makkah")
    const madinahHotelRow = hotelMaxRows.find((r) => r.city === "madinah")

    const agencyUpdatedAt = toSafeDate(
      agencyRows[0]?.updatedAt,
      FALLBACK_LAST_MODIFIED
    )
    const umrahUpdatedAt =
      activePackages.length > 0
        ? maxDate(...activePackages.map((p) => p.lastModified))
        : agencyUpdatedAt

    return {
      agencyUpdatedAt,
      umrahUpdatedAt,
      hajjUpdatedAt: toSafeDate(hajjMaxRows[0]?.latest, agencyUpdatedAt),
      visaUpdatedAt: toSafeDate(visaMaxRows[0]?.latest, agencyUpdatedAt),
      makkahHotelsUpdatedAt: toSafeDate(
        makkahHotelRow?.latest,
        agencyUpdatedAt
      ),
      madinahHotelsUpdatedAt: toSafeDate(
        madinahHotelRow?.latest,
        agencyUpdatedAt
      ),
      ziyaratUpdatedAt: toSafeDate(ziyaratMaxRows[0]?.latest, agencyUpdatedAt),
      faqUpdatedAt: toSafeDate(faqMaxRows[0]?.latest, agencyUpdatedAt),
      activePackages,
    }
  } catch {
    return {
      agencyUpdatedAt: FALLBACK_LAST_MODIFIED,
      umrahUpdatedAt: FALLBACK_LAST_MODIFIED,
      hajjUpdatedAt: FALLBACK_LAST_MODIFIED,
      visaUpdatedAt: FALLBACK_LAST_MODIFIED,
      makkahHotelsUpdatedAt: FALLBACK_LAST_MODIFIED,
      madinahHotelsUpdatedAt: FALLBACK_LAST_MODIFIED,
      ziyaratUpdatedAt: FALLBACK_LAST_MODIFIED,
      faqUpdatedAt: FALLBACK_LAST_MODIFIED,
      activePackages: [],
    }
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const snap = await loadSitemapFreshness()
  const homeLastMod = maxDate(
    snap.agencyUpdatedAt,
    snap.umrahUpdatedAt,
    snap.hajjUpdatedAt,
    snap.visaUpdatedAt
  )

  const staticAndHubEntries: MetadataRoute.Sitemap = [
    {
      url: CANONICAL_ORIGIN,
      lastModified: homeLastMod,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${CANONICAL_ORIGIN}/umrah-packages`,
      lastModified: snap.umrahUpdatedAt,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${CANONICAL_ORIGIN}/umrah-packages/from-lahore`,
      lastModified: snap.umrahUpdatedAt,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${CANONICAL_ORIGIN}/umrah-packages/from-karachi`,
      lastModified: snap.umrahUpdatedAt,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${CANONICAL_ORIGIN}/umrah-packages/from-islamabad`,
      lastModified: snap.umrahUpdatedAt,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${CANONICAL_ORIGIN}/hajj-2027`,
      lastModified: snap.hajjUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${CANONICAL_ORIGIN}/umrah-visa`,
      lastModified: snap.visaUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${CANONICAL_ORIGIN}/hotels/makkah`,
      lastModified: snap.makkahHotelsUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${CANONICAL_ORIGIN}/hotels/madinah`,
      lastModified: snap.madinahHotelsUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${CANONICAL_ORIGIN}/ziyarat`,
      lastModified: snap.ziyaratUpdatedAt,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${CANONICAL_ORIGIN}/ziyarat/makkah`,
      lastModified: snap.ziyaratUpdatedAt,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${CANONICAL_ORIGIN}/ziyarat/madinah`,
      lastModified: snap.ziyaratUpdatedAt,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${CANONICAL_ORIGIN}/about`,
      lastModified: snap.agencyUpdatedAt,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${CANONICAL_ORIGIN}/contact`,
      lastModified: snap.agencyUpdatedAt,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${CANONICAL_ORIGIN}/faq`,
      lastModified: snap.faqUpdatedAt,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${CANONICAL_ORIGIN}/privacy`,
      lastModified: snap.agencyUpdatedAt,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${CANONICAL_ORIGIN}/terms`,
      lastModified: snap.agencyUpdatedAt,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${CANONICAL_ORIGIN}/refund-policy`,
      lastModified: snap.agencyUpdatedAt,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ]

  const packageEntries: MetadataRoute.Sitemap = snap.activePackages.map(
    (pkg) => ({
      url: `${CANONICAL_ORIGIN}/umrah-packages/${encodeURIComponent(pkg.slug)}`,
      lastModified: pkg.lastModified,
      changeFrequency: "daily",
      priority: 0.85,
    })
  )

  return [...staticAndHubEntries, ...packageEntries]
}
