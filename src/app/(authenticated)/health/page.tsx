"use client";

import { useCallback, useEffect, useState } from "react";
import { CollectorGrid } from "@/components/health/collector-grid";
import { RunTimeline } from "@/components/health/run-timeline";

interface CollectorInfo {
  source_id: string;
  name: string;
  vertical: string;
  health_status: "healthy" | "warning" | "error" | "unknown";
  last_run: {
    status: string;
    started_at: string;
    finished_at: string | null;
    items_collected: number;
    items_new: number;
  } | null;
  last_article_at: string | null;
  runs_24h: number;
  success_rate_24h: number | null;
}

interface Run {
  id: number;
  collector_id: string;
  collector_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_collected: number;
  items_new: number;
  items_updated: number;
  errors_json: string | null;
}

interface Summary {
  total: number;
  healthy: number;
  warning: number;
  error: number;
}

export default function HealthPage() {
  const [collectors, setCollectors] = useState<CollectorInfo[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, healthy: 0, warning: 0, error: 0 });
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCollector, setSelectedCollector] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health/summary");
      if (!res.ok) throw new Error("Failed to fetch health data");
      const data = await res.json();
      setCollectors(data.collectors || []);
      setSummary(data.summary || { total: 0, healthy: 0, warning: 0, error: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRuns = useCallback(async (collectorId: string | null) => {
    setRunsLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (collectorId) params.set("collector", collectorId);
    try {
      const res = await fetch(`/api/health/runs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch runs");
      const data = await res.json();
      setRuns(data.runs || []);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchRuns(null);
  }, [fetchSummary, fetchRuns]);

  useEffect(() => {
    fetchRuns(selectedCollector);
  }, [selectedCollector, fetchRuns]);

  function handleSelect(id: string) {
    setSelectedCollector((prev) => (prev === id ? null : id));
  }

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-xl font-semibold text-foreground">
          Collector Health
        </h1>

        {/* Summary KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted">Total Collectors</p>
            <p className="text-2xl font-semibold text-foreground">
              {loading ? "—" : summary.total}
            </p>
          </div>
          <div className="rounded-xl border border-increase/30 bg-white p-4">
            <p className="text-xs text-increase">Healthy</p>
            <p className="text-2xl font-semibold text-increase">
              {loading ? "—" : summary.healthy}
            </p>
          </div>
          <div className="rounded-xl border border-amber-300/50 bg-white p-4">
            <p className="text-xs text-amber-500">Warning</p>
            <p className="text-2xl font-semibold text-amber-500">
              {loading ? "—" : summary.warning}
            </p>
          </div>
          <div className="rounded-xl border border-decrease/30 bg-white p-4">
            <p className="text-xs text-decrease">Error</p>
            <p className="text-2xl font-semibold text-decrease">
              {loading ? "—" : summary.error}
            </p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-decrease/20 bg-decrease/5 p-4">
            <p className="text-sm text-decrease">{error}</p>
            <button
              onClick={fetchSummary}
              className="mt-2 text-sm font-medium text-accent hover:text-accent-dark"
            >
              Retry
            </button>
          </div>
        )}

        {/* Collector grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : (
          <CollectorGrid
            collectors={collectors}
            onSelect={handleSelect}
            selectedCollector={selectedCollector}
          />
        )}

        {/* Run timeline */}
        <div className="rounded-xl border border-border bg-white p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Recent Runs
            {selectedCollector && (
              <span className="ml-2 text-xs text-muted font-normal">
                — filtered to {selectedCollector}
              </span>
            )}
          </h3>
          <RunTimeline runs={runs} loading={runsLoading} />
        </div>
      </div>
    </main>
  );
}
