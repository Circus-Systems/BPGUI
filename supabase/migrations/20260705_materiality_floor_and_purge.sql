-- Tagging-quality hardening (audit-driven). Applied to Supabase project BPG on
-- 2026-07-05; this file is the version-controlled record.
--
-- Context: a blind 40-article judge audit measured 80.2% strict entity
-- precision, with false positives concentrated in (a) Gemma debug tokens,
-- (b) never-a-brand generic words, and (c) single low-confidence background
-- mentions. As-consumed precision after these fixes: 93.1%.
--
-- 1. ae_is_material(): a tag is MATERIAL if it has 2+ mentions, OR appears in
--    the title, OR carries confidence >= 0.5. brand_coverage, brand_articles
--    and brand_sov_by_category all filter on it (applied in migrations
--    materiality_floor_brand_rpcs + brand_coverage_materiality_floor), so
--    headline counts and the slide-14 appendix stay internally consistent.
--    brand_coverage now returns materiality_floor: true.
-- 2. Data purge (one-off, also mirrored in the Studio SQLite):
--    - 3,095 malformed Gemma rows (entity_name containing '_')
--    - 6,903 rows for never-a-brand tokens (select/none/else/company/agent/
--      destination/industry_body/cruise_line/ship_name)
--    - 27 junk auto-seeded registry brands pruned
--    - brand 'scenic' renamed to 'Scenic' (real cruise brand; name flagged as
--      an ambiguous common word — the collector matcher now requires brand
--      capitalisation + material presence for such names)
-- 3. Companion collector-side fixes live in the BPG repo (entity_matcher
--    AMBIGUOUS_BRAND_WORDS discipline; extract_gemma _valid_entity_name()
--    write-filter + hardened prompts).

create or replace function public.ae_is_material(p_mentions integer, p_in_title integer, p_confidence real)
returns boolean language sql immutable as $$
  select not (coalesce(p_mentions,0) <= 1 and coalesce(p_in_title,0) = 0 and coalesce(p_confidence,1) < 0.5)
$$;

-- (Full floored function bodies are in the applied migrations
-- materiality_floor_brand_rpcs and brand_coverage_materiality_floor in the
-- Supabase migration history; they add
--   AND ae_is_material(ae.mention_count, ae.in_title::int, ae.confidence)
-- to every article_entities predicate in brand_coverage, brand_articles and
-- brand_sov_by_category.)
