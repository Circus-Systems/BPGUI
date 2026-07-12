import { createClient } from "@/lib/supabase/server";
import {
  VERTICAL_SOURCES,
  BPG_SOURCES,
  COMPETITOR_SOURCES,
} from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_DAYS = new Set([90, 180, 365]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const verticalParam = (params.get("vertical") || "travel") as VerticalCode;
  const vertical: VerticalCode = VERTICAL_SOURCES[verticalParam]
    ? verticalParam
    : "travel";

  // Validate days window — momentum math needs days > 30.
  const daysParam = params.get("days");
  let days = 90;
  if (daysParam !== null) {
    const parsed = Number(daysParam);
    if (!ALLOWED_DAYS.has(parsed)) {
      return NextResponse.json(
        { error: "days must be one of 90, 180, 365" },
        { status: 400 }
      );
    }
    days = parsed;
  }

  // Derive source arrays for this vertical.
  const verticalSources = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;
  const bpg = verticalSources.filter((s) => BPG_SOURCES.includes(s));
  const competitors = verticalSources.filter((s) =>
    COMPETITOR_SOURCES.includes(s)
  );

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("sales_radar", {
    p_bpg_sources: bpg,
    p_competitor_sources: competitors,
    p_days: days,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ radar: data });
}
