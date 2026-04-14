"use client";

import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";

interface CollectorInfo {
  source_id: string;
  name: string;
  vertical: string;
  health_status: "healthy" | "warning" | "error" | "unknown";
  last_run: {
    status: string;
    started_at: string;
    finished_at: string | null;
    items_collected: number;
    items_new: number;
  } | null;
  last_article_at: string | null;
  runs_24h: number;
  success_rate_24h: number | null;
}

const STATUS_STYLES: Record<string, { dot: string; bg: string }> = {
  healthy: { dot: "bg-increase", bg: "border-increase/30" },
  warning: { dot: "bg-amber-400", bg: "border-amber-300/50" },
  error: { dot: "bg-decrease", bg: "border-decrease/30" },
  unknown: { dot: "bg-muted", bg: "border-border" },
};

export function CollectorGrid({
  collectors,
  onSelect,
  selectedCollector,
}: {
  collectors: CollectorInfo[];
  onSelect: (id: string) => void;
  selectedCollector: string | null;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {collectors.map((c) => {
        const styles = STATUS_STYLES[c.health_status] || STATUS_STYLES.unknown;
        const isSelected = selectedCollector === c.source_id;
        return (
          <button
            key={c.source_id}
            onClick={() => onSelect(c.source_id)}
            className={`rounded-xl border bg-white p-4 text-left transition-all ${
              isSelected ? "ring-2 ring-accent border-accent" : styles.bg
            } hover:shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
              <span className="text-sm font-semibold text-foreground truncate">
                {SOURCE_LABELS[c.source_id] || c.name}
              </span>
            </div>

            <div className="space-y-1 text-xs text-muted">
              {c.last_run ? (
                <>
                  <p>
                    Last run: {formatRelativeTime(c.last_run.started_at)}
                  </p>
                  <p>
                    Collected: {c.last_run.items_collected} ({c.last_run.items_new} new)
                  </p>
                </>
              ) : (
                <p>No run data</p>
              )}
              {c.last_article_at && (
                <p>Latest article: {formatRelativeTime(c.last_article_at)}</p>
              )}
              {c.runs_24h > 0 && (
                <p>
                  24h: {c.runs_24h} runs
                  {c.success_rate_24h !== null && (
                    <span className="ml-1">
                      ({(c.success_rate_24h * 100).toFixed(0)}% success)
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="mt-2">
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: SOURCE_COLORS[c.source_id]
                    ? `${SOURCE_COLORS[c.source_id]}15`
                    : "#f4f4f5",
                  color: SOURCE_COLORS[c.source_id] || "#71717A",
                }}
              >
                {c.vertical}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
