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

  const { data, error } = await supabase.rpc("publication_stats", {
    p_sources: [...sources],
    p_days: days,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = (data || []).map((r: {
    source_id: string;
    article_count: number;
    avg_word_count: number;
    sponsored_pct: number | string;
    articles_per_day: number | string;
    last_published: string | null;
  }) => ({
    source_id: r.source_id,
    article_count: Number(r.article_count),
    avg_word_count: Number(r.avg_word_count),
    sponsored_pct: Number(r.sponsored_pct),
    articles_per_day: Number(r.articles_per_day),
    last_published: r.last_published,
  }));

  return NextResponse.json({ stats, days });
}
