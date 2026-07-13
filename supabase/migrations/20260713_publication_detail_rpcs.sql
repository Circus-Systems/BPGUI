-- ============================================================================
-- Publication Detail modal RPCs (publication-side mirror of entity_* funcs).
-- Authored and EXPLAIN-validated read-only against production by the data
-- agent before applying:
--   publication_brands:      travel-daily 12mo ~72ms warm; 240mo ~6.7s cold
--   publication_brand_trend: travel-daily 12mo ~104ms warm; 240mo ~6.7s cold
--   travel-today-nz: 3 clean rows, no 'Other'; nonsense source: 0 rows, no error
--   Sanity (travel-daily/12mo): Qantas 354 (7.1%), Virgin Australia 184,
--   Flight Centre 180, Jetstar 92, Air NZ 81; 1,339 in-scope brands; 76.9%
--   of the source's articles mention an in-scope brand.
--
-- Style mirrors entity_monthly_trend / entity_articles:
--   plpgsql, STABLE, SECURITY DEFINER, SET search_path=public,
--   clamped params, month window = date_trunc('month'), floor 2005-01-01,
--   months clamp [1,240].
-- Brand scope: canonical brands (canonical_id NOT NULL) whose WINDOW-LOCAL
--   dominant entity_type (mode over the window's own mention rows) is
--   'company' or 'industry_body'.
-- PERF NOTE (load-bearing): the row-source scan filters ONLY
--   (source_id, published_at_ts); canonical_id IS NOT NULL is applied
--   downstream so the plpgsql GENERIC plan cannot choose
--   article_entities_canonical_id_idx (a 769k-row bitmap adding ~0.5s).
--   Do not "optimize" by pushing it back into the scan.
-- Semantics:
--   RPC1 'Other' is mention-based: per-month sum of each non-top brand's
--   distinct-article count (an article naming two non-top brands counts
--   twice in Other) — consistent with the top series and brand_pub_month.
--   RPC2 share_pct denominator = distinct articles mentioning >=1 in-scope
--   brand in the source+window, so shares can sum >100% (multi-brand
--   articles) — expected.
--   RPC2 brand = canonical_name (guaranteed brand_aliases match so the UI
--   can chain into the entity modal); RPC1 brand = display label.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC 1: publication_brand_trend
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publication_brand_trend(
  p_source text,
  p_months int DEFAULT 12,
  p_top    int DEFAULT 20
)
RETURNS TABLE(month date, brand_id bigint, brand text, articles bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz;
  v_top   int;
begin
  v_start := greatest(
               date_trunc('month', now())
                 - make_interval(months => least(greatest(coalesce(p_months, 12), 1), 240) - 1),
               timestamptz '2005-01-01'
             );
  v_top   := least(greatest(coalesce(p_top, 20), 5), 30);

  return query
  with base as (
    select ae.canonical_id,
           ae.external_id,
           ae.entity_type,
           date_trunc('month', ae.published_at_ts)::date as m
    from article_entities ae
    where ae.source_id = p_source
      and ae.published_at_ts >= v_start          -- canonical filtered downstream (perf note)
  ),
  brand_type as (                                 -- window-local dominant type per brand
    select b.canonical_id,
           mode() within group (order by b.entity_type) as dom_type
    from base b
    where b.canonical_id is not null
    group by b.canonical_id
  ),
  scoped as (
    select b.canonical_id, b.external_id, b.m
    from base b
    join brand_type bt on bt.canonical_id = b.canonical_id
    where bt.dom_type in ('company', 'industry_body')
  ),
  brand_month as (                                -- per-brand, per-month distinct articles
    select s.canonical_id, s.m,
           count(distinct s.external_id)::bigint as articles
    from scoped s
    group by s.canonical_id, s.m
  ),
  brand_total as (                                -- rank brands by whole-window distinct articles
    select bm.canonical_id,
           row_number() over (order by sum(bm.articles) desc, bm.canonical_id) as rnk
    from brand_month bm
    group by bm.canonical_id
  ),
  top_rows as (
    select bm.m as month,
           bm.canonical_id as brand_id,
           coalesce(br.display_name, br.canonical_name) as brand,
           bm.articles
    from brand_month bm
    join brand_total bt on bt.canonical_id = bm.canonical_id and bt.rnk <= v_top
    left join brands br on br.id = bm.canonical_id
  ),
  other_rows as (
    select bm.m as month,
           null::bigint as brand_id,
           'Other'::text as brand,
           sum(bm.articles)::bigint as articles   -- mention-based (per-brand distinct summed)
    from brand_month bm
    join brand_total bt on bt.canonical_id = bm.canonical_id and bt.rnk > v_top
    group by bm.m
  )
  select tr.month, tr.brand_id, tr.brand, tr.articles from top_rows tr
  union all
  select o.month, o.brand_id, o.brand, o.articles from other_rows o
  order by 1, 4 desc nulls last;
end;
$function$;

-- ----------------------------------------------------------------------------
-- RPC 2: publication_brands
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publication_brands(
  p_source text,
  p_months int DEFAULT 12,
  p_limit  int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  brand_id       bigint,
  brand          text,
  entity_type    text,
  articles       bigint,
  title_articles bigint,
  share_pct      numeric,
  total_count    bigint
)
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
  v_limit  := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  with base as (
    select ae.canonical_id, ae.external_id, ae.entity_type, ae.in_title
    from article_entities ae
    where ae.source_id = p_source
      and ae.published_at_ts >= v_start          -- canonical filtered downstream (perf note)
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
  agg as (                                        -- per-brand + grand-total (denominator) in one pass
    select s.canonical_id,
           count(distinct s.external_id)::bigint as articles,
           count(distinct s.external_id) filter (where s.in_title = 1)::bigint as title_articles,
           grouping(s.canonical_id) as g
    from scoped s
    group by grouping sets ((s.canonical_id), ())
  ),
  tot as (
    select a2.articles as denom                   -- qualified: unqualified collided with the
    from agg a2                                   -- RETURNS TABLE OUT param (42702 at runtime)
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

-- ----------------------------------------------------------------------------
-- GRANTS (project revoked default PUBLIC; grant explicitly). Read-only
-- reporting RPCs — same posture as entity_*. Not among the 7
-- healthcheck-sensitive functions; touches no existing function.
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.publication_brand_trend(text, int, int)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.publication_brands(text, int, int, int)
  TO anon, authenticated, service_role;
