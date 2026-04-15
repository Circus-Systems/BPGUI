"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
} from "recharts";
import { SOURCE_LABELS, SOURCE_COLORS, BPG_SOURCES } from "@/lib/constants";
import { SlideShell } from "./slide-shell";

type Coverage = {
  brand: string;
  period_days: number;
  generated_at: string;
  summary: {
    total_articles: number;
    total_words: number;
    avg_words: number;
    sponsored_count: number;
    bpg_articles: number;
    competitor_articles: number;
  };
  by_publication: Array<{
    source_id: string;
    article_count: number;
    total_words: number;
    sponsored_count: number;
    is_bpg: boolean;
  }>;
  unique_coverage: Array<{
    id: number;
    canonical_title: string;
    first_published_at: string;
    article_count: number;
    sources: string[];
  }>;
  shared_coverage_count: number;
  missed_coverage: Array<{
    id: number;
    canonical_title: string;
    first_published_at: string;
    article_count: number;
    sources: string[];
  }>;
  first_to_publish: {
    bpg_first: number;
    competitor_first: number;
    total_shared: number;
  };
  timeline: Array<{ week: string; source_id: string; articles: number }>;
  top_articles: Array<{
    source_id: string;
    external_id: string;
    title: string;
    url: string;
    published_at: string;
    word_count: number;
    author_name: string | null;
    mention_count: number;
    in_title: number;
  }>;
  journalists: Array<{
    author_name: string;
    source_id: string;
    article_count: number;
  }>;
  events: Array<{
    event_name: string;
    event_date: string;
    source_id: string;
    attended_by: string | null;
  }>;
  spend_vs_coverage: Array<{
    source_id: string;
    spend_aud: number;
    article_count: number;
  }>;
  ave: {
    article_ave: number;
    total_articles: number;
    by_source: Array<{
      source_id: string;
      articles: number;
      ave_aud: number;
    }>;
  };
};

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export function TitleSlide({ coverage }: { coverage: Coverage }) {
  return (
    <section className="brief-slide break-after-page bg-gradient-to-br from-[#0b1220] to-[#1e3a5f] text-white rounded-lg p-12 mb-6 print:rounded-none print:min-h-[210mm] print:flex print:flex-col print:justify-center">
      <div className="text-xs uppercase tracking-widest opacity-70">
        Annual Meeting
      </div>
      <h1 className="text-4xl font-semibold mt-3">{coverage.brand}</h1>
      <div className="mt-8 space-y-1 text-sm opacity-80">
        <p>Last {coverage.period_days} days</p>
        <p>
          Prepared {new Date(coverage.generated_at).toLocaleDateString("en-AU")} by
          Business Publishing Group
        </p>
      </div>
      <div className="mt-12 grid grid-cols-3 gap-6 text-sm">
        <Stat label="Total articles" value={coverage.summary.total_articles} />
        <Stat label="BPG coverage" value={coverage.summary.bpg_articles} />
        <Stat label="AVE delivered" value={AUD.format(coverage.ave.article_ave || 0)} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="opacity-70 text-xs uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

type RosterRow = { source_id: string; author_name: string; article_count: number };

export function TeamSlide() {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  useEffect(() => {
    fetch("/api/newsroom")
      .then((r) => r.json())
      .then((d) => setRoster(d.roster || []))
      .catch(() => setRoster([]));
  }, []);

  const bySrc = new Map<string, RosterRow[]>();
  for (const r of roster) {
    const arr = bySrc.get(r.source_id) || [];
    arr.push(r);
    bySrc.set(r.source_id, arr);
  }

  return (
    <SlideShell number={2} title="Our editorial team" subtitle="Journalists across the BPG newsroom">
      <div className="grid grid-cols-2 gap-4">
        {BPG_SOURCES.map((src) => {
          const people = bySrc.get(src) || [];
          return (
            <div key={src} className="rounded-md border border-border p-4">
              <p className="text-sm font-medium">{SOURCE_LABELS[src] || src}</p>
              {people.length > 0 ? (
                <p className="text-xs text-foreground mt-2 leading-relaxed">
                  {people.slice(0, 6).map((p, i) => (
                    <span key={p.author_name}>
                      {i > 0 ? "  •  " : ""}
                      <span className="font-medium">{p.author_name}</span>
                      <span className="text-muted"> ({p.article_count})</span>
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-xs text-muted mt-2">
                  Byline data not yet captured for this publication.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </SlideShell>
  );
}

export function ActivitySlide({ coverage }: { coverage: Coverage }) {
  // Group by publication for a comparison chart
  const data = coverage.by_publication.map((p) => ({
    name: SOURCE_LABELS[p.source_id] || p.source_id,
    articles: p.article_count,
    words: Math.round(p.total_words / 1000),
    group: p.is_bpg ? "BPG" : "Competitor",
  }));

  return (
    <SlideShell
      number={3}
      title="Editorial activity"
      subtitle={`Articles mentioning ${coverage.brand} — last ${coverage.period_days} days`}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="articles" name="Articles" fill="#2563EB" />
          <Bar dataKey="words" name="Thousand words" fill="#7C3AED" />
        </BarChart>
      </ResponsiveContainer>
    </SlideShell>
  );
}

export function AuthoritySlide() {
  return (
    <SlideShell number={4} title="Reader authority" subtitle="From BPG reader surveys">
      <p className="text-sm text-muted">
        Survey results load from admin uploader (Phase 10). This slide will render:
        &quot;most respected&quot; and &quot;most authoritative&quot; bars per publication.
      </p>
    </SlideShell>
  );
}

export function BrandSupportSlide({ coverage }: { coverage: Coverage }) {
  const aveData = (coverage.ave.by_source || []).map((b) => ({
    name: SOURCE_LABELS[b.source_id] || b.source_id,
    ave: b.ave_aud,
    articles: b.articles,
  }));

  return (
    <SlideShell
      number={5}
      title="Support for your brand"
      subtitle={`Ad-value-equivalency: ${AUD.format(coverage.ave.article_ave || 0)} across BPG`}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={aveData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v) => AUD.format(Number(v))} />
          <Bar dataKey="ave" name="AVE (AUD)" fill="#059669" />
        </BarChart>
      </ResponsiveContainer>
    </SlideShell>
  );
}

export function ClippingsSlide({ coverage }: { coverage: Coverage }) {
  return (
    <SlideShell number={6} title="Example clippings" subtitle="Top BPG articles mentioning your brand">
      <div className="space-y-3">
        {coverage.top_articles.slice(0, 6).map((a) => (
          <a
            key={`${a.source_id}-${a.external_id}`}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md border border-border p-3 hover:border-accent"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="text-xs text-muted mt-1">
                  {SOURCE_LABELS[a.source_id] || a.source_id} ·{" "}
                  {new Date(a.published_at).toLocaleDateString("en-AU")} ·{" "}
                  {a.word_count} words
                  {a.author_name ? ` · ${a.author_name}` : ""}
                </p>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-xs text-white"
                style={{ backgroundColor: SOURCE_COLORS[a.source_id] || "#6b7280" }}
              >
                {a.mention_count}x
              </span>
            </div>
          </a>
        ))}
        {coverage.top_articles.length === 0 && (
          <p className="text-sm text-muted">No articles in selected period.</p>
        )}
      </div>
    </SlideShell>
  );
}

export function PeopleSlide({ coverage }: { coverage: Coverage }) {
  return (
    <SlideShell number={7} title="People who supported your brand" subtitle="BPG journalists">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {coverage.journalists.slice(0, 12).map((j) => (
          <div
            key={`${j.author_name}-${j.source_id}`}
            className="rounded-md border border-border p-3"
          >
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold text-sm mb-2"
              style={{ backgroundColor: SOURCE_COLORS[j.source_id] || "#6b7280" }}
            >
              {j.author_name
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </div>
            <p className="text-sm font-medium">{j.author_name}</p>
            <p className="text-xs text-muted">
              {SOURCE_LABELS[j.source_id] || j.source_id} · {j.article_count} articles
            </p>
          </div>
        ))}
        {coverage.journalists.length === 0 && (
          <p className="text-sm text-muted col-span-full">
            Author attribution will populate as collectors tag journalists.
          </p>
        )}
      </div>
    </SlideShell>
  );
}

export function UniqueCoverageSlide({ coverage }: { coverage: Coverage }) {
  return (
    <SlideShell
      number={8}
      title="Unique coverage"
      subtitle={`Stories only BPG ran — ${coverage.unique_coverage.length} in last ${coverage.period_days} days`}
    >
      <div className="grid grid-cols-4 gap-4 mb-4 text-center">
        <div className="rounded-md bg-surface p-3">
          <div className="text-2xl font-semibold">{coverage.unique_coverage.length}</div>
          <div className="text-xs text-muted mt-1">BPG-only</div>
        </div>
        <div className="rounded-md bg-surface p-3">
          <div className="text-2xl font-semibold">{coverage.shared_coverage_count}</div>
          <div className="text-xs text-muted mt-1">Shared</div>
        </div>
        <div className="rounded-md bg-surface p-3">
          <div className="text-2xl font-semibold">{coverage.missed_coverage.length}</div>
          <div className="text-xs text-muted mt-1">Missed (competitor only)</div>
        </div>
        <div className="rounded-md bg-surface p-3">
          <div className="text-2xl font-semibold">
            {coverage.first_to_publish.total_shared > 0
              ? Math.round(
                  (coverage.first_to_publish.bpg_first /
                    coverage.first_to_publish.total_shared) *
                    100
                )
              : 0}
            %
          </div>
          <div className="text-xs text-muted mt-1">BPG-first rate</div>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {coverage.unique_coverage.slice(0, 10).map((c) => (
          <li key={c.id} className="border-l-2 border-accent pl-3">
            <p className="font-medium">{c.canonical_title}</p>
            <p className="text-xs text-muted">
              {new Date(c.first_published_at).toLocaleDateString("en-AU")} ·{" "}
              {c.sources.join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </SlideShell>
  );
}

export function SpendScatterSlide({ coverage }: { coverage: Coverage }) {
  const data = coverage.spend_vs_coverage.map((s) => ({
    name: SOURCE_LABELS[s.source_id] || s.source_id,
    x: Number(s.spend_aud),
    y: s.article_count,
  }));

  return (
    <SlideShell
      number={9}
      title="Spend vs coverage"
      subtitle="Your advertising spend relative to editorial mentions (per publication)"
    >
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="x"
            name="Spend"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
          />
          <YAxis type="number" dataKey="y" name="Articles" tick={{ fontSize: 11 }} />
          <Tooltip
            content={({ payload }) => {
              if (!payload || !payload[0]) return null;
              const p = payload[0].payload as { name: string; x: number; y: number };
              return (
                <div className="rounded border border-border bg-white p-2 text-xs">
                  <div className="font-medium">{p.name}</div>
                  <div>Spend: {AUD.format(p.x)}</div>
                  <div>Articles: {p.y}</div>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="#2563EB" />
        </ScatterChart>
      </ResponsiveContainer>
      {data.every((d) => d.x === 0) && (
        <p className="text-xs text-muted mt-2">
          No spend data yet — uploads via admin UI (Phase 10) populate this chart.
        </p>
      )}
    </SlideShell>
  );
}

export function TimelineSlide({ coverage }: { coverage: Coverage }) {
  // Pivot timeline: one line per source
  const bySource = new Map<string, Array<{ week: string; articles: number }>>();
  const allWeeks = new Set<string>();
  for (const row of coverage.timeline) {
    allWeeks.add(row.week);
    const arr = bySource.get(row.source_id) || [];
    arr.push({ week: row.week, articles: row.articles });
    bySource.set(row.source_id, arr);
  }
  const weeks = Array.from(allWeeks).sort();
  const rows = weeks.map((w) => {
    const entry: Record<string, string | number> = { week: w };
    for (const [src, arr] of bySource) {
      const hit = arr.find((r) => r.week === w);
      entry[src] = hit ? hit.articles : 0;
    }
    return entry;
  });

  return (
    <SlideShell number={10} title="Coverage timeline" subtitle="Weekly article counts by publication">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="week" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {Array.from(bySource.keys()).map((src) => (
            <Line
              key={src}
              type="monotone"
              dataKey={src}
              name={SOURCE_LABELS[src] || src}
              stroke={SOURCE_COLORS[src] || "#6b7280"}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </SlideShell>
  );
}
