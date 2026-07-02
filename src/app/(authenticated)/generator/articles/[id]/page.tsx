"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePoll } from "@/hooks/use-poll";
import type { GeneratedArticle, ResearchSource } from "@/lib/generator-types";

export default function GeneratedArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const articleId = params.id as string;

  const [article, setArticle] = useState<GeneratedArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editExcerpt, setEditExcerpt] = useState("");
  const [editBody, setEditBody] = useState("");

  const fetcher = useCallback(async (): Promise<GeneratedArticle> => {
    const res = await fetch(`/api/generated-articles/${articleId}`);
    return res.json();
  }, [articleId]);

  const isGenerating = article?.status === "researching" || article?.status === "writing";

  const { data: polledArticle } = usePoll<GeneratedArticle>(fetcher, {
    enabled: isGenerating,
    intervalMs: 2000,
    stopWhen: (a) => a.status !== "researching" && a.status !== "writing",
  });

  useEffect(() => {
    fetch(`/api/generated-articles/${articleId}`)
      .then((r) => r.json())
      .then((data) => {
        setArticle(data);
        setEditTitle(data.edited_title ?? data.original_title ?? "");
        setEditExcerpt(data.edited_excerpt ?? data.original_excerpt ?? "");
        setEditBody(data.edited_body_html ?? data.original_body_html ?? "");
      })
      .finally(() => setLoading(false));
  }, [articleId]);

  useEffect(() => {
    if (polledArticle && polledArticle.status !== article?.status) {
      setArticle(polledArticle);
      if (polledArticle.status === "draft") {
        setEditTitle(polledArticle.original_title ?? "");
        setEditExcerpt(polledArticle.original_excerpt ?? "");
        setEditBody(polledArticle.original_body_html ?? "");
      }
    }
  }, [polledArticle, article?.status]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/generated-articles/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        edited_title: editTitle,
        edited_excerpt: editExcerpt,
        edited_body_html: editBody,
      }),
    });
    setSaving(false);
  }

  async function handleFinalise() {
    setActionLoading(true);
    const res = await fetch(`/api/generated-articles/${articleId}/finalise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        edited_title: editTitle,
        edited_excerpt: editExcerpt,
        edited_body_html: editBody,
      }),
    });
    const updated = await res.json();
    setArticle(updated);
    setActionLoading(false);
  }

  async function handlePublish() {
    setActionLoading(true);
    const res = await fetch(`/api/generated-articles/${articleId}/publish`, { method: "POST" });
    const updated = await res.json();
    setArticle(updated);
    setActionLoading(false);
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="h-8 w-48 bg-surface-elevated rounded animate-pulse mb-6" />
        <div className="h-96 bg-surface-elevated rounded-lg animate-pulse" />
      </main>
    );
  }

  if (!article) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <p className="text-muted">Article not found</p>
      </main>
    );
  }

  if (isGenerating) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-lg font-medium capitalize">
            {article.status === "researching" ? "Researching..." : "Writing article..."}
          </span>
        </div>
        <p className="text-sm text-muted">{article.topic}</p>
      </main>
    );
  }

  const isEditable = article.status === "draft" || article.status === "pending";
  const sources: ResearchSource[] = article.research_sources ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/generator/articles")}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            &larr; Back
          </button>
          <StatusBadge status={article.status} />
          <span className="text-sm text-muted">{article.publications?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-surface transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          {article.status === "draft" && (
            <button
              onClick={handleFinalise}
              disabled={actionLoading}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-dark transition-opacity disabled:opacity-50"
            >
              {actionLoading ? "Finalising..." : "Finalise"}
            </button>
          )}
          {article.status === "pending" && (
            <button
              onClick={handlePublish}
              disabled={actionLoading}
              className="rounded-lg bg-increase px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {actionLoading ? "Publishing..." : "Published"}
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: Editor */}
        <div className="space-y-4">
          {isEditable ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-2xl font-semibold text-foreground bg-transparent border-b border-border pb-2 focus:outline-none focus:border-accent"
              placeholder="Article title"
            />
          ) : (
            <h1 className="text-2xl font-semibold text-foreground">
              {article.edited_title ?? article.original_title}
            </h1>
          )}

          {isEditable ? (
            <textarea
              value={editExcerpt}
              onChange={(e) => setEditExcerpt(e.target.value)}
              rows={2}
              className="w-full text-sm text-muted bg-surface rounded-lg border border-border p-3 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
              placeholder="Article excerpt / lead"
            />
          ) : (
            <p className="text-sm text-muted bg-surface rounded-lg p-3">
              {article.edited_excerpt ?? article.original_excerpt}
            </p>
          )}

          {isEditable ? (
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={20}
              className="w-full text-sm text-foreground bg-white rounded-lg border border-border p-4 font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-y"
              placeholder="Article body (HTML)"
            />
          ) : (
            <div
              className="prose prose-sm max-w-none rounded-lg border border-border p-6 bg-white"
              dangerouslySetInnerHTML={{
                __html: article.edited_body_html ?? article.original_body_html ?? "",
              }}
            />
          )}

          <div className="flex items-center gap-4 text-xs text-muted pt-2">
            {article.word_count && <span>{article.word_count} words</span>}
            {article.model_used && <span>Model: {article.model_used}</span>}
            <span>Created: {new Date(article.created_at).toLocaleString()}</span>
            {article.finalised_at && <span>Finalised: {new Date(article.finalised_at).toLocaleString()}</span>}
            {article.published_at && <span>Published: {new Date(article.published_at).toLocaleString()}</span>}
          </div>
        </div>

        {/* Right: Research sidebar */}
        <aside className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Research Sources ({sources.length})
            </h3>
            {sources.length > 0 ? (
              <div className="space-y-3">
                {sources.map((source, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 space-y-1.5">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-accent hover:text-accent-dark transition-colors line-clamp-2"
                    >
                      {source.title}
                    </a>
                    <p className="text-xs text-muted line-clamp-2">{source.snippet}</p>
                    {source.extracted_facts.length > 0 && (
                      <ul className="text-xs text-foreground space-y-1 pt-1">
                        {source.extracted_facts.map((fact, j) => (
                          <li key={j} className="flex gap-1.5">
                            <span className="text-muted shrink-0">&bull;</span>
                            <span>{fact}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No research sources</p>
            )}
          </div>

          {(article.original_categories || article.original_tags) && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Categories</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(article.edited_categories ?? article.original_categories ?? []).map((cat, i) => (
                  <span key={i} className="rounded-full bg-accent/10 text-accent px-2.5 py-0.5 text-xs font-medium">{cat}</span>
                ))}
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {(article.edited_tags ?? article.original_tags ?? []).map((tag, i) => (
                  <span key={i} className="rounded-full bg-surface-elevated text-muted px-2.5 py-0.5 text-xs">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
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
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-surface-elevated text-muted"}`}>
      {status}
    </span>
  );
}
