"use client";

import { SOURCE_LABELS, BPG_SOURCES } from "@/lib/constants";
import { formatLagHours } from "./format-lag";
import { DownloadCsvButton } from "@/components/download-csv-button";
import { csvFilename } from "@/lib/csv";

const CSV_HEADERS = [
  "Publication",
  "Is wire",
  "Multi-source stories",
  "First",
  "First %",
  "Median lag hours",
];

export interface SpeedRow {
  source_id: string;
  stories_total: number;
  first_count: number;
  first_pct: number;
  median_lag_hours: number | null;
  is_wire?: boolean;
}

export function SpeedTable({ report }: { report: SpeedRow[] }) {
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <DownloadCsvButton
          filename={csvFilename(["editorial-compare", "speed"])}
          headers={CSV_HEADERS}
          disabled={report.length === 0}
          getRows={() =>
            report.map((row) => [
              SOURCE_LABELS[row.source_id] || row.source_id,
              row.is_wire ? "yes" : "no",
              row.stories_total,
              row.first_count,
              Number(row.first_pct.toFixed(1)),
              row.median_lag_hours,
            ])
          }
        />
      </div>
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
            const isWire = row.is_wire ?? false;
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
                <td className="py-2.5 pr-4 text-right text-muted">
                  {row.stories_total.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right text-muted">
                  {row.first_count.toLocaleString()}
                </td>
                <td
                  className={`py-2.5 pr-4 text-right ${
                    isWire ? "text-muted" : "text-foreground"
                  }`}
                >
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
    </div>
  );
}
