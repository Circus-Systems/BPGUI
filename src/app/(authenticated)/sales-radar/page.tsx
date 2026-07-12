"use client";

import { useVertical } from "@/hooks/use-vertical";
import { useCallback, useEffect, useState } from "react";
import { formatNumber, formatDate } from "@/lib/format";
import {
  RadarTable,
  VerticalBadge,
  SourceChip,
  type RadarColumn,
} from "@/components/sales-radar/radar-table";

interface MomentumRow {
  brand: string;
  brand_id: string;
  vertical: string;
  is_bpg_client: boolean;
  recent_30: number;
  baseline: number;
  ratio: number;
}

interface WhitespaceRow {
  brand: string;
  brand_id: string;
  vertical: string;
  is_bpg_client: boolean;
  competitor_articles: number;
  bpg_articles: number;
}

interface AffinityRow {
  brand: string;
  brand_id: string;
  competitor_source: string;
  vertical: string;
  is_bpg_client: boolean;
  source_articles: number;
  over_index: number;
}

interface EmergingRow {
  brand: string;
  brand_id: string;
  vertical: string;
  is_bpg_client: boolean;
  recent_articles: number;
  first_seen: string;
}

interface RadarPayload {
  generated_at: string;
  window_days: number;
  momentum: MomentumRow[];
  whitespace: WhitespaceRow[];
  affinity: AffinityRow[];
  emerging: EmergingRow[];
}

const WINDOW_OPTIONS = [
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "365 days" },
];

function ratioLabel(n: number): string {
  return `${Number(n).toFixed(1)}×`;
}

export default function SalesRadarPage() {
  const { vertical } = useVertical();
  const [days, setDays] = useState(90);
  const [radar, setRadar] = useState<RadarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRadar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        vertical,
        days: String(days),
      });
      const res = await fetch(`/api/sales-radar?${params}`);
      if (!res.ok) throw new Error("Failed to fetch sales radar");
      const json = await res.json();
      setRadar(json.radar as RadarPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setRadar(null);
    } finally {
      setLoading(false);
    }
  }, [vertical, days]);

  useEffect(() => {
    fetchRadar();
  }, [fetchRadar]);

  const momentum = [...(radar?.momentum ?? [])].sort(
    (a, b) => Number(b.ratio) - Number(a.ratio)
  );
  const whitespace = [...(radar?.whitespace ?? [])].sort(
    (a, b) => Number(b.competitor_articles) - Number(a.competitor_articles)
  );
  const affinity = [...(radar?.affinity ?? [])].sort(
    (a, b) => Number(b.over_index) - Number(a.over_index)
  );
  const emerging = [...(radar?.emerging ?? [])].sort(
    (a, b) => Number(b.recent_articles) - Number(a.recent_articles)
  );

  const momentumCols: RadarColumn<MomentumRow>[] = [
    {
      key: "brand",
      header: "Brand",
      render: (r) => (
        <span className="font-medium text-foreground">{r.brand}</span>
      ),
    },
    {
      key: "vertical",
      header: "Vertical",
      render: (r) => <VerticalBadge vertical={r.vertical} />,
    },
    {
      key: "recent_30",
      header: "Last 30d",
      align: "right",
      render: (r) => formatNumber(Number(r.recent_30)),
    },
    {
      key: "baseline",
      header: "Baseline",
      align: "right",
      render: (r) => (
        <span className="text-muted">{formatNumber(Number(r.baseline))}</span>
      ),
    },
    {
      key: "ratio",
      header: "Ratio",
      align: "right",
      render: (r) => (
        <span className="font-medium text-increase">
          {ratioLabel(r.ratio)}
        </span>
      ),
    },
  ];

  const whitespaceCols: RadarColumn<WhitespaceRow>[] = [
    {
      key: "brand",
      header: "Brand",
      render: (r) => (
        <span className="font-medium text-foreground">{r.brand}</span>
      ),
    },
    {
      key: "vertical",
      header: "Vertical",
      render: (r) => <VerticalBadge vertical={r.vertical} />,
    },
    {
      key: "competitor_articles",
      header: "Competitor articles",
      align: "right",
      render: (r) => formatNumber(Number(r.competitor_articles)),
    },
  ];

  const affinityCols: RadarColumn<AffinityRow>[] = [
    {
      key: "brand",
      header: "Brand",
      render: (r) => (
        <span className="font-medium text-foreground">{r.brand}</span>
      ),
    },
    {
      key: "competitor_source",
      header: "Competitor title",
      render: (r) => <SourceChip source={r.competitor_source} />,
    },
    {
      key: "source_articles",
      header: "Articles there",
      align: "right",
      render: (r) => formatNumber(Number(r.source_articles)),
    },
    {
      key: "over_index",
      header: "Over-index",
      align: "right",
      render: (r) => (
        <span className="font-medium text-foreground">
          {ratioLabel(r.over_index)}
        </span>
      ),
    },
  ];

  const emergingCols: RadarColumn<EmergingRow>[] = [
    {
      key: "brand",
      header: "Brand",
      render: (r) => (
        <span className="font-medium text-foreground">{r.brand}</span>
      ),
    },
    {
      key: "vertical",
      header: "Vertical",
      render: (r) => <VerticalBadge vertical={r.vertical} />,
    },
    {
      key: "recent_articles",
      header: "Articles",
      align: "right",
      render: (r) => formatNumber(Number(r.recent_articles)),
    },
    {
      key: "first_seen",
      header: "First seen",
      align: "right",
      render: (r) => (
        <span className="text-muted">
          {r.first_seen ? formatDate(r.first_seen) : "—"}
        </span>
      ),
    },
  ];

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Sales Radar
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Coverage-derived tactical intelligence for sales. Every signal
              below is inferred from what trade media is writing about — not from
              advertising bookings or spend data.
            </p>
          </div>

          {/* Window picker */}
          <div className="flex items-center gap-1">
            {WINDOW_OPTIONS.map((opt) => (
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

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-decrease/20 bg-decrease/5 p-4">
            <p className="text-sm text-decrease">{error}</p>
            <button
              onClick={() => fetchRadar()}
              className="mt-2 text-sm font-medium text-accent hover:text-accent-dark"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-white p-4"
              >
                <div className="h-4 w-56 animate-pulse rounded bg-surface" />
                <div className="mt-2 h-3 w-72 animate-pulse rounded bg-surface" />
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-8 animate-pulse rounded bg-surface"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          !error && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Momentum */}
              <section className="rounded-xl border border-border bg-white p-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Momentum — spiking in the last 30 days
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Brands whose coverage over the last 30 days is running well
                  above their normal rate — a timely reason to reach out now.
                </p>
                <div className="mt-3">
                  <RadarTable
                    columns={momentumCols}
                    rows={momentum}
                    rowKey={(r) => r.brand_id}
                    emptyMessage="No brands are spiking in this window."
                  />
                </div>
              </section>

              {/* Whitespace */}
              <section className="rounded-xl border border-border bg-white p-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Whitespace — covered by competitors, not by BPG titles
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Brands that competitor titles are writing about but no BPG
                  publication has touched — open ground to pitch.
                </p>
                <div className="mt-3">
                  <RadarTable
                    columns={whitespaceCols}
                    rows={whitespace}
                    rowKey={(r) => r.brand_id}
                    emptyMessage="No uncovered brands in this window."
                  />
                </div>
              </section>

              {/* Competitor affinity */}
              <section className="rounded-xl border border-border bg-white p-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Competitor affinity — over-indexed on one competitor title
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Brands that lean heavily toward a single competitor title,
                  where a rival currently owns the editorial relationship.
                </p>
                <div className="mt-3">
                  <RadarTable
                    columns={affinityCols}
                    rows={affinity}
                    rowKey={(r) => `${r.brand_id}-${r.competitor_source}`}
                    emptyMessage="No strong affinities in this window."
                  />
                </div>
                <p className="mt-3 text-xs italic text-muted">
                  Editorial affinity only — not confirmed advertising spend.
                </p>
              </section>

              {/* Emerging */}
              <section className="rounded-xl border border-border bg-white p-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Emerging — first seen in the last 90 days
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  New names that entered coverage for the first time in the last
                  90 days — fresh brands worth an early conversation.
                </p>
                <div className="mt-3">
                  <RadarTable
                    columns={emergingCols}
                    rows={emerging}
                    rowKey={(r) => r.brand_id}
                    emptyMessage="No newly emerging brands in this window."
                  />
                </div>
              </section>
            </div>
          )
        )}

        {/* Page footnote */}
        <p className="border-t border-border pt-4 text-xs text-muted">
          Based on canonically-tagged brand mentions (~58% of all mentions).
          Counts are article mentions, not advertising data.
        </p>
      </div>
    </main>
  );
}
