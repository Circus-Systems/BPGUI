"use client";

import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";

interface PublicationStat {
  source_id: string;
  article_count: number;
  avg_word_count: number;
  sponsored_pct: number;
  articles_per_day: number;
  last_published: string | null;
}

export function PublicationCard({ stat }: { stat: PublicationStat }) {
  const color = SOURCE_COLORS[stat.source_id] || "#71717A";
  const label = SOURCE_LABELS[stat.source_id] || stat.source_id;

  return (
    <div className="rounded-xl border border-border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-sm font-semibold text-foreground truncate">
          {label}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted">Articles</p>
          <p className="text-lg font-semibold text-foreground">
            {stat.article_count.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Per Day</p>
          <p className="text-lg font-semibold text-foreground">
            {stat.articles_per_day}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Avg Words</p>
          <p className="text-sm font-medium text-foreground">
            {stat.avg_word_count.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Sponsored</p>
          <p className="text-sm font-medium text-foreground">
            {(stat.sponsored_pct * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {stat.last_published && (
        <p className="text-xs text-muted">
          Last published {formatRelativeTime(stat.last_published)}
        </p>
      )}
    </div>
  );
}
