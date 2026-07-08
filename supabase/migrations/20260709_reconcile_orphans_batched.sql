-- Pre-send QA (2026-07-09): reconcile_python_orphans() timed out (57014) six
-- consecutive nights (2026-07-03..08) — a single DELETE over the accumulated
-- 226,549 orphan rows exceeds the statement timeout, and because the sync is
-- one-way the backlog only grows. Replaced with a ctid-batched delete;
-- callers (tools/reconcile_orphans.py in the BPG repo) loop until it returns
-- 0. The 226k backlog was drained the same day with this function.
--
-- Also drops three exact-duplicate indexes on the hot article_entities table
-- (idx_ae_source/idx_ae_entity/idx_ae_type duplicated the
-- idx_article_entities_* definitions — pure write amplification).
--
-- Applied to Supabase project BPG on 2026-07-09 via MCP (migration
-- reconcile_orphans_batched); this file is the version-controlled record.

drop function if exists public.reconcile_python_orphans();

create function public.reconcile_python_orphans(p_limit integer default 20000)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare deleted integer;
begin
  with victims as (
    select ae.ctid as rid
    from public.article_entities ae
    where ae.method = 'python'
      and exists (
        select 1 from public.article_entities u
        where u.source_id = ae.source_id
          and u.external_id = ae.external_id
          and u.method in ('gemma','haiku')
      )
    limit p_limit
  ), d as (
    delete from public.article_entities ae
    using victims v
    where ae.ctid = v.rid
    returning 1
  )
  select count(*) into deleted from d;
  return deleted;
end $$;

-- Default privileges no longer hand out PUBLIC execute; grant explicitly.
grant execute on function public.reconcile_python_orphans(integer) to service_role;

drop index if exists public.idx_ae_source;
drop index if exists public.idx_ae_entity;
drop index if exists public.idx_ae_type;

-- Demo-protection warmer (created the same day via cron.schedule, recorded
-- here): brand_coverage at 365d peaked at 7.4s of the authenticated 8s
-- statement budget when cold. Keeps the key-account payloads hot.
-- select cron.schedule('warm-brand-coverage', '*/10 * * * *', $job$
--   select public.brand_coverage(b, array['travel-daily'], array[...12 travel sources...], 365)
--   from unnest(array['NCL','Flight Centre']) as b $job$);
