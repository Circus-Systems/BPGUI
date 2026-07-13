import { createClient } from "@/lib/supabase/server";
import {
  VERTICAL_SOURCES,
  BPG_SOURCES,
  COMPETITOR_SOURCES,
} from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_QUARTERS = new Set([4, 8, 12]);

interface LedgerRpcRow {
  quarter: string;
  bpg_articles: number | string;
  bpg_title_articles: number | string;
  competitor_articles: number | string;
  exclusive_stories: number | string;
  first_stories: number | string;
  value_min: number | string;
  value_mid: number | string;
  value_max: number | string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const brand = decodeURIComponent(name);
  const sp = request.nextUrl.searchParams;

  // Vertical → source slugs (defaults to travel).
  const verticalParam = (sp.get("vertical") || "travel") as VerticalCode;
  const vertical: VerticalCode = VERTICAL_SOURCES[verticalParam]
    ? verticalParam
    : "travel";
  const verticalSources =
    VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;

  // Split the vertical's titles into BPG-owned and competitor sets.
  const bpgSources = verticalSources.filter((s) => BPG_SOURCES.includes(s));
  const competitorSources = verticalSources.filter((s) =>
    COMPETITOR_SOURCES.includes(s)
  );

  // Window: quarters ∈ {4, 8, 12}, default 8.
  let quarters = 8;
  const quartersParam = sp.get("quarters");
  if (quartersParam !== null) {
    const parsed = Number(quartersParam);
    if (!ALLOWED_QUARTERS.has(parsed)) {
      return NextResponse.json(
        { error: "quarters must be one of 4, 8, 12" },
        { status: 400 }
      );
    }
    quarters = parsed;
  }

  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc("brand_value_ledger", {
      p_brand: brand,
      p_bpg_sources: bpgSources,
      p_competitor_sources: competitorSources,
      p_quarters: quarters,
    });
    if (error) throw new Error(error.message);

    const rows = ((data || []) as LedgerRpcRow[]).map((r) => ({
      quarter: r.quarter,
      bpg_articles: Number(r.bpg_articles),
      bpg_title_articles: Number(r.bpg_title_articles),
      competitor_articles: Number(r.competitor_articles),
      exclusive_stories: Number(r.exclusive_stories),
      first_stories: Number(r.first_stories),
      value_min: Number(r.value_min),
      value_mid: Number(r.value_mid),
      value_max: Number(r.value_max),
    }));

    return NextResponse.json({ name: brand, quarters, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
