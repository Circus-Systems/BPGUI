import type { SupabaseClient } from "@supabase/supabase-js";
import { BPG_SOURCES, COMPETITOR_SOURCES, SOURCE_LABELS } from "@/lib/constants";

/**
 * Shared data assembly + constants for the Key Partner Meeting brief.
 *
 * Used by BOTH renderers:
 *  - Web preview:  /brief/[slug]  (via GET /api/brief/deck)
 *  - PPTX export:  /api/brand/[slug]/pptx
 * so the two can never drift.
 *
 * Keep this module importable from client code: no server-only imports.
 * `assembleBriefData` receives a Supabase client from the caller (API routes).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BriefConfig {
  slug: string;
  title_name: string;
  vertical: string;
  primary_source: string;
  bpg_sources: string[];
  media_competitors: string[];
  all_competitors: string[];
  enabled: boolean;
}

export interface Coverage {
  brand: string;
  period_days: number;
  generated_at: string;
  summary: {
    total_articles: number;
    total_words: number;
    avg_words: number;
    sponsored_count: number;
    bpg_articles: number;
    competitor_articles: number;
  };
  by_publication: Array<{
    source_id: string;
    article_count: number;
    total_words: number;
    sponsored_count: number;
    is_bpg: boolean;
  }>;
  unique_coverage: Array<{
    id: number;
    canonical_title: string;
    first_published_at: string;
    article_count: number;
    sources: string[];
  }>;
  shared_coverage_count: number;
  missed_coverage: Array<{
    id: number;
    canonical_title: string;
    first_published_at: string;
    article_count: number;
    sources: string[];
  }>;
  first_to_publish: {
    bpg_first: number;
    competitor_first: number;
    total_shared: number;
  };
  /** Uncapped counts for the S10 stat boxes (lists above are capped at 30). */
  unique_coverage_count?: number;
  missed_coverage_count?: number;
  timeline: Array<{ week: string; source_id: string; articles: number }>;
  top_articles: Array<{
    source_id: string;
    external_id: string;
    title: string;
    url: string;
    published_at: string;
    word_count: number;
    author_name: string | null;
    mention_count: number;
    in_title: number;
  }>;
  journalists: Array<{
    author_name: string;
    source_id: string;
    article_count: number;
  }>;
  events: Array<{
    event_name: string;
    event_date: string;
    source_id: string;
    attended_by: string | null;
  }>;
  spend_vs_coverage: Array<{
    source_id: string;
    spend_aud: number;
    article_count: number;
  }>;
  ave: {
    article_ave: number;
    total_articles: number;
    earned_only?: boolean;
    by_source: Array<{ source_id: string; articles: number; ave_aud: number }>;
  };
}

export interface PubStat {
  source_id: string;
  article_count: number;
  avg_word_count: number;
  sponsored_pct: number;
  articles_per_day: number;
  last_published: string | null;
}

export interface RivalsInfo {
  brand_canonical: string;
  rivals: string[];
  sector: string | null;
  source_of_truth: string | null;
}

export interface SovRow {
  brand: string;
  source_id: string;
  article_count: number;
}

export interface AdvSovRow {
  advertiser: string;
  spend_aud: number;
  insertion_periods: number;
}

export interface BrandArticleRow {
  published_at: string;
  source_id: string;
  title: string;
  url: string;
  word_count: number;
  is_sponsored: boolean;
}

export interface CampaignRow {
  id: string | number;
  brand: string;
  name: string;
  period_start: string | null;
  period_end: string | null;
  spend_aud: number | null;
  // TEXT in the DB by design — carries "2x bonus eDMs" as well as plain numbers
  bonus_ad_value: string | null;
  estimated_reach: number | null;
  creative_url: string | null;
}

/** Decode HTML entities WordPress leaves in titles (&#8211;, &amp;, &quot; ...). */
export function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
    lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201C", rdquo: "\u201D",
  };
  return (text || "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => named[n] ?? m);
}

/** bonus_ad_value is TEXT: plain numbers get currency formatting, anything else renders verbatim. */
export function formatBonusValue(v: string | null, fmt: (n: number) => string): string {
  if (v == null || String(v).trim() === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? fmt(n) : String(v);
}

export interface InsertionRow {
  id: string | number;
  campaign_id: string | number;
  run_date: string;
  source_id: string;
  ad_type: string | null;
  page_position: string | null;
  est_readership: number | null;
  clicks: number | null;
  notes: string | null;
}

export interface YtdInsertionRow extends InsertionRow {
  campaign_name: string;
}

export interface TeamMember {
  name: string;
  role: string;
}

export interface PromoBand {
  mid: number;
  low: number;
  high: number;
}

/** One row from the brand_trend RPC (canonical brand × source × month). */
export interface BrandTrendRow {
  month: string;
  source_id: string;
  articles: number;
  title_articles: number;
  mentions: number;
}

/** S9 — prominence split: share of coverage that named the brand in the headline. */
export interface HeadlineCoverage {
  /** Articles that put the brand in the title. */
  title_articles: number;
  /** Total canonically-tagged articles mentioning the brand. */
  articles: number;
  /** title_articles / articles as a whole-number percentage. */
  pct: number;
}

/**
 * S9 — "Where your coverage comes from": one row per source, aggregated from
 * the brand_trend rows already fetched for the deck (no extra RPC). Sorted
 * by article volume, descending.
 */
export interface PublisherMixRow {
  source_id: string;
  /** Brand articles from this source across the trend window. */
  articles: number;
  /** articles / total-across-all-sources as a whole-number percentage. */
  pct: number;
  /** True when source_id is one of the host's BPG titles. */
  is_bpg: boolean;
}

export interface BriefDeckData {
  brand: string;
  slug: string;
  period_days: number;
  generated_at: string;
  host: BriefConfig;
  hostConfigFound: boolean;
  coverage: Coverage;
  /** S5 — editorial team with roles, plus where it came from */
  team: TeamMember[];
  teamSource: "journalists" | "roster" | "fallback" | "none";
  /** S7 — publication_stats_range over [primary_source, ...media_competitors] */
  contentVolume: PubStat[];
  /** S11 — sector rivals matrix (null when TD hasn't supplied one) */
  rivals: RivalsInfo | null;
  /** S11 — brand_sov_by_category rows (empty when no rivals) */
  sovByCategory: SovRow[];
  /** S12 — advertising_sov rows */
  advertisingSov: AdvSovRow[];
  /** S14 — full uncapped article list from brand_articles */
  allArticles: BrandArticleRow[];
  /** S15 — latest campaign + its insertions (null when none imported) */
  latestCampaign: { campaign: CampaignRow; insertions: InsertionRow[] } | null;
  /** S16 — every insertion this calendar year across the brand's campaigns */
  ytdInsertions: YtdInsertionRow[];
  /** S17 — saved recommendations markdown (null when none) */
  recommendationsMd: string | null;
  /** Promotional Value band (±15% around coverage.ave.article_ave) */
  promotionalValue: PromoBand;
  /**
   * S9 — prominence split from brand_trend (canonical-tagged coverage).
   * Optional so the PPTX generator compiles unchanged; null/absent hides
   * the "Headline coverage" stat (fail-soft).
   */
  headlineCoverage?: HeadlineCoverage | null;
  /**
   * S9 — per-source share of coverage from brand_trend (same rows that feed
   * headlineCoverage). Optional + empty-when-no-data so both renderers stay
   * 0-safe: an empty list hides the "Where your coverage comes from" element.
   */
  publisherMix?: PublisherMixRow[];
}

// ---------------------------------------------------------------------------
// Constants (Travel Daily–supplied defaults, palette, static slide copy)
// ---------------------------------------------------------------------------

export const DEFAULT_HOST_SLUG = "travel-daily";

/** Brand palette shared by web + PPTX (hex without leading #). */
export const DECK_COLORS = {
  // Travel Daily brand palette — pixel-sampled from the TD Key Partner deck
  // (Kristen's PDF, July 2026). Do not eyeball-adjust; re-sample if the
  // template changes.
  navy: "181545",      // slide bg / boxes / headings ink
  navyLight: "232052",
  accent: "191545",
  tan: "B08A78",       // TD rose-gold — eyebrows/labels on navy
  tanLight: "C9AB9C",
  chartNavy: "40699C", // series 1 (host) in comparison charts
  chartBlush: "F1DCDB",// series 2
  chartSage: "EBF0DE", // series 3
  tableBlue: "4F81BC", // table borders / link text in tables
  muted: "545454",     // subtitle / italic gray (sampled from DM Sans body)
  surface: "FAFAFA",   // stat tiles
  text: "191545",
  green: "059669",
  purple: "7C3AED",
  amber: "D97706",
} as const;

/** S3 — publisher-supplied readership figures (Travel Daily defaults). */
export const READERSHIP_STATS: ReadonlyArray<{
  label: string;
  value: string;
  detail: string;
}> = [
  { label: "Newsletter", value: "40,000", detail: "subscribers" },
  {
    label: "Social",
    value: "42,000",
    detail: "followers across LinkedIn, Facebook & Instagram",
  },
  { label: "Website", value: "19,000", detail: "visits per month" },
] as const;

export const READERSHIP_QUOTES: readonly string[] = [
  "65% read daily, 91% at least twice a week",
  "66% have taken business action",
] as const;

export const READERSHIP_SOURCE_NOTE =
  "Publisher-supplied figures (Travel Daily reader survey) — not derived from BPG platform data.";

/** S4 — audience composition (publisher-supplied). */
export const AUDIENCE_SEGMENTS: ReadonlyArray<{ name: string; pct: number }> = [
  { name: "Retail leisure", pct: 26 },
  { name: "Industry product supplier", pct: 19 },
  { name: "Other", pct: 11 },
  { name: "Tour operator", pct: 10 },
  { name: "Home-based agency", pct: 8 },
  { name: "Retail corporate", pct: 8 },
  { name: "Wholesale", pct: 7 },
  { name: "OTA", pct: 5 },
  { name: "Industry service supplier", pct: 4 },
  { name: "Consortium / franchisor HO", pct: 3 },
  { name: "Consolidator", pct: 1 },
] as const;

/** S5 fallback — the Travel Daily seven. */
export const TD_FALLBACK_TEAM: readonly TeamMember[] = [
  { name: "Damian Francis", role: "Editor in Chief" },
  { name: "Jo-Anne Hui-Miller", role: "Managing Editor" },
  { name: "Adam Bishop", role: "Travel Daily Editor" },
  { name: "Alex Lilly", role: "Social Editor" },
  { name: "Myles Stedman", role: "Cruise Editor" },
  { name: "Janie Medbury", role: "Senior Journalist" },
  { name: "James Bale", role: "Journalist" },
] as const;

/** S2 — contents. */
export const CONTENTS_ITEMS: readonly string[] = [
  "Readership",
  "Editorial Metrics",
  "Commercial Metrics",
  "Looking Ahead",
] as const;

/** S19 — looking ahead. */
export const LOOKING_AHEAD_ITEMS: ReadonlyArray<{
  title: string;
  detail: string;
}> = [
  { title: "New Social Editor", detail: "Behind-the-scenes coverage" },
  {
    title: "Special Issues",
    detail: "Cruise Guide, Ocean Cruising, Destinations, Cruise Month",
  },
  { title: "Exclusives", detail: "Breaking news" },
  {
    title: "Supplier Updates",
    detail: "Solus eDM — currently under-utilised",
  },
] as const;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

/** Compact AUD, e.g. 302_000 -> "$302k", 1_450_000 -> "$1.5m". */
export function formatAudCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/** ±15% band around the midpoint Promotional Value. */
export function promotionalValueBand(mid: number): PromoBand {
  const m = Number.isFinite(mid) ? mid : 0;
  return {
    mid: Math.round(m),
    low: Math.round(m * 0.85),
    high: Math.round(m * 1.15),
  };
}

/** "$302k–$408k" band string. */
export function formatPromoBand(band: PromoBand): string {
  if (band.mid === 0) return "$0";
  return `${formatAudCompact(band.low)}–${formatAudCompact(band.high)}`;
}

/** Footnote shown wherever Promotional Value appears. */
export function promoFootnote(hostTitle: string): string {
  return `Earned editorial only, valued at the ${hostTitle} rate card. Sponsored/paid content excluded. Indicative range ±15%.`;
}

export function sourceLabel(src: string): string {
  return SOURCE_LABELS[src] || src;
}

/** Deck filename shared by the export route and the download button. */
export function deckFilename(
  brand: string,
  host: string,
  period: number
): string {
  const safeBrand = brand.replace(/[^A-Za-z0-9_-]+/g, "_");
  const safeHost = host.replace(/[^A-Za-z0-9_-]+/g, "_");
  return `KeyPartnerBrief_${safeBrand}_${safeHost}_${period}d.pptx`;
}

/**
 * Very small markdown-ish splitter for brief_recommendations.content_md:
 * returns blocks that are either paragraphs or bullet lists.
 */
export type MdBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export function parseSimpleMd(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push({ type: "ul", items: bullets });
      bullets = [];
    }
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const m = line.match(/^[-*•]\s+(.*)$/);
    if (m) {
      bullets.push(m[1]);
    } else {
      flush();
      blocks.push({ type: "p", text: line.replace(/^#+\s*/, "") });
    }
  }
  flush();
  return blocks;
}

// ---------------------------------------------------------------------------
// Host config resolution
// ---------------------------------------------------------------------------

export function fallbackHostConfig(slug: string): BriefConfig {
  const isBpg = (BPG_SOURCES as readonly string[]).includes(slug);
  return {
    slug,
    title_name: SOURCE_LABELS[slug] || "Travel Daily",
    vertical: "travel",
    primary_source: isBpg ? slug : "travel-daily",
    bpg_sources: [...BPG_SOURCES],
    media_competitors: [...COMPETITOR_SOURCES],
    all_competitors: [...COMPETITOR_SOURCES],
    enabled: true,
  };
}

export async function resolveHostConfig(
  supabase: SupabaseClient,
  hostSlug: string
): Promise<{ config: BriefConfig; found: boolean }> {
  const { data, error } = await supabase
    .from("brief_config")
    .select(
      "slug, title_name, vertical, primary_source, bpg_sources, media_competitors, all_competitors, enabled"
    )
    .eq("slug", hostSlug)
    .limit(1);

  const row = !error && data && data.length > 0 ? data[0] : null;
  if (!row) return { config: fallbackHostConfig(hostSlug), found: false };

  return {
    config: {
      slug: row.slug,
      title_name: row.title_name || SOURCE_LABELS[row.slug] || row.slug,
      vertical: row.vertical || "travel",
      primary_source: row.primary_source || row.slug,
      bpg_sources:
        Array.isArray(row.bpg_sources) && row.bpg_sources.length > 0
          ? row.bpg_sources
          : [...BPG_SOURCES],
      media_competitors: Array.isArray(row.media_competitors)
        ? row.media_competitors
        : [],
      all_competitors:
        Array.isArray(row.all_competitors) && row.all_competitors.length > 0
          ? row.all_competitors
          : [...COMPETITOR_SOURCES],
      enabled: row.enabled !== false,
    },
    found: true,
  };
}

// ---------------------------------------------------------------------------
// Data assembly
// ---------------------------------------------------------------------------

export interface AssembleOpts {
  slug: string;
  brandName: string;
  period: number;
  host?: string | null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchTeam(
  supabase: SupabaseClient,
  primarySource: string
): Promise<{ team: TeamMember[]; source: BriefDeckData["teamSource"] }> {
  // 1. Curated journalists table (has roles).
  try {
    const { data, error } = await supabase
      .from("journalists")
      .select("full_name, role, source_id, active")
      .eq("source_id", primarySource)
      .eq("active", true)
      .order("full_name");
    if (!error && data && data.length > 0) {
      return {
        team: data.map((j) => ({
          name: j.full_name as string,
          role: (j.role as string) || "Journalist",
        })),
        source: "journalists",
      };
    }
  } catch {
    // table may not be readable with anon+session client — fall through
  }

  // 2. Curated publisher-supplied team beats byline derivation (the client
  // deck names the TD seven with proper roles; bylines lose roles entirely).
  if (primarySource === "travel-daily") {
    return { team: [...TD_FALLBACK_TEAM], source: "fallback" };
  }

  // 3. Byline-derived roster RPC (names only).
  try {
    const { data, error } = await supabase.rpc("bpg_newsroom_roster", {
      p_sources: [primarySource],
      p_per_source: 8,
      p_since_days: 3650,
    });
    if (!error && Array.isArray(data) && data.length > 0) {
      return {
        team: data.map((r: { author_name: string }) => ({
          name: r.author_name,
          role: "Journalist",
        })),
        source: "roster",
      };
    }
  } catch {
    // fall through
  }

  return { team: [], source: "none" };
}

/**
 * Assemble everything both renderers need for the 20-slide deck.
 * Throws when brand_coverage (the backbone RPC) fails.
 */
export async function assembleBriefData(
  supabase: SupabaseClient,
  opts: AssembleOpts
): Promise<BriefDeckData> {
  const hostSlug = opts.host || DEFAULT_HOST_SLUG;
  const { config, found } = await resolveHostConfig(supabase, hostSlug);

  const mediaSet = [
    config.primary_source,
    ...config.media_competitors.filter((s) => s !== config.primary_source),
  ];

  const now = new Date();
  const from = new Date(now.getTime() - opts.period * 86_400_000);

  // Same source set brand_coverage examines (BPG titles + all competitors),
  // for the S9 prominence split. p_months spans the deck period (>= 2).
  const coverageSources = [
    ...new Set([...config.bpg_sources, ...config.all_competitors]),
  ];
  const trendMonths = Math.max(2, Math.ceil(opts.period / 30));

  // --- Round 1: independent fetches -------------------------------------
  const [
    coverageRes,
    pubStatsRes,
    rivalsRes,
    articlesRes,
    campaignsRes,
    recsRes,
    teamRes,
    trendRows,
  ] = await Promise.all([
    supabase.rpc("brand_coverage", {
      brand_name: opts.brandName,
      bpg_sources: config.bpg_sources,
      competitor_sources: config.all_competitors,
      period_days: opts.period,
    }),
    supabase.rpc("publication_stats_range", {
      p_sources: mediaSet,
      p_from: isoDate(from),
      p_to: isoDate(now),
    }),
    supabase
      .from("sector_rivals")
      .select("brand_canonical, rivals, sector, source_of_truth")
      .ilike("brand_canonical", opts.brandName)
      .limit(1),
    supabase.rpc("brand_articles", {
      brand_name: opts.brandName,
      sources: config.bpg_sources,
      period_days: opts.period,
    }),
    supabase
      .from("campaigns")
      .select(
        "id, brand, name, period_start, period_end, spend_aud, bonus_ad_value, estimated_reach, creative_url"
      )
      .ilike("brand", opts.brandName)
      .order("period_end", { ascending: false }),
    supabase
      .from("brief_recommendations")
      .select("content_md")
      .eq("host_slug", hostSlug)
      .ilike("brand", opts.brandName)
      .limit(1),
    fetchTeam(supabase, config.primary_source),
    // S9 prominence split — fail-soft: any error or empty result → [].
    (async (): Promise<BrandTrendRow[]> => {
      try {
        const { data, error } = await supabase.rpc("brand_trend", {
          p_brand: opts.brandName,
          p_sources: coverageSources,
          p_months: trendMonths,
        });
        return error ? [] : ((data as BrandTrendRow[]) || []);
      } catch {
        return [];
      }
    })(),
  ]);

  if (coverageRes.error) {
    throw new Error(coverageRes.error.message);
  }
  const coverage = coverageRes.data as Coverage;
  // WordPress leaves HTML entities in titles — decode once, centrally.
  for (const a of coverage.top_articles || []) a.title = decodeHtmlEntities(a.title);
  for (const u of coverage.unique_coverage || []) u.canonical_title = decodeHtmlEntities(u.canonical_title);
  for (const mc of coverage.missed_coverage || []) mc.canonical_title = decodeHtmlEntities(mc.canonical_title);

  const contentVolume: PubStat[] = (
    (pubStatsRes.error ? [] : pubStatsRes.data || []) as Array<
      Record<string, unknown>
    >
  ).map((r) => ({
    source_id: String(r.source_id),
    article_count: Number(r.article_count) || 0,
    avg_word_count: Number(r.avg_word_count) || 0,
    sponsored_pct: Number(r.sponsored_pct) || 0,
    articles_per_day: Number(r.articles_per_day) || 0,
    last_published: (r.last_published as string) || null,
  }));

  const rivalsRow =
    !rivalsRes.error && rivalsRes.data && rivalsRes.data.length > 0
      ? rivalsRes.data[0]
      : null;
  const rivals: RivalsInfo | null = rivalsRow
    ? {
        brand_canonical: rivalsRow.brand_canonical,
        rivals: Array.isArray(rivalsRow.rivals) ? rivalsRow.rivals : [],
        sector: rivalsRow.sector ?? null,
        source_of_truth: rivalsRow.source_of_truth ?? null,
      }
    : null;

  const allArticles: BrandArticleRow[] = (
    (articlesRes.error ? [] : articlesRes.data || []) as Array<
      Record<string, unknown>
    >
  ).map((r) => ({
    published_at: String(r.published_at || ""),
    source_id: String(r.source_id),
    title: decodeHtmlEntities(String(r.title || "")),
    url: String(r.url || ""),
    word_count: Number(r.word_count) || 0,
    is_sponsored: Boolean(r.is_sponsored),
  }));

  const campaigns: CampaignRow[] = campaignsRes.error
    ? []
    : ((campaignsRes.data || []) as CampaignRow[]);

  const recommendationsMd: string | null =
    !recsRes.error && recsRes.data && recsRes.data.length > 0
      ? (recsRes.data[0].content_md as string) || null
      : null;

  // --- Round 2: fetches that depend on round 1 ---------------------------
  const rivalNames = rivals?.rivals || [];
  const campaignIds = campaigns.map((c) => c.id);
  const latest = campaigns[0] || null;
  const yearStart = `${now.getFullYear()}-01-01`;

  const [sovRes, advSovRes, latestInsRes, ytdInsRes] = await Promise.all([
    rivalNames.length > 0
      ? supabase.rpc("brand_sov_by_category", {
          p_brand: opts.brandName,
          p_rivals: rivalNames,
          p_sources: mediaSet,
          p_days: opts.period,
        })
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("advertising_sov", {
      p_brand: opts.brandName,
      p_rivals: rivalNames,
      p_sources: config.bpg_sources,
      p_days: opts.period,
    }),
    latest
      ? supabase
          .from("campaign_insertions")
          .select(
            "id, campaign_id, run_date, source_id, ad_type, page_position, est_readership, clicks, notes"
          )
          .eq("campaign_id", latest.id)
          .order("run_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    campaignIds.length > 0
      ? supabase
          .from("campaign_insertions")
          .select(
            "id, campaign_id, run_date, source_id, ad_type, page_position, est_readership, clicks, notes"
          )
          .in("campaign_id", campaignIds)
          .gte("run_date", yearStart)
          .order("run_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const sovByCategory: SovRow[] = (
    (sovRes.error ? [] : sovRes.data || []) as Array<Record<string, unknown>>
  ).map((r) => ({
    brand: String(r.brand),
    source_id: String(r.source_id),
    article_count: Number(r.article_count) || 0,
  }));

  const advertisingSov: AdvSovRow[] = (
    (advSovRes.error ? [] : advSovRes.data || []) as Array<
      Record<string, unknown>
    >
  ).map((r) => ({
    advertiser: String(r.advertiser),
    spend_aud: Number(r.spend_aud) || 0,
    insertion_periods: Number(r.insertion_periods) || 0,
  }));

  const latestInsertions: InsertionRow[] = latestInsRes.error
    ? []
    : ((latestInsRes.data || []) as InsertionRow[]);

  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));
  const ytdInsertions: YtdInsertionRow[] = (
    ytdInsRes.error ? [] : ((ytdInsRes.data || []) as InsertionRow[])
  ).map((i) => ({
    ...i,
    campaign_name: campaignNameById.get(i.campaign_id) || "",
  }));

  // S9 prominence split — share of coverage that named the brand in the
  // headline, plus per-source publisher mix. Both derive from the same
  // brand_trend rows; null/empty when brand_trend errored or returned nothing.
  let sumArticles = 0;
  let sumTitle = 0;
  const bySourceArticles = new Map<string, number>();
  for (const r of trendRows) {
    const a = Number(r.articles) || 0;
    sumArticles += a;
    sumTitle += Number(r.title_articles) || 0;
    if (a > 0) {
      bySourceArticles.set(r.source_id, (bySourceArticles.get(r.source_id) || 0) + a);
    }
  }
  const headlineCoverage: HeadlineCoverage | null =
    sumArticles > 0
      ? {
          title_articles: sumTitle,
          articles: sumArticles,
          pct: Math.round((sumTitle / sumArticles) * 100),
        }
      : null;

  const bpgSourceSet = new Set(config.bpg_sources);
  const publisherMix: PublisherMixRow[] =
    sumArticles > 0
      ? [...bySourceArticles.entries()]
          .map(([source_id, articles]) => ({
            source_id,
            articles,
            pct: Math.round((articles / sumArticles) * 100),
            is_bpg: bpgSourceSet.has(source_id),
          }))
          .sort((a, b) => b.articles - a.articles)
      : [];

  return {
    brand: coverage.brand || opts.brandName,
    slug: opts.slug,
    period_days: opts.period,
    generated_at: coverage.generated_at || now.toISOString(),
    host: config,
    hostConfigFound: found,
    coverage,
    team: teamRes.team,
    teamSource: teamRes.source,
    contentVolume,
    rivals,
    sovByCategory,
    advertisingSov,
    allArticles,
    latestCampaign: latest
      ? { campaign: latest, insertions: latestInsertions }
      : null,
    ytdInsertions,
    recommendationsMd,
    promotionalValue: promotionalValueBand(coverage.ave?.article_ave || 0),
    headlineCoverage,
    publisherMix,
  };
}

// ---------------------------------------------------------------------------
// Derived helpers shared by both renderers
// ---------------------------------------------------------------------------

/** S9/S11 publication set: host primary + media competitors, in order. */
export function mediaCompetitorSet(config: BriefConfig): string[] {
  return [
    config.primary_source,
    ...config.media_competitors.filter((s) => s !== config.primary_source),
  ];
}

/**
 * S9 — brand volume rows: the host title, then every other BPG title with
 * coverage, then the media competitors. The BPG bars must sum to the
 * `summary.bpg_articles` headline shown beside the chart — the old
 * host-only shape made the headline (all BPG titles) irreconcilable with
 * the chart (host bar only), e.g. NCL 117 vs a 43 Travel Daily bar with
 * Cruise Weekly's 64 articles invisible.
 */
export function coverageVolumeRows(
  data: BriefDeckData
): Array<{
  source_id: string;
  article_count: number;
  is_host: boolean;
  is_bpg: boolean;
}> {
  const host = data.host.primary_source;
  const byPub = new Map(
    data.coverage.by_publication.map((p) => [p.source_id, p.article_count])
  );
  const otherBpg = data.coverage.by_publication
    .filter((p) => p.is_bpg && p.source_id !== host && p.article_count > 0)
    .sort((a, b) => b.article_count - a.article_count);
  const competitors = data.host.media_competitors.filter((s) => s !== host);
  return [
    {
      source_id: host,
      article_count: byPub.get(host) || 0,
      is_host: true,
      is_bpg: true,
    },
    ...otherBpg.map((p) => ({
      source_id: p.source_id,
      article_count: p.article_count,
      is_host: false,
      is_bpg: true,
    })),
    ...competitors.map((s) => ({
      source_id: s,
      article_count: byPub.get(s) || 0,
      is_host: false,
      is_bpg: false,
    })),
  ];
}

/** Compact month labels for the S9 monthly-trend axis. */
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export interface MonthlyTimelinePoint {
  /** "YYYY-MM" bucket key (chronological sort key). */
  month: string;
  /** Short axis label, e.g. "Jan 26". */
  label: string;
  /** One key per source_id present → article count that month (0-filled). */
  [sourceId: string]: string | number;
}

/**
 * Re-bucket the weekly coverage.timeline rows into calendar months for the
 * S9 monthly-trend chart. Months before 2005 are dropped (travel-bulletin
 * carries epoch-dated rows). Returns the pivoted points (chronological) plus
 * the source_ids present. Empty input → empty points, so the caller can hide
 * the chart entirely (0-safe).
 */
export function monthlyTimeline(
  rows: Array<{ week: string; source_id: string; articles: number }>
): { points: MonthlyTimelinePoint[]; sources: string[] } {
  const byMonth = new Map<string, MonthlyTimelinePoint>();
  const sources = new Set<string>();
  for (const r of rows || []) {
    const month = String(r?.week || "").slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
    if (!/^\d{4}-\d{2}$/.test(month) || month < "2005-01") continue;
    const src = String(r.source_id);
    sources.add(src);
    let point = byMonth.get(month);
    if (!point) {
      const mi = parseInt(month.slice(5, 7), 10) - 1;
      point = { month, label: `${MONTH_ABBR[mi] ?? month} ${month.slice(2, 4)}` };
      byMonth.set(month, point);
    }
    point[src] = ((point[src] as number) || 0) + (Number(r.articles) || 0);
  }
  const srcList = [...sources];
  const points = [...byMonth.values()].sort((a, b) =>
    a.month.localeCompare(b.month)
  );
  // 0-fill every source on every point so stacked bars render cleanly.
  for (const p of points) for (const s of srcList) if (p[s] == null) p[s] = 0;
  return { points, sources: srcList };
}

/** S11 — group SoV rows into one chart per publication. */
export function sovChartsBySource(
  data: BriefDeckData
): Array<{ source_id: string; rows: Array<{ brand: string; count: number }> }> {
  const bySource = new Map<string, Array<{ brand: string; count: number }>>();
  for (const r of data.sovByCategory) {
    const arr = bySource.get(r.source_id) || [];
    arr.push({ brand: r.brand, count: r.article_count });
    bySource.set(r.source_id, arr);
  }
  // Keep the media-set ordering, host first; drop empty sources.
  return mediaCompetitorSet(data.host)
    .filter((s) => bySource.has(s))
    .map((s) => ({ source_id: s, rows: bySource.get(s)! }));
}

/** S15/S16 — totals across a set of insertions. */
export function insertionTotals(insertions: InsertionRow[]): {
  advertisements: number;
  clicks: number;
  readership: number;
  ctrPct: number | null;
} {
  const advertisements = insertions.length;
  const clicks = insertions.reduce((s, i) => s + (Number(i.clicks) || 0), 0);
  const readership = insertions.reduce(
    (s, i) => s + (Number(i.est_readership) || 0),
    0
  );
  const ctrPct = readership > 0 ? (clicks / readership) * 100 : null;
  return { advertisements, clicks, readership, ctrPct };
}

/** S10 — true when clustering hasn't populated anything yet. */
export function uniqueCoverageAllZero(c: Coverage): boolean {
  return (
    c.unique_coverage.length === 0 &&
    c.shared_coverage_count === 0 &&
    c.missed_coverage.length === 0 &&
    c.first_to_publish.total_shared === 0
  );
}
