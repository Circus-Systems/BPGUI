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
import { SOURCE_COLORS } from "@/lib/constants";
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
  monthlyTimeline,
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

// Travel Daily deck chart palette — must mirror CHART_MORE in brief-pptx.ts so
// the web preview and the downloaded deck are visually identical (pixel-sampled
// from Kristen's template: navy / blush / sage trio, host pinned to navy).
const TD_NAVY = "#40699C";
const CHART_PALETTE = [
  "#40699C", "#F1DCDB", "#EBF0DE", "#8FA3C8", "#C9AB9C", "#A3B18A", "#6B7280",
];
/** Colour for bar i, with the host bar always the template navy. */
function barFill(i: number, isHost: boolean): string {
  return isHost ? TD_NAVY : CHART_PALETTE[i % CHART_PALETTE.length];
}

const PIE_COLORS = [
  "#40699C", "#B08A78", "#F1DCDB", "#EBF0DE", "#8FA3C8", "#C9AB9C",
  "#A3B18A", "#6B7280", "#4C5C96", "#D9C5B4", "#2A2A63",
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

/**
 * Full-bleed render of a page from the Travel Daily–designed template deck
 * (public/brief-assets). Keeps the web preview visually identical to the
 * exported PPTX, which embeds the same renders.
 */
function TemplateSlide({ img, alt, overlay }: { img: string; alt: string; overlay?: React.ReactNode }) {
  return (
    <section className="brief-slide relative mb-6 overflow-hidden rounded-lg break-after-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brief-assets/${img}`} alt={alt} className="w-full" />
      {overlay}
    </section>
  );
}

/** Brand name over the template's "Partner logo" placeholder (S1/S20). */
function PartnerNameOverlay({ brand }: { brand: string }) {
  return (
    <div className="absolute inset-x-0 flex items-center justify-center" style={{ top: "69.9%", height: "12.7%" }}>
      <div className="flex h-full min-w-[34%] items-center justify-center px-8" style={{ backgroundColor: "#181545" }}>
        <span className="italic font-bold text-white" style={{ fontSize: "clamp(14px, 2.6vw, 34px)" }}>{brand}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// S1 — Title
// ---------------------------------------------------------------------------

export function S1TitleSlide({ data }: { data: BriefDeckData }) {
  return <TemplateSlide img="s01.jpg" alt="Key Partner Annual Meeting" overlay={<PartnerNameOverlay brand={data.brand} />} />;
}

// ---------------------------------------------------------------------------
// S2 — Contents
// ---------------------------------------------------------------------------

export function S2ContentsSlide() {
  return <TemplateSlide img="s02.jpg" alt="Contents" />;
}

// ---------------------------------------------------------------------------
// S3 — Readership
// ---------------------------------------------------------------------------

export function S3ReadershipSlide(_props: { data: BriefDeckData }) {
  return <TemplateSlide img="s03.jpg" alt="Readership" />;
}

// ---------------------------------------------------------------------------
// S4 — Audience
// ---------------------------------------------------------------------------

export function S4AudienceSlide() {
  return <TemplateSlide img="s04.jpg" alt="Audience" />;
}

// ---------------------------------------------------------------------------
// S5 — Editorial team
// ---------------------------------------------------------------------------

export function S5TeamSlide(_props: { data: BriefDeckData }) {
  return <TemplateSlide img="s05.jpg" alt="Our editorial team" />;
}

// ---------------------------------------------------------------------------
// S6 — Respected
// ---------------------------------------------------------------------------

export function S6RespectedSlide() {
  return <TemplateSlide img="s06.jpg" alt="Respected" />;
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
                {rows.map((r, i) => (
                  <Cell key={r.name} fill={barFill(i, r.isHost)} />
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
            Coverage across our titles
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
  // BPG titles in navy tones (host darkest), competitors in the template
  // blush/sage cycle — the BPG bars sum to the Articles headline on the left.
  let comp = 0;
  const rows = coverageVolumeRows(data).map((r) => ({
    source_id: r.source_id,
    name: sourceLabel(r.source_id) + (r.is_host ? " (host)" : ""),
    articles: r.article_count,
    fill: r.is_host
      ? TD_NAVY
      : r.is_bpg
        ? "#8FA3C8"
        : CHART_PALETTE[1 + comp++ % (CHART_PALETTE.length - 1)],
  }));
  const allZero = rows.every((r) => r.articles === 0);

  // Monthly trend — re-bucket the weekly timeline into calendar months, and
  // colour each source the same as its bar above (SOURCE_COLORS fallback).
  const monthly = monthlyTimeline(data.coverage.timeline || []);
  const fillBySource = new Map(rows.map((r) => [r.source_id, r.fill]));
  const monthlyOrder = [
    ...rows.map((r) => r.source_id).filter((s) => monthly.sources.includes(s)),
    ...monthly.sources.filter((s) => !rows.some((r) => r.source_id === s)),
  ];
  const monthlyFill = (s: string, i: number) =>
    fillBySource.get(s) || SOURCE_COLORS[s] || CHART_PALETTE[i % CHART_PALETTE.length];

  const hc = data.headlineCoverage;

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
            <div className="text-xs text-muted mt-1">
              Articles across our titles
            </div>
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
          {hc && (
            <div className="rounded-md bg-surface border border-border p-3">
              <div className="text-2xl font-semibold text-foreground">
                {hc.pct}%
              </div>
              <div className="text-xs text-muted mt-1">
                of coverage put {data.brand} in the headline
              </div>
              <div className="text-[10px] text-muted italic mt-1">
                Share of canonically-tagged coverage; refreshed daily.
              </div>
            </div>
          )}
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
                    <Cell key={r.name} fill={r.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {monthly.points.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-foreground mb-1">
            Monthly trend
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              {monthlyOrder.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  name={sourceLabel(s)}
                  stackId="coverage"
                  fill={monthlyFill(s, i)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
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
                    {chart.rows.map((r, i) => (
                      <Cell
                        key={r.brand}
                        fill={barFill(i, r.brand === data.brand)}
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
              <Bar dataKey="spend" name="Spend (AUD)">
                {rows.map((r, i) => (
                  <Cell key={r.name} fill={barFill(i, r.name === data.brand)} />
                ))}
              </Bar>
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
    <>
      <TemplateSlide img="s17.jpg" alt="Optimisation and recommendations" />
      <div className="mb-6 rounded-lg border border-border bg-white p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Slide 17 content — flows into the exported deck
        </p>
        <RecommendationsEditor
          hostSlug={data.host.slug}
          brand={data.brand}
          initialMd={data.recommendationsMd}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// S18 — Proposal
// ---------------------------------------------------------------------------

export function S18ProposalSlide(_props: { data: BriefDeckData }) {
  return <TemplateSlide img="s18.jpg" alt="Proposal" />;
}

// ---------------------------------------------------------------------------
// S19 — Looking ahead
// ---------------------------------------------------------------------------

export function S19LookingAheadSlide() {
  return <TemplateSlide img="s19.jpg" alt="Looking ahead" />;
}

// ---------------------------------------------------------------------------
// S20 — Thank you
// ---------------------------------------------------------------------------

export function S20ThankYouSlide({ data }: { data: BriefDeckData }) {
  return <TemplateSlide img="s20.jpg" alt="Thank you for your partnership" overlay={<PartnerNameOverlay brand={data.brand} />} />;
}
