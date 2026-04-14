"use client";

import { SOURCE_LABELS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";

interface Run {
  id: number;
  collector_id: string;
  collector_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_collected: number;
  items_new: number;
  items_updated: number;
  errors_json: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  success: "bg-increase/10 text-increase",
  error: "bg-decrease/10 text-decrease",
  running: "bg-accent/10 text-accent",
};

export function RunTimeline({
  runs,
  loading,
}: {
  runs: Run[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-4">No recent runs.</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {runs.map((run) => {
        const duration =
          run.finished_at && run.started_at
            ? Math.round(
                (new Date(run.finished_at).getTime() -
                  new Date(run.started_at).getTime()) /
                  1000
              )
            : null;

        return (
          <div
            key={run.id}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-white px-3 py-2 text-xs"
          >
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                STATUS_BADGE[run.status] || "bg-surface text-muted"
              }`}
            >
              {run.status}
            </span>
            <span className="font-medium text-foreground truncate w-32">
              {SOURCE_LABELS[run.collector_id] || run.collector_id}
            </span>
            <span className="text-muted">
              {formatRelativeTime(run.started_at)}
            </span>
            {duration !== null && (
              <span className="text-muted">{duration}s</span>
            )}
            <span className="text-muted ml-auto">
              {run.items_collected} collected
              {run.items_new > 0 && (
                <span className="text-increase ml-1">+{run.items_new} new</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
