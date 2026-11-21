# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

1. **Pakistani Pilgrims & Multi-Generational Families**
   - Planning Umrah packages, Saudi e-visas, or Hajj 2027 pre-registration from Lahore (`LHE`), Karachi (`KHI`), Islamabad (`ISB`), and regional hubs across Punjab, Sindh, Khyber Pakhtunkhwa, and Azad Kashmir.
   - Often researching and booking on behalf of parents or elderly relatives via mobile devices, comparing Haram walking distances, room-sharing costs, direct vs. one-stop flights, and private ground transport.
2. **Global Pakistani Diaspora Pilgrims**
   - Travelling from the UK, USA, Canada, and UAE (including NICOP and dual-nationality holders) to meet family in Makkah and Madinah.
   - Need reliable asynchronous WhatsApp and email communication, transparent PKR totals, verifiable reference numbers, and printable/digital confirmation vouchers.
3. **Al Ramlah Travels Operations Staff (`staff`) & Agency Leadership (`super_admin`)**
   - Operating from Askari 10, Sector C, Airport Road, Lahore Cantt, Pakistan (`Asia/Karachi`, PKT UTC+5).
   - Ingesting consolidator supplier flyers and posters, calculating live airfare/hotel/transport/Ziyarat quotes, managing WhatsApp Cloud conversations, verifying payment receipts, scheduling social campaigns, and enforcing response SLAs.

## Product Purpose

Al Ramlah Travels (`سفريات الرملة`) is an end-to-end Haramain pilgrimage commerce, bespoke itinerary quoting, and agency operations platform. It connects pilgrim discovery and self-service journey configuration directly to Lahore Cantt's quoting desk, WhatsApp CRM, catalog pricing matrices, payment ledger, and verifiable QR service voucher issuance — replacing fragmented spreadsheets and manual back-and-forth with auditable precision.

Success means:
- Pilgrims configure exact itineraries or select fixed departures in minutes, understand what is fixed versus live-quoted upfront, and receive confirmed quotes within the agency's response SLA (`<= 24` hours; admin overdue alerts calibrated by agency SLA settings).
- Operations staff turn supplier flyers or WhatsApp inquiries into itemized quotes, verified payment records, social campaigns, and signed confirmation vouchers from a unified four-hub workspace without leaking wholesale margins or unverified claims.

## Positioning

1. **Honest Dual-Mode Tariff Model**: Shows immediate fixed PKR totals strictly where rates are deterministic (`Visa Only` and positive-priced fixed-departure group packages). Whenever volatile components (`Flights`, `Hotels`, `Transport`, `Ziyarat`) are included, presents `"Live Rate — Confirmed upon submission"`, and displays `"On Request"` for unpriced (`0`) Mode B tiers rather than fabricating fake instant checkouts.
2. **Haramain-True Domain Guardrails**: Enforces real pilgrimage geography and capacity rules inside domain logic — Makkah-first itineraries lock Entry Airport to Jeddah (`JED`), hotel bed and vehicle seat capacities count `Adults (12+ yrs) + Children (2–11 yrs)` while `Infants (<2 yrs)` require passports, visas, and infant airfare with zero bed or seat consumption, and visa duration tiers (`short_term` <= 30 days vs. `long_term` 31–90 days) derive automatically from KSA travel dates.
3. **Wholesale-to-Pilgrim Command Loop**: Bridges B2B consolidator flyer AI extraction, 4K/social poster rendering, official Meta WhatsApp Cloud API CRM, `@dnd-kit` application quoting, append-only payment verification, and cryptographically signed QR confirmation vouchers on one database truth.

## Operating Context

- **Headquarters & Schedule**: Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan; operating Monday to Saturday, 9:00 AM to 8:00 PM PKT (`Asia/Karachi`, UTC+5), alongside 24/7 digital inquiry intake and WhatsApp concierge triage.
- **Currency & Margin Privacy**: Internal wholesale hotel, transport, and Masar visa inputs operate in Saudi Riyals (`SAR`) converted via `sarToPkrRate` and supplier commission models, while public surfaces present clean retail Pakistani Rupees (`PKR`) and strictly withhold internal wholesale costs, margins, and staff notes.
- **Regulatory & Banking Integrity**: Operates under Pakistani travel/pilgrimage governance (`DTS`, `MoRA / HGO`, `IATA`, `NTN`) and Saudi Umrah/Hajj guidelines (`Masar`, `Nusuk`, Saudi Visa Bio). Regulatory license badges and corporate bank IBAN coordinates are suppressed across public pages, PDFs, and WhatsApp auto-replies until verified by a `super_admin`.

## Capabilities and Constraints

### Core Capabilities
- **Public Hub-and-Spoke Storefront & Attribution**: Indexable Umrah package catalog, city departure spokes (`/umrah-packages/from-lahore`, `from-karachi`, `from-islamabad`), individual package detail routes, Saudi e-visa guide (`/umrah-visa`), indicative Hajj 2027 Maktab guide (`/hajj-2027`), Makkah/Madinah hotel guides (`/hotels/[city]`), Ziyarat landmark guides (`/ziyarat`, `/ziyarat/[city]`), agency trust/legal pages (`/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/refund-policy`), and first-touch UTM/referrer attribution capture.
- **Custom 5-Pillar Umrah Journey Builder**: Multi-step itinerary configurator covering Visa, Flights, Makkah & Madinah Hotels (chronological stay date-chaining, shared vs. private room auto-allocation, per-hotel meal plans), Ground Transport & Haramain High-Speed Rail (per-leg fleet sizing, Badr detour option, station transfers), and Scholar-Guided Ziyarat, supporting deep-linked URL prefill from city and guide spokes.
- **Pilgrim Status Tracker & Signed QR Voucher**: Anti-enumeration lookup (`ART-...` reference plus >=9-digit E.164 phone match) enabling pilgrims to review itemized quotes, accept quotes or request revisions online, and unlock a printable, cryptographically signed QR confirmation voucher (`/voucher/[token]`) once `approved` with verified deposit or full payment.
- **4-Hub Admin Portal**:
  - **Command Overview (`/admin`)**: Pipeline velocity, pending quotes, SLA overdue telemetry, and operational shortcuts.
  - **Package & Poster Studio (`/admin/studio`)**: Multimodal BYO-poster and supplier flyer AI extraction (`studio`, `vault`, `packages`), commission calculations, multi-sheet and single-package poster rendering, and direct group package publishing.
  - **Campaigns & Outreach (`/admin/campaigns`)**: Core 5 social calendar & composer (`social` across Instagram, Facebook Pages, YouTube, plus approval-gated Google Business Profile v1 and TikTok v2), ban-safe manual assisted WhatsApp Group/Status copy-pack queue & Cloud broadcasts (`whatsapp`), and 14-day VIP outreach CRM (`outreach`).
  - **Pilgrim Inbox & Quote Desk (`/admin/desk`)**: Live Meta WhatsApp Cloud API inbox (`inbox` with 3-priority auto-responder, guided 3-step intake, global `"STOP"`/`"RUKO"` opt-out, 24-hour customer-care template gate, AI quoting copilot), `@dnd-kit` Kanban and tabular quote pipeline (`pipeline`), live quoting worksheet & append-only payment ledger (`/admin/applications/[id]`), and contact messages (`web_messages`).
  - **Catalog & Suppliers (`/admin/catalog`)**: Unified CRUD for hotels, visa tariffs, transport fleet/sectors/rates, Ziyarat sites, airlines/departure cities, Hajj 2027 packages, suppliers, website CMS, and messages.
  - **Connections & Settings (`/admin/settings`)**: Social OAuth, Meta WABA credentials, infrastructure & Gotenberg health, agency NAP & corporate IBAN verification gate, `super_admin` staff RBAC, and deep health diagnostics.

### Hard Constraints
- Never expose a manual visa-duration selector (`short_term` vs. `long_term`) to pilgrims; compute duration strictly on the server from KSA Arrival and Departure dates.
- Never allow public self-signup (`403` enforced on public registration); admin access is provisioned solely by `super_admin`.
- Never allow unofficial server-side WhatsApp sockets; external group/status distribution uses ban-safe manual copy-packs while conversational CRM runs on official Meta WhatsApp Cloud API.
- Never serialize wholesale SAR rates, commission margins, internal notes, or unverified IBAN/license strings into public HTML, JSON-LD, or unauthenticated endpoints.
- Never emit fake `AggregateRating` schema when verified review count is zero, nor `InStock` instant-checkout schema on indicative Hajj 2027 pages.

## Surface Modes

- **Public Pilgrim Storefront** (`/`, `/umrah-packages/**`, `/umrah-visa`, `/hajj-2027`, `/hotels/**`, `/ziyarat/**`, `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/refund-policy`): **`Persuade` / `Read`** — editorial clarity, answer-first Haramain guidance, verified local trust signals, and clear paths into fixed departures or custom quoting.
- **Custom 5-Pillar Journey Builder, Status Tracker & QR Voucher** (`/#journey-builder`, `/#track-status`, `/voucher/[token]`): **`Operate` + `Persuade`** — interactive, guard-railed configuration and real-time itinerary verification balanced with pilgrim reassurance and concise trust cues.
- **4-Hub Admin Portal** (`/admin`, `/admin/studio`, `/admin/campaigns`, `/admin/desk`, `/admin/catalog`, `/admin/settings`, `/admin/applications/[id]`): **High-density `Operate`** — crisp tabular worksheets, Kanban boards, split-pane WhatsApp inbox, campaign calendars, and keyboard-first search (`Cmd+K` / `Ctrl+K`) built for consultant throughput.

## Brand Commitments

- **Legal & Brand Name**: `Al Ramlah Travels` (`سفريات الرملة`)
- **Tagline**: `Where Purpose Meets Excellence`
- **Canonical Domain**: `https://alramlahtravels.com`
- **Headquarters Address**: `Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan`
- **Official Hotlines**: `+92 327 4029701` (Primary WhatsApp & Hotline) · `+92 319 0462638` (Secondary Reservations Line)
- **Official Email**: `alramlahtravels@gmail.com`
- **Working Hours**: `Monday to Saturday: 9:00 AM to 8:00 PM PKT`
- **Binding Emblem**: `public/logo.jpg` (Kaaba draped in Kiswah, golden minaret, cradling crescent, and Arabic calligraphy `الرملة`), enforcing a single locked light-mode presentation across every web, PDF, poster, and share-card surface.

## Evidence on Hand

- Canonical Lahore Cantt headquarters NAP, verified hotline numbers, email, working hours, and official social profile URLs (`Facebook`, `Instagram`, `YouTube`, `TikTok`).
- Live database-backed pilgrimage inventory: Haramain hotels with exact proximity meters, transport sectors and fleet capacities, historical Makkah & Madinah Ziyarat landmarks, airlines, departure cities, seasonal group departures, and verified FAQ entries.
- Official brand emblem (`public/logo.jpg`) and editorial Haramain sanctuary photography for public hero and Ziyarat showcases.
- **Explicit Absences (Do Not Fabricate)**: Regulatory license numbers (`DTS`, `MoRA`, `IATA`, `NTN`) and corporate IBAN details prior to `super_admin` database entry/verification; verified pilgrim testimonial/review aggregates when zero verified rows exist; confirmed Hajj 2027 quotas or binding Maktab prices ahead of official government announcements; and live analytics metrics for unapproved social provider scopes (`GBP_API_APPROVED`, `TIKTOK_DIRECT_POST_APPROVED`).

## Product Principles

1. **Honesty Over False Precision**: Display fixed PKR prices only where pricing is truly fixed; clearly state live-confirmation workflows everywhere else.
2. **Sacred Reverence in Craft**: Present Arabic script, religious terminology, and Haramain heritage with dignity, restraint, and zero sensational marketing gimmicks.
3. **Encode Domain Truth in Rules**: Prevent impossible itineraries, seat/bed under-sizing, and premature voucher release at the system boundary.
4. **Unified Operational Continuity**: Connect every pilgrim touchpoint — SEO spoke, custom builder, WhatsApp thread, quote worksheet, payment receipt, and QR voucher — to one auditable record.
5. **Respectful Speed for Families & Staff**: Minimize steps and cognitive friction for multi-generational pilgrims on mobile while giving consultants dense, keyboard-navigable operational tools.

## Accessibility & Inclusion

- **WCAG 2.2 Level AA Compliance**: Enforced continuously across public and admin surfaces via automated `@axe-core/playwright` E2E verification (`0` serious or critical violations), strong text and UI component contrast, visible focus indicators, and full keyboard operability.
- **Sacred Arabic & Urdu RTL Isolation**: Every sacred Arabic phrase (Bismillah, Talbiyah, Ziyarat names, brand calligraphy) renders inside an explicit `lang="ar"` and `dir="rtl"` container with Unicode bidirectional isolation (`unicode-bidi: isolate`) so screen readers announce Arabic accurately and RTL text never disrupts surrounding English layouts; generated PDF documents support Arabic and Urdu scripts cleanly.
- **Inclusive Mobile Ergonomics & Motion Safety**: Public journeys support narrow mobile screens down to `320px` without horizontal scroll, provide generous touch targets (`>= 44px` on touch interactive controls), maintain large readable body copy, and honor `prefers-reduced-motion: reduce` across all sliders, loaders, and live status indicators.
