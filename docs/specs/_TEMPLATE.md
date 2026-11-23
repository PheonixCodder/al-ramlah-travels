# NNNN. <Concise Noun-Phrase Title>

**Date**: YYYY-MM-DD
**Status**: Proposed
**Tier**: Alpha
**Scope**: [scope.md](../scope/scope.md) Feature #N
**Constitutional Invariants**: `CONST-DOM-01`, `CONST-SEC-02`, `CONST-UI-04` <!-- Reference all applicable IDs from ../CONSTITUTION.md -->
**Owned Paths (Touch Boundary)**:
- `web/app/...`
- `web/components/...`
- `web/lib/...`
- `web/tests/...`
<!-- Disjoint globs owned by this slice/agent. Shared rollup files (`AGENTS.md`, `package.json`, `docs/scope/scope.md`) are updated sequentially by the Orchestrator. -->
**UI Surface Mode**: None <!-- One of: None | Persuade | Operate | Read (aligns with ../../DESIGN.md + ../../PRODUCT.md) -->

---

## Summary

<!-- HUMAN QUICK READ (plain words, 2 to 4 short sentences, no dashes). Everyone reads this first, technical or not. Explain what the feature changes, why it matters, and what done looks like. -->
<Plain language overview in 2 to 4 short sentences.>

---

## Requirements & Acceptance Criteria (EARS)

**User stories**:
- As a <role (Pilgrim | Staff | Super Admin)>, I want <capability> so that <outcome>.

**Acceptance criteria** (EARS / Given-When-Then contract; every AC maps to `## Build Plan` tasks and `## Verification & Traceability Matrix`):
- **AC-1**: When <trigger / preconditions>, the system shall <observable, deterministic behavior>.
- **AC-2**: While <state or role condition>, if <edge case / failure input>, the system shall <safe rejection, rollback, or redaction behavior>.
- **AC-3**: Given <context>, when <user or cron action>, then <persisted DB state, UI outcome, or response>.

---

## Decision & Implementation Skills

**Chosen option**: Option N — <Selected Architecture / Approach>

<One to two crisp sentences stating the architectural decision and boundaries.>

**Implementation skills**:
- `architect` (`web/.agents/skills/architect/SKILL.md`) · `develop` (`web/.agents/skills/develop/SKILL.md`) · `test` (`web/.agents/skills/test/SKILL.md`)
- Add domain/UI skills as applicable (`shadcn`, `migrate-radix-to-base`, `better-auth-best-practices`, `trigger-authoring-tasks`, `impeccable`, `hallmark`, `nextjs-business-seo-geo-auditor`).

---

## Feature Design & Value Sourcing

### Data Model & Migration Sketch
<Tables, columns, enums, SQL `CHECK` constraints, FKs (`ON DELETE`), indexes, and expand-then-contract migration notes — or "No schema changes required".>

### State Transitions
<Explicit allowed state machine transitions and transactional locks (`SELECT ... FOR UPDATE`), or "N/A".>

### API Surface (Server Actions & Route Handlers)
| Endpoint / Action | Method | Auth Guard | Zod Schema | Key Inputs | Key Outputs | Key Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `exampleAction` | Server Action | `requireAdmin()` / `requireSuperAdmin()` / Public + Rate Limit | `exampleSchema` | `id: uuid` | `{ success, ... }` | `401`, `403`, `422` |

### Value Sourcing
<!-- MANDATORY: Every value each action or UI view produces, computes, or displays MUST name its exact source. Never leave a build to invent numbers, copy, or fallbacks. -->
| Action / Surface | Value Produced / Displayed | Authoritative Source |
| :--- | :--- | :--- |
| `<action / component>` | `<displayed or returned value>` | `<input param · DB table.column · lib/domain/* formula · CONSTITUTION rule>` |

### Security, AuthZ, Zod & SAR-Redaction Check
- **AuthN / AuthZ**: <Confirm `requireAdmin()` vs `requireSuperAdmin()`, live `isActive` guard, or public rate-limit bucket.>
- **Input & XSS/SSRF Hygiene**: <Confirm Zod schema validation, `escapeHtml()` for Gotenberg, `serializeJsonLd()` for JSON-LD, SSRF allow/deny rules.>
- **Wholesale Cost & PII Redaction**: <Confirm `staff` wholesale cost redaction (`CONST-SEC-04`), zero `*Sar` serialization into public RSC/JSON-LD (`CONST-SEO-03`), private R2 signed `/api/media/*` handling (`CONST-SEC-06`), and PII-scrubbed ZDR AI (`CONST-SEC-07`).>

### UI & Design Direction
<!-- Omit or write "N/A (backend-only)" when UI Surface Mode is None. -->
- **Surface Mode**: `Persuade | Operate | Read` (`../../DESIGN.md`, `../../PRODUCT.md`)
- **Theme & Token Discipline**: Single locked light Haramain palette (`app/globals.css`), `--gold-text` (`>= 4.5:1`) for gold text, `@base-ui/react` `render` prop (zero `asChild`), `<ArabicText lang="ar" dir="rtl">` for sacred Arabic, `tabular-nums` for PKR/SAR/dates.
- **Responsive & Slop Gates**: Mobile `375×812` & `320×640` overflow check; `impeccable` / `hallmark` craft floor honored.

### Configuration Required
- `<ENV_VAR>`: purpose (or `None — no new environment variables or secrets required`).

---

## Build Plan

<!-- Atomic tasks strictly scoped to Owned Paths above; every task names the AC(s) it satisfies. -->
- [ ] **Task 1**: <Data layer / domain helper / Zod contract change in `web/...`> — satisfies **AC-1**
- [ ] **Task 2**: <Server Action / Route Handler / Trigger task with AuthZ & tests> — satisfies **AC-2**
- [ ] **Task 3**: <UI surface / RSC & Client components conforming to `DESIGN.md`> — satisfies **AC-3**

---

## Verification & Traceability Matrix

| Criterion | Constitutional Rule | Automated Test / E2E Path (`covers: AC-N`) | Verification Gate |
| :--- | :--- | :--- | :--- |
| **AC-1** | `CONST-...` | `web/tests/.../*.test.ts` | `npm test` (`.env.audit`) |
| **AC-2** | `CONST-...` | `web/tests/integration/.../*.test.ts` | `npm test` + AuthZ check |
| **AC-3** | `CONST-...` | `web/tests/e2e/j*.spec.ts` | `npm run test:e2e` + Axe |

**Critical Test Scenarios**:
- **Happy Path**: <End-to-end flow proving primary user outcome>, covers **AC-1**, **AC-3**.
- **Failure / Concurrency / Idempotency**: <Double-submit, race condition, invalid dates, or external timeout>, covers **AC-2**.
- **AuthZ / Redaction / A11y**: <Denied role / wholesale SAR leakage absent / 0 Axe WCAG 2.2 AA violations>, covers **AC-2**, **AC-3**.

**Release Gates Required**:
- `npx next typegen && npm run typecheck && npx tsc --noEmit -p tests/e2e/tsconfig.json`
- `npm run lint` (`0` errors)
- `npm test` (hermetic `.env.audit` on `127.0.0.1:54329`)
- `npm run build` (plus `npm run test:e2e` for Beta/GA or UI/flow slices; `sloplint` / `impeccable detect` for UI surfaces)
- `npm run cdd:check` (`node scripts/verify-cdd.mjs`)

---

## Context, Options Considered & Consequences

<!-- DECISION RECORD (human / future architect context; /develop skips this section). -->

### Context
<Problem space, operational forces, regulatory or financial constraints, and why deciding now matters.>

### Options Considered
1. **Option 1 — <Name>**: <Short neutral description.>
   - *Pros*: <benefit>
   - *Cons*: <tradeoff>
2. **Option 2 — <Name>**: <Short neutral description.>
   - *Pros*: <benefit>
   - *Cons*: <tradeoff>

### Rationale
<Why the chosen option best satisfies the forces in Context and `../CONSTITUTION.md`.>

### Consequences
- **Positive**: <what improves>
- **Negative / Tradeoffs**: <what gets harder or costs more>
- **Neutral**: <operational or migration side-effects>

### References & Follow-Up
- [`CONSTITUTION.md`](../CONSTITUTION.md) · [`INDEX.md`](../INDEX.md) · [`OWNER_DECISIONS.md`](../audit/OWNER_DECISIONS.md)
- [ ] <Optional post-merge operational follow-up>
