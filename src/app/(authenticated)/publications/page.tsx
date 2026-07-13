"use client";

import { useVertical } from "@/hooks/use-vertical";
import { usePublicationDetail } from "@/providers/publication-detail-provider";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { VERTICAL_SOURCES } from "@/lib/constants";
import { PublicationCard } from "@/components/publications/publication-card";
import { VolumeChart } from "@/components/publications/volume-chart";
import { ComparisonTable } from "@/components/publications/comparison-table";
import { PeriodPicker, PERIOD_PRESETS } from "@/components/publications/period-picker";
import { SourceFilter } from "@/components/publications/source-filter";

interface PublicationStat {
  source_id: string;
  article_count: number;
  avg_word_count: number;
  sponsored_pct: number;
  articles_per_day: number;
  last_published: string | null;
  brands_covered: number;
  first_pct: number | null;
}

interface TimelineEntry {
  date: string;
  [sourceId: string]: string | number;
}

const DEFAULT_DAYS = "30";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRESET_VALUES = PERIOD_PRESETS.map((p) => p.value);

function PublicationsContent() {
  const { vertical } = useVertical();
  const { openPublication } = usePublicationDetail();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [stats, setStats] = useState<PublicationStat[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- URL-driven filter state ---
  const from = sp.get("from");
  const to = sp.get("to");
  const isRange = !!(
    from &&
    to &&
    DATE_RE.test(from) &&
    DATE_RE.test(to) &&
    from <= to
  );
  const daysParam = sp.get("days") || DEFAULT_DAYS;
  const days = PRESET_VALUES.includes(daysParam) ? daysParam : DEFAULT_DAYS;

  const verticalSources = useMemo(
    () => [...(VERTICAL_SOURCES[vertical] || [])],
    [vertical]
  );

  const sourcesParam = sp.get("sources");
  const selectedSources = useMemo(() => {
    if (!sourcesParam) return verticalSources;
    const requested = new Set(sourcesParam.split(","));
    const picked = verticalSources.filter((s) => requested.has(s));
    return picked.length > 0 ? picked : verticalSources;
  }, [sourcesParam, verticalSources]);

  const updateParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(sp.toString());
      mutate(p);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, pathname, router]
  );

  const selectDays = useCallback(
    (value: string) => {
      updateParams((p) => {
        p.delete("from");
        p.delete("to");
        if (value === DEFAULT_DAYS) p.delete("days");
        else p.set("days", value);
      });
    },
    [updateParams]
  );

  const applyRange = useCallback(
    (newFrom: string, newTo: string) => {
      updateParams((p) => {
        p.delete("days");
        p.set("from", newFrom);
        p.set("to", newTo);
      });
    },
    [updateParams]
  );

  const toggleSource = useCallback(
    (sourceId: string) => {
      const set = new Set(selectedSources);
      if (set.has(sourceId)) {
        if (set.size === 1) return; // keep at least one selected
        set.delete(sourceId);
      } else {
        set.add(sourceId);
      }
      const next = verticalSources.filter((s) => set.has(s));
      updateParams((p) => {
        if (next.length === verticalSources.length) p.delete("sources");
        else p.set("sources", next.join(","));
      });
    },
    [selectedSources, verticalSources, updateParams]
  );

  const selectAllSources = useCallback(() => {
    updateParams((p) => p.delete("sources"));
  }, [updateParams]);

  // --- Data fetching ---
  const periodQuery = isRange ? `from=${from}&to=${to}` : `days=${days}`;
  const sourcesQuery =
    selectedSources.length === verticalSources.length
      ? ""
      : `&sources=${encodeURIComponent(selectedSources.join(","))}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const qs = `vertical=${vertical}&${periodQuery}${sourcesQuery}`;
      const [statsRes, timelineRes] = await Promise.all([
        fetch(`/api/publications/stats?${qs}`),
        fetch(`/api/publications/timeline?${qs}`),
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
  }, [vertical, periodQuery, sourcesQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Period labels / approximate day count for the breakdown API
  const periodDays = isRange
    ? Math.max(
        1,
        Math.round((Date.parse(to!) - Date.parse(from!)) / 86400000) + 1
      )
    : parseInt(days, 10);
  const periodLabel = isRange ? `${from} to ${to}` : `Last ${days} days`;

  // Summary totals
  const totalArticles = stats.reduce((sum, s) => sum + s.article_count, 0);
  const activeSources = stats.filter((s) => s.article_count > 0).length;
  const avgWordCount = stats.length > 0
    ? Math.round(stats.reduce((sum, s) => sum + s.avg_word_count * s.article_count, 0) / Math.max(totalArticles, 1))
    : 0;

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold text-foreground">
            Publications
          </h1>
          <PeriodPicker
            days={days}
            isRange={isRange}
            from={isRange ? from : null}
            to={isRange ? to : null}
            onSelectDays={selectDays}
            onApplyRange={applyRange}
          />
        </div>

        {/* Publication multi-select */}
        <SourceFilter
          sources={verticalSources}
          selected={selectedSources}
          onToggle={toggleSource}
          onSelectAll={selectAllSources}
        />

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted">Total Articles</p>
            <p className="text-2xl font-semibold text-foreground">
              {loading ? "—" : totalArticles.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">{periodLabel}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted">Active Sources</p>
            <p className="text-2xl font-semibold text-foreground">
              {loading ? "—" : `${activeSources} / ${selectedSources.length}`}
            </p>
            <p className="text-xs text-muted mt-1">Publishing in period</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted">Avg Word Count</p>
            <p className="text-2xl font-semibold text-foreground">
              {loading ? "—" : avgWordCount.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">Across selected sources</p>
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
            <VolumeChart timeline={timeline} sourceIds={selectedSources} />

            {/* Comparison table */}
            <ComparisonTable stats={stats} onPublicationClick={openPublication} />

            {/* Publication cards grid */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                Per-Publication Breakdown
              </h3>
              {stats.length === 0 ? (
                <div className="rounded-xl border border-border bg-white p-6 text-center">
                  <p className="text-sm text-muted">
                    No publication data for this period yet — data pending.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {stats.map((stat) => (
                    <PublicationCard
                      key={stat.source_id}
                      stat={stat}
                      days={periodDays}
                      onTitleClick={openPublication}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function PublicationsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 px-4 py-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="h-8 w-48 animate-pulse rounded bg-surface" />
            <div className="h-72 animate-pulse rounded-xl bg-surface" />
            <div className="h-48 animate-pulse rounded-xl bg-surface" />
          </div>
        </main>
      }
    >
      <PublicationsContent />
    </Suspense>
  );
}
