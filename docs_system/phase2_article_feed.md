# Phase 2: Article Feed & Search

**Status:** Complete
**Date:** 2026-04-14

## What Was Built

### API Routes

**`GET /api/articles`** — Main article endpoint with query parameters:
- `vertical` — resolves to source_id list via `VERTICAL_SOURCES`
- `search` — ILIKE filter on title and excerpt
- `source` — filter to single publication slug
- `dateRange` — `24h`, `7d`, `30d`, or `all`
- `sponsored` — `yes`, `no`, or `all`
- `offset` / `limit` — pagination (max 100 per request)

Returns `{ articles, hasMore }`. No total count (too slow on 335K articles).

**`GET /api/publications`** — Returns publications for a vertical, used to populate the source dropdown filter.

### Page: `/articles`
Client component with debounced search, filter state, and "Load more" pagination. Resets and refetches when vertical or filters change.

### Components

- **`filter-bar.tsx`** — Search input, date range pill buttons (All time / 24h / 7d / 30d), source dropdown, sponsored content filter
- **`article-card.tsx`** — Compact card showing colored source dot, source name, relative time, title (2-line clamp), excerpt (2-line clamp), author, word count, categories, sponsored badge
- **`article-detail.tsx`** — Slide-over panel from right. Shows full title, author, date, word count, category tags, "View original article" link, and content text/excerpt
- **`summary-stats.tsx`** — Created but not used (count queries too slow for 335K articles). Can be re-enabled with materialized views later.

## File Structure (Phase 2 additions)

```
src/
├── app/
│   ├── api/
│   │   ├── articles/route.ts
│   │   └── publications/route.ts
│   └── (authenticated)/
│       └── articles/page.tsx
└── components/
    └── articles/
        ├── article-card.tsx
        ├── article-detail.tsx
        ├── filter-bar.tsx
        └── summary-stats.tsx
```

## Performance Notes

- Supabase has **335K articles** (much more than the 10K in local SQLite — full backfill ran)
- Removed `count: "exact"` from main query — it causes timeouts on large tables
- No summary stats queries (3x COUNT on 335K rows was 11+ seconds)
- Article list query is fast (<1s) because it uses `ORDER BY published_at DESC LIMIT 30` which hits the `idx_articles_published` index

## Verification Results

| Check | Result |
|-------|--------|
| Articles load for Travel vertical | Pass — Travel Weekly, Travel Daily, etc. |
| Articles load for Pharmacy vertical | Pass — AJP, Pharmacy Daily |
| Switching vertical changes articles | Pass |
| Search filters by title/excerpt | Pass |
| Date range filter (24h/7d/30d/all) works | Pass |
| Source dropdown filters to single pub | Pass |
| Load more pagination works | Pass |
| Article detail panel opens on click | Pass |
| Detail shows title, author, date, categories, link | Pass |
| Close button dismisses detail panel | Pass |

## Known Limitations

1. No total article count displayed (removed for performance)
2. HTML entities in some excerpts (e.g. `&#8217;` for apostrophe) — would need server-side decoding
3. Summary stats cards created but disabled — need materialized views or background aggregation for fast counts
