"use client";

import { useEffect, useState } from "react";

export const PERIOD_PRESETS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "365 days" },
];

function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function PeriodPicker({
  days,
  isRange,
  from,
  to,
  onSelectDays,
  onApplyRange,
}: {
  days: string;
  isRange: boolean;
  from: string | null;
  to: string | null;
  onSelectDays: (days: string) => void;
  onApplyRange: (from: string, to: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(isRange);
  const [draftFrom, setDraftFrom] = useState(from || "");
  const [draftTo, setDraftTo] = useState(to || "");
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Keep drafts in sync when the URL-driven range changes externally
  useEffect(() => {
    setDraftFrom(from || "");
    setDraftTo(to || "");
    if (isRange) setShowCustom(true);
  }, [from, to, isRange]);

  const applyRange = () => {
    setRangeError(null);
    if (!draftFrom || !draftTo) {
      setRangeError("Select both a start and end date.");
      return;
    }
    if (draftFrom > draftTo) {
      setRangeError("Start date must be before end date.");
      return;
    }
    if (draftTo > todayLocal()) {
      setRangeError("End date cannot be in the future.");
      return;
    }
    onApplyRange(draftFrom, draftTo);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1">
        {PERIOD_PRESETS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setShowCustom(false);
              setRangeError(null);
              onSelectDays(opt.value);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !isRange && days === opt.value
                ? "bg-accent text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            isRange
              ? "bg-accent text-white"
              : "bg-surface text-muted hover:text-foreground"
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={draftFrom}
              max={draftTo || todayLocal()}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="rounded-lg border border-border bg-white px-2 py-1 text-xs text-foreground"
              aria-label="From date"
            />
            <span className="text-xs text-muted">to</span>
            <input
              type="date"
              value={draftTo}
              min={draftFrom || undefined}
              max={todayLocal()}
              onChange={(e) => setDraftTo(e.target.value)}
              className="rounded-lg border border-border bg-white px-2 py-1 text-xs text-foreground"
              aria-label="To date"
            />
            <button
              onClick={applyRange}
              className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-dark"
            >
              Apply
            </button>
          </div>
          {rangeError && (
            <p className="text-xs text-decrease">{rangeError}</p>
          )}
        </div>
      )}
    </div>
  );
}
