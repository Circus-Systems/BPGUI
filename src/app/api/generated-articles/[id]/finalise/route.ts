import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const service = createServiceClient();

  const { data: article, error: fetchError } = await service
    .from("generated_articles")
    .select("status")
    .eq("id", parseInt(id))
    .single();

  if (fetchError || !article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (article.status !== "draft") {
    return NextResponse.json(
      { error: `Cannot finalise article with status '${article.status}'` },
      { status: 400 }
    );
  }

  const { data, error } = await service
    .from("generated_articles")
    .update({
      edited_title: body.edited_title,
      edited_excerpt: body.edited_excerpt,
      edited_body_html: body.edited_body_html,
      edited_categories: body.edited_categories,
      edited_tags: body.edited_tags,
      status: "pending",
      finalised_at: new Date().toISOString(),
      finalised_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parseInt(id))
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
