"use client";

import type { ReactNode } from "react";
import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";

/** Small coloured badge for a brand's vertical (travel|cruise|luxury-travel|pharmacy). */
const VERTICAL_BADGE: Record<string, string> = {
  travel: "bg-accent/10 text-accent",
  cruise: "bg-increase/10 text-increase",
  "luxury-travel": "bg-removed/10 text-removed",
  pharmacy: "bg-new/10 text-new",
};

const VERTICAL_LABELS: Record<string, string> = {
  travel: "Travel",
  cruise: "Cruise",
  "luxury-travel": "Luxury",
  pharmacy: "Pharmacy",
};

export function VerticalBadge({ vertical }: { vertical: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        VERTICAL_BADGE[vertical] || "bg-surface text-muted"
      }`}
    >
      {VERTICAL_LABELS[vertical] || vertical}
    </span>
  );
}

/** Source chip using the shared SOURCE_COLORS / SOURCE_LABELS. */
export function SourceChip({ source }: { source: string }) {
  const color = SOURCE_COLORS[source] || "#71717A";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {SOURCE_LABELS[source] || source}
    </span>
  );
}

export interface RadarColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

export function RadarTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No signals in this window.",
}: {
  columns: RadarColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`pb-2 pr-4 font-medium text-muted ${
                  col.align === "right" ? "text-right" : ""
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-b border-border/50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-2.5 pr-4 ${
                    col.align === "right"
                      ? "text-right text-foreground"
                      : "text-foreground"
                  }`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
