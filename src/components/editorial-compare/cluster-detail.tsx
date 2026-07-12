"use client";

import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import { formatRelativeTime, formatDate } from "@/lib/format";

export interface ClusterItem {
  source_id: string;
  title: string;
  url: string;
  published_at: string | null;
  is_first: boolean;
  similarity: number | null;
}

export interface ClusterDetailData {
  cluster_id: number;
  items: ClusterItem[];
}

export function ClusterDetail({
  data,
  loading,
  onClose,
}: {
  data: ClusterDetailData | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-white p-4 space-y-3">
        <div className="h-5 w-40 animate-pulse rounded bg-surface" />
        <div className="h-16 animate-pulse rounded bg-surface" />
        <div className="h-16 animate-pulse rounded bg-surface" />
        <div className="h-16 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-center">
        <p className="text-sm text-muted">
          Select a story to see every publication&apos;s take.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          The story race ({data.items.length})
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>

      {data.items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">
          No coverage found for this story.
        </p>
      ) : (
        <ol className="relative space-y-4 border-l border-border/60 pl-4">
          {data.items.map((item, i) => (
            <li key={`${item.source_id}-${i}`} className="relative">
              {/* timeline dot */}
              <span
                className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white"
                style={{ backgroundColor: SOURCE_COLORS[item.source_id] || "#71717A" }}
              />
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: SOURCE_COLORS[item.source_id] || "#71717A" }}
                >
                  {SOURCE_LABELS[item.source_id] || item.source_id}
                </span>
                {item.is_first && (
                  <span className="rounded-full bg-increase/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-increase">
                    First
                  </span>
                )}
                {item.published_at && (
                  <span
                    className="text-xs text-muted"
                    title={formatDate(item.published_at)}
                  >
                    {formatRelativeTime(item.published_at)}
                  </span>
                )}
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm text-foreground hover:text-accent hover:underline"
              >
                {item.title}
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
