import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import PptxGenJS from "pptxgenjs";
import {
  assembleBriefData,
  deckFilename,
  formatAudCompact,
  formatPromoBand,
  insertionTotals,
  mediaCompetitorSet,
  parseSimpleMd,
  promoFootnote,
  sourceLabel,
  sovChartsBySource,
  uniqueCoverageAllZero,
  coverageVolumeRows,
  AUD,
  AUDIENCE_SEGMENTS,
  CONTENTS_ITEMS,
  DECK_COLORS,
  DEFAULT_HOST_SLUG,
  LOOKING_AHEAD_ITEMS,
  READERSHIP_QUOTES,
  READERSHIP_SOURCE_NOTE,
  READERSHIP_STATS,
  type BriefDeckData,
  formatBonusValue,
} from "@/lib/brief-deck";
import { fetchOgImageData } from "@/lib/brief-og";

/**
 * Generates the 20-slide Key Partner Annual Meeting deck (.pptx).
 *
 * Data comes from the same assembleBriefData() used by the /brief/[slug]
 * web preview, so the deck and the preview cannot drift.
 */

const NAVY = DECK_COLORS.navy;
const ACCENT = DECK_COLORS.accent;
const MUTED = DECK_COLORS.muted;
const SURFACE = DECK_COLORS.surface;
const TEXT = DECK_COLORS.text;

const PIE_COLORS = [
  "2563EB", "7C3AED", "0891B2", "D97706", "059669", "DC2626",
  "4F46E5", "0D9488", "9333EA", "CA8A04", "6B7280",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sp = request.nextUrl.searchParams;
  const brandName = sp.get("name") || slug;
  const period = parseInt(sp.get("period") || "365", 10);
  const host = sp.get("host") || DEFAULT_HOST_SLUG;

  const supabase = await createClient();
  let data: BriefDeckData;
  try {
    data = await assembleBriefData(supabase, {
      slug,
      brandName,
      period,
      host,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  const pptx = await buildDeck(data);
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  const filename = deckFilename(data.brand, data.host.slug, period);

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

async function buildDeck(d: BriefDeckData): Promise<PptxGenJS> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5"
  pptx.title = `Key Partner Brief — ${d.brand}`;
  pptx.author = "Business Publishing Group";
  pptx.company = "BPG";

  slide1Title(pptx, d);
  slide2Contents(pptx);
  slide3Readership(pptx, d);
  slide4Audience(pptx);
  slide5Team(pptx, d);
  slide6Respected(pptx);
  slide7ContentVolume(pptx, d);
  slide8TitleCard(pptx, d);
  slide9Coverage(pptx, d);
  slide10Unique(pptx, d);
  slide11Sov(pptx, d);
  slide12AdvSov(pptx, d);
  await slide13Proof(pptx, d);
  slide14AllProof(pptx, d);
  slide15Campaign(pptx, d);
  slide16CampaignYtd(pptx, d);
  slide17Recommendations(pptx, d);
  slide18Proposal(pptx, d);
  slide19LookingAhead(pptx);
  slide20ThankYou(pptx, d);

  return pptx;
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function addHeader(
  s: PptxGenJS.Slide,
  n: number,
  title: string,
  subtitle?: string
) {
  s.addText(`Slide ${n}`, {
    x: 0.5, y: 0.3, w: 2, h: 0.3, fontSize: 10, color: MUTED,
  });
  s.addText(title, {
    x: 0.5, y: 0.6, w: 12, h: 0.6, fontSize: 24, bold: true, color: TEXT,
  });
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.5, y: 1.2, w: 12, h: 0.4, fontSize: 12, color: MUTED,
    });
  }
}

function pendingText(s: PptxGenJS.Slide, text: string, y = 1.9) {
  s.addShape("rect", {
    x: 0.5, y, w: 12.3, h: 0.9,
    fill: { color: SURFACE },
    line: { color: "E5E7EB", width: 1 },
  });
  s.addText(text, {
    x: 0.8, y: y + 0.1, w: 11.7, h: 0.7, fontSize: 12, color: MUTED,
    italic: true, valign: "middle",
  });
}

function logoPlaceholder(s: PptxGenJS.Slide, x: number, y: number) {
  s.addShape("rect", {
    x, y, w: 2.6, h: 1.4,
    fill: { color: "FFFFFF", transparency: 88 },
    line: { color: "94A3B8", width: 1, dashType: "dash" },
  });
  s.addText("Partner logo", {
    x, y, w: 2.6, h: 1.4, align: "center", valign: "middle",
    fontSize: 11, color: "CBD5E1", italic: true,
  });
}

// ---------------------------------------------------------------------------
// Slides 1–20
// ---------------------------------------------------------------------------

function slide1Title(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  s.background = { color: NAVY };
  s.addText(d.host.title_name.toUpperCase(), {
    x: 0.6, y: 1.0, w: 9, h: 0.4,
    fontSize: 14, color: "93C5FD", bold: true, charSpacing: 6,
  });
  s.addText("Key Partner Annual Meeting", {
    x: 0.6, y: 1.5, w: 12, h: 1.0, fontSize: 40, bold: true, color: "FFFFFF",
  });
  s.addText(d.brand, {
    x: 0.6, y: 2.7, w: 12, h: 1.0, fontSize: 30, color: "E5E7EB",
  });
  s.addText(
    `Last ${d.period_days} days · Prepared ${new Date(d.generated_at).toLocaleDateString("en-AU")} by Business Publishing Group`,
    { x: 0.6, y: 3.8, w: 12, h: 0.4, fontSize: 12, color: "D1D5DB" }
  );
  logoPlaceholder(s, 10.1, 5.5);
}

function slide2Contents(pptx: PptxGenJS) {
  const s = pptx.addSlide();
  addHeader(s, 2, "Contents");
  CONTENTS_ITEMS.forEach((item, i) => {
    const y = 1.9 + i * 1.15;
    s.addShape("rect", {
      x: 0.5, y, w: 8.5, h: 0.95,
      fill: { color: SURFACE },
      line: { color: "E5E7EB", width: 1 },
    });
    s.addText(String(i + 1).padStart(2, "0"), {
      x: 0.8, y: y + 0.15, w: 0.9, h: 0.6, fontSize: 24, bold: true, color: ACCENT,
    });
    s.addText(item, {
      x: 1.8, y: y + 0.15, w: 6.9, h: 0.6, fontSize: 18, bold: true, color: TEXT,
      valign: "middle",
    });
  });
}

function slide3Readership(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  addHeader(s, 3, "Readership", `${d.host.title_name} audience reach`);
  READERSHIP_STATS.forEach((stat, i) => {
    const x = 0.5 + i * 4.3;
    s.addShape("rect", {
      x, y: 1.9, w: 4.0, h: 2.0,
      fill: { color: SURFACE },
      line: { color: "E5E7EB", width: 1 },
    });
    s.addText(stat.value, {
      x: x + 0.25, y: 2.1, w: 3.5, h: 0.7, fontSize: 34, bold: true, color: ACCENT,
    });
    s.addText(stat.label.toUpperCase(), {
      x: x + 0.25, y: 2.85, w: 3.5, h: 0.3, fontSize: 11, bold: true,
      color: TEXT, charSpacing: 3,
    });
    s.addText(stat.detail, {
      x: x + 0.25, y: 3.15, w: 3.5, h: 0.6, fontSize: 10, color: MUTED,
    });
  });
  READERSHIP_QUOTES.forEach((q, i) => {
    s.addText(`“${q}”`, {
      x: 0.5, y: 4.3 + i * 0.75, w: 12.3, h: 0.6,
      fontSize: 18, italic: true, color: TEXT,
    });
  });
  s.addText(READERSHIP_SOURCE_NOTE, {
    x: 0.5, y: 6.7, w: 12.3, h: 0.4, fontSize: 9, color: MUTED, italic: true,
  });
}

function slide4Audience(pptx: PptxGenJS) {
  const s = pptx.addSlide();
  addHeader(s, 4, "Our audience", "Subscriber composition (publisher-supplied)");
  s.addChart(
    pptx.ChartType.pie,
    [
      {
        name: "Audience",
        labels: AUDIENCE_SEGMENTS.map((a) => `${a.name} ${a.pct}%`),
        values: AUDIENCE_SEGMENTS.map((a) => a.pct),
      },
    ],
    {
      x: 0.5, y: 1.7, w: 12.3, h: 5.4,
      showLegend: true,
      legendPos: "r",
      legendFontSize: 10,
      showPercent: false,
      chartColors: PIE_COLORS,
    }
  );
}

function slide5Team(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  const sub =
    d.teamSource === "roster"
      ? `${d.host.title_name} bylines (derived from published articles)`
      : `The ${d.host.title_name} newsroom`;
  addHeader(s, 5, "Our editorial team", sub);

  if (d.team.length === 0) {
    pendingText(s, "Editorial roster pending — supply via Admin > Journalists.");
    return;
  }

  const cols = 4;
  const cellW = 3.0;
  const cellH = 1.3;
  d.team.slice(0, 12).forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.5 + col * (cellW + 0.2);
    const y = 1.9 + row * (cellH + 0.25);
    s.addShape("rect", {
      x, y, w: cellW, h: cellH,
      fill: { color: "FFFFFF" },
      line: { color: "E5E7EB", width: 1 },
    });
    s.addText(m.name, {
      x: x + 0.2, y: y + 0.2, w: cellW - 0.4, h: 0.4,
      fontSize: 13, bold: true, color: TEXT,
    });
    s.addText(m.role, {
      x: x + 0.2, y: y + 0.65, w: cellW - 0.4, h: 0.35,
      fontSize: 10, color: MUTED,
    });
  });
}

function slide6Respected(pptx: PptxGenJS) {
  const s = pptx.addSlide();
  addHeader(s, 6, "Respected across the industry", "What partners say");
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 6.3;
    const y = 1.9 + row * 2.5;
    s.addShape("rect", {
      x, y, w: 6.0, h: 2.2,
      fill: { color: SURFACE },
      line: { color: "E5E7EB", width: 1, dashType: "dash" },
    });
    s.addText("“ ”", {
      x: x + 0.3, y: y + 0.15, w: 1, h: 0.6, fontSize: 28, color: "CBD5E1", bold: true,
    });
    s.addText("Testimonial — TD to supply", {
      x: x + 0.3, y: y + 0.9, w: 5.4, h: 0.5, fontSize: 12, italic: true, color: MUTED,
    });
  }
}

function slide7ContentVolume(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  addHeader(
    s, 7,
    "Content volume",
    `Articles published — ${d.host.title_name} vs media competitors, last ${d.period_days} days`
  );

  const set = mediaCompetitorSet(d.host);
  const byId = new Map(d.contentVolume.map((p) => [p.source_id, p]));
  const rows = set.map((src) => ({
    name: sourceLabel(src),
    count: byId.get(src)?.article_count || 0,
  }));

  if (d.contentVolume.length === 0) {
    pendingText(s, "Content volume data pending for this period.");
    return;
  }

  s.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Articles",
        labels: rows.map((r) => r.name),
        values: rows.map((r) => r.count),
      },
    ],
    {
      x: 0.5, y: 1.7, w: 12.3, h: 4.9,
      barDir: "col",
      showLegend: false,
      chartColors: [ACCENT],
      catAxisLabelFontSize: 9,
      valAxisLabelFontSize: 9,
    }
  );
  s.addText("Social posting volumes: data pending (social capture not yet live).", {
    x: 0.5, y: 6.8, w: 12.3, h: 0.35, fontSize: 9, color: MUTED, italic: true,
  });
}

function slide8TitleCard(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  s.background = { color: NAVY };
  s.addText("PARTNER PERFORMANCE", {
    x: 0.6, y: 1.0, w: 12, h: 0.4, fontSize: 12, color: "93C5FD", bold: true, charSpacing: 6,
  });
  s.addText(d.brand, {
    x: 0.6, y: 1.5, w: 12, h: 1.1, fontSize: 48, bold: true, color: "FFFFFF",
  });
  s.addText(
    `Last ${d.period_days} days · Prepared ${new Date(d.generated_at).toLocaleDateString("en-AU")}`,
    { x: 0.6, y: 2.8, w: 12, h: 0.4, fontSize: 13, color: "D1D5DB" }
  );

  const stats: Array<[string, string, string | null]> = [
    ["Total articles", String(d.coverage.summary.total_articles), null],
    [`${d.host.title_name} coverage`, String(d.coverage.summary.bpg_articles), null],
    [
      "Promotional value",
      formatAudCompact(d.promotionalValue.mid),
      `Range ${formatPromoBand(d.promotionalValue)}`,
    ],
  ];
  stats.forEach(([k, v, sub], i) => {
    const x = 0.6 + i * 4.3;
    s.addText(v, { x, y: 4.4, w: 4.1, h: 0.8, fontSize: 32, bold: true, color: "FFFFFF" });
    s.addText(k.toUpperCase(), {
      x, y: 5.3, w: 4.1, h: 0.35, fontSize: 10, color: "D1D5DB", charSpacing: 3,
    });
    if (sub) {
      s.addText(sub, {
        x, y: 5.65, w: 4.1, h: 0.3, fontSize: 10, color: "9CA3AF",
      });
    }
  });
  s.addText(
    `Midpoint ${AUD.format(d.promotionalValue.mid)}. ${promoFootnote(d.host.title_name)}`,
    { x: 0.6, y: 6.6, w: 12.2, h: 0.5, fontSize: 9, color: "9CA3AF", italic: true }
  );
}

function slide9Coverage(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  addHeader(
    s, 9,
    "Your coverage",
    `Editorial support for ${d.brand} — last ${d.period_days} days`
  );

  // Left stat box
  const stats: Array<[string, string]> = [
    [String(d.coverage.summary.bpg_articles), "Articles"],
    ["—", "Social media posts (data pending)"],
    [String(d.coverage.events.length), "Events attended"],
    [formatPromoBand(d.promotionalValue), "Promotional value"],
  ];
  stats.forEach(([v, k], i) => {
    const y = 1.9 + i * 1.2;
    s.addShape("rect", {
      x: 0.5, y, w: 3.6, h: 1.05,
      fill: { color: SURFACE },
      line: { color: "E5E7EB", width: 1 },
    });
    s.addText(v, { x: 0.7, y: y + 0.1, w: 3.2, h: 0.5, fontSize: 20, bold: true, color: TEXT });
    s.addText(k, { x: 0.7, y: y + 0.62, w: 3.2, h: 0.35, fontSize: 9, color: MUTED });
  });

  // Right volume bars, host vs media competitors
  const rows = coverageVolumeRows(d);
  if (rows.every((r) => r.article_count === 0)) {
    s.addText("No brand coverage recorded across these publications in this period.", {
      x: 4.5, y: 3.2, w: 8.3, h: 0.5, fontSize: 12, color: MUTED, italic: true,
    });
  } else {
    s.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Articles",
          labels: rows.map((r) => sourceLabel(r.source_id) + (r.is_host ? " (host)" : "")),
          values: rows.map((r) => r.article_count),
        },
      ],
      {
        x: 4.4, y: 1.9, w: 8.4, h: 4.7,
        barDir: "col",
        showLegend: false,
        chartColors: [ACCENT],
        catAxisLabelFontSize: 9,
        valAxisLabelFontSize: 9,
      }
    );
  }
  s.addText(promoFootnote(d.host.title_name), {
    x: 0.5, y: 6.85, w: 12.3, h: 0.35, fontSize: 8, color: MUTED, italic: true,
  });
}

function slide10Unique(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  const c = d.coverage;
  addHeader(
    s, 10,
    "Unique coverage",
    `Stories only BPG ran — ${c.unique_coverage.length} in last ${c.period_days} days`
  );

  const bpgFirstPct =
    c.first_to_publish.total_shared > 0
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
      x, y: 1.9, w: 2.9, h: 1.0,
      fill: { color: SURFACE },
      line: { color: "E5E7EB", width: 1 },
    });
    s.addText(v, { x: x + 0.1, y: 2.0, w: 2.7, h: 0.5, fontSize: 24, bold: true, color: TEXT });
    s.addText(k, { x: x + 0.1, y: 2.5, w: 2.7, h: 0.3, fontSize: 10, color: MUTED });
  });

  if (uniqueCoverageAllZero(c)) {
    s.addText("Story-clustering backfill in progress — figures will populate as clusters build.", {
      x: 0.5, y: 3.2, w: 12.3, h: 0.4, fontSize: 10, color: MUTED, italic: true,
    });
    return;
  }

  const rows: PptxGenJS.TableRow[] = [
    [
      { text: "Date", options: { bold: true, fill: { color: SURFACE } } },
      { text: "Story", options: { bold: true, fill: { color: SURFACE } } },
      { text: "BPG sources", options: { bold: true, fill: { color: SURFACE } } },
    ],
  ];
  for (const u of c.unique_coverage.slice(0, 9)) {
    rows.push([
      { text: new Date(u.first_published_at).toLocaleDateString("en-AU"), options: { fontSize: 9 } },
      { text: u.canonical_title, options: { fontSize: 9 } },
      { text: u.sources.map(sourceLabel).join(", "), options: { fontSize: 9 } },
    ]);
  }
  if (rows.length > 1) {
    s.addTable(rows, {
      x: 0.5, y: 3.2, w: 12.3,
      colW: [1.4, 7.5, 3.4],
      border: { type: "solid", color: "E5E7EB", pt: 0.5 },
    });
  }
}

function slide11Sov(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  const demoTag =
    d.rivals?.source_of_truth === "demo" ? " (demo matrix)" : "";
  addHeader(
    s, 11,
    "Share of voice by category" + demoTag,
    d.rivals
      ? `${d.brand} vs ${d.rivals.rivals.join(", ")} — last ${d.period_days} days`
      : undefined
  );

  if (!d.rivals || d.rivals.rivals.length === 0) {
    pendingText(s, "Share of voice pending — TD to supply competitor matrix.");
    return;
  }

  const charts = sovChartsBySource(d);
  if (charts.length === 0) {
    pendingText(s, "No category coverage found for this competitor set in the period.");
    return;
  }

  const shown = charts.slice(0, 4);
  const cols = shown.length > 1 ? 2 : 1;
  const chartW = cols === 2 ? 6.0 : 12.3;
  const chartH = shown.length > 2 ? 2.55 : 5.0;
  shown.forEach((chart, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.5 + col * 6.3;
    const y = 1.8 + row * (chartH + 0.35);
    s.addText(sourceLabel(chart.source_id), {
      x, y: y - 0.05, w: chartW, h: 0.3, fontSize: 11, bold: true, color: TEXT,
    });
    s.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Articles",
          labels: chart.rows.map((r) => r.brand),
          values: chart.rows.map((r) => r.count),
        },
      ],
      {
        x, y: y + 0.25, w: chartW, h: chartH - 0.3,
        barDir: "bar",
        showLegend: false,
        chartColors: [ACCENT],
        catAxisLabelFontSize: 8,
        valAxisLabelFontSize: 8,
      }
    );
  });
}

function slide12AdvSov(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  addHeader(
    s, 12,
    "Share of voice — advertising presence",
    `Advertising spend by brand across ${d.host.title_name} titles, last ${d.period_days} days`
  );

  const rows = d.advertisingSov;
  if (rows.length === 0 || rows.every((r) => r.spend_aud === 0)) {
    pendingText(s, "Advertising share of voice pending — Salesforce spend import.");
    return;
  }

  s.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Spend (AUD)",
        labels: rows.map((r) => r.advertiser),
        values: rows.map((r) => r.spend_aud),
      },
    ],
    {
      x: 0.5, y: 1.7, w: 12.3, h: 4.9,
      barDir: "col",
      showLegend: false,
      chartColors: [DECK_COLORS.green],
      valAxisLabelFormatCode: '"$"#,##0',
      catAxisLabelFontSize: 9,
      valAxisLabelFontSize: 9,
    }
  );
  s.addText(
    rows.map((r) => `${r.advertiser}: ${r.insertion_periods} insertion period${r.insertion_periods === 1 ? "" : "s"}`).join("   ·   "),
    { x: 0.5, y: 6.75, w: 12.3, h: 0.4, fontSize: 9, color: MUTED }
  );
}

async function slide13Proof(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  addHeader(s, 13, "The proof", "Most recent coverage");

  const latest = [...(d.coverage.top_articles || [])]
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, 3);

  if (latest.length === 0) {
    pendingText(s, "No coverage in the selected period.");
    return;
  }

  // Fetch og:images in parallel (3s timeout each; failures fall back to cards).
  const images = await Promise.all(
    latest.map((a) => (a.url ? fetchOgImageData(a.url) : Promise.resolve(null)))
  );

  latest.forEach((a, i) => {
    const x = 0.5 + i * 4.3;
    const img = images[i];
    s.addShape("rect", {
      x, y: 1.8, w: 4.0, h: 4.9,
      fill: { color: "FFFFFF" },
      line: { color: "E5E7EB", width: 1 },
    });
    if (img) {
      s.addImage({
        data: img,
        x: x + 0.1, y: 1.9, w: 3.8, h: 2.15,
        sizing: { type: "cover", w: 3.8, h: 2.15 },
      });
    } else {
      s.addShape("rect", {
        x: x + 0.1, y: 1.9, w: 3.8, h: 2.15,
        fill: { color: NAVY },
      });
      s.addText(sourceLabel(a.source_id), {
        x: x + 0.1, y: 1.9, w: 3.8, h: 2.15,
        align: "center", valign: "middle", fontSize: 16, bold: true, color: "FFFFFF",
      });
    }
    s.addText(a.title, {
      x: x + 0.25, y: 4.2, w: 3.5, h: 1.3,
      fontSize: 11, bold: true, color: TEXT, valign: "top",
    });
    s.addText(
      `${sourceLabel(a.source_id)} · ${new Date(a.published_at).toLocaleDateString("en-AU")}`,
      { x: x + 0.25, y: 5.55, w: 3.5, h: 0.3, fontSize: 9, color: MUTED }
    );
    if (a.url) {
      s.addText("Read article", {
        x: x + 0.25, y: 5.9, w: 3.5, h: 0.3,
        fontSize: 9, color: ACCENT, underline: { style: "sng" },
        hyperlink: { url: a.url },
      });
    }
  });
}

function slide14AllProof(pptx: PptxGenJS, d: BriefDeckData) {
  const ROWS_PER_SLIDE = 25;
  const MAX_SLIDES = 8;
  const articles = d.allArticles;

  const header: PptxGenJS.TableRow = [
    { text: "Date", options: { bold: true, fill: { color: SURFACE }, fontSize: 9 } },
    { text: "Title", options: { bold: true, fill: { color: SURFACE }, fontSize: 9 } },
    { text: "Publication", options: { bold: true, fill: { color: SURFACE }, fontSize: 9 } },
  ];

  if (articles.length === 0) {
    const s = pptx.addSlide();
    addHeader(s, 14, "All the proof", "Full coverage appendix");
    pendingText(s, "No articles found for this brand in the selected period.");
    return;
  }

  const chunks: (typeof articles)[] = [];
  for (let i = 0; i < articles.length && chunks.length < MAX_SLIDES; i += ROWS_PER_SLIDE) {
    chunks.push(articles.slice(i, i + ROWS_PER_SLIDE));
  }
  const shownCount = chunks.reduce((s, c) => s + c.length, 0);
  const remaining = articles.length - shownCount;

  chunks.forEach((chunk, ci) => {
    const s = pptx.addSlide();
    addHeader(
      s, 14,
      ci === 0 ? "All the proof" : "All the proof (cont.)",
      `Full coverage appendix — ${articles.length} articles, last ${d.period_days} days`
    );
    const rows: PptxGenJS.TableRow[] = [header];
    for (const a of chunk) {
      rows.push([
        {
          text: a.published_at ? new Date(a.published_at).toLocaleDateString("en-AU") : "—",
          options: { fontSize: 7.5 },
        },
        {
          text: a.title,
          options: a.url
            ? { fontSize: 7.5, color: ACCENT, hyperlink: { url: a.url } }
            : { fontSize: 7.5 },
        },
        { text: sourceLabel(a.source_id), options: { fontSize: 7.5 } },
      ]);
    }
    s.addTable(rows, {
      x: 0.5, y: 1.7, w: 12.3,
      colW: [1.3, 8.9, 2.1],
      border: { type: "solid", color: "E5E7EB", pt: 0.5 },
      rowH: 0.19,
    });
    if (ci === chunks.length - 1 && remaining > 0) {
      s.addText(`+${remaining} further articles in the full export.`, {
        x: 0.5, y: 7.05, w: 12.3, h: 0.3, fontSize: 9, color: MUTED, italic: true,
      });
    }
  });
}

const INSERTION_HEADER: PptxGenJS.TableRow = [
  { text: "Date", options: { bold: true, fill: { color: SURFACE }, fontSize: 9 } },
  { text: "Publication", options: { bold: true, fill: { color: SURFACE }, fontSize: 9 } },
  { text: "Ad type", options: { bold: true, fill: { color: SURFACE }, fontSize: 9 } },
  { text: "Page position", options: { bold: true, fill: { color: SURFACE }, fontSize: 9 } },
  { text: "Est. readership", options: { bold: true, fill: { color: SURFACE }, fontSize: 9 } },
  { text: "Clicks", options: { bold: true, fill: { color: SURFACE }, fontSize: 9 } },
];

function insertionCells(i: {
  run_date: string;
  source_id: string;
  ad_type: string | null;
  page_position: string | null;
  est_readership: number | null;
  clicks: number | null;
}): PptxGenJS.TableRow {
  return [
    { text: new Date(i.run_date).toLocaleDateString("en-AU"), options: { fontSize: 8 } },
    { text: sourceLabel(i.source_id), options: { fontSize: 8 } },
    { text: i.ad_type || "—", options: { fontSize: 8 } },
    { text: i.page_position || "—", options: { fontSize: 8 } },
    { text: i.est_readership != null ? Number(i.est_readership).toLocaleString("en-AU") : "—", options: { fontSize: 8 } },
    { text: i.clicks != null ? Number(i.clicks).toLocaleString("en-AU") : "—", options: { fontSize: 8 } },
  ];
}

function slide15Campaign(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  addHeader(s, 15, "Most recent campaign");

  if (!d.latestCampaign) {
    pendingText(s, "Campaign data pending — campaign report import (Admin > Campaigns).");
    return;
  }

  const { campaign, insertions } = d.latestCampaign;
  const t = insertionTotals(insertions);
  const periodStr = [campaign.period_start, campaign.period_end]
    .filter(Boolean)
    .map((x) => new Date(x as string).toLocaleDateString("en-AU"))
    .join(" – ");
  s.addText(`${campaign.name}${periodStr ? ` · ${periodStr}` : ""}`, {
    x: 0.5, y: 1.2, w: 12.3, h: 0.4, fontSize: 13, bold: true, color: TEXT,
  });

  const kpis: Array<[string, string]> = [
    [String(t.advertisements), "Advertisements"],
    [t.clicks.toLocaleString("en-AU"), "Click-thrus"],
    [t.ctrPct != null ? `${t.ctrPct.toFixed(2)}%` : "—", "CTR"],
    [campaign.estimated_reach != null ? Number(campaign.estimated_reach).toLocaleString("en-AU") : "—", "Estimated reach"],
    [campaign.spend_aud != null ? formatAudCompact(Number(campaign.spend_aud)) : "—", "Spend"],
    [formatBonusValue(campaign.bonus_ad_value, formatAudCompact), "Bonus ad value"],
  ];
  kpis.forEach(([v, k], i) => {
    const x = 0.5 + i * 2.13;
    s.addShape("rect", {
      x, y: 1.75, w: 1.98, h: 0.95,
      fill: { color: SURFACE },
      line: { color: "E5E7EB", width: 1 },
    });
    s.addText(v, { x: x + 0.1, y: 1.83, w: 1.8, h: 0.45, fontSize: 15, bold: true, color: TEXT });
    s.addText(k, { x: x + 0.1, y: 2.3, w: 1.8, h: 0.3, fontSize: 8, color: MUTED });
  });

  const rows: PptxGenJS.TableRow[] = [INSERTION_HEADER];
  for (const i of insertions.slice(0, 14)) rows.push(insertionCells(i));
  if (insertions.length === 0) {
    rows.push([
      { text: "No insertions recorded for this campaign yet.", options: { fontSize: 9, colspan: 6, color: MUTED } },
    ]);
  }
  s.addTable(rows, {
    x: 0.5, y: 2.95, w: 12.3,
    colW: [1.5, 2.6, 2.4, 2.4, 1.9, 1.5],
    border: { type: "solid", color: "E5E7EB", pt: 0.5 },
  });
  if (insertions.length > 14) {
    s.addText(`+${insertions.length - 14} further insertions.`, {
      x: 0.5, y: 7.05, w: 12.3, h: 0.3, fontSize: 9, color: MUTED, italic: true,
    });
  }
}

function slide16CampaignYtd(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  const year = new Date().getFullYear();
  addHeader(s, 16, "Campaign reports — YTD", `All insertions across campaigns, ${year}`);

  if (d.ytdInsertions.length === 0) {
    pendingText(s, "Campaign data pending — campaign report import (Admin > Campaigns).");
    return;
  }

  const t = insertionTotals(d.ytdInsertions);
  s.addText(
    `${t.advertisements} advertisements · ${t.clicks.toLocaleString("en-AU")} click-thrus · ${t.ctrPct != null ? t.ctrPct.toFixed(2) + "% CTR" : "CTR —"}`,
    { x: 0.5, y: 1.25, w: 12.3, h: 0.35, fontSize: 12, bold: true, color: TEXT }
  );

  const header: PptxGenJS.TableRow = [
    ...INSERTION_HEADER,
    { text: "Notes", options: { bold: true, fill: { color: SURFACE }, fontSize: 9 } },
  ];
  const rows: PptxGenJS.TableRow[] = [header];
  for (const i of d.ytdInsertions.slice(0, 16)) {
    rows.push([
      ...insertionCells(i),
      { text: i.notes || "—", options: { fontSize: 8 } },
    ]);
  }
  s.addTable(rows, {
    x: 0.5, y: 1.75, w: 12.3,
    colW: [1.3, 2.2, 1.9, 1.9, 1.6, 1.1, 2.3],
    border: { type: "solid", color: "E5E7EB", pt: 0.5 },
  });
  if (d.ytdInsertions.length > 16) {
    s.addText(`+${d.ytdInsertions.length - 16} further insertions this year.`, {
      x: 0.5, y: 7.05, w: 12.3, h: 0.3, fontSize: 9, color: MUTED, italic: true,
    });
  }
}

function slide17Recommendations(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  addHeader(s, 17, "Optimisation & recommendations", `Prepared for ${d.brand}`);

  if (!d.recommendationsMd) {
    pendingText(
      s,
      "Recommendations to be tailored ahead of the meeting — add them on the brief preview page (slide 17 editor)."
    );
    return;
  }

  const blocks = parseSimpleMd(d.recommendationsMd);
  let y = 1.8;
  for (const b of blocks) {
    if (y > 6.8) break;
    if (b.type === "p") {
      s.addText(b.text, {
        x: 0.5, y, w: 12.3, h: 0.45, fontSize: 13, color: TEXT,
      });
      y += 0.5;
    } else {
      for (const item of b.items) {
        if (y > 6.8) break;
        s.addText(item, {
          x: 0.7, y, w: 12.1, h: 0.4, fontSize: 12, color: TEXT,
          bullet: { code: "2022" },
        });
        y += 0.42;
      }
      y += 0.15;
    }
  }
}

function slide18Proposal(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  addHeader(s, 18, "Proposal");
  s.addShape("rect", {
    x: 0.5, y: 1.9, w: 12.3, h: 4.6,
    fill: { color: SURFACE },
    line: { color: "E5E7EB", width: 1, dashType: "dash" },
  });
  s.addText("Proposal — TD to supply", {
    x: 0.5, y: 3.6, w: 12.3, h: 0.8, align: "center",
    fontSize: 20, italic: true, color: MUTED,
  });
  s.addText(`Commercial proposal for ${d.brand} to be inserted before the meeting.`, {
    x: 0.5, y: 4.4, w: 12.3, h: 0.4, align: "center", fontSize: 11, color: MUTED,
  });
}

function slide19LookingAhead(pptx: PptxGenJS) {
  const s = pptx.addSlide();
  addHeader(s, 19, "Looking ahead");
  LOOKING_AHEAD_ITEMS.forEach((item, i) => {
    const y = 1.9 + i * 1.2;
    s.addShape("rect", {
      x: 0.5, y, w: 12.3, h: 1.0,
      fill: { color: SURFACE },
      line: { color: "E5E7EB", width: 1 },
    });
    s.addText(item.title, {
      x: 0.8, y: y + 0.12, w: 4.6, h: 0.5, fontSize: 15, bold: true, color: TEXT,
    });
    s.addText(item.detail, {
      x: 5.5, y: y + 0.12, w: 7.0, h: 0.75, fontSize: 11, color: MUTED, valign: "middle",
    });
  });
}

function slide20ThankYou(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  s.background = { color: NAVY };
  s.addText("Thank you for your partnership", {
    x: 0.6, y: 2.6, w: 12, h: 1.0, fontSize: 40, bold: true, color: "FFFFFF",
  });
  s.addText(`${d.host.title_name} × ${d.brand}`, {
    x: 0.6, y: 3.7, w: 12, h: 0.5, fontSize: 16, color: "D1D5DB",
  });
  logoPlaceholder(s, 10.1, 5.5);
}
