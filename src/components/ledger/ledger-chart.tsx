"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { quarterLabel, formatAudCompact, type LedgerRow } from "./format-value";

const BPG_COLOR = "#2563EB"; // accent
const COMP_COLOR = "#A1A1AA"; // neutral grey
const VALUE_COLOR = "#D97706"; // amber — promotional value line
const NEUTRAL = "#71717A";

const VALUE_SERIES = "Promotional value (mid)";

/**
 * Quarterly composed chart: grouped bars for BPG vs competitor article volume
 * (left axis) plus a promotional-value line (right axis, AUD).
 *
 * isAnimationActive={false} on EVERY series is a hard requirement — recharts'
 * mount animation never settles under headless/print rendering, so animated
 * series come out blank.
 */
export function LedgerChart({ rows }: { rows: LedgerRow[] }) {
  const data = rows.map((r) => ({
    label: quarterLabel(r.quarter),
    bpg: r.bpg_articles,
    competitors: r.competitor_articles,
    value: r.value_mid,
  }));

  return (
    <div
      className="rounded-xl border border-border bg-white p-4"
      style={{ breakInside: "avoid" }}
    >
      <h3 className="mb-4 text-sm font-medium text-foreground">
        Article volume and promotional value by quarter
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E4E4E7"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: NEUTRAL }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="count"
            tick={{ fontSize: 10, fill: NEUTRAL }}
            width={32}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="value"
            orientation="right"
            tick={{ fontSize: 10, fill: NEUTRAL }}
            width={48}
            tickFormatter={(v) => formatAudCompact(Number(v))}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #E4E4E7",
            }}
            formatter={(value, name) =>
              name === VALUE_SERIES
                ? [formatAudCompact(Number(value)), name]
                : [value as number, name]
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            yAxisId="count"
            dataKey="bpg"
            name="BPG articles"
            fill={BPG_COLOR}
            isAnimationActive={false}
          />
          <Bar
            yAxisId="count"
            dataKey="competitors"
            name="Competitor articles"
            fill={COMP_COLOR}
            isAnimationActive={false}
          />
          <Line
            yAxisId="value"
            type="monotone"
            dataKey="value"
            name={VALUE_SERIES}
            stroke={VALUE_COLOR}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
