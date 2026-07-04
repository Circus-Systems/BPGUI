import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { parsePeriod, resolveSources } from "../period";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const parsed = parsePeriod(params);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { period } = parsed;
  const sources = resolveSources(params);

  const supabase = await createClient();

  const { data, error } =
    period.mode === "range"
      ? await supabase.rpc("publication_stats_range", {
          p_sources: sources,
          p_from: period.from,
          p_to: period.to,
        })
      : await supabase.rpc("publication_stats", {
          p_sources: sources,
          p_days: period.days,
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

  if (period.mode === "range") {
    return NextResponse.json({ stats, from: period.from, to: period.to });
  }
  return NextResponse.json({ stats, days: period.days });
}
