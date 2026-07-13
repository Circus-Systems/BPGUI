-- ============================================================================
-- Round 2: brand_coverage cluster fix + brand_value_ledger + wire-aware RPCs
-- Authored + EXPLAIN/live-validated read-only by the data agent before applying.
--
-- TASK 1 ROOT CAUSE: brand_coverage(_core)'s cluster join used
--   story_clusters.dominant_entity = ANY(aliases). dominant_entity is a single
--   proper-cased top entity (2,899/28,257 NULL); Scenic's lowercase alias
--   matched nothing (slide-10 all zeros); Qantas matched but undercounted ~2x.
--   Fix: membership = clusters containing >=1 article canonically tagged the
--   brand; override the cluster-derived json fields in brand_coverage via
--   jsonb || (brand_coverage_core untouched; identical signature + 19-key
--   shape; grants preserved by CREATE OR REPLACE; warm cron unaffected).
--   Validated: Scenic 365d 0/0/0 -> unique 26 / shared 3 / missed 69,
--   first_to_publish {bpg:1, comp:2, total:3}; Qantas 90d unique 38->82.
--
-- TASK 2 brand_value_ledger: per-quarter counts (brand_pub_month) + Promotional
--   Value at quarter grain mirroring brand_coverage's AVE methodology
--   (earned-only, material tag, feature/standard rate by word_count, latest
--   ave_config rate, +/-15% band). LANGUAGE sql to avoid the plpgsql OUT-param
--   collision with matview column names. Consistency validated: Scenic
--   last-4Q value_mid sum 37,500 vs deck 365d midpoint 42,500 (-11.8%,
--   quarter-boundary drift; adding the boundary quarter -> +5.9%). 693ms.
--
-- TASK 3 wire-aware metrics (wire source passed by UI = global-travel-media):
--   DROP+CREATE (not replace) to avoid PostgREST-ambiguous overloads; grants
--   re-issued. coverage_gaps: drop all-wire gap clusters (30d: 2846 -> 1520
--   real gaps; 47% were wire PR noise). pub_speed_report + publication_breadth:
--   the "race" = clusters with >1 DISTINCT non-wire source; wire members never
--   count as first; pub_speed adds is_wire column. Side benefit: (cluster,
--   source) GROUP BY removes same-source dup inflation (travel-daily 365d
--   inputs were inflated 30.9%). Validated: travel-daily first_pct 34.4% ->
--   49.6% (stories 521 -> 355); GTM flagged is_wire, first_pct -> 0.
--
-- TASK 3(d) duplicates assessment: do NOT fold dedup_articles into these RPCs
--   (catches <0.5%; the rewrites' grouping already removes the real inflation).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TASK 1 — brand_coverage: fix unique/shared/missed/first_to_publish
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_coverage(
  brand_name text, bpg_sources text[], competitor_sources text[], period_days integer DEFAULT 90)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  cutoff TIMESTAMPTZ := NOW() - (period_days || ' days')::interval;
  result JSONB;
  v_brand_id BIGINT;
  v_aliases TEXT[];
  v_cluster_ids BIGINT[];
  v_unique_count INT;
  v_missed_count INT;
BEGIN
  SELECT ba.brand_id INTO v_brand_id FROM brand_aliases ba
   WHERE lower(ba.alias) = lower(brand_name) LIMIT 1;
  IF v_brand_id IS NOT NULL THEN
    SELECT array_agg(alias) INTO v_aliases FROM brand_aliases WHERE brand_id = v_brand_id;
  ELSE
    v_aliases := ARRAY[brand_name];
  END IF;

  -- Correct cluster membership: any cluster with >=1 article canonically tagged the brand.
  SELECT array_agg(DISTINCT mm.cluster_id) INTO v_cluster_ids
  FROM article_cluster_members mm
  JOIN article_entities ae2
    ON ae2.source_id = mm.source_id AND ae2.external_id = mm.external_id
  WHERE (ae2.canonical_id = v_brand_id OR ae2.entity_name = ANY(v_aliases));
  IF v_cluster_ids IS NULL THEN
    v_cluster_ids := ARRAY[]::bigint[];
  END IF;

  SELECT COUNT(*)::int INTO v_unique_count FROM (
    SELECT sc.id FROM story_clusters sc
    JOIN article_cluster_members m ON m.cluster_id = sc.id
    WHERE sc.id = ANY(v_cluster_ids) AND sc.first_published_at >= cutoff
    GROUP BY sc.id
    HAVING bool_and(m.source_id = ANY(bpg_sources))
       AND NOT bool_or(m.source_id = ANY(competitor_sources))
  ) u;

  SELECT COUNT(*)::int INTO v_missed_count FROM (
    SELECT sc.id FROM story_clusters sc
    JOIN article_cluster_members m ON m.cluster_id = sc.id
    WHERE sc.id = ANY(v_cluster_ids) AND sc.first_published_at >= cutoff
    GROUP BY sc.id
    HAVING NOT bool_or(m.source_id = ANY(bpg_sources))
       AND bool_or(m.source_id = ANY(competitor_sources))
  ) mc;

  result := public.brand_coverage_core(brand_name, bpg_sources, competitor_sources, period_days);

  result := result || jsonb_build_object(
    'unique_coverage', (
      SELECT COALESCE(jsonb_agg(row_to_json(u.*) ORDER BY u.first_published_at DESC), '[]'::jsonb)
      FROM (
        SELECT sc.id, sc.canonical_title, sc.first_published_at, sc.article_count,
               array_agg(DISTINCT m.source_id) AS sources
        FROM story_clusters sc
        JOIN article_cluster_members m ON m.cluster_id = sc.id
        WHERE sc.id = ANY(v_cluster_ids) AND sc.first_published_at >= cutoff
        GROUP BY sc.id
        HAVING bool_and(m.source_id = ANY(bpg_sources))
           AND NOT bool_or(m.source_id = ANY(competitor_sources))
        ORDER BY sc.first_published_at DESC
        LIMIT 30
      ) u
    ),
    'shared_coverage_count', (
      SELECT COUNT(*)::int FROM (
        SELECT sc.id FROM story_clusters sc
        JOIN article_cluster_members m ON m.cluster_id = sc.id
        WHERE sc.id = ANY(v_cluster_ids) AND sc.first_published_at >= cutoff
        GROUP BY sc.id
        HAVING bool_or(m.source_id = ANY(bpg_sources))
           AND bool_or(m.source_id = ANY(competitor_sources))
      ) x
    ),
    'missed_coverage', (
      SELECT COALESCE(jsonb_agg(row_to_json(mc.*) ORDER BY mc.first_published_at DESC), '[]'::jsonb)
      FROM (
        SELECT sc.id, sc.canonical_title, sc.first_published_at, sc.article_count,
               array_agg(DISTINCT m.source_id) AS sources
        FROM story_clusters sc
        JOIN article_cluster_members m ON m.cluster_id = sc.id
        WHERE sc.id = ANY(v_cluster_ids) AND sc.first_published_at >= cutoff
        GROUP BY sc.id
        HAVING NOT bool_or(m.source_id = ANY(bpg_sources))
           AND bool_or(m.source_id = ANY(competitor_sources))
        ORDER BY sc.first_published_at DESC
        LIMIT 30
      ) mc
    ),
    'first_to_publish', (
      SELECT jsonb_build_object(
        'bpg_first',        COUNT(*) FILTER (WHERE first_source = ANY(bpg_sources)),
        'competitor_first', COUNT(*) FILTER (WHERE first_source = ANY(competitor_sources)),
        'total_shared',     COUNT(*)
      )
      FROM (
        SELECT sc.id,
               (SELECT m2.source_id FROM article_cluster_members m2
                 WHERE m2.cluster_id = sc.id AND m2.is_first LIMIT 1) AS first_source
        FROM story_clusters sc
        JOIN article_cluster_members m ON m.cluster_id = sc.id
        WHERE sc.id = ANY(v_cluster_ids) AND sc.first_published_at >= cutoff
        GROUP BY sc.id
        HAVING bool_or(m.source_id = ANY(bpg_sources))
           AND bool_or(m.source_id = ANY(competitor_sources))
      ) fp
    ),
    'unique_coverage_count', v_unique_count,
    'missed_coverage_count', v_missed_count
  );

  RETURN result;
END; $function$;

-- ---------------------------------------------------------------------------
-- TASK 2 — brand_value_ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_value_ledger(
  p_brand text,
  p_bpg_sources text[],
  p_competitor_sources text[],
  p_quarters integer DEFAULT 8)
 RETURNS TABLE(quarter date, bpg_articles bigint, bpg_title_articles bigint,
               competitor_articles bigint, exclusive_stories bigint, first_stories bigint,
               value_min numeric, value_mid numeric, value_max numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH resolved AS (
    SELECT (SELECT ba.brand_id FROM brand_aliases ba
             WHERE lower(ba.alias) = lower(p_brand) LIMIT 1) AS brand_id
  ),
  ali AS (
    SELECT r.brand_id,
           COALESCE((SELECT array_agg(ba.alias) FROM brand_aliases ba WHERE ba.brand_id = r.brand_id),
                    ARRAY[p_brand]) AS aliases
    FROM resolved r
  ),
  bounds AS (
    SELECT greatest(
             (date_trunc('quarter', now())
                - make_interval(months => (least(greatest(coalesce(p_quarters,8),4),12) - 1) * 3))::date,
             date '2005-01-01'
           ) AS q_start
  ),
  counts AS (
    SELECT date_trunc('quarter', bpm.month)::date AS q,
      sum(bpm.articles)          FILTER (WHERE bpm.source_id = ANY(p_bpg_sources))::bigint        AS bpg_articles,
      sum(bpm.title_articles)    FILTER (WHERE bpm.source_id = ANY(p_bpg_sources))::bigint        AS bpg_title_articles,
      sum(bpm.articles)          FILTER (WHERE bpm.source_id = ANY(p_competitor_sources))::bigint AS competitor_articles,
      sum(bpm.exclusive_stories) FILTER (WHERE bpm.source_id = ANY(p_bpg_sources))::bigint        AS exclusive_stories,
      sum(bpm.first_stories)     FILTER (WHERE bpm.source_id = ANY(p_bpg_sources))::bigint        AS first_stories
    FROM brand_pub_month bpm, bounds bd, ali
    WHERE bpm.brand_id = ali.brand_id
      AND bpm.month >= bd.q_start
      AND bpm.source_id = ANY(p_bpg_sources || p_competitor_sources)
    GROUP BY 1
  ),
  val AS (
    SELECT date_trunc('quarter', to_ts_immutable(a.published_at))::date AS q,
      sum(CASE WHEN a.word_count > 500 THEN fr.rate_aud ELSE sr.rate_aud END) AS mid
    FROM dedup_articles(p_bpg_sources, (SELECT q_start FROM bounds)::timestamptz) a
    LEFT JOIN LATERAL (
      SELECT ac.rate_aud FROM ave_config ac
      WHERE ac.source_id = a.source_id AND ac.metric = 'article_standard'
      ORDER BY ac.effective_from DESC LIMIT 1) sr ON true
    LEFT JOIN LATERAL (
      SELECT ac.rate_aud FROM ave_config ac
      WHERE ac.source_id = a.source_id AND ac.metric = 'article_feature'
      ORDER BY ac.effective_from DESC LIMIT 1) fr ON true
    WHERE a.is_sponsored = 0
      AND EXISTS (
        SELECT 1 FROM article_entities ae, ali
        WHERE ae.source_id = a.source_id AND ae.external_id = a.external_id
          AND (ae.canonical_id = ali.brand_id OR ae.entity_name = ANY(ali.aliases))
          AND ae.published_at_ts >= (SELECT q_start FROM bounds)::timestamptz
          AND ae_is_material(ae.mention_count, ae.in_title::int, ae.confidence)
      )
    GROUP BY 1
  )
  SELECT gs.q::date AS quarter,
    coalesce(c.bpg_articles, 0)::bigint,
    coalesce(c.bpg_title_articles, 0)::bigint,
    coalesce(c.competitor_articles, 0)::bigint,
    coalesce(c.exclusive_stories, 0)::bigint,
    coalesce(c.first_stories, 0)::bigint,
    round(coalesce(v.mid, 0) * 0.85, 2)::numeric AS value_min,
    round(coalesce(v.mid, 0),        2)::numeric AS value_mid,
    round(coalesce(v.mid, 0) * 1.15, 2)::numeric AS value_max
  FROM generate_series((SELECT q_start FROM bounds),
                       date_trunc('quarter', now())::date,
                       interval '3 months') AS gs(q)
  LEFT JOIN counts c ON c.q = gs.q::date
  LEFT JOIN val    v ON v.q = gs.q::date
  ORDER BY gs.q;
$function$;

GRANT EXECUTE ON FUNCTION public.brand_value_ledger(text, text[], text[], integer)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- TASK 3 — wire-source-aware metrics (DROP + CREATE; grants re-issued)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.coverage_gaps(text[], text[], integer, integer);
DROP FUNCTION IF EXISTS public.pub_speed_report(text[], integer);
DROP FUNCTION IF EXISTS public.publication_breadth(text[], date, date);

CREATE OR REPLACE FUNCTION public.coverage_gaps(
  p_bpg_sources text[], p_competitor_sources text[],
  p_days integer DEFAULT 7, p_limit integer DEFAULT 50,
  p_wire_sources text[] DEFAULT '{}'::text[])
 RETURNS TABLE(cluster_id bigint, title text, url text, sources text[],
               first_source text, article_count integer, first_published_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cand AS (
    SELECT sc.id, sc.first_published_at, sc.article_count, sc.canonical_title
    FROM story_clusters sc
    WHERE sc.first_published_at >= now() - make_interval(days => p_days)),
  memagg AS (
    SELECT m.cluster_id,
           array_agg(DISTINCT m.source_id ORDER BY m.source_id) AS sources,
           (array_agg(m.source_id ORDER BY m.is_first DESC, m.similarity DESC NULLS LAST))[1] AS first_source
    FROM article_cluster_members m JOIN cand c ON c.id = m.cluster_id
    GROUP BY m.cluster_id
    HAVING bool_or(m.source_id = ANY(p_competitor_sources))
       AND NOT bool_or(m.source_id = ANY(p_bpg_sources))
       AND bool_or(NOT (m.source_id = ANY(p_wire_sources)))),
  fm AS (
    SELECT DISTINCT ON (m.cluster_id) m.cluster_id, m.source_id, m.external_id
    FROM article_cluster_members m JOIN memagg ma ON ma.cluster_id = m.cluster_id
    ORDER BY m.cluster_id, m.is_first DESC, m.similarity DESC NULLS LAST)
  SELECT c.id, COALESCE(a.title, c.canonical_title), a.url,
         ma.sources, ma.first_source, c.article_count, c.first_published_at
  FROM cand c
  JOIN memagg ma ON ma.cluster_id = c.id
  LEFT JOIN fm ON fm.cluster_id = c.id
  LEFT JOIN articles a ON a.source_id = fm.source_id AND a.external_id = fm.external_id
  ORDER BY cardinality(ma.sources) DESC, c.article_count DESC, c.first_published_at DESC
  LIMIT p_limit;
$function$;
GRANT EXECUTE ON FUNCTION public.coverage_gaps(text[], text[], integer, integer, text[])
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pub_speed_report(
  p_sources text[], p_days integer DEFAULT 365,
  p_wire_sources text[] DEFAULT '{}'::text[])
 RETURNS TABLE(source_id text, stories_total bigint, first_count bigint,
               first_pct numeric, median_lag_hours numeric, is_wire boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cand AS (
    SELECT sc.id FROM story_clusters sc
    WHERE sc.first_published_at >= now() - make_interval(days => p_days)),
  memall AS (
    SELECT m.cluster_id, m.source_id,
           to_ts_immutable(a.published_at) AS pub,
           (m.source_id = ANY(p_wire_sources)) AS is_wire
    FROM article_cluster_members m
    JOIN cand ON cand.id = m.cluster_id
    JOIN articles a ON a.source_id = m.source_id AND a.external_id = m.external_id),
  clstats AS (
    SELECT ma.cluster_id,
           count(DISTINCT ma.source_id) FILTER (WHERE NOT ma.is_wire) AS nonwire_srcs,
           min(ma.pub)                  FILTER (WHERE NOT ma.is_wire) AS cfirst
    FROM memall ma GROUP BY ma.cluster_id),
  race AS (SELECT cs.cluster_id, cs.cfirst FROM clstats cs WHERE cs.nonwire_srcs > 1),
  srcmem AS (
    SELECT ma.source_id, ma.is_wire, r.cfirst, min(ma.pub) AS src_pub
    FROM memall ma JOIN race r ON r.cluster_id = ma.cluster_id
    WHERE ma.source_id = ANY(p_sources)
    GROUP BY ma.cluster_id, ma.source_id, ma.is_wire, r.cfirst)
  SELECT sm.source_id,
         count(*)::bigint AS stories_total,
         count(*) FILTER (WHERE NOT sm.is_wire AND sm.src_pub = sm.cfirst)::bigint AS first_count,
         round(100.0 * count(*) FILTER (WHERE NOT sm.is_wire AND sm.src_pub = sm.cfirst)
               / count(*), 1) AS first_pct,
         round(percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM (sm.src_pub - sm.cfirst)) / 3600.0)::numeric, 2) AS median_lag_hours,
         bool_or(sm.is_wire) AS is_wire
  FROM srcmem sm
  GROUP BY sm.source_id
  ORDER BY count(*) DESC;
$function$;
GRANT EXECUTE ON FUNCTION public.pub_speed_report(text[], integer, text[])
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.publication_breadth(
  p_sources text[], p_from date, p_to date,
  p_wire_sources text[] DEFAULT '{}'::text[])
 RETURNS TABLE(source_id text, brands_covered bigint, ms_stories bigint, first_pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH br AS (
    SELECT ae.source_id, count(DISTINCT ae.canonical_id) AS brands_covered
    FROM article_entities ae
    WHERE ae.canonical_id IS NOT NULL AND ae.source_id = ANY(p_sources)
      AND ae.published_at_ts >= p_from::timestamptz
      AND ae.published_at_ts <  (p_to + 1)::timestamptz
    GROUP BY ae.source_id),
  memall AS (
    SELECT m.cluster_id, m.source_id,
           to_ts_immutable(a.published_at) AS pub,
           (m.source_id = ANY(p_wire_sources)) AS is_wire
    FROM article_cluster_members m
    JOIN story_clusters sc ON sc.id = m.cluster_id
    JOIN articles a ON a.source_id = m.source_id AND a.external_id = m.external_id
    WHERE sc.first_published_at >= p_from::timestamptz
      AND sc.first_published_at <  (p_to + 1)::timestamptz),
  clstats AS (
    SELECT ma.cluster_id,
           count(DISTINCT ma.source_id) FILTER (WHERE NOT ma.is_wire) AS nonwire_srcs,
           min(ma.pub)                  FILTER (WHERE NOT ma.is_wire) AS cfirst
    FROM memall ma GROUP BY ma.cluster_id),
  race AS (SELECT cs.cluster_id, cs.cfirst FROM clstats cs WHERE cs.nonwire_srcs > 1),
  srcmem AS (
    SELECT ma.source_id, ma.is_wire, r.cfirst, min(ma.pub) AS src_pub
    FROM memall ma JOIN race r ON r.cluster_id = ma.cluster_id
    WHERE ma.source_id = ANY(p_sources)
    GROUP BY ma.cluster_id, ma.source_id, ma.is_wire, r.cfirst),
  fp AS (
    SELECT sm.source_id,
           count(*) AS ms_stories,
           count(*) FILTER (WHERE NOT sm.is_wire AND sm.src_pub = sm.cfirst) AS first_count
    FROM srcmem sm GROUP BY sm.source_id)
  SELECT s AS source_id,
         COALESCE(br.brands_covered, 0),
         COALESCE(fp.ms_stories, 0),
         round(100.0 * fp.first_count / NULLIF(fp.ms_stories, 0), 1)
  FROM unnest(p_sources) s
  LEFT JOIN br ON br.source_id = s
  LEFT JOIN fp ON fp.source_id = s
  ORDER BY 2 DESC;
$function$;
GRANT EXECUTE ON FUNCTION public.publication_breadth(text[], date, date, text[])
  TO anon, authenticated, service_role;
