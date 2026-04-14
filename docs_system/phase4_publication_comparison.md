# Phase 4: Publication Comparison

**Status:** Complete
**Date:** 2026-04-14

## What Was Built

### API Routes

**`GET /api/publications/stats`** — Per-publication metrics with query parameters:
- `vertical` — resolves to source_id list via `VERTICAL_SOURCES`
- `days` — time period (default 30)

Fetches up to 10,000 articles for the period and aggregates per source: article_count, avg_word_count, sponsored_pct, articles_per_day, last_published. Returns `{ stats, days }`.

**`GET /api/publications/timeline`** — Daily article counts per publication:
- `vertical` — resolves to source_id list
- `days` — time period (default 30)

Groups articles by date (YYYY-MM-DD) and source_id. Returns `{ timeline, days }` where each timeline entry has a date key and count per source_id — shaped for Recharts stacked BarChart.

### Page: `/publications`

Client component with:
- **Period filter** — 7 days / 30 days / 90 days pills (top right)
- **Summary KPIs** — Total articles, active sources (X / Y), avg word count
- **Volume chart** — Recharts stacked BarChart with per-source colors and legend
- **Comparison table** — Ranked table with articles, per day, avg words, sponsored %, volume bar
- **Publication cards** — Grid of per-publication stat cards

Both API calls fire in parallel (`Promise.all`). Data refetches when vertical or period changes.

### Components

- **`publication-card.tsx`** — Compact card with source color dot, article count, articles/day, avg words, sponsored %, last published timestamp
- **`volume-chart.tsx`** — Recharts `BarChart` with stacked bars per source, color-coded via `SOURCE_COLORS`, responsive container, legend with human-readable source labels
- **`comparison-table.tsx`** — Full-width table with colored dots, stats columns, and relative volume bar

## File Structure (Phase 4 additions)

```
src/
├── app/
│   ├── api/
│   │   └── publications/
│   │       ├── route.ts              -- existing (list publications)
│   │       ├── stats/route.ts        -- per-source metrics
│   │       └── timeline/route.ts     -- daily volume timeline
│   └── (authenticated)/
│       └── publications/page.tsx
└── components/
    └── publications/
        ├── publication-card.tsx
        ├── volume-chart.tsx
        └── comparison-table.tsx
```

## Design Decisions

1. **Recharts stacked BarChart** — First use of Recharts in the project. Stacked bars effectively show both total daily volume and per-source contribution. Legend uses `SOURCE_LABELS` for human-readable names.

2. **Parallel API calls** — Stats and timeline endpoints are independent, so the page fetches both with `Promise.all` for faster load.

3. **Period filter instead of date picker** — Simple pill buttons (7d/30d/90d) match the dashboard style and avoid date picker complexity. The period param controls both stats and timeline.

4. **No single-publication deep-dive** — The planned `[slug]` route was deferred. The comparison table and cards provide sufficient per-publication detail. Can be added later if needed.

## Verification Results

| Check | Result |
|-------|--------|
| Publications page loads for Travel | Pass — 1,000 articles from 7/12 sources (30d) |
| Stacked bar chart renders | Pass — all active sources color-coded |
| Comparison table shows ranked sources | Pass — Travel Daily, Travel Weekly, Travel Monitor... |
| Publication cards show per-source stats | Pass — article count, per day, avg words, sponsored % |
| 7-day period filter | Pass — 398 articles from 6 sources |
| 30-day period filter (default) | Pass |
| Pharmacy vertical toggle | Pass — 69 articles from 2/2 sources |
| Pharmacy shows AJP with 12% sponsored | Pass — competitive insight visible |
| Chart legend readable | Pass — source labels, not slugs |
| Volume bars in comparison table | Pass — relative bars per source |

## Known Limitations

1. Stats aggregation limited to 10,000 articles per period — sufficient for current data volume
2. No single-publication drill-down page (deferred)
3. 90-day view may include sparse data if collectors haven't been running that long
4. `articles_per_day` calculation uses earliest-to-latest span, not calendar days — can slightly overestimate for sources that don't publish daily
