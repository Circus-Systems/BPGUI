-- Pre-send QA (2026-07-09): execute_raw_sql was anon-callable AGAIN — the
-- earlier fix revoked explicit anon/authenticated grants but left the default
-- PUBLIC grant ("=X/postgres"), which anon inherits. Confirmed exploitable
-- with the shipped anon key (ran SQL as postgres, read auth.users) before fix;
-- all functions below return 401 to the anon key after it.
--
-- Applied to Supabase project BPG on 2026-07-09 via MCP
-- (migration lockdown_definer_functions_public_grant); this file is the
-- version-controlled record.

-- 1. Arbitrary-SQL escape hatch: service_role only.
revoke execute on function public.execute_raw_sql(text) from public, anon, authenticated;
alter function public.execute_raw_sql(text) set search_path = public, pg_temp;

-- 2. Internal core (anon calls must go through the brand_coverage wrapper).
revoke execute on function public.brand_coverage_core(text, text[], text[], integer) from public, anon, authenticated;

-- 3. Maintenance / mutating RPCs: cron + service_role only.
revoke execute on function public.reconcile_python_orphans() from public, anon, authenticated;
revoke execute on function public.cluster_articles_batch(integer, integer) from public, anon, authenticated;
revoke execute on function public.cluster_articles(integer) from public, anon, authenticated;
revoke execute on function public.cluster_articles(integer, boolean) from public, anon, authenticated;
revoke execute on function public.redetect_sponsored() from public, anon, authenticated;
revoke execute on function public.set_article_entity_canonical_id() from public, anon, authenticated;

-- 4. Prevent recurrence: functions created by postgres (MCP migrations) no
--    longer get PUBLIC execute by default. Read RPCs must be granted
--    explicitly (grant execute ... to anon, authenticated) from now on.
alter default privileges in schema public revoke execute on functions from public;
