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
      ? await supabase.rpc("publication_timeline_range", {
          p_sources: sources,
          p_from: period.from,
          p_to: period.to,
        })
      : await supabase.rpc("publication_timeline", {
          p_sources: sources,
          p_days: period.days,
        });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Pivot: (date, source_id, count) rows → [{date, source_a: n, source_b: n, ...}]
  const dateMap = new Map<string, Record<string, number>>();
  for (const row of (data || []) as { date: string; source_id: string; article_count: number }[]) {
    const existing = dateMap.get(row.date) || {};
    existing[row.source_id] = Number(row.article_count);
    dateMap.set(row.date, existing);
  }

  const timeline = Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => ({ date, ...counts }));

  if (period.mode === "range") {
    return NextResponse.json({ timeline, from: period.from, to: period.to });
  }
  return NextResponse.json({ timeline, days: period.days });
}
