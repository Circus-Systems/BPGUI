"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { StyleGuide } from "@/lib/generator-types";

interface Publication {
  id: number;
  name: string;
  slug: string;
  vertical: string | null;
}

export default function StyleGuidesPage() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [styleGuides, setStyleGuides] = useState<StyleGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/publications").then((r) => r.json()),
      fetch("/api/style-guides").then((r) => r.json()),
    ]).then(([pubs, guides]) => {
      setPublications(Array.isArray(pubs) ? pubs : []);
      setStyleGuides(Array.isArray(guides) ? guides : []);
      setLoading(false);
    });
  }, []);

  async function handleGenerate(slug: string) {
    setGenerating(slug);
    try {
      const res = await fetch("/api/style-guides/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publication_slug: slug }),
      });

      if (res.ok) {
        const newGuide = await res.json();
        setStyleGuides((prev) => {
          const filtered = prev.filter((g) => g.slug !== slug);
          return [...filtered, newGuide].sort((a, b) => a.slug.localeCompare(b.slug));
        });
      }
    } finally {
      setGenerating(null);
    }
  }

  const guideMap = new Map(styleGuides.map((g) => [g.slug, g]));

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground mb-8">Style Guides</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 rounded-lg bg-surface-elevated animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Style Guides</h1>
        <Link href="/generator" className="text-sm text-muted hover:text-foreground transition-colors">
          &larr; Back to Generator
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {publications.map((pub) => {
          const guide = guideMap.get(pub.slug);
          const isGenerating = generating === pub.slug;

          return (
            <div key={pub.slug} className="rounded-lg border border-border p-5 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{pub.name}</h3>
                <p className="text-xs text-muted capitalize">{pub.vertical}</p>
              </div>

              {guide ? (
                <>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>v{guide.version}</span>
                    <span>&bull;</span>
                    <span>{guide.sample_count} articles</span>
                    {guide.avg_word_count && (
                      <>
                        <span>&bull;</span>
                        <span>~{guide.avg_word_count}w target</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/generator/style-guides/${guide.slug}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleGenerate(pub.slug)}
                      disabled={isGenerating}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? "Regenerating..." : "Regenerate"}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => handleGenerate(pub.slug)}
                  disabled={isGenerating}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-dark transition-colors disabled:opacity-50"
                >
                  {isGenerating ? "Generating..." : "Generate Style Guide"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
