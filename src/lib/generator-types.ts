export type ArticleGenStatus =
  | "researching"
  | "writing"
  | "draft"
  | "pending"
  | "published"
  | "failed";

export interface GeneratedArticle {
  id: number;
  publication_id: number;
  style_guide_id: number | null;
  topic: string;
  topic_notes: string | null;
  status: ArticleGenStatus;
  error_message: string | null;
  research_notes: Record<string, unknown> | null;
  research_sources: ResearchSource[] | null;
  research_completed_at: string | null;
  original_title: string | null;
  original_excerpt: string | null;
  original_body_html: string | null;
  original_categories: string[] | null;
  original_tags: string[] | null;
  generation_completed_at: string | null;
  edited_title: string | null;
  edited_excerpt: string | null;
  edited_body_html: string | null;
  edited_categories: string[] | null;
  edited_tags: string[] | null;
  word_count: number | null;
  author_name: string;
  finalised_at: string | null;
  published_at: string | null;
  model_used: string;
  research_tokens: number | null;
  generation_tokens: number | null;
  created_at: string;
  updated_at: string;
  publications?: { name: string; slug: string; vertical: string | null; url: string };
}

export interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
  extracted_facts: string[];
}

export interface StyleGuide {
  id: number;
  publication_id: number;
  slug: string;
  content_md: string;
  sample_count: number | null;
  avg_word_count: number | null;
  version: number;
  generated_at: string;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
  publications?: { name: string; slug: string; vertical: string | null; url: string };
}
