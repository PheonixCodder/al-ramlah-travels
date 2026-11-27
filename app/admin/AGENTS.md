# Admin Control Plane (`app/admin`)

## Overview

Protected 4-Hub staff and super-admin workspace (`/admin`, `/admin/studio`, `/admin/campaigns`, `/admin/desk`, `/admin/catalog`, `/admin/settings`), booking dossiers (`/admin/applications/[id]`), and credential sign-in (`(auth)/login`). Follows `Operate` density rules from [DESIGN.md](../../DESIGN.md) with single-theme forced light styling.

## Key files

| File | Owns |
|---|---|
| [layout.tsx](./layout.tsx) | Root admin layout setting `noindex, nofollow, nocache` |
| [dashboard layout](./%28dashboard%29/layout.tsx) | Enforces `requireAdmin()`, `ThemeProvider`, `AdminSlaProvider`, password gate |
| [staff login](./%28auth%29/login/page.tsx) | Staff email/password sign-in (public signup disabled `403`) |
| [overview hub](./%28dashboard%29/page.tsx) | Executive Overview KPIs, PKT time ranges, SLA alerts |
| [studio hub](./%28dashboard%29/studio/page.tsx) | Package-First Workbench ([package-workbench-client.tsx](../../components/admin/studio/package-workbench-client.tsx), [package-builder-sheet.tsx](../../components/admin/studio/package-builder-sheet.tsx)), Multimodal BYO-Poster & 4K Gotenberg renders |
| [campaigns hub](./%28dashboard%29/campaigns/page.tsx) | Core 5 Social Scheduler, `OD-01` Assisted WA Queue, Broadcasts, Outreach |
| [desk hub](./%28dashboard%29/desk/page.tsx) | Live WhatsApp Cloud Inbox + `@dnd-kit` Kanban + Contact Messages |
| [catalog hub](./%28dashboard%29/catalog/page.tsx) | Visa, Flights, Hotels, Vehicles, Ziyarat, Hajj 2027, CMS tabs |
| [settings hub](./%28dashboard%29/settings/page.tsx) | WABA, Social OAuth, Gotenberg/R2, Staff RBAC, `?tab=health` |
| [application dossier](./%28dashboard%29/applications/%5Bid%5D/page.tsx) | Pilgrim dossier, Quote Worksheet, AI Copilot, Payment Ledger, [Pilgrim Documents Review](../../components/admin/applications/pilgrim-documents-review-panel.tsx) |
| [auth-guard.ts](../../lib/auth-guard.ts) | `requireAdmin()`, `requireSuperAdmin()`, live DB `isActive` revocation |
| [quotes.ts](../actions/quotes.ts) & [command-lookup.ts](../actions/command-lookup.ts) | Quoting workflow + `Cmd+K` lookup with `staff` wholesale redaction |
| [admin-labels.ts](../../lib/constants/admin-labels.ts) | Test-locked Studio Mode A/B labels and `Cmd+K` passenger summary formatter |

## Conventions

- **4-Hub Admin IA (`Spec 0011`)**: Place all new admin workflows under `/admin`, `/admin/studio`, `/admin/campaigns`, `/admin/desk`, `/admin/catalog`, or `/admin/settings`. Keep legacy subdirectories (`content`, `distribution`, `flights`, `groups`, `hotels`, `messages`, `outreach`, `post-lookup`, `social`, `supplier-flyers`, `transport`, `users`, `visa`, `ziyarat`) strictly as server `redirect()` stubs.
- **`Operate` Tokens, Hook Purity & Dialog Resets (`Spec 0028`)**: Style admin badges and alerts with semantic `--status-{success,warning,danger,info}{,-bg,-border}` utilities (`app/globals.css`), pass `initialNowMs` from Server Components (`desk`, `campaigns`, `settings`) to seed PKT clocks without hydration drift, reset entity dialogs via keyed inner `*FormBody` children inside unkeyed `<Dialog>` wrappers, and keep `/admin` free of Lenis and `HaramainSectionReveal`.
- **Auth & Validation Everywhere**: Every Server Component page, Server Action (`app/actions/*.ts`), and admin Route Handler must call `requireAdmin()` or `requireSuperAdmin()` (checks session + live PostgreSQL `user.isActive`) and validate payloads with `zod`.
- **Next.js 16 Async Props & Pagination**: Await `params` and `searchParams` as `Promise`s; paginate high-volume tables (`applications`, `campaigns`, `catalog`) with SQL `count()` queries.
- **SEO Cache Revalidation**: Mutating public catalog, departure, CMS, flyer, or agency settings records in [catalog.ts](../actions/catalog.ts), [cms.ts](../actions/cms.ts), [groups.ts](../actions/groups.ts), or [marketing-ops.ts](../actions/marketing-ops.ts) must invoke `revalidatePublicSeoPaths()` ([revalidate-public.ts](../../lib/seo/revalidate-public.ts)).

## Gotchas

- **`T-061` Staff Wholesale Redaction**: For non-`super_admin` (`staff`) sessions, zero out `netSharingPkr`, `commissionPkr`, `supplierNetCostPkr`, and SAR supplier costs in [command-lookup.ts](../actions/command-lookup.ts), Quote Worksheet DTOs ([quote-worksheet-form.tsx](../../components/admin/applications/quote-worksheet-form.tsx)), and catalog views. Selling below supplier net payable (`allowBelowNetCost`) requires `super_admin` (`actions/quotes.ts`).
- **Safe Client Projections**: Never pass decrypted tokens, encrypted Page tokens, or `pendingCandidates` JSONB blobs to Client Components; project via safe settings DTOs (`projectSafeSocialIntegrationDto`, `projectSafeWhatsappAccountDto`).
- **Super-Admin-Only Boundaries**: Restrict staff user lifecycle (`users`/`settings`), CMS content & `cms/hero-slides/*` media uploads (`/admin/catalog?tab=cms`), bulk CSV exports, and WABA/Social OAuth credential edits strictly to `super_admin`.

## Agent skills

- [impeccable](../../.agents/skills/impeccable/): `Operate` mode density, status tables, and tabular numeric discipline
- [hallmark](../../.agents/skills/hallmark/): Static anti-slop UI floor gate (`sloplint.mjs`) for `Operate` surfaces
- [better-auth-best-practices](../../.agents/skills/better-auth-best-practices/): Active-user session checks & RBAC ([services/better-auth](../../../services/better-auth/))
- [shadcn](../../.agents/skills/shadcn/): Base UI `base-nova` patterns for admin panels

## Related specs

- [Spec 0011 — Four-Hub Admin IA & Kanban Desk](../../docs/specs/0011-four-hub-admin-ia-and-kanban-desk.md)
- [Spec 0006 — Admin Quoting Worksheet & Status Tracker](../../docs/specs/0006-admin-quoting-worksheet-and-status-tracker.md)
- [Spec 0024 — Production Readiness Audit & Hardening](../../docs/specs/0024-production-readiness-audit-and-hardening.md)
- [Spec 0028 — Admin 4 Hub Operate Surface and Shell Alignment](../../docs/specs/0028-admin-operate-surface-alignment/index.md)
- [Spec 0029 — Pilgrim Document Upload Portal and Staff Verification](../../docs/specs/0029-pilgrim-document-upload-portal/index.md)
- [Spec 0030 · Hybrid Hero Video and Admin Media Uploader](../../docs/specs/0030-hybrid-hero-video-and-uploader/index.md)
- [Spec 0031 · End-to-End Umrah Package Lifecycle & Storefront Redesign](../../docs/specs/0031-umrah-package-lifecycle-and-storefront-redesign/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
