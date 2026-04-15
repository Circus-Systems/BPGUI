"use client";

import { useVertical } from "@/hooks/use-vertical";
import { useCallback, useEffect, useRef, useState } from "react";
import { EntityTable } from "@/components/entities/entity-table";
import { EntityDetail } from "@/components/entities/entity-detail";

interface Entity {
  entity_name: string;
  entity_type: string;
  total_mentions: number;
  article_count: number;
  avg_confidence: number;
  in_title_pct: number;
  top_sentiment: string;
}

interface EntityDetailData {
  entity_name: string;
  entity_type: string;
  article_count: number;
  total_mentions: number;
  articles: Array<{
    id: number;
    source_id: string;
    external_id: string;
    title: string;
    url: string;
    published_at: string | null;
    author_name: string | null;
  }>;
  co_occurrences: Array<{
    name: string;
    type: string;
    count: number;
  }>;
  source_distribution: Record<string, number>;
}

const PAGE_SIZE = 50;

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "company", label: "Company" },
  { value: "destination", label: "Destination" },
  { value: "industry_body", label: "Industry Body" },
];

export default function EntitiesPage() {
  const { vertical } = useVertical();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [entityType, setEntityType] = useState("all");
  const [search, setSearch] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Detail panel
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<EntityDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

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
    [vertical, debouncedSearch, entityType]
  );

  // Refetch when filters change
  useEffect(() => {
    setSelectedEntity(null);
    setDetailData(null);
    fetchEntities(0, false);
  }, [fetchEntities]);

  // Fetch entity detail when selection changes
  useEffect(() => {
    if (!selectedEntity) {
      setDetailData(null);
      return;
    }
    setDetailLoading(true);
    const params = new URLSearchParams({ vertical });
    fetch(`/api/entities/${encodeURIComponent(selectedEntity)}?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch entity detail");
        return r.json();
      })
      .then((data) => setDetailData(data))
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [selectedEntity, vertical]);

  function handleLoadMore() {
    fetchEntities(entities.length, true);
  }

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Entity table */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-white p-4">
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
                  selectedEntity={selectedEntity}
                  onSelect={setSelectedEntity}
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

          {/* Entity detail panel */}
          <div className="lg:col-span-1">
            <EntityDetail data={detailData} loading={detailLoading} />
          </div>
        </div>
      </div>
    </main>
  );
}
