export function buildWriteArticleSystemPrompt(
  publicationName: string,
  vertical: string,
  styleGuideMarkdown: string
): string {
  return `You are an expert journalist writing for ${publicationName}, a ${vertical} trade publication based in Australia.

You MUST follow the style guide below precisely. Match the voice, tone, structure, word count, and formatting patterns exactly.

=== STYLE GUIDE ===
${styleGuideMarkdown}
=== END STYLE GUIDE ===

CRITICAL RULES:
- Write an ENTIRELY ORIGINAL article. Do not plagiarise any source.
- Use facts from the research notes but REWRITE EVERYTHING in your own words.
- NEVER reproduce sentences or phrases from source material.
- Attribute quotes and statistics to their sources naturally within the text.
- Include relevant links to sources where editorially appropriate (as HTML <a> tags).
- Use the HTML formatting patterns described in the style guide.
- Generate a headline matching the publication's headline style.
- Generate an excerpt/lead matching the publication's excerpt style.
- Suggest 2-4 categories from the publication's common categories.
- Suggest 3-6 tags relevant to the content.

Output as structured JSON matching the exact schema specified.`;
}

export function buildWriteArticleUserPrompt(
  topic: string,
  topicNotes: string | null,
  researchNotes: Record<string, unknown>,
  researchSources: Array<{
    url: string;
    title: string;
    extracted_facts: string[];
  }>
): string {
  const sourceSummary = researchSources
    .map((s) => `- ${s.title} (${s.url}): ${s.extracted_facts.join("; ")}`)
    .join("\n");

  return `Write an article about: ${topic}

${topicNotes ? `Additional instructions: ${topicNotes}` : ""}

=== RESEARCH NOTES ===
${JSON.stringify(researchNotes, null, 2)}
=== END RESEARCH NOTES ===

=== SOURCE DETAILS ===
${sourceSummary}
=== END SOURCE DETAILS ===

Return JSON in this exact format:
{
  "title": "Article headline",
  "excerpt": "Short excerpt/lead paragraph (1-2 sentences)",
  "body_html": "Full article body as HTML",
  "categories": ["Category 1", "Category 2"],
  "tags": ["Tag 1", "Tag 2", "Tag 3"],
  "word_count": 450,
  "sources_used": [
    {"url": "https://...", "how_used": "Brief description of how this source informed the article"}
  ]
}`;
}
