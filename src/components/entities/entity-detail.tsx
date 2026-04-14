"use client";

import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";

interface EntityDetailData {
  entity_name: string;
  entity_type: string;
  article_count: number;
  total_mentions: number;
  articles: Array<{
    source_id: string;
    external_id: string;
    title: string;
    url: string;
    published_at: string | null;
    author_name: string | null;
  }>;
  co_occurrences: Array<{
    name: string;
    type: string;
    count: number;
  }>;
  source_distribution: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  company: "bg-accent/10 text-accent",
  destination: "bg-increase/10 text-increase",
  industry_body: "bg-removed/10 text-removed",
};

export function EntityDetail({
  data,
  loading,
}: {
  data: EntityDetailData | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-surface" />
        <div className="h-4 w-32 animate-pulse rounded bg-surface" />
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-center">
        <p className="text-sm text-muted">
          Select an entity to view details.
        </p>
      </div>
    );
  }

  const sortedSources = Object.entries(data.source_distribution)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {data.entity_name}
        </h2>
        <div className="mt-1 flex items-center gap-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              TYPE_COLORS[data.entity_type] || "bg-surface text-muted"
            }`}
          >
            {data.entity_type.replace("_", " ")}
          </span>
          <span className="text-xs text-muted">
            {data.total_mentions.toLocaleString()} mentions in{" "}
            {data.article_count.toLocaleString()} articles
          </span>
        </div>
      </div>

      {/* Source Distribution */}
      <div className="rounded-xl border border-border bg-white p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Source Distribution
        </h3>
        <div className="space-y-2">
          {sortedSources.map(([sourceId, count]) => {
            const maxCount = sortedSources[0]?.[1] || 1;
            const pct = (count / maxCount) * 100;
            return (
              <div key={sourceId} className="flex items-center gap-2">
                <span className="w-32 text-xs text-muted truncate">
                  {SOURCE_LABELS[sourceId] || sourceId}
                </span>
                <div className="flex-1 h-4 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: SOURCE_COLORS[sourceId] || "#71717A",
                    }}
                  />
                </div>
                <span className="w-8 text-xs text-muted text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Co-occurring Entities */}
      {data.co_occurrences.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Frequently Mentioned Together
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {data.co_occurrences.map((co) => (
              <span
                key={co.name}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  TYPE_COLORS[co.type] || "bg-surface text-muted"
                }`}
              >
                {co.name}
                <span className="ml-1 opacity-60">({co.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Articles */}
      <div className="rounded-xl border border-border bg-white p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Recent Articles ({data.articles.length})
        </h3>
        <div className="space-y-2">
          {data.articles.map((article) => (
            <a
              key={`${article.source_id}-${article.external_id}`}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg p-2 hover:bg-surface transition-colors"
            >
              <p className="text-sm text-foreground line-clamp-1">
                {article.title}
              </p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                <span>{SOURCE_LABELS[article.source_id] || article.source_id}</span>
                {article.published_at && (
                  <span>{formatRelativeTime(article.published_at)}</span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
