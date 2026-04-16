import { createClient, createServiceClient } from "@/lib/supabase/server";
import { braveSearch } from "@/lib/brave-search";
import { buildResearchSystemPrompt, buildResearchUserPrompt } from "@/lib/prompts/research";
import { buildWriteArticleSystemPrompt, buildWriteArticleUserPrompt } from "@/lib/prompts/write-article";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { publication_id, topic, topic_notes } = body;

  if (!publication_id || !topic) {
    return NextResponse.json(
      { error: "publication_id and topic are required" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  const { data: pub, error: pubError } = await service
    .from("publications")
    .select("id, name, slug, vertical")
    .eq("id", publication_id)
    .single();

  if (pubError || !pub) {
    return NextResponse.json({ error: "Publication not found" }, { status: 404 });
  }

  const { data: styleGuide } = await service
    .from("style_guides")
    .select("id")
    .eq("slug", pub.slug)
    .single();

  const { data: article, error: insertError } = await service
    .from("generated_articles")
    .insert({
      publication_id: pub.id,
      style_guide_id: styleGuide?.id ?? null,
      topic,
      topic_notes: topic_notes ?? null,
      status: "researching",
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError || !article) {
    return NextResponse.json({ error: insertError?.message ?? "Insert failed" }, { status: 500 });
  }

  // Run pipeline in background (research → write)
  waitUntil(runPipeline(article.id, topic, pub.name, pub.slug, pub.vertical ?? "trade media"));

  return NextResponse.json({ article_id: article.id, status: "researching" });
}

async function runPipeline(
  articleId: number,
  topic: string,
  publicationName: string,
  publicationSlug: string,
  vertical: string
) {
  const service = createServiceClient();
  const anthropic = new Anthropic();

  try {
    // === STEP 1: Research ===
    const queries = [topic, `${topic} ${vertical} Australia`, `${topic} latest news`];
    const allResults = [];
    for (const query of queries) {
      const results = await braveSearch(query, 5);
      allResults.push(...results);
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueResults = allResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    const researchStart = Date.now();
    const researchResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: buildResearchSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildResearchUserPrompt(topic, publicationName, vertical, uniqueResults.slice(0, 12)),
        },
      ],
    });
    const researchDuration = Date.now() - researchStart;

    const researchText = researchResponse.content.find((c) => c.type === "text")?.text ?? "{}";
    const jsonMatch = researchText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, researchText];
    const researchNotes = JSON.parse(jsonMatch[1]!.trim());

    const researchSources = uniqueResults.slice(0, 12).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      extracted_facts:
        researchNotes.key_facts
          ?.filter((f: { source_url: string }) => f.source_url === r.url)
          .map((f: { fact: string }) => f.fact) ?? [],
    }));

    await service.from("generated_articles").update({
      research_notes: researchNotes,
      research_sources: researchSources,
      research_completed_at: new Date().toISOString(),
      research_tokens: (researchResponse.usage?.input_tokens ?? 0) + (researchResponse.usage?.output_tokens ?? 0),
      status: "writing",
      updated_at: new Date().toISOString(),
    }).eq("id", articleId);

    await service.from("generation_log").insert({
      article_id: articleId,
      step: "research",
      model: "claude-sonnet-4-20250514",
      input_tokens: researchResponse.usage?.input_tokens ?? 0,
      output_tokens: researchResponse.usage?.output_tokens ?? 0,
      duration_ms: researchDuration,
    });

    // === STEP 2: Write ===
    let styleGuideContent = "No style guide available. Write in a professional trade journalism style appropriate for Australian media.";
    const { data: guide } = await service
      .from("style_guides")
      .select("content_md")
      .eq("slug", publicationSlug)
      .single();
    if (guide) styleGuideContent = guide.content_md;

    const writeStart = Date.now();
    const writeResponse = await anthropic.messages.create({
      model: "claude-opus-4-20250514",
      max_tokens: 8192,
      system: buildWriteArticleSystemPrompt(publicationName, vertical, styleGuideContent),
      messages: [
        {
          role: "user",
          content: buildWriteArticleUserPrompt(topic, null, researchNotes, researchSources),
        },
      ],
    });
    const writeDuration = Date.now() - writeStart;

    const writeText = writeResponse.content.find((c) => c.type === "text")?.text ?? "{}";
    const writeJsonMatch = writeText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, writeText];
    const articleData = JSON.parse(writeJsonMatch[1]!.trim());

    await service.from("generated_articles").update({
      original_title: articleData.title,
      original_excerpt: articleData.excerpt,
      original_body_html: articleData.body_html,
      original_categories: articleData.categories ?? [],
      original_tags: articleData.tags ?? [],
      word_count: articleData.word_count ?? null,
      generation_completed_at: new Date().toISOString(),
      generation_tokens: (writeResponse.usage?.input_tokens ?? 0) + (writeResponse.usage?.output_tokens ?? 0),
      model_used: "claude-opus-4-20250514",
      status: "draft",
      updated_at: new Date().toISOString(),
    }).eq("id", articleId);

    await service.from("generation_log").insert({
      article_id: articleId,
      step: "write",
      model: "claude-opus-4-20250514",
      input_tokens: writeResponse.usage?.input_tokens ?? 0,
      output_tokens: writeResponse.usage?.output_tokens ?? 0,
      duration_ms: writeDuration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    await service.from("generated_articles").update({
      status: "failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    }).eq("id", articleId);
  }
}
