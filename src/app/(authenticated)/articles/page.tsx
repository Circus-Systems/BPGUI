"use client";

import { useVertical } from "@/hooks/use-vertical";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { FilterBar } from "@/components/articles/filter-bar";
import { ArticleCard } from "@/components/articles/article-card";
import { ArticleDetail } from "@/components/articles/article-detail";

interface Article {
  id: number;
  source_id: string;
  external_id: string;
  title: string;
  url: string;
  excerpt: string | null;
  author_name: string | null;
  published_at: string | null;
  word_count: number | null;
  is_sponsored: number;
  categories: string | null;
  content_text?: string | null;
  story_flags?: { exclusive: boolean; is_first: boolean } | null;
}

interface Publication {
  slug: string;
  name: string;
}

const PAGE_SIZE = 30;
const RANGE_PRESETS = ["30", "90", "180", "365"];
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function ArticlesPageInner() {
  const { vertical } = useVertical();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL is the source of truth for filters (shareable views)
  const urlSearch = searchParams.get("q") || "";
  const rangeParam = searchParams.get("range") || "all";
  const dateRange = RANGE_PRESETS.includes(rangeParam) ? rangeParam : "all";
  const from = YMD_RE.test(searchParams.get("from") || "")
    ? (searchParams.get("from") as string)
    : "";
  const to = YMD_RE.test(searchParams.get("to") || "")
    ? (searchParams.get("to") as string)
    : "";
  const sources = (searchParams.get("sources") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const sponsored = searchParams.get("sponsored") || "all";

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const [articles, setArticles] = useState<Article[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail panel
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Search input is local (for typing responsiveness); debounced into the URL
  const [search, setSearch] = useState(urlSearch);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const lastCommittedSearch = useRef(urlSearch);

  useEffect(() => {
    if (search === urlSearch) return;
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      lastCommittedSearch.current = search;
      setParams({ q: search });
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [search, urlSearch, setParams]);

  // Sync input when the URL changes externally (back/forward, shared link)
  useEffect(() => {
    if (urlSearch !== lastCommittedSearch.current) {
      lastCommittedSearch.current = urlSearch;
      setSearch(urlSearch);
    }
  }, [urlSearch]);

  // Fetch publications for source multi-select
  useEffect(() => {
    fetch(`/api/publications?vertical=${vertical}`)
      .then((r) => r.json())
      .then((data) => setPublications(data.publications || []))
      .catch(() => {});
  }, [vertical]);

  // Fetch articles
  const fetchArticles = useCallback(
    async (offset = 0, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const params = new URLSearchParams({
        vertical,
        offset: String(offset),
        limit: String(PAGE_SIZE),
        sponsored,
      });
      if (urlSearch) params.set("search", urlSearch);
      if (sources.length > 0) params.set("sources", sources.join(","));
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (!from && !to && dateRange !== "all") params.set("days", dateRange);

      try {
        const res = await fetch(`/api/articles?${params}`);
        if (!res.ok) throw new Error("Failed to fetch articles");
        const data = await res.json();

        if (append) {
          setArticles((prev) => [...prev, ...(data.articles || [])]);
        } else {
          setArticles(data.articles || []);
        }
        setHasMore(data.hasMore ?? false);
        setMatchCount(
          typeof data.matchCount === "number" ? data.matchCount : null
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // sources is derived fresh each render; join for a stable dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vertical, urlSearch, dateRange, from, to, sources.join(","), sponsored]
  );

  // Reset and fetch when filters change
  useEffect(() => {
    fetchArticles(0, false);
  }, [fetchArticles]);

  // Reset source selection when vertical changes (slugs differ per vertical)
  const prevVertical = useRef(vertical);
  useEffect(() => {
    if (prevVertical.current !== vertical) {
      prevVertical.current = vertical;
      setParams({ sources: "" });
    }
  }, [vertical, setParams]);

  function handleLoadMore() {
    fetchArticles(articles.length, true);
  }

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Articles</h1>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          dateRange={dateRange}
          onDateRangeChange={(value) =>
            setParams({
              range: value === "all" ? "" : value,
              from: "",
              to: "",
            })
          }
          from={from}
          to={to}
          onCustomRangeChange={(nextFrom, nextTo) =>
            setParams({ from: nextFrom, to: nextTo, range: "" })
          }
          sources={sources}
          onSourcesChange={(value) => setParams({ sources: value.join(",") })}
          sponsored={sponsored}
          onSponsoredChange={(value) =>
            setParams({ sponsored: value === "all" ? "" : value })
          }
          publications={publications}
        />

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-muted">
            {urlSearch && matchCount != null ? (
              <>
                <span className="font-medium text-foreground">
                  {matchCount.toLocaleString()}
                </span>{" "}
                article{matchCount === 1 ? "" : "s"} match
                {matchCount === 1 ? "es" : ""} &ldquo;{urlSearch}&rdquo;
              </>
            ) : (
              <>
                Showing {articles.length} articles
                {hasMore && " (more available)"}
              </>
            )}
          </p>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-surface"
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-decrease/20 bg-decrease/5 p-4">
            <p className="text-sm text-decrease">{error}</p>
            <button
              onClick={() => fetchArticles(0, false)}
              className="mt-2 text-sm font-medium text-accent hover:text-accent-dark"
            >
              Retry
            </button>
          </div>
        )}

        {/* Article list */}
        {!loading && !error && (
          <div className="space-y-2">
            {articles.map((article) => (
              <ArticleCard
                key={`${article.source_id}-${article.external_id}`}
                article={article}
                onClick={() => setSelectedArticle(article)}
              />
            ))}

            {articles.length === 0 && (
              <div className="rounded-xl border border-border bg-white p-8 text-center">
                <p className="text-sm text-muted">
                  No articles found matching your filters.
                </p>
              </div>
            )}

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
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedArticle && (
        <ArticleDetail
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </main>
  );
}

export default function ArticlesPage() {
  // useSearchParams requires a Suspense boundary in the App Router
  return (
    <Suspense fallback={null}>
      <ArticlesPageInner />
    </Suspense>
  );
}
