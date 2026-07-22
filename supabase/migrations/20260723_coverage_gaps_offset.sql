-- ============================================================================
-- coverage_gaps: add p_offset (final param, DEFAULT 0) so the CSV export can
-- page past PostgREST's project-wide 1000-row response cap.
--
-- Context: production verification of the CSV export feature found every
-- supabase-js RPC response silently capped at 1000 rows (PostgREST max-rows).
-- 30-day gap windows exceed that (measured 1,072 qualifying clusters), so a
-- single un-offset call drops the tail. Validated: LIMIT 1000 OFFSET 1000 at
-- p_days=30 returns the remaining 72 rows in 136ms.
--
-- Signature changes (new arg) -> DROP + CREATE + re-GRANT (grants die with
-- DROP). Only two deltas vs prior production def: the added p_offset param
-- and "LIMIT p_limit" -> "LIMIT p_limit OFFSET greatest(coalesce(p_offset,0),0)".
-- Existing named-arg callers resolve unchanged (param defaulted; the old
-- 5-arg signature was the only overload and is dropped).
-- ============================================================================

DROP FUNCTION public.coverage_gaps(text[], text[], integer, integer, text[]);

CREATE FUNCTION public.coverage_gaps(p_bpg_sources text[], p_competitor_sources text[], p_days integer DEFAULT 7, p_limit integer DEFAULT 50, p_wire_sources text[] DEFAULT '{}'::text[], p_offset integer DEFAULT 0)
 RETURNS TABLE(cluster_id bigint, title text, url text, sources text[], first_source text, article_count integer, first_published_at timestamp with time zone)
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
  LIMIT p_limit OFFSET greatest(coalesce(p_offset,0),0);
$function$;

GRANT EXECUTE ON FUNCTION public.coverage_gaps(text[], text[], integer, integer, text[], integer) TO anon;
GRANT EXECUTE ON FUNCTION public.coverage_gaps(text[], text[], integer, integer, text[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coverage_gaps(text[], text[], integer, integer, text[], integer) TO service_role;
