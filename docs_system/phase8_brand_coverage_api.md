# Phase 8: Brand Coverage API

**Status:** Complete
**Date:** 2026-04-15

## Goal

Server-side aggregation that produces every number the AdvertiserBrief deck needs. All heavy lifting happens inside Postgres — the Next.js routes are thin RPC wrappers.

## What was built

### Postgres functions (migration `phase8_brand_coverage_fns`)

- **`list_brands(vertical_sources, entity_type_filter, min_articles, result_limit)`**
  Distinct brand entities across a vertical, with article counts and trigger mention totals. Used to populate the brand picker.

- **`brand_coverage(brand_name, bpg_sources, competitor_sources, period_days)`**
  Returns a single JSONB document containing every slide's data:
  - `summary` — total articles, words, avg length, sponsored count, BPG vs competitor article split
  - `by_publication` — per-source article/word/sponsored counts with `is_bpg` flag
  - `unique_coverage` — top 30 clusters covered only by BPG titles (the "unique coverage" slide)
  - `shared_coverage_count` — clusters covered by both BPG and competitor
  - `missed_coverage` — top 30 clusters covered only by competitors (gap list)
  - `first_to_publish` — within shared clusters, how often BPG was first
  - `timeline` — weekly articles per publication
  - `top_articles` — 10 most prominent BPG mentions
  - `journalists` — authors (from BPG) who wrote most about the brand
  - `events` — events attended matching the advertiser name
  - `spend_vs_coverage` — per BPG pub: spend_aud vs article_count (scatter)
  - `ave` — article AVE total + per-source breakdown (standard vs feature rates)

Both functions run with `SECURITY DEFINER` so authenticated reads work under RLS without extra policies on the private helpers.

### Next.js API routes

- **`GET /api/brands?vertical=travel&type=company&search=&limit=200`** — calls `list_brands` RPC, returns `{brands, totalCount}`
- **`GET /api/brand/[slug]/coverage?name=<brand>&period=365`** — calls `brand_coverage` RPC, returns the full JSONB payload

BPG vs competitor classification comes from new constants in `src/lib/constants.ts`:
- `BPG_SOURCES` — travel-daily, cruise-weekly, pharmacy-daily, travel-bulletin, latte
- `COMPETITOR_SOURCES` — karryon, travel-weekly, traveltalk, travel-monitor, travel-today-nz, global-travel-media, cruise-industry-news, seatrade-rss, ajp

## AVE formula

```
article_ave = SUM(
  CASE WHEN word_count > 500 THEN rate_feature
       ELSE rate_standard END
) across BPG articles mentioning brand
```

Rates resolved via `LATERAL` lookup against `ave_config` — most recent `effective_from` per (source, metric).

## Validation

Tested against real data:

- `brand_coverage('Holland America Line', ..., period=10000)` → 158 BPG articles, 6 competitor articles, $975k total word count
- `brand_coverage('Carnival', ..., period=90)` → returns structurally valid JSON even with only 3 matching articles
- Empty cases (e.g., Qantas at 90d) return zero-valued objects with empty arrays — no null-pointer risk downstream

TypeScript strict compilation passes (`npx tsc --noEmit` clean).

## Known limitations

- Entity extraction has run on ~9,300 of ~50,000 articles; brand lists at short time windows (30–90 days) will be sparse until the collector catches up.
- `events`, `advertiser_spend`, and `survey_results` tables are empty until Phase 10 admin UIs ship. Coverage payload returns `[]` for those keys in the meantime — UI slides degrade gracefully.
- `published_at` is still TEXT; all casts to timestamptz happen in the function bodies. Follow-up migration recommended.

## Next phase

Phase 9 consumes `/api/brand/[slug]/coverage` and renders the 10-slide deck at `/brief/[slug]`.
