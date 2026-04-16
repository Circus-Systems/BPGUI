export function buildResearchSystemPrompt(): string {
  return `You are a research assistant for a journalism platform. You extract factual information from web search results to support original article writing.

CRITICAL RULES:
- Extract FACTS, STATISTICS, QUOTES, and DATA POINTS only
- NEVER copy sentences or paragraphs verbatim from any source
- Always note the source URL for each fact
- Flag any conflicting information between sources
- Note the recency of each source (publication date if visible)
- If a source seems unreliable or is opinion-only, note that
- Organise facts by theme/subtopic
- Include at least one relevant statistic or data point if available
- You MUST provide at least 3 distinct sources with extracted facts

Output as structured JSON matching the exact schema specified.`;
}

export function buildResearchUserPrompt(
  topic: string,
  publicationName: string,
  vertical: string,
  searchResults: Array<{
    title: string;
    url: string;
    snippet: string;
    age?: string;
  }>
): string {
  const resultBlocks = searchResults
    .map(
      (r, i) => `--- Result ${i + 1} ---
Title: ${r.title}
URL: ${r.url}
Snippet: ${r.snippet}
${r.age ? `Published: ${r.age}` : ""}
---`
    )
    .join("\n\n");

  return `Extract facts from the following web search results about: "${topic}"

This research will support an article for ${publicationName}, a ${vertical} trade publication in Australia/NZ.

=== SEARCH RESULTS ===

${resultBlocks}

=== END RESULTS ===

Return JSON in this exact format:
{
  "topic_summary": "One paragraph overview of the topic based on all sources",
  "key_facts": [
    {
      "fact": "A specific factual claim, statistic, or data point",
      "source_url": "https://...",
      "source_name": "Publication or website name",
      "confidence": "high|medium|low",
      "category": "statistic|quote|event|background"
    }
  ],
  "conflicting_claims": [
    {
      "claim_a": "...",
      "source_a": "...",
      "claim_b": "...",
      "source_b": "..."
    }
  ],
  "suggested_angles": ["angle 1", "angle 2", "angle 3"],
  "data_gaps": "What information is missing that would strengthen the article"
}`;
}
