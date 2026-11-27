# UI & Domain Components (`components`)

## Overview

Shared design system primitives (`ui/` on `shadcn` `base-nova`), shells and status indicators (`layout/`), locked light theme (`theme-provider.tsx`), luxury public blocks (`public/`, `seo/`), Custom Journey Builder (`planner/`), and Admin Hub modules (`admin/`).

## Key files

| File | Owns |
|---|---|
| [ui/button.tsx](./ui/button.tsx) & [ui/field.tsx](./ui/field.tsx) | `@base-ui/react` primitives (`render` prop, `<FieldGroup>`/`<Field>`) |
| [theme-provider.tsx](./theme-provider.tsx) | Single-theme light lock (`forcedTheme="light"`, `enableSystem={false}`) |
| [motion/public-motion-provider.tsx](./motion/public-motion-provider.tsx) & [motion/haramain-reveal.tsx](./motion/haramain-reveal.tsx) | `<PublicMotionProvider>` (`Lenis` + `gsap.ticker` + `MotionConfig`), `shouldPreventLenisScroll`, `<HaramainSectionReveal>`, `<MotionPillIndicator>` |
| [globals.css](../app/globals.css) | Tailwind v4 `@theme inline` tokens & `.never-dark` guard |
| [public/arabic-text.tsx](./public/arabic-text.tsx), [public/public-page-hero.tsx](./public/public-page-hero.tsx) & [public/hero-slider.tsx](./public/hero-slider.tsx) | `<ArabicText>` (`lang="ar"`, `dir="rtl"`), `PublicPageHero`, & hybrid poster/video `HeroSlider` |
| [public/umrah-package-card.tsx](./public/umrah-package-card.tsx) & [public/umrah-packages-explorer.tsx](./public/umrah-packages-explorer.tsx) | Shared editorial `UmrahPackageCard` (`coverImageUrl ?? hotel.imageUrl`, zero flyers) & filterable `UmrahPackagesExplorer` |
| [layout/status-badge.tsx](./layout/status-badge.tsx) | `StatusBadge`, `AdminSlaProvider`, `<TabularPrice />` |
| [planner/planner-context.tsx](./planner/planner-context.tsx) | Builder state, `sessionStorage` draft, `<Suspense><PlannerUrlHydrator /></Suspense>` |
| [planner/custom-journey-builder.tsx](./planner/custom-journey-builder.tsx) | Multi-step Umrah Journey Builder wizard & submission flow |
| [planner/dates-and-travellers-bar.tsx](./planner/dates-and-travellers-bar.tsx) | Mandatory KSA dates + Adults/Children/Infants (`infants <= adults`) bar |
| [planner/live-summary-card.tsx](./planner/live-summary-card.tsx) | `OD-09b` transparent PKR summary vs `"Live Rate"` indicator |

## Conventions

- **Base UI (`@base-ui/react`), NEVER Radix `asChild`**: Compose triggers with `render={<Button ... />}`. When `Button` ([ui/button.tsx](./ui/button.tsx)) wraps `<Link>` or `<a>`, `nativeButton={nativeButton ?? (props.render ? false : true)}` keeps semantics valid.
- **Forms, Spacing & Icons**: Build forms with `<FieldGroup>` + `<Field>`/`<FieldLabel>`/`<FieldDescription>`/`<FieldError>`. Use `flex`/`grid` + `gap-*` (not `space-x-*`/`space-y-*`), `size-N` for square boxes, full `Card*` slots, and `data-icon="inline-start" | "inline-end"` inside buttons.
- **Single Luxury Light Palette (`DESIGN.md`)**: Never add dark mode toggles or `dark:` utility overrides (`globals.css` enforces `@custom-variant dark (&:where(.never-dark *));`). Use Deep Haramain Emerald (`#0A3622`), Warm Ivory (`#FAF7F0`), Gold decorative (`#C5A059`), AA-accessible `--gold-text` (`#7A5C1E`) for readable gold typography, semantic `--status-{success,warning,danger,info}{,-bg,-border}` operational status utilities, and `focus-visible:outline-gold` on dark emerald (`bg-sidebar`/`bg-primary`) surfaces.
- **Admin Dialogs & Functional Motion (`Spec 0028`)**: Keep `<Dialog open={open} onOpenChange={...}>` unkeyed so Base UI exit animations and focus return work cleanly, resetting entity form state via a keyed inner `*FormBody` child; never mount `HaramainSectionReveal` or Lenis inside `components/admin/*`.
- **Sacred Script & Tabular Numbers**: Render all Arabic/Quranic/Ziyarat script inside `<ArabicText>` ([public/arabic-text.tsx](./public/arabic-text.tsx)). Apply `tabular-nums` / `font-mono` (via `<TabularPrice />` or [public/public-utils.ts](./public/public-utils.ts)) to PKR/SAR amounts, distances, and booking references.
- **Public Motion & Anti Slop Guards ([motion/index.ts](./motion/index.ts))**: Import Motion primitives from `motion/react` (never `framer-motion`), register GSAP via `ensureGsapPlugins()` ([motion/gsap-registry.ts](./motion/gsap-registry.ts)), gate GSAP spatial tweens on `(prefers-reduced-motion: no-preference)`, keep SSR HTML free of `opacity: 0`, and avoid `transition-all`.

## Gotchas

- **Journey Builder `OD-09b` Pricing Rule**: Only `visa_only` mode displays an immediate calculated PKR total in [live-summary-card.tsx](./planner/live-summary-card.tsx); volatile pillars (`Flights`, `Hotels`, `Transport`, `Ziyarat`) display `"Live Rate — Confirmed upon submission"`, and `0`-priced Mode B tiers display `"On Request"`.
- **Journey Builder `OD-09c` Visa & Makkah Locks**: Visa duration tier (`short_term` <=30d vs `long_term` 31–90d, plus Masar SAR bracket) computes automatically from KSA Arrival & Departure dates ([visa-calc.ts](../lib/domain/visa-calc.ts)) — never add a manual tier selector. Makkah has no airport: Makkah-first `citySequence` locks `entryAirport` to `JED` and chains `checkOut[i] === checkIn[i+1]` ([date-chaining.ts](../lib/domain/date-chaining.ts)).
- **Beds & Vehicle Seats Rule**: Hotel bed counts ([room-splitter.ts](../lib/domain/room-splitter.ts)) and vehicle capacities ([vehicle-capacity.ts](../lib/domain/vehicle-capacity.ts)) count `Adults + Children` only; `Infants (<2 yrs)` take `0` beds and `0` seats. Keep `sessionStorage` drafts (`PLANNER_DRAFT_STORAGE_KEY`) strictly free of PII.

## Agent skills

- [shadcn](../.agents/skills/shadcn/): `base-nova` component rules, `Field` anatomy, and slot conventions
- [migrate-radix-to-base](../.agents/skills/migrate-radix-to-base/): Converting legacy Radix `asChild` patterns to Base UI `render`
- [impeccable](../.agents/skills/impeccable/): WCAG 2.2 AA contrast, visual hierarchy, and anti-slop guardrails
- [hallmark](../.agents/skills/hallmark/): Haramain visual craft and editorial component detail
- [motion](../.agents/skills/motion/), [gsap-react](../.agents/skills/gsap-react/), [gsap-scrolltrigger](../.agents/skills/gsap-scrolltrigger/), [gsap-timeline](../.agents/skills/gsap-timeline/), [gsap-core](../.agents/skills/gsap-core/), [gsap-performance](../.agents/skills/gsap-performance/), [lenis-smooth-scroll](../.agents/skills/lenis-smooth-scroll/): Public motion, GSAP timelines, and smooth scroll rules · MCP servers: `motion` (connected)

## Related specs

- [Spec 0003 — Design System & UI Foundation](../docs/specs/0003-design-system-and-ui-foundation.md)
- [Spec 0005 — Custom Journey Builder Modules](../docs/specs/0005-custom-journey-builder-modules.md)
- [Spec 0026 — Home Page Editorial Redesign and Public Motion Architecture](../docs/specs/0026-home-page-redesign-and-motion-architecture/index.md)
- [Spec 0027 — Secondary Public Hubs, Spokes and Shell Editorial Alignment](../docs/specs/0027-public-storefront-editorial-alignment/index.md)
- [Spec 0028 — Admin 4 Hub Operate Surface and Shell Alignment](../docs/specs/0028-admin-operate-surface-alignment/index.md)
- [Spec 0030 · Hybrid Hero Video and Admin Media Uploader](../docs/specs/0030-hybrid-hero-video-and-uploader/index.md)
- [Spec 0031 · End-to-End Umrah Package Lifecycle & Storefront Redesign](../docs/specs/0031-umrah-package-lifecycle-and-storefront-redesign/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
