# RB-01 — Incident Response, Health Triage & Forensic Audit Log Investigation

**Owner**: Operations & Engineering (`super_admin`)  
**Scope**: Al Ramlah Travels Production Stack (`OD-01`..`OD-11`: Vercel Pro + Neon Launch PostgreSQL + Trigger.dev v4 Hobby + Oracle Cloud PAYG Always Free ARM64 Gotenberg + Cloudflare R2 + Resend)  
**Canonical HQ & Escalation (`OD-10`)**:
- **Headquarters**: Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan
- **Primary Incident Line (WhatsApp / Voice)**: `+92 327 4029701` (`03274029701`)
- **Secondary Escalation Line**: `+92 319 0462638` (`03190462638`)
- **Operations & Admin Email**: `admin@alramlahtravels.com` · `alramlahtravels@gmail.com`

---

## 1. Severity Classification Matrix (`SEV-1` .. `SEV-4`)

| Severity | Definition & Business Impact | Acknowledge SLA | Mitigation Target | Escalation Path |
| :--- | :--- | :---: | :---: | :--- |
| **`SEV-1` (Critical)** | Complete storefront or `/admin` outage; Neon PostgreSQL unreachable; unauthorized access, secret leak, or financial ledger (`application_payments` / `application_quotes`) tampering; Meta WABA primary webhook (`+92 327 4029701`) down during active campaign. | **<= 15 min** | **<= 1 hour** | Immediate call to Founder (`+92 327 4029701`) + On-Call Lead (`super_admin`). |
| **`SEV-2` (High)** | Oracle Gotenberg PDF/4K poster rendering failing (`503`); Trigger.dev Cloud workers stalled or dead-lettering; Cloudflare R2 presigned uploads or `/api/media/[...key]` failing; Resend quotation emails bouncing. | **<= 30 min** | **<= 4 hours** | WhatsApp alert to `super_admin` + Engineering Lead (`+92 319 0462638`). |
| **`SEV-3` (Medium)** | Single Core 5 social provider OAuth expired (`EXPIRED` status); SLA overdue monitor flagging backlog (`applications.sla_escalated_at`); isolated Studio AI extraction model fallback. | **<= 4 hours** | **<= 24 hours** | Triage during PKT business hours (`09:00–20:00 PKT`). |
| **`SEV-4` (Low)** | Minor UI layout issue, non-blocking warning in logs, or single non-critical CMS media link broken. | **Next business day** | **Next sprint / PR** | Track in GitHub issue / PR through `.github/workflows/ci.yml`. |

---

## 2. First-5-Minutes Triage: `/api/health` & `/api/health?deep=1`

`app/api/health/route.ts` separates zero-DB shallow liveness from authenticated deep readiness so external uptime monitors never prevent Neon compute from scaling to zero.

### 2.1 Shallow Liveness Check (Unauthenticated — `<20ms`, Zero DB Queries)

```bash
curl -i -sS https://alramlahtravels.com/api/health
```

- **Expected**: `HTTP/2 200` with `{"status":"ok","mode":"liveness","timestamp":"..."}` and `Cache-Control: no-store, no-cache, must-revalidate`.
- **If non-200 or timeout**: Vercel edge/serverless deployment or DNS (`alramlahtravels.com`) is failing -> proceed immediately to **RB-10 §1 (Instant Vercel Rollback)**.

### 2.2 Deep Readiness Probe (Requires `HEALTHCHECK_BEARER_TOKEN` or `super_admin` Session)

```bash
curl -i -sS https://alramlahtravels.com/api/health?deep=1 \
  -H "Authorization: Bearer ${HEALTHCHECK_BEARER_TOKEN}"
```

Inspect the JSON subsystem map returned (`200` = all critical checks healthy; `503` = degraded):
- `checks.database.status !== "ok"` -> Neon PostgreSQL pool/compute issue. Go to **RB-02**.
- `checks.r2Storage.status !== "ok"` -> Missing `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, or `R2_BUCKET_NAME` in Vercel environment.
- `checks.gotenberg.status !== "ok"` -> Oracle ARM64 Gotenberg VM (`https://pdf.alramlahtravels.com/health`) timed out (`>3000ms`) or rejected `X-Gotenberg-Api-Key`. Go to **RB-06**.

---

## 3. Distributed `x-request-id` Correlation Across Vercel, Trigger.dev & Gotenberg

Every HTTP request entering Al Ramlah Travels carries an end-to-end correlation identifier:

1. **Edge / Proxy (`proxy.ts`)**: Reads incoming `x-request-id` or generates `crypto.randomUUID()`, injecting `x-request-id` on both downstream request headers and the HTTP response headers (alongside error boundary digests in `app/error.tsx` and `app/admin/(dashboard)/error.tsx`).
2. **Next.js Server Logs (`instrumentation.ts` + `lib/logger.ts`)**: `onRequestError` and `logger.error()` emit PII-redacted structured JSON containing `requestId`, `digest`, `routePath`, and sanitized error details (automatically masking `+92...` phone numbers, tokens, and stripping SQL bind parameters).
3. **Database Audit Ledger (`audit_logs.request_id`)**: Every security, RBAC, pricing, status, and payment mutation persists `request_id` in PostgreSQL.
4. **Gotenberg Microservice (`lib/posters/gotenberg.ts`)**: Outbound PDF and 4K PNG requests attach `Gotenberg-Trace: <traceId>`, echoed in Caddy/Gotenberg container logs on the Oracle VM.

### Trace Lookup Workflow
1. Obtain the `x-request-id` (from browser DevTools response header, admin error boundary screen, or Vercel Runtime Logs).
2. Filter **Vercel Logs** by the UUID string.
3. Filter **Trigger.dev Cloud Runs** (`proj_wceqpgjdgrgramynogwe`) by run tag (`application:<uuid>`, `flyer:<uuid>`, `scheduled-post:<uuid>`, `whatsapp-broadcast:<uuid>`).
4. On the Oracle Gotenberg VM, search container logs by trace ID:
   ```bash
   ssh ubuntu@<ORACLE_VM_IP> "docker logs gotenberg --since 2h 2>&1 | grep -F '<TRACE_ID>'"
   ```

---

## 4. Forensic SQL Queries on Immutable `audit_logs`

`audit_logs` (`db/schema/audit-logs.ts`) is protected at the PostgreSQL engine level by `trg_audit_logs_immutable` (`prevent_audit_logs_mutation()`), which raises SQLSTATE `55000` on any `UPDATE` or `DELETE`.

Connect read-only using `psql "${DATABASE_URL_POOLED}"` and run the relevant query:

### 4.1 Trace All Mutations from a Specific `x-request-id` or Actor
```sql
SELECT
  created_at AT TIME ZONE 'Asia/Karachi' AS pkt_time,
  actor_id,
  actor_role,
  action,
  entity_type,
  entity_id,
  ip_hash,
  before_json,
  after_json
FROM audit_logs
WHERE request_id = '<REQUEST_UUID>'
   OR actor_id = '<USER_ID>'
ORDER BY created_at DESC
LIMIT 100;
```

### 4.2 Inspect Recent Financial Quote, Status & Payment Ledger Mutations
```sql
SELECT
  al.created_at AT TIME ZONE 'Asia/Karachi' AS pkt_time,
  u.email AS actor_email,
  al.actor_role,
  al.action,
  al.entity_type,
  al.entity_id,
  al.before_json,
  al.after_json
FROM audit_logs al
LEFT JOIN "user" u ON u.id = al.actor_id
WHERE al.entity_type IN ('application', 'application_quote', 'application_payment', 'visa_rate')
  AND al.created_at >= NOW() - INTERVAL '48 hours'
ORDER BY al.created_at DESC;
```

### 4.3 Detect Suspicious Login Bursts, Password Resets, or Role Escalations
```sql
SELECT
  created_at AT TIME ZONE 'Asia/Karachi' AS pkt_time,
  actor_id,
  action,
  entity_id,
  ip_hash,
  after_json
FROM audit_logs
WHERE action LIKE 'auth.%'
   OR action LIKE 'user.%'
   OR action LIKE 'settings.%'
ORDER BY created_at DESC
LIMIT 100;
```

### 4.4 Immediate Compromised Staff Account Containment
If a `staff` or `super_admin` session is suspected of compromise, deactivate the user and purge all active sessions atomically:
```sql
BEGIN;
UPDATE "user"
SET is_active = false,
    must_change_password = true,
    updated_at = NOW()
WHERE email = '<compromised-staff@alramlahtravels.com>';

DELETE FROM "session"
WHERE user_id = (SELECT id FROM "user" WHERE email = '<compromised-staff@alramlahtravels.com>');
COMMIT;
```
`lib/auth-guard.ts` (`requireAdmin` / `requireSuperAdmin`) and `lib/auth.ts` (`databaseHooks.session.create.before`) verify live `user.isActive === true` in PostgreSQL, blocking access immediately across all serverless isolates.

---

## 5. Post-Incident Closeout Checklist

- [ ] Customer-facing impact mitigated and `/api/health?deep=1` returns `200 OK` across all subsystems.
- [ ] Any rotated credentials updated in **both** Vercel Pro and Trigger.dev Cloud (see **RB-03**).
- [ ] `audit_logs` timeline exported and saved to the incident ticket (zero raw pilgrim PII in ticket attachments).
- [ ] Regression test added under `tests/` and verified through `.github/workflows/ci.yml` before closing.
