import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
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
  const service = createServiceClient();

  const { data: article, error: fetchError } = await service
    .from("generated_articles")
    .select("status")
    .eq("id", parseInt(id))
    .single();

  if (fetchError || !article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (article.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot publish article with status '${article.status}'` },
      { status: 400 }
    );
  }

  const { data, error } = await service
    .from("generated_articles")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_by: user.id,
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
