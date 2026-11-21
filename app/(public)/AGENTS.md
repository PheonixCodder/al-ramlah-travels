# Public Site & SEO Surface (`app/(public)`)

## Overview

Public pilgrim-facing Hub-and-Spoke pages (`19` indexable route patterns covered by `PUBLIC_SEO_PATHS` + dynamic `/umrah-packages/[slug]`), luxury Custom Journey Builder flows, and token-gated confirmation vouchers (`/voucher/[token]`). Operates in `Persuade` (landing, packages, builder) and `Read` (visa, Hajj, hotel, Ziyarat guides, FAQ, policies) modes per [DESIGN.md](../../DESIGN.md).

## Key files

| File | Owns |
|---|---|
| [layout.tsx](./layout.tsx) | Public shell, `<PublicMotionProvider>`, `<UtmTracker />` (`<Suspense>`), header/footer, WhatsApp FAB |
| [page.tsx](./page.tsx) | `/` hub (`revalidate = 300`), builder showcase, status tracker |
| [public-page-hero.tsx](../../components/public/public-page-hero.tsx) | Shared editorial `PublicPageHero` (`persuade-emerald`, `persuade-ivory`, `read`) |
| [umrah-packages/from-city](./umrah-packages/from-%5Bcity%5D/page.tsx) | Locked Tier-1 gateway spokes (`lahore`, `karachi`, `islamabad`) |
| [umrah-packages/slug](./umrah-packages/%5Bslug%5D/page.tsx) | Package detail + [opengraph-image.tsx](./umrah-packages/%5Bslug%5D/opengraph-image.tsx) (`1200x630`) |
| [hotels/city](./hotels/%5Bcity%5D/page.tsx) | Makkah & Madinah hotel guides (`dynamicParams = false`) |
| [voucher/token](./voucher/%5Btoken%5D/page.tsx) | Private QR voucher (`force-dynamic`, `noindex`, [forbidden.tsx](./voucher/%5Btoken%5D/forbidden.tsx)) |
| [metadata.ts](../../lib/seo/metadata.ts) | `buildPublicMetadata()`, apex `CANONICAL_ORIGIN`, `clampSeoTitle`/`Description` |
| [public-queries.ts](../../lib/seo/public-queries.ts) | Wholesale-SAR-stripped public DTOs & active PKT date filters |
| [json-ld.ts](../../lib/seo/json-ld.ts) | `<JsonLd />` + XSS-safe `serializeJsonLd()` (`OD-09b`/`OD-09e`/`OD-10` guards) |
| [robots.ts](../robots.ts) & [sitemap.ts](../sitemap.ts) | Crawler allow/disallow rules (`llms.txt`: [public/llms.txt](../../public/llms.txt)) |

## Conventions

- **Metadata & Canonicals**: Every indexable route must call `buildPublicMetadata()` — clamps title to `50–60` chars, description to `150–160` chars, sets query-free apex canonical (`https://alramlahtravels.com`), and generates `1200×630` `en_PK` OG cards via [og-card.tsx](../../lib/seo/og-card.tsx).
- **Wholesale Cost Isolation**: Fetch public DB data solely through [public-queries.ts](../../lib/seo/public-queries.ts). Never expose `sharingPriceSar`, `roomPriceSar`, `quadPriceSar`, `defaultRateSar`, `ziyaratRateSar`, `updatedByUserId`, or expired hotel contracts (`validUntil < getTodayPktIso()`).
- **Penalty-Free JSON-LD**: Emit Schema.org only via `<JsonLd />` in [json-ld.ts](../../lib/seo/json-ld.ts). `stripUndefinedDeep()` strips `aggregateRating` and `review` (`OD-10`); `buildHajjServiceJsonLd()` omits `Offer.price` and `InStock` (`OD-09e`); `buildUmrahPackageJsonLd()` filters `price > 0` (`OD-09b`); license `PropertyValue`s require verified non-null DB fields. Mount `<PublicPageHero />` *after* `<JsonLd />` tags so inline `BreadcrumbList` stays last.
- **Static/ISR Preservation**: Keep [utm-tracker.tsx](../../components/seo/utm-tracker.tsx) (`<UtmTracker />`) and `<PlannerUrlHydrator />` ([planner-context.tsx](../../components/planner/planner-context.tsx)) wrapped in `<Suspense fallback={null}>` so `useSearchParams()` never triggers dynamic rendering bailout.

## Gotchas

- **Voucher Access Gate (`OD-03`/`OD-04`)**: `/voucher/[token]` runs `resolvePublicVoucherByToken()` ([voucher-loader.ts](../../components/public/voucher-loader.ts)) with constant-time hash comparison — returns `404` `notFound()` on invalid token and HTTP `403` `forbidden()` until `approved` plus verified deposit or full payment.
- **Route Parameter Locks**: `/umrah-packages/from-[city]` and `/hotels/[city]` enforce `dynamicParams = false`; Next.js 16 `params` and `searchParams` must be awaited as `Promise`s.
- **Preview Crawl Block & Revalidation**: [robots.ts](../robots.ts) blocks everything when `VERCEL_ENV !== "production"`, plus `/admin/`, `/api/`, `/voucher/`, `/quote/`, `CCBot`, and `Bytespider`. Catalog/CMS mutations must call `revalidatePublicSeoPaths()` ([revalidate-public.ts](../../lib/seo/revalidate-public.ts)).

## Agent skills

- [impeccable](../../.agents/skills/impeccable/): Luxury Haramain `Persuade`/`Read` layout polish, typography, and WCAG AA rules
- [hallmark](../../.agents/skills/hallmark/): Sacred Arabic presentation and domain-specific editorial craft

## Related specs

- [Spec 0025 — Public Site SEO Readiness](../../docs/specs/0025-public-site-seo-readiness.md)
- [Spec 0005 — Custom Journey Builder Modules](../../docs/specs/0005-custom-journey-builder-modules.md)
- [Spec 0007 — Group Packages & Hajj Inquiries](../../docs/specs/0007-group-packages-and-hajj-inquiries.md)
- [Spec 0026 — Home Page Editorial Redesign and Public Motion Architecture](../../docs/specs/0026-home-page-redesign-and-motion-architecture/index.md)
- [Spec 0027 — Secondary Public Hubs, Spokes and Shell Editorial Alignment](../../docs/specs/0027-public-storefront-editorial-alignment/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
