"use client";

import { BPG_SOURCES, SOURCE_LABELS } from "@/lib/constants";

/**
 * Small BPG-title selector (pills). Hidden in print. The client wants the
 * evidence sheet for every trade brand, so any BPG-owned title can be picked.
 */
export function TitleSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (title: string) => void;
}) {
  return (
    <div className="print:hidden flex flex-wrap gap-1">
      {BPG_SOURCES.map((sid) => (
        <button
          key={sid}
          onClick={() => onChange(sid)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === sid
              ? "bg-accent text-white"
              : "bg-surface text-muted hover:text-foreground"
          }`}
        >
          {SOURCE_LABELS[sid] || sid}
        </button>
      ))}
    </div>
  );
}
