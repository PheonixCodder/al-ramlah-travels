# 0030. Hybrid Hero Video and Admin Media Uploader: Decision Record

**Spec**: [index.md](./index.md)
**Date**: 2026-11-24

## Context

The public homepage hero (`HeroSlider` in `web/components/public/hero-slider.tsx`) currently renders static photography slides (`hero_slides.image_url`) managed from `/admin/catalog?tab=cms` (`web/components/admin/catalog/content-client.tsx` and `content-dialogs.tsx`). Two practical limitations hold back editorial quality and day to day operations:
1. **Static Only Hero Stage**: Pilgrims visiting `https://alramlahtravels.com` cannot experience calm ambient Haramain motion (such as Tawaf or Masjid an Nabawi courtyard footage) mixed alongside high resolution photography slides.
2. **Manual URL Entry Only in Admin CMS**: Creating or updating a hero slide in `HeroSlideDialog` currently requires pasting a prehosted external image URL by hand rather than uploading a poster photo or ambient video directly to Cloudflare R2 from the admin dialog.

Five architectural and governance constraints shape this design:
1. **Core Web Vitals and SSR Invariants (`CONST-SEO-05`, `Spec 0026`)**: Homepage initial SSR HTML must emit strictly one `<h1>`, strictly one initial `<img>` (`Slide 0` with `preload`, never the deprecated `next/image` attribute), zero `opacity: 0` inline styles at SSR rest (`sloplint` Gate `62`), and zero render blocking video downloads before Largest Contentful Paint completes. Also, `#journey-builder` in `web/app/(public)/page.tsx` and `web/components/planner/*` must remain untouched.
2. **Serverless Body Limits vs Local Parity (`OD-07`, `CONST-SEC-03`, `CONST-SEC-08`)**: Vercel serverless functions cap request bodies at `4.5 MB`, whereas short `1080p` ambient MP4 loops typically weigh `6 MB` to `20 MB`. At the same time, `/api/uploads/local` enforces a `25 MB` (`26,214,400` bytes) ceiling in `.env.audit` and local development, and routing all non production local fallback uploads in `lib/storage/r2.ts` to `os.tmpdir()/alramlah-r2-local` (served via streamed HTTP `206 Partial Content` on `/uploads/r2-local/[...key]`) prevents static route shadowing in `next dev` and keeps tracked `web/public/` clean (`T-013`).
3. **Binary Spoofing and Role Boundaries (`CONST-SEC-02`, `CONST-SEC-03`)**: `upsertHeroSlide`, `toggleHeroSlideActive`, `deleteHeroSlide`, and `reorderCmsEntities` are already restricted to `super_admin`, whereas `/api/uploads/presign` and `/api/uploads/local` currently allow any `staff` session (`enforceRouteAdminAuth`). Without folder specific role checks and server side `512` byte magic byte verification on commit, a non super admin session or a renamed `.html`/`.mov` upload could land under `cms/hero-slides/`.
4. **Bandwidth, Motion Sensitivity, and Decode Failures (`CONST-UI-03`, `CONST-UI-04`)**: Visitors on Pakistani cellular networks with Data Saver enabled (`navigator.connection?.saveData === true`), visitors with OS reduced motion enabled (`prefers-reduced-motion: reduce`), or browsers encountering a blocked autoplay or codec error must see the sharp poster image immediately with zero broken media icons and accessible pause controls (`>= 44x44px` touch target).
5. **Cloudflare R2 Storage Hygiene (`OD-06`)**: Replacing a hero video, clearing `video_url` back to photo only, or deleting a slide should remove superseded R2 objects under `cms/hero-slides/` without ever deleting external URLs or keys still shared by another slide row.

## Options considered

### Option 1: Nullable `video_url` on `hero_slides` + Super Admin `25 MB` Presigned R2 Upload with `512` Byte Commit Verification + Post Hydration `<video>` Crossfade Over Mandatory `next/image` Poster

Add a nullable `video_url` column (`chk_hero_slides_non_empty_video_url`) to `hero_slides` while keeping `image_url` `NOT NULL` as the mandatory poster and LCP frame. Gate `cms/hero-slides/*` presigning and local uploads strictly to `super_admin` (`<= 25 MB`, `video/mp4` for videos and `image/{jpeg,png,webp}` for posters), verify the first `512` bytes of managed `cms/hero-slides/` objects inside `upsertHeroSlide` via `readR2ObjectHeaderBytes()` + `sniffAllowedBinaryMagicBytes()`, and delete unreferenced `cms/hero-slides/` objects post commit. On the storefront, keep SSR output `100%` poster only and mount `<video muted playsInline>` after hydration (skipping video when `prefers-reduced-motion: reduce` or `saveData` is active), crossfading over the poster on `onPlaying`, advancing on `onEnded` with a `20s` ceiling (or looping when `1` slide is active) versus `7.5s` for photo slides, and exposing a `44x44px` `Pause` / `Play` button beside the slide arrows.

**Pros**:
- Preserves instant LCP and all existing SSR SEO/planner invariants (`0` `<video>` elements during SSR; `Slide 0` poster paints immediately via `next/image` `preload`).
- Bypasses Vercel's `4.5 MB` body limit via direct R2 presigned `PUT` URLs while keeping identical `25 MB` limits and `512` byte ISO BMFF `ftyp` / image magic byte enforcement across production R2, `next dev`, and `.env.audit` Playwright runs.
- Degrades cleanly to the mandatory `image_url` poster whenever `video_url` is `null`, reduced motion or Data Saver is active, or video playback fails.
- Keeps the data model minimal (`1` nullable column + `1` SQL `CHECK` constraint, `0` new tables or third party streaming vendors).

**Cons**:
- Requires `super_admin` editors to supply a poster image (`image_url`) even on video slides (which doubles as the LCP frame and fallback image).
- Caps hero video loops at `25 MB` MP4 rather than adaptive multi bitrate HLS streaming.

### Option 2: Third Party HLS Video Streaming Provider (Cloudflare Stream or Mux) + Separate `cms_media_assets` Table

Store uploaded videos in an external transcoding service (Mux or Cloudflare Stream), add a `cms_media_assets` table with webhook status polling (`processing` -> `ready`), and attach an HLS `.m3u8` player library (`hls.js`) inside `HeroSlider`.

**Pros**:
- Supports adaptive bitrate streaming and longer multi minute videos above `25 MB`.
- Can auto extract poster thumbnails server side after transcoding completes.

**Cons**:
- Introduces a new paid external vendor, new environment secrets, webhook signing endpoints, and asynchronous processing delays for a short `8` to `20` second ambient loop.
- Adds client bundle weight (`hls.js` on non Safari browsers) to the critical homepage route for minimal visual gain on short muted loops.

### Option 3: Multipart Server Action Upload + Immediate SSR `<video autoPlay>` Tag Without Required Poster

Upload MP4 files directly through a Next.js Server Action (`FormData`), make `image_url` optional when `video_url` is set, and render `<video autoPlay muted loop>` directly in SSR HTML on `Slide 0`.

**Pros**:
- Simplest form submission code (`1` request instead of `presign` + `PUT` + `upsertHeroSlide`).
- Editors do not need to pick a poster photo for video slides.

**Cons**:
- Fails with `413 Payload Too Large` in production on Vercel whenever an MP4 exceeds `4.5 MB`.
- Rendering `<video autoPlay>` in SSR without a `next/image` poster delays first visual paint on mobile networks and leaves an empty dark box whenever Data Saver, reduced motion, or low power mode blocks autoplay.

## Rationale

Option 1 is chosen because it delivers luxury ambient motion and one step admin cloud uploads using infrastructure already proven in this repository (`lib/storage/r2.ts`, `lib/storage/upload-security.ts`, and `db/schema/cms.ts`) with zero new external services or client bundle bloat. Keeping `image_url` `NOT NULL` alongside nullable `video_url` guarantees every slide paints an optimized `next/image` frame at `t = 0` on SSR, protecting homepage LCP and providing a zero layout shift fallback for reduced motion, `saveData`, and autoplay blocks.

Pairing `25 MB` `super_admin` presigned R2 `PUT` URLs with `readR2ObjectHeaderBytes(key, 512)` + `sniffAllowedBinaryMagicBytes()` inside `upsertHeroSlide` closes both the Vercel `4.5 MB` payload ceiling and the `/api/uploads/presign` role gap, ensuring `staff` accounts cannot mint `cms/hero-slides/` upload URLs and renamed non MP4 or polyglot payloads are rejected and deleted before touching PostgreSQL. Finally, adding a non production / `isAuditLocalE2eMode()` byte range reader route for `/uploads/r2-local/[...key]` lets Playwright E2E and local development stream uploaded `.mp4` files from `os.tmpdir()/alramlah-r2-local` identically to Cloudflare R2 without polluting tracked `web/public/` files.
