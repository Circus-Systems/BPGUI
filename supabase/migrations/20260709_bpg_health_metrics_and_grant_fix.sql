-- Monitoring surface + security follow-up (2026-07-09).
--
-- (1) bpg_health_metrics(): read-only, service_role-only RPC that returns every
--     cloud-side signal the health check needs in one round-trip, so the
--     monitor never touches execute_raw_sql. Consumed by tools/healthcheck.py
--     (BPG repo) via com.bpg.healthcheck.
--
-- (2) Grant fix: the monitor's own sensitive_anon_grants signal immediately
--     flagged that the recreated reconcile_python_orphans(integer) was
--     anon-callable. Root cause worth remembering: Supabase's default
--     privileges auto-GRANT execute to anon+authenticated on every new public
--     function, and a plain CREATE also carries the PUBLIC grant — so
--     `revoke ... from public` alone is NOT enough. Recreated sensitive
--     functions need anon, authenticated, AND public revoked explicitly.
--
-- Applied to Supabase project BPG on 2026-07-09 via MCP; this file is the
-- version-controlled record.

create or replace function public.bpg_health_metrics()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare cron_fail integer;
begin
  begin
    select count(*) into cron_fail
    from cron.job_run_details
    where status = 'failed' and start_time > now() - interval '24 hours';
  exception when others then cron_fail := -1;
  end;

  return jsonb_build_object(
    'orphan_python', (
      select count(*) from public.article_entities ae
      where ae.method = 'python'
        and (ae.source_id, ae.external_id) in (
          select u.source_id, u.external_id from public.article_entities u
          where u.method in ('gemma','haiku'))),
    'garbage_entities', (
      select count(*) from public.article_entities
      where length(trim(entity_name)) < 2),
    'sensitive_anon_grants', (
      select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('execute_raw_sql','brand_coverage_core',
          'reconcile_python_orphans','cluster_articles','cluster_articles_batch',
          'redetect_sponsored','set_article_entity_canonical_id')
        and has_function_privilege('anon', p.oid, 'execute')),
    'cron_failures_24h', cron_fail,
    'newest_article_iso', (select max(published_at) from public.articles),
    'total_articles', (select count(*) from public.articles),
    'sponsored_flagged', (select count(*) from public.articles where is_sponsored = 1)
  );
end $$;

revoke execute on function public.bpg_health_metrics() from public, anon, authenticated;
grant execute on function public.bpg_health_metrics() to service_role;

-- Close the anon hole the monitor found on the recreated batched-reconcile fn.
revoke execute on function public.reconcile_python_orphans(integer) from public, anon, authenticated;
grant execute on function public.reconcile_python_orphans(integer) to service_role;