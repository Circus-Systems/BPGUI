import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SOURCE_LABELS } from "@/lib/constants";
import { NextResponse, type NextRequest } from "next/server";

/** Well-formed AND possible YYYY-MM-DD (rejects 2026-02-31 etc.). */
function isValidYmd(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

interface InsertionRow {
  campaign_id: number;
  run_date: string;
  source_id: string;
  ad_type: string | null;
  page_position: string | null;
  est_readership: number | null;
  clicks: number | null;
  notes: string | null;
}

const UNIQUE_VIOLATION = "23505";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  if (!Number.isFinite(campaignId)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  const body = await request.json();
  const input: Record<string, unknown>[] = Array.isArray(body.rows) ? body.rows : [];
  if (input.length === 0) return NextResponse.json({ error: "No rows" }, { status: 400 });

  const db = createServiceClient();
  const { data: campaign, error: cErr } = await db
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .single();
  if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const toInt = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };

  const rows: InsertionRow[] = [];
  for (const [i, r] of input.entries()) {
    if (!r.run_date || !r.source_id) {
      return NextResponse.json({ error: "Each row needs run_date and source_id" }, { status: 400 });
    }
    const runDate = String(r.run_date);
    const sourceId = String(r.source_id);
    if (!isValidYmd(runDate)) {
      return NextResponse.json(
        { error: `Row ${i + 1}: run_date "${runDate}" is not a valid YYYY-MM-DD date` },
        { status: 400 }
      );
    }
    if (!(sourceId in SOURCE_LABELS)) {
      return NextResponse.json(
        { error: `Row ${i + 1}: unknown publication "${sourceId}"` },
        { status: 400 }
      );
    }
    rows.push({
      campaign_id: campaignId,
      run_date: runDate,
      source_id: sourceId,
      ad_type: r.ad_type ? String(r.ad_type) : null,
      page_position: r.page_position ? String(r.page_position) : null,
      est_readership: toInt(r.est_readership),
      clicks: toInt(r.clicks),
      notes: r.notes ? String(r.notes) : null,
    });
  }

  let inserted = 0;
  let skipped = 0;
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await db.from("campaign_insertions").insert(chunk);
    if (!error) {
      inserted += chunk.length;
      continue;
    }
    if (error.code !== UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: error.message, inserted, skipped },
        { status: 500 }
      );
    }
    // Chunk contains duplicates — retry row by row to count inserted vs skipped.
    for (const row of chunk) {
      const { error: rowErr } = await db.from("campaign_insertions").insert(row);
      if (!rowErr) inserted++;
      else if (rowErr.code === UNIQUE_VIOLATION) skipped++;
      else {
        return NextResponse.json(
          { error: rowErr.message, inserted, skipped },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ inserted, skipped });
}
