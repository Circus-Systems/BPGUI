"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVertical } from "@/hooks/use-vertical";
import { useEntityDetail } from "@/providers/entity-detail-provider";
import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import { PublicationBrandChart } from "./publication-brand-chart";
import { PublicationBrandsTable } from "./publication-brands-table";

const NEUTRAL = "#71717A";

export interface PublicationTrendPoint {
  month: string;
  brand_id: number | null;
  brand: string;
  articles: number;
}

export interface PublicationBrand {
  brand_id: number | null;
  brand: string;
  entity_type: string;
  articles: number;
  title_articles: number;
  share_pct: number | null;
}

const WINDOW_OPTIONS = [
  { value: 12, label: "12 months" },
  { value: 24, label: "24 months" },
  { value: 60, label: "5 years" },
  { value: 240, label: "All time" },
];

export function PublicationDetailModal({
  source,
  onClose,
}: {
  source: string;
  onClose: () => void;
}) {
  const { vertical } = useVertical();
  const { openEntity } = useEntityDetail();
  const [months, setMonths] = useState(12);
  const [trend, setTrend] = useState<PublicationTrendPoint[]>([]);
  const [brands, setBrands] = useState<PublicationBrand[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const label = SOURCE_LABELS[source] || source;
  const color = SOURCE_COLORS[source] || NEUTRAL;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        vertical,
        months: String(months),
        offset: "0",
      });
      const res = await fetch(
        `/api/publication-detail/${encodeURIComponent(source)}?${params}`
      );
      if (!res.ok) throw new Error("Failed to load publication detail");
      const data = await res.json();
      setTrend(data.trend || []);
      setBrands(data.brands || []);
      setTotal(Number(data.total ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setTrend([]);
      setBrands([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [source, vertical, months]);

  // Refetch on open, window change, or vertical change (resets pagination).
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Focus the close button when the dialog opens.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        vertical,
        months: String(months),
        offset: String(brands.length),
      });
      const res = await fetch(
        `/api/publication-detail/${encodeURIComponent(source)}?${params}`
      );
      if (!res.ok) throw new Error("Failed to load more");
      const data = await res.json();
      setBrands((prev) => [...prev, ...(data.brands || [])]);
      setTotal((prev) => Number(data.total ?? prev));
    } catch {
      // Keep the existing list if a page fails to load.
    } finally {
      setLoadingMore(false);
    }
  }, [source, vertical, months, brands.length]);

  // Brand drill-down: close this modal, then open the entity modal (chained).
  const handleBrandClick = useCallback(
    (brandName: string) => {
      onClose();
      openEntity(brandName);
    },
    [onClose, openEntity]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publication-detail-title"
        className="relative z-10 flex max-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col overflow-y-auto rounded-xl bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div className="min-w-0">
            <h2
              id="publication-detail-title"
              className="flex items-center gap-2 truncate text-xl font-semibold text-foreground"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              {label}
            </h2>
            {!loading && !error && total > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground">
                  {total.toLocaleString()} brands covered
                </span>
              </div>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-muted hover:bg-surface hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* Window pills */}
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-6 py-3">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMonths(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                months === opt.value
                  ? "bg-accent text-white"
                  : "bg-surface text-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="space-y-6 p-6">
          {loading ? (
            <>
              <div className="h-[260px] animate-pulse rounded-xl bg-surface" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded bg-surface"
                  />
                ))}
              </div>
            </>
          ) : error ? (
            <div className="rounded-xl border border-decrease/20 bg-decrease/5 p-4">
              <p className="text-sm text-decrease">{error}</p>
              <button
                type="button"
                onClick={fetchAll}
                className="mt-2 text-sm font-medium text-accent hover:text-accent-dark"
              >
                Retry
              </button>
            </div>
          ) : total === 0 ? (
            <div className="rounded-xl border border-border bg-white p-6 text-center">
              <p className="text-sm text-muted">
                No tagged brands in this window.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-white p-4">
                <PublicationBrandChart trend={trend} months={months} />
              </div>
              <PublicationBrandsTable
                brands={brands}
                total={total}
                onLoadMore={loadMore}
                loadingMore={loadingMore}
                onBrandClick={handleBrandClick}
              />
              <p className="text-xs text-muted">
                Canonical company and industry-body brands only (~58% of all
                mentions are canonically tagged).
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
