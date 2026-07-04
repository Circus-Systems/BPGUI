-- P1 quick-wins + Phase-0 follow-ups. Applied to Supabase project BPG on
-- 2026-07-05 (via MCP); this file is the version-controlled record.
--
-- 1. cluster_articles_batch(p_limit, p_max_age_days) — bounded, resumable
--    story-clustering batch (lights up Brief slide 10). The original
--    cluster_articles(lookback) processes a whole window in one transaction
--    and rolls back wholesale on statement timeout; this variant clusters at
--    most p_limit unclustered articles per call (newest-first), uses an
--    index-friendly published_at range predicate instead of abs(epoch diff),
--    and scopes maintenance updates to the clusters touched in the batch.
--    Scheduled via pg_cron: 'cluster-articles-batch' */2 * * * *
--    -> select public.cluster_articles_batch(300, 365);
--    (drains the ~28.6k-article 365-day backlog in ~3h, then is the
--    steady-state incremental). Revoked from anon/authenticated.
--
-- 2. list_brands — grouped by canonical brand via brands/brand_aliases:
--    NCL + Norwegian Cruise Line + ship names roll up to one picker row with
--    summed counts; entity_type honours brands.entity_type_override (iTravel
--    -> company) else the type carrying the most articles; unmapped names
--    pass through. Signature/columns unchanged -> zero frontend change.
--
-- 3. brand_articles(brand_name, sources, period_days) — slide-14 "All the
--    Proof" appendix: every article covering a brand (alias-aware), Date+Link,
--    uncapped, newest-first. Part of the UI data API (anon/authenticated).

create or replace function public.cluster_articles_batch(
  p_limit integer default 300,
  p_max_age_days integer default 365
) returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  rec record;
  matched_cluster bigint;
  matched_sim real;
  new_cluster bigint;
  new_count int := 0;
  added_count int := 0;
  processed int := 0;
  touched bigint[] := '{}';
  remaining bigint;
  start_time timestamptz := clock_timestamp();
begin
  for rec in
    select a.source_id, a.external_id, a.title,
           to_ts_immutable(a.published_at) as published_at
    from articles a
    left join article_cluster_members m
      on m.source_id = a.source_id and m.external_id = a.external_id
    where m.cluster_id is null
      and to_ts_immutable(a.published_at) >= now() - (p_max_age_days || ' days')::interval
      and a.title is not null
      and length(a.title) > 10
      and a.title !~* '^(PD|TD|CW|KO|TW) for '
    order by to_ts_immutable(a.published_at) desc
    limit p_limit
  loop
    processed := processed + 1;
    matched_cluster := null; matched_sim := null;

    select m.cluster_id, similarity(b.title, rec.title)
      into matched_cluster, matched_sim
    from articles b
    join article_cluster_members m
      on m.source_id = b.source_id and m.external_id = b.external_id
    where to_ts_immutable(b.published_at)
            between rec.published_at - interval '3 days'
                and rec.published_at + interval '3 days'
      and (b.source_id != rec.source_id or b.external_id != rec.external_id)
      and (
        similarity(b.title, rec.title) >= 0.55
        or (
          similarity(b.title, rec.title) >= 0.35
          and (
            select count(*) from article_entities ae1
            join article_entities ae2 on ae1.entity_name = ae2.entity_name
            where ae1.source_id = rec.source_id and ae1.external_id = rec.external_id
              and ae2.source_id = b.source_id and ae2.external_id = b.external_id
          ) >= 2
        )
      )
    order by similarity(b.title, rec.title) desc
    limit 1;

    if matched_cluster is not null then
      insert into article_cluster_members (cluster_id, source_id, external_id, similarity)
      values (matched_cluster, rec.source_id, rec.external_id, matched_sim)
      on conflict do nothing;
      added_count := added_count + 1;
      touched := touched || matched_cluster;
    else
      insert into story_clusters (cluster_key, canonical_title, first_published_at)
      values (
        md5(rec.source_id || '::' || rec.external_id || '::' || rec.published_at::text),
        rec.title, rec.published_at
      )
      on conflict (cluster_key) do nothing
      returning id into new_cluster;
      if new_cluster is not null then
        insert into article_cluster_members (cluster_id, source_id, external_id, similarity, is_first)
        values (new_cluster, rec.source_id, rec.external_id, 1.0, true);
        new_count := new_count + 1;
        touched := touched || new_cluster;
      end if;
    end if;
  end loop;

  update story_clusters sc
  set article_count = sub.cnt, source_count = sub.src_cnt,
      first_published_at = sub.first_pub, updated_at = now()
  from (
    select m.cluster_id, count(*) as cnt, count(distinct m.source_id) as src_cnt,
           min(to_ts_immutable(a.published_at)) as first_pub
    from article_cluster_members m
    join articles a on a.source_id = m.source_id and a.external_id = m.external_id
    where m.cluster_id = any(touched)
    group by m.cluster_id
  ) sub
  where sc.id = sub.cluster_id;

  update article_cluster_members m
  set is_first = (
    to_ts_immutable(a.published_at) = (
      select min(to_ts_immutable(a2.published_at))
      from article_cluster_members m2
      join articles a2 on a2.source_id = m2.source_id and a2.external_id = m2.external_id
      where m2.cluster_id = m.cluster_id
    )
  )
  from articles a
  where a.source_id = m.source_id and a.external_id = m.external_id
    and m.cluster_id = any(touched);

  with entity_totals as (
    select m.cluster_id, ae.entity_name, sum(ae.mention_count) as total_mentions,
           row_number() over (partition by m.cluster_id order by sum(ae.mention_count) desc) as rn
    from article_cluster_members m
    join article_entities ae on ae.source_id = m.source_id and ae.external_id = m.external_id
    where m.cluster_id = any(touched)
    group by m.cluster_id, ae.entity_name
  )
  update story_clusters sc
  set dominant_entity = et.entity_name
  from entity_totals et
  where et.rn = 1 and sc.id = et.cluster_id;

  select count(*) into remaining
  from articles a
  left join article_cluster_members m
    on m.source_id = a.source_id and m.external_id = a.external_id
  where m.cluster_id is null
    and to_ts_immutable(a.published_at) >= now() - (p_max_age_days || ' days')::interval
    and a.title is not null and length(a.title) > 10
    and a.title !~* '^(PD|TD|CW|KO|TW) for ';

  return jsonb_build_object(
    'processed', processed,
    'new_clusters', new_count,
    'added_to_existing', added_count,
    'remaining_in_window', remaining,
    'duration_seconds', round(extract(epoch from (clock_timestamp() - start_time))::numeric, 1)
  );
end $$;

revoke execute on function public.cluster_articles_batch(integer, integer) from anon, authenticated;

-- pg_cron schedule (idempotent guard):
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'cluster-articles-batch') then
    perform cron.schedule('cluster-articles-batch', '*/2 * * * *',
                          'select public.cluster_articles_batch(300, 365);');
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.list_brands(vertical_sources text[], entity_type_filter text DEFAULT NULL::text, min_articles integer DEFAULT 2, result_limit integer DEFAULT 200)
 RETURNS TABLE(entity_name text, entity_type text, article_count bigint, total_mentions bigint, slug text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  WITH stats AS (
    SELECT COALESCE(b.canonical_name, bs.entity_name) AS grp_name,
           COALESCE(b.entity_type_override, bs.entity_type) AS etype,
           bs.article_count, bs.total_mentions
    FROM brand_stats bs
    LEFT JOIN brand_aliases ba ON lower(ba.alias) = lower(bs.entity_name)
    LEFT JOIN brands b ON b.id = ba.brand_id
    WHERE bs.source_id = ANY(vertical_sources)
  ),
  agg AS (
    SELECT grp_name, etype,
           SUM(article_count)::bigint AS ac,
           SUM(total_mentions)::bigint AS tm
    FROM stats
    GROUP BY grp_name, etype
  ),
  best_type AS (
    SELECT DISTINCT ON (grp_name) grp_name, etype
    FROM agg
    ORDER BY grp_name, ac DESC
  )
  SELECT a.grp_name AS entity_name,
         bt.etype AS entity_type,
         SUM(a.ac)::bigint AS article_count,
         SUM(a.tm)::bigint AS total_mentions,
         regexp_replace(lower(a.grp_name), '[^a-z0-9]+', '-', 'g') AS slug
  FROM agg a
  JOIN best_type bt USING (grp_name)
  WHERE (entity_type_filter IS NULL OR bt.etype = entity_type_filter)
  GROUP BY a.grp_name, bt.etype
  HAVING SUM(a.ac) >= min_articles
  ORDER BY SUM(a.tm) DESC
  LIMIT result_limit;
$function$;

create or replace function public.brand_articles(
  brand_name text,
  sources text[],
  period_days integer default 365
) returns table(
  published_at text,
  source_id text,
  title text,
  url text,
  word_count integer,
  is_sponsored integer
) language plpgsql security definer
set search_path = public as $$
declare
  cutoff timestamptz := now() - (period_days || ' days')::interval;
  v_brand_id bigint;
  v_aliases text[];
begin
  select ba.brand_id into v_brand_id from brand_aliases ba
   where lower(ba.alias) = lower(brand_name) limit 1;
  if v_brand_id is not null then
    select array_agg(alias) into v_aliases from brand_aliases where brand_id = v_brand_id;
  else
    v_aliases := array[brand_name];
  end if;

  return query
  select distinct a.published_at, a.source_id, a.title, a.url, a.word_count, a.is_sponsored
  from article_entities ae
  join articles a on a.source_id = ae.source_id and a.external_id = ae.external_id
  where (ae.canonical_id = v_brand_id or ae.entity_name = any(v_aliases))
    and ae.published_at_ts >= cutoff
    and a.source_id = any(sources)
  order by a.published_at desc;
end $$;
