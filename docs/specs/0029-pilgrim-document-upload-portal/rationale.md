# 0029. Pilgrim Document Upload Portal and Staff Verification: Decision Record

**Spec**: [index.md](./index.md)
**Date**: 2026-11-22

## Context

Al Ramlah Travels processes multi traveller Umrah bookings (`Adults`, `Children`, and `Infants`) where Saudi visa issuance requires three clear documents per person: a passport bio page valid for at least six months beyond the Kingdom departure date, a Pakistani CNIC (for adults) or NADRA B Form / Smart Card (for children and infants), and a white background visa photograph. Today, after a pilgrim accepts a quote on `/#track-status` and pays their bank transfer deposit (`OD-03`, `OD-04`), agency consultants collect these files manually over WhatsApp or email threads. Manual chat collection mixes up scans across family members, loses track of blurry photos that need replacement, and leaves passport images scattered inside `whatsapp-media/` threads rather than structured per traveller slots inside `/admin/applications/[id]`.

Four hard technical and compliance forces shape this design:
1. **Regulated PII and Retention Law (`CONST-SEC-06`, `OD-06`)**: Passport bio pages, passport numbers, and CNIC / NADRA B Form identifiers are high risk personal identity records. Public `/privacy` commitments require private encrypted storage (`passports/` prefix served strictly via `10` minute signed `/api/media/[...key]` URLs, never public CDN links), zero search engine indexing (`CONST-SEO-01`), immutable `audit_logs` on all state changes (`CONST-SEC-03`), automatic deletion of passport scans and identity numbers `60` days after KSA return, and `6` year retention of parent financial tax records under Pakistan Income Tax Ordinance 2001 §174.
2. **Physical QR Voucher Exposure (`OD-04`, `CONST-DOM-08`)**: Approved bookings already carry `applications.voucherToken`, which is printed as a scannable QR code on confirmation vouchers handed to hotel reception desks, airport coordinators, and transport drivers. Any design that reuses `voucherToken` or omits a second verification check would expose family passport scans to anyone who photographs or scans a printed hotel voucher.
3. **Serverless Body Limits vs Polyglot Upload Attacks (`OD-07`, `CONST-SEC-03`)**: Modern smartphone camera photos and scanned PDFs routinely measure `5 MB` to `10 MB`, exceeding Vercel's `4.5 MB` serverless function request body limit, yet pure unverified client direct uploads can bypass binary magic byte checks (`sniffAllowedBinaryMagicBytes` in `lib/storage/upload-security.ts`).
4. **Zero Account Friction for Pilgrims (`OD-01`, `OD-05`)**: Public admin sign up is disabled (`403`, `CONST-SEC-01`) and pilgrims book without creating accounts or passwords, so the upload portal must stay passwordless while resisting link enumeration and casual WhatsApp link forwarding.

## Options considered

### Option 1: Normalized Traveller and Document Tables + Separate Vaulted Capability Token with Phone Session Cookie + Two Step Presigned R2 Upload with Server Magic Byte Commit

Add `application_travellers` (`1` row per adult, child, or infant) and `application_documents` (`3` typed slot rows per traveller) alongside dedicated `document_portal_token_hash` (SHA256) and `document_portal_token_encrypted` (`v2:` HKDF AES 256 GCM) columns on `applications`. Gate `/documents/[token]` on `approved` + verified deposit/full payment plus a one time booking phone verification check (`HttpOnly` `24h` HMAC cookie, rate limited in PostgreSQL), upload files up to `10 MB` directly to private `passports/` R2 via `5` minute presigned `PUT` URLs, and inspect the first `512` bytes server side on commit via `sniffAllowedBinaryMagicBytes()` before recording `'uploaded'` and deleting any superseded R2 key.

**Pros**:
- Isolates family passport scans completely from printed QR `voucherToken` links and protects PII even if a `/documents/[token]` link is forwarded in a group chat.
- Supports full `10 MB` camera photos and PDFs on Vercel without `413` body failures while still enforcing server side binary magic byte validation (`PNG`, `JPEG`, `WEBP`, `PDF`) before acceptance.
- Allows `/#track-status` and `/admin/applications/[id]` to share the active portal URL (decrypted from the `v2:` vault) without storing plaintext tokens in PostgreSQL and without invalidating previously emailed links until `super_admin` explicitly rotates the token.
- Gives `runPiiAndMediaRetentionPurge` exact foreign key scoped `storage_key` and PII columns to scrub `60` days after KSA return while keeping anonymized verification timestamps intact.

**Cons**:
- Adds `2` relational tables, `3` enums, and a two step `presign` + `commit` upload flow rather than a single form post.
- Requires pilgrims to enter their booking phone number once per browser (`24h` cookie) when opening `/documents/[token]`.

### Option 2: Reuse `voucherToken` with Direct Multipart Server Upload and JSONB Metadata on `applications`

Store traveller names, passport numbers, and slot R2 keys inside a single `pilgrim_documents_json` `jsonb` column on `applications`, reuse `/voucher/[token]`'s token to open `/documents/[token]` directly without a phone prompt, and upload files via a single `multipart/form-data` Next.js Route Handler.

**Pros**:
- Zero new tables (`jsonb` column only) and zero phone verification prompt on first open.
- Single HTTP request per upload with immediate in memory magic byte checking.

**Cons**:
- Reusing `voucherToken` means any third party who scans the printed confirmation voucher QR code can access or tamper with family passport scans.
- Fails with `413 Payload Too Large` on Vercel whenever a smartphone passport photo or multi page PDF exceeds `4.5 MB`.
- Concurrent family uploads or staff reviews on a single `jsonb` column risk lost updates without row locking, and lose relational foreign keys (`reviewed_by_user_id`) and SQL `CHECK` guarantees.

### Option 3: WhatsApp Only Inbound Media Tagging without a Web Upload Portal

Keep pilgrims inside WhatsApp chat (`DeskHubClient`) and let consultants tag inbound `whatsapp-media/` attachments to traveller slots manually inside `/admin/desk`.

**Pros**:
- Zero public web routes, capability tokens, or presign endpoints to maintain.

**Cons**:
- Fails to solve the core operational bottleneck: consultants still manually sort unnamed chat images across `4` to `10` family members, chase missing `6` month passport expiry dates by hand, and cannot offer a self service checklist from `/#track-status` or email.
- WhatsApp compresses images and mixes `60` day passport retention with `24` month `whatsapp-media/` chat history rules.

## Rationale

Option 1 is chosen because it satisfies all four operational and security forces without adding new external infrastructure. Separating `documentPortalToken` from `voucherToken` eliminates the physical QR voucher exposure flaw in Option 2, while pairing SHA256 indexed lookup (`document_portal_token_hash`) with `v2:` vault encryption (`document_portal_token_encrypted`) reuses `lib/security/vault.ts` (`CONST-SEC-05`) so raw database reads never expose live URLs yet both `/#track-status` and `/admin/applications/[id]` can surface the active link seamlessly. Adding the lightweight `HttpOnly` phone verification cookie (`5/15m` IP rate limit via `lib/rate-limit.ts`) reuses the proven `OD-05` phone normalization pattern so a forwarded URL never leaks passport numbers or `10` minute signed scans.

On the upload path, two step presigned `PUT` + server `512` byte `Range` verification combines the best properties of client direct storage and server side security: `5` to `10 MB` phone camera scans bypass Vercel's `4.5 MB` serverless payload cap, and `commitPilgrimDocumentUploadAction` still verifies binary magic bytes (`sniffAllowedBinaryMagicBytes`), exact byte bounds, and strict `passports/${applicationId}/${travellerId}/${docType}-` key ownership before marking a slot `'uploaded'`. Finally, normalizing `application_travellers` and `application_documents` gives PostgreSQL enforceable `CHECK` constraints (`rejection_reason` required on `'reupload_requested'`, image only MIME on `'visa_photo'`, `<= 10 MB` size ceiling) and lets the nightly `pii-and-media-retention-purge` cron scrub passport PII cleanly `60` days after `ksaDepartureDate` while leaving the `6` year accounting ledger untouched.
