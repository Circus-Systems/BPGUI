"use client";

import { useState } from "react";

interface Column {
  key: string;
  label: string;
  format?: "text" | "number" | "date" | "percent";
}

interface ChatTableProps {
  title?: string;
  columns: Column[];
  rows: Record<string, unknown>[];
}

export function ChatTable({ title, columns, rows }: ChatTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sortedRows = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
        return sortAsc ? cmp : -cmp;
      })
    : rows;

  function formatCell(value: unknown, format?: string): string {
    if (value == null) return "—";
    switch (format) {
      case "number":
        return typeof value === "number" ? value.toLocaleString("en-AU") : String(value);
      case "percent":
        return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : String(value);
      case "date":
        return new Date(String(value)).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
      default:
        return String(value);
    }
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {title && (
        <div className="px-3 py-2 bg-surface border-b border-border">
          <p className="text-xs font-medium text-foreground">{title}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-left font-medium text-muted cursor-pointer hover:text-foreground"
                >
                  {col.label}
                  {sortKey === col.key && (sortAsc ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={i} className="border-t border-border/50 hover:bg-surface/30">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-1.5 text-foreground">
                    {formatCell(row[col.key], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
