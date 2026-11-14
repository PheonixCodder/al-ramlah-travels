# Al Ramlah Travels — Haramain Pilgrim Commerce & Omnichannel CRM Platform

Production-hardened Next.js 16.4+ App Router platform for **Al Ramlah Travels** (`سفريات الرملة`), headquartered at Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan.

## Stack Overview

- **Runtime & Framework**: Node.js 22+ LTS, TypeScript 5, Next.js 16.4+ (App Router), React 19
- **Database & ORM**: PostgreSQL 16 (Neon Serverless Pool in production; `node-postgres` TCP Pool for local Docker & CI), Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Authentication & RBAC**: Better Auth (`better-auth`) with `super_admin` and `staff` roles, database-backed rate limiting, and immutable `audit_logs`
- **Storage, PDF & Durable Jobs**: Cloudflare R2 (`@aws-sdk/client-s3`), Gotenberg v8 HTML/PDF Engine, Trigger.dev Cloud v4 (`@trigger.dev/sdk`), Resend + React Email (`resend`, `@react-email/components`)
- **WhatsApp & Social CRM**: Official Meta WhatsApp Cloud API v21.0 + Core 5 Social Scheduler (`Instagram`, `Facebook Pages`, `TikTok`, `YouTube`, `Google Business Profile`)

## Local Development Setup (Disposable Local PostgreSQL)

1. Copy `.env.example` to `.env.local` (or `.env.audit` for isolated test runs) and populate local values.
2. Start a disposable PostgreSQL 16 container:
   ```bash
   docker run -d --name alramlah-audit-pg \
     -p 127.0.0.1:54329:5432 \
     -e POSTGRES_USER=audit \
     -e POSTGRES_PASSWORD=audit_local_only \
     -e POSTGRES_DB=alramlah_audit \
     postgres:16-alpine
   ```
3. Install dependencies, apply forward SQL migrations, and run the idempotent seed:
   ```bash
   npm ci
   npm run db:migrate
   ADMIN_BOOTSTRAP_PASSWORD="YourStrongBootstrapPassword123!" npm run db:seed
   ```
4. Launch the development server and Trigger.dev worker:
   ```bash
   npm run dev
   npm run trigger:dev
   ```

## Verification Gates

```bash
npm audit --omit=dev --audit-level=high
npm run typecheck
npm run lint
npm test
npm run build
```
