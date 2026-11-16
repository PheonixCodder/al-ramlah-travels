# RB-04 — Meta WhatsApp Cloud API (WABA), Webhook & Ban-Safe Queue Recovery

**Owner**: CRM & Messaging Operations (`super_admin`)  
**Engine**: Native TypeScript Meta WhatsApp Cloud API v21.0 (`lib/whatsapp/*`, `app/api/webhooks/whatsapp/route.ts`, `trigger/process-inbound-whatsapp.task.ts`, `trigger/send-whatsapp-broadcast.task.ts`)  
**Official Agency Lines (`OD-10`)**: `+92 327 4029701` (`03274029701`) · `+92 319 0462638` (`03190462638`)

---

## 1. Meta System User Permanent Access Token Rotation (`NEEDS_REAUTH` / Error `190`)

### Symptoms
- Outbound Desk replies, `ART-...` package auto-replies, or Meta broadcasts fail with Meta Graph API error code **`190`** (`OAuthException: Error validating access token: Session has expired...` or `subcode 460/463/467`).
- `whatsapp_messages` rows record `status = 'failed'` and `error_code = '190'`.

### Resolution SOP (`super_admin` Only)
1. Open **Meta Business Suite** (`business.facebook.com`) -> **Settings** -> **Users** -> **System Users**.
2. Select (or create) the **Admin System User** assigned to the Al Ramlah Travels WhatsApp Business Account (`waba_id`).
3. Click **Generate New Token**:
   - Select the Al Ramlah Travels Meta App (`META_APP_ID`).
   - Set Token Expiration to **Never** (Permanent System User Token).
   - Grant exact scopes: `whatsapp_business_messaging` and `whatsapp_business_management`.
4. Sign in to `https://alramlahtravels.com/admin/settings?tab=waba` as `super_admin`.
5. Paste the fresh permanent token into the target WABA line (`phone_number_id`) and save.
   - `lib/whatsapp/encryption.ts` (`isMaskedOrEncryptedToken`) automatically guards against re-encrypting `••••` UI masks and encrypts the new token via `lib/security/vault.ts` (`v2:<kid>:...`), recording an immutable entry in `audit_logs`.
6. Send a live test message from `/admin/desk` to `+92 319 0462638` and confirm `status` progresses `sent -> delivered -> read`.

---

## 2. Webhook Signature (`x-hub-signature-256`) & `<150ms` Outbox Debugging

`app/api/webhooks/whatsapp/route.ts` enforces two strict gates (`T-029`):
1. **`GET /api/webhooks/whatsapp` (Subscription Handshake)**: Validates `hub.mode === "subscribe"` and constant-time matches `hub.verify_token` against `WHATSAPP_VERIFY_TOKEN` (or `whatsapp_accounts.webhook_verify_token`).
2. **`POST /api/webhooks/whatsapp` (Inbound Events & Receipts)**: Validates `x-hub-signature-256` (`sha256=<hmac>`) against raw request body bytes using `META_APP_SECRET`, atomically persists inbound `wamid` rows to PostgreSQL, dispatches `process-inbound-whatsapp` to Trigger.dev (`inboundWhatsappQueue` keyed by `conversationId`), and returns `200 OK` in `<150ms`.

### Diagnosing `401 Unauthorized` on Inbound Webhooks
1. Verify `META_APP_SECRET` in Vercel Pro matches **Meta App Dashboard -> App Settings -> Basic -> App Secret** byte-for-byte (with zero trailing whitespace/quotes).
2. Test HMAC verification non-destructively from an operator terminal:
   ```bash
   BODY='{"object":"whatsapp_business_account","entry":[]}'
   SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$META_APP_SECRET" | awk '{print $2}')"
   curl -i -sS -X POST https://alramlahtravels.com/api/webhooks/whatsapp \
     -H "Content-Type: application/json" \
     -H "x-hub-signature-256: ${SIG}" \
     --data-raw "${BODY}"
   ```
   - **Expected**: `HTTP/2 200` (whereas altering 1 character in `SIG` must return `HTTP/2 401`).

### Recovering Unprocessed Inbound Webhook Messages During a Trigger.dev Outage
If Trigger.dev Cloud experienced a transient outage, `POST /api/webhooks/whatsapp` still persisted the inbound message in PostgreSQL rather than dropping it. Inspect recent inbound messages lacking bot/media processing:

```sql
SELECT
  wm.id,
  wm.wamid,
  wm.conversation_id,
  wm.message_type,
  wm.raw_media_id,
  wm.media_url,
  wm.created_at AT TIME ZONE 'Asia/Karachi' AS pkt_time
FROM whatsapp_messages wm
WHERE wm.direction = 'inbound'
  AND wm.created_at >= NOW() - INTERVAL '6 hours'
ORDER BY wm.created_at DESC
LIMIT 50;
```
Consultants can immediately view and reply to all persisted inbound threads in `/admin/desk` while Trigger.dev runs replay in the Trigger.dev Dashboard (**RB-07 §3**).

---

## 3. Replaying Failed Broadcast Recipients (`1-Click Retry Drawer`)

Meta `MARKETING` template broadcasts (`trigger/send-whatsapp-broadcast.task.ts`) execute sequentially on `whatsappBroadcastQueue` (`concurrencyLimit: 1`) with anti-ban pacing and automatic opt-out filtering (`do_not_contact` / `opted_out_at IS NOT NULL`).

### Triage & Replay Steps
1. Inspect failure error codes in PostgreSQL or `/admin/campaigns?tab=whatsapp`:
   - **`131026` / `131049` (Per-User Marketing Ecosystem Cap / Undeliverable)**: Meta temporarily throttled marketing messages to that user to protect engagement quality. Wait **24–48 hours** before retrying.
   - **`131042` (Business Eligibility Payment Issue)**: Valid card missing/declined in Meta WhatsApp Manager -> Billing. Fix payment method in Meta Business Suite first.
   - **`132000` / `132012` (Template Parameter Count/Format Mismatch)**: Fix CSV variable mapping in `/admin/campaigns` before retrying.
   - **`429` / `130429` (Throughput Rate Limit)** or **`5xx`**: Safe to retry once rate window clears.
2. Open `/admin/campaigns?tab=whatsapp` (as `super_admin`), click the affected Broadcast row to open the **Broadcast Delivery Funnel & Recipients Drawer** (`broadcast-recipients-drawer.tsx`), review per-recipient errors, and click **Retry Failed Recipients** (`retryFailedWhatsappBroadcastRecipientsAction`).
   - Only recipients in `failed` state (excluding opted-out `STOP` contacts) are re-queued with a fresh Trigger.dev idempotency seed (`retryAttempt` incremented per `T-072`).

---

## 4. `OD-01` Ban-Safe Manual Assisted WhatsApp Group & Status Queue SOP

Per Owner Decision **`OD-01` (Option A)**, server-side unofficial WhatsApp Web linked-device sockets are **permanently retired** in production:
- Serverless containers cannot hold stateful Signal WebSockets without `Bad MAC` session corruption, and automated group/status blasting risks permanent Meta SIM bans on `+92 327 4029701` and `+92 319 0462638`.
- **Approved Production Workflow (`0%` SIM-ban risk)**:
  1. Generate the branded 4K Umrah poster (`1080×1520` normalized social JPEG + Urdu/English caption) in `/admin/studio`.
  2. Queue target WhatsApp Broadcast Groups / WhatsApp Status slots in `/admin/campaigns?tab=whatsapp` (`manual_ready` state via `send-whatsapp-group-campaign.task.ts`).
  3. An operator opens `/admin/campaigns?tab=whatsapp` on desktop or mobile, clicks **Copy Caption & Download Poster** / **Open WhatsApp (`wa.me`)**, shares natively through official WhatsApp Business Desktop/Mobile into the curated community group or Status, and clicks **Mark Shared**.
  4. If cleanup of test marketing channels is ever required, use the `super_admin`-gated action in Settings/Campaigns (which preserves all Core 5 social channels per `T-032`).
