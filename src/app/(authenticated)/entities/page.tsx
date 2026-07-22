"use client";

import { useVertical } from "@/hooks/use-vertical";
import { useCallback, useEffect, useRef, useState } from "react";
import { EntityTable } from "@/components/entities/entity-table";
import { useEntityDetail } from "@/providers/entity-detail-provider";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { VERTICAL_SOURCES, SOURCE_LABELS } from "@/lib/constants";

interface Entity {
  entity_name: string;
  entity_type: string;
  total_mentions: number;
  article_count: number;
  in_title_pct: number;
  top_sentiment: string;
}

const PAGE_SIZE = 50;

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "company", label: "Company" },
  { value: "destination", label: "Destination" },
  { value: "industry_body", label: "Industry Body" },
];

const DATE_OPTIONS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

export default function EntitiesPage() {
  const { vertical } = useVertical();
  const { openEntity } = useEntityDetail();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [entityType, setEntityType] = useState("all");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Reset source filter when vertical changes (source list differs per vertical)
  useEffect(() => {
    setSource("all");
  }, [vertical]);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  // Fetch entity list
  const fetchEntities = useCallback(
    async (offset = 0, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const params = new URLSearchParams({
        vertical,
        offset: String(offset),
        limit: String(PAGE_SIZE),
        type: entityType,
        dateRange,
        source,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateRange === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      }

      try {
        const res = await fetch(`/api/entities?${params}`);
        if (!res.ok) throw new Error("Failed to fetch entities");
        const data = await res.json();

        if (append) {
          setEntities((prev) => [...prev, ...(data.entities || [])]);
        } else {
          setEntities(data.entities || []);
        }
        setTotalCount(data.totalCount ?? 0);
        setHasMore(data.hasMore ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [vertical, debouncedSearch, entityType, source, dateRange, customFrom, customTo]
  );

  // Refetch when filters change
  useEffect(() => {
    fetchEntities(0, false);
  }, [fetchEntities]);

  function handleLoadMore() {
    fetchEntities(entities.length, true);
  }

  // Full-dataset CSV export mirrors the live filters (minus pagination).
  const exportParams = new URLSearchParams({
    vertical,
    type: entityType,
    dateRange,
    source,
  });
  if (debouncedSearch) exportParams.set("search", debouncedSearch);
  if (dateRange === "custom") {
    if (customFrom) exportParams.set("from", customFrom);
    if (customTo) exportParams.set("to", customTo);
  }
  const exportUrl = `/api/export/entities?${exportParams}`;

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Entities</h1>
          {!loading && (
            <span className="text-xs text-muted">
              {totalCount.toLocaleString()} entities found
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search entities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent w-64"
            />
            <div className="flex gap-1">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEntityType(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    entityType === opt.value
                      ? "bg-accent text-white"
                      : "bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All publications</option>
              {(VERTICAL_SOURCES[vertical] || []).map((sid) => (
                <option key={sid} value={sid}>
                  {SOURCE_LABELS[sid] || sid}
                </option>
              ))}
            </select>
            <div className="ml-auto">
              <ExportCsvButton
                url={exportUrl}
                disabled={loading || entities.length === 0}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-muted">Date range:</span>
            <div className="flex gap-1">
              {DATE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDateRange(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    dateRange === opt.value
                      ? "bg-accent text-white"
                      : "bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {dateRange === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-border bg-white px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="text-xs text-muted">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-border bg-white px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-decrease/20 bg-decrease/5 p-4">
            <p className="text-sm text-decrease">{error}</p>
            <button
              onClick={() => fetchEntities(0, false)}
              className="mt-2 text-sm font-medium text-accent hover:text-accent-dark"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        <div className="rounded-xl border border-border bg-white p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded bg-surface"
                />
              ))}
            </div>
          ) : entities.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted">
                No entities found matching your filters.
              </p>
            </div>
          ) : (
            <>
              <EntityTable
                entities={entities}
                selectedEntity={null}
                onSelect={openEntity}
              />

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="rounded-full bg-surface px-6 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated disabled:opacity-50 transition-colors"
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
