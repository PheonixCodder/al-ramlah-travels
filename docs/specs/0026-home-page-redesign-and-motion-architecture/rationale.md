# Rationale: 0026 · Home Page Editorial Redesign and Public Motion Architecture

_Decision record split from [index.md](./index.md) during `/develop` Step 4._

## Context

Full-page visual inspection (`screenshots/Home Page.pdf` & `Home Page.png` at `1920 × 25,930 px`) revealed that while the 5-pillar Custom Journey Builder (`#journey-builder`) was carefully crafted and well-proportioned, the surrounding Home Page sections accumulated `~23,800 px` of vertical bloat across Slices 5–44: a 9-card stacked group wall with flyer-image text collisions, a `3+1` orphaned Hajj Maktab grid above 3 giant dark-glass containers, a 12-card Ziyarat grid, and two duplicate Haramain booking-rules tables. Simultaneously, the storefront lacked cohesive scroll inertia, shared-element state transitions, and authored Haramain focal choreography.

## Options Considered

1. **Option 1 — Single-RAF Hybrid (`Lenis` + `GSAP` Ticker/ScrollTrigger + `Motion`/`Framer Motion` State) on `app/(public)` + Balanced Section Right-Sizing (Selected)**:
   - *Pros*: Zero RAF conflict (`gsap.ticker` drives Lenis and `ScrollTrigger` in lockstep); `Motion` handles React `layoutId` pills and `AnimatePresence` effortlessly; automatic `prevent` callback protects `#journey-builder` sticky/popover/dialog behavior with zero edits to `web/components/planner/**`; cuts page height by over half (`10,682 px` at `1920×1080`) without losing any SEO link equity or Playwright contracts.
   - *Cons*: Adds ~55–65 KB gzipped client JS across public routes, mitigated by keeping `MarketingSections` server-rendered around thin client islands and lazy-loading below-the-fold sections.
2. **Option 2 — Pure CSS Animations Only + Keep Existing Full-Expanded Layout**:
   - *Pros*: Zero client JS bundle addition.
   - *Cons*: Leaves the `25,930 px` 24-screen scroll fatigue, `3+1` orphan rows, flyer text collisions, and duplicate tables unresolved; cannot deliver inertial smooth scroll, shared `layoutId` transitions, or scrubbed timeline choreography.
3. **Option 3 — Mount Lenis & GSAP Globally Across Root `app/layout.tsx` (Including `/admin` & `/voucher`)**:
   - *Pros*: Single root provider.
   - *Cons*: Smooth scroll inertia degrades high-density `Operate` workflows in `/admin/desk` (`@dnd-kit` Kanban drag-scroll, virtualized WhatsApp threads, tabular worksheets) and print layouts on `/voucher/[token]`.

## Rationale

Option 1 honors both `PRODUCT.md` surface modes (`Persuade` on `app/(public)` vs high-density `Operate` on `/admin`), guarantees `0` lines touched inside `web/components/planner/**`, eliminates every layout defect identified in `Home Page.pdf`, and integrates all four requested animation libraries under strict single-RAF, SSR-visible, and `prefers-reduced-motion` guardrails.

## Consequences

- **Positive**: Cuts Home Page vertical scroll fatigue by `58.8%` (`25,930 px` → `10,682 px`), fixes supplier flyer banner text collisions and orphan grid rows, adds cohesive Haramain luxury motion, and equips future agents with 7 curated Motion/GSAP/Lenis skills + live `https://mcp.motion.dev` documentation lookup.
- **Negative / Tradeoffs**: Developers authoring new GSAP scroll animations must follow `gsap.matchMedia()` and never set bare CSS `opacity: 0` on SSR content (`sloplint` Gate `62`).
- **Neutral**: All 10 upstream & skill reference repositories live under workspace `services/` outside `web/.git`.

## References & Follow-Up

- [`CONSTITUTION.md`](../../CONSTITUTION.md) · [`INDEX.md`](../../INDEX.md) · [`DESIGN.md`](../../../DESIGN.md) · [`PRODUCT.md`](../../../PRODUCT.md)
- Local reference clones: `services/lenis`, `services/gsap`, `services/gsap-react`, `services/gsap-skills`, `services/motion`, `services/motion-ai-kit`, `services/framer-motion-skills`, `services/darkroom-cc-settings`, `services/awwwards-lenis-smooth-scroll-skill`, `services/awesome-motion-design-agent-skills`
- [ ] Optional post-Slice 46 enhancement: extend subtle `Motion` `layoutId` & `HaramainReveal` patterns to secondary hub pages (`/umrah-packages`, `/hajj-2027`, `/ziyarat`) once `/` is signed off.
