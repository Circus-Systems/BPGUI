-- Phase 0 (1/4): canonical brand registry + alias mapping.
-- Foundation for correct per-brand aggregation. Before this, NCL / NCLH /
-- Norwegian / Norwegian Cruise Line were counted as separate brands, so every
-- headline Brief number was fragmented and understated.
-- Applied to Supabase project BPG (bqfhxzgcogczdmoqyywc) on 2026-07-01.

create table if not exists public.brands (
  id                   bigint generated always as identity primary key,
  canonical_name       text not null unique,
  display_name         text,
  vertical             text,
  entity_type_override text,                       -- pins entity_type (e.g. iTravel -> company)
  parent_brand_id      bigint references public.brands(id),
  is_bpg_client        boolean not null default false,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.brand_aliases (
  id              bigint generated always as identity primary key,
  alias           text not null,
  brand_id        bigint not null references public.brands(id) on delete cascade,
  match_type      text not null default 'exact',
  source_of_truth text not null default 'auto',    -- 'auto' | 'manual'
  created_at      timestamptz not null default now()
);
create unique index if not exists brand_aliases_lower_alias_uidx on public.brand_aliases (lower(alias));
create index if not exists brand_aliases_brand_id_idx on public.brand_aliases (brand_id);

-- Backlink on article_entities (nullable, additive). A perf/queue aid;
-- brand_coverage also matches on the alias array so correctness holds
-- regardless of backfill state.
alter table public.article_entities add column if not exists canonical_id bigint;
create index if not exists article_entities_canonical_id_idx on public.article_entities (canonical_id);

-- Lock down like the rest of the schema: RLS on, no policy -> only service_role
-- and SECURITY DEFINER functions can read these tables.
alter table public.brands enable row level security;
alter table public.brand_aliases enable row level security;
