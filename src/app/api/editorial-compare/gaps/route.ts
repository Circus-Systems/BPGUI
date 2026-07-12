import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { decodeHtmlEntities } from "@/lib/brief-deck";
import { resolveVertical, verticalSources, resolveDays } from "../sources";

const ALLOWED_DAYS = [7, 14, 30] as const;

interface GapRow {
  cluster_id: number;
  title: string;
  url: string;
  sources: string[];
  first_source: string;
  article_count: number;
  first_published_at: string;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vertical = resolveVertical(params.get("vertical"));
  const days = resolveDays(params.get("days"), ALLOWED_DAYS, 7);
  const { bpg, competitors } = verticalSources(vertical);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("coverage_gaps", {
    p_bpg_sources: bpg,
    p_competitor_sources: competitors,
    p_days: days,
    p_limit: 50,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const gaps: GapRow[] = (data || []).map(
    (r: {
      cluster_id: number | string;
      title: string;
      url: string;
      sources: string[] | null;
      first_source: string;
      article_count: number | string;
      first_published_at: string;
    }) => ({
      cluster_id: Number(r.cluster_id),
      title: decodeHtmlEntities(r.title || ""),
      url: r.url,
      sources: r.sources || [],
      first_source: r.first_source,
      article_count: Number(r.article_count),
      first_published_at: r.first_published_at,
    })
  );

  return NextResponse.json({ gaps, days });
}
