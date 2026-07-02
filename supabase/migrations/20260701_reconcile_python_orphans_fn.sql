-- Nightly reconcile for the Python -> Gemma tagging cascade.
-- Deletes cloud method='python' placeholder rows for any article that already
-- has an authoritative (gemma/haiku) row. These accrue because Gemma deletes
-- placeholders locally but the one-way Supabase sync never propagates deletes.
-- Called by the com.bpg.reconcile launchd job (tools/reconcile_orphans.py) via
-- the service-role key. Applied to Supabase project BPG on 2026-07-01.

create or replace function public.reconcile_python_orphans()
returns integer language plpgsql security definer
set search_path = public as $$
declare deleted integer;
begin
  with d as (
    delete from public.article_entities ae
    where ae.method = 'python'
      and exists (
        select 1 from public.article_entities u
        where u.source_id = ae.source_id
          and u.external_id = ae.external_id
          and u.method in ('gemma','haiku')
      )
    returning 1
  )
  select count(*) into deleted from d;
  return deleted;
end $$;

-- Destructive: keep it off the public API surface (service_role/postgres only).
revoke execute on function public.reconcile_python_orphans() from anon, authenticated;
