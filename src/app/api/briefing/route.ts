import { createClient } from "@/lib/supabase/server";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vertical = (params.get("vertical") || "travel") as VerticalCode;

  const sources = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;
  const supabase = await createClient();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Parallel fetches: recent articles (24h), week articles (for comparison), latest highlights
  const [recentRes, weekRes, highlightsRes] = await Promise.all([
    // Articles in last 24h
    supabase
      .from("articles")
      .select("source_id, is_sponsored", { count: "exact", head: true })
      .in("source_id", [...sources])
      .gte("published_at", oneDayAgo.toISOString()),

    // Articles in last 7d (for daily average comparison)
    supabase
      .from("articles")
      .select("source_id", { count: "exact", head: true })
      .in("source_id", [...sources])
      .gte("published_at", sevenDaysAgo.toISOString()),

    // Recent notable articles (last 24h, ordered by published_at)
    supabase
      .from("articles")
      .select("id, source_id, external_id, title, url, author_name, published_at, word_count, is_sponsored, excerpt")
      .in("source_id", [...sources])
      .gte("published_at", oneDayAgo.toISOString())
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  // Trending entities — fetch top entities across the vertical
  // Entity extraction lags behind article collection, so we use the full dataset
  const entitiesRes = await supabase
    .from("article_entities")
    .select("entity_name, entity_type, mention_count, source_id, external_id")
    .in("source_id", [...sources])
    .limit(5000);

  // Today's article count
  const articlesToday = recentRes.count || 0;
  const articlesWeek = weekRes.count || 0;
  const dailyAvg = articlesWeek > 0 ? Math.round(articlesWeek / 7) : 0;

  // Source activity (articles per source today)
  // Need a separate query to count by source
  const { data: todayArticles } = await supabase
    .from("articles")
    .select("source_id")
    .in("source_id", [...sources])
    .gte("published_at", oneDayAgo.toISOString());

  const sourceActivity: Record<string, number> = {};
  for (const a of todayArticles || []) {
    sourceActivity[a.source_id] = (sourceActivity[a.source_id] || 0) + 1;
  }

  // Trending entities — aggregate by name
  const entityMap = new Map<string, {
    entity_name: string;
    entity_type: string;
    total_mentions: number;
    article_count: number;
  }>();

  for (const row of entitiesRes.data || []) {
    const key = row.entity_name;
    const existing = entityMap.get(key);
    if (existing) {
      existing.total_mentions += row.mention_count || 1;
      existing.article_count += 1;
    } else {
      entityMap.set(key, {
        entity_name: row.entity_name,
        entity_type: row.entity_type,
        total_mentions: row.mention_count || 1,
        article_count: 1,
      });
    }
  }

  const trendingEntities = Array.from(entityMap.values())
    .sort((a, b) => b.article_count - a.article_count || b.total_mentions - a.total_mentions)
    .slice(0, 10);

  // Highlights — pick top articles (longest, non-sponsored preferred)
  const highlights = (highlightsRes.data || [])
    .sort((a, b) => (b.word_count || 0) - (a.word_count || 0))
    .slice(0, 8);

  return NextResponse.json({
    articlesToday,
    dailyAvg,
    activeSources: Object.keys(sourceActivity).length,
    totalSources: sources.length,
    sourceActivity,
    trendingEntities,
    highlights,
  });
}
