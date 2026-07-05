"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
} from "recharts";
import { SlideShell } from "./slide-shell";
import { RecommendationsEditor } from "./recommendations-editor";
import {
  AUD,
  AUDIENCE_SEGMENTS,
  CONTENTS_ITEMS,
  LOOKING_AHEAD_ITEMS,
  READERSHIP_QUOTES,
  READERSHIP_SOURCE_NOTE,
  READERSHIP_STATS,
  coverageVolumeRows,
  formatAudCompact,
  formatPromoBand,
  insertionTotals,
  mediaCompetitorSet,
  promoFootnote,
  sourceLabel,
  sovChartsBySource,
  uniqueCoverageAllZero,
  type BriefDeckData,
  formatBonusValue,
} from "@/lib/brief-deck";

/**
 * 20-slide Key Partner Annual Meeting web preview.
 * All data comes from GET /api/brief/deck (assembleBriefData), the same
 * assembly used by the PPTX export, so preview and deck cannot drift.
 */

const PIE_COLORS = [
  "#2563EB", "#7C3AED", "#0891B2", "#D97706", "#059669", "#DC2626",
  "#4F46E5", "#0D9488", "#9333EA", "#CA8A04", "#6B7280",
];

function Pending({ text }: { text: string }) {
  return (
    <div className="rounded-md bg-surface border border-border px-4 py-3">
      <p className="text-sm text-muted italic">{text}</p>
    </div>
  );
}

function PromoFootnote({ hostTitle }: { hostTitle: string }) {
  return (
    <p className="mt-3 text-[10px] text-muted italic">{promoFootnote(hostTitle)}</p>
  );
}

// ---------------------------------------------------------------------------
// S1 — Title
// ---------------------------------------------------------------------------

export function S1TitleSlide({ data }: { data: BriefDeckData }) {
  return (
    <section className="brief-slide break-after-page bg-gradient-to-br from-[#0b1220] to-[#1e3a5f] text-white rounded-lg p-12 mb-6 print:rounded-none print:min-h-[210mm] print:flex print:flex-col print:justify-center">
      <div className="text-xs uppercase tracking-widest text-blue-300 font-semibold">
        {data.host.title_name}
      </div>
      <h1 className="text-4xl font-semibold mt-3">Key Partner Annual Meeting</h1>
      <p className="text-2xl mt-3 opacity-90">{data.brand}</p>
      <p className="mt-6 text-sm opacity-70">
        Last {data.period_days} days · Prepared{" "}
        {new Date(data.generated_at).toLocaleDateString("en-AU")} by Business
        Publishing Group
      </p>
      <div className="mt-12 inline-flex h-24 w-48 items-center justify-center rounded-md border border-dashed border-slate-400/60 text-xs italic text-slate-400">
        Partner logo
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// S2 — Contents
// ---------------------------------------------------------------------------

export function S2ContentsSlide() {
  return (
    <SlideShell number={2} title="Contents">
      <ol className="space-y-3 max-w-xl">
        {CONTENTS_ITEMS.map((item, i) => (
          <li
            key={item}
            className="flex items-center gap-4 rounded-md bg-surface border border-border px-4 py-3"
          >
            <span className="text-xl font-semibold text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-base font-medium text-foreground">{item}</span>
          </li>
        ))}
      </ol>
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S3 — Readership
// ---------------------------------------------------------------------------

export function S3ReadershipSlide({ data }: { data: BriefDeckData }) {
  return (
    <SlideShell
      number={3}
      title="Readership"
      subtitle={`${data.host.title_name} audience reach`}
    >
      <div className="grid grid-cols-3 gap-4">
        {READERSHIP_STATS.map((s) => (
          <div key={s.label} className="rounded-md bg-surface border border-border p-4">
            <div className="text-3xl font-semibold text-accent">{s.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground mt-2">
              {s.label}
            </div>
            <div className="text-xs text-muted mt-1">{s.detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {READERSHIP_QUOTES.map((q) => (
          <p key={q} className="text-lg italic text-foreground">
            &ldquo;{q}&rdquo;
          </p>
        ))}
      </div>
      <p className="mt-6 text-[10px] text-muted italic">{READERSHIP_SOURCE_NOTE}</p>
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S4 — Audience
// ---------------------------------------------------------------------------

export function S4AudienceSlide() {
  const segments = AUDIENCE_SEGMENTS.map((s) => ({ ...s }));
  return (
    <SlideShell
      number={4}
      title="Our audience"
      subtitle="Subscriber composition (publisher-supplied)"
    >
      <ResponsiveContainer width="100%" height={340}>
        <PieChart>
          <Pie
            data={segments}
            dataKey="pct"
            nameKey="name"
            cx="40%"
            cy="50%"
            outerRadius={130}
          >
            {segments.map((s, i) => (
              <Cell key={s.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `${v}%`} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => {
              const seg = AUDIENCE_SEGMENTS.find((s) => s.name === value);
              return `${value} — ${seg?.pct ?? ""}%`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S5 — Editorial team
// ---------------------------------------------------------------------------

export function S5TeamSlide({ data }: { data: BriefDeckData }) {
  const note =
    data.teamSource === "roster"
      ? "Derived from published bylines."
      : data.teamSource === "fallback"
        ? "Publisher-supplied roster."
        : null;
  return (
    <SlideShell
      number={5}
      title="Our editorial team"
      subtitle={`The ${data.host.title_name} newsroom`}
    >
      {data.team.length === 0 ? (
        <Pending text="Editorial roster pending — supply via Admin > Journalists." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.team.slice(0, 12).map((m) => (
              <div key={m.name} className="rounded-md border border-border p-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm mb-2"
                  style={{ backgroundColor: "#1e3a5f" }}
                >
                  {m.name
                    .split(" ")
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <p className="text-sm font-medium text-foreground">{m.name}</p>
                <p className="text-xs text-muted mt-0.5">{m.role}</p>
              </div>
            ))}
          </div>
          {note && <p className="mt-3 text-[10px] text-muted italic">{note}</p>}
        </>
      )}
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S6 — Respected
// ---------------------------------------------------------------------------

export function S6RespectedSlide() {
  return (
    <SlideShell number={6} title="Respected across the industry" subtitle="What partners say">
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-md bg-surface border border-dashed border-border p-6 min-h-[110px]"
          >
            <div className="text-2xl text-slate-300 font-semibold leading-none">&ldquo;&nbsp;&rdquo;</div>
            <p className="mt-3 text-sm italic text-muted">Testimonial — TD to supply</p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S7 — Content volume
// ---------------------------------------------------------------------------

export function S7ContentVolumeSlide({ data }: { data: BriefDeckData }) {
  const set = mediaCompetitorSet(data.host);
  const byId = new Map(data.contentVolume.map((p) => [p.source_id, p]));
  const rows = set.map((src) => ({
    name: sourceLabel(src),
    articles: byId.get(src)?.article_count || 0,
    isHost: src === data.host.primary_source,
  }));

  return (
    <SlideShell
      number={7}
      title="Content volume"
      subtitle={`Articles published — ${data.host.title_name} vs media competitors, last ${data.period_days} days`}
    >
      {data.contentVolume.length === 0 ? (
        <Pending text="Content volume data pending for this period." />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="articles" name="Articles">
                {rows.map((r) => (
                  <Cell key={r.name} fill={r.isHost ? "#2563EB" : "#94A3B8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[10px] text-muted italic">
            Social posting volumes: data pending (social capture not yet live).
          </p>
        </>
      )}
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S8 — Partner title card
// ---------------------------------------------------------------------------

export function S8TitleCardSlide({ data }: { data: BriefDeckData }) {
  const pv = data.promotionalValue;
  return (
    <section className="brief-slide break-after-page bg-gradient-to-br from-[#0b1220] to-[#1e3a5f] text-white rounded-lg p-12 mb-6 print:rounded-none print:min-h-[210mm] print:flex print:flex-col print:justify-center">
      <div className="text-xs uppercase tracking-widest text-blue-300 font-semibold">
        Partner performance
      </div>
      <h2 className="text-4xl font-semibold mt-3">{data.brand}</h2>
      <p className="mt-3 text-sm opacity-70">
        Last {data.period_days} days · Prepared{" "}
        {new Date(data.generated_at).toLocaleDateString("en-AU")}
      </p>
      <div className="mt-12 grid grid-cols-3 gap-6">
        <div>
          <div className="text-3xl font-semibold">{data.coverage.summary.total_articles}</div>
          <div className="opacity-70 text-xs uppercase tracking-wide mt-1">Total articles</div>
        </div>
        <div>
          <div className="text-3xl font-semibold">{data.coverage.summary.bpg_articles}</div>
          <div className="opacity-70 text-xs uppercase tracking-wide mt-1">
            {data.host.title_name} coverage
          </div>
        </div>
        <div>
          <div className="text-3xl font-semibold">{formatAudCompact(pv.mid)}</div>
          <div className="opacity-70 text-xs uppercase tracking-wide mt-1">
            Promotional value
          </div>
          <div className="text-xs opacity-60 mt-1">Range {formatPromoBand(pv)}</div>
        </div>
      </div>
      <p className="mt-10 text-[10px] opacity-50 italic">
        Midpoint {AUD.format(pv.mid)}. {promoFootnote(data.host.title_name)}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// S9 — Coverage
// ---------------------------------------------------------------------------

export function S9CoverageSlide({ data }: { data: BriefDeckData }) {
  const rows = coverageVolumeRows(data).map((r) => ({
    name: sourceLabel(r.source_id) + (r.is_host ? " (host)" : ""),
    articles: r.article_count,
    isHost: r.is_host,
  }));
  const allZero = rows.every((r) => r.articles === 0);

  return (
    <SlideShell
      number={9}
      title="Your coverage"
      subtitle={`Editorial support for ${data.brand} — last ${data.period_days} days`}
    >
      <div className="grid grid-cols-[240px_1fr] gap-6">
        <div className="space-y-3">
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-2xl font-semibold text-foreground">
              {data.coverage.summary.bpg_articles}
            </div>
            <div className="text-xs text-muted mt-1">Articles</div>
          </div>
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-2xl font-semibold text-foreground">—</div>
            <div className="text-xs text-muted mt-1">
              Social media posts (data pending)
            </div>
          </div>
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-2xl font-semibold text-foreground">
              {data.coverage.events.length}
            </div>
            <div className="text-xs text-muted mt-1">Events attended</div>
          </div>
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xl font-semibold text-foreground">
              {formatPromoBand(data.promotionalValue)}
            </div>
            <div className="text-xs text-muted mt-1">Promotional value</div>
          </div>
        </div>
        <div>
          {allZero ? (
            <Pending text="No brand coverage recorded across these publications in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="articles" name="Articles">
                  {rows.map((r) => (
                    <Cell key={r.name} fill={r.isHost ? "#2563EB" : "#94A3B8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <PromoFootnote hostTitle={data.host.title_name} />
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S10 — Unique coverage
// ---------------------------------------------------------------------------

export function S10UniqueSlide({ data }: { data: BriefDeckData }) {
  const c = data.coverage;
  const bpgFirstPct =
    c.first_to_publish.total_shared > 0
      ? Math.round(
          (c.first_to_publish.bpg_first / c.first_to_publish.total_shared) * 100
        )
      : 0;
  return (
    <SlideShell
      number={10}
      title="Unique coverage"
      subtitle={`Stories only BPG ran — ${c.unique_coverage_count ?? c.unique_coverage.length} in last ${c.period_days} days`}
    >
      <div className="grid grid-cols-4 gap-4 mb-4 text-center">
        <div className="rounded-md bg-surface p-3">
          <div className="text-2xl font-semibold">{c.unique_coverage_count ?? c.unique_coverage.length}</div>
          <div className="text-xs text-muted mt-1">BPG-only</div>
        </div>
        <div className="rounded-md bg-surface p-3">
          <div className="text-2xl font-semibold">{c.shared_coverage_count}</div>
          <div className="text-xs text-muted mt-1">Shared</div>
        </div>
        <div className="rounded-md bg-surface p-3">
          <div className="text-2xl font-semibold">{c.missed_coverage_count ?? c.missed_coverage.length}</div>
          <div className="text-xs text-muted mt-1">Missed (competitor only)</div>
        </div>
        <div className="rounded-md bg-surface p-3">
          <div className="text-2xl font-semibold">
            {c.first_to_publish.total_shared >= 3 ? `${bpgFirstPct}%` : "—"}
          </div>
          <div className="text-xs text-muted mt-1">
            {c.first_to_publish.total_shared >= 3
              ? "BPG-first rate"
              : `BPG-first rate (only ${c.first_to_publish.total_shared} shared)`}
          </div>
        </div>
      </div>
      {uniqueCoverageAllZero(c) ? (
        <p className="text-xs text-muted italic">
          Story-clustering backfill in progress — figures will populate as
          clusters build.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {c.unique_coverage.slice(0, 10).map((u) => (
            <li key={u.id} className="border-l-2 border-accent pl-3">
              <p className="font-medium">{u.canonical_title}</p>
              <p className="text-xs text-muted">
                {new Date(u.first_published_at).toLocaleDateString("en-AU")} ·{" "}
                {u.sources.map(sourceLabel).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S11 — Share of voice by category
// ---------------------------------------------------------------------------

export function S11SovSlide({ data }: { data: BriefDeckData }) {
  const demo = data.rivals?.source_of_truth === "demo";
  const charts = sovChartsBySource(data);
  return (
    <SlideShell
      number={11}
      title={`Share of voice by category${demo ? " (demo matrix)" : ""}`}
      subtitle={
        data.rivals
          ? `${data.brand} vs ${data.rivals.rivals.join(", ")} — last ${data.period_days} days`
          : undefined
      }
    >
      {!data.rivals || data.rivals.rivals.length === 0 ? (
        <Pending text="Share of voice pending — TD to supply competitor matrix." />
      ) : charts.length === 0 ? (
        <Pending text="No category coverage found for this competitor set in the period." />
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {charts.slice(0, 6).map((chart) => (
            <div key={chart.source_id}>
              <p className="text-sm font-medium text-foreground mb-1">
                {sourceLabel(chart.source_id)}
              </p>
              <ResponsiveContainer width="100%" height={Math.max(120, chart.rows.length * 34)}>
                <BarChart data={chart.rows} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="brand" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Articles">
                    {chart.rows.map((r) => (
                      <Cell
                        key={r.brand}
                        fill={r.brand === data.brand ? "#2563EB" : "#94A3B8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S12 — Advertising SoV
// ---------------------------------------------------------------------------

export function S12AdvSovSlide({ data }: { data: BriefDeckData }) {
  const rows = data.advertisingSov.map((r) => ({
    name: r.advertiser,
    spend: r.spend_aud,
    periods: r.insertion_periods,
  }));
  const allZero = rows.length === 0 || rows.every((r) => r.spend === 0);
  return (
    <SlideShell
      number={12}
      title="Share of voice — advertising presence"
      subtitle={`Advertising spend by brand across ${data.host.title_name} titles, last ${data.period_days} days`}
    >
      {allZero ? (
        <Pending text="Advertising share of voice pending — Salesforce spend import." />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatAudCompact(Number(v))}
              />
              <Tooltip formatter={(v) => AUD.format(Number(v))} />
              <Bar dataKey="spend" name="Spend (AUD)" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-muted">
            {rows
              .map((r) => `${r.name}: ${r.periods} insertion period${r.periods === 1 ? "" : "s"}`)
              .join("  ·  ")}
          </p>
        </>
      )}
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S13 — Proof (3 most recent)
// ---------------------------------------------------------------------------

export function S13ProofSlide({ data }: { data: BriefDeckData }) {
  const latest = [...(data.coverage.top_articles || [])]
    .sort(
      (a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    )
    .slice(0, 3);
  return (
    <SlideShell number={13} title="The proof" subtitle="Most recent coverage">
      {latest.length === 0 ? (
        <Pending text="No coverage in the selected period." />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {latest.map((a) => (
            <a
              key={`${a.source_id}-${a.external_id}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-md border border-border overflow-hidden hover:border-accent"
            >
              <div className="h-24 bg-gradient-to-br from-[#0b1220] to-[#1e3a5f] flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {sourceLabel(a.source_id)}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-foreground line-clamp-3">
                  {a.title}
                </p>
                <p className="text-xs text-muted mt-2">
                  {new Date(a.published_at).toLocaleDateString("en-AU")}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
      <p className="mt-3 text-[10px] text-muted italic">
        Article images are embedded in the exported PowerPoint where available.
      </p>
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S14 — All the proof
// ---------------------------------------------------------------------------

export function S14AllProofSlide({ data }: { data: BriefDeckData }) {
  const shown = data.allArticles.slice(0, 50);
  const more = data.allArticles.length - shown.length;
  return (
    <SlideShell
      number={14}
      title="All the proof"
      subtitle={`Full coverage appendix — ${data.allArticles.length} articles, last ${data.period_days} days`}
    >
      {data.allArticles.length === 0 ? (
        <Pending text="No articles found for this brand in the selected period." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 font-medium">Publication</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a, i) => (
                  <tr key={`${a.url}-${i}`} className="border-b border-border/60">
                    <td className="py-1.5 pr-4 text-xs text-muted whitespace-nowrap">
                      {a.published_at
                        ? new Date(a.published_at).toLocaleDateString("en-AU")
                        : "—"}
                    </td>
                    <td className="py-1.5 pr-4">
                      {a.url ? (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          {a.title}
                        </a>
                      ) : (
                        a.title
                      )}
                    </td>
                    <td className="py-1.5 text-xs text-muted whitespace-nowrap">
                      {sourceLabel(a.source_id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {more > 0 && (
            <p className="mt-3 text-xs text-muted italic">
              …and {more} more in the exported deck.
            </p>
          )}
        </>
      )}
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S15 / S16 — Campaigns
// ---------------------------------------------------------------------------

function InsertionTable({
  insertions,
  withNotes,
}: {
  insertions: Array<{
    id: string | number;
    run_date: string;
    source_id: string;
    ad_type: string | null;
    page_position: string | null;
    est_readership: number | null;
    clicks: number | null;
    notes: string | null;
  }>;
  withNotes?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="py-2 pr-3 font-medium">Date</th>
            <th className="py-2 pr-3 font-medium">Publication</th>
            <th className="py-2 pr-3 font-medium">Ad type</th>
            <th className="py-2 pr-3 font-medium">Page position</th>
            <th className="py-2 pr-3 font-medium">Est. readership</th>
            <th className="py-2 pr-3 font-medium">Clicks</th>
            {withNotes && <th className="py-2 font-medium">Notes</th>}
          </tr>
        </thead>
        <tbody>
          {insertions.map((i) => (
            <tr key={i.id} className="border-b border-border/60">
              <td className="py-1.5 pr-3 text-xs whitespace-nowrap">
                {new Date(i.run_date).toLocaleDateString("en-AU")}
              </td>
              <td className="py-1.5 pr-3 text-xs">{sourceLabel(i.source_id)}</td>
              <td className="py-1.5 pr-3 text-xs">{i.ad_type || "—"}</td>
              <td className="py-1.5 pr-3 text-xs">{i.page_position || "—"}</td>
              <td className="py-1.5 pr-3 text-xs">
                {i.est_readership != null
                  ? Number(i.est_readership).toLocaleString("en-AU")
                  : "—"}
              </td>
              <td className="py-1.5 pr-3 text-xs">
                {i.clicks != null ? Number(i.clicks).toLocaleString("en-AU") : "—"}
              </td>
              {withNotes && (
                <td className="py-1.5 text-xs text-muted">{i.notes || "—"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function S15CampaignSlide({ data }: { data: BriefDeckData }) {
  const lc = data.latestCampaign;
  return (
    <SlideShell number={15} title="Most recent campaign">
      {!lc ? (
        <Pending text="Campaign data pending — campaign report import (Admin > Campaigns)." />
      ) : (
        <>
          <p className="text-sm font-medium text-foreground mb-3">
            {lc.campaign.name}
            {lc.campaign.period_start && lc.campaign.period_end && (
              <span className="text-muted font-normal">
                {" "}
                · {new Date(lc.campaign.period_start).toLocaleDateString("en-AU")} –{" "}
                {new Date(lc.campaign.period_end).toLocaleDateString("en-AU")}
              </span>
            )}
          </p>
          <CampaignTotals data={data} />
          {lc.insertions.length === 0 ? (
            <p className="text-xs text-muted italic mt-3">
              No insertions recorded for this campaign yet.
            </p>
          ) : (
            <div className="mt-4">
              <InsertionTable insertions={lc.insertions} />
            </div>
          )}
        </>
      )}
    </SlideShell>
  );
}

function CampaignTotals({ data }: { data: BriefDeckData }) {
  const lc = data.latestCampaign;
  if (!lc) return null;
  const t = insertionTotals(lc.insertions);
  const cells: Array<[string, string]> = [
    [String(t.advertisements), "Advertisements"],
    [t.clicks.toLocaleString("en-AU"), "Click-thrus"],
    [t.ctrPct != null ? `${t.ctrPct.toFixed(2)}%` : "—", "CTR"],
    [
      lc.campaign.estimated_reach != null
        ? Number(lc.campaign.estimated_reach).toLocaleString("en-AU")
        : "—",
      "Estimated reach",
    ],
    [
      lc.campaign.spend_aud != null
        ? formatAudCompact(Number(lc.campaign.spend_aud))
        : "—",
      "Spend",
    ],
    [
      formatBonusValue(lc.campaign.bonus_ad_value, formatAudCompact),
      "Bonus ad value",
    ],
  ];
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {cells.map(([v, k]) => (
        <div key={k} className="rounded-md bg-surface border border-border p-2.5">
          <div className="text-lg font-semibold text-foreground">{v}</div>
          <div className="text-[10px] text-muted mt-0.5">{k}</div>
        </div>
      ))}
    </div>
  );
}

export function S16CampaignYtdSlide({ data }: { data: BriefDeckData }) {
  const year = new Date().getFullYear();
  const t = insertionTotals(data.ytdInsertions);
  return (
    <SlideShell
      number={16}
      title="Campaign reports — YTD"
      subtitle={`All insertions across campaigns, ${year}`}
    >
      {data.ytdInsertions.length === 0 ? (
        <Pending text="Campaign data pending — campaign report import (Admin > Campaigns)." />
      ) : (
        <>
          <p className="text-sm font-medium text-foreground mb-3">
            {t.advertisements} advertisements ·{" "}
            {t.clicks.toLocaleString("en-AU")} click-thrus ·{" "}
            {t.ctrPct != null ? `${t.ctrPct.toFixed(2)}% CTR` : "CTR —"}
          </p>
          <InsertionTable insertions={data.ytdInsertions} withNotes />
        </>
      )}
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S17 — Optimisation & recommendations
// ---------------------------------------------------------------------------

export function S17RecommendationsSlide({ data }: { data: BriefDeckData }) {
  return (
    <SlideShell
      number={17}
      title="Optimisation & recommendations"
      subtitle={`Prepared for ${data.brand}`}
    >
      <RecommendationsEditor
        hostSlug={data.host.slug}
        brand={data.brand}
        initialMd={data.recommendationsMd}
      />
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S18 — Proposal
// ---------------------------------------------------------------------------

export function S18ProposalSlide({ data }: { data: BriefDeckData }) {
  return (
    <SlideShell number={18} title="Proposal">
      <div className="rounded-md bg-surface border border-dashed border-border p-12 text-center">
        <p className="text-lg italic text-muted">Proposal — TD to supply</p>
        <p className="text-xs text-muted mt-2">
          Commercial proposal for {data.brand} to be inserted before the meeting.
        </p>
      </div>
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S19 — Looking ahead
// ---------------------------------------------------------------------------

export function S19LookingAheadSlide() {
  return (
    <SlideShell number={19} title="Looking ahead">
      <div className="space-y-3">
        {LOOKING_AHEAD_ITEMS.map((item) => (
          <div
            key={item.title}
            className="flex items-baseline gap-4 rounded-md bg-surface border border-border px-4 py-3"
          >
            <span className="text-sm font-semibold text-foreground min-w-[160px]">
              {item.title}
            </span>
            <span className="text-sm text-muted">{item.detail}</span>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

// ---------------------------------------------------------------------------
// S20 — Thank you
// ---------------------------------------------------------------------------

export function S20ThankYouSlide({ data }: { data: BriefDeckData }) {
  return (
    <section className="brief-slide bg-gradient-to-br from-[#0b1220] to-[#1e3a5f] text-white rounded-lg p-12 mb-6 print:rounded-none print:min-h-[210mm] print:flex print:flex-col print:justify-center">
      <h2 className="text-4xl font-semibold">Thank you for your partnership</h2>
      <p className="mt-3 text-sm opacity-70">
        {data.host.title_name} × {data.brand}
      </p>
      <div className="mt-12 inline-flex h-24 w-48 items-center justify-center rounded-md border border-dashed border-slate-400/60 text-xs italic text-slate-400">
        Partner logo
      </div>
    </section>
  );
}
