# RB-03 — Cryptographic Vault, Auth Secret, Password & API Key Rotation SOP

**Owner**: Security & Platform Operations (`super_admin`)  
**Vault Implementation**: `lib/security/vault.ts` (`v2:<kid>:<ivHex>:<tagHex>:<ctHex>`, AES-256-GCM 96-bit IV + 128-bit auth tag, HKDF-SHA256 subkeys derived from 64-hex `ENCRYPTION_KEY`)  
**Password KDF**: Better Auth `scrypt` (`better-auth/crypto` `hashPassword` in `lib/auth.ts`, stored in `account.password` where `provider_id = 'credential'`)

> [!IMPORTANT]
> **Dual-Custody Key Escrow**: The current 64-character hex `ENCRYPTION_KEY` must always be stored in the Founder's offline hardware-backed password vault (1Password / Bitwarden Emergency Kit). Losing `ENCRYPTION_KEY` without `ENCRYPTION_KEY_PREVIOUS` requires re-authenticating all Meta WABA and Core 5 Social OAuth tokens.

---

## 1. Zero-Downtime `ENCRYPTION_KEY` Rotation (`ENCRYPTION_KEY_PREVIOUS` Keyring)

`lib/security/vault.ts` supports seamless dual-key rotation across all encrypted PostgreSQL columns:
- `whatsapp_accounts.encrypted_access_token`
- `social_integrations.encrypted_access_token` & `social_integrations.encrypted_refresh_token`
- `whatsapp_linked_device_sessions.encrypted_auth_creds` & `whatsapp_linked_device_sessions.encrypted_auth_keys`

### Step 1 — Take Pre-Rotation Backup & Mint New 32-Byte Hex Key
1. Run `npm run db:backup` per **RB-02 §1**.
2. Generate a cryptographically random 64-hex-character key (never echo to shared Slack/chat):
   ```bash
   openssl rand -hex 32
   ```

### Step 2 — Roll Out Keyring (`ENCRYPTION_KEY` + `ENCRYPTION_KEY_PREVIOUS`) Across Both Runtimes
Update **both** Vercel Pro (`Production`) and Trigger.dev Cloud (`Production` environment variables, followed by `npm run trigger:deploy`):
- Set `ENCRYPTION_KEY_PREVIOUS` = `<OLD_64_HEX_KEY>`
- Set `ENCRYPTION_KEY` = `<NEW_64_HEX_KEY>`

Redeploy Vercel so all active serverless isolates load the 2-key ring (`encryptVaultSecret` immediately writes under `<NEW_KID>`, while `decryptVaultSecret` transparently reads both `<NEW_KID>`, `<OLD_KID>`, and any legacy 3-part GCM tokens).

### Step 3 — Re-Encrypt All Stored Ciphertexts Transactionally to `<NEW_KID>`
Run the transactional re-encryption pass from an authenticated operator shell pointed at `DATABASE_URL_UNPOOLED`:

```bash
node --input-type=module -e '
  import pg from "pg";
  import { decryptVaultSecret, encryptVaultSecret } from "./lib/security/vault.ts";

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
  await client.connect();
  try {
    await client.query("BEGIN");

    const wa = await client.query("SELECT id, encrypted_access_token FROM whatsapp_accounts");
    for (const row of wa.rows) {
      if (row.encrypted_access_token) {
        const plain = decryptVaultSecret(row.encrypted_access_token);
        // Strip v2 envelope check by re-encrypting raw plaintext with primary key
        const rotated = encryptVaultSecret(plain);
        await client.query(
          "UPDATE whatsapp_accounts SET encrypted_access_token = $1, updated_at = NOW() WHERE id = $2",
          [rotated, row.id]
        );
      }
    }

    const soc = await client.query(
      "SELECT id, encrypted_access_token, encrypted_refresh_token FROM social_integrations"
    );
    for (const row of soc.rows) {
      const nextAccess = row.encrypted_access_token
        ? encryptVaultSecret(decryptVaultSecret(row.encrypted_access_token))
        : row.encrypted_access_token;
      const nextRefresh = row.encrypted_refresh_token
        ? encryptVaultSecret(decryptVaultSecret(row.encrypted_refresh_token))
        : null;
      await client.query(
        "UPDATE social_integrations SET encrypted_access_token = $1, encrypted_refresh_token = $2, updated_at = NOW() WHERE id = $3",
        [nextAccess, nextRefresh, row.id]
      );
    }

    await client.query("COMMIT");
    console.log("Successfully rotated whatsapp_accounts and social_integrations to primary v2 key.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
'
```
*(Run via `npx tsx` so TypeScript imports resolve cleanly.)*

### Step 4 — Verify Key ID Parity & Retire `ENCRYPTION_KEY_PREVIOUS`
1. Verify all stored tokens begin with the new `v2:<new_kid>:` prefix:
   ```sql
   SELECT split_part(encrypted_access_token, ':', 1) AS version,
          split_part(encrypted_access_token, ':', 2) AS kid,
          COUNT(*)
   FROM whatsapp_accounts
   GROUP BY 1, 2
   UNION ALL
   SELECT split_part(encrypted_access_token, ':', 1),
          split_part(encrypted_access_token, ':', 2),
          COUNT(*)
   FROM social_integrations
   GROUP BY 1, 2;
   ```
2. Wait 24 hours, confirm zero `Vault decryption failed` errors in Vercel and Trigger.dev logs, then unset `ENCRYPTION_KEY_PREVIOUS` from Vercel Pro and Trigger.dev Cloud.

---

## 2. `BETTER_AUTH_SECRET` Rotation & Session Invalidation

`BETTER_AUTH_SECRET` (`>= 32` high-entropy chars enforced by `lib/env.ts`) signs `__Secure-better-auth.session_token` cookies and password-reset tokens.

1. Generate a new secret: `openssl rand -base64 48`.
2. **Impact Notice**: Rotating `BETTER_AUTH_SECRET` immediately invalidates all in-flight browser cookies and pending `/admin/login` password-reset links, requiring all `super_admin` and `staff` consultants to sign in again.
3. Update `BETTER_AUTH_SECRET` in Vercel Pro (`Production`) and purge stale server sessions in PostgreSQL:
   ```sql
   DELETE FROM "session";
   DELETE FROM "verification";
   ```
4. Redeploy Vercel and verify `/admin/login` authentication succeeds.

---

## 3. Better Auth `scrypt` Temporary Password Reset SOP (`OD-02` Fallback)

Admin and staff passwords are hashed with **Better Auth `scrypt`** (`hashPassword` from `better-auth/crypto` in `lib/auth.ts`, `minPasswordLength: 10`). Public `/api/auth/sign-up` is permanently disabled (`disableSignUp: true`, `T-004`).

- **Normal Self-Serve Flow**: Staff clicks **Forgot Password** on `/admin/login`, triggering `sendPasswordResetEmail` via Resend (`lib/security/mailer.ts`, 30-minute expiry, `revokeSessionsOnPasswordReset: true`, `3 req / 60s` database rate limit).
- **Emergency `super_admin` CLI Temp-Password Issuance** (if Resend/DNS is unreachable or `super_admin` is locked out):
  ```bash
  TEMP_PASS="$(openssl rand -base64 18)" \
  TARGET_EMAIL="admin@alramlahtravels.com" \
  npx tsx -e '
    import pg from "pg";
    import { hashPassword } from "better-auth/crypto";

    const email = process.env.TARGET_EMAIL!.trim().toLowerCase();
    const hash = await hashPassword(process.env.TEMP_PASS!);
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
    await client.connect();
    await client.query("BEGIN");
    const { rows } = await client.query(
      "UPDATE \"user\" SET is_active = true, must_change_password = true, updated_at = NOW() WHERE email = $1 RETURNING id",
      [email]
    );
    if (rows.length !== 1) throw new Error("Target user not found");
    const userId = rows[0].id;
    await client.query(
      "UPDATE account SET password = $1, updated_at = NOW() WHERE user_id = $2 AND provider_id = \x27credential\x27",
      [hash, userId]
    );
    await client.query("DELETE FROM \"session\" WHERE user_id = $1", [userId]);
    await client.query("COMMIT");
    await client.end();
    console.log("Temporary password set with must_change_password=true and active sessions revoked.");
  '
  ```
  Deliver `TEMP_PASS` over an encrypted out-of-band channel; `mustChangePassword = true` forces immediate password rotation upon login (`T-043`).

---

## 4. `GOTENBERG_API_KEY`, `RESEND_API_KEY` & `HEALTHCHECK_BEARER_TOKEN` Rotation

### 4.1 `GOTENBERG_API_KEY` (Oracle VM + Vercel + Trigger.dev)
1. SSH into the Oracle ARM64 Gotenberg VM (`ssh ubuntu@<ORACLE_VM_IP>`).
2. Generate a new 64-hex secret and update `~/gotenberg/.env` (keeping `chmod 600`):
   ```bash
   NEW_KEY="$(openssl rand -hex 32)"
   sudo sed -i -E "s|^GOTENBERG_API_KEY=.*|GOTENBERG_API_KEY=${NEW_KEY}|" ~/gotenberg/.env
   cd ~/gotenberg && sudo docker compose up -d caddy
   ```
3. Immediately update `GOTENBERG_API_KEY` in **Vercel Pro** and **Trigger.dev Cloud** (`npm run trigger:deploy`).
4. Verify `GET /api/health?deep=1` reports `checks.gotenberg.status === "ok"`.

### 4.2 `RESEND_API_KEY` & `HEALTHCHECK_BEARER_TOKEN`
1. Mint a new restricted Sending API key for `@alramlahtravels.com` in the Resend Dashboard (`Sending access` only, never `Full access`).
2. Update `RESEND_API_KEY` in **Vercel Pro** and **Trigger.dev Cloud** (used by `sla-overdue-quote-monitor` alerts and `QuoteDispatchBar`), then revoke the old key in Resend.
3. For `HEALTHCHECK_BEARER_TOKEN` (`>= 16` chars, constant-time verified in `app/api/health/route.ts`), update both Vercel Pro and the external uptime monitor (BetterStack / Cloudflare Health Check) simultaneously.
