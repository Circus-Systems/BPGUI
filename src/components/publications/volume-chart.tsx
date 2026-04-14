"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";

interface TimelineEntry {
  date: string;
  [sourceId: string]: string | number;
}

export function VolumeChart({
  timeline,
  sourceIds,
}: {
  timeline: TimelineEntry[];
  sourceIds: string[];
}) {
  if (timeline.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-center">
        <p className="text-sm text-muted">No timeline data available.</p>
      </div>
    );
  }

  // Format date for X axis
  const formatted = timeline.map((entry) => ({
    ...entry,
    label: entry.date.slice(5), // MM-DD
  }));

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h3 className="text-sm font-medium text-foreground mb-4">
        Daily Article Volume
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={formatted} barCategoryGap="10%">
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#71717A" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#71717A" }}
            width={30}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #E4E4E7",
            }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) => SOURCE_LABELS[value] || value}
          />
          {sourceIds.map((sid) => (
            <Bar
              key={sid}
              dataKey={sid}
              stackId="volume"
              fill={SOURCE_COLORS[sid] || "#71717A"}
              name={sid}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
