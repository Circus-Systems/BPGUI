"use client";

import { useVertical, type VerticalCode } from "@/hooks/use-vertical";

const VERTICALS: { code: VerticalCode; label: string }[] = [
  { code: "travel", label: "Travel" },
  { code: "pharmacy", label: "Pharmacy" },
];

export function VerticalSelector() {
  const { vertical, setVertical } = useVertical();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
      {VERTICALS.map((v) => (
        <button
          key={v.code}
          onClick={() => setVertical(v.code)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            vertical === v.code
              ? "bg-accent text-white shadow-sm"
              : "text-muted hover:text-foreground hover:bg-surface-elevated"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
