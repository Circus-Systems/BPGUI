"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";

export interface MonthlyPoint {
  label: string;
  [sourceId: string]: string | number;
}

/**
 * 12-month monthly volume trend: selected title vs its competitors.
 *
 * isAnimationActive={false} on EVERY series is a hard requirement — recharts'
 * rAF-driven mount animation never settles under headless/print rendering, so
 * animated series come out blank.
 */
export function TrendChart({
  data,
  sourceIds,
  selectedId,
}: {
  data: MonthlyPoint[];
  sourceIds: string[];
  selectedId: string;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-center">
        <p className="text-sm text-muted">No timeline data available.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border bg-white p-4"
      style={{ breakInside: "avoid" }}
    >
      <h3 className="mb-4 text-sm font-medium text-foreground">
        Monthly article volume — last 12 months
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#71717A" }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10, fill: "#71717A" }} width={32} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #E4E4E7",
            }}
            formatter={(value, name) => [
              value as number,
              SOURCE_LABELS[String(name)] || String(name),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) => SOURCE_LABELS[value] || value}
          />
          {sourceIds.map((sid) => (
            <Line
              key={sid}
              type="monotone"
              dataKey={sid}
              name={sid}
              stroke={SOURCE_COLORS[sid] || "#71717A"}
              strokeWidth={sid === selectedId ? 3 : 1.25}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
