"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useVertical } from "@/hooks/use-vertical";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { EntityTrendChart } from "./entity-trend-chart";
import { EntityArticlesTable } from "./entity-articles-table";

export interface EntityTrendPoint {
  month: string;
  source_id: string;
  articles: number;
  title_articles: number;
}

export interface EntityArticle {
  published_at: string;
  source_id: string;
  title: string;
  url: string;
  word_count: number | null;
  author_name: string | null;
  in_title: number;
  is_sponsored: number;
}

const WINDOW_OPTIONS = [
  { value: 12, label: "12 months" },
  { value: 24, label: "24 months" },
  { value: 60, label: "5 years" },
  { value: 240, label: "All time" },
];

export function EntityDetailModal({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  const { vertical } = useVertical();
  const [months, setMonths] = useState(12);
  const [trend, setTrend] = useState<EntityTrendPoint[]>([]);
  const [articles, setArticles] = useState<EntityArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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
        `/api/entity-detail/${encodeURIComponent(name)}?${params}`
      );
      if (!res.ok) throw new Error("Failed to load entity detail");
      const data = await res.json();
      setTrend(data.trend || []);
      setArticles(data.articles || []);
      setTotal(Number(data.total ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setTrend([]);
      setArticles([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [name, vertical, months]);

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
        offset: String(articles.length),
      });
      const res = await fetch(
        `/api/entity-detail/${encodeURIComponent(name)}?${params}`
      );
      if (!res.ok) throw new Error("Failed to load more");
      const data = await res.json();
      setArticles((prev) => [...prev, ...(data.articles || [])]);
      setTotal((prev) => Number(data.total ?? prev));
    } catch {
      // Keep the existing list if a page fails to load.
    } finally {
      setLoadingMore(false);
    }
  }, [name, vertical, months, articles.length]);

  // Headline share = sum(title_articles) / sum(articles) across the window.
  const trendArticles = trend.reduce((s, r) => s + r.articles, 0);
  const trendTitleArticles = trend.reduce((s, r) => s + r.title_articles, 0);
  const headlinePct =
    trendArticles > 0
      ? Math.round((trendTitleArticles / trendArticles) * 100)
      : 0;

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
        aria-labelledby="entity-detail-title"
        className="relative z-10 flex max-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col overflow-y-auto rounded-xl bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div className="min-w-0">
            <h2
              id="entity-detail-title"
              className="truncate text-xl font-semibold text-foreground"
            >
              {name}
            </h2>
            {!loading && !error && total > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground">
                  {total.toLocaleString()} articles
                </span>
                <span className="rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground">
                  {headlinePct}% headline
                </span>
              </div>
            )}
            <Link
              href={`/ledger/${encodeURIComponent(name)}`}
              onClick={onClose}
              className="mt-2 inline-block text-sm font-medium text-accent hover:text-accent-dark"
            >
              Value ledger →
            </Link>
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
          <div className="ml-auto">
            <ExportCsvButton
              url={`/api/export/entity-articles?${new URLSearchParams({
                entity: name,
                vertical,
                months: String(months),
              })}`}
              disabled={loading || !!error || total === 0}
            />
          </div>
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
                No tagged coverage in this window.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-white p-4">
                <EntityTrendChart trend={trend} months={months} />
              </div>
              <EntityArticlesTable
                articles={articles}
                total={total}
                onLoadMore={loadMore}
                loadingMore={loadingMore}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
