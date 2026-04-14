# BPGUI Build Plan

## Overview

BPG Intelligence Platform — a Next.js UI for competitive intelligence across Australian trade media (travel, cruise, pharmacy). Built on Supabase, deployed to Vercel. Architecture mirrors NordicPricingUI.

Phases 1–6 delivered a competitive-intelligence dashboard. Phases 7+ extend this to the **primary commercial deliverable** described by Tom Green: an auto-generated per-advertiser pitch deck ("AdvertiserBrief") that the sales team walks into annual meetings with.

## Phases

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| 1 | Foundation | **Complete** | Scaffolding, auth, layout, vertical provider, nav |
| 2 | Article Feed | **Complete** | Browsable, searchable article feed filtered by vertical |
| 3 | Entity Intelligence | **Complete** | Entity ranking, trends, drill-down, co-occurrence |
| 4 | Publication Comparison | **Complete** | Cross-publication competitive analysis dashboard |
| 5 | Collector Health | **Complete** | Operational monitoring for all 13 collectors |
| 6 | Briefing, Chat, Deploy | **Complete** | Morning briefing, AI chat agent, Vercel deployment |
| 7 | Data Foundation & Story Clustering | **Complete** | Schema for journalists/events/spend/survey/AVE; cross-publication story clustering |
| 8 | Brand Coverage API | **Complete** | Per-advertiser aggregation, unique coverage detection, AVE calculation |
| 9 | AdvertiserBrief UI | **Complete** | Deck preview, slide components, PDF export |
| 10 | Admin Uploaders | Pending | Journalist / events / spend / survey management UIs |
| 11 | Archive Chatbot | Pending | RAG over historical Travel Daily content for journalists |

## Verticals

Two UI verticals that group the 13 underlying publications:

- **Travel** — travel-weekly, karryon, travel-daily, latte, traveltalk, travel-monitor, travel-today-nz, global-travel-media, cruise-weekly, cruise-industry-news, seatrade-rss, travel-bulletin (12 sources)
- **Pharmacy** — ajp, pharmacy-daily (2 sources)

## Tech Stack

- Next.js 16 (App Router) + TypeScript strict + React 19
- Tailwind CSS 4 with custom design tokens
- Supabase SSR auth (3 clients: browser, server, middleware)
- Recharts for data visualization
- Vercel for deployment
- Anthropic Claude Sonnet 4 for chat + future archive RAG

## Supabase Project

- URL: `https://bqfhxzgcogczdmoqyywc.supabase.co`
- Auth user: `admin@bpg.com.au`, `andrewjoyce84@hotmail.com`
- RLS enabled on all public tables; SELECT policies for `authenticated` role on `articles`, `article_entities`, `publications`, `run_history`
- Collector writes use `service_role` key (bypasses RLS)

## Deployment

- **GitHub**: https://github.com/Circus-Systems/BPGUI
- **Vercel**: https://bpgui.vercel.app (production)
- Auto-deploys on push to `main`
- Env vars configured on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SKIP_MFA`

---

## Phase 7: Data Foundation & Story Clustering

**Goal:** Land the schema and background job that everything else in Phases 8–10 needs.

### Why

The per-advertiser pitch deck (Phase 9) needs three things the current schema doesn't support:

1. **Story clustering** — Tom's deck includes a "unique coverage" slide: stories WE ran that KO/TW did not. That requires matching the same underlying story across publications. No shared story ID exists across sources.
2. **People / events / spend data** — the deck shows journalist headshots, events attended, and advertiser spend-vs-coverage scatter. None of this exists yet.
3. **AVE config** — ad-value-equivalency dollar figures need a formula (rate card × article length, or similar).

### Schema Migrations

```sql
-- 1. Journalists roster (manual upload)
CREATE TABLE journalists (
  id            BIGSERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,          -- normalised match key
  source_id     TEXT NOT NULL,                 -- which publication they write for
  role          TEXT,                          -- editor / journalist / contributor
  years_exp     INTEGER,
  headshot_url  TEXT,
  bio           TEXT,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_journalists_source ON journalists(source_id);

-- 2. Events attended (manual Excel import)
CREATE TABLE events_attended (
  id            BIGSERIAL PRIMARY KEY,
  source_id     TEXT NOT NULL,
  event_name    TEXT NOT NULL,
  event_date    DATE NOT NULL,
  advertiser    TEXT,                          -- brand the event is associated with
  attended_by   TEXT,                          -- journalist name
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_advertiser ON events_attended(advertiser);
CREATE INDEX idx_events_date ON events_attended(event_date);

-- 3. Advertiser spend (from BPG Console - commercial data)
CREATE TABLE advertiser_spend (
  id            BIGSERIAL PRIMARY KEY,
  advertiser    TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  spend_aud     NUMERIC(12,2) NOT NULL,
  product       TEXT,                          -- display ad / newsletter / event sponsorship
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(advertiser, source_id, period_start, period_end, product)
);
CREATE INDEX idx_spend_advertiser ON advertiser_spend(advertiser);

-- 4. Reader survey results (qualitative)
CREATE TABLE survey_results (
  id            BIGSERIAL PRIMARY KEY,
  survey_name   TEXT NOT NULL,
  survey_date   DATE NOT NULL,
  question      TEXT NOT NULL,
  publication   TEXT NOT NULL,                 -- TD, KO, TW, etc.
  metric        TEXT NOT NULL,                 -- 'respected' / 'authoritative' / 'read_regularly'
  score         NUMERIC,                       -- % or rank
  sample_size   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Ad-value-equivalency config
CREATE TABLE ave_config (
  id            BIGSERIAL PRIMARY KEY,
  source_id     TEXT NOT NULL,
  metric        TEXT NOT NULL,                 -- 'article_standard' / 'article_feature' / 'social_post' / 'event'
  rate_aud      NUMERIC(10,2) NOT NULL,
  notes         TEXT,
  effective_from DATE DEFAULT CURRENT_DATE,
  UNIQUE(source_id, metric, effective_from)
);

-- 6. Story clusters (cross-publication dedup)
CREATE TABLE story_clusters (
  id                  BIGSERIAL PRIMARY KEY,
  cluster_key         TEXT UNIQUE NOT NULL,    -- deterministic hash of canonical title+date
  canonical_title     TEXT NOT NULL,
  first_published_at  TIMESTAMPTZ NOT NULL,
  dominant_entity     TEXT,                    -- the brand the story is "about"
  article_count       INTEGER DEFAULT 0,
  source_count        INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_clusters_entity ON story_clusters(dominant_entity);
CREATE INDEX idx_clusters_first_pub ON story_clusters(first_published_at);

-- 7. Article membership in clusters
CREATE TABLE article_cluster_members (
  cluster_id    BIGINT REFERENCES story_clusters(id) ON DELETE CASCADE,
  source_id     TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  similarity    REAL,                          -- confidence of match
  is_first      BOOLEAN DEFAULT false,         -- first to publish in cluster
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cluster_id, source_id, external_id)
);
CREATE INDEX idx_cluster_members_article ON article_cluster_members(source_id, external_id);

-- RLS policies (authenticated read)
ALTER TABLE journalists ENABLE ROW LEVEL SECURITY;
ALTER TABLE events_attended ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertiser_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ave_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_cluster_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON journalists FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON events_attended FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON advertiser_spend FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON survey_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON ave_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON story_clusters FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read" ON article_cluster_members FOR SELECT TO authenticated USING (true);
```

### Story Clustering Algorithm

Runs as a Postgres function callable via RPC or scheduled job. No external service.

**Signals:**
1. **Title trigram similarity** (pg_trgm): `similarity(a.title, b.title) > 0.35`
2. **Shared entities**: ≥2 `article_entities.entity_name` in common
3. **Time proximity**: `abs(a.published_at - b.published_at) < interval '72 hours'`

**Procedure:**
1. For each article without a cluster: find candidates using index-friendly queries (trgm GIN index on title + entity join)
2. If any candidate passes all three signals → add to existing cluster, else create new cluster
3. Update `story_clusters.article_count`, `source_count`, `first_published_at`, `is_first` flag
4. Dominant entity = highest-mention_count entity across all articles in cluster

**Database additions:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_articles_title_trgm ON articles USING gin (title gin_trgm_ops);
```

**RPC:**
```sql
CREATE OR REPLACE FUNCTION cluster_articles(lookback_days INT DEFAULT 7)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$ ... $$;
```

### Validation
1. Run `cluster_articles(30)` and confirm story_clusters populated
2. Spot-check: pick a known event (e.g., "Carnival returns to Port Vila") — verify CW + any competitor coverage joins same cluster
3. Query: for entity = "Carnival", count clusters WHERE only BPG sources appear → baseline for unique-coverage slide
4. Schema tables visible via Supabase; empty RLS-compatible reads return []

### Docs
- `docs_system/phase7_data_foundation.md`

---

## Phase 8: Brand Coverage API

**Goal:** Server-side aggregation that produces the numbers every slide in the deck needs.

### API Routes

- `GET /api/brands` — distinct advertiser/entity names with article counts (brand picker source)
- `GET /api/brand/[slug]/coverage?period=90d` — full deck payload for one advertiser:
  - `summary`: total articles, total words, avg article length, sponsored %
  - `by_publication`: article count, word count, post count, events count, AVE $ per source
  - `unique_coverage`: clusters covered only by BPG pubs (not KO/TW)
  - `shared_coverage`: clusters covered by BPG + competitor
  - `missed_coverage`: clusters covered by competitor but not BPG (gap list)
  - `first_to_publish_rate`: % of clusters where BPG was first
  - `timeline`: weekly article counts per publication
  - `top_articles`: 10 most-prominent articles mentioning the brand
  - `journalists`: which BPG journalists covered this brand most
  - `events`: events attended by BPG journalists tied to this brand
  - `spend_vs_coverage`: scatter data — advertiser_spend × article count per pub
  - `ave_total`: total ad-value-equivalency $

### AVE Formula

```
article_ave = count(articles) × source.rate_article
            + sum(case when word_count > 500 then feature_premium end)
social_ave  = count(posts) × source.rate_social
events_ave  = count(events) × source.rate_event
total_ave   = article_ave + social_ave + events_ave
```

Defaults seeded into `ave_config` (editable via Phase 10 admin UI).

### Validation
1. Hit `/api/brand/carnival/coverage?period=90d` → returns non-null summary, by_publication, unique_coverage
2. Manually verify one unique_coverage cluster (article in TD/CW, not in KO/TW)
3. AVE total equals manual calculation for a known brand

### Docs
- `docs_system/phase8_brand_coverage_api.md`

---

## Phase 9: AdvertiserBrief UI

**Goal:** The deliverable. One-click generate a web-viewable + PDF-exportable pitch deck for any advertiser.

### Page: `/brief/[slug]`

Renders the deck as a scrollable page, each slide a section. Print CSS makes PDF export clean via browser print-to-PDF.

### Slides (mapped from Tom's mock)

1. **Title** — Annual Meeting, [Brand name], [Period]
2. **Our editorial team** — journalist grid per BPG publication with years-experience totals
3. **Editorial activity LTM** — 3 bar charts (articles, social posts, events) BPG vs KO/TW
4. **Reader authority** — 2 bar charts from survey_results (most respected, most authoritative)
5. **Support for your brand** — 3 bar charts with AVE $ per pub (articles, social, events)
6. **Example clippings** — top 3 article cards with thumbnails/excerpts
7. **People who supported your brand** — journalist photos per pub with article counts for this brand
8. **Unique coverage** — stories only BPG ran (list with highlighted publications)
9. **Spend vs mentions scatter** — quadrant chart, "Your brand" marker
10. **Plans for next year** — editable placeholder, saved per-brand in DB

### Components
- `src/components/brief/slide-shell.tsx` — common slide layout
- `src/components/brief/team-slide.tsx`
- `src/components/brief/activity-slide.tsx`
- `src/components/brief/authority-slide.tsx`
- `src/components/brief/brand-support-slide.tsx`
- `src/components/brief/clippings-slide.tsx`
- `src/components/brief/people-slide.tsx`
- `src/components/brief/unique-coverage-slide.tsx`
- `src/components/brief/spend-scatter-slide.tsx`
- `src/components/brief/plans-slide.tsx`
- `src/components/brief/print-button.tsx` — invokes `window.print()`

### Brand Picker
- `/brief` index page — searchable list of all brands with article counts, click-through to `/brief/[slug]`

### PDF Export
- Print CSS: page breaks per slide, A4 landscape, no nav
- Alternative: `@react-pdf/renderer` if print CSS is inadequate (decide after visual test)

### Validation
1. `/brief/carnival` renders all 10 slides with real data
2. Print preview looks clean (landscape A4, one slide per page)
3. Numbers match `/api/brand/carnival/coverage` payload
4. Tested in Chrome with login → screenshot every slide

### Docs
- `docs_system/phase9_advertiser_brief.md`

---

## Phase 10: Admin Uploaders

**Goal:** Let Matt Vince and team maintain the non-article data without DB access.

### Pages

- `/admin/journalists` — CRUD grid with photo upload to Supabase Storage
- `/admin/events` — CSV upload with column mapping preview
- `/admin/spend` — CSV upload for advertiser spend from BPG Console export
- `/admin/survey` — form entry for periodic reader survey results
- `/admin/ave-rates` — editable rate card per source × metric

### Validation
1. Upload 5 journalists with headshots → appear in Phase 9 "people" slide
2. Upload events.csv → counts match brand coverage page
3. Upload spend.csv → scatter slide populated

### Docs
- `docs_system/phase10_admin_uploaders.md`

---

## Phase 11: Archive Chatbot (later)

**Goal:** Journalist productivity — Q&A over 20 years of Travel Daily content.

### Scope
- Embed all historical articles (OpenAI embeddings or local bge-small)
- Supabase pgvector for retrieval
- `/archive` chat page — same UI as main chat, but RAG-augmented
- Source citations on every response

### Deferred until Phases 7–10 land and business need is validated.

---

## Cross-Phase Notes

- **Supabase env vars** configured on Vercel and locally in `.env.local`
- **Collector on Mac Studio** uses service role key (bypasses RLS for writes)
- **Story clustering** is the critical unlock for Phase 9's "unique coverage" slide
- **Per-advertiser AVE** is what makes the deck commercially compelling to Tom
