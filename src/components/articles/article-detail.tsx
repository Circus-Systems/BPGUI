"use client";

import { useEffect, useState } from "react";
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
  tags?: string | null;
  content_text?: string | null;
  content_html?: string | null;
}

export function ArticleDetail({
  article,
  onClose,
}: {
  article: Article;
  onClose: () => void;
}) {
  const sourceLabel = SOURCE_LABELS[article.source_id] || article.source_id;
  const [full, setFull] = useState<Article>(article);
  const [loadingFull, setLoadingFull] = useState(false);

  useEffect(() => {
    setFull(article);
    // If we don't already have the full body, fetch it
    if (!article.content_text && !article.content_html) {
      let cancelled = false;
      setLoadingFull(true);
      fetch(`/api/articles/${article.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.article) setFull(d.article);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingFull(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [article]);

  // Escape key to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tags = (full.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const categories = (full.categories || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

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
            aria-label="Close"
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
            {full.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            {full.author_name && (
              <span>
                <span className="text-muted/70">By</span> {full.author_name}
              </span>
            )}
            {full.published_at && (
              <span>{formatDate(full.published_at)}</span>
            )}
            {full.word_count != null && <span>{full.word_count} words</span>}
            {full.is_sponsored === 1 && (
              <span className="rounded-full bg-removed/10 px-2 py-0.5 text-xs font-medium text-removed">
                Sponsored
              </span>
            )}
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted">Categories:</span>
              {categories.map((cat) => (
                <span
                  key={`cat-${cat}`}
                  className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-foreground"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted">Tags:</span>
              {tags.map((tag) => (
                <span
                  key={`tag-${tag}`}
                  className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <a
            href={full.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-accent hover:text-accent-dark transition-colors"
          >
            View original article &rarr;
          </a>

          <div className="border-t border-border pt-4">
            {loadingFull && (
              <div className="space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-surface" />
                <div className="h-4 w-11/12 animate-pulse rounded bg-surface" />
                <div className="h-4 w-10/12 animate-pulse rounded bg-surface" />
                <div className="h-4 w-9/12 animate-pulse rounded bg-surface" />
              </div>
            )}

            {!loadingFull && full.content_html && (
              <div
                className="prose prose-sm max-w-none text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: full.content_html }}
              />
            )}

            {!loadingFull && !full.content_html && full.content_text && (
              <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                {full.content_text}
              </p>
            )}

            {!loadingFull &&
              !full.content_html &&
              !full.content_text &&
              full.excerpt && (
                <p className="text-sm text-muted">
                  {full.excerpt.replace(/<[^>]*>/g, "")}
                </p>
              )}

            {!loadingFull &&
              !full.content_html &&
              !full.content_text &&
              !full.excerpt && (
                <p className="text-sm text-muted">
                  No full content stored for this article.{" "}
                  <a
                    href={full.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-dark"
                  >
                    View original &rarr;
                  </a>
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
