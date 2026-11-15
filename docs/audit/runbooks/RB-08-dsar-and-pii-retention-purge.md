# RB-08 — Pilgrim DSAR (Access & Erasure), Retention TTLs & Privacy Governance

**Owner**: Data Protection & Compliance Officer (`super_admin`)  
**Policy Reference**: Owner Decision **`OD-06` (Option A)** · Public Privacy Notice `https://alramlahtravels.com/privacy` (`T-020`)  
**Automated Engine**: `runPiiAndMediaRetentionPurge` (`trigger/schedules.task.ts`, nightly `30 3 * * *` PKT) + `deleteR2Objects` (`lib/storage/r2.ts`)

---

## 1. Statutory Retention Matrix (`OD-06` & Pakistan Income Tax Ordinance 2001 §174)

| Data Category | Storage Location | Retention Window | Automated / DSAR Disposition |
| :--- | :--- | :--- | :--- |
| **Passport & CNIC Scans** | Private R2 `passports/` + `applications.hajj_inquiry_json` / `whatsapp_messages.media_url` | **60-day post-return** (`60 days` post `ksa_departure_date`) | Hard-deleted from Cloudflare R2 via `deleteR2Objects()` and URLs nulled in PostgreSQL. |
| **Unbooked Pilgrim Inquiries & Chat Media** | `applications` (`status != 'approved'`, `0` payments) + Private R2 `whatsapp-media/` | **24-month** (`24 months` / `730 days`) | `whatsapp-media/` objects deleted from R2; `applications` anonymized (`customer_name = '[REDACTED EXPIRED LEAD]'`, `customer_phone = 'REDACTED'`). |
| **Raw Meta Webhook Payloads** | `whatsapp_messages.raw_payload` | **90 days** | Scrubbed in place via `scrubWhatsappRawPayload()` leaving only `{ id, type, timestamp, redacted: true }` + `payload_redacted_at`. |
| **Expired Auth Sessions & Stale Devices** | `session`, `verification`, disconnected `whatsapp_linked_device_sessions` | Expiry / **30 days** | Hard-deleted (`session`, `verification`) or credential columns nulled (`whatsapp_linked_device_sessions`). |
| **Booked Tax Invoices, Quotes & Payment Ledgers** | `application_payments` (`ON DELETE RESTRICT`), `application_quotes`, Private R2 `quotes/` & `receipts/` | **6 Years** (`2,190 days`) | **Mandatory FBR retention** under Pakistan Income Tax Ordinance 2001 §174. Preserved even during DSAR erasure of non-financial PII. |

---

## 2. Handling a Pilgrim Data Subject Access Request (DSAR)

Pilgrims submit DSAR access or erasure requests via `alramlahtravels@gmail.com` or Official WhatsApp `+92 327 4029701` (target SLA: **<= 14 calendar days**).

### Step 1 — Identity Verification (Mandatory Before Any Export or Erasure)
Verify control of **both**:
1. The exact normalized phone/WhatsApp number (`+923...` or international E.164) recorded on the dossier, **and**
2. Either the `ART-...` reference number or a live inbound confirmation message sent from that exact WhatsApp number to `+92 327 4029701`.

### Step 2 — DSAR Data Export Query (Subject Access)
Run read-only against `DATABASE_URL_POOLED` using the normalized E.164/national phone variants:

```sql
-- 1. Export Pilgrim Applications, Quotes & Payment Ledger Summary
SELECT
  a.id AS application_id,
  a.reference_number,
  a.source,
  a.status,
  a.customer_name,
  a.customer_phone,
  a.customer_whatsapp,
  a.customer_email,
  a.customer_city,
  a.ksa_arrival_date,
  a.ksa_departure_date,
  a.created_at
FROM applications a
WHERE regexp_replace(a.customer_phone, '\D', '', 'g') LIKE '%<LAST_10_DIGITS>'
   OR regexp_replace(a.customer_whatsapp, '\D', '', 'g') LIKE '%<LAST_10_DIGITS>';

-- 2. Locate All Private R2 Media Keys Associated With the Pilgrim
SELECT wm.id, wm.wamid, wm.media_url, wm.created_at
FROM whatsapp_messages wm
JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id
WHERE regexp_replace(wc.contact_phone, '\D', '', 'g') LIKE '%<LAST_10_DIGITS>'
  AND wm.media_url IS NOT NULL;
```
Never include internal consultant notes (`application_quotes.internal_notes_admin` or `whatsapp_conversations.internal_notes`) or wholesale supplier net rates (`supplier_net_cost_pkr`) in customer exports.

### Step 3 — DSAR Right-to-Erasure Execution SOP
1. **Check Financial Ledger Status First**:
   ```sql
   SELECT COUNT(*) AS payment_rows
   FROM application_payments ap
   JOIN applications a ON a.id = ap.application_id
   WHERE a.id = '<APPLICATION_UUID>';
   ```
2. **Delete Private R2 Passport & Chat Media Objects Immediately** (`passports/...` and `whatsapp-media/...` — do **not** delete `receipts/...` on paid bookings subject to 6-year FBR audit):
   ```bash
   R2_KEYS="passports/<key1>,whatsapp-media/<key2>" \
   npx tsx -e '
     import { deleteR2Objects } from "./lib/storage/r2.ts";
     const keys = process.env.R2_KEYS!.split(",").map((k) => k.trim()).filter(Boolean);
     const res = await deleteR2Objects(keys);
     console.log("R2 DSAR deletion summary:", res);
   '
   ```
3. **Anonymize PII in PostgreSQL & Record `audit_logs` Entry**:
   - **If `payment_rows = 0` and `status != 'approved'` (Unbooked Inquiry)**:
     ```sql
     BEGIN;
     UPDATE applications
     SET customer_name = '[REDACTED DSAR]',
         customer_phone = 'REDACTED',
         customer_whatsapp = 'REDACTED',
         customer_city = 'REDACTED',
         customer_email = NULL,
         special_requests = NULL,
         revision_notes_customer = NULL,
         hajj_inquiry_json = NULL,
         voucher_token = NULL,
         updated_at = NOW()
     WHERE id = '<APPLICATION_UUID>';

     UPDATE whatsapp_messages wm
     SET body = '[REDACTED DSAR]',
         media_url = NULL,
         raw_payload = jsonb_build_object('redacted', true, 'reason', 'dsar'),
         payload_redacted_at = NOW()
     FROM whatsapp_conversations wc
     WHERE wm.conversation_id = wc.id
       AND regexp_replace(wc.contact_phone, '\D', '', 'g') LIKE '%<LAST_10_DIGITS>';

     INSERT INTO audit_logs (actor_role, action, entity_type, entity_id, after_json)
     VALUES ('super_admin', 'privacy.dsar_erasure_completed', 'application', '<APPLICATION_UUID>', '{"scope":"unbooked_full_redaction"}'::jsonb);
     COMMIT;
     ```
   - **If `payment_rows > 0` or `status = 'approved'` (Booked Client — FBR §174 Carve-Out)**: Purge all `passports/` and `whatsapp-media/` objects, redact WhatsApp chat bodies/payloads, set `do_not_contact` (**Section 3**), and inform the pilgrim in writing that statutory invoice and `application_payments` records are retained strictly for 6 years under Pakistan Income Tax Ordinance 2001 §174.

---

## 3. Marketing Opt-Out (`STOP` / `do_not_contact`) Verification

Inbound `STOP`, `UNSUBSCRIBE`, `OPT OUT`, or `RUKO` messages automatically flag `do_not_contact` (`T-011`, `T-027`, `T-030`). To manually enforce an opt-out across VIP Outreach and Meta Broadcasts:

```sql
INSERT INTO outreach_contacts (full_name, whatsapp_number, interest_status, opted_out_at, notes)
VALUES ('Opted-Out Contact', '+923XXXXXXXXX', 'do_not_contact', NOW(), 'Manual DSAR / opt-out lock')
ON CONFLICT (whatsapp_number) DO UPDATE
SET interest_status = 'do_not_contact',
    opted_out_at = COALESCE(outreach_contacts.opted_out_at, NOW()),
    updated_at = NOW();
```
`calculateOutreachCooldown` (`lib/domain/marketing-ops.ts`) permanently returns `{ canContact: false, reason: "do_not_contact" }` regardless of elapsed days or subsequent inbound messages.

---

## 4. Private R2 Bucket & OpenRouter Zero-Data-Retention (ZDR) Audit Check

1. **Private Media Gate (`T-014`)**: Confirm `PRIVATE_MEDIA_PREFIXES` (`passports/`, `whatsapp-media/`, `quotes/`, `quotations/`, `receipts/`) are never served via public CDN URLs and are accessed solely via `/api/media/[...key]` (`10-min` signed URL, `Cache-Control: private, no-store`).
2. **AI ZDR Verification (`T-028`)**: Confirm OpenRouter account settings (`openrouter.ai/settings/privacy`) have **Zero Data Retention / Do Not Train** enabled globally, matching the code-level `provider: { data_collection: "deny" }` and pre-prompt PII redaction enforced in `lib/ai/quoting-copilot.ts`.
