"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import type { EntityTrendPoint } from "./entity-detail-modal";

const NEUTRAL = "#71717A";

/** YYYY-MM key from a YYYY-MM-DD (or ISO) string. */
function monthKey(d: string): string {
  return d.slice(0, 7);
}

/** Add `delta` months to a YYYY-MM key. */
function addMonths(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2025-07" → "Jul 25". */
function labelFor(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AU", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function EntityTrendChart({
  trend,
  months,
}: {
  trend: EntityTrendPoint[];
  months: number;
}) {
  // Sources that actually appear in the data, in first-seen order.
  const sources = Array.from(new Set(trend.map((r) => r.source_id)));

  // Pivot: month key → { source_id: articles }.
  const byMonth = new Map<string, Record<string, number>>();
  for (const r of trend) {
    const key = monthKey(r.month);
    const row = byMonth.get(key) || {};
    row[r.source_id] = (row[r.source_id] || 0) + r.articles;
    byMonth.set(key, row);
  }

  if (sources.length === 0) return null;

  // Build a continuous month axis, 0-filling gaps.
  const nowKey = monthKey(new Date().toISOString());
  const dataKeys = Array.from(byMonth.keys()).sort();
  const dataStart = dataKeys[0];
  const dataEnd = dataKeys[dataKeys.length - 1];
  const windowStart = addMonths(nowKey, -(months - 1));
  // For "All time" (240) anchor to the first data month to avoid rendering
  // scores of empty leading bars; otherwise fill the entire selected window.
  const start = months >= 240 && dataStart ? dataStart : windowStart;
  const end = dataEnd > nowKey ? dataEnd : nowKey;

  const axis: string[] = [];
  let cursor = start;
  for (let i = 0; i < 600 && cursor <= end; i++) {
    axis.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  const chartData = axis.map((key) => {
    const row: Record<string, string | number> = {
      month: key,
      label: labelFor(key),
    };
    const vals = byMonth.get(key) || {};
    for (const sid of sources) row[sid] = vals[sid] || 0;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} barCategoryGap="15%">
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: NEUTRAL }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: NEUTRAL }}
          width={30}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #E4E4E7",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {sources.map((sid) => (
          <Bar
            key={sid}
            dataKey={sid}
            stackId="articles"
            fill={SOURCE_COLORS[sid] || NEUTRAL}
            name={SOURCE_LABELS[sid] || sid}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
