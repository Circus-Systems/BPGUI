"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useVertical } from "@/hooks/use-vertical";
import { PrintButton } from "@/components/benchmark/print-button";
import { KpiRow, type KpiTile } from "@/components/benchmark/kpi-row";
import { LedgerChart } from "@/components/ledger/ledger-chart";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { formatAudCompact, type LedgerRow } from "@/components/ledger/format-value";

const QUARTER_OPTIONS = [
  { value: 4, label: "4 quarters" },
  { value: 8, label: "8 quarters" },
  { value: 12, label: "12 quarters" },
];

export default function LedgerPage() {
  const params = useParams();
  const slug = (params.slug as string) ?? "";
  const brand = useMemo(() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  }, [slug]);

  const { vertical } = useVertical();
  const [quarters, setQuarters] = useState(8);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({
        vertical,
        quarters: String(quarters),
      });
      const res = await fetch(
        `/api/ledger/${encodeURIComponent(brand)}?${p}`
      );
      if (!res.ok) throw new Error("Failed to load value ledger");
      const data = await res.json();
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [brand, vertical, quarters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Summary KPIs cover the trailing four quarters.
  const last4 = useMemo(() => rows.slice(-4), [rows]);
  const totals = useMemo(
    () =>
      last4.reduce(
        (acc, r) => ({
          bpg: acc.bpg + r.bpg_articles,
          headline: acc.headline + r.bpg_title_articles,
          exclusives: acc.exclusives + r.exclusive_stories,
          valueMin: acc.valueMin + r.value_min,
          valueMax: acc.valueMax + r.value_max,
        }),
        { bpg: 0, headline: 0, exclusives: 0, valueMin: 0, valueMax: 0 }
      ),
    [last4]
  );

  // Unknown brand (or no coverage) → every row is zero.
  const allZero = useMemo(
    () =>
      rows.length > 0 &&
      rows.every(
        (r) =>
          r.bpg_articles === 0 &&
          r.competitor_articles === 0 &&
          r.bpg_title_articles === 0 &&
          r.exclusive_stories === 0 &&
          r.first_stories === 0 &&
          r.value_mid === 0
      ),
    [rows]
  );

  const tiles: KpiTile[] = [
    {
      label: "BPG articles",
      value: totals.bpg.toLocaleString(),
      sub: "Last 4 quarters",
    },
    {
      label: "Headline articles",
      value: totals.headline.toLocaleString(),
      sub: "Brand in the headline",
    },
    {
      label: "Promotional value",
      value:
        totals.valueMax > 0
          ? `${formatAudCompact(totals.valueMin)}–${formatAudCompact(
              totals.valueMax
            )}`
          : "—",
      sub: "±15% band, last 4 quarters",
    },
    {
      label: "Exclusive stories",
      value: totals.exclusives.toLocaleString(),
      sub: "First / only to publish",
    },
  ];

  return (
    <main className="flex-1 px-4 py-6 print:px-0 print:py-0">
      {/* Page-scoped print rules: only mounted on /ledger, so hiding the
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
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground">
              {brand} — Partnership Value Ledger
            </h1>
            <p className="mt-1 text-sm text-muted">
              Editorial coverage and promotional value by quarter
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {/* Quarter window selector */}
            <div className="flex items-center gap-1">
              {QUARTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setQuarters(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    quarters === opt.value
                      ? "bg-accent text-white"
                      : "bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <PrintButton />
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

        {/* Summary KPIs */}
        <KpiRow tiles={tiles} loading={loading} />

        {/* Loading skeletons for chart + table */}
        {loading && !error && (
          <div className="space-y-6">
            <div className="h-80 animate-pulse rounded-xl bg-surface" />
            <div className="h-64 animate-pulse rounded-xl bg-surface" />
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {allZero ? (
              <div className="rounded-xl border border-border bg-white p-6 text-center">
                <p className="text-sm text-muted">
                  No tagged coverage found for{" "}
                  <span className="font-medium text-foreground">{brand}</span> in
                  this window. Check the brand name, or widen the quarter range.
                </p>
              </div>
            ) : (
              <>
                <LedgerChart rows={rows} />
                <LedgerTable rows={rows} />
              </>
            )}
          </>
        )}

        {/* Footnotes */}
        <div className="space-y-1 border-t border-border pt-4 text-xs text-muted">
          <p>
            Promotional value = earned editorial at rate card, ±15% band.
            Sponsored content excluded.
          </p>
          <p>Exclusives and first-to-publish tracked since Jul 2025.</p>
          <p>Counts cover canonically-tagged coverage.</p>
        </div>
      </div>
    </main>
  );
}
