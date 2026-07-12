-- =====================================================================
-- coverage_gaps ranking fix (same-day follow-up to intel_views_data_layer)
--
-- Production verification showed the 7-day gap list swamped by
-- Global Travel Media's single-article press-release firehose. Rank
-- multi-competitor stories first (more sources = more consequential
-- miss), then by article count, then recency, so the stories that
-- matter surface at the top of the 50-row window.
-- Same signature/grants as before; CREATE OR REPLACE preserves grants.
-- =====================================================================

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
  ORDER BY cardinality(ma.sources) DESC, c.article_count DESC, c.first_published_at DESC
  LIMIT p_limit;
$$;
