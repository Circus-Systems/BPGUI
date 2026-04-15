import { createClient } from "@/lib/supabase/server";
import { BPG_SOURCES } from "@/lib/constants";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Newsroom roster — top journalists per BPG publication by article count.
 * Pulled from articles.author_name with a human-name filter (see
 * bpg_newsroom_roster RPC).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const perSource = parseInt(sp.get("per_source") || "6", 10);
  const sinceDays = parseInt(sp.get("since_days") || "3650", 10);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bpg_newsroom_roster", {
    p_sources: [...BPG_SOURCES],
    p_per_source: perSource,
    p_since_days: sinceDays,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ roster: data || [] });
}
