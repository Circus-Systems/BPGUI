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

  const { data, error } = await supabase.rpc("publication_timeline", {
    p_sources: [...sources],
    p_days: days,
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

  return NextResponse.json({ timeline, days });
}
