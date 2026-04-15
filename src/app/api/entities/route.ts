import { createClient } from "@/lib/supabase/server";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vertical = (params.get("vertical") || "travel") as VerticalCode;
  const entityType = params.get("type") || "all";
  const search = params.get("search") || "";
  const limit = Math.min(parseInt(params.get("limit") || "50", 10), 200);
  const offset = parseInt(params.get("offset") || "0", 10);
  const dateRange = params.get("dateRange") || "30d";
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const sourceFilter = params.get("source") || "all";

  const verticalSources = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;
  const sources =
    sourceFilter !== "all" && verticalSources.includes(sourceFilter)
      ? [sourceFilter]
      : verticalSources;
  const supabase = await createClient();

  // Compute date window
  let fromIso: string | null = null;
  let toIso: string | null = null;
  if (dateRange === "custom" && fromParam) {
    fromIso = new Date(fromParam).toISOString();
    if (toParam) toIso = new Date(toParam).toISOString();
  } else if (dateRange !== "all") {
    const dayMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = dayMap[dateRange] ?? 30;
    fromIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  // Use RPC or raw query via Supabase — aggregation with GROUP BY
  // Since Supabase JS client doesn't support GROUP BY, we query raw entities
  // and aggregate in the API route
  let query = supabase
    .from("article_entities")
    .select("entity_name, entity_type, confidence, mention_count, in_title, sentiment")
    .in("source_id", [...sources]);

  if (entityType !== "all") {
    query = query.eq("entity_type", entityType);
  }

  if (search) {
    query = query.ilike("entity_name", `%${search}%`);
  }

  if (fromIso) query = query.gte("published_at_ts", fromIso);
  if (toIso) query = query.lte("published_at_ts", toIso);

  // Fetch all matching entities for aggregation (limited to avoid huge payloads)
  const { data: rows, error } = await query.limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by entity_name + entity_type
  const entityMap = new Map<string, {
    entity_name: string;
    entity_type: string;
    total_mentions: number;
    article_count: number;
    total_confidence: number;
    in_title_count: number;
    sentiments: Record<string, number>;
  }>();

  for (const row of rows || []) {
    const key = `${row.entity_name}||${row.entity_type}`;
    const existing = entityMap.get(key);
    if (existing) {
      existing.total_mentions += row.mention_count || 1;
      existing.article_count += 1;
      existing.total_confidence += row.confidence || 0;
      existing.in_title_count += row.in_title || 0;
      if (row.sentiment) {
        existing.sentiments[row.sentiment] = (existing.sentiments[row.sentiment] || 0) + 1;
      }
    } else {
      entityMap.set(key, {
        entity_name: row.entity_name,
        entity_type: row.entity_type,
        total_mentions: row.mention_count || 1,
        article_count: 1,
        total_confidence: row.confidence || 0,
        in_title_count: row.in_title || 0,
        sentiments: row.sentiment ? { [row.sentiment]: 1 } : {},
      });
    }
  }

  // Sort by total_mentions descending
  const sorted = Array.from(entityMap.values())
    .map((e) => ({
      entity_name: e.entity_name,
      entity_type: e.entity_type,
      total_mentions: e.total_mentions,
      article_count: e.article_count,
      avg_confidence: e.article_count > 0 ? e.total_confidence / e.article_count : 0,
      in_title_pct: e.article_count > 0 ? e.in_title_count / e.article_count : 0,
      top_sentiment: Object.entries(e.sentiments).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral",
    }))
    .sort((a, b) => b.total_mentions - a.total_mentions);

  const paginated = sorted.slice(offset, offset + limit);
  const hasMore = offset + limit < sorted.length;

  return NextResponse.json({
    entities: paginated,
    totalCount: sorted.length,
    hasMore,
  });
}
