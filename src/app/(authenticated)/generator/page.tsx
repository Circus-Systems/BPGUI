"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePoll } from "@/hooks/use-poll";
import type { GeneratedArticle } from "@/lib/generator-types";

interface Publication {
  id: number;
  name: string;
  slug: string;
  vertical: string | null;
}

export default function GeneratorPage() {
  const router = useRouter();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [selectedPub, setSelectedPub] = useState<number | "">("");
  const [topic, setTopic] = useState("");
  const [topicNotes, setTopicNotes] = useState("");
  const [articleId, setArticleId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Summary counts
  const [draftCount, setDraftCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/publications")
      .then((r) => r.json())
      .then(setPublications)
      .catch(() => {});

    fetch("/api/generated-articles?status=draft&per_page=1")
      .then((r) => r.json())
      .then((d) => setDraftCount(d.total ?? 0))
      .catch(() => {});

    fetch("/api/generated-articles?status=pending&per_page=1")
      .then((r) => r.json())
      .then((d) => setPendingCount(d.total ?? 0))
      .catch(() => {});
  }, []);

  const fetcher = useCallback(async (): Promise<GeneratedArticle> => {
    const res = await fetch(`/api/generated-articles/${articleId}`);
    return res.json();
  }, [articleId]);

  const { data: article } = usePoll<GeneratedArticle>(fetcher, {
    enabled: articleId !== null,
    intervalMs: 2000,
    stopWhen: (a) => a.status === "draft" || a.status === "failed",
  });

  useEffect(() => {
    if (article?.status === "draft") {
      router.push(`/generator/articles/${article.id}`);
    }
  }, [article, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPub || !topic.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/generator/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publication_id: selectedPub,
          topic: topic.trim(),
          topic_notes: topicNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Generation failed");
      }

      const data = await res.json();
      setArticleId(data.article_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  // Progress view
  if (articleId) {
    const status = article?.status ?? "researching";
    const failed = status === "failed";

    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16">
        <div className="text-center space-y-6">
          {!failed && (
            <div className="inline-flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-lg font-medium text-foreground">
                {status === "researching" ? "Researching topic..." : "Writing article..."}
              </span>
            </div>
          )}
          {failed && (
            <div className="space-y-4">
              <p className="text-lg font-medium text-decrease">Generation failed</p>
              <p className="text-sm text-muted">{article?.error_message}</p>
              <button
                onClick={() => { setArticleId(null); setSubmitting(false); }}
                className="text-sm text-accent hover:text-accent-dark transition-colors"
              >
                Try again
              </button>
            </div>
          )}
          <p className="text-sm text-muted">Topic: {topic}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Article Generator</h1>
        <div className="flex items-center gap-3">
          {draftCount > 0 && (
            <Link href="/generator/articles?status=draft" className="rounded-full bg-removed/10 px-3 py-1 text-xs font-medium text-removed">
              {draftCount} draft{draftCount !== 1 ? "s" : ""}
            </Link>
          )}
          {pendingCount > 0 && (
            <Link href="/generator/articles?status=pending" className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              {pendingCount} pending
            </Link>
          )}
          <Link href="/generator/articles" className="text-sm text-muted hover:text-foreground transition-colors">
            All articles &rarr;
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        {/* Generate form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="publication" className="block text-sm font-medium text-foreground">
              Publication
            </label>
            <select
              id="publication"
              value={selectedPub}
              onChange={(e) => setSelectedPub(e.target.value ? parseInt(e.target.value) : "")}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              <option value="">Select a publication...</option>
              {publications.map((pub) => (
                <option key={pub.id} value={pub.id}>
                  {pub.name} ({pub.vertical})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="topic" className="block text-sm font-medium text-foreground">
              Topic
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              placeholder="e.g. Fiji luxury resort openings Q2 2026"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="block text-sm font-medium text-foreground">
              Additional Notes <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              value={topicNotes}
              onChange={(e) => setTopicNotes(e.target.value)}
              rows={3}
              placeholder="Any specific angle, sources to emphasise, or details to include..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y"
            />
          </div>

          {error && <p className="text-sm text-decrease">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !selectedPub || !topic.trim()}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Starting..." : "Generate Article"}
          </button>
        </form>

        {/* Sidebar: style guides link */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Style Guides</h3>
            <p className="text-xs text-muted mb-3">
              Style guides control how articles are written for each publication. Generate or edit them before creating articles.
            </p>
            <Link
              href="/generator/style-guides"
              className="text-sm text-accent hover:text-accent-dark transition-colors"
            >
              Manage style guides &rarr;
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
