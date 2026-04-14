# Phase 5: Collector Health Dashboard

**Status:** Complete
**Date:** 2026-04-14

## What Was Built

### API Routes

**`GET /api/health/summary`** — Per-collector health overview (no query parameters, shows all 13 collectors regardless of vertical):
- Fetches publications, recent run_history (500 rows), and recent articles (500 rows)
- Builds per-collector summary: health_status (healthy/warning/error/unknown), last_run details, last_article_at, runs_24h, success_rate_24h
- Health logic: "healthy" = last run success and within 24h, "warning" = success but stale, "error" = last run failed, "unknown" = no run data
- Returns `{ collectors, summary: { total, healthy, warning, error } }`

**`GET /api/health/runs`** — Run history timeline with query parameters:
- `collector` — optional filter to single collector_id
- `limit` — max runs to return (default 50, max 200)

Returns `{ runs }` ordered by started_at DESC.

### Page: `/health`

Client component (no vertical filtering — shows all 13 collectors):
- **Summary KPIs** — Total collectors, healthy (green), warning (amber), error (red)
- **Collector grid** — Clickable cards for all 13 collectors with status dot, last run info, article freshness, 24h run stats, vertical badge
- **Run timeline** — Chronological list of recent runs, filtered by selected collector

Clicking a collector card toggles selection and filters the run timeline. Click again to deselect and show all runs.

### Components

- **`collector-grid.tsx`** — Responsive grid of collector cards with status-colored dots and borders. Shows last run time, items collected/new, latest article age, 24h run count with success rate. Vertical badge at bottom.
- **`run-timeline.tsx`** — Compact list of runs with status badge (success/error/partial), collector name, relative time, duration, items collected, and new item count highlighted in green.

## File Structure (Phase 5 additions)

```
src/
├── app/
│   ├── api/
│   │   └── health/
│   │       ├── summary/route.ts     -- collector health overview
│   │       └── runs/route.ts        -- run history timeline
│   └── (authenticated)/
│       └── health/page.tsx
└── components/
    └── health/
        ├── collector-grid.tsx
        └── run-timeline.tsx
```

## Design Decisions

1. **No vertical filtering** — Health dashboard shows all 13 collectors regardless of the active vertical toggle. This matches the operational nature of the page — you want to see everything at once.

2. **Health status derived from run_history** — No separate health/alerts table needed. Status is computed from last run's success/failure and recency (within 24h = healthy, older = warning).

3. **Click-to-filter pattern** — Clicking a collector card filters the run timeline to that collector. This avoids a separate detail page while still providing drill-down capability.

4. **Run timeline shows "partial" status** — Some collectors report "partial" status (e.g., Cruise Weekly collecting 10,603 items in 786s). The UI handles this gracefully with a neutral badge style.

## Verification Results

| Check | Result |
|-------|--------|
| Health page loads with all 13 collectors | Pass — 13 total, 9 healthy, 2 error |
| KPI cards show correct counts | Pass — healthy (green), warning (amber), error (red) |
| Collector cards show status dots | Pass — green for healthy, red for error |
| Last run info displayed | Pass — time ago, items collected, new items |
| Latest article freshness shown | Pass — relative timestamps |
| 24h run stats (count + success rate) | Pass — e.g., "17 runs (100% success)" |
| Vertical badges on cards | Pass — travel, cruise, pharmacy, luxury-travel |
| Click collector filters run timeline | Pass — filtered to selected collector |
| Click again deselects (shows all) | Pass |
| Run timeline shows status badges | Pass — success (green), failed (red), partial |
| Run duration displayed | Pass — seconds |
| Works independently of vertical selector | Pass — always shows all collectors |

## Data Observed

- 3,215 run_history records in Supabase
- Most collectors running ~17 times per 24h (matching poll intervals)
- KarryOn showing "failed" status — potential collection issue to investigate
- Cruise Weekly collecting large batches (10,603 items per run)
- Seatrade Cruise News has no run data — may not be syncing run_history yet
- TravelTalk also showing no run data
