-- ============================================================================
-- CSV export support: raise p_limit clamp 100 -> 10,000 on entity_articles
-- and publication_brands. Body-only change (the single clamp constant);
-- signatures identical; grants survive CREATE OR REPLACE.
--
-- Validated read-only before applying (2026-07-23):
--  * statement_timeout: anon = 3s, authenticated = 8s (the export budget),
--    service_role = 120s.
--  * entity_articles worst case (Qantas, 13 sources, 240mo): total_count
--    13,545 deduped rows. Single limit-10000 call = 6.84s cold (too close
--    to 8s) AND would truncate. Export routes therefore CHUNK at
--    p_limit=5000 (0.3s warm / ~4s cold per chunk; total_count on every
--    row lets the route precompute chunk count).
--  * publication_brands worst case (travel-daily, 240mo): 3,320 rows,
--    single limit-10000 call fine row-wise; ~7s runtime at 240mo is a
--    pre-existing cost (mode() sort spills) unaffected by this change —
--    export route surfaces a clear error if it times out.
--  * coverage_gaps has no clamp (p_limit raw) — unchanged, 138ms @ 5000.
--
-- The two function bodies below are byte-identical to production except
-- least(..., 100) -> least(..., 10000). See prior migrations
-- 20260713_entity_detail_rpcs.sql and 20260713_publication_detail_rpcs.sql
-- for the annotated originals.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.entity_articles(p_name text, p_sources text[], p_months integer DEFAULT 12, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(published_at timestamp with time zone, source_id text, title text, url text, word_count integer, author_name text, in_title integer, is_sponsored integer, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_brand_id bigint;
  v_aliases  text[];
  v_start    timestamptz;
  v_limit    int;
  v_offset   int;
begin
  select ba.brand_id into v_brand_id
  from brand_aliases ba
  where lower(ba.alias) = lower(p_name)
  limit 1;

  if v_brand_id is not null then
    select array_agg(alias) into v_aliases from brand_aliases where brand_id = v_brand_id;
  else
    v_aliases := array[p_name];
  end if;

  v_start  := greatest(
                date_trunc('month', now())
                  - make_interval(months => least(greatest(coalesce(p_months, 12), 1), 240) - 1),
                timestamptz '2005-01-01'
              );
  v_limit  := least(greatest(coalesce(p_limit, 50), 1), 10000);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  with matched as (
    select ae.source_id,
           ae.external_id,
           max(ae.published_at_ts) as published_at_ts,
           max(ae.in_title)        as in_title
    from article_entities ae
    where (ae.canonical_id = v_brand_id or ae.entity_name = any(v_aliases))
      and ae.source_id = any(p_sources)
      and ae.published_at_ts >= v_start
    group by ae.source_id, ae.external_id
  ),
  counted as (
    select m.*, count(*) over ()::bigint as total_count
    from matched m
  ),
  page as (
    select *
    from counted
    order by published_at_ts desc
    limit v_limit offset v_offset
  )
  select to_ts_immutable(a.published_at),
         p.source_id,
         a.title,
         a.url,
         a.word_count,
         a.author_name::text,
         p.in_title,
         a.is_sponsored,
         p.total_count
  from page p
  join articles a
    on a.source_id = p.source_id and a.external_id = p.external_id
  order by to_ts_immutable(a.published_at) desc nulls last;
end;
$function$;

CREATE OR REPLACE FUNCTION public.publication_brands(p_source text, p_months integer DEFAULT 12, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(brand_id bigint, brand text, entity_type text, articles bigint, title_articles bigint, share_pct numeric, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start  timestamptz;
  v_limit  int;
  v_offset int;
begin
  v_start  := greatest(
                date_trunc('month', now())
                  - make_interval(months => least(greatest(coalesce(p_months, 12), 1), 240) - 1),
                timestamptz '2005-01-01'
              );
  v_limit  := least(greatest(coalesce(p_limit, 50), 1), 10000);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  with base as (
    select ae.canonical_id, ae.external_id, ae.entity_type, ae.in_title
    from article_entities ae
    where ae.source_id = p_source
      and ae.published_at_ts >= v_start
  ),
  brand_type as (
    select b.canonical_id,
           mode() within group (order by b.entity_type) as dom_type
    from base b
    where b.canonical_id is not null
    group by b.canonical_id
  ),
  scoped as (
    select b.canonical_id, b.external_id, b.in_title
    from base b
    join brand_type bt on bt.canonical_id = b.canonical_id
    where bt.dom_type in ('company', 'industry_body')
  ),
  agg as (
    select s.canonical_id,
           count(distinct s.external_id)::bigint as articles,
           count(distinct s.external_id) filter (where s.in_title = 1)::bigint as title_articles,
           grouping(s.canonical_id) as g
    from scoped s
    group by grouping sets ((s.canonical_id), ())
  ),
  tot as (
    select a2.articles as denom
    from agg a2
    where a2.g = 1
  ),
  ranked as (
    select a.canonical_id, a.articles, a.title_articles,
           count(*) over ()::bigint as total_count,
           row_number() over (order by a.articles desc, a.canonical_id) as rnk
    from agg a
    where a.g = 0
  )
  select r.canonical_id as brand_id,
         br.canonical_name as brand,
         bt.dom_type as entity_type,
         r.articles,
         r.title_articles,
         round(100.0 * r.articles / nullif(t.denom, 0), 1) as share_pct,
         r.total_count
  from ranked r
  cross join tot t
  join brand_type bt on bt.canonical_id = r.canonical_id
  left join brands br on br.id = r.canonical_id
  where r.rnk > v_offset
    and r.rnk <= v_offset + v_limit
  order by r.articles desc, r.canonical_id;
end;
$function$;
