"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type { StyleGuide } from "@/lib/generator-types";

export default function StyleGuideEditorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [guide, setGuide] = useState<StyleGuide | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetch(`/api/style-guides/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setGuide(data);
        setContent(data.content_md ?? "");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/style-guides/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_md: content }),
    });
    if (res.ok) {
      const updated = await res.json();
      setGuide(updated);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="h-8 w-48 bg-surface-elevated rounded animate-pulse mb-6" />
        <div className="h-96 bg-surface-elevated rounded-lg animate-pulse" />
      </main>
    );
  }

  if (!guide) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <p className="text-muted">Style guide not found</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/generator/style-guides")}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            &larr; Back
          </button>
          <h1 className="text-xl font-semibold text-foreground">{guide.publications?.name}</h1>
          <span className="text-xs text-muted">v{guide.version}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface transition-colors"
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-dark transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {showPreview ? (
        <div className="rounded-lg border border-border p-6 bg-white">
          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">{content}</pre>
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={40}
          className="w-full rounded-lg border border-border p-4 text-sm font-mono text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-accent resize-y"
        />
      )}

      <div className="flex items-center gap-4 text-xs text-muted mt-3">
        <span>{guide.sample_count} articles sampled</span>
        {guide.avg_word_count && <span>Target: ~{guide.avg_word_count} words</span>}
        <span>Generated: {new Date(guide.generated_at).toLocaleString()}</span>
        {guide.edited_at && <span>Edited: {new Date(guide.edited_at).toLocaleString()}</span>}
      </div>
    </main>
  );
}
