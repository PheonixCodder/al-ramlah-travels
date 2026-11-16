# 0023. Production-Ready De-Clutter & Dynamic Data Overhaul

- **Status**: Approved
- **Slice**: Slice 42 (Feature #46)
- **Date**: 2026-11-09

## 1. Objective

Transform both the Admin Portal (`web/app/admin/(dashboard)/*` & `web/components/admin/*`) and Public Website (`web/app/(public)/*` & `web/components/public/*`) from a cluttered, demo-seeded interface into a clean, minimal, 100% dynamic production platform:
1. **Zero Demo/Mock Database Pollution**: Purge all fake seeded applications (`Barrister Adil...`), fake outreach leads, fake B2B suppliers/flyers/post assets, fake `whatsapp_accounts` (`linked-default`, `linked-secondary`, demo WABA rows), unlinked `whatsapp_linked_device_sessions`, and fake `whatsapp_auto_reply_rules` / `whatsapp_quick_replies` from Neon PostgreSQL and `db/seed.ts`.
2. **100% Dynamic WhatsApp Phone Linking**: Remove `DEFAULT_LINKED_DEVICE_SLOTS` and all hardcoded phone numbers (`0321-4629700`, `0319-8463538`) from `lib/whatsapp/linked-device.ts` and UI components. Start empty when 0 phones are linked; dynamically populate phone numbers and display names from WhatsApp upon QR or Pairing Code connection.
3. **De-Cluttered Admin UI**:
   - **Settings (`/admin/settings?tab=whatsapp`)**: Filter out internal `LINKED_DEVICE` rows from Meta Cloud API WABA accounts; remove the `"Purge 36 Mock Channels"` button and `"Bypassing Meta Same-Portfolio Error #1690130"` box; present 2 clean sections (**1. Connected WhatsApp Phones (QR / Pairing Code)** and **2. Official Meta Cloud API (WABA) & Templates**).
   - **Campaigns (`/admin/campaigns?tab=whatsapp`)**: Remove the duplicated `<WhatsappLinkedDeviceCard />` and `"All 36 placeholder groups have been purged"` banner; replace with a compact dynamic **Connected Phone Status Bar** (`Sync Groups` / `Connect Phone in Settings`) and 100% dynamic Sender Line & Phone Line filters.
   - **Desk Inbox (`/admin/desk?tab=inbox`)**: Collapse the 5 stacked filter rows (18 buttons) into **1 search bar + 1 simple status filter row** (`All`, `Unread`, `Pinned`, `Archived`) + a dynamic **Phone Line dropdown** that appears when accounts are connected.
   - **AI Quoting Copilot (`app/actions/quoting-copilot.ts`)**: Execute `runQuotingCopilot(applicationId)` directly inline so clicking **Generate Estimate** returns the real SAR/PKR breakdown immediately in 2–4 seconds instead of getting stuck at `25%`.
   - **Auto-Reply Studio & Studio Hub (`whatsapp-auto-reply-studio.tsx`, `studio-hub-client.tsx`)**: Remove hardcoded Askari 10 preset rules, `"Load Preset"` buttons, `"Live Keyword Rule Simulator"`, and `"Test Sample Sheet / Single"` demo buttons. Strip internal developer jargon (`WaCRM`, `Postiz`, `Gotenberg`, `Trigger.dev v4 Realtime`, `HUB 1–4`) from all user-facing headings and badges.
4. **Dynamic Public Pages & Centralized `lib/company-info.ts`**:
   - Create `web/lib/company-info.ts` (`getCompanyInfo(settings)`) as the single source of truth backed by `agency_settings`.
   - Make `app/(public)/privacy/page.tsx` and `app/(public)/terms/page.tsx` query `agency_settings` dynamically.
   - Fix `components/planner/planner-context.tsx` long-term visa fallback rate (`68000`) and ensure public components use dynamic agency contact props.

## 2. Build Plan

- **Milestone 1**: Live Neon DB & `db/seed.ts` demo purge + 100% dynamic `lib/whatsapp/linked-device.ts` & inline `app/actions/quoting-copilot.ts`.
- **Milestone 2**: De-cluttered Admin Portal (`/admin/settings`, `/admin/campaigns`, `/admin/desk`, `/admin/studio`, `/admin`) & updated unit tests.
- **Milestone 3**: Centralized `lib/company-info.ts` & 100% dynamic Public Pages (`/`, `/privacy`, `/terms`, `hajj-inquiry-section.tsx`, `contact-section.tsx`, `public-header.tsx`, `public-footer.tsx`, `planner-context.tsx`).
