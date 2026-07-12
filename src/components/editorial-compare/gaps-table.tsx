"use client";

import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import { formatRelativeTime, formatDate } from "@/lib/format";

export interface GapRow {
  cluster_id: number;
  title: string;
  url: string;
  sources: string[];
  first_source: string;
  article_count: number;
  first_published_at: string;
}

function SourceChip({ sourceId }: { sourceId: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: SOURCE_COLORS[sourceId] || "#71717A" }}
    >
      {SOURCE_LABELS[sourceId] || sourceId}
    </span>
  );
}

export function GapsTable({
  gaps,
  selectedId,
  onSelect,
}: {
  gaps: GapRow[];
  selectedId: number | null;
  onSelect: (clusterId: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-2 pr-4 font-medium text-muted">Story</th>
            <th className="pb-2 pr-4 font-medium text-muted">Ran in</th>
            <th className="pb-2 pr-4 font-medium text-muted">First</th>
            <th className="pb-2 pr-4 font-medium text-muted text-right">
              Articles
            </th>
            <th className="pb-2 font-medium text-muted text-right">Published</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((gap) => (
            <tr
              key={gap.cluster_id}
              onClick={() => onSelect(gap.cluster_id)}
              className={`border-b border-border/50 cursor-pointer align-top transition-colors ${
                selectedId === gap.cluster_id
                  ? "bg-accent/5"
                  : "hover:bg-surface"
              }`}
            >
              <td className="py-2.5 pr-4">
                <a
                  href={gap.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-foreground hover:text-accent hover:underline"
                >
                  {gap.title}
                </a>
              </td>
              <td className="py-2.5 pr-4">
                <div className="flex flex-wrap gap-1">
                  {gap.sources.map((s) => (
                    <SourceChip key={s} sourceId={s} />
                  ))}
                </div>
              </td>
              <td className="py-2.5 pr-4 text-muted">
                {SOURCE_LABELS[gap.first_source] || gap.first_source}
              </td>
              <td className="py-2.5 pr-4 text-right text-muted">
                {gap.article_count.toLocaleString()}
              </td>
              <td
                className="py-2.5 text-right text-muted whitespace-nowrap"
                title={
                  gap.first_published_at
                    ? formatDate(gap.first_published_at)
                    : undefined
                }
              >
                {gap.first_published_at
                  ? formatRelativeTime(gap.first_published_at)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
