-- Phase 0 (4/4): make brand_coverage alias-aware.
-- Resolves brand_name -> canonical brand -> alias list (case-insensitive), then
-- matches article_entities on (canonical_id = brand OR entity_name = ANY(aliases)).
-- Unmapped brand_name falls back to a single-alias array == exact prior behaviour,
-- so nothing breaks pre-registry. story_clusters (unique/shared/missed/first),
-- events and advertiser_spend are matched across the alias list too.
-- Verified 2026-07-01: NCL 61 + Norwegian Cruise Line 403 -> single brand = 438
-- (distinct-article de-dup); control brand Qantas unchanged; unmapped Sydney = fallback.
-- Applied to Supabase project BPG on 2026-07-01.

CREATE OR REPLACE FUNCTION public.brand_coverage(brand_name text, bpg_sources text[], competitor_sources text[], period_days integer DEFAULT 90)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  cutoff TIMESTAMPTZ := NOW() - (period_days || ' days')::interval;
  result JSONB;
  v_brand_id BIGINT;
  v_aliases TEXT[];
BEGIN
  SELECT ba.brand_id INTO v_brand_id FROM brand_aliases ba
   WHERE lower(ba.alias) = lower(brand_name) LIMIT 1;
  IF v_brand_id IS NOT NULL THEN
    SELECT array_agg(alias) INTO v_aliases FROM brand_aliases WHERE brand_id = v_brand_id;
  ELSE
    v_aliases := ARRAY[brand_name];
  END IF;

  SELECT jsonb_build_object(
    'brand', brand_name,
    'period_days', period_days,
    'generated_at', NOW(),
    'summary', (
      SELECT jsonb_build_object(
        'total_articles', COUNT(DISTINCT (a.source_id, a.external_id)),
        'total_words', COALESCE(SUM(a.word_count), 0),
        'avg_words', ROUND(AVG(a.word_count)),
        'sponsored_count', COUNT(*) FILTER (WHERE a.is_sponsored = 1),
        'bpg_articles', COUNT(DISTINCT (a.source_id, a.external_id)) FILTER (WHERE a.source_id = ANY(bpg_sources)),
        'competitor_articles', COUNT(DISTINCT (a.source_id, a.external_id)) FILTER (WHERE a.source_id = ANY(competitor_sources))
      )
      FROM article_entities ae
      JOIN articles a ON a.source_id = ae.source_id AND a.external_id = ae.external_id
      WHERE (ae.canonical_id = v_brand_id OR ae.entity_name = ANY(v_aliases))
        AND ae.published_at_ts >= cutoff
        AND ae.source_id = ANY(bpg_sources || competitor_sources)
    ),
    'by_publication', (
      SELECT COALESCE(jsonb_agg(row_to_json(p.*) ORDER BY p.article_count DESC), '[]'::jsonb)
      FROM (
        SELECT a.source_id,
               COUNT(DISTINCT a.external_id)::int AS article_count,
               COALESCE(SUM(a.word_count), 0)::int AS total_words,
               COUNT(*) FILTER (WHERE a.is_sponsored = 1)::int AS sponsored_count,
               a.source_id = ANY(bpg_sources) AS is_bpg
        FROM article_entities ae
        JOIN articles a ON a.source_id = ae.source_id AND a.external_id = ae.external_id
        WHERE (ae.canonical_id = v_brand_id OR ae.entity_name = ANY(v_aliases))
          AND ae.published_at_ts >= cutoff
          AND ae.source_id = ANY(bpg_sources || competitor_sources)
        GROUP BY a.source_id
      ) p
    ),
    'unique_coverage', (
      SELECT COALESCE(jsonb_agg(row_to_json(u.*) ORDER BY u.first_published_at DESC), '[]'::jsonb)
      FROM (
        SELECT sc.id, sc.canonical_title, sc.first_published_at, sc.article_count,
               array_agg(DISTINCT m.source_id) AS sources
        FROM story_clusters sc
        JOIN article_cluster_members m ON m.cluster_id = sc.id
        WHERE sc.dominant_entity = ANY(v_aliases)
          AND sc.first_published_at >= cutoff
        GROUP BY sc.id
        HAVING bool_and(m.source_id = ANY(bpg_sources))
          AND NOT bool_or(m.source_id = ANY(competitor_sources))
        ORDER BY sc.first_published_at DESC
        LIMIT 30
      ) u
    ),
    'shared_coverage_count', (
      SELECT COUNT(*)::int FROM (
        SELECT sc.id
        FROM story_clusters sc
        JOIN article_cluster_members m ON m.cluster_id = sc.id
        WHERE sc.dominant_entity = ANY(v_aliases)
          AND sc.first_published_at >= cutoff
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
        WHERE sc.dominant_entity = ANY(v_aliases)
          AND sc.first_published_at >= cutoff
        GROUP BY sc.id
        HAVING NOT bool_or(m.source_id = ANY(bpg_sources))
          AND bool_or(m.source_id = ANY(competitor_sources))
        ORDER BY sc.first_published_at DESC
        LIMIT 30
      ) mc
    ),
    'first_to_publish', (
      SELECT jsonb_build_object(
        'bpg_first', COUNT(*) FILTER (WHERE first_source = ANY(bpg_sources)),
        'competitor_first', COUNT(*) FILTER (WHERE first_source = ANY(competitor_sources)),
        'total_shared', COUNT(*)
      )
      FROM (
        SELECT sc.id,
               (SELECT m2.source_id FROM article_cluster_members m2
                WHERE m2.cluster_id = sc.id AND m2.is_first LIMIT 1) AS first_source
        FROM story_clusters sc
        JOIN article_cluster_members m ON m.cluster_id = sc.id
        WHERE sc.dominant_entity = ANY(v_aliases)
          AND sc.first_published_at >= cutoff
        GROUP BY sc.id
        HAVING bool_or(m.source_id = ANY(bpg_sources))
          AND bool_or(m.source_id = ANY(competitor_sources))
      ) fp
    ),
    'timeline', (
      SELECT COALESCE(jsonb_agg(row_to_json(t.*) ORDER BY t.week), '[]'::jsonb)
      FROM (
        SELECT date_trunc('week', ae.published_at_ts)::date AS week,
               a.source_id,
               COUNT(DISTINCT a.external_id)::int AS articles
        FROM article_entities ae
        JOIN articles a ON a.source_id = ae.source_id AND a.external_id = ae.external_id
        WHERE (ae.canonical_id = v_brand_id OR ae.entity_name = ANY(v_aliases))
          AND ae.published_at_ts >= cutoff
          AND ae.source_id = ANY(bpg_sources || competitor_sources)
        GROUP BY 1, 2
      ) t
    ),
    'top_articles', (
      SELECT COALESCE(jsonb_agg(row_to_json(ta.*)), '[]'::jsonb)
      FROM (
        SELECT a.source_id, a.external_id, a.title, a.url, a.published_at,
               a.word_count, a.author_name,
               ae.mention_count, ae.in_title
        FROM article_entities ae
        JOIN articles a ON a.source_id = ae.source_id AND a.external_id = ae.external_id
        WHERE (ae.canonical_id = v_brand_id OR ae.entity_name = ANY(v_aliases))
          AND ae.published_at_ts >= cutoff
          AND ae.source_id = ANY(bpg_sources)
        ORDER BY ae.in_title DESC, ae.mention_count DESC, ae.published_at_ts DESC
        LIMIT 10
      ) ta
    ),
    'journalists', (
      SELECT COALESCE(jsonb_agg(row_to_json(j.*) ORDER BY j.article_count DESC), '[]'::jsonb)
      FROM (
        SELECT a.author_name, a.source_id,
               COUNT(DISTINCT a.external_id)::int AS article_count
        FROM article_entities ae
        JOIN articles a ON a.source_id = ae.source_id AND a.external_id = ae.external_id
        WHERE (ae.canonical_id = v_brand_id OR ae.entity_name = ANY(v_aliases))
          AND ae.published_at_ts >= cutoff
          AND ae.source_id = ANY(bpg_sources)
          AND a.author_name IS NOT NULL
          AND a.author_name != ''
        GROUP BY a.author_name, a.source_id
        ORDER BY COUNT(DISTINCT a.external_id) DESC
        LIMIT 20
      ) j
    ),
    'events', (
      SELECT COALESCE(jsonb_agg(row_to_json(e.*) ORDER BY e.event_date DESC), '[]'::jsonb)
      FROM (
        SELECT ev.event_name, ev.event_date, ev.source_id, ev.attended_by
        FROM events_attended ev
        WHERE EXISTS (SELECT 1 FROM unnest(v_aliases) al WHERE ev.advertiser ILIKE '%' || al || '%')
          AND ev.event_date >= (cutoff)::date
        ORDER BY ev.event_date DESC
        LIMIT 20
      ) e
    ),
    'spend_vs_coverage', (
      SELECT COALESCE(jsonb_agg(row_to_json(svc.*) ORDER BY svc.source_id), '[]'::jsonb)
      FROM (
        SELECT src.source_id,
               COALESCE(sp.spend_aud, 0) AS spend_aud,
               COALESCE(cov.article_count, 0) AS article_count
        FROM (SELECT unnest(bpg_sources) AS source_id) src
        LEFT JOIN (
          SELECT source_id, SUM(spend_aud) AS spend_aud
          FROM advertiser_spend
          WHERE EXISTS (SELECT 1 FROM unnest(v_aliases) al WHERE advertiser ILIKE '%' || al || '%')
            AND period_end >= (cutoff)::date
          GROUP BY source_id
        ) sp ON sp.source_id = src.source_id
        LEFT JOIN (
          SELECT ae.source_id, COUNT(DISTINCT ae.external_id)::int AS article_count
          FROM article_entities ae
          WHERE (ae.canonical_id = v_brand_id OR ae.entity_name = ANY(v_aliases))
            AND ae.published_at_ts >= cutoff
          GROUP BY ae.source_id
        ) cov ON cov.source_id = src.source_id
      ) svc
    ),
    'ave', (
      SELECT jsonb_build_object(
        'article_ave', COALESCE(SUM(
          CASE WHEN a.word_count > 500 THEN feature_rate.rate_aud
               ELSE standard_rate.rate_aud END
        ), 0),
        'total_articles', COUNT(DISTINCT (a.source_id, a.external_id)),
        'by_source', (
          SELECT COALESCE(jsonb_agg(row_to_json(br.*)), '[]'::jsonb)
          FROM (
            SELECT a2.source_id,
                   COUNT(DISTINCT a2.external_id) AS articles,
                   SUM(CASE WHEN a2.word_count > 500 THEN fr.rate_aud ELSE sr.rate_aud END) AS ave_aud
            FROM article_entities ae2
            JOIN articles a2 ON a2.source_id = ae2.source_id AND a2.external_id = ae2.external_id
            LEFT JOIN LATERAL (
              SELECT rate_aud FROM ave_config
              WHERE source_id = a2.source_id AND metric = 'article_standard'
              ORDER BY effective_from DESC LIMIT 1
            ) sr ON true
            LEFT JOIN LATERAL (
              SELECT rate_aud FROM ave_config
              WHERE source_id = a2.source_id AND metric = 'article_feature'
              ORDER BY effective_from DESC LIMIT 1
            ) fr ON true
            WHERE (ae2.canonical_id = v_brand_id OR ae2.entity_name = ANY(v_aliases))
              AND ae2.published_at_ts >= cutoff
              AND ae2.source_id = ANY(bpg_sources)
            GROUP BY a2.source_id
          ) br
        )
      )
      FROM article_entities ae
      JOIN articles a ON a.source_id = ae.source_id AND a.external_id = ae.external_id
      LEFT JOIN LATERAL (
        SELECT rate_aud FROM ave_config
        WHERE source_id = a.source_id AND metric = 'article_standard'
        ORDER BY effective_from DESC LIMIT 1
      ) standard_rate ON true
      LEFT JOIN LATERAL (
        SELECT rate_aud FROM ave_config
        WHERE source_id = a.source_id AND metric = 'article_feature'
        ORDER BY effective_from DESC LIMIT 1
      ) feature_rate ON true
      WHERE (ae.canonical_id = v_brand_id OR ae.entity_name = ANY(v_aliases))
        AND ae.published_at_ts >= cutoff
        AND ae.source_id = ANY(bpg_sources)
    )
  ) INTO result;

  RETURN result;
END; $function$;
