import { createClient } from "@/lib/supabase/server";
import { BPG_SOURCES, COMPETITOR_SOURCES } from "@/lib/constants";
import { resolveHostConfig } from "@/lib/brief-deck";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sp = request.nextUrl.searchParams;
  const brandName = sp.get("name") || slug;
  const period = parseInt(sp.get("period") || "365", 10);
  const host = sp.get("host");

  const supabase = await createClient();

  // Default behaviour (no host param) is unchanged: global BPG vs competitor
  // sets. With ?host=<slug>, source sets come from brief_config.
  let bpgSources: string[] = [...BPG_SOURCES];
  let competitorSources: string[] = [...COMPETITOR_SOURCES];
  if (host) {
    const { config } = await resolveHostConfig(supabase, host);
    bpgSources = config.bpg_sources;
    competitorSources = config.all_competitors;
  }

  const { data, error } = await supabase.rpc("brand_coverage", {
    brand_name: brandName,
    bpg_sources: bpgSources,
    competitor_sources: competitorSources,
    period_days: period,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
