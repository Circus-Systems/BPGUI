"use client";

import { useState } from "react";
import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { ArticleDetail, type ArticleDetailSeed } from "@/components/articles/article-detail";

interface Highlight {
  id: number;
  source_id: string;
  title: string;
  url: string;
  author_name: string | null;
  published_at: string;
  word_count: number | null;
  is_sponsored: number;
  excerpt: string | null;
}

export function RecentHighlights({
  highlights,
  loading,
}: {
  highlights: Highlight[];
  loading: boolean;
}) {
  const [selected, setSelected] = useState<ArticleDetailSeed | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-4">
        No articles in the last 24 hours.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {highlights.map((h) => (
          <button
            key={`${h.source_id}-${h.id}`}
            type="button"
            onClick={() => setSelected(h)}
            className="block w-full text-left rounded-lg border border-border/50 bg-white p-3 hover:border-accent/30 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-2">
              <div
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: SOURCE_COLORS[h.source_id] || "#71717A" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                  {h.title}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                  <span>{SOURCE_LABELS[h.source_id] || h.source_id}</span>
                  <span>&middot;</span>
                  <span>{formatRelativeTime(h.published_at)}</span>
                  {h.word_count && (
                    <>
                      <span>&middot;</span>
                      <span>{h.word_count.toLocaleString()} words</span>
                    </>
                  )}
                  {h.is_sponsored === 1 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 font-medium">
                      Sponsored
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <ArticleDetail article={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
