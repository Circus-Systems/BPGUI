# Phase 9: AdvertiserBrief UI

**Status:** Complete
**Date:** 2026-04-15

## Goal

The deliverable. One-click generate a web-viewable + PDF-exportable pitch deck for any advertiser.

## What was built

### Pages

- **`/brief`** — searchable brand picker (300 brands loaded). Filters by entity type (company / destination / industry_body). Cards show article count + mention total.
- **`/brief/[slug]`** — full scrollable deck with a period selector (90d → all-time) and Export PDF button.

Both pages sit under the authenticated layout, inherit the vertical selector, and use the new `Briefs` nav item.

### Slide components (`src/components/brief/`)

- `slide-shell.tsx` — common slide chrome with numbering + print CSS (`break-after-page`, min A4 height)
- `print-button.tsx` — invokes `window.print()` for browser PDF export
- `slides.tsx` — all 10 slides mapped from Tom's handwritten mock:

| # | Slide | Data source |
|---|-------|-------------|
| 1 | Title (brand, period, total AVE) | `coverage.summary` + `coverage.ave` |
| 2 | Editorial team | BPG_SOURCES constant (roster placeholder — Phase 10) |
| 3 | Editorial activity | `coverage.by_publication` |
| 4 | Reader authority | survey_results (Phase 10 placeholder) |
| 5 | Support for your brand (AVE) | `coverage.ave.by_source` |
| 6 | Example clippings | `coverage.top_articles` |
| 7 | People who supported your brand | `coverage.journalists` |
| 8 | Unique coverage + BPG-first rate | `coverage.unique_coverage` + `first_to_publish` |
| 9 | Spend vs coverage | `coverage.spend_vs_coverage` |
| 10 | Coverage timeline | `coverage.timeline` |

### PDF export

Uses browser print-to-PDF with CSS:
- `break-after-page` per slide
- `print:hidden` on controls, nav, period selector
- `print:min-h-[210mm]` for A4 sizing
- `print:p-0 print:rounded-none` for clean page edges

No external PDF library required for v1. If print rendering quality is inadequate in customer testing, swap to `@react-pdf/renderer` later.

## Validation (end-to-end, browser)

Logged into localhost:3030 as andrewjoyce84@hotmail.com. Navigated to `/brief`:
- 300 brand cards rendered
- Top entries: Qantas (690 articles), Virgin Australia (321), Emirates (257)
- Search + type filter work

Clicked through to `/brief/holland-america-line?name=Holland+America+Line` with "All-time" period selected:
- **164 total articles**
- **158 BPG coverage**
- **$598,500 AVE delivered**
- All 10 slides render; no console errors
- Period selector re-fetches payload correctly (switched 365d → 10000d → numbers updated)

TypeScript strict compilation passes (`npx tsc --noEmit` clean).

## Known gaps

These slides render empty/placeholder states until Phase 10 uploads land:
- Slide 2 (editorial team) — needs `journalists` table populated
- Slide 4 (authority) — needs `survey_results` populated
- Slide 7 (people) will prefer `journalists.headshot_url` over initials once available
- Slide 9 (spend vs coverage) — scatter is zero-on-spend-axis until `advertiser_spend` populated

None of these break the deck — every slide degrades cleanly with "loads from admin uploader" copy or zero-bar charts.

## Next phase

Phase 10 builds the admin uploaders (`/admin/journalists`, `/admin/events`, `/admin/spend`, `/admin/survey`, `/admin/ave-rates`) so Matt Vince and team can populate the remaining slides without DB access.
