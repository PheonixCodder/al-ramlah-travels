# Next.js Business SEO & AI-Search (GEO) Audit Report

- **Project Directory:** `C:\dev\al-ramlah-travels\web`
- **Live URL Audited:** `Static Codebase Audit Only`
- **Overall SEO & GEO Score:** **54.5/100** (Grade: **D**)

## 1. 6-Pillar Weighted Score Breakdown

| Pillar | Score | Max | Key Focus |
|---|---:|---:|---|
| **1. Technical SEO, Crawlability & CWV** | 11.9 | 20 | `metadataBase`, `sitemap.ts`, `robots.ts`, RSC vs `'use client'`, `<Image>` |
| **2. Meta Tags, URLs & CTR Optimization** | 7.4 | 15 | 50–60 char titles, 150–160 char descriptions, OG/Twitter, kebab-case URLs |
| **3. Business Hub-and-Spoke & ≥50% Rule** | 13.0 | 15 | Dedicated service/location spokes, ≥50% content differentiation |
| **4. Entity SEO, NAP & JSON-LD Schema** | 6.0 | 15 | 100% identical NAP, social `sameAs` verification, JSON-LD blocks |
| **5. AI Search (GEO) Liftability & Authority** | 10.2 | 20 | <200w paragraphs, bullets, tables, stats, human substance, fan-out queries |
| **6. Internal Linking & Orphan Prevention** | 6.0 | 15 | Zero orphan routes, contextual `<Link>` graph, Jev link candidates |
| **TOTAL** | **54.5** | **100** | |

## 2. Priority Action Plan (P0 Blockers → P1 High-Impact → P2 Growth)

- **[P0] (Technical SEO)** Missing sitemap configuration (create app/sitemap.ts)
- **[P0] (Technical SEO)** Missing robots configuration (create app/robots.ts)
- **[P1] (Technical / Architecture)** No public/llms.txt found (optional AI discovery summary file)
- **[P1] (Entity & NAP)** Multiple phone number formats found across codebase (['050 123 4567', '1 050 123 4567', '+1 (555) 234-5678', '(312) 555-0199', '312-555-0199', '+1 (555) 123-4567', '092 327 4029', '+1 (312) 555-0199', '+1-416-555-0198', '+1 (416) 555-0198']). Standardize to one exact string everywhere for strict NAP consistency (Lesson 2).
- **[P1] (Internal Linking)** Add contextual <Link> references to 21 orphan routes (/admin/login, /admin, /admin/campaigns, /admin/catalog, /admin/content) (Video 1 Lesson 7).

## 3. Transactional Keywords, Hidden AI Fan-Out & Expert Queries

### Transactional Customer Keywords (Lesson 1: Chase Customers, Not Traffic)
- `umrah packages from lahore services for hajj and umrah travel agency`
- `hajj and umrah travel agency umrah packages from lahore company in United States`
- `hire umrah packages from lahore specialist for hajj and umrah travel agency`
- `umrah packages from lahore pricing and packages for hajj and umrah travel agency`
- `enterprise umrah packages from lahore provider United States`

### Hidden AI Fan-Out Queries to Answer in Content (Lesson 9)
- **Cost & ROI Mechanics:** What is the average cost of umrah packages from lahore for a hajj and umrah travel agency business in United States and what drives pricing?
- **Methodology Comparison (X vs Y):** In-house umrah packages from lahore vs dedicated hajj and umrah travel agency umrah packages from lahore agency: pros, cons, and break-even point
- **Compliance & Risk Factors:** What compliance, security, or operational mistakes do hajj and umrah travel agency companies make with umrah packages from lahore?
- **Implementation Timeline & Deliverables:** What does a 90-day umrah packages from lahore implementation roadmap look like for hajj and umrah travel agency?
- **Vendor Evaluation Criteria:** What specific credentials, case studies, and SLAs should a hajj and umrah travel agency buyer verify before hiring for umrah packages from lahore?
- **Edge Cases & Multi-Location Scaling:** How do multi-location hajj and umrah travel agency businesses standardize umrah packages from lahore across regional branches?

### Expert-Only Citation Queries (Neil Patel Tip 5)
- *How a 10-to-50 location hajj and umrah travel agency group should structure umrah packages from lahore workflows across local branches in United States*
- *Step-by-step umrah packages from lahore architecture for regulated hajj and umrah travel agency teams handling legacy migration constraints*
- *Real-world umrah packages from lahore cost-per-acquisition benchmarks for mid-market hajj and umrah travel agency companies (United States case study)*

## 4. Top Internal Link Opportunities (`internal-links` + Jev)

| Source Route | Recommended Target Route | Matched Terms | Priority Score |
|---|---|---|---:|
| `/admin/campaigns` | `/admin/supplier-flyers` | admin, flyers, supplier | 1.05 |
| `/admin/studio` | `/admin/supplier-flyers` | admin, flyers, supplier | 1.05 |
| `/admin/login` | `/admin/post-lookup` | admin, post | 0.8 |
| `/admin/login` | `/admin/content` | admin, content | 0.8 |
| `/admin/applications` | `/admin/desk` | admin, desk | 0.8 |
| `/admin/applications/[id]` | `/admin/settings` | admin, settings | 0.8 |
| `/admin/applications/[id]` | `/admin/supplier-flyers` | admin, supplier | 0.8 |
| `/admin/applications/[id]` | `/admin/hotels` | admin, hotels | 0.8 |
| `/admin/applications/[id]/voucher` | `/admin/ziyarat` | admin, ziyarat | 0.8 |
| `/admin/applications/[id]/voucher` | `/admin/visa` | admin, visa | 0.8 |
