import { createClient } from "@/lib/supabase/server";
import { BPG_SOURCES, COMPETITOR_SOURCES } from "@/lib/constants";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sp = request.nextUrl.searchParams;
  const brandName = sp.get("name") || slug;
  const period = parseInt(sp.get("period") || "365", 10);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("brand_coverage", {
    brand_name: brandName,
    bpg_sources: [...BPG_SOURCES],
    competitor_sources: [...COMPETITOR_SOURCES],
    period_days: period,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
