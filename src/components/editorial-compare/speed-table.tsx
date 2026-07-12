"use client";

import { SOURCE_LABELS, BPG_SOURCES } from "@/lib/constants";
import { formatLagHours } from "./format-lag";

export interface SpeedRow {
  source_id: string;
  stories_total: number;
  first_count: number;
  first_pct: number;
  median_lag_hours: number | null;
}

export function SpeedTable({ report }: { report: SpeedRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-2 pr-4 font-medium text-muted">Publication</th>
            <th className="pb-2 pr-4 font-medium text-muted text-right">
              Multi-source stories
            </th>
            <th className="pb-2 pr-4 font-medium text-muted text-right">
              First
            </th>
            <th className="pb-2 pr-4 font-medium text-muted text-right">
              First %
            </th>
            <th className="pb-2 font-medium text-muted text-right">
              Median lag
            </th>
          </tr>
        </thead>
        <tbody>
          {report.map((row) => {
            const isBpg = BPG_SOURCES.includes(row.source_id);
            return (
              <tr
                key={row.source_id}
                className="border-b border-border/50 transition-colors hover:bg-surface"
              >
                <td className="py-2.5 pr-4 font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    {isBpg && (
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full bg-accent"
                        title="BPG publication"
                      />
                    )}
                    {SOURCE_LABELS[row.source_id] || row.source_id}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right text-muted">
                  {row.stories_total.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right text-muted">
                  {row.first_count.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right text-foreground">
                  {row.first_pct.toFixed(1)}%
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
  );
}
