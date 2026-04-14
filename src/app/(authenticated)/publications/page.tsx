"use client";

import { useVertical } from "@/hooks/use-vertical";
import { useCallback, useEffect, useState } from "react";
import { VERTICAL_SOURCES } from "@/lib/constants";
import { PublicationCard } from "@/components/publications/publication-card";
import { VolumeChart } from "@/components/publications/volume-chart";
import { ComparisonTable } from "@/components/publications/comparison-table";

interface PublicationStat {
  source_id: string;
  article_count: number;
  avg_word_count: number;
  sponsored_pct: number;
  articles_per_day: number;
  last_published: string | null;
}

interface TimelineEntry {
  date: string;
  [sourceId: string]: string | number;
}

const PERIOD_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export default function PublicationsPage() {
  const { vertical } = useVertical();
  const [stats, setStats] = useState<PublicationStat[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sourceIds = [...(VERTICAL_SOURCES[vertical] || [])];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsRes, timelineRes] = await Promise.all([
        fetch(`/api/publications/stats?vertical=${vertical}&days=${days}`),
        fetch(`/api/publications/timeline?vertical=${vertical}&days=${days}`),
      ]);

      if (!statsRes.ok || !timelineRes.ok) {
        throw new Error("Failed to fetch publication data");
      }

      const [statsData, timelineData] = await Promise.all([
        statsRes.json(),
        timelineRes.json(),
      ]);

      setStats(statsData.stats || []);
      setTimeline(timelineData.timeline || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [vertical, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Summary totals
  const totalArticles = stats.reduce((sum, s) => sum + s.article_count, 0);
  const activeSources = stats.filter((s) => s.article_count > 0).length;
  const avgWordCount = stats.length > 0
    ? Math.round(stats.reduce((sum, s) => sum + s.avg_word_count * s.article_count, 0) / Math.max(totalArticles, 1))
    : 0;

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">
            Publications
          </h1>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  days === opt.value
                    ? "bg-accent text-white"
                    : "bg-surface text-muted hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted">Total Articles</p>
            <p className="text-2xl font-semibold text-foreground">
              {loading ? "—" : totalArticles.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">Last {days} days</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted">Active Sources</p>
            <p className="text-2xl font-semibold text-foreground">
              {loading ? "—" : `${activeSources} / ${sourceIds.length}`}
            </p>
            <p className="text-xs text-muted mt-1">Publishing in period</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted">Avg Word Count</p>
            <p className="text-2xl font-semibold text-foreground">
              {loading ? "—" : avgWordCount.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">Across all sources</p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-decrease/20 bg-decrease/5 p-4">
            <p className="text-sm text-decrease">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 text-sm font-medium text-accent hover:text-accent-dark"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <div className="h-72 animate-pulse rounded-xl bg-surface" />
            <div className="h-48 animate-pulse rounded-xl bg-surface" />
          </div>
        )}

        {/* Charts and tables */}
        {!loading && !error && (
          <>
            {/* Volume chart */}
            <VolumeChart timeline={timeline} sourceIds={sourceIds} />

            {/* Comparison table */}
            <ComparisonTable stats={stats} />

            {/* Publication cards grid */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                Per-Publication Breakdown
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {stats.map((stat) => (
                  <PublicationCard key={stat.source_id} stat={stat} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
