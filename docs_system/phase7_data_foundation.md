# Phase 7: Data Foundation & Story Clustering

**Status:** Complete
**Date:** 2026-04-15

## Goal

Land the schema and background job that everything else in Phases 8–10 needs: per-advertiser coverage aggregation, unique-coverage detection, and AVE calculation.

## What was built

### 1. Schema (7 new tables)

Applied via Supabase migration `phase7_data_foundation`:

- **`journalists`** — roster of editorial contributors per publication (manual upload; feeds "people who covered your brand" slide)
- **`events_attended`** — events BPG journalists attended, tagged to an advertiser where applicable
- **`advertiser_spend`** — commercial spend data imported from BPG Console (scatter slide + spend-vs-coverage)
- **`survey_results`** — reader survey scores per publication (authority / respect slides)
- **`ave_config`** — rate card per `(source_id, metric, effective_from)` driving AVE calculations
- **`story_clusters`** — one row per cross-publication story (canonical title, article count, source count, dominant entity)
- **`article_cluster_members`** — (cluster_id, source_id, external_id) membership with `is_first` flag

All seven tables have RLS enabled with an `authenticated_read` SELECT policy for the `authenticated` role. Service role writes bypass RLS.

### 2. Extensions & indexes

- Enabled `pg_trgm` extension
- GIN trigram index on `articles.title` for fast similarity candidate retrieval
- B-tree indexes on advertiser, date, entity, and source fields on the new tables

### 3. Clustering RPC

Function: `cluster_articles(lookback_days INT DEFAULT 7, reset BOOLEAN DEFAULT false) RETURNS JSONB`

**Signals used (OR'd):**
- **Strong title match**: `similarity(a.title, b.title) >= 0.55`
- **Moderate title + shared entities**: `similarity >= 0.35` AND `>= 2` shared entity names
- Time window: `|a.published_at − b.published_at| < 72 hours`
- Excludes daily digest titles matching `^(PD|TD|CW|KO|TW) for ` (prevents cross-vertical false matches)

**Post-pass updates:**
- `story_clusters.article_count`, `source_count`, `first_published_at`
- `article_cluster_members.is_first` flag (earliest published in cluster)
- `story_clusters.dominant_entity` = highest total-mention entity across cluster members

### 4. AVE rate seed

16 default rates seeded into `ave_config`:

| Source | Standard | Feature | Social | Event |
|--------|---------:|--------:|-------:|------:|
| travel-daily | $2,500 | $5,000 | $500 | $10,000 |
| cruise-weekly | $2,000 | $4,000 | $400 | $8,000 |
| travel-bulletin | $1,500 | $3,000 | $300 | $6,000 |
| karryon | $1,800 | $3,500 | $350 | $7,000 |
| travel-weekly | $2,200 | $4,200 | $420 | $8,500 |
| pharmacy-daily | $1,800 | $3,600 | $350 | $6,500 |

Editable via Phase 10 admin UI.

## Validation

Ran `cluster_articles(30, true)` on 1,893 recent articles:

- **1,804 clusters** created
- **40 multi-article** clusters (2–4 articles each)
- **23 cross-source** clusters (stories covered by 2–3 publications)
- **36 seconds** runtime

**Spot-check passes** — genuine cross-pub stories clustered correctly:

- "Viking floats out Viking Libra, world's first hydrogen-powered cruise ship" → 3 sources (cruise-industry-news, latte, travel-weekly)
- "Oceania Cruises to Debut Floating Pastry Academy" → 3 sources
- "Qantas to axe lounge access for most Jetstar international passengers" → 2 sources
- "Virgin Australia wins World's Best Cabin Crew" → 2 sources
- "Watermark Group reopens maritime simulator centre" → cruise-industry-news + seatrade-rss

No false positives observed in the top 10 cross-source sample.

## Operational notes

- `articles.published_at` is stored as TEXT in Supabase; the function casts to `timestamptz` at every comparison. Consider a follow-up migration to convert the column type.
- The function is idempotent — unclustered articles only. Pass `reset := true` to rebuild from scratch after tuning signals.
- Expected to run as a nightly cron (Phase 10 wires this up) with `lookback_days := 7` for incremental clustering.

## Next phase

Phase 8 builds the Brand Coverage API on top of these tables: `/api/brand/[slug]/coverage` that reads `story_clusters` for unique-coverage detection and `advertiser_spend` + `ave_config` for the commercial numbers.
