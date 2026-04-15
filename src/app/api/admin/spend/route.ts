import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const advertiser = request.nextUrl.searchParams.get("advertiser");
  const db = createServiceClient();
  let q = db.from("advertiser_spend").select("*").order("period_start", { ascending: false }).limit(500);
  if (advertiser) q = q.ilike("advertiser", `%${advertiser}%`);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ spend: data });
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const db = createServiceClient();
  const rows = (body.rows || []).map((r: Record<string, unknown>) => ({
    advertiser: r.advertiser,
    source_id: r.source_id,
    period_start: r.period_start,
    period_end: r.period_end,
    spend_aud: Number(r.spend_aud),
    product: r.product || null,
  }));
  if (rows.length === 0) return NextResponse.json({ error: "No rows" }, { status: 400 });
  const { data, error } = await db.from("advertiser_spend").upsert(rows, {
    onConflict: "advertiser,source_id,period_start,period_end,product",
  }).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: data?.length || 0 });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = createServiceClient();
  const { error } = await db.from("advertiser_spend").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
