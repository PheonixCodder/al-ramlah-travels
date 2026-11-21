# Native WhatsApp Cloud CRM (`lib/whatsapp`)

## Overview

Native Meta WhatsApp Cloud API v21.0 engine ported from [services/wacrm](../../../services/wacrm/): HMAC-verified webhook ingestion, atomic outbox, `v2:` vault encryption, private R2 media mirroring, 3-Priority Auto-Responder, Guided 3-Step Umrah Intake, >24h template gating, and `OD-01` Ban-Safe Manual Assisted WA Group/Status Copy-Pack Queue.

## Key files

| File | Owns |
|---|---|
| [meta-api.ts](./meta-api.ts) | Meta Graph `v21.0` transport (`recipientFields()` rejects group/status JIDs) |
| [webhook-signature.ts](./webhook-signature.ts) | Constant-time `x-hub-signature-256` verification & secret failover |
| [webhook-dispatcher.ts](./webhook-dispatcher.ts) & [webhook-body.ts](./webhook-body.ts) | Capped body read + Trigger.dev fast-ACK (`retry_pending` fallback) |
| [route.ts](../../app/api/webhooks/whatsapp/route.ts) | `<150ms` webhook GET/POST handler, strict `CLOUD_API` account match |
| [outbox.ts](./outbox.ts) | Tracked outbox, monotonic status ranks, STOP opt-out, 24h gate, brand scrubber |
| [encryption.ts](./encryption.ts) | Wraps `v2:` HKDF-AES-256-GCM ([vault.ts](../security/vault.ts)), rejects masked tokens |
| [media-mirror.ts](./media-mirror.ts) | Private R2 mirroring (`whatsapp-media/...`) via [/api/media](../../app/api/media/%5B...key%5D/route.ts) |
| [auto-responder.ts](./auto-responder.ts) & [safe-regex.ts](./safe-regex.ts) | 3-Priority responder, `ART-...` cards, PKT hours, ReDoS-safe rule matcher |
| [intake-flow.ts](./intake-flow.ts) & [post-ref-detector.ts](./post-ref-detector.ts) | Guided 3-Step Umrah Intake (`ART-WA-...`) & post-code extraction |
| [linked-device.ts](./linked-device.ts) & [desk-tabs.ts](./desk-tabs.ts) | `OD-01` Baileys retirement stubs + Desk `?tab=` & 4s poll merge helpers |

## Conventions

- **Webhook Fast-ACK (`<150ms`)**: [webhook route](../../app/api/webhooks/whatsapp/route.ts) verifies `x-hub-signature-256` (`verifyMetaWebhookSignature`, failing closed if `META_APP_SECRET` is absent) and matches active `CLOUD_API` `phoneNumberId` strictly without unrelated `isDefault` fallback.
- **Monotonic Receipts & Async Queue**: Buffer early status webhooks (`bufferEarlyWebhookStatusReceipt`), enforce monotonic `pending < sent < delivered < read` (`shouldAdvanceWhatsappMessageStatus`), and dispatch inbound payloads to [process-inbound-whatsapp.task.ts](../../trigger/process-inbound-whatsapp.task.ts).
- **3-Priority Auto-Responder & Guided 3-Step Intake**:
  - **Priority 0**: `isStopOptOutMessage()` (`STOP`, `UNSUBSCRIBE`, `OPT OUT`, `RUKO`) runs before token decryption and locks `DO_NOT_CONTACT` across `whatsapp_conversations` and `outreach_contacts` (`applyWhatsappStopOptOut`, silenced by `isWhatsappContactOptedOut`).
  - **Priority 1 / 1.5**: `ART-...` package lookup (`resolveDetectedPostRefCards`), then Guided 3-Step Umrah Intake ([intake-flow.ts](./intake-flow.ts): `AWAITING_MONTH` -> `AWAITING_PILGRIMS` -> `AWAITING_HOTEL_TIER` -> `COMPLETED`) with `cancel`/`human`/`hajj`/`STOP` escape hatches, `MAX_CONSECUTIVE_INTAKE_REPROMPTS = 2`, and `SELECT ... FOR UPDATE` deduplication (`"hajj inquiry"` routes away from Umrah intake).
  - **Priority 2 / 3**: ReDoS-safe keyword rules ([safe-regex.ts](./safe-regex.ts)) and PKT business-hours greetings (`isWithinPktBusinessHours`), filtered through `sanitizeAutoReplyBrandTruth()` (blocks unverified IBANs unless `ibanVerified = true`).
- **Private PII Media & Auth Healing**: [media-mirror.ts](./media-mirror.ts) stores inbound attachments under private R2 keys served behind authenticated [private media route](../../app/api/media/%5B...key%5D/route.ts) (`private, no-store`, `noindex`); `markWhatsappAccountNeedsReauthIfAuthError()` flags `qualityRating: "NEEDS_REAUTH"` on token errors.

## Gotchas

- **Zero Fake `wamid.sim_*` Rows**: `dispatchTrackedOutboundMessage()` persists `status: "pending"` BEFORE Meta's API call and sets `"failed"` on error — never write simulated `wamid.sim_*` or `wamid.bridge_*` IDs.
- **>24h Customer Service Window**: `isWithin24HourServiceWindow()` ([outbox.ts](./outbox.ts)) and [whatsapp-crm.ts](../../app/actions/whatsapp-crm.ts) reject free-form text/PDF outside 24h (`WINDOW_CLOSED_TEMPLATE_REQUIRED`), requiring an approved template ([whatsapp-crm schema](../../db/schema/whatsapp-crm.ts)).
- **`OD-01` Baileys Sunset**: Server-side `@whiskeysockets/baileys` sockets are retired (`BAILEYS_SUNSET_MODE = "manual_assisted_queue"` in [linked-device.ts](./linked-device.ts): `getActiveBaileysSocket()` -> `null`, `sendLinkedDeviceMessage()` throws). Group & Status distribution uses the Manual Assisted Queue in `/admin/campaigns`.

## Related specs

- [Spec 0009 — Native WACRM WhatsApp Cloud CRM](../../docs/specs/0009-native-wacrm-whatsapp-cloud-crm.md)
- [Spec 0017 — Auto-Reply Rules & Quick Replies](../../docs/specs/0017-wacrm-auto-reply-rules-greeting-and-quick-reply-manager.md)
- [Spec 0019 — Realtime Inbox, Templates & Broadcasts](../../docs/specs/0019-wacrm-phase3-realtime-inbox-templates-broadcasts-and-flows.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
