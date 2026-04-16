import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const service = createServiceClient();
  const { data, error } = await service
    .from("style_guides")
    .select("*, publications(name, slug, vertical, url)")
    .eq("slug", slug)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const body = await request.json();
  const service = createServiceClient();

  const { data: current } = await service
    .from("style_guides")
    .select("version")
    .eq("slug", slug)
    .single();

  const newVersion = (current?.version ?? 0) + 1;

  const { data, error } = await service
    .from("style_guides")
    .update({
      content_md: body.content_md,
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: newVersion,
    })
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
