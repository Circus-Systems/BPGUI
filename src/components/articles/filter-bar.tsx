"use client";

import { useEffect, useRef, useState } from "react";
import { SponsoredInfo } from "@/components/articles/sponsored-info";

interface Publication {
  slug: string;
  name: string;
}

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  /** Preset range in days ("30" | "90" | "180" | "365") or "all". Ignored when from/to set. */
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  /** Custom range, YYYY-MM-DD or "" */
  from: string;
  to: string;
  onCustomRangeChange: (from: string, to: string) => void;
  /** Multi-select source slugs. Empty = all sources. */
  sources: string[];
  onSourcesChange: (value: string[]) => void;
  sponsored: string;
  onSponsoredChange: (value: string) => void;
  publications: Publication[];
}

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "180", label: "180d" },
  { value: "365", label: "365d" },
];

export function FilterBar({
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  from,
  to,
  onCustomRangeChange,
  sources,
  onSourcesChange,
  sponsored,
  onSponsoredChange,
  publications,
}: FilterBarProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const customActive = Boolean(from || to);

  useEffect(() => {
    if (!sourcesOpen) return;
    const onClick = (e: MouseEvent) => {
      if (sourcesRef.current && !sourcesRef.current.contains(e.target as Node)) {
        setSourcesOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSourcesOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [sourcesOpen]);

  function toggleSource(slug: string) {
    if (sources.includes(slug)) {
      onSourcesChange(sources.filter((s) => s !== slug));
    } else {
      onSourcesChange([...sources, slug]);
    }
  }

  const sourcesLabel =
    sources.length === 0
      ? "All sources"
      : sources.length === 1
        ? publications.find((p) => p.slug === sources[0])?.name || sources[0]
        : `${sources.length} sources`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search articles..."
        className="w-full sm:w-64 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
      />

      {/* Date range presets */}
      <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
        {DATE_RANGES.map((dr) => (
          <button
            key={dr.value}
            onClick={() => onDateRangeChange(dr.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              !customActive && dateRange === dr.value
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-foreground hover:bg-surface-elevated"
            }`}
          >
            {dr.label}
          </button>
        ))}
      </div>

      {/* Custom from/to */}
      <div
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
          customActive ? "border-accent bg-accent/5" : "border-border bg-background"
        }`}
      >
        <input
          type="date"
          value={from}
          onChange={(e) => onCustomRangeChange(e.target.value, to)}
          aria-label="From date"
          className="bg-transparent text-xs text-foreground focus:outline-none"
        />
        <span className="text-xs text-muted">&ndash;</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onCustomRangeChange(from, e.target.value)}
          aria-label="To date"
          className="bg-transparent text-xs text-foreground focus:outline-none"
        />
        {customActive && (
          <button
            onClick={() => onCustomRangeChange("", "")}
            aria-label="Clear custom dates"
            className="rounded p-0.5 text-muted hover:text-foreground transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Source multi-select */}
      <div ref={sourcesRef} className="relative">
        <button
          type="button"
          onClick={() => setSourcesOpen((v) => !v)}
          aria-expanded={sourcesOpen}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            sources.length > 0
              ? "border-accent bg-accent/5 text-foreground"
              : "border-border bg-background text-foreground"
          }`}
        >
          {sourcesLabel}
          <svg
            className={`h-3.5 w-3.5 text-muted transition-transform ${sourcesOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {sourcesOpen && (
          <div className="absolute left-0 top-10 z-40 w-64 rounded-xl border border-border bg-white p-2 shadow-lg">
            <button
              type="button"
              onClick={() => onSourcesChange([])}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-accent hover:bg-surface transition-colors"
            >
              All sources
            </button>
            <div className="mt-1 max-h-72 space-y-0.5 overflow-y-auto">
              {publications.map((pub) => (
                <label
                  key={pub.slug}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-surface transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={sources.includes(pub.slug)}
                    onChange={() => toggleSource(pub.slug)}
                    className="h-3.5 w-3.5 rounded border-border accent-[var(--color-accent,#2563eb)]"
                  />
                  <span className="truncate">{pub.name}</span>
                </label>
              ))}
              {publications.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted">
                  No sources available.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sponsored filter + explanation */}
      <div className="flex items-center gap-1">
        <select
          value={sponsored}
          onChange={(e) => onSponsoredChange(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">All content</option>
          <option value="yes">Sponsored only</option>
          <option value="no">Non-sponsored</option>
        </select>
        <SponsoredInfo />
      </div>
    </div>
  );
}
