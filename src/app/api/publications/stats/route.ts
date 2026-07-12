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

  // Breadth columns (brands covered, first-to-story) come from a parallel
  // publication_breadth call over the equivalent from/to window. Days mode
  // → [today-days, today].
  const today = new Date();
  const breadthTo =
    period.mode === "range" ? period.to : today.toISOString().slice(0, 10);
  const breadthFrom =
    period.mode === "range"
      ? period.from
      : new Date(today.getTime() - period.days * 86_400_000)
          .toISOString()
          .slice(0, 10);

  const [statsRes, breadthRes] = await Promise.all([
    period.mode === "range"
      ? supabase.rpc("publication_stats_range", {
          p_sources: sources,
          p_from: period.from,
          p_to: period.to,
        })
      : supabase.rpc("publication_stats", {
          p_sources: sources,
          p_days: period.days,
        }),
    supabase.rpc("publication_breadth", {
      p_sources: sources,
      p_from: breadthFrom,
      p_to: breadthTo,
    }),
  ]);

  const { data, error } = statsRes;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort merge — tolerate breadth errors/empty by leaving defaults.
  const breadthBySource = new Map<
    string,
    { brands_covered: number; first_pct: number | null }
  >();
  if (!breadthRes.error && Array.isArray(breadthRes.data)) {
    for (const b of breadthRes.data as Array<{
      source_id: string;
      brands_covered: number | string;
      first_pct: number | string | null;
    }>) {
      breadthBySource.set(String(b.source_id), {
        brands_covered: Number(b.brands_covered) || 0,
        first_pct: b.first_pct == null ? null : Number(b.first_pct),
      });
    }
  }

  const stats = (data || []).map((r: {
    source_id: string;
    article_count: number;
    avg_word_count: number;
    sponsored_pct: number | string;
    articles_per_day: number | string;
    last_published: string | null;
  }) => {
    const breadth = breadthBySource.get(r.source_id);
    return {
      source_id: r.source_id,
      article_count: Number(r.article_count),
      avg_word_count: Number(r.avg_word_count),
      sponsored_pct: Number(r.sponsored_pct),
      articles_per_day: Number(r.articles_per_day),
      last_published: r.last_published,
      brands_covered: breadth?.brands_covered ?? 0,
      first_pct: breadth?.first_pct ?? null,
    };
  });

  if (period.mode === "range") {
    return NextResponse.json({ stats, from: period.from, to: period.to });
  }
  return NextResponse.json({ stats, days: period.days });
}
