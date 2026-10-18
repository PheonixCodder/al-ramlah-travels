# Spec 0001: Stack and architecture

**Date**: 2026-10-17
**Status**: Proposed

## Summary

Al Ramlah Travels requires a high performance web platform for custom Umrah journey planning and back office quoting management. This specification locks the foundational technology stack on Next.js 16 with React 19, Neon Serverless PostgreSQL, Drizzle ORM, and Better Auth. The chosen architecture guarantees instant server rendered pages for pilgrims and strict role based access control for travel agency administrators. Implementation proceeds through vertical tracer bullet milestones to ensure database connectivity and type safety from day one.

## Context

Al Ramlah Travels is an elite Hajj and Umrah travel agency based in Islamabad, Pakistan. The agency currently relies on manual spreadsheets, offline records, and ad hoc WhatsApp messages to price custom travel inquiries and communicate itineraries to prospective pilgrims. To scale operations and eliminate quoting bottlenecks, the company is building a unified web platform that serves two distinct user profiles:

1. Prospective pilgrims configuring personalized Umrah itineraries across volatile travel services (visas, international flights, Makkah and Madinah hotels, ground transport sectors, and ziyarat excursions), or booking pre-built group packages.
2. Agency administrators and ticketing staff operating a back office customer relationship manager (CRM) and enterprise resource planning (ERP) portal to review requests, price live supplier rates, issue official quotes, and maintain inventory.

Several critical technical forces shape the foundational architectural choices:

- **Performance and search engine indexing**: The public customer platform requires instant page loads, optimized core web vitals, and search engine visibility across Pakistan and international diaspora markets. Heavy single page client bundles create unacceptable latency over mobile cellular connections.
- **Complex relational data model**: Umrah packages exhibit deep relational interdependencies. An itinerary links multiple hotel stays with specific room configurations and meal plans, ground transit sectors with vehicle capacity constraints, dynamic visa tiers calculated from calendar durations, and flight routing rules (such as Jeddah airport arrival mandates for Makkah first itineraries). Relational integrity and transactions are mandatory.
- **Serverless database connection management**: In modern serverless hosting environments, sudden traffic surges create hundreds of concurrent compute instances. Direct persistent PostgreSQL connections rapidly exhaust database pool limits. The data tier must leverage managed connection pooling for application queries while retaining direct connections for schema migrations.
- **Administrative security and role isolation**: Financial margins, negotiated hotel wholesale contracts, and customer passport details must be shielded by strict authentication boundaries. The system requires two distinct administrative tiers: `super_admin` (full system access including staff user management and agency settings) and `staff` (operational quoting and catalog management).
- **Single luxury visual identity**: The platform represents an upscale pilgrimage brand inspired by the Haramain and the agency crest (`public/logo.jpg`). Dark mode toggling is explicitly forbidden; the design system enforces a single palette of Deep Haramain Emerald, Warm Ivory, and Metallic Haramain Gold.

Failing to lock these foundational choices leads to fragmented codebases, inconsistent database drivers, authentication session leaks across server actions, and costly rewrites during feature development.

## Requirements

**User stories**:

- As an intending pilgrim, I want a fast, responsive journey planner so that I can configure my pilgrimage dates and services without delay or broken layouts.
- As a travel agency administrator, I want a secure back office dashboard with role based access control so that I can manage applications, quote dynamic rates, and update travel inventory safely.
- As an agency super admin, I want strict permission boundaries so that only authorized personnel can access sensitive financial margins, staff credentials, and agency settings.
- As a software engineer, I want an end to end type safe architecture from the database schema to the user interface so that runtime bugs are caught at compile time.

**Acceptance criteria**:

- **AC-1**: Next.js 16 App Router foundation boots cleanly with TypeScript 5, React 19, and Tailwind CSS v4, supporting both customer facing public route groups (`app/(public)/`) and protected administrative dashboard route groups (`app/admin/(dashboard)/`).
- **AC-2**: Dual connection Neon Serverless PostgreSQL configuration is wired through Drizzle ORM, routing runtime application queries through the pooled connection string (`DATABASE_URL_POOLED`) and migration or push commands through the direct connection string (`DATABASE_URL`).
- **AC-3**: Better Auth is initialized with the Drizzle PostgreSQL adapter, credential email and password authentication, Next.js cookie integration (`nextCookies`), and two explicit administrative roles (`super_admin` and `staff`).
- **AC-4**: Administrative routes under `/admin/*` enforce defense in depth route protection through Server Component layout verification, Next.js 16 `proxy.ts` cookie checks, and strict server action session assertions (`requireAdmin` and `requireSuperAdmin`).
- **AC-5**: Shared Zod validation schemas strictly validate all client form inputs, server action payloads, and environment variables (`lib/env.ts`), aborting startup on missing or invalid configuration.
- **AC-6**: Production build and static verification commands (`npm run typecheck`, `npm run lint`, and `npm run build`) execute with zero errors, verifying full compatibility with Next.js 16 asynchronous `params` and `searchParams` conventions.

## Options considered

### Option 1: Full-Stack Next.js 16 + Neon Serverless PostgreSQL + Drizzle ORM + Better Auth + Base UI (Recommended)

This architecture uses Next.js 16 App Router with React 19 Server Components and Server Actions as the unified application engine. Data persistence relies on Neon Serverless PostgreSQL managed via Drizzle ORM, combining HTTP and WebSocket connection pooling for zero cold start latency. Authentication uses Better Auth backed by Drizzle PostgreSQL tables, supporting native role based access control without external identity providers. User interface primitives leverage `@base-ui/react` styled with Tailwind CSS v4 via shadcn (`base-nova` preset), enforcing a single luxury theme.

**Pros**:

- Unified TypeScript codebase eliminates API glue code and provides end to end type safety from database columns to form inputs.
- Drizzle ORM generates zero runtime query overhead and outputs clean SQL queries without hidden engine binaries.
- Neon Serverless PostgreSQL provides automated scaling, instant database branch previews, and built in connection pooling via PgBouncer.
- Better Auth runs directly inside the application database, providing complete ownership over user tables, sessions, and role fields without external subscription costs.
- `@base-ui/react` primitives use render prop composition, avoiding Radix UI compatibility friction in React 19.

**Cons**:

- Requires disciplined modularization to prevent monolithic Server Action sprawl.
- Neon WebSocket drivers require careful configuration in local testing environments.

### Option 2: Next.js 16 + Supabase (PostgreSQL + Supabase Auth + Supabase Client SDK)

This approach replaces self managed auth and ORM configuration with Supabase BaaS (Backend as a Service). Next.js acts as the frontend, delegating authentication, database hosting, and row level security policies to Supabase cloud infrastructure.

**Pros**:

- Preconfigured authentication dashboard and user management portal out of the box.
- Built in database studio for rapid administrative data inspection.

**Cons**:

- Tight vendor lock-in to Supabase proprietary client libraries, auth cookies, and gateway infrastructure.
- Row level security (RLS) policies written in SQL separate authorization logic from TypeScript application code, increasing debugging friction.
- Next.js Server Actions frequently suffer cookie synchronization mismatches with Supabase SSR helpers across framework releases.

### Option 3: Next.js 16 + Prisma ORM + NextAuth / Auth.js v5

This architecture pairs Next.js 16 with Prisma ORM and NextAuth (Auth.js v5) connected to traditional containerized PostgreSQL.

**Pros**:

- Prisma schema syntax is familiar across the Node.js ecosystem.
- Large community tutorial base for basic authentication flows.

**Cons**:

- Prisma Rust query engine binary adds substantial cold start latency and memory overhead in serverless runtimes.
- Auth.js v5 has undergone frequent breaking API redesigns and lacks native role based access control plugins, requiring custom database schema monkey patching.
- Lacks native connection pooling optimizations for serverless PostgreSQL without external proxy infrastructure.

## Decision

**Chosen option**: Option 1: Full-Stack Next.js 16 + Neon Serverless PostgreSQL + Drizzle ORM + Better Auth + Base UI.

Al Ramlah Travels will build on Next.js 16 App Router with Neon Serverless PostgreSQL, Drizzle ORM, Better Auth, and Base UI primitives.

**Implementation skills**: `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`) · `create-auth` (`better-auth/skills`, `.agents/skills/create-auth/`) · `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`) · `migrate-radix-to-base` (`shadcn/base-ui`, `.agents/skills/migrate-radix-to-base/`)

## Rationale

Option 1 provides the optimal foundation for Al Ramlah Travels by combining peak execution speed, operational simplicity, and full data sovereignty. The business model requires tailored quoting logic, relational integrity across travel inventory, and ironclad role isolation.

Drizzle ORM was chosen over Prisma because Drizzle operates as a thin TypeScript SQL query builder without a heavy Rust engine binary. In serverless environments, Drizzle cold starts take single digit milliseconds. By pairing Drizzle with `@neondatabase/serverless`, the application connects over HTTP or WebSockets to Neon pooled endpoints (`DATABASE_URL_POOLED`), preventing connection exhaustion during marketing spikes while reserving direct endpoints (`DATABASE_URL`) for schema migrations.

Better Auth was selected over Auth.js and Supabase because it stores all auth entities directly in application PostgreSQL tables using Drizzle ORM. Better Auth includes first class Next.js cookie integration (`nextCookies`), secure credential handling, and extensible role based access control (`super_admin` and `staff`) without relying on third party cloud auth silos.

Base UI (`@base-ui/react`) with shadcn (`base-nova` preset) ensures full compatibility with React 19.2.8. Unlike Radix UI, Base UI primitives utilize modern render prop composition rather than cloning elements via `asChild`, eliminating silent runtime prop drilling failures.

## Proposed stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Language / Runtime | TypeScript 5, Node.js 20+ | Strict type safety and predictable execution across server and client boundaries. |
| Web Framework | Next.js 16.3.4 (App Router) | React 19 Server Components for instant initial rendering and Server Actions for secure mutations. |
| Primary Database | Neon Serverless PostgreSQL | Managed relational storage with instant branching, automated scaling, and PgBouncer connection pooling. |
| Database ORM | Drizzle ORM (`drizzle-orm`, `drizzle-kit`) | Ultra lightweight TypeScript SQL query builder with zero binary overhead and native Neon support. |
| Authentication & RBAC | Better Auth (`better-auth`) | Drizzle PostgreSQL adapter, credential email and password auth, `nextCookies` plugin, and built in role management. |
| Validation & Contracts | Zod (`zod`) | Runtime schema validation shared across environment variables, form fields, and Server Actions. |
| UI Primitives & Components | Base UI (`@base-ui/react`), shadcn | Accessible unstyled primitives using render props (`base-nova` preset), avoiding Radix `asChild` quirks in React 19. |
| Styling & Theme | Tailwind CSS v4 | High performance utility classes with modern CSS variables, locked to a single Haramain luxury theme. |
| Charts & Visualizations | Recharts 3.8.0 | Composable SVG data visualizations for executive revenue, conversion rate, and pipeline analytics. |
| Icons | Lucide React (`lucide-react`) | Consistent, lightweight SVG iconography across public and administrative interfaces. |
| Date & Calendar Handling | `date-fns` 4.4, `react-day-picker` 10 | Strict Gregorian and Hijri calendar range calculations for multi-city travel itinerary chaining. |
| Hosting & Deployment | Vercel / Node.js Serverless | Native Next.js 16 platform support with automated preview environments and edge proxy execution. |

## System architecture & directory structure

### Route organization and boundaries

The application utilizes Next.js 16 App Router route groups to enforce clean physical boundaries between public visitor experiences and authenticated administrative workflows:

```
app/
├── (public)/                               # Public pilgrim platform (unauthenticated)
│   ├── layout.tsx                          # Public luxury shell: Brand header, currency indicator, navigation, footer
│   ├── page.tsx                            # Landing page: Hero slider, Quick Inquiry bar, Trust Bento grid, Testimonials
│   ├── custom-journey/                     # Dynamic 5-pillar Umrah builder (Visa, Flights, Hotels, Transport, Ziyarat)
│   ├── packages/                           # Pre-built group packages showcase and batch booking modal
│   │   └── [slug]/                         # Package detail with fixed itinerary breakdown and room pricing
│   ├── hajj-inquiry/                       # Dedicated VIP Hajj consultation request form
│   ├── track/                              # Public request status tracker (Reference code + Phone verification)
│   └── contact/                            # Consultant callback request and general inquiry form
├── admin/
│   ├── (auth)/                             # Administrative authentication boundary
│   │   └── login/
│   │       ├── page.tsx                    # Clean luxury admin credentials sign in form
│   │       └── layout.tsx                  # Minimal centered authentication shell
│   └── (dashboard)/                        # Protected CRM and ERP back-office
│       ├── layout.tsx                      # Cryptographic session guard, admin sidebar, topbar, staff profile
│       ├── page.tsx                        # Executive Analytics: KPIs, revenue pipeline, SLA alerts, Recharts
│       ├── applications/                   # Central customer inquiry CRM
│       │   ├── page.tsx                    # Filterable data table: Pending Quote, Quoted, Approved, Rejected
│       │   └── [id]/                       # Live Quoting Worksheet: Dynamic pricing, WhatsApp/Voucher generator
│       ├── groups/                         # Pre-built group packages and departure batch seat allocation
│       ├── hotels/                         # Hotel catalog: Makkah and Madinah properties, distance, room types
│       ├── transport/                      # Ground transportation sectors and vehicle fleet capacity
│       ├── ziyarat/                        # Sacred site excursion points of interest and guide tariffs
│       ├── flights/                        # Supported airlines, flight classes, and departure city gateways
│       ├── visa/                           # Visa pricing rules (short term <= 30 days vs long term > 30 days)
│       ├── content/                        # Website CMS: Hero slides, trust statistics, FAQs, testimonials
│       ├── messages/                       # General contact inbox and callback consultation requests
│       ├── users/                          # Staff account management and role assignment (`super_admin` only)
│       └── settings/                       # Agency profile, WhatsApp dispatch numbers, bank accounts, default margins
├── api/
│   └── auth/
│       └── [...all]/
│           └── route.ts                    # Better Auth REST handler (`toNextJsHandler(auth)`)
├── favicon.ico
├── globals.css                             # Tailwind CSS v4 directives and Haramain luxury palette tokens
└── layout.tsx                              # Root document shell: Fonts, viewport metadata, shared toast provider
```

### Core codebase architecture

Non-route code follows a domain driven modular structure:

```
c:/dev/al-ramlah-travels/
├── components/
│   ├── ui/                                 # shadcn base-nova UI primitives (button, dialog, input, card, table)
│   ├── public/                             # Public domain components (builder modules, summary card, package cards)
│   └── admin/                              # Admin domain components (worksheet, metric cards, inventory forms)
├── db/
│   ├── index.ts                            # Neon Serverless PostgreSQL connection and Drizzle client export
│   └── schema/
│       ├── index.ts                        # Master schema rollup exported for Drizzle Kit and Better Auth
│       ├── auth.ts                         # Better Auth tables: users, sessions, accounts, verifications
│       ├── applications.ts                 # Customer journey inquiries, line items, and quoted totals
│       ├── inventory.ts                    # Hotels, room types, vehicles, transit sectors, ziyarat sites
│       ├── packages.ts                     # Pre-built packages, departure batches, and seat allocations
│       ├── cms.ts                          # Landing page slides, testimonials, and FAQ items
│       └── settings.ts                     # Agency settings, markup rules, and bank details
├── lib/
│   ├── auth.ts                             # Server Better Auth configuration (Drizzle adapter, nextCookies, admin plugin)
│   ├── auth-client.ts                      # Client Better Auth React instance (`createAuthClient`)
│   ├── env.ts                              # Type safe environment variable parser and validator via Zod
│   ├── utils.ts                            # Class merge utilities (`cn`), currency formatters (PKR, SAR, USD)
│   └── validations/
│       ├── auth.ts                         # Admin login and password schemas
│       ├── journey.ts                      # Customer journey configuration schemas and date calculation rules
│       ├── quote.ts                        # Admin quoting worksheet input and status update schemas
│       └── inventory.ts                    # Hotel, vehicle, and sector mutation schemas
├── proxy.ts                                # Next.js 16 edge proxy for optimistic cookie checks and route redirection
├── drizzle.config.ts                       # Drizzle Kit migration and introspection configuration
└── package.json                            # Project dependencies and script declarations
```

### Data flow and security architecture

Security is enforced through a three-layer defense in depth model:

```
[ Incoming Request ]
         │
         ▼
[ Layer 1: Edge Proxy (`proxy.ts`) ]
         │ Reads Better Auth session cookie optimistically.
         │ Unauthenticated requests to `/admin/*` (except `/admin/login`) redirect immediately to `/admin/login`.
         │ Authenticated users visiting `/admin/login` redirect to `/admin`.
         ▼
[ Layer 2: Server Component Layout Guard (`app/admin/(dashboard)/layout.tsx`) ]
         │ Executes cryptographically verified session retrieval:
         │ `const session = await auth.api.getSession({ headers: await headers() })`
         │ If session is null or expired, redirects to `/admin/login?error=unauthorized`.
         │ Supplies authenticated user context and role (`super_admin` or `staff`) to dashboard shell.
         ▼
[ Layer 3: Server Action Authorization Guards ]
         │ Every administrative Server Action invokes strict session assertion helpers:
         │ `const session = await requireAdmin()` (permits `super_admin` and `staff`)
         │ `const session = await requireSuperAdmin()` (restricts to `super_admin` only)
         │ Validates payload through Zod schema before executing Drizzle ORM mutations.
```

### Next.js 16 asynchronous request conventions

Under Next.js 16, dynamic route parameters and search query strings are delivered as Promises. All dynamic layouts, pages, and route handlers must explicitly await these values before consumption:

```tsx
// Example: app/admin/(dashboard)/applications/[id]/page.tsx
interface ApplicationPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ApplicationDetailPage({ params, searchParams }: ApplicationPageProps) {
  const { id } = await params;
  const query = await searchParams;
  // Fetch application details by id...
}
```

### Environment variables specification (`lib/env.ts`)

Environment variables are validated at startup using Zod. Missing or malformed keys halt execution immediately with an explicit error message:

| Variable Name | Type | Purpose | Validation Rule |
| --- | --- | --- | --- |
| `DATABASE_URL` | String | Direct unpooled PostgreSQL connection string for Drizzle Kit migrations and pushes | Must begin with `postgres://` or `postgresql://` |
| `DATABASE_URL_POOLED` | String | Connection pooled Neon endpoint (PgBouncer) for runtime queries | Must begin with `postgres://` or `postgresql://` |
| `BETTER_AUTH_SECRET` | String | Cryptographic secret for signing session tokens and cookies | String, minimum 32 characters |
| `BETTER_AUTH_URL` | String | Canonical URL of the application for Better Auth callbacks | Valid HTTP/HTTPS URL |
| `NEXT_PUBLIC_APP_URL` | String | Public facing URL exposed to client components for share links | Valid HTTP/HTTPS URL |

## Build plan

The foundational stack is built through an ordered Tracer Bullet sequence. Each milestone verifies an operational slice end to end before subsequent layers are added:

1. **Milestone 1: Dependencies and validated environment configuration**, satisfies **AC-1**, **AC-5**
   - Install required runtime packages: `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit`, `better-auth`, `zod`, and development dependencies (`dotenv`, `ws`, `@types/ws`).
   - Create `lib/env.ts` using Zod to parse and export validated environment variables (`DATABASE_URL`, `DATABASE_URL_POOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`).
   - Create `.env.example` documenting all configuration keys.

2. **Milestone 2: Neon PostgreSQL connection and Drizzle ORM configuration**, satisfies **AC-2**
   - Create `db/index.ts` initializing the Neon Serverless driver with Drizzle ORM, configuring connection pooling for runtime queries.
   - Create `drizzle.config.ts` targeting `./db/schema/index.ts` with direct `DATABASE_URL` credentials.
   - Establish initial modular schema directory in `db/schema/` with barrel export `db/schema/index.ts`.
   - Verify database connectivity by running a test query or smoke connection script.

3. **Milestone 3: Better Auth integration and route handlers**, satisfies **AC-3**, **AC-4**
   - Define auth schema in `db/schema/auth.ts` covering `user`, `session`, `account`, and `verification` tables with custom `role` support (`super_admin` and `staff`).
   - Configure Better Auth server instance in `lib/auth.ts` with Drizzle adapter, `nextCookies()`, and admin plugin.
   - Configure Better Auth client in `lib/auth-client.ts`.
   - Implement catch all API route handler at `app/api/auth/[...all]/route.ts` using `toNextJsHandler(auth)`.
   - Create Next.js 16 `proxy.ts` enforcing edge session cookie inspection for `/admin/*` routes.
   - Implement `requireAdmin()` and `requireSuperAdmin()` helper utilities in `lib/auth.ts` for Server Action authorization.

4. **Milestone 4: Route scaffolding, smoke verification, and production build check**, satisfies **AC-1**, **AC-4**, **AC-6**
   - Scaffold route group directories: `app/(public)/`, `app/admin/(auth)/login/`, and `app/admin/(dashboard)/`.
   - Create placeholder admin layout in `app/admin/(dashboard)/layout.tsx` enforcing server side session verification.
   - Verify `GET /api/auth/ok` responds with status code 200.
   - Execute static verification suite: `npm run typecheck`, `npm run lint`, and `npm run build` to confirm clean compilation and zero TypeScript errors.

## Consequences

**Positive**:

- Eliminates architectural ambiguity early, providing solid ground for data modeling (Foundation 3) and design tokens (Foundation 4).
- Dual connection pooling prevents connection starvation in serverless environments while allowing reliable schema migrations.
- Complete data ownership: All user accounts, sessions, customer inquiries, and quotes reside inside a single Neon PostgreSQL database.
- Next.js 16 App Router Server Components maximize performance by delivering zero client bundle overhead for static landing content.

**Negative / tradeoffs**:

- Drizzle migrations require a direct connection string (`DATABASE_URL`) without transaction pooling, necessitating two distinct connection URIs in deployment settings.
- Developers must strictly adhere to Next.js 16 asynchronous `params` and `searchParams` conventions to prevent runtime build breaks.

**Neutral**:

- The codebase relies exclusively on Base UI and Tailwind CSS v4; existing Radix UI habits must be redirected to render prop composition.
- Dark mode support is completely disabled across all layouts and components.

## Follow-up

- [ ] Execute Feature 2 (`Coding standards & tooling`) to capture conventions and reference skills in root `AGENTS.md`.
- [ ] Execute Feature 3 (`Data model`) to specify and push complete relational schemas for visas, hotels, vehicles, packages, inquiries, and quotes.
- [ ] Execute Feature 4 (`Design system & UI foundation`) to define brand color tokens in `design.md` and build shared public and admin shells.

## References

**Project sources**:

- `AGENTS.md`: Stack definition, workflow rules, and luxury theme constraints
- `docs/scope/scope.md`: Feature 1 Foundation scope requirements
- `.agents/skills/better-auth-best-practices/SKILL.md`: Better Auth server, client, and Drizzle adapter setup
- `.agents/skills/create-auth/SKILL.md`: Route handler and Next.js App Router patterns
- `.agents/skills/better-auth-security-best-practices/SKILL.md`: Security hardening and session cookie protection
- `.agents/skills/shadcn/SKILL.md`: shadcn base-nova component conventions
- `.agents/skills/migrate-radix-to-base/SKILL.md`: Base UI render prop patterns

**Practices & standards**:

- Next.js 16 Proxy specification (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`)
- Next.js 16 Asynchronous Page Props contract (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`)
- Defense in Depth application authorization: Edge proxy, layout session guard, and Server Action role assertions
