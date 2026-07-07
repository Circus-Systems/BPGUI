-- Defect fix (authed QA finding #2): duplicate campaign insertions with NULL
-- ad_type/page_position bypassed the original UNIQUE constraint — Postgres
-- treats NULLs as distinct, so two identical rows with a NULL optional column
-- both inserted (observed: inserted=2/skipped=0 for an identical pair).
--
-- Fix: the coalesced unique index is the authoritative dedupe; the original
-- five-column constraint is dropped (a first drop attempt guessed the
-- auto-generated name wrong — real name ends in "ad_type__key" — and
-- silently no-op'd, which is why this migration exists separately).
--
-- Verified through the live API 2026-07-06:
--   identical pair w/ NULL page_position -> inserted 1, skipped 1
--   identical pair w/ all-NULL optionals -> inserted 1, skipped 1
--   re-upload of existing row            -> inserted 0, skipped 1
--   distinct row (different ad_type)     -> inserted 1, skipped 0
--
-- Applied to Supabase project BPG on 2026-07-06 (via MCP); this file is the
-- version-controlled record.

alter table public.campaign_insertions
  drop constraint if exists campaign_insertions_campaign_id_run_date_source_id_ad_type__key;

create unique index if not exists campaign_insertions_dedupe_uidx
  on public.campaign_insertions
  (campaign_id, run_date, source_id, coalesce(ad_type,''), coalesce(page_position,''));
