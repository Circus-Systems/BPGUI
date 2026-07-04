import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Brief "Optimisation & Recommendations" content (slide 17).
 *
 * GET  /api/brief/recommendations?host=travel-daily&brand=Brand
 *   -> { content_md, updated_by, updated_at } (nulls when none saved)
 * POST /api/brief/recommendations  { host_slug, brand, content_md }
 *   -> upsert on (host_slug, brand). Service-role write; auth required.
 */

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const host = sp.get("host");
  const brand = sp.get("brand");
  if (!host || !brand) {
    return NextResponse.json(
      { error: "host and brand required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brief_recommendations")
    .select("content_md, updated_by, updated_at")
    .eq("host_slug", host)
    .ilike("brand", brand)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const row = data && data.length > 0 ? data[0] : null;
  return NextResponse.json({
    content_md: row?.content_md ?? null,
    updated_by: row?.updated_by ?? null,
    updated_at: row?.updated_at ?? null,
  });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const hostSlug = typeof body.host_slug === "string" ? body.host_slug : "";
  const brand = typeof body.brand === "string" ? body.brand : "";
  const contentMd = typeof body.content_md === "string" ? body.content_md : "";
  if (!hostSlug || !brand) {
    return NextResponse.json(
      { error: "host_slug and brand required" },
      { status: 400 }
    );
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("brief_recommendations")
    .upsert(
      {
        host_slug: hostSlug,
        brand,
        content_md: contentMd,
        updated_by: user.email || user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "host_slug,brand" }
    )
    .select("content_md, updated_by, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
