import { createClient } from "@/lib/supabase/server";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vertical = (params.get("vertical") || "travel") as VerticalCode;
  const search = params.get("search") || "";
  const source = params.get("source") || "";
  const dateRange = params.get("dateRange") || "all";
  const sponsored = params.get("sponsored") || "all";
  const offset = parseInt(params.get("offset") || "0", 10);
  const limit = Math.min(parseInt(params.get("limit") || "30", 10), 100);

  const sources = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;
  const filterSources = source ? [source] : [...sources];

  const supabase = await createClient();

  // Build main query — no count (too slow on 300K+ rows)
  let query = supabase
    .from("articles")
    .select(
      "id, source_id, external_id, title, url, excerpt, author_name, published_at, word_count, is_sponsored, categories"
    )
    .in("source_id", filterSources)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Date range filter
  if (dateRange !== "all") {
    const now = new Date();
    let cutoff: Date;
    switch (dateRange) {
      case "24h":
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoff = new Date(0);
    }
    query = query.gte("published_at", cutoff.toISOString());
  }

  // Sponsored filter
  if (sponsored === "yes") {
    query = query.eq("is_sponsored", 1);
  } else if (sponsored === "no") {
    query = query.eq("is_sponsored", 0);
  }

  // Search filter
  if (search) {
    query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
  }

  const { data: articles, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Determine if there are more results (fetch one beyond limit)
  const hasMore = (articles || []).length === limit;

  return NextResponse.json({
    articles: articles || [],
    hasMore,
  });
}
