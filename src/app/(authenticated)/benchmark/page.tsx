"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  VERTICAL_SOURCES,
  COMPETITOR_SOURCES,
  SOURCE_LABELS,
} from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { PrintButton } from "@/components/benchmark/print-button";
import { TitleSelector } from "@/components/benchmark/title-selector";
import { KpiRow, type KpiTile } from "@/components/benchmark/kpi-row";
import {
  ComparisonTable,
  type BenchmarkRow,
} from "@/components/benchmark/comparison-table";
import { TrendChart, type MonthlyPoint } from "@/components/benchmark/trend-chart";

const DEFAULT_TITLE = "travel-daily";
const DAYS = 365;

interface StatRow {
  source_id: string;
  article_count: number;
  articles_per_day: number;
  brands_covered: number;
  first_pct: number | null;
}

interface SpeedRow {
  source_id: string;
  stories_total: number;
  first_count: number;
  first_pct: number;
  median_lag_hours: number | null;
  is_wire?: boolean;
}

interface TimelineEntry {
  date: string;
  [sourceId: string]: string | number;
}

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** pharmacy-daily lives in the pharmacy vertical; every other BPG title is travel. */
function verticalForTitle(title: string): VerticalCode {
  return VERTICAL_SOURCES.pharmacy.includes(title) ? "pharmacy" : "travel";
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = Number(m) - 1;
  return `${MONTH_ABBR[idx] ?? m} ${y.slice(2)}`;
}

export default function BenchmarkPage() {
  const [selectedTitle, setSelectedTitle] = useState<string>(DEFAULT_TITLE);

  const [stats, setStats] = useState<StatRow[]>([]);
  const [speed, setSpeed] = useState<SpeedRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const vertical = useMemo(
    () => verticalForTitle(selectedTitle),
    [selectedTitle]
  );

  // Comparison set: the selected title first, then its vertical's competitors.
  const competitors = useMemo(
    () =>
      (VERTICAL_SOURCES[vertical] || []).filter((s) =>
        COMPETITOR_SOURCES.includes(s)
      ),
    [vertical]
  );
  const comparisonSources = useMemo(
    () => [selectedTitle, ...competitors],
    [selectedTitle, competitors]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, speedRes, timelineRes] = await Promise.all([
        fetch(`/api/publications/stats?vertical=${vertical}&days=${DAYS}`),
        fetch(`/api/editorial-compare/speed?vertical=${vertical}&days=${DAYS}`),
        fetch(`/api/publications/timeline?vertical=${vertical}&days=${DAYS}`),
      ]);
      if (!statsRes.ok || !speedRes.ok || !timelineRes.ok) {
        throw new Error("Failed to load benchmark data");
      }
      const [statsData, speedData, timelineData] = await Promise.all([
        statsRes.json(),
        speedRes.json(),
        timelineRes.json(),
      ]);
      setStats(statsData.stats || []);
      setSpeed(speedData.report || []);
      setTimeline(timelineData.timeline || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [vertical]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statsById = useMemo(() => {
    const m = new Map<string, StatRow>();
    for (const s of stats) m.set(s.source_id, s);
    return m;
  }, [stats]);

  const speedById = useMemo(() => {
    const m = new Map<string, SpeedRow>();
    for (const s of speed) m.set(s.source_id, s);
    return m;
  }, [speed]);

  // Comparison table rows (selected first, then competitors).
  const rows = useMemo<BenchmarkRow[]>(
    () =>
      comparisonSources.map((sid) => {
        const st = statsById.get(sid);
        const sp = speedById.get(sid);
        return {
          source_id: sid,
          article_count: st?.article_count ?? 0,
          articles_per_day: st?.articles_per_day ?? 0,
          brands_covered: st?.brands_covered ?? 0,
          first_pct: sp?.first_pct ?? null,
          median_lag_hours: sp?.median_lag_hours ?? null,
          is_wire: sp?.is_wire ?? false,
        };
      }),
    [comparisonSources, statsById, speedById]
  );

  // Monthly re-bucket of the daily timeline for the selected comparison set.
  const monthly = useMemo<MonthlyPoint[]>(() => {
    const map = new Map<string, Record<string, number>>();
    for (const entry of timeline) {
      const ym = String(entry.date).slice(0, 7);
      const acc = map.get(ym) || {};
      for (const sid of comparisonSources) {
        const v = entry[sid];
        if (typeof v === "number") acc[sid] = (acc[sid] || 0) + v;
        else if (v != null) acc[sid] = (acc[sid] || 0) + (Number(v) || 0);
      }
      map.set(ym, acc);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, counts]) => ({ label: monthLabel(ym), ...counts }));
  }, [timeline, comparisonSources]);

  // Hero KPIs for the selected title.
  const selStats = statsById.get(selectedTitle);
  const selSpeed = speedById.get(selectedTitle);
  const titleLabel = SOURCE_LABELS[selectedTitle] || selectedTitle;

  const tiles: KpiTile[] = [
    {
      label: "Articles published",
      value: (selStats?.article_count ?? 0).toLocaleString(),
      sub: "Last 12 months",
    },
    {
      label: "Brands covered",
      value: (selStats?.brands_covered ?? 0).toLocaleString(),
      sub: "Canonically-tagged mentions",
    },
    {
      label: "First-to-story %",
      value:
        selSpeed?.first_pct == null ? "—" : `${selSpeed.first_pct.toFixed(1)}%`,
      sub:
        selSpeed == null
          ? "Multi-source races"
          : `${selSpeed.first_count.toLocaleString()} of ${selSpeed.stories_total.toLocaleString()} multi-source races`,
    },
    {
      label: "Stories broken first",
      value: (selSpeed?.first_count ?? 0).toLocaleString(),
      sub: `Ahead of ${competitors.length} competitor ${
        competitors.length === 1 ? "title" : "titles"
      }`,
    },
  ];

  return (
    <main className="flex-1 px-4 py-6 print:px-0 print:py-0">
      {/* Page-scoped print rules: only mounted on /benchmark, so hiding the
          layout's NavBar (<header>) and the vertical-selector bar (the div
          immediately after it) is safe here. */}
      <style>{`
        @media print {
          header { display: none !important; }
          header + div { display: none !important; }
          @page { margin: 12mm; }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="mx-auto max-w-5xl space-y-6 print:max-w-none">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {titleLabel} — The Evidence
            </h1>
            <p className="mt-1 text-sm text-muted">
              Editorial reach and speed vs competitors, last 12 months
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <PrintButton />
          </div>
        </div>

        {/* Title selector (hidden in print) */}
        <TitleSelector value={selectedTitle} onChange={setSelectedTitle} />

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

        {/* Hero KPIs */}
        <KpiRow tiles={tiles} loading={loading} />

        {/* Loading skeletons for table + chart */}
        {loading && !error && (
          <div className="space-y-6">
            <div className="h-64 animate-pulse rounded-xl bg-surface" />
            <div className="h-80 animate-pulse rounded-xl bg-surface" />
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            <ComparisonTable rows={rows} selectedId={selectedTitle} />
            <TrendChart
              data={monthly}
              sourceIds={comparisonSources}
              selectedId={selectedTitle}
            />
          </>
        )}

        {/* Footnotes */}
        <div className="space-y-1 border-t border-border pt-4 text-xs text-muted">
          <p>
            First-to-story covers multi-source stories since Jul 2025.
          </p>
          <p>Brand metrics cover canonically-tagged mentions.</p>
        </div>
      </div>
    </main>
  );
}
