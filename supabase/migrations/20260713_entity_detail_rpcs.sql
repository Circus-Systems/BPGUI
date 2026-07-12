-- ============================================================================
-- Entity Detail modal RPCs for BPG
-- Mirrors public.brand_articles resolution (canonical_id OR alias entity_name),
-- so both canonical brands (e.g. 'Qantas') and raw uncanonicalised entity names
-- (e.g. 'ATIA') resolve correctly. Read-only; STABLE SECURITY DEFINER.
--
-- Authored and EXPLAIN-validated read-only against production by the data
-- agent before applying:
--   entity_monthly_trend: Qantas 12mo 21.9ms cold; 240mo 67ms warm
--   entity_articles:      Qantas 12mo 12.3ms cold; 240mo (~15.3k rows) 1.9s
--                         cold / <100ms warm; ATIA (uncanonicalised) 17.6ms
--   Reconciliation RPC1 sum(articles) == RPC2 total_count: exact by
--   construction (total_count computed on the entity side, join only the page)
--   Unknown names return 0 rows, no error.
--
-- UI notes: default window 12 months ("all time" = explicitly heavier);
-- pre-2005 rows silently excluded (epoch guard); 386 corpus-wide orphan
-- entity rows may render a short page while total_count still counts them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC 1: entity_monthly_trend
--   Distinct articles per month x source for the chart. Dedups brand x article
--   (an article counts once even with multiple alias rows); title_articles
--   counts an article if ANY matching alias row has in_title = 1.
-- ----------------------------------------------------------------------------
create or replace function public.entity_monthly_trend(
  p_name    text,
  p_sources text[],
  p_months  int default 12
)
returns table(
  month          date,
  source_id      text,
  articles       bigint,
  title_articles bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_brand_id bigint;
  v_aliases  text[];
  v_start    timestamptz;
begin
  -- Resolve like brand_articles: if the name is a known alias, canonicalise and
  -- pull all its aliases; otherwise treat the raw name as its own single alias.
  select ba.brand_id into v_brand_id
  from brand_aliases ba
  where lower(ba.alias) = lower(p_name)
  limit 1;

  if v_brand_id is not null then
    select array_agg(alias) into v_aliases from brand_aliases where brand_id = v_brand_id;
  else
    v_aliases := array[p_name];
  end if;

  -- Window: last LEAST(p_months,240) months floored to month start, and never
  -- earlier than 2005-01-01 (epoch / garbage-date guard). p_months clamped >= 1.
  v_start := greatest(
               date_trunc('month', now())
                 - make_interval(months => least(greatest(coalesce(p_months, 12), 1), 240) - 1),
               timestamptz '2005-01-01'
             );

  return query
  with matched as (
    select ae.source_id,
           ae.external_id,
           date_trunc('month', ae.published_at_ts)::date as m,
           max(ae.in_title) as in_title_any
    from article_entities ae
    where (ae.canonical_id = v_brand_id or ae.entity_name = any(v_aliases))
      and ae.source_id = any(p_sources)
      and ae.published_at_ts >= v_start
    group by ae.source_id, ae.external_id, date_trunc('month', ae.published_at_ts)::date
  )
  select mt.m,
         mt.source_id,
         count(*)::bigint,
         count(*) filter (where mt.in_title_any = 1)::bigint
  from matched mt
  group by mt.m, mt.source_id
  order by mt.m, mt.source_id;
end;
$function$;

-- ----------------------------------------------------------------------------
-- RPC 2: entity_articles
--   One row per distinct article (max in_title across alias rows), joined to
--   articles for display fields. NO ae_is_material filter, NO dedup_articles
--   helper — shows everything so the list total reconciles with the chart.
--
--   total_count is computed on the entity side (count(*) OVER () before the
--   article join) so it equals entity_monthly_trend's summed articles EXACTLY
--   for identical (p_name, p_sources, p_months). Only the visible page is
--   joined to articles, which keeps large windows fast (5.5x vs count-over-join).
--
--   published_at_ts == to_ts_immutable(articles.published_at) (verified
--   byte-identical corpus-wide), so paging on published_at_ts matches the
--   returned published_at column.
-- ----------------------------------------------------------------------------
create or replace function public.entity_articles(
  p_name    text,
  p_sources text[],
  p_months  int default 12,
  p_limit   int default 50,
  p_offset  int default 0
)
returns table(
  published_at timestamptz,
  source_id    text,
  title        text,
  url          text,
  word_count   int,
  author_name  text,
  in_title     int,
  is_sponsored int,
  total_count  bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
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
  v_limit  := least(greatest(coalesce(p_limit, 50), 1), 100);  -- clamp to [1,100]
  v_offset := greatest(coalesce(p_offset, 0), 0);              -- clamp to >= 0

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

-- ----------------------------------------------------------------------------
-- Grants (project revoked default PUBLIC execute; grant the UI roles explicitly).
-- Neither name is among the 7 sensitive functions watched by security_anon_grants.
-- ----------------------------------------------------------------------------
grant execute on function public.entity_monthly_trend(text, text[], int)
  to anon, authenticated, service_role;
grant execute on function public.entity_articles(text, text[], int, int, int)
  to anon, authenticated, service_role;
