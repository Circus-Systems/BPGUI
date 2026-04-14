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

  const { data: rows, error } = await supabase
    .from("articles")
    .select("source_id, published_at")
    .in("source_id", [...sources])
    .gte("published_at", cutoff)
    .order("published_at", { ascending: true })
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by date + source_id
  const dateMap = new Map<string, Record<string, number>>();

  for (const row of rows || []) {
    if (!row.published_at) continue;
    const date = row.published_at.slice(0, 10); // YYYY-MM-DD
    const existing = dateMap.get(date);
    if (existing) {
      existing[row.source_id] = (existing[row.source_id] || 0) + 1;
    } else {
      dateMap.set(date, { [row.source_id]: 1 });
    }
  }

  // Build timeline array sorted by date
  const timeline = Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => ({ date, ...counts }));

  return NextResponse.json({ timeline, days });
}
