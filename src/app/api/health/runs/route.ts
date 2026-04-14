import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const collectorId = params.get("collector") || "";
  const limit = Math.min(parseInt(params.get("limit") || "50", 10), 200);

  const supabase = await createClient();

  let query = supabase
    .from("run_history")
    .select("id, collector_id, collector_type, status, started_at, finished_at, items_collected, items_new, items_updated, errors_json")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (collectorId) {
    query = query.eq("collector_id", collectorId);
  }

  const { data: runs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: runs || [] });
}
