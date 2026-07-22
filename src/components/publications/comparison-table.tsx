"use client";

import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { csvFilename } from "@/lib/csv";

const CSV_HEADERS = [
  "Publication",
  "Articles",
  "Per day",
  "Avg words",
  "Sponsored %",
  "Brands covered",
  "First to story %",
];

interface PublicationStat {
  source_id: string;
  article_count: number;
  avg_word_count: number;
  sponsored_pct: number;
  articles_per_day: number;
  last_published: string | null;
  brands_covered: number;
  first_pct: number | null;
}

export function ComparisonTable({
  stats,
  onPublicationClick,
}: {
  stats: PublicationStat[];
  onPublicationClick?: (sourceId: string) => void;
}) {
  if (stats.length === 0) return null;

  const maxArticles = Math.max(...stats.map((s) => s.article_count));

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">
          Publication Comparison
        </h3>
        <DownloadCsvButton
          filename={csvFilename(["publications", "comparison"])}
          headers={CSV_HEADERS}
          disabled={stats.length === 0}
          getRows={() =>
            stats.map((s) => [
              SOURCE_LABELS[s.source_id] || s.source_id,
              s.article_count,
              s.articles_per_day,
              s.avg_word_count,
              Number((s.sponsored_pct * 100).toFixed(1)),
              s.brands_covered,
              s.first_pct == null ? null : Number(s.first_pct.toFixed(1)),
            ])
          }
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-medium text-muted">Publication</th>
              <th className="pb-2 pr-4 font-medium text-muted text-right">Articles</th>
              <th className="pb-2 pr-4 font-medium text-muted text-right">Per Day</th>
              <th className="pb-2 pr-4 font-medium text-muted text-right">Avg Words</th>
              <th className="pb-2 pr-4 font-medium text-muted text-right">Sponsored</th>
              <th className="pb-2 pr-4 font-medium text-muted text-right">Brands Covered</th>
              <th className="pb-2 pr-4 font-medium text-muted text-right">First to Story</th>
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
                      {onPublicationClick ? (
                        <button
                          type="button"
                          onClick={() => onPublicationClick(stat.source_id)}
                          className="font-medium text-accent hover:underline text-left"
                        >
                          {SOURCE_LABELS[stat.source_id] || stat.source_id}
                        </button>
                      ) : (
                        <span className="font-medium text-foreground">
                          {SOURCE_LABELS[stat.source_id] || stat.source_id}
                        </span>
                      )}
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
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {stat.brands_covered.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {stat.first_pct == null ? "—" : `${stat.first_pct.toFixed(0)}%`}
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
      <p className="mt-2 text-xs text-muted">
        First-to-story covers multi-source stories since Jul 2025.
      </p>
    </div>
  );
}
