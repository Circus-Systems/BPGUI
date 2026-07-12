-- =====================================================================
-- Intel views data layer: brand_pub_month matview + 6 read RPCs
-- (brand_trend, sales_radar, coverage_gaps, cluster_detail,
--  pub_speed_report, publication_breadth)
--
-- Powers: Sales Radar page, Editorial Compare page, Brief coverage-slide
-- prominence split, Publications first-mover/breadth columns.
--
-- All queries validated read-only against live data before applying
-- (matview build 5.45s / 227k rows; RPCs 5ms-300ms warm).
--
-- Security: none of these names are among the 7 sensitive functions
-- watched by the security_anon_grants healthcheck tripwire, and this
-- migration does not touch those functions. Grants mirror the existing
-- public read-RPC posture (anon + authenticated + service_role).
--
-- NOTE: idx_ae_pub_canon was created OUT OF BAND (CREATE INDEX
-- CONCURRENTLY cannot run inside a transaction):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ae_pub_canon
--     ON public.article_entities (published_at_ts, canonical_id);
--
-- Data caveats the UI must respect:
--  * Story metrics (first_/exclusive_stories, gaps, speed, first_pct)
--    only exist since 2025-07-05 (cluster coverage window).
--  * brand_pub_month is canonical-only (~58% of mentions) and refreshed
--    daily at 03:15 -> brand_trend reads lower than brand_coverage and
--    can be up to 24h stale.
--  * travel-bulletin has epoch-dated rows -> floor month axes at 2005.
--  * brands.is_bpg_client is populated for 1/5012 brands - do not build
--    UI splits on it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- OBJECT 1 - MATERIALIZED VIEW brand_pub_month
-- Grain: canonical brand x source_id x month. canonical_id NOT NULL only.
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.brand_pub_month AS
WITH per_article AS (          -- dedup brand x article first (avoids DISTINCT sort)
  SELECT ae.canonical_id AS brand_id, ae.source_id, ae.external_id,
         date_trunc('month', ae.published_at_ts)::date AS month,
         max(ae.in_title)     AS in_title,
         sum(ae.mention_count) AS mc
  FROM public.article_entities ae
  WHERE ae.canonical_id IS NOT NULL AND ae.published_at_ts IS NOT NULL
  GROUP BY 1,2,3,4
),
ent AS (
  SELECT brand_id, source_id, month,
         count(*)                          AS articles,
         count(*) FILTER (WHERE in_title=1) AS title_articles,
         sum(mc)::bigint                   AS mentions
  FROM per_article GROUP BY 1,2,3
),
story_art AS (                 -- one row per brand x source x month x cluster
  SELECT ae.canonical_id AS brand_id, ae.source_id,
         date_trunc('month', ae.published_at_ts)::date AS month, sc.id AS cluster_id,
         bool_or(m.is_first AND sc.source_count > 1) AS is_first_multi,
         bool_or(sc.source_count = 1)                AS is_excl
  FROM public.article_entities ae
  JOIN public.article_cluster_members m ON m.source_id=ae.source_id AND m.external_id=ae.external_id
  JOIN public.story_clusters sc         ON sc.id = m.cluster_id
  WHERE ae.canonical_id IS NOT NULL AND ae.published_at_ts IS NOT NULL
  GROUP BY 1,2,3,4
),
stories AS (
  SELECT brand_id, source_id, month,
         count(*) FILTER (WHERE is_first_multi) AS first_stories,
         count(*) FILTER (WHERE is_excl)        AS exclusive_stories
  FROM story_art GROUP BY 1,2,3
)
SELECT ent.brand_id,
       COALESCE(b.vertical, p.vertical,     -- b.vertical is ~always NULL; source vertical is the useful value
         CASE ent.source_id WHEN 'travel-bulletin' THEN 'travel'
                            WHEN 'seatrade-rss'   THEN 'cruise' END) AS vertical,
       b.is_bpg_client,
       ent.source_id, ent.month,
       ent.articles, ent.title_articles, ent.mentions,
       COALESCE(s.first_stories, 0)     AS first_stories,
       COALESCE(s.exclusive_stories, 0) AS exclusive_stories
FROM ent
JOIN public.brands b        ON b.id = ent.brand_id
LEFT JOIN stories s         ON s.brand_id=ent.brand_id AND s.source_id=ent.source_id AND s.month=ent.month
LEFT JOIN public.publications p ON p.slug = ent.source_id
WITH DATA;

-- Unique index REQUIRED for REFRESH ... CONCURRENTLY
CREATE UNIQUE INDEX brand_pub_month_pk   ON public.brand_pub_month (brand_id, source_id, month);
CREATE INDEX        brand_pub_month_srcm ON public.brand_pub_month (source_id, month);
GRANT SELECT ON public.brand_pub_month TO anon, authenticated, service_role;  -- mirrors brand_stats

-- Daily refresh at 03:15, after brand_stats (03:00), before reconcile (03:30).
SELECT cron.schedule('refresh-brand-pub-month-daily', '15 3 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_pub_month$$);


-- ---------------------------------------------------------------------
-- OBJECT 2 - brand_trend(p_brand, p_sources, p_months=24)
-- Resolves name via brand_aliases exactly like brand_coverage.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_trend(
  p_brand text, p_sources text[], p_months int DEFAULT 24)
RETURNS TABLE(month date, source_id text, articles bigint, title_articles bigint, mentions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH bid AS (
    SELECT ba.brand_id FROM brand_aliases ba WHERE lower(ba.alias)=lower(p_brand) LIMIT 1)
  SELECT m.month, m.source_id, m.articles, m.title_articles, m.mentions
  FROM brand_pub_month m JOIN bid ON bid.brand_id = m.brand_id
  WHERE m.source_id = ANY(p_sources)
    AND m.month >= (date_trunc('month', now()) - make_interval(months => p_months-1))::date
  ORDER BY m.month, m.source_id;
$$;


-- ---------------------------------------------------------------------
-- OBJECT 3 - sales_radar(p_bpg_sources, p_competitor_sources, p_days=90)
-- Returns jsonb {momentum, whitespace, affinity, emerging}, <=25 each.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_radar(
  p_bpg_sources text[], p_competitor_sources text[], p_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH win AS MATERIALIZED (
    SELECT ae.canonical_id AS brand_id,
           (ae.source_id||'|'||ae.external_id) AS akey,
           ae.source_id, ae.published_at_ts AS ts,
           CASE ae.source_id
             WHEN 'ajp' THEN 'pharmacy'          WHEN 'pharmacy-daily' THEN 'pharmacy'
             WHEN 'cruise-weekly' THEN 'cruise'  WHEN 'cruise-industry-news' THEN 'cruise'
             WHEN 'seatrade-rss' THEN 'cruise'   WHEN 'latte' THEN 'luxury-travel'
             ELSE 'travel' END AS vert
    FROM article_entities ae
    WHERE ae.published_at_ts >= now() - make_interval(days => GREATEST(p_days,90))
      AND ae.entity_type IN ('company','industry_body')
      AND ae.canonical_id IS NOT NULL
      AND ae.source_id = ANY(p_bpg_sources || p_competitor_sources)
  ),
  winp AS (SELECT * FROM win WHERE ts >= now() - make_interval(days => p_days))
  SELECT jsonb_build_object(
    'generated_at', now(), 'window_days', p_days,

    'momentum', (
      SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.ratio DESC), '[]'::jsonb) FROM (
        SELECT COALESCE(b.display_name,b.canonical_name) AS brand, m.brand_id, m.vertical,
               b.is_bpg_client, m.recent_30, m.baseline_prior AS baseline,
               round(m.recent_30::numeric
                     / NULLIF(m.baseline_prior::numeric*30.0/GREATEST(p_days-30,1), 0), 2) AS ratio
        FROM (
          SELECT brand_id, mode() WITHIN GROUP (ORDER BY vert) AS vertical,
                 count(DISTINCT akey) FILTER (WHERE ts >= now()-interval '30 days') AS recent_30,
                 count(DISTINCT akey) FILTER (WHERE ts <  now()-interval '30 days') AS baseline_prior
          FROM winp GROUP BY brand_id
        ) m JOIN brands b ON b.id=m.brand_id
        WHERE m.baseline_prior >= 5 AND m.recent_30 >= 3
          AND m.recent_30::numeric/NULLIF(m.baseline_prior::numeric*30.0/GREATEST(p_days-30,1),0) >= 1.0
        ORDER BY ratio DESC LIMIT 25) t),

    'whitespace', (
      SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.competitor_articles DESC), '[]'::jsonb) FROM (
        SELECT COALESCE(b.display_name,b.canonical_name) AS brand, w.brand_id, w.vertical,
               b.is_bpg_client, w.competitor_articles, w.bpg_articles
        FROM (
          SELECT brand_id, mode() WITHIN GROUP (ORDER BY vert) AS vertical,
                 count(DISTINCT akey) FILTER (WHERE source_id = ANY(p_competitor_sources)) AS competitor_articles,
                 count(DISTINCT akey) FILTER (WHERE source_id = ANY(p_bpg_sources))        AS bpg_articles
          FROM winp GROUP BY brand_id
        ) w JOIN brands b ON b.id=w.brand_id
        WHERE w.competitor_articles >= 5 AND w.bpg_articles = 0
        ORDER BY w.competitor_articles DESC LIMIT 25) t),

    'affinity', (
      SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.over_index DESC), '[]'::jsonb) FROM (
        SELECT COALESCE(b.display_name,b.canonical_name) AS brand, bs.brand_id,
               bs.source_id AS competitor_source, v.vertical, b.is_bpg_client,
               bs.b_src AS source_articles,
               round((bs.b_src::numeric/st.src_total)/NULLIF(bo.b_all::numeric/ov.all_total,0),2) AS over_index
        FROM (SELECT brand_id, source_id, count(DISTINCT akey) b_src FROM winp GROUP BY 1,2) bs
        JOIN (SELECT source_id, count(DISTINCT akey) src_total FROM winp GROUP BY 1) st USING(source_id)
        JOIN (SELECT brand_id, count(DISTINCT akey) b_all FROM winp GROUP BY 1) bo USING(brand_id)
        JOIN (SELECT brand_id, mode() WITHIN GROUP (ORDER BY vert) vertical FROM winp GROUP BY 1) v USING(brand_id)
        CROSS JOIN (SELECT count(DISTINCT akey) all_total FROM winp) ov
        JOIN brands b ON b.id=bs.brand_id
        WHERE bs.source_id = ANY(p_competitor_sources) AND bs.b_src >= 5
          AND (bs.b_src::numeric/st.src_total)/NULLIF(bo.b_all::numeric/ov.all_total,0) >= 2
        ORDER BY over_index DESC LIMIT 25) t),

    'emerging', (
      SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.recent_articles DESC), '[]'::jsonb) FROM (
        SELECT COALESCE(b.display_name,b.canonical_name) AS brand, r.brand_id, r.vertical,
               b.is_bpg_client, r.recent_articles, r.first_seen
        FROM (
          SELECT brand_id, mode() WITHIN GROUP (ORDER BY vert) AS vertical,
                 count(DISTINCT akey) AS recent_articles, min(ts) AS first_seen
          FROM win WHERE ts >= now()-interval '90 days'
          GROUP BY brand_id HAVING count(DISTINCT akey) >= 3
        ) r JOIN brands b ON b.id=r.brand_id
        WHERE NOT EXISTS (SELECT 1 FROM article_entities o
                          WHERE o.canonical_id = r.brand_id AND o.published_at_ts < now()-interval '90 days')
        ORDER BY r.recent_articles DESC LIMIT 25) t)
  );
$$;


-- ---------------------------------------------------------------------
-- OBJECT 4 - coverage_gaps(p_bpg_sources, p_competitor_sources, p_days=7, p_limit=50)
-- Clusters with >=1 competitor member and ZERO BPG members.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coverage_gaps(
  p_bpg_sources text[], p_competitor_sources text[], p_days int DEFAULT 7, p_limit int DEFAULT 50)
RETURNS TABLE(cluster_id bigint, title text, url text, sources text[],
              first_source text, article_count int, first_published_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH cand AS (
    SELECT sc.id, sc.first_published_at, sc.article_count, sc.canonical_title
    FROM story_clusters sc
    WHERE sc.first_published_at >= now() - make_interval(days => p_days)),
  memagg AS (
    SELECT m.cluster_id,
           array_agg(DISTINCT m.source_id ORDER BY m.source_id) AS sources,
           (array_agg(m.source_id ORDER BY m.is_first DESC, m.similarity DESC NULLS LAST))[1] AS first_source
    FROM article_cluster_members m JOIN cand c ON c.id=m.cluster_id
    GROUP BY m.cluster_id
    HAVING bool_or(m.source_id = ANY(p_competitor_sources))
       AND NOT bool_or(m.source_id = ANY(p_bpg_sources))),
  fm AS (
    SELECT DISTINCT ON (m.cluster_id) m.cluster_id, m.source_id, m.external_id
    FROM article_cluster_members m JOIN memagg ma ON ma.cluster_id=m.cluster_id
    ORDER BY m.cluster_id, m.is_first DESC, m.similarity DESC NULLS LAST)
  SELECT c.id, COALESCE(a.title, c.canonical_title), a.url,
         ma.sources, ma.first_source, c.article_count, c.first_published_at
  FROM cand c
  JOIN memagg ma ON ma.cluster_id=c.id
  LEFT JOIN fm ON fm.cluster_id=c.id
  LEFT JOIN articles a ON a.source_id=fm.source_id AND a.external_id=fm.external_id
  ORDER BY c.first_published_at DESC
  LIMIT p_limit;
$$;


-- ---------------------------------------------------------------------
-- OBJECT 5 - cluster_detail(p_cluster_id) - all members, publish order.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cluster_detail(p_cluster_id bigint)
RETURNS TABLE(source_id text, title text, url text, published_at timestamptz,
              is_first boolean, similarity real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.source_id, a.title, a.url, to_ts_immutable(a.published_at), m.is_first, m.similarity
  FROM article_cluster_members m
  JOIN articles a ON a.source_id=m.source_id AND a.external_id=m.external_id
  WHERE m.cluster_id = p_cluster_id
  ORDER BY to_ts_immutable(a.published_at);
$$;


-- ---------------------------------------------------------------------
-- OBJECT 6 - pub_speed_report(p_sources, p_days=365)
-- Over MULTI-source clusters: first_pct + median lag hours per source.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pub_speed_report(p_sources text[], p_days int DEFAULT 365)
RETURNS TABLE(source_id text, stories_total bigint, first_count bigint,
              first_pct numeric, median_lag_hours numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ms AS (
    SELECT sc.id, sc.first_published_at
    FROM story_clusters sc
    WHERE sc.source_count > 1 AND sc.first_published_at >= now() - make_interval(days => p_days)),
  mem AS (
    SELECT m.source_id, m.is_first, ms.first_published_at AS cfirst,
           to_ts_immutable(a.published_at) AS pub
    FROM article_cluster_members m
    JOIN ms ON ms.id=m.cluster_id
    JOIN articles a ON a.source_id=m.source_id AND a.external_id=m.external_id
    WHERE m.source_id = ANY(p_sources))
  SELECT source_id, count(*)::bigint, count(*) FILTER (WHERE is_first)::bigint,
         round(100.0*count(*) FILTER (WHERE is_first)/count(*),1),
         round(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (pub-cfirst))/3600.0)::numeric,2)
  FROM mem GROUP BY source_id ORDER BY count(*) DESC;
$$;


-- ---------------------------------------------------------------------
-- OBJECT 7 - publication_breadth(p_sources, p_from, p_to)
-- Per source: distinct canonical brands + first_pct in range.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publication_breadth(p_sources text[], p_from date, p_to date)
RETURNS TABLE(source_id text, brands_covered bigint, ms_stories bigint, first_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH br AS (
    SELECT ae.source_id, count(DISTINCT ae.canonical_id) AS brands_covered
    FROM article_entities ae
    WHERE ae.canonical_id IS NOT NULL AND ae.source_id = ANY(p_sources)
      AND ae.published_at_ts >= p_from::timestamptz AND ae.published_at_ts < (p_to+1)::timestamptz
    GROUP BY ae.source_id),
  fp AS (
    SELECT m.source_id,
           count(*) FILTER (WHERE sc.source_count>1)                 AS ms_stories,
           count(*) FILTER (WHERE sc.source_count>1 AND m.is_first)  AS first_count
    FROM article_cluster_members m JOIN story_clusters sc ON sc.id=m.cluster_id
    WHERE m.source_id = ANY(p_sources)
      AND sc.first_published_at >= p_from::timestamptz AND sc.first_published_at < (p_to+1)::timestamptz
    GROUP BY m.source_id)
  SELECT s, COALESCE(br.brands_covered,0), COALESCE(fp.ms_stories,0),
         round(100.0*fp.first_count/NULLIF(fp.ms_stories,0),1)
  FROM unnest(p_sources) s
  LEFT JOIN br ON br.source_id=s
  LEFT JOIN fp ON fp.source_id=s
  ORDER BY 2 DESC;
$$;


-- ---------------------------------------------------------------------
-- GRANTS - mirror the existing public read-RPC posture.
-- ---------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.brand_trend(text,text[],int)                 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sales_radar(text[],text[],int)               TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.coverage_gaps(text[],text[],int,int)         TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cluster_detail(bigint)                       TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pub_speed_report(text[],int)                 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publication_breadth(text[],date,date)        TO anon, authenticated, service_role;
