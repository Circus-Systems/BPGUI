"use client";

import { formatDate } from "@/lib/format";
import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import type { EntityArticle } from "./entity-detail-modal";

const NEUTRAL = "#71717A";

export function EntityArticlesTable({
  articles,
  total,
  onLoadMore,
  loadingMore,
}: {
  articles: EntityArticle[];
  total: number;
  onLoadMore: () => void;
  loadingMore: boolean;
}) {
  const hasMore = articles.length < total;

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-foreground">
        Articles — showing {articles.length.toLocaleString()} of{" "}
        {total.toLocaleString()}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-medium text-muted">Date</th>
              <th className="pb-2 pr-4 font-medium text-muted">Title</th>
              <th className="pb-2 pr-4 font-medium text-muted">Publication</th>
              <th className="pb-2 pr-4 font-medium text-muted">Journalist</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                Words
              </th>
              <th className="pb-2 font-medium text-muted">Badges</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a, i) => (
              <tr
                key={`${a.source_id}-${a.url}-${i}`}
                className="border-b border-border/50"
              >
                <td className="whitespace-nowrap py-2.5 pr-4 text-muted">
                  {a.published_at ? formatDate(a.published_at) : "—"}
                </td>
                <td className="py-2.5 pr-4">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {a.title}
                  </a>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-foreground">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: SOURCE_COLORS[a.source_id] || NEUTRAL,
                      }}
                    />
                    {SOURCE_LABELS[a.source_id] || a.source_id}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-muted">
                  {a.author_name || "—"}
                </td>
                <td className="py-2.5 pr-4 text-right text-foreground">
                  {a.word_count == null ? "—" : a.word_count.toLocaleString()}
                </td>
                <td className="py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {a.in_title === 1 && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        Headline
                      </span>
                    )}
                    {a.is_sponsored === 1 && (
                      <span className="rounded-full bg-removed/10 px-2 py-0.5 text-xs font-medium text-removed">
                        Sponsored
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-full bg-surface px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
