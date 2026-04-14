"use client";

import { useVertical } from "@/hooks/use-vertical";
import { useCallback, useEffect, useRef, useState } from "react";
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
}

interface Publication {
  slug: string;
  name: string;
}

const PAGE_SIZE = 30;

export default function ArticlesPage() {
  const { vertical } = useVertical();
  const [articles, setArticles] = useState<Article[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [source, setSource] = useState("");
  const [sponsored, setSponsored] = useState("all");

  // Detail panel
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Search debounce
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  // Fetch publications for filter dropdown
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
        dateRange,
        sponsored,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (source) params.set("source", source);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [vertical, debouncedSearch, dateRange, source, sponsored]
  );

  // Reset and fetch when filters change
  useEffect(() => {
    fetchArticles(0, false);
  }, [fetchArticles]);

  // Reset source when vertical changes
  useEffect(() => {
    setSource("");
  }, [vertical]);

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
          onDateRangeChange={setDateRange}
          source={source}
          onSourceChange={setSource}
          sponsored={sponsored}
          onSponsoredChange={setSponsored}
          publications={publications}
        />

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-muted">
            Showing {articles.length} articles
            {hasMore && " (more available)"}
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
