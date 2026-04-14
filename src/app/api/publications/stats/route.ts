import { createClient } from "@/lib/supabase/server";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vertical = (params.get("vertical") || "travel") as VerticalCode;
  const days = parseInt(params.get("days") || "30", 10);
  const sources = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;

  const supabase = await createClient();

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch articles for the period, limited fields for aggregation
  const { data: rows, error } = await supabase
    .from("articles")
    .select("source_id, published_at, word_count, is_sponsored")
    .in("source_id", [...sources])
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate per source
  const statsMap = new Map<string, {
    source_id: string;
    article_count: number;
    total_word_count: number;
    sponsored_count: number;
    earliest: string | null;
    latest: string | null;
  }>();

  for (const row of rows || []) {
    const existing = statsMap.get(row.source_id);
    if (existing) {
      existing.article_count += 1;
      existing.total_word_count += row.word_count || 0;
      existing.sponsored_count += row.is_sponsored ? 1 : 0;
      if (row.published_at && (!existing.latest || row.published_at > existing.latest)) {
        existing.latest = row.published_at;
      }
      if (row.published_at && (!existing.earliest || row.published_at < existing.earliest)) {
        existing.earliest = row.published_at;
      }
    } else {
      statsMap.set(row.source_id, {
        source_id: row.source_id,
        article_count: 1,
        total_word_count: row.word_count || 0,
        sponsored_count: row.is_sponsored ? 1 : 0,
        earliest: row.published_at,
        latest: row.published_at,
      });
    }
  }

  const stats = Array.from(statsMap.values())
    .map((s) => {
      const daySpan = s.earliest && s.latest
        ? Math.max(1, Math.ceil((new Date(s.latest).getTime() - new Date(s.earliest).getTime()) / (24 * 60 * 60 * 1000)))
        : 1;
      return {
        source_id: s.source_id,
        article_count: s.article_count,
        avg_word_count: s.article_count > 0 ? Math.round(s.total_word_count / s.article_count) : 0,
        sponsored_pct: s.article_count > 0 ? s.sponsored_count / s.article_count : 0,
        articles_per_day: Math.round((s.article_count / daySpan) * 10) / 10,
        last_published: s.latest,
      };
    })
    .sort((a, b) => b.article_count - a.article_count);

  return NextResponse.json({ stats, days });
}
