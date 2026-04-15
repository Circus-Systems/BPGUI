"use client";

import { useEffect, useState } from "react";
import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";

interface PublicationStat {
  source_id: string;
  article_count: number;
  avg_word_count: number;
  sponsored_pct: number;
  articles_per_day: number;
  last_published: string | null;
}

interface Breakdown {
  journalists: Array<{ name: string; count: number }>;
  companies: Array<{ name: string; count: number }>;
}

export function PublicationCard({
  stat,
  days = 30,
}: {
  stat: PublicationStat;
  days?: number;
}) {
  const color = SOURCE_COLORS[stat.source_id] || "#71717A";
  const label = SOURCE_LABELS[stat.source_id] || stat.source_id;
  const [expanded, setExpanded] = useState(false);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [loadingBreak, setLoadingBreak] = useState(false);

  useEffect(() => {
    if (!expanded || breakdown) return;
    let cancelled = false;
    setLoadingBreak(true);
    fetch(
      `/api/publications/${encodeURIComponent(stat.source_id)}/breakdown?days=${days}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.journalists && d.companies) {
          setBreakdown({ journalists: d.journalists, companies: d.companies });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingBreak(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, breakdown, stat.source_id, days]);

  // Reset breakdown when period changes
  useEffect(() => {
    setBreakdown(null);
  }, [days]);

  return (
    <div className="rounded-xl border border-border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-sm font-semibold text-foreground truncate">
          {label}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted">Articles</p>
          <p className="text-lg font-semibold text-foreground">
            {stat.article_count.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Per Day</p>
          <p className="text-lg font-semibold text-foreground">
            {stat.articles_per_day}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Avg Words</p>
          <p className="text-sm font-medium text-foreground">
            {stat.avg_word_count.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Sponsored</p>
          <p className="text-sm font-medium text-foreground">
            {(stat.sponsored_pct * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {stat.last_published && (
        <p className="text-xs text-muted">
          Last published {formatRelativeTime(stat.last_published)}
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left text-xs font-medium text-accent hover:text-accent-dark transition-colors"
      >
        {expanded ? "Hide breakdown ▴" : "Show breakdown ▾"}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border pt-3">
          {loadingBreak && (
            <div className="space-y-2">
              <div className="h-3 w-1/2 animate-pulse rounded bg-surface" />
              <div className="h-3 w-full animate-pulse rounded bg-surface" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-surface" />
            </div>
          )}

          {!loadingBreak && breakdown && (
            <>
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                  Journalists
                </p>
                {breakdown.journalists.length === 0 ? (
                  <p className="text-xs text-muted">No bylined authors.</p>
                ) : (
                  <ul className="space-y-1">
                    {breakdown.journalists.map((j) => (
                      <li
                        key={`j-${j.name}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate text-foreground">{j.name}</span>
                        <span className="ml-2 text-muted shrink-0">{j.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                  Companies
                </p>
                {breakdown.companies.length === 0 ? (
                  <p className="text-xs text-muted">
                    No tagged companies in this period.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {breakdown.companies.map((c) => (
                      <li
                        key={`c-${c.name}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate text-foreground">{c.name}</span>
                        <span className="ml-2 text-muted shrink-0">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
