"use client";

import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";

export function SourceFilter({
  sources,
  selected,
  onToggle,
  onSelectAll,
}: {
  sources: string[];
  selected: string[];
  onToggle: (sourceId: string) => void;
  onSelectAll: () => void;
}) {
  const allSelected = selected.length === sources.length;
  const selectedSet = new Set(selected);

  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted">
          Publications ({selected.length}/{sources.length})
        </p>
        {!allSelected && (
          <button
            onClick={onSelectAll}
            className="text-xs font-medium text-accent hover:text-accent-dark transition-colors"
          >
            Select all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((sid) => {
          const isSelected = selectedSet.has(sid);
          const color = SOURCE_COLORS[sid] || "#71717A";
          return (
            <button
              key={sid}
              onClick={() => onToggle(sid)}
              aria-pressed={isSelected}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                isSelected
                  ? "border-transparent text-white"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
              style={isSelected ? { backgroundColor: color } : undefined}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: isSelected ? "rgba(255,255,255,0.85)" : color,
                }}
              />
              {SOURCE_LABELS[sid] || sid}
            </button>
          );
        })}
      </div>
    </div>
  );
}
