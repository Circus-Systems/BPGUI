import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Well-formed AND possible YYYY-MM-DD (rejects 2026-02-31 etc.). */
function isValidYmd(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createServiceClient();
  const { data: campaigns, error } = await db
    .from("campaigns")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<number, number> = {};
  const ids = (campaigns || []).map((c) => c.id);
  if (ids.length > 0) {
    const { data: insertions, error: iErr } = await db
      .from("campaign_insertions")
      .select("campaign_id")
      .in("campaign_id", ids);
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
    for (const row of insertions || []) {
      counts[row.campaign_id] = (counts[row.campaign_id] || 0) + 1;
    }
  }

  return NextResponse.json({
    campaigns: (campaigns || []).map((c) => ({ ...c, insertion_count: counts[c.id] || 0 })),
  });
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!brand || !name) return NextResponse.json({ error: "brand and name are required" }, { status: 400 });
  if (!isValidYmd(body.period_start) || !isValidYmd(body.period_end)) {
    return NextResponse.json(
      { error: "period_start and period_end must be valid YYYY-MM-DD dates" },
      { status: 400 }
    );
  }
  if (body.period_start > body.period_end) {
    return NextResponse.json({ error: "period_start must be <= period_end" }, { status: 400 });
  }

  const toNumber = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const db = createServiceClient();
  const { data, error } = await db
    .from("campaigns")
    .insert({
      brand,
      name,
      period_start: body.period_start,
      period_end: body.period_end,
      spend_aud: toNumber(body.spend_aud),
      // TEXT column by design — carries values like "2x bonus eDMs" as well
      // as plain numbers; UIs format numerically only when parseable.
      bonus_ad_value:
        body.bonus_ad_value !== null && body.bonus_ad_value !== undefined && String(body.bonus_ad_value).trim() !== ""
          ? String(body.bonus_ad_value).trim()
          : null,
      estimated_reach: toNumber(body.estimated_reach),
      creative_url: body.creative_url ? String(body.creative_url).trim() : null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = createServiceClient();
  // Remove insertions first in case there is no FK cascade.
  const { error: iErr } = await db.from("campaign_insertions").delete().eq("campaign_id", id);
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
  const { error } = await db.from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
