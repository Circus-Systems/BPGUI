import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** One aggregated entity row — identical shape for the list API and the export. */
export interface AggregatedEntity {
  entity_name: string;
  entity_type: string;
  total_mentions: number;
  article_count: number;
  in_title_pct: number;
  top_sentiment: string;
}

export interface EntityAggregateParams {
  vertical: VerticalCode;
  entityType: string;
  search: string;
  dateRange: string;
  fromParam: string | null;
  toParam: string | null;
  sourceFilter: string;
}

/** Read the filter params shared by /api/entities and /api/export/entities. */
export function parseEntityAggregateParams(
  params: URLSearchParams
): EntityAggregateParams {
  return {
    vertical: (params.get("vertical") || "travel") as VerticalCode,
    entityType: params.get("type") || "all",
    search: params.get("search") || "",
    dateRange: params.get("dateRange") || "30d",
    fromParam: params.get("from"),
    toParam: params.get("to"),
    sourceFilter: params.get("source") || "all",
  };
}

interface RawEntityRow {
  entity_name: string;
  entity_type: string;
  mention_count: number | null;
  in_title: number | null;
  sentiment: string | null;
}

// PostgREST caps every response at max-rows=1000, so a single .limit(10000) call
// silently truncated to 1000 mention rows — the list page was under-counting busy
// windows before this fix. We page .range() in 1000s up to a bounded ceiling.
const RAW_PAGE_SIZE = 1000;
const RAW_ROW_CEILING = 100000;

/**
 * Query article_entities and aggregate by (entity_name, entity_type), returning
 * the full sorted list. This is the same GROUP-BY-in-JS the list API used before
 * it sliced a page off the end — the export reuses it verbatim, minus pagination.
 */
export async function aggregateEntities(
  supabase: SupabaseServerClient,
  p: EntityAggregateParams
): Promise<{ entities: AggregatedEntity[]; error: string | null }> {
  const verticalSources =
    VERTICAL_SOURCES[p.vertical] || VERTICAL_SOURCES.travel;
  const sources =
    p.sourceFilter !== "all" && verticalSources.includes(p.sourceFilter)
      ? [p.sourceFilter]
      : verticalSources;

  // Compute date window (identical to the original list route).
  let fromIso: string | null = null;
  let toIso: string | null = null;
  if (p.dateRange === "custom" && p.fromParam) {
    fromIso = new Date(p.fromParam).toISOString();
    if (p.toParam) toIso = new Date(p.toParam).toISOString();
  } else if (p.dateRange !== "all") {
    const dayMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = dayMap[p.dateRange] ?? 30;
    fromIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  // Build a fresh query per page — a PostgREST builder is a single-use thenable,
  // so it can't be re-awaited across loop iterations.
  const buildBase = () => {
    let q = supabase
      .from("article_entities")
      .select("entity_name, entity_type, mention_count, in_title, sentiment")
      .in("source_id", [...sources]);
    if (p.entityType !== "all") q = q.eq("entity_type", p.entityType);
    if (p.search) q = q.ilike("entity_name", `%${p.search}%`);
    if (fromIso) q = q.gte("published_at_ts", fromIso);
    if (toIso) q = q.lte("published_at_ts", toIso);
    return q;
  };

  // Page all matching mention rows (1000/page) up to the raw-row ceiling.
  const rows: RawEntityRow[] = [];
  let offset = 0;
  while (offset < RAW_ROW_CEILING) {
    const { data, error } = await buildBase().range(
      offset,
      offset + RAW_PAGE_SIZE - 1
    );
    if (error) return { entities: [], error: error.message };
    const page = (data || []) as RawEntityRow[];
    rows.push(...page);
    if (page.length < RAW_PAGE_SIZE) break;
    offset += RAW_PAGE_SIZE;
  }

  const entityMap = new Map<
    string,
    {
      entity_name: string;
      entity_type: string;
      total_mentions: number;
      article_count: number;
      in_title_count: number;
      sentiments: Record<string, number>;
    }
  >();

  for (const row of rows) {
    const key = `${row.entity_name}||${row.entity_type}`;
    const existing = entityMap.get(key);
    if (existing) {
      existing.total_mentions += row.mention_count || 1;
      existing.article_count += 1;
      existing.in_title_count += row.in_title || 0;
      if (row.sentiment) {
        existing.sentiments[row.sentiment] =
          (existing.sentiments[row.sentiment] || 0) + 1;
      }
    } else {
      entityMap.set(key, {
        entity_name: row.entity_name,
        entity_type: row.entity_type,
        total_mentions: row.mention_count || 1,
        article_count: 1,
        in_title_count: row.in_title || 0,
        sentiments: row.sentiment ? { [row.sentiment]: 1 } : {},
      });
    }
  }

  const sorted: AggregatedEntity[] = Array.from(entityMap.values())
    .map((e) => ({
      entity_name: e.entity_name,
      entity_type: e.entity_type,
      total_mentions: e.total_mentions,
      article_count: e.article_count,
      in_title_pct: e.article_count > 0 ? e.in_title_count / e.article_count : 0,
      top_sentiment:
        Object.entries(e.sentiments).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "neutral",
    }))
    .sort((a, b) => b.total_mentions - a.total_mentions);

  return { entities: sorted, error: null };
}
