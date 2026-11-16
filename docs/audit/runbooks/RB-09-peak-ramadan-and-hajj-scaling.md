# RB-09 — Peak Ramadan, Rabi-ul-Awwal & Hajj Season Scaling Playbook

**Owner**: Engineering & Operations (`super_admin`)  
**Activation Window**: Execute **T-minus 14 days** before 1st Shaban (Ramadan Umrah surge), 1st Rabi-ul-Awwal, and Pakistan MoRA / Saudi Nusuk Hajj quota announcement windows.

---

## 1. Pre-Peak Infrastructure Capacity Checklist (`OD-07` Commercial Stack)

### 1.1 Neon Launch PostgreSQL Compute & Connection Pooling
- **Compute Autoscaling**: In Neon Console -> **Project Settings -> Compute**, raise the primary branch autoscaling ceiling from `0.25–1 CU` to **`0.5–4 CU`** for the duration of Shaban/Ramadan and disable scale-to-zero during daytime PKT (`09:00–01:00 PKT`) if cold-start latency exceeds `250ms`.
- **Pooled vs Unpooled Endpoints (`db/index.ts`)**:
  - Confirm `DATABASE_URL_POOLED` in **both** Vercel Pro and Trigger.dev Cloud points to the Neon **`-pooler`** PgBouncer endpoint (`?sslmode=require`), which multiplexes up to `10,000` concurrent client connections across serverless isolates (`max: 10` per pool in `db/index.ts`).
  - Confirm `DATABASE_URL_UNPOOLED` is used **only** for `db/migrate.ts` and `scripts/db-backup.ts`.
- **Active Connection & Slow-Query Check**:
  ```sql
  SELECT state, COUNT(*) AS conn_count, MAX(NOW() - query_start) AS oldest_query_age
  FROM pg_stat_activity
  WHERE datname = current_database()
  GROUP BY state;
  ```

### 1.2 Vercel Pro Fluid Compute & Storefront ISR Caching
- **Public Storefront ISR (`T-057`)**: `/`, `/privacy`, and `/terms` serve cached static/ISR HTML (`revalidate = 300`), absorbing viral TikTok/Instagram Reel traffic spikes without hitting Neon on every pageview.
- **Desk Inbox Polling Load (`T-088`)**: `/admin/desk` (`desk-hub-client.tsx`) enforces single-flight read-only polling and pauses background timers whenever `document.visibilityState === "hidden"`. Remind consultants to close unused duplicate browser tabs during peak hours.
- **Rate Limiter Hygiene**: Purge expired `rate_limit_buckets` rows before peak campaign launches so index lookups remain sub-millisecond:
  ```sql
  DELETE FROM rate_limit_buckets WHERE expires_at < NOW();
  ```

---

## 2. Meta WABA Messaging Tier Warm-Up (`1k -> 10k -> 100k` / 24h)

Meta enforces rolling 24-hour unique-recipient messaging limits per business phone number (`whatsapp_accounts.messaging_limit` & `quality_rating`):

1. **Check Current Tier & Quality Rating**:
   ```sql
   SELECT name, display_phone_number, quality_rating, messaging_limit, is_active
   FROM whatsapp_accounts
   ORDER BY is_default DESC;
   ```
2. **14-Day Tier Escalation Protocol**:
   - Meta automatically upgrades a line (`TIER_1K -> TIER_10K -> TIER_100K`) within 24–48 hours when:
     1) Phone `quality_rating` stays **`GREEN`** (never `RED` / `FLAGGED`), **and**
     2) You message at least **`50%` of your current limit** (`>= 500` unique opted-in recipients on `1k` tier) across a 7-day window.
   - Start sending curated, high-relevance Ramadan early-bird broadcasts (`UTILITY` updates to past pilgrims + opted-in `MARKETING` VIP lists) **2 weeks before Shaban**, segmented by city (`Lahore`, `Islamabad`, `Karachi`, `UK/US Diaspora`) rather than cold-blasting unengaged lists.
3. **Cost & Opt-Out Guardrails (`T-088`, `A23-013`)**:
   - Every Pakistan (`+92`) `MARKETING` template delivery costs **`~$0.0473 USD` (~`PKR 13.2`)**. Verify the Meta WhatsApp Manager billing card has sufficient credit limit and review the recipient-count cost confirmation modal in `/admin/campaigns` before launching.
   - If `quality_rating` drops to `YELLOW`, immediately pause cold `MARKETING` CSV broadcasts for 72 hours while keeping 1:1 `/admin/desk` replies and `ART-...` inbound package auto-replies active.

---

## 3. Cloudflare R2 Presign Bandwidth & Oracle Gotenberg Render Capacity

1. **Direct Browser-to-R2 Uploads (`/api/uploads/presign`)**:
   - Supplier PDF/image flyers and social Reel MP4s (`<= 100 MB`) upload directly to Cloudflare R2 via presigned `PUT` (`0` egress fees on R2, bypassing Vercel's `4.5 MB` function payload ceiling).
   - Confirm public Studio assets resolve through the custom Cloudflare CDN domain (`https://assets.alramlahtravels.com` / `https://r2.alramlahtravels.com`) with Cloudflare edge caching enabled.
2. **Oracle Gotenberg ARM64 Headroom**:
   - Check VM memory and container health before peak quoting days:
     ```bash
     ssh ubuntu@<ORACLE_VM_IP> "docker stats --no-stream gotenberg caddy && df -h /"
     ```
   - If >5 consultants are generating 3-Page Quotation PDFs and 17-card paginated Studio posters simultaneously, `gotenbergQueue` (`concurrencyLimit: 2`) safely queues excess jobs in Trigger.dev without OOMing the VM. If sustained queue wait exceeds `30s`, bump the OCI `VM.Standard.A1.Flex` shape to the full Always Free ceiling (`4 OCPU` / `24 GB RAM`, `$0.00/mo`) and raise `--chromium-max-concurrency=3` in `scripts/oracle-gotenberg/docker-compose.yml`.

---

## 4. Group Departure Seat-Lock & Overbooking Contention Monitoring (`OD-09d`)

Public `submitGroupBookingApplication` checks open capacity at submission, while hard `group_departures.booked_seats` deduction (`adults + children`; `infants` = `0` seats) executes atomically inside `withTransaction()` with `SELECT ... FOR UPDATE` when an admin transitions the dossier to `status = 'approved'` (`T-019`, `T-022`), backed by SQL constraint `chk_group_departures_seats_and_dates` (`booked_seats <= total_seats`).

Run this live inventory monitor daily during Ramadan/Hajj selling windows:

```sql
SELECT
  gp.title AS package_title,
  gd.batch_code,
  gd.departure_date,
  gd.status AS batch_status,
  gd.total_seats,
  gd.booked_seats,
  (gd.total_seats - gd.booked_seats) AS remaining_seats,
  COUNT(a.id) FILTER (WHERE a.status IN ('pending_quote', 'quoted')) AS in_pipeline_dossiers,
  COALESCE(SUM(a.bed_and_seat_count) FILTER (WHERE a.status IN ('pending_quote', 'quoted')), 0) AS pipeline_requested_seats
FROM group_departures gd
JOIN group_packages gp ON gp.id = gd.package_id
LEFT JOIN applications a ON a.group_departure_id = gd.id
WHERE gd.departure_date >= CURRENT_DATE
GROUP BY gp.title, gd.id, gd.batch_code, gd.departure_date, gd.status, gd.total_seats, gd.booked_seats
ORDER BY gd.departure_date ASC;
```
- When `remaining_seats <= 6`, update `gd.status` to `'filling_fast'` in `/admin/catalog?tab=groups` (automatically reaches `'sold_out'` when `remaining_seats = 0`).
- Verify `agency_settings.sar_to_pkr_rate` in `/admin/settings` daily during volatile SAR/PKR forex sessions so Masar `<=30d` Visa+Hotel calculations stay profitable (`OD-09a`).
