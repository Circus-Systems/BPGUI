# Phase 6: Briefing & Chat

**Status:** Complete
**Date:** 2026-04-14

## What Was Built

### Morning Briefing (Home Page)

Replaced the placeholder home page with a vertical-aware intelligence briefing.

**`GET /api/briefing`** — Aggregated briefing data with query parameter:
- `vertical` — travel or pharmacy (default: travel)

Returns:
- `articlesToday` — articles published in last 24h
- `dailyAvg` — 7-day rolling daily average
- `activeSources` / `totalSources` — how many sources published today
- `sourceActivity` — per-source article counts for today
- `trendingEntities` — top 10 entities by article count across the vertical
- `highlights` — top 8 articles from last 24h (sorted by word count)

### Page: `/` (Home)

Client component with vertical-aware briefing:
- **Greeting** — time-of-day greeting with date and vertical name
- **Summary KPIs** — Articles Today (vs daily avg), Active Sources (x/total), Top Entities count
- **Top Entities panel** — ranked entity list with type badges (company/destination/industry_body), bar chart showing relative article count
- **Top Articles panel** — clickable article cards with source color dot, title, source name, relative time, word count, sponsored badge
- **Source Activity** — pill badges showing article counts per source for today

### Components

- **`summary-cards.tsx`** — 3-column KPI grid with conditional coloring (green if above average, amber for partial source coverage)
- **`trending-entities.tsx`** — Entity ranking with type badges, horizontal progress bars, article counts
- **`recent-highlights.tsx`** — Clickable article cards linking to source URLs, with source color dots, metadata, sponsored badges

---

### AI Chat Agent

Full-featured chat interface powered by Claude Sonnet 4 with database query tools.

**`POST /api/chat`** — Chat endpoint accepting `{ messages, vertical }`:
- Non-streaming: complete response returned as JSON
- Tool loop: up to 10 iterations for multi-step tool use
- Returns `{ content, rendered_outputs }` where rendered_outputs are charts/tables

**Tools:**
- **execute_sql** — Read-only SQL against Supabase via `execute_raw_sql` RPC function. SQL guardrails block writes, system schemas, and cap results at 1000 rows.
- **render_chart** — Recharts visualization (line, bar, pie) with title, data, axis configuration
- **render_table** — Sortable table with column definitions and formatting (text, number, date, percent)

**SQL Guardrails** (`src/lib/sql-guardrails.ts`):
- Validates queries start with SELECT or WITH
- Blocks INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, COPY
- Blocks system schemas (pg_catalog, information_schema, auth, storage, etc.)
- Blocks multiple statements
- Injects LIMIT 1000 if missing, caps existing limits

**Supabase RPC Function:**
```sql
CREATE OR REPLACE FUNCTION execute_raw_sql(query_text TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSONB;
BEGIN
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END; $$;
```

### Page: `/chat`

Client component with conversational UI:
- **Empty state** — title, subtitle, 4 suggestion prompt buttons
- **Message thread** — user messages (right, blue), assistant messages (left, bordered)
- **Markdown rendering** — bold, inline code parsed to JSX
- **Rendered outputs** — charts and tables rendered inline below message text
- **Input** — auto-growing textarea, Enter to send, Shift+Enter for newline
- **Loading state** — bouncing dots animation

### Components

- **`chat-message.tsx`** — Message bubble with role-based styling, markdown parsing, rendered output delegation
- **`chat-chart.tsx`** — Recharts wrapper supporting line, bar, and pie charts with 8-color palette
- **`chat-table.tsx`** — Sortable table with click-to-sort headers, cell formatting

## File Structure (Phase 6 additions)

```
src/
├── app/
│   ├── api/
│   │   ├── briefing/route.ts        -- morning briefing data
│   │   └── chat/route.ts            -- AI chat with tools
│   └── (authenticated)/
│       ├── page.tsx                  -- briefing home (replaced placeholder)
│       └── chat/page.tsx             -- chat UI
├── components/
│   ├── briefing/
│   │   ├── summary-cards.tsx
│   │   ├── trending-entities.tsx
│   │   └── recent-highlights.tsx
│   └── chat/
│       ├── chat-message.tsx
│       ├── chat-chart.tsx
│       └── chat-table.tsx
└── lib/
    ├── chat-tools.ts                 -- tool definitions for Claude
    └── sql-guardrails.ts             -- SQL validation + limit injection
```

## Verification Results

| Check | Result |
|-------|--------|
| Briefing loads with greeting + date | Pass — "Good evening, Tuesday 14 April 2026" |
| KPI cards show real data | Pass — 80 articles today, 6/12 sources, 10 entities |
| Top Entities shows ranked list | Pass — Holland America Line (115), Fincantieri (114) |
| Top Articles shows clickable cards | Pass — articles from Travel Weekly, LATTE, Cruise Industry News |
| Source Activity pills render | Pass — per-source counts |
| Vertical toggle updates briefing | Pass — switches between Travel & Pharmacy data |
| Chat page renders with suggestions | Pass — 4 suggestion buttons, input textarea |
| Chat sends message and shows response | Pass — "335,083 articles" response |
| Markdown bold renders in responses | Pass — bold text rendered as `<strong>` |
| SQL tool executes queries | Pass — article counts by source returned correctly |
| render_table renders sortable table | Pass — "Article Counts by Travel Publication" table |
| Loading dots show during response | Pass — 3 bouncing dots |
| Chat nav item appears | Pass — "Chat" added to navbar |

## Dependencies Added

- `@anthropic-ai/sdk` — Claude API client for chat
- `ANTHROPIC_API_KEY` env var required

## Design Decisions

1. **Non-streaming chat** — Complete response returned as JSON, matching NordicPricingUI pattern. Simpler to implement, and tool loops happen server-side in a single request cycle.

2. **Client-side message state** — No session persistence (no chat_sessions table). Messages live in React state. This keeps the implementation simple; session persistence can be added later if needed.

3. **Entity data scope** — Briefing shows top entities across the full dataset (not 24h) because entity extraction lags behind article collection. This provides useful data even when extraction hasn't caught up.

4. **SQL via RPC** — Created `execute_raw_sql` Postgres function in Supabase to enable raw SQL from the chat. SQL guardrails validate queries before execution.
