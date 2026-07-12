"use client";

import { useCallback, useEffect, useState } from "react";
import { useVertical } from "@/hooks/use-vertical";
import { GapsTable, type GapRow } from "@/components/editorial-compare/gaps-table";
import { SpeedTable, type SpeedRow } from "@/components/editorial-compare/speed-table";
import {
  ClusterDetail,
  type ClusterDetailData,
} from "@/components/editorial-compare/cluster-detail";

const GAP_DAY_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];

const SPEED_DAY_OPTIONS = [
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "365 days" },
];

function PillPicker({
  options,
  value,
  onChange,
}: {
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-accent text-white"
              : "bg-surface text-muted hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-decrease/20 bg-decrease/5 p-4">
      <p className="text-sm text-decrease">{message}</p>
      <button
        onClick={onRetry}
        className="mt-2 text-sm font-medium text-accent hover:text-accent-dark"
      >
        Retry
      </button>
    </div>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-surface" />
      ))}
    </div>
  );
}

export default function EditorialComparePage() {
  const { vertical } = useVertical();

  // Coverage gaps state
  const [gapsDays, setGapsDays] = useState(7);
  const [gaps, setGaps] = useState<GapRow[]>([]);
  const [gapsLoading, setGapsLoading] = useState(true);
  const [gapsError, setGapsError] = useState<string | null>(null);

  // Cluster detail state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<ClusterDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Speed report state
  const [speedDays, setSpeedDays] = useState(365);
  const [report, setReport] = useState<SpeedRow[]>([]);
  const [speedLoading, setSpeedLoading] = useState(true);
  const [speedError, setSpeedError] = useState<string | null>(null);

  // Fetch coverage gaps
  const fetchGaps = useCallback(async () => {
    setGapsLoading(true);
    setGapsError(null);
    try {
      const params = new URLSearchParams({
        vertical,
        days: String(gapsDays),
      });
      const res = await fetch(`/api/editorial-compare/gaps?${params}`);
      if (!res.ok) throw new Error("Failed to load coverage gaps");
      const data = await res.json();
      setGaps(data.gaps || []);
    } catch (err) {
      setGapsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGapsLoading(false);
    }
  }, [vertical, gapsDays]);

  // Fetch speed report
  const fetchSpeed = useCallback(async () => {
    setSpeedLoading(true);
    setSpeedError(null);
    try {
      const params = new URLSearchParams({
        vertical,
        days: String(speedDays),
      });
      const res = await fetch(`/api/editorial-compare/speed?${params}`);
      if (!res.ok) throw new Error("Failed to load speed report");
      const data = await res.json();
      setReport(data.report || []);
    } catch (err) {
      setSpeedError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSpeedLoading(false);
    }
  }, [vertical, speedDays]);

  // Reset selection + refetch gaps when vertical / window changes
  useEffect(() => {
    setSelectedId(null);
    setDetailData(null);
    fetchGaps();
  }, [fetchGaps]);

  useEffect(() => {
    fetchSpeed();
  }, [fetchSpeed]);

  // Fetch cluster detail on selection
  useEffect(() => {
    if (selectedId == null) {
      setDetailData(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/editorial-compare/clusters/${selectedId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load story detail");
        return r.json();
      })
      .then((data) => setDetailData(data))
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Editorial Compare
          </h1>
          <p className="mt-1 text-sm text-muted">
            Where BPG stands against the competition — for the editorial team.
          </p>
          <p className="mt-2 text-xs text-muted">
            Story-race data covers Jul 2025 onward.
          </p>
        </div>

        {/* Coverage gaps */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Coverage gaps
              </h2>
              <p className="text-sm text-muted">
                Stories competitors ran that BPG didn&apos;t.
              </p>
            </div>
            <PillPicker
              options={GAP_DAY_OPTIONS}
              value={gapsDays}
              onChange={setGapsDays}
            />
          </div>

          {gapsError ? (
            <ErrorCard message={gapsError} onRetry={fetchGaps} />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-xl border border-border bg-white p-4 lg:col-span-2">
                {gapsLoading ? (
                  <TableSkeleton />
                ) : gaps.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm font-medium text-foreground">
                      No gaps in this window
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      BPG covered every multi-source story competitors ran.
                    </p>
                  </div>
                ) : (
                  <GapsTable
                    gaps={gaps}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                )}
              </div>
              <div className="lg:col-span-1">
                <ClusterDetail
                  data={detailData}
                  loading={detailLoading}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            </div>
          )}
        </section>

        {/* Speed report */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Speed report — who publishes first
              </h2>
              <p className="text-sm text-muted">Multi-source stories only.</p>
            </div>
            <PillPicker
              options={SPEED_DAY_OPTIONS}
              value={speedDays}
              onChange={setSpeedDays}
            />
          </div>

          {speedError ? (
            <ErrorCard message={speedError} onRetry={fetchSpeed} />
          ) : (
            <div className="rounded-xl border border-border bg-white p-4">
              {speedLoading ? (
                <TableSkeleton rows={6} />
              ) : report.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted">
                    No multi-source stories in this window yet.
                  </p>
                </div>
              ) : (
                <SpeedTable report={report} />
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
