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
import type { PublicationTrendPoint } from "./publication-detail-modal";

const NEUTRAL = "#71717A";
const OTHER_LABEL = "Other";
const OTHER_COLOR = "#A1A1AA";

/**
 * Fixed 20-color categorical palette, assigned to top brands by rank.
 * Distinct hues, all dark enough to read on white.
 */
const BRAND_PALETTE = [
  "#2563EB", // blue
  "#DC2626", // red
  "#059669", // emerald
  "#D97706", // amber
  "#7C3AED", // violet
  "#DB2777", // pink
  "#0891B2", // cyan
  "#65A30D", // lime
  "#EA580C", // orange
  "#4F46E5", // indigo
  "#0D9488", // teal
  "#CA8A04", // gold
  "#9333EA", // purple
  "#E11D48", // rose
  "#16A34A", // green
  "#0369A1", // sky
  "#B45309", // brown
  "#7E22CE", // deep purple
  "#BE185D", // magenta
  "#15803D", // dark green
];

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

export function PublicationBrandChart({
  trend,
  months,
}: {
  trend: PublicationTrendPoint[];
  months: number;
}) {
  if (trend.length === 0) return null;

  // Window totals per brand → rank order. 'Other' is excluded from ranking and
  // always rendered last in the stack.
  const totals = new Map<string, number>();
  let hasOther = false;
  for (const r of trend) {
    const isOther = r.brand_id == null || r.brand === OTHER_LABEL;
    if (isOther) {
      hasOther = true;
      continue;
    }
    totals.set(r.brand, (totals.get(r.brand) || 0) + r.articles);
  }

  const rankedBrands = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([brand]) => brand);

  // Series in stack order: ranked brands first, 'Other' last.
  const series: { key: string; color: string }[] = rankedBrands.map(
    (brand, i) => ({
      key: brand,
      color: BRAND_PALETTE[i % BRAND_PALETTE.length],
    })
  );
  if (hasOther) series.push({ key: OTHER_LABEL, color: OTHER_COLOR });

  if (series.length === 0) return null;

  // Pivot: month key → { brand: articles }.
  const byMonth = new Map<string, Record<string, number>>();
  for (const r of trend) {
    const key = monthKey(r.month);
    const seriesKey =
      r.brand_id == null || r.brand === OTHER_LABEL ? OTHER_LABEL : r.brand;
    const row = byMonth.get(key) || {};
    row[seriesKey] = (row[seriesKey] || 0) + r.articles;
    byMonth.set(key, row);
  }

  // Continuous month axis, 0-filling gaps.
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
    for (const s of series) row[s.key] = vals[s.key] || 0;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
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
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="articles"
            fill={s.color}
            name={s.key}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
