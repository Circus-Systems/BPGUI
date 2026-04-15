import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const articleId = parseInt(id, 10);
  if (!Number.isFinite(articleId)) {
    return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, source_id, external_id, title, url, excerpt, content_text, content_html, author_name, published_at, word_count, is_sponsored, categories, tags"
    )
    .eq("id", articleId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Tagged entities extracted from this article
  const { data: entityRows } = await supabase
    .from("article_entities")
    .select("entity_name, entity_type, mention_count, in_title")
    .eq("source_id", data.source_id)
    .eq("external_id", data.external_id)
    .order("mention_count", { ascending: false });

  return NextResponse.json({ article: data, entities: entityRows || [] });
}
