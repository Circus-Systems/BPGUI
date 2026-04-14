import { createClient } from "@/lib/supabase/server";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vertical = (params.get("vertical") || "travel") as VerticalCode;
  const entityType = params.get("type") || "company";
  const search = params.get("search") || "";
  const minArticles = parseInt(params.get("min_articles") || "2", 10);
  const limit = Math.min(parseInt(params.get("limit") || "200", 10), 500);

  const sources = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("list_brands", {
    vertical_sources: [...sources],
    entity_type_filter: entityType === "all" ? null : entityType,
    min_articles: minArticles,
    result_limit: limit,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filtered = search
    ? (data || []).filter((b: { entity_name: string }) =>
        b.entity_name.toLowerCase().includes(search.toLowerCase())
      )
    : data || [];

  return NextResponse.json({ brands: filtered, totalCount: filtered.length });
}
