-- P1/P2 foundation for the dashboard UX + Brief MVP. Applied to Supabase
-- project BPG on 2026-07-05 (via MCP); this file is the version-controlled
-- record. Three logical parts:
--   A. P2 Brief schema: brief_config (per-title deck config, 5 titles seeded),
--      sector_rivals (slide-11 competitor matrix; NCL demo row from the client
--      PDF), campaigns + campaign_insertions (slides 15/16 import target),
--      brief_recommendations (slide 17), events dedupe index. RLS on with
--      authenticated-read policies; writes via service-role admin routes.
--   B. P1/P2 RPCs: publication_stats_range / publication_timeline_range
--      (custom date ranges, asks 1/9/10), article_story_flags (exclusive /
--      first-to-publish badges, ask 2), brand_sov_by_category (slide 11),
--      advertising_sov (slide 12).
--   C. brand_coverage AVE reframe: the promotional-value figure now counts
--      EARNED editorial only (is_sponsored = 0 in both ave aggregates) and
--      returns ave.earned_only = true.

-- ============================= A. schema =============================

create table if not exists public.brief_config (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title_name text not null,
  vertical text not null,
  primary_source text not null,
  bpg_sources text[] not null,
  media_competitors text[] not null,
  all_competitors text[] not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into brief_config (slug, title_name, vertical, primary_source, bpg_sources, media_competitors, all_competitors) values
  ('travel-daily','Travel Daily','travel','travel-daily',
   array['travel-daily','cruise-weekly','pharmacy-daily','travel-bulletin','latte'],
   array['karryon','travel-weekly'],
   array['karryon','travel-weekly','traveltalk','travel-monitor','travel-today-nz','global-travel-media','cruise-industry-news','seatrade-rss','ajp']),
  ('cruise-weekly','Cruise Weekly','cruise','cruise-weekly',
   array['travel-daily','cruise-weekly','pharmacy-daily','travel-bulletin','latte'],
   array['cruise-industry-news','seatrade-rss'],
   array['karryon','travel-weekly','traveltalk','travel-monitor','travel-today-nz','global-travel-media','cruise-industry-news','seatrade-rss','ajp']),
  ('pharmacy-daily','Pharmacy Daily','pharmacy','pharmacy-daily',
   array['travel-daily','cruise-weekly','pharmacy-daily','travel-bulletin','latte'],
   array['ajp'], array['ajp']),
  ('latte','LATTE','luxury-travel','latte',
   array['travel-daily','cruise-weekly','pharmacy-daily','travel-bulletin','latte'],
   array['karryon','travel-weekly'],
   array['karryon','travel-weekly','traveltalk','travel-monitor','travel-today-nz','global-travel-media','cruise-industry-news','seatrade-rss','ajp']),
  ('travel-bulletin','Travel Bulletin','travel','travel-bulletin',
   array['travel-daily','cruise-weekly','pharmacy-daily','travel-bulletin','latte'],
   array['karryon','travel-weekly'],
   array['karryon','travel-weekly','traveltalk','travel-monitor','travel-today-nz','global-travel-media','cruise-industry-news','seatrade-rss','ajp'])
on conflict (slug) do nothing;

create table if not exists public.sector_rivals (
  id bigint generated always as identity primary key,
  brand_canonical text not null unique,
  rivals text[] not null,
  sector text,
  source_of_truth text not null default 'demo',
  created_at timestamptz not null default now()
);
insert into sector_rivals (brand_canonical, rivals, sector, source_of_truth)
values ('Norwegian Cruise Line', array['Royal Caribbean','Carnival'], 'cruise', 'demo')
on conflict (brand_canonical) do nothing;

create table if not exists public.campaigns (
  id bigint generated always as identity primary key,
  brand text not null,
  name text not null,
  period_start date,
  period_end date,
  spend_aud numeric,
  bonus_ad_value text,
  estimated_reach bigint,
  creative_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_insertions (
  id bigint generated always as identity primary key,
  campaign_id bigint not null references public.campaigns(id) on delete cascade,
  run_date date not null,
  source_id text not null,
  ad_type text,
  page_position text,
  est_readership integer,
  clicks integer,
  notes text,
  created_at timestamptz not null default now(),
  unique (campaign_id, run_date, source_id, ad_type, page_position)
);

create table if not exists public.brief_recommendations (
  id bigint generated always as identity primary key,
  host_slug text not null default 'travel-daily',
  brand text not null,
  content_md text not null default '',
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (host_slug, brand)
);

create unique index if not exists events_attended_dedupe_uidx
  on public.events_attended (source_id, event_name, event_date, coalesce(advertiser,''));

alter table public.brief_config enable row level security;
alter table public.sector_rivals enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_insertions enable row level security;
alter table public.brief_recommendations enable row level security;
create policy authenticated_read_brief_config on public.brief_config for select to authenticated using (true);
create policy authenticated_read_sector_rivals on public.sector_rivals for select to authenticated using (true);
create policy authenticated_read_campaigns on public.campaigns for select to authenticated using (true);
create policy authenticated_read_campaign_insertions on public.campaign_insertions for select to authenticated using (true);
create policy authenticated_read_brief_recommendations on public.brief_recommendations for select to authenticated using (true);

-- ============================= B. RPCs =============================

CREATE OR REPLACE FUNCTION public.publication_stats_range(p_sources text[], p_from date, p_to date)
 RETURNS TABLE(source_id text, article_count bigint, avg_word_count integer, sponsored_pct numeric, articles_per_day numeric, last_published timestamptz, earliest_published timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH base AS (
    SELECT a.source_id, to_ts_immutable(a.published_at) AS pub_at, a.word_count, a.is_sponsored
    FROM articles a
    WHERE a.source_id = ANY(p_sources)
      AND to_ts_immutable(a.published_at) >= p_from::timestamptz
      AND to_ts_immutable(a.published_at) < (p_to + 1)::timestamptz
  )
  SELECT b.source_id, COUNT(*)::BIGINT,
         COALESCE(ROUND(AVG(b.word_count))::INT, 0),
         COALESCE(SUM(CASE WHEN b.is_sponsored = 1 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*),0), 0),
         ROUND((COUNT(*)::NUMERIC / GREATEST(1, CEIL(EXTRACT(EPOCH FROM (MAX(b.pub_at) - MIN(b.pub_at))) / 86400.0))) * 10) / 10,
         MAX(b.pub_at), MIN(b.pub_at)
  FROM base b GROUP BY b.source_id ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.publication_timeline_range(p_sources text[], p_from date, p_to date)
 RETURNS TABLE(date date, source_id text, article_count bigint)
 LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT to_ts_immutable(a.published_at)::date, a.source_id, COUNT(*)::BIGINT
  FROM articles a
  WHERE a.source_id = ANY(p_sources)
    AND to_ts_immutable(a.published_at) >= p_from::timestamptz
    AND to_ts_immutable(a.published_at) < (p_to + 1)::timestamptz
  GROUP BY 1, 2 ORDER BY 1 ASC;
$$;

CREATE OR REPLACE FUNCTION public.article_story_flags(p_keys text[])
 RETURNS TABLE(key text, cluster_id bigint, cluster_sources integer, exclusive boolean, is_first boolean)
 LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT m.source_id || '|' || m.external_id AS key,
         m.cluster_id,
         sc.source_count,
         (sc.source_count = 1) AS exclusive,
         (m.is_first AND sc.source_count > 1) AS is_first
  FROM article_cluster_members m
  JOIN story_clusters sc ON sc.id = m.cluster_id
  WHERE m.source_id || '|' || m.external_id = ANY(p_keys);
$$;

CREATE OR REPLACE FUNCTION public.brand_sov_by_category(p_brand text, p_rivals text[], p_sources text[], p_days integer DEFAULT 365)
 RETURNS TABLE(brand text, source_id text, article_count bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - (p_days || ' days')::interval;
  v_name text;
  v_brand_id bigint;
  v_aliases text[];
BEGIN
  FOREACH v_name IN ARRAY (ARRAY[p_brand] || p_rivals) LOOP
    SELECT ba.brand_id INTO v_brand_id FROM brand_aliases ba
     WHERE lower(ba.alias) = lower(v_name) LIMIT 1;
    IF v_brand_id IS NOT NULL THEN
      SELECT array_agg(alias) INTO v_aliases FROM brand_aliases WHERE brand_id = v_brand_id;
    ELSE
      v_aliases := ARRAY[v_name];
    END IF;

    RETURN QUERY
    SELECT v_name, ae.source_id, COUNT(DISTINCT ae.external_id)::bigint
    FROM article_entities ae
    WHERE (ae.canonical_id = v_brand_id OR ae.entity_name = ANY(v_aliases))
      AND ae.published_at_ts >= cutoff
      AND ae.source_id = ANY(p_sources)
    GROUP BY ae.source_id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.advertising_sov(p_brand text, p_rivals text[], p_sources text[], p_days integer DEFAULT 365)
 RETURNS TABLE(advertiser text, spend_aud numeric, insertion_periods bigint)
 LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT n.name AS advertiser,
         COALESCE(SUM(s.spend_aud), 0) AS spend_aud,
         COUNT(s.id)::bigint AS insertion_periods
  FROM unnest(ARRAY[p_brand] || p_rivals) AS n(name)
  LEFT JOIN advertiser_spend s
    ON s.advertiser ILIKE '%' || n.name || '%'
   AND s.source_id = ANY(p_sources)
   AND s.period_end >= (now() - (p_days || ' days')::interval)::date
  GROUP BY n.name
  ORDER BY spend_aud DESC;
$$;

-- ============================= C. AVE reframe =============================
-- brand_coverage re-applied with is_sponsored = 0 added to both 'ave'
-- aggregates + ave.earned_only = true. Full definition in the applied
-- migration 'brand_coverage_ave_earned_only' (supabase migration history);
-- see 20260701_phase0_brand_coverage_alias_aware.sql for the base version.
