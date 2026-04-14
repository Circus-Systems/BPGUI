"use client";

import { SOURCE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

interface Article {
  id: number;
  source_id: string;
  title: string;
  url: string;
  excerpt: string | null;
  author_name: string | null;
  published_at: string | null;
  word_count: number | null;
  is_sponsored: number;
  categories: string | null;
  content_text?: string | null;
}

export function ArticleDetail({
  article,
  onClose,
}: {
  article: Article;
  onClose: () => void;
}) {
  const sourceLabel = SOURCE_LABELS[article.source_id] || article.source_id;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-white px-6 py-4">
          <h2 className="text-sm font-medium text-muted">{sourceLabel}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <h1 className="text-xl font-semibold text-foreground">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            {article.author_name && <span>{article.author_name}</span>}
            {article.published_at && (
              <span>{formatDate(article.published_at)}</span>
            )}
            {article.word_count && <span>{article.word_count} words</span>}
            {article.is_sponsored === 1 && (
              <span className="rounded-full bg-removed/10 px-2 py-0.5 text-xs font-medium text-removed">
                Sponsored
              </span>
            )}
          </div>

          {article.categories && (
            <div className="flex flex-wrap gap-1.5">
              {article.categories.split(",").map((cat) => (
                <span
                  key={cat.trim()}
                  className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-muted"
                >
                  {cat.trim()}
                </span>
              ))}
            </div>
          )}

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-accent hover:text-accent-dark transition-colors"
          >
            View original article &rarr;
          </a>

          {article.content_text && (
            <div className="prose prose-sm max-w-none border-t border-border pt-4">
              <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                {article.content_text}
              </p>
            </div>
          )}

          {!article.content_text && article.excerpt && (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted">
                {article.excerpt.replace(/<[^>]*>/g, "")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
