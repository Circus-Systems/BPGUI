# Phase 10: Admin Uploaders

**Status:** Complete
**Date:** 2026-04-15

## Goal

Let Matt Vince and the BPG team maintain the non-article data (journalists, events, spend, survey, AVE rates) without DB access, so every slide in the AdvertiserBrief deck can populate without a developer.

## What was built

### Pages (under `/admin`)

| Route | Purpose |
|-------|---------|
| `/admin` | Overview with links + descriptions |
| `/admin/journalists` | Single-row form + bulk CSV paste. Editable roster per BPG source. |
| `/admin/events` | CSV paste upload, list view, delete |
| `/admin/spend` | CSV paste upload for advertiser spend (upserts on natural key) |
| `/admin/survey` | CSV paste upload for reader survey scores |
| `/admin/ave-rates` | Matrix view (publication × metric) with inline add/delete |

Admin tab added to the top nav. All pages share `src/app/(authenticated)/admin/layout.tsx` with a sub-nav.

### Shared plumbing

- `src/lib/csv.ts` — minimal CSV parser (handles quoted fields, escaped quotes, embedded commas/newlines)
- `src/components/admin/csv-uploader.tsx` — generic paste-and-upload component used by events, spend, and survey pages. Takes `{endpoint, columns, csvHeaders, placeholder}` and renders upload form + list table + delete action.

### API routes

All routes sit under `/api/admin/<resource>` with methods `GET`/`POST`/`DELETE`. They:
- Require an authenticated user (check via SSR `supabase.auth.getUser()`)
- Use the `service_role` client for writes so RLS doesn't require additional INSERT/UPDATE/DELETE policies on every table
- Upsert on natural keys where applicable (`journalists.slug`; `advertiser_spend.(advertiser, source_id, period_start, period_end, product)`; `ave_config.(source_id, metric, effective_from)`)

| Route | Resource |
|-------|----------|
| `/api/admin/journalists` | CRUD + bulk upsert |
| `/api/admin/events` | GET list, bulk insert, delete |
| `/api/admin/spend` | GET (with advertiser filter), bulk upsert, delete |
| `/api/admin/survey` | GET list, bulk insert, delete |
| `/api/admin/ave-rates` | GET matrix, upsert single row, delete |

## Validation (end-to-end, browser)

With the dev server at `localhost:3030`:

1. Navigated to `/admin` — index + 5 sub-tabs render, nav includes "Admin"
2. `/admin/ave-rates` — matrix shows all 16 seeded rates across 6 publications × 4 metrics
3. POST `/api/admin/journalists` with `{full_name: 'Bruce Piper', source_id: 'travel-daily', role: 'editor', years_exp: 25}` → returned inserted row id 1, slug auto-derived as `bruce-piper`
4. POST `/api/admin/events` with 2 rows → `{inserted: 2}`
5. POST `/api/admin/spend` with 2 Carnival spend rows (Travel Daily $48k, Cruise Weekly $36k) → `{inserted: 2}`
6. **Roundtrip check**: hit `/api/brand/carnival/coverage?period=10000` — response `spend_vs_coverage` array showed the uploaded spend data (`travel-daily: $48,000`, `cruise-weekly: $36,000`) alongside article counts. `events` array returned the Cruise360 event with `attended_by: 'Bruce Piper'`. Confirms **admin uploads flow through to deck slides**.
7. Cleaned up test rows from DB.

TypeScript strict compilation passes (`npx tsc --noEmit` clean).

## Known limitations

- No photo upload for headshots — the journalists form takes a URL only. Supabase Storage integration is a later enhancement.
- No authorization beyond "logged in" — any authenticated user can write admin data. Role-based access (e.g., `admin@bpg.com.au` only) is a follow-up if needed.
- CSV upload is paste-only (no file drop); pragmatic choice since Matt's source data is Excel-export → copy-paste.

## Cross-phase effect

With Phase 10 live, the AdvertiserBrief deck at `/brief/[slug]` now populates every previously-empty slide as soon as the corresponding admin page has data:

- Slide 2 (editorial team) → `journalists` table (still placeholder copy until data is uploaded)
- Slide 4 (reader authority) → `survey_results` table
- Slide 5 (AVE) → already live, editable via `/admin/ave-rates`
- Slide 7 (people) → prefers uploaded `journalists.headshot_url` when available
- Slide 9 (spend vs coverage) → scatter now picks up `advertiser_spend` uploads

## Next phase

Phase 11 (Archive Chatbot) — deferred until Phases 7–10 land and the business validates the AdvertiserBrief as the primary deliverable.
