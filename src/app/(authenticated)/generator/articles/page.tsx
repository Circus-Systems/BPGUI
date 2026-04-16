"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { GeneratedArticle, ArticleGenStatus } from "@/lib/generator-types";

const STATUS_TABS: { label: string; value: ArticleGenStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Drafts", value: "draft" },
  { label: "Pending", value: "pending" },
  { label: "Published", value: "published" },
];

export default function GeneratedArticlesPage() {
  const [articles, setArticles] = useState<GeneratedArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<ArticleGenStatus | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab !== "all") params.set("status", activeTab);

    fetch(`/api/generated-articles?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setArticles(data.articles ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Generated Articles</h1>
        <Link
          href="/generator"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark transition-colors"
        >
          Generate New
        </Link>
      </div>

      <div className="flex gap-1 mb-6 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.value
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-elevated animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted mb-3">No articles found</p>
          <Link href="/generator" className="text-sm text-accent hover:text-accent-dark transition-colors">
            Generate your first article
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border divide-y divide-border">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/generator/articles/${article.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {article.edited_title ?? article.original_title ?? article.topic}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted">{article.publications?.name ?? "Unknown"}</span>
                    {article.word_count && <span className="text-xs text-muted">{article.word_count} words</span>}
                    <span className="text-xs text-muted">{new Date(article.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <StatusBadge status={article.status} />
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">{total} article{total !== 1 ? "s" : ""} total</p>
        </>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    researching: "bg-new/10 text-new",
    writing: "bg-accent/10 text-accent",
    draft: "bg-removed/10 text-removed",
    pending: "bg-stable/10 text-stable",
    published: "bg-increase/10 text-increase",
    failed: "bg-decrease/10 text-decrease",
  };

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-surface-elevated text-muted"}`}>
      {status}
    </span>
  );
}
