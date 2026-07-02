-- Phase 0 (3/4): write-time canonicalisation trigger.
-- New rows synced from the Mac Studio self-populate canonical_id, so it stays
-- complete going forward and brand_coverage can rely on the indexed join.
-- Applied to Supabase project BPG on 2026-07-01.

create or replace function public.set_article_entity_canonical_id()
returns trigger language plpgsql security definer as $$
begin
  select ba.brand_id into new.canonical_id
  from public.brand_aliases ba
  where lower(ba.alias) = lower(new.entity_name)
  limit 1;
  return new;
end $$;

drop trigger if exists trg_ae_set_canonical_id on public.article_entities;
create trigger trg_ae_set_canonical_id
before insert or update of entity_name on public.article_entities
for each row execute function public.set_article_entity_canonical_id();
