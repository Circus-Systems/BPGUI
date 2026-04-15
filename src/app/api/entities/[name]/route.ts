import { createClient } from "@/lib/supabase/server";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const entityName = decodeURIComponent(name);
  const searchParams = request.nextUrl.searchParams;
  const vertical = (searchParams.get("vertical") || "travel") as VerticalCode;
  const sources = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;

  const supabase = await createClient();

  // Get all entity mentions
  const { data: mentions, error: mentionsError } = await supabase
    .from("article_entities")
    .select("source_id, external_id, entity_type, confidence, mention_count, in_title, sentiment")
    .eq("entity_name", entityName)
    .in("source_id", [...sources]);

  if (mentionsError) {
    return NextResponse.json({ error: mentionsError.message }, { status: 500 });
  }

  // Get associated articles
  const articleKeys = (mentions || []).map((m) => `${m.source_id}:${m.external_id}`);
  const uniqueKeys = [...new Set(articleKeys)];

  // Fetch articles matching these source_id + external_id pairs
  // Use OR filter for up to 50 articles
  const articlePairs = uniqueKeys.slice(0, 50);
  let articles: Array<{
    id: number;
    source_id: string;
    external_id: string;
    title: string;
    url: string;
    published_at: string | null;
    author_name: string | null;
  }> = [];

  if (articlePairs.length > 0) {
    // Fetch articles by source_id/external_id pairs
    const orFilter = articlePairs
      .map((pair) => {
        const [sid, eid] = pair.split(":");
        return `and(source_id.eq.${sid},external_id.eq.${eid})`;
      })
      .join(",");

    const { data: articleData } = await supabase
      .from("articles")
      .select("id, source_id, external_id, title, url, published_at, author_name")
      .or(orFilter)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(50);

    articles = articleData || [];
  }

  // Co-occurring entities
  const { data: coEntities } = await supabase
    .from("article_entities")
    .select("entity_name, entity_type, mention_count")
    .in("source_id", [...sources])
    .in(
      "external_id",
      uniqueKeys.slice(0, 100).map((k) => k.split(":")[1])
    )
    .neq("entity_name", entityName)
    .limit(500);

  // Aggregate co-occurring entities
  const coMap = new Map<string, { name: string; type: string; count: number }>();
  for (const ce of coEntities || []) {
    const existing = coMap.get(ce.entity_name);
    if (existing) {
      existing.count += 1;
    } else {
      coMap.set(ce.entity_name, {
        name: ce.entity_name,
        type: ce.entity_type,
        count: 1,
      });
    }
  }

  const coOccurrences = Array.from(coMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Source distribution
  const sourceDistribution: Record<string, number> = {};
  for (const m of mentions || []) {
    sourceDistribution[m.source_id] = (sourceDistribution[m.source_id] || 0) + 1;
  }

  return NextResponse.json({
    entity_name: entityName,
    entity_type: mentions?.[0]?.entity_type || "unknown",
    article_count: uniqueKeys.length,
    total_mentions: (mentions || []).reduce((sum, m) => sum + (m.mention_count || 1), 0),
    articles,
    co_occurrences: coOccurrences,
    source_distribution: sourceDistribution,
  });
}
