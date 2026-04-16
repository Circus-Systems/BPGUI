import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildStyleGuideSystemPrompt, buildStyleGuideUserPrompt } from "@/lib/prompts/style-guide";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { publication_slug, sample_size = 40 } = body;

  if (!publication_slug) {
    return NextResponse.json(
      { error: "publication_slug is required" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  const { data: pub, error: pubError } = await service
    .from("publications")
    .select("id, name, slug, url, vertical")
    .eq("slug", publication_slug)
    .single();

  if (pubError || !pub) {
    return NextResponse.json({ error: "Publication not found" }, { status: 404 });
  }

  const { data: articles, error: articlesError } = await service
    .from("articles")
    .select("title, published_at, word_count, categories, excerpt, content_text")
    .eq("source_id", pub.slug)
    .gt("word_count", 100)
    .order("published_at", { ascending: false })
    .limit(sample_size);

  if (articlesError || !articles || articles.length === 0) {
    return NextResponse.json(
      { error: `No articles found for ${pub.slug}` },
      { status: 404 }
    );
  }

  const wordCounts = articles
    .map((a) => a.word_count)
    .filter((w): w is number => w != null && w > 0);
  const avgWordCount = Math.round(
    wordCounts.reduce((sum, w) => sum + w, 0) / wordCounts.length
  );

  const anthropic = new Anthropic();
  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 8192,
    system: buildStyleGuideSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildStyleGuideUserPrompt(
          pub.name,
          pub.url,
          pub.vertical ?? "trade media",
          avgWordCount,
          articles
        ),
      },
    ],
  });

  const durationMs = Date.now() - startTime;
  const textContent = response.content.find((c) => c.type === "text");
  const styleGuideContent = textContent?.text ?? "";

  const { data: existing } = await service
    .from("style_guides")
    .select("id, version")
    .eq("slug", pub.slug)
    .single();

  let styleGuide;
  if (existing) {
    const { data, error } = await service
      .from("style_guides")
      .update({
        content_md: styleGuideContent,
        sample_count: articles.length,
        avg_word_count: avgWordCount,
        version: existing.version + 1,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    styleGuide = data;
  } else {
    const { data, error } = await service
      .from("style_guides")
      .insert({
        publication_id: pub.id,
        slug: pub.slug,
        content_md: styleGuideContent,
        sample_count: articles.length,
        avg_word_count: avgWordCount,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    styleGuide = data;
  }

  // Best-effort logging
  try {
    await service.from("generation_log").insert({
      article_id: null,
      step: "style_guide",
      model: "claude-opus-4-20250514",
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      duration_ms: durationMs,
    });
  } catch {
    // non-critical
  }

  return NextResponse.json(styleGuide);
}
