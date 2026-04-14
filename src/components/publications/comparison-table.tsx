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

export function ComparisonTable({ stats }: { stats: PublicationStat[] }) {
  if (stats.length === 0) return null;

  const maxArticles = Math.max(...stats.map((s) => s.article_count));

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">
        Publication Comparison
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-medium text-muted">Publication</th>
              <th className="pb-2 pr-4 font-medium text-muted text-right">Articles</th>
              <th className="pb-2 pr-4 font-medium text-muted text-right">Per Day</th>
              <th className="pb-2 pr-4 font-medium text-muted text-right">Avg Words</th>
              <th className="pb-2 pr-4 font-medium text-muted text-right">Sponsored</th>
              <th className="pb-2 font-medium text-muted">Volume</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => {
              const pct = maxArticles > 0 ? (stat.article_count / maxArticles) * 100 : 0;
              const color = SOURCE_COLORS[stat.source_id] || "#71717A";
              return (
                <tr key={stat.source_id} className="border-b border-border/50">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-foreground">
                        {SOURCE_LABELS[stat.source_id] || stat.source_id}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-foreground">
                    {stat.article_count.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {stat.articles_per_day}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {stat.avg_word_count.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {(stat.sponsored_pct * 100).toFixed(0)}%
                  </td>
                  <td className="py-2.5 w-32">
                    <div className="h-3 rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
