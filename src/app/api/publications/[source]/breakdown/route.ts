import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;
  const sourceId = decodeURIComponent(source);
  const days = Math.max(
    1,
    Math.min(parseInt(request.nextUrl.searchParams.get("days") || "30", 10), 365)
  );
  const topN = 20;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient();

  // Journalists (author_name from articles in period)
  const { data: authorRows, error: authorsErr } = await supabase
    .from("articles")
    .select("author_name, external_id")
    .eq("source_id", sourceId)
    .gte("published_at", cutoff)
    .not("author_name", "is", null)
    .limit(5000);

  if (authorsErr) {
    return NextResponse.json({ error: authorsErr.message }, { status: 500 });
  }

  const journalistMap = new Map<string, number>();
  const externalIds: string[] = [];
  for (const row of authorRows || []) {
    if (row.author_name && row.author_name.trim()) {
      journalistMap.set(
        row.author_name,
        (journalistMap.get(row.author_name) || 0) + 1
      );
    }
    if (row.external_id) externalIds.push(row.external_id);
  }

  const journalists = [...journalistMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  // Companies tagged in those articles
  let companies: Array<{ name: string; count: number }> = [];
  if (externalIds.length > 0) {
    const uniqueIds = [...new Set(externalIds)].slice(0, 3000);
    const { data: entRows } = await supabase
      .from("article_entities")
      .select("entity_name, external_id")
      .eq("source_id", sourceId)
      .eq("entity_type", "company")
      .in("external_id", uniqueIds)
      .limit(20000);

    const companyMap = new Map<string, Set<string>>();
    for (const row of entRows || []) {
      if (!row.entity_name) continue;
      const set = companyMap.get(row.entity_name) || new Set<string>();
      set.add(row.external_id);
      companyMap.set(row.entity_name, set);
    }
    companies = [...companyMap.entries()]
      .map(([name, ids]) => ({ name, count: ids.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  }

  return NextResponse.json({ journalists, companies, days });
}
