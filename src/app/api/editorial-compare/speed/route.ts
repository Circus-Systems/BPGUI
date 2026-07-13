import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { WIRE_SOURCES } from "@/lib/constants";
import { resolveVertical, verticalSources, resolveDays } from "../sources";

const ALLOWED_DAYS = [90, 180, 365] as const;

interface SpeedRow {
  source_id: string;
  stories_total: number;
  first_count: number;
  first_pct: number;
  median_lag_hours: number | null;
  is_wire: boolean;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vertical = resolveVertical(params.get("vertical"));
  const days = resolveDays(params.get("days"), ALLOWED_DAYS, 365);
  const { all } = verticalSources(vertical);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pub_speed_report", {
    p_sources: all,
    p_days: days,
    p_wire_sources: [...WIRE_SOURCES],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const report: SpeedRow[] = (data || [])
    .map(
      (r: {
        source_id: string;
        stories_total: number | string;
        first_count: number | string;
        first_pct: number | string;
        median_lag_hours: number | string | null;
        is_wire: boolean | null;
      }) => ({
        source_id: r.source_id,
        stories_total: Number(r.stories_total),
        first_count: Number(r.first_count),
        first_pct: Number(r.first_pct),
        median_lag_hours:
          r.median_lag_hours == null ? null : Number(r.median_lag_hours),
        is_wire: Boolean(r.is_wire),
      })
    )
    .sort((a: SpeedRow, b: SpeedRow) => b.first_pct - a.first_pct);

  return NextResponse.json({ report, days });
}
