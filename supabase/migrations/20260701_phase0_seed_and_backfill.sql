-- Phase 0 (2/4): bootstrap the brand registry from the existing corpus + backfill.
-- Data-dependent (reads article_entities), idempotent via ON CONFLICT.
-- Applied to Supabase project BPG on 2026-07-01.

-- 1. Demo/manual merge: Norwegian Cruise Line (the cruise line).
--    Unambiguous aliases only — deliberately EXCLUDES "Norwegian" (airline
--    collision) and keeps NCLH / Oceania / Regent as separate brands.
insert into brands (canonical_name, display_name, vertical, is_bpg_client, notes)
values ('Norwegian Cruise Line','Norwegian Cruise Line','cruise',false,
        'manual merge (Phase 0): NCL line incl. ship names; excludes ambiguous "Norwegian" and separate NCLH/Oceania/Regent')
on conflict (canonical_name) do nothing;
insert into brand_aliases (alias, brand_id, match_type, source_of_truth)
select a, (select id from brands where canonical_name='Norwegian Cruise Line'), 'exact','manual'
from unnest(array['Norwegian Cruise Line','NCL','Norwegian Spirit','Norwegian Epic',
                  'Norwegian Jewel','Norwegian Sun','Norwegian Escape']) a
on conflict do nothing;

-- 2. iTravel entity_type correction (client ask 6): a travel agency/network,
--    not an industry body. entity_type_override wins over the extractor.
insert into brands (canonical_name, display_name, vertical, entity_type_override, notes)
select 'iTravel','iTravel','travel','company','entity_type correction (ask 6): travel agency/network, not industry_body'
where exists (select 1 from article_entities where entity_name='iTravel')
on conflict (canonical_name) do nothing;
insert into brand_aliases (alias, brand_id, source_of_truth)
select 'iTravel', id, 'manual' from brands where canonical_name='iTravel'
on conflict do nothing;

-- 3. Auto-identity: one canonical brand per common company entity_name (>= 3
--    articles) that isn't already an alias. Keeps list_brands/brand_coverage
--    working with zero manual effort; merges happen later via the admin queue.
insert into brands (canonical_name, notes)
select x.entity_name, 'auto-seeded identity'
from (
  select entity_name, count(distinct (source_id,external_id)) arts
  from article_entities where entity_type='company'
  group by entity_name having count(distinct (source_id,external_id)) >= 3
) x
where not exists (select 1 from brand_aliases ba where lower(ba.alias)=lower(x.entity_name))
on conflict (canonical_name) do nothing;

insert into brand_aliases (alias, brand_id, source_of_truth)
select b.canonical_name, b.id, 'auto'
from brands b
where b.notes='auto-seeded identity'
  and not exists (select 1 from brand_aliases ba where ba.brand_id=b.id)
on conflict do nothing;

-- 4. Remove redundant orphan brands (case-variant dupes that lost their alias
--    to the case-insensitive unique index; their articles map to the surviving
--    brand via the case-insensitive backfill below).
delete from brands b where not exists (select 1 from brand_aliases ba where ba.brand_id=b.id);

-- 5. One-time backfill of article_entities.canonical_id (case-insensitive).
update article_entities ae
set canonical_id = ba.brand_id
from brand_aliases ba
where lower(ae.entity_name) = lower(ba.alias)
  and ae.canonical_id is distinct from ba.brand_id;
