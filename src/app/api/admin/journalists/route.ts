import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const source = request.nextUrl.searchParams.get("source_id");
  const db = createServiceClient();
  let q = db.from("journalists").select("*").order("full_name");
  if (source) q = q.eq("source_id", source);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ journalists: data });
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const db = createServiceClient();

  if (body.rows && Array.isArray(body.rows)) {
    // Bulk insert
    const rows = body.rows.map((r: Record<string, unknown>) => ({
      full_name: r.full_name,
      slug: (r.slug as string) || String(r.full_name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      source_id: r.source_id,
      role: r.role || null,
      years_exp: r.years_exp ? Number(r.years_exp) : null,
      headshot_url: r.headshot_url || null,
      bio: r.bio || null,
      active: r.active !== false,
    }));
    const { data, error } = await db.from("journalists").upsert(rows, { onConflict: "slug" }).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inserted: data?.length || 0 });
  }

  const payload = {
    full_name: body.full_name,
    slug: body.slug || String(body.full_name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    source_id: body.source_id,
    role: body.role || null,
    years_exp: body.years_exp ? Number(body.years_exp) : null,
    headshot_url: body.headshot_url || null,
    bio: body.bio || null,
    active: body.active !== false,
  };
  const { data, error } = await db.from("journalists").upsert(payload, { onConflict: "slug" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = createServiceClient();
  const { error } = await db.from("journalists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
