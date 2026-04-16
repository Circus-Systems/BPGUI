export function buildStyleGuideSystemPrompt(): string {
  return `You are an expert editorial analyst. You analyse article corpora to produce detailed, actionable style guides for AI article generation.

Your output is a markdown style guide that another AI can follow to write articles indistinguishable from the publication's human writers.

The style guide MUST cover these sections:

## 1. VOICE AND TONE
Formal vs conversational, authority level, use of humour, perspective (first/third person).

## 2. SENTENCE STRUCTURE
Average sentence length, complexity, use of fragments, punctuation habits.

## 3. PARAGRAPH STRUCTURE
Paragraph length, use of subheadings, bullet points, whitespace patterns.

## 4. VOCABULARY
Industry jargon level, preferred terms, avoided terms, Australian/NZ English conventions.

## 5. ARTICLE STRUCTURE
Typical opening pattern (news-led, question-led, quote-led), body flow, closing pattern.

## 6. HEADLINE STYLE
Case (title case, sentence case), length, use of colons/dashes, clickbait level.

## 7. EXCERPT / LEAD STYLE
Length, what information appears first, how it differs from the opening paragraph.

## 8. HTML FORMATTING
Tags commonly used (h2, h3, blockquote, ul, ol, strong, em, a), typical HTML structure of the article body.

## 9. WORD COUNT TARGET
Based on the corpus average, with acceptable range (min-max).

## 10. CATEGORIES AND TAGS
Common categories used by this publication, tagging patterns.

## 11. WHAT TO AVOID
Patterns, phrases, or structures NOT present in this publication that the AI should never use.

Be specific and cite short examples from the corpus to illustrate each pattern. Use direct quotes (attributed) where helpful.`;
}

export function buildStyleGuideUserPrompt(
  publicationName: string,
  publicationUrl: string,
  vertical: string,
  avgWordCount: number,
  articles: Array<{
    title: string;
    published_at: string | null;
    word_count: number | null;
    categories: string | null;
    excerpt: string | null;
    content_text: string | null;
  }>
): string {
  const articleBlocks = articles
    .map((a, i) => {
      const contentPreview = a.content_text?.slice(0, 1500) ?? "(no content)";
      return `--- Article ${i + 1} ---
Title: ${a.title}
Published: ${a.published_at ?? "unknown"}
Word count: ${a.word_count ?? "unknown"}
Categories: ${a.categories ?? "none"}
Excerpt: ${a.excerpt ?? "none"}

Body (first 1500 chars):
${contentPreview}
---`;
    })
    .join("\n\n");

  return `Analyse the following ${articles.length} articles from ${publicationName} (${publicationUrl}) and produce a comprehensive style guide.

Publication context:
- Vertical: ${vertical}
- Average word count: ${avgWordCount}
- Total articles analysed: ${articles.length}

=== ARTICLE CORPUS ===

${articleBlocks}

=== END CORPUS ===

Produce the style guide in markdown format.`;
}
