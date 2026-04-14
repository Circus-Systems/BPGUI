# Phase 3: Entity Intelligence

**Status:** Complete
**Date:** 2026-04-14

## What Was Built

### Supabase Migration

Created `article_entities` table via Supabase migration (`add_article_entities_table_v2`):

```sql
CREATE TABLE article_entities (
    id              BIGSERIAL PRIMARY KEY,
    source_id       TEXT NOT NULL,
    external_id     TEXT NOT NULL,
    entity_name     TEXT NOT NULL,
    entity_type     TEXT NOT NULL,       -- company, destination, industry_body
    confidence      REAL,
    mention_count   INTEGER,
    in_title        INTEGER DEFAULT 0,
    sentiment       TEXT,
    created_at      TEXT NOT NULL,
    sync_status     TEXT NOT NULL DEFAULT 'pending',
    sync_retries    INTEGER NOT NULL DEFAULT 0,
    UNIQUE(source_id, external_id, entity_name)
);
CREATE INDEX idx_ae_source ON article_entities(source_id);
CREATE INDEX idx_ae_entity ON article_entities(entity_name);
CREATE INDEX idx_ae_type ON article_entities(entity_type);
```

21,422 entity mentions synced from BPG collector at time of build.

### API Routes

**`GET /api/entities`** — Aggregated entity ranking with query parameters:
- `vertical` — resolves to source_id list via `VERTICAL_SOURCES`
- `type` — filter by entity_type (`company`, `destination`, `industry_body`, or `all`)
- `search` — ILIKE filter on entity_name
- `offset` / `limit` — pagination (max 200 per request)

Fetches up to 10,000 raw rows and aggregates in JavaScript (Supabase JS client doesn't support GROUP BY). Returns `{ entities, totalCount, hasMore }` with fields: entity_name, entity_type, total_mentions, article_count, avg_confidence, in_title_pct, top_sentiment.

**`GET /api/entities/[name]`** — Entity detail with query parameter:
- `vertical` — resolves to source_id list

Returns entity overview with:
- Associated articles (up to 50, ordered by published_at DESC)
- Co-occurring entities (top 15 entities that appear in the same articles)
- Source distribution (mention count per publication)

Uses OR filter to fetch articles by `(source_id, external_id)` composite key pairs.

### Page: `/entities`

Client component with two-panel layout:
- **Left (2/3 width):** Entity ranking table with type filter pills, search input, and load more pagination
- **Right (1/3 width):** Entity detail panel showing source distribution, co-occurrences, and recent articles

Resets selection and refetches when vertical or filters change. Search is debounced at 400ms.

### Components

- **`entity-table.tsx`** — Sortable ranking table with columns: Entity (name), Type (colored badge), Mentions, Articles, Confidence. Click-to-select rows with highlight.
- **`entity-detail.tsx`** — Detail panel with:
  - Entity name, type badge, mention/article counts
  - Source distribution horizontal bar chart (colored by publication)
  - Co-occurring entities as tag pills with counts
  - Recent articles list with source labels and relative timestamps

## File Structure (Phase 3 additions)

```
src/
├── app/
│   ├── api/
│   │   └── entities/
│   │       ├── route.ts              -- entity ranking
│   │       └── [name]/route.ts       -- entity detail
│   └── (authenticated)/
│       └── entities/page.tsx
└── components/
    └── entities/
        ├── entity-table.tsx
        └── entity-detail.tsx
```

## Design Decisions

1. **In-memory aggregation** — Supabase JS doesn't support GROUP BY, so we fetch raw entity rows (up to 10K) and aggregate in the API route. This works well for the current 21K rows but may need an RPC function or materialized view if entity counts grow significantly.

2. **Two-panel layout** — Entity table on left, detail on right. This avoids the slide-over panel used in Articles and gives a more dashboard-like feel appropriate for entity exploration.

3. **No trends chart** — The planned mention-trend-chart was deferred. The current entity data doesn't have enough temporal spread to make daily trends meaningful. Can be added when more data accumulates.

4. **Co-occurrence via article overlap** — Co-occurring entities are found by querying all entities that share the same `(source_id, external_id)` articles, then counting unique co-appearances.

## Verification Results

| Check | Result |
|-------|--------|
| Entity table loads for Travel vertical | Pass — 232 entities, Holland America Line top |
| Entity table loads for Pharmacy vertical | Pass — entities change to pharmacy-relevant |
| Type filter (All/Company/Destination/Industry Body) | Pass — 298 destinations shown when filtered |
| Search filters entities | Pass — "qantas" returns 8 results |
| Clicking entity loads detail panel | Pass — source distribution, co-occurrences, articles |
| Source distribution shows colored bars | Pass — Cruise Weekly, Travel Weekly, etc. |
| Co-occurrence tags display | Pass — related entities with counts |
| Recent articles list with links | Pass — clickable article links |
| Vertical toggle changes entity data | Pass |
| Load more pagination | Pass |

## Known Limitations

1. In-memory aggregation caps at 10,000 rows — entities beyond this won't appear in rankings
2. No trend chart (deferred — insufficient temporal data currently)
3. Co-occurrence query is approximate — limited to first 100 article keys for performance
4. Entity names may have duplicates with slightly different casing (e.g., "Qantas" vs "QANTAS") — would need normalization at extraction time
