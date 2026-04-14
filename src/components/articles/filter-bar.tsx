"use client";

interface Publication {
  slug: string;
  name: string;
}

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  source: string;
  onSourceChange: (value: string) => void;
  sponsored: string;
  onSponsoredChange: (value: string) => void;
  publications: Publication[];
}

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

export function FilterBar({
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  source,
  onSourceChange,
  sponsored,
  onSponsoredChange,
  publications,
}: FilterBarProps) {
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

      {/* Date range */}
      <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
        {DATE_RANGES.map((dr) => (
          <button
            key={dr.value}
            onClick={() => onDateRangeChange(dr.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              dateRange === dr.value
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-foreground hover:bg-surface-elevated"
            }`}
          >
            {dr.label}
          </button>
        ))}
      </div>

      {/* Source dropdown */}
      <select
        value={source}
        onChange={(e) => onSourceChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">All sources</option>
        {publications.map((pub) => (
          <option key={pub.slug} value={pub.slug}>
            {pub.name}
          </option>
        ))}
      </select>

      {/* Sponsored filter */}
      <select
        value={sponsored}
        onChange={(e) => onSponsoredChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="all">All content</option>
        <option value="yes">Sponsored only</option>
        <option value="no">Non-sponsored</option>
      </select>
    </div>
  );
}
