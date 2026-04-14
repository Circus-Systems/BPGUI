"use client";

import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";

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
}

export function ArticleCard({
  article,
  onClick,
}: {
  article: Article;
  onClick: () => void;
}) {
  const sourceLabel = SOURCE_LABELS[article.source_id] || article.source_id;
  const sourceColor = SOURCE_COLORS[article.source_id] || "#71717A";

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-white p-4 hover:border-accent/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: sourceColor }}
            />
            <span className="text-xs font-medium text-muted">
              {sourceLabel}
            </span>
            {article.published_at && (
              <span className="text-xs text-muted">
                {formatRelativeTime(article.published_at)}
              </span>
            )}
            {article.is_sponsored === 1 && (
              <span className="rounded-full bg-removed/10 px-2 py-0.5 text-xs font-medium text-removed">
                Sponsored
              </span>
            )}
          </div>

          <h3 className="text-sm font-medium text-foreground line-clamp-2">
            {article.title}
          </h3>

          {article.excerpt && (
            <p className="mt-1 text-xs text-muted line-clamp-2">
              {article.excerpt.replace(/<[^>]*>/g, "").slice(0, 200)}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-muted">
            {article.author_name && <span>{article.author_name}</span>}
            {article.word_count && <span>{article.word_count} words</span>}
            {article.categories && (
              <span className="truncate max-w-48">{article.categories}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
