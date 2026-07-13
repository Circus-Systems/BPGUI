"use client";

import { SOURCE_LABELS } from "@/lib/constants";
import { formatLagHours } from "@/components/editorial-compare/format-lag";

export interface BenchmarkRow {
  source_id: string;
  article_count: number;
  articles_per_day: number;
  brands_covered: number;
  first_pct: number | null;
  median_lag_hours: number | null;
  is_wire?: boolean;
}

/**
 * Comparison table: the selected BPG title first (highlighted) followed by its
 * vertical's competitor titles. Reuses the publications-stats + speed metrics.
 */
export function ComparisonTable({
  rows,
  selectedId,
}: {
  rows: BenchmarkRow[];
  selectedId: string;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-white p-4"
      style={{ breakInside: "avoid" }}
    >
      <h3 className="mb-4 text-sm font-medium text-foreground">
        {SOURCE_LABELS[selectedId] || selectedId} vs competitors — last 12 months
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-medium text-muted">Publication</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                Articles
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                Per day
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                Brands covered
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                First-to-story %
              </th>
              <th className="pb-2 text-right font-medium text-muted">
                Median lag
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.source_id === selectedId;
              const isWire = row.is_wire ?? false;
              return (
                <tr
                  key={row.source_id}
                  className={`border-b border-border/50 ${
                    isSelected ? "bg-accent-light" : "hover:bg-surface"
                  }`}
                >
                  <td
                    className={`py-2.5 pr-4 font-medium ${
                      isSelected ? "text-accent-dark" : "text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isSelected && (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full bg-accent"
                          title="Selected title"
                        />
                      )}
                      {SOURCE_LABELS[row.source_id] || row.source_id}
                      {isWire && (
                        <span
                          className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted"
                          title="Press-release wire — excluded from the first-to-story race"
                        >
                          Wire
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-foreground">
                    {row.article_count.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {row.articles_per_day.toFixed(1)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {row.brands_covered.toLocaleString()}
                  </td>
                  <td
                    className={`py-2.5 pr-4 text-right ${
                      isWire ? "text-muted" : "text-foreground"
                    }`}
                  >
                    {row.first_pct == null ? "—" : `${row.first_pct.toFixed(1)}%`}
                  </td>
                  <td className="py-2.5 text-right text-muted">
                    {formatLagHours(row.median_lag_hours)}
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
