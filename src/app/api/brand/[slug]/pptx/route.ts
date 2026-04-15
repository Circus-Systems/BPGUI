import { createClient } from "@/lib/supabase/server";
import { BPG_SOURCES, COMPETITOR_SOURCES, SOURCE_LABELS } from "@/lib/constants";
import { NextResponse, type NextRequest } from "next/server";
import PptxGenJS from "pptxgenjs";

/**
 * Generates a PowerPoint (.pptx) download of the AdvertiserBrief deck.
 *
 * Mirrors the 10-slide structure of /brief/[slug] but uses native PPTX
 * shapes/charts so the output is editable in PowerPoint/Keynote (not a
 * print-to-PDF raster).
 */

// Shape of the brand_coverage RPC payload (mirrors slides.tsx Coverage type)
interface Coverage {
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
  missed_coverage: Array<{ id: number; canonical_title: string; first_published_at: string; article_count: number; sources: string[] }>;
  first_to_publish: { bpg_first: number; competitor_first: number; total_shared: number };
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
  journalists: Array<{ author_name: string; source_id: string; article_count: number }>;
  events: Array<{ event_name: string; event_date: string; source_id: string; attended_by: string | null }>;
  spend_vs_coverage: Array<{ source_id: string; spend_aud: number; article_count: number }>;
  ave: {
    article_ave: number;
    total_articles: number;
    by_source: Array<{ source_id: string; articles: number; ave_aud: number }>;
  };
}

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

// Brand palette
const NAVY = "0B1220";
const ACCENT = "2563EB";
const MUTED = "6B7280";
const SURFACE = "F3F4F6";
const TEXT = "111827";

function label(src: string): string {
  return SOURCE_LABELS[src] || src;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sp = request.nextUrl.searchParams;
  const brandName = sp.get("name") || slug;
  const period = parseInt(sp.get("period") || "365", 10);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("brand_coverage", {
    brand_name: brandName,
    bpg_sources: [...BPG_SOURCES],
    competitor_sources: [...COMPETITOR_SOURCES],
    period_days: period,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const coverage = data as Coverage;
  const pptx = buildDeck(coverage);
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  const safeBrand = coverage.brand.replace(/[^A-Za-z0-9_-]+/g, "_");
  const filename = `AdvertiserBrief_${safeBrand}_${period}d.pptx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}

function buildDeck(c: Coverage): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5"
  pptx.title = `AdvertiserBrief — ${c.brand}`;
  pptx.author = "Business Publishing Group";
  pptx.company = "BPG";

  slideTitle(pptx, c);
  slideTeam(pptx, c);
  slideActivity(pptx, c);
  slideAuthority(pptx);
  slideBrandSupport(pptx, c);
  slideClippings(pptx, c);
  slidePeople(pptx, c);
  slideUnique(pptx, c);
  slideSpend(pptx, c);
  slideTimeline(pptx, c);

  return pptx;
}

function addHeader(s: PptxGenJS.Slide, n: number, title: string, subtitle?: string) {
  s.addText(`Slide ${n}`, { x: 0.5, y: 0.3, w: 2, h: 0.3, fontSize: 10, color: MUTED });
  s.addText(title, { x: 0.5, y: 0.6, w: 12, h: 0.6, fontSize: 24, bold: true, color: TEXT });
  if (subtitle) {
    s.addText(subtitle, { x: 0.5, y: 1.2, w: 12, h: 0.4, fontSize: 12, color: MUTED });
  }
}

// ---------- Slides ----------

function slideTitle(pptx: PptxGenJS, c: Coverage) {
  const s = pptx.addSlide();
  s.background = { color: NAVY };
  s.addText("ANNUAL MEETING", {
    x: 0.6, y: 1.2, w: 12, h: 0.4,
    fontSize: 12, color: "FFFFFF", bold: true, charSpacing: 6,
  });
  s.addText(c.brand, {
    x: 0.6, y: 1.7, w: 12, h: 1.2, fontSize: 54, bold: true, color: "FFFFFF",
  });
  s.addText(`Last ${c.period_days} days`, {
    x: 0.6, y: 3.0, w: 12, h: 0.4, fontSize: 14, color: "FFFFFF",
  });
  s.addText(
    `Prepared ${new Date(c.generated_at).toLocaleDateString("en-AU")} by Business Publishing Group`,
    { x: 0.6, y: 3.4, w: 12, h: 0.4, fontSize: 12, color: "D1D5DB" }
  );

  const stats: Array<[string, string]> = [
    ["Total articles", String(c.summary.total_articles)],
    ["BPG coverage", String(c.summary.bpg_articles)],
    ["AVE delivered", AUD.format(c.ave.article_ave || 0)],
  ];
  stats.forEach(([k, v], i) => {
    const x = 0.6 + i * 4.3;
    s.addText(v, { x, y: 5.0, w: 4, h: 0.8, fontSize: 32, bold: true, color: "FFFFFF" });
    s.addText(k.toUpperCase(), {
      x, y: 5.9, w: 4, h: 0.3, fontSize: 10, color: "D1D5DB", charSpacing: 4,
    });
  });
}

function slideTeam(pptx: PptxGenJS, c: Coverage) {
  const s = pptx.addSlide();
  addHeader(s, 2, "Our editorial team", "BPG journalists covering your category");

  // Group journalists by source, fall back to placeholder per BPG source
  const bySrc = new Map<string, typeof c.journalists>();
  for (const j of c.journalists || []) {
    const arr = bySrc.get(j.source_id) || [];
    arr.push(j);
    bySrc.set(j.source_id, arr);
  }

  const cols = 2;
  const cellW = 6;
  const cellH = 1.1;
  BPG_SOURCES.forEach((src, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.5 + col * (cellW + 0.3);
    const y = 1.8 + row * (cellH + 0.15);
    s.addShape("rect", {
      x, y, w: cellW, h: cellH,
      fill: { color: "FFFFFF" },
      line: { color: "E5E7EB", width: 1 },
    });
    s.addText(label(src), { x: x + 0.2, y: y + 0.15, w: cellW - 0.4, h: 0.3, fontSize: 12, bold: true, color: TEXT });
    const names = (bySrc.get(src) || []).slice(0, 3)
      .map((j) => `${j.author_name} (${j.article_count})`).join(" · ");
    s.addText(
      names || "Journalist roster populates from admin uploader.",
      { x: x + 0.2, y: y + 0.5, w: cellW - 0.4, h: 0.5, fontSize: 10, color: MUTED },
    );
  });
}

function slideActivity(pptx: PptxGenJS, c: Coverage) {
  const s = pptx.addSlide();
  addHeader(
    s, 3,
    "Editorial activity",
    `Articles mentioning ${c.brand} — last ${c.period_days} days`
  );

  const data = c.by_publication.map((p) => ({
    name: label(p.source_id),
    articles: p.article_count,
    kWords: Math.round(p.total_words / 1000),
  }));

  s.addChart(pptx.ChartType.bar, [
    {
      name: "Articles",
      labels: data.map((d) => d.name),
      values: data.map((d) => d.articles),
    },
    {
      name: "Thousand words",
      labels: data.map((d) => d.name),
      values: data.map((d) => d.kWords),
    },
  ], {
    x: 0.5, y: 1.7, w: 12.3, h: 5.2,
    barDir: "col",
    showLegend: true,
    legendPos: "b",
    chartColors: [ACCENT, "7C3AED"],
    catAxisLabelFontSize: 9,
    valAxisLabelFontSize: 9,
  });
}

function slideAuthority(pptx: PptxGenJS) {
  const s = pptx.addSlide();
  addHeader(s, 4, "Reader authority", "From BPG reader surveys");
  s.addText(
    'Survey results load from admin uploader (Phase 10). This slide will render "most respected" and "most authoritative" bars per publication.',
    { x: 0.5, y: 1.8, w: 12.3, h: 1.5, fontSize: 12, color: MUTED },
  );
}

function slideBrandSupport(pptx: PptxGenJS, c: Coverage) {
  const s = pptx.addSlide();
  addHeader(
    s, 5,
    "Support for your brand",
    `Ad-value-equivalency: ${AUD.format(c.ave.article_ave || 0)} across BPG`
  );

  const data = (c.ave.by_source || []).map((b) => ({
    name: label(b.source_id),
    ave: b.ave_aud,
  }));

  s.addChart(pptx.ChartType.bar, [{
    name: "AVE (AUD)",
    labels: data.map((d) => d.name),
    values: data.map((d) => d.ave),
  }], {
    x: 0.5, y: 1.7, w: 12.3, h: 5.2,
    barDir: "col",
    chartColors: ["059669"],
    showLegend: false,
    valAxisLabelFormatCode: '"$"#,##0',
    catAxisLabelFontSize: 9,
    valAxisLabelFontSize: 9,
  });
}

function slideClippings(pptx: PptxGenJS, c: Coverage) {
  const s = pptx.addSlide();
  addHeader(s, 6, "Example clippings", "Top BPG articles mentioning your brand");

  const rows: PptxGenJS.TableRow[] = [
    [
      { text: "Publication", options: { bold: true, fill: { color: SURFACE } } },
      { text: "Title", options: { bold: true, fill: { color: SURFACE } } },
      { text: "Published", options: { bold: true, fill: { color: SURFACE } } },
      { text: "Words", options: { bold: true, fill: { color: SURFACE } } },
      { text: "Mentions", options: { bold: true, fill: { color: SURFACE } } },
    ],
  ];
  for (const a of (c.top_articles || []).slice(0, 8)) {
    rows.push([
      { text: label(a.source_id), options: { fontSize: 9 } },
      { text: a.title, options: { fontSize: 9, hyperlink: { url: a.url } } },
      { text: new Date(a.published_at).toLocaleDateString("en-AU"), options: { fontSize: 9 } },
      { text: String(a.word_count), options: { fontSize: 9 } },
      { text: String(a.mention_count), options: { fontSize: 9 } },
    ]);
  }
  if (!c.top_articles?.length) {
    rows.push([{ text: "No articles in selected period.", options: { fontSize: 10, colspan: 5, color: MUTED } }]);
  }
  s.addTable(rows, {
    x: 0.5, y: 1.8, w: 12.3,
    colW: [1.8, 6.5, 1.4, 1.0, 1.6],
    border: { type: "solid", color: "E5E7EB", pt: 0.5 },
  });
}

function slidePeople(pptx: PptxGenJS, c: Coverage) {
  const s = pptx.addSlide();
  addHeader(s, 7, "People who supported your brand", "BPG journalists");

  const list = (c.journalists || []).slice(0, 12);
  if (list.length === 0) {
    s.addText("Author attribution will populate as collectors tag journalists.", {
      x: 0.5, y: 1.8, w: 12.3, h: 0.6, fontSize: 12, color: MUTED,
    });
    return;
  }
  const cols = 4;
  const cellW = 3.0;
  const cellH = 1.2;
  list.forEach((j, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.5 + col * (cellW + 0.2);
    const y = 1.8 + row * (cellH + 0.2);
    s.addShape("rect", {
      x, y, w: cellW, h: cellH,
      fill: { color: "FFFFFF" },
      line: { color: "E5E7EB", width: 1 },
    });
    s.addText(j.author_name, { x: x + 0.2, y: y + 0.15, w: cellW - 0.4, h: 0.35, fontSize: 12, bold: true, color: TEXT });
    s.addText(`${label(j.source_id)} · ${j.article_count} articles`, {
      x: x + 0.2, y: y + 0.55, w: cellW - 0.4, h: 0.3, fontSize: 10, color: MUTED,
    });
  });
}

function slideUnique(pptx: PptxGenJS, c: Coverage) {
  const s = pptx.addSlide();
  addHeader(
    s, 8,
    "Unique coverage",
    `Stories only BPG ran — ${c.unique_coverage.length} in last ${c.period_days} days`
  );

  const bpgFirstPct = c.first_to_publish.total_shared > 0
    ? Math.round((c.first_to_publish.bpg_first / c.first_to_publish.total_shared) * 100)
    : 0;

  const kpis: Array<[string, string]> = [
    [String(c.unique_coverage.length), "BPG-only"],
    [String(c.shared_coverage_count), "Shared"],
    [String(c.missed_coverage.length), "Missed (competitor only)"],
    [`${bpgFirstPct}%`, "BPG-first rate"],
  ];
  kpis.forEach(([v, k], i) => {
    const x = 0.5 + i * 3.2;
    s.addShape("rect", {
      x, y: 1.8, w: 2.9, h: 1.0,
      fill: { color: SURFACE },
      line: { color: "E5E7EB", width: 1 },
    });
    s.addText(v, { x: x + 0.1, y: 1.9, w: 2.7, h: 0.5, fontSize: 24, bold: true, color: TEXT });
    s.addText(k, { x: x + 0.1, y: 2.4, w: 2.7, h: 0.3, fontSize: 10, color: MUTED });
  });

  const rows: PptxGenJS.TableRow[] = [
    [
      { text: "Date", options: { bold: true, fill: { color: SURFACE } } },
      { text: "Story", options: { bold: true, fill: { color: SURFACE } } },
      { text: "BPG sources", options: { bold: true, fill: { color: SURFACE } } },
    ],
  ];
  for (const u of c.unique_coverage.slice(0, 10)) {
    rows.push([
      { text: new Date(u.first_published_at).toLocaleDateString("en-AU"), options: { fontSize: 9 } },
      { text: u.canonical_title, options: { fontSize: 9 } },
      { text: u.sources.map(label).join(", "), options: { fontSize: 9 } },
    ]);
  }
  s.addTable(rows, {
    x: 0.5, y: 3.1, w: 12.3,
    colW: [1.4, 7.5, 3.4],
    border: { type: "solid", color: "E5E7EB", pt: 0.5 },
  });
}

function slideSpend(pptx: PptxGenJS, c: Coverage) {
  const s = pptx.addSlide();
  addHeader(
    s, 9,
    "Spend vs coverage",
    "Your advertising spend relative to editorial mentions (per publication)"
  );

  const data = c.spend_vs_coverage.map((sv) => ({
    name: label(sv.source_id),
    x: Number(sv.spend_aud),
    y: sv.article_count,
  }));

  if (data.every((d) => d.x === 0)) {
    s.addText(
      "No spend data yet — uploads via admin UI (Phase 10) populate this chart.",
      { x: 0.5, y: 1.8, w: 12.3, h: 0.5, fontSize: 12, color: MUTED },
    );
    return;
  }

  s.addChart(pptx.ChartType.scatter,
    // pptxgenjs scatter wants an X series (first) then Y series — single pair here
    [
      { name: "X-Axis", values: data.map((d) => d.x) },
      { name: "Spend vs Articles", values: data.map((d) => d.y) },
    ],
    {
      x: 0.5, y: 1.7, w: 12.3, h: 5.2,
      chartColors: [ACCENT],
      showLegend: false,
      lineSize: 0,
      catAxisTitle: "Spend (AUD)",
      showCatAxisTitle: true,
      valAxisTitle: "Articles",
      showValAxisTitle: true,
      catAxisLabelFontSize: 9,
      valAxisLabelFontSize: 9,
    },
  );
}

function slideTimeline(pptx: PptxGenJS, c: Coverage) {
  const s = pptx.addSlide();
  addHeader(s, 10, "Coverage timeline", "Weekly article counts by publication");

  // Pivot timeline into series
  const bySource = new Map<string, Map<string, number>>();
  const allWeeks = new Set<string>();
  for (const row of c.timeline || []) {
    allWeeks.add(row.week);
    const m = bySource.get(row.source_id) || new Map();
    m.set(row.week, row.articles);
    bySource.set(row.source_id, m);
  }
  const weeks = Array.from(allWeeks).sort();
  if (weeks.length === 0) {
    s.addText("No timeline data in selected period.", {
      x: 0.5, y: 1.8, w: 12.3, h: 0.5, fontSize: 12, color: MUTED,
    });
    return;
  }
  const series = Array.from(bySource.entries()).map(([src, m]) => ({
    name: label(src),
    labels: weeks,
    values: weeks.map((w) => m.get(w) || 0),
  }));

  s.addChart(pptx.ChartType.line, series, {
    x: 0.5, y: 1.7, w: 12.3, h: 5.2,
    showLegend: true,
    legendPos: "b",
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 9,
    lineSize: 2,
  });
}
