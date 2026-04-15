"use client";

import { useCallback, useEffect, useState } from "react";
import { useVertical } from "@/hooks/use-vertical";
import { SummaryCards } from "@/components/briefing/summary-cards";
import { TrendingEntities } from "@/components/briefing/trending-entities";
import { RecentHighlights } from "@/components/briefing/recent-highlights";

interface BriefingData {
  articlesToday: number;
  dailyAvg: number;
  activeSources: number;
  totalSources: number;
  sourceActivity: Record<string, number>;
  trendingEntities: {
    entity_name: string;
    entity_type: string;
    total_mentions: number;
    article_count: number;
  }[];
  highlights: {
    id: number;
    source_id: string;
    title: string;
    url: string;
    author_name: string | null;
    published_at: string;
    word_count: number | null;
    is_sponsored: number;
    excerpt: string | null;
  }[];
}

export default function HomePage() {
  const { vertical } = useVertical();
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/briefing?vertical=${vertical}`);
      if (!res.ok) throw new Error("Failed to load briefing");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [vertical]);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 17
        ? "Good afternoon"
        : "Good evening";

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {greeting}
          </h1>
          <p className="text-sm text-muted mt-1">
            {vertical === "travel" ? "Travel & Cruise" : "Pharmacy"} intelligence briefing for{" "}
            {now.toLocaleDateString("en-AU", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-decrease/20 bg-decrease/5 p-4">
            <p className="text-sm text-decrease">{error}</p>
            <button
              onClick={fetchBriefing}
              className="mt-2 text-sm font-medium text-accent hover:text-accent-dark"
            >
              Retry
            </button>
          </div>
        )}

        <SummaryCards
          articlesToday={data?.articlesToday || 0}
          dailyAvg={data?.dailyAvg || 0}
          activeSources={data?.activeSources || 0}
          totalSources={data?.totalSources || 0}
          trendingCount={data?.trendingEntities.length || 0}
          loading={loading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trending Entities */}
          <div className="rounded-xl border border-border bg-white p-4">
            <h2 className="text-sm font-medium text-foreground mb-3">
              Top Entities
            </h2>
            <TrendingEntities
              entities={data?.trendingEntities || []}
              loading={loading}
            />
          </div>

          {/* Recent Highlights */}
          <div className="rounded-xl border border-border bg-white p-4">
            <h2 className="text-sm font-medium text-foreground mb-3">
              Top Articles (24h)
            </h2>
            <RecentHighlights
              highlights={data?.highlights || []}
              loading={loading}
            />
          </div>
        </div>

        {/* Source Activity */}
        {!loading && data && Object.keys(data.sourceActivity).length > 0 && (
          <div className="rounded-xl border border-border bg-white p-4">
            <h2 className="text-sm font-medium text-foreground mb-3">
              Source Activity (24h)
            </h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.sourceActivity)
                .sort((a, b) => b[1] - a[1])
                .map(([sourceId, count]) => (
                  <div
                    key={sourceId}
                    className="flex items-center gap-1.5 rounded-full border border-border/50 bg-surface/50 px-3 py-1.5 text-xs"
                  >
                    <span className="font-medium text-foreground">
                      {count}
                    </span>
                    <span className="text-muted">
                      from {sourceId}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
