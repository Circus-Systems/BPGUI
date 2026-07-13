// Server-only PPTX builder for the 20-slide Key Partner Annual Meeting deck.
//
// VISUAL PARITY (2026-07): the deck is styled to be indistinguishable from the
// Travel Daily–designed template ("Key Partner Meeting Presentation" PDF):
//  - The 10 fully-static template slides (1–6, 17–20) are embedded as
//    full-bleed renders of the actual TD pages (public/brief-assets/sNN.jpg,
//    2880×1620 @ ~200dpi), with dynamic overlays where needed: the partner
//    name over the template's "Partner logo" placeholder (S1/S20) and the
//    saved recommendations on S17's intentionally blank canvas.
//  - The 10 data slides (7–16) are typeset in the template's own design
//    system, pixel-sampled from the PDF: Calibri Bold 40pt headings in navy
//    #191545 at (0.68", 0.5"), DM Sans–style subtitles in #545454 13.5pt,
//    the classic chart trio #40699C/#F1DCDB/#EBF0DE, #4F81BC table borders,
//    and the circular TD logo bottom-right.
// Data comes from the same assembleBriefData() used by the web preview.
import PptxGenJS from "pptxgenjs";
import {
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
  DECK_COLORS,
  type BriefDeckData,
  formatBonusValue,
} from "@/lib/brief-deck";
import { fetchOgImageData } from "@/lib/brief-og";

// ---------------------------------------------------------------------------
// Template design system (pixel-sampled from the TD PDF — do not eyeball-edit)
// ---------------------------------------------------------------------------

const NAVY = DECK_COLORS.navy; // 181545
const INK = DECK_COLORS.accent; // 191545 heading ink
const SUB = DECK_COLORS.muted; // 545454 subtitle gray
const TBL = DECK_COLORS.tableBlue; // 4F81BC table borders
const TILE = DECK_COLORS.surface; // FAFAFA stat tiles
const TILE_BORDER = "E7E7E7";
const FONT = "Calibri";
const CHART_TRIO = [DECK_COLORS.chartNavy, DECK_COLORS.chartBlush, DECK_COLORS.chartSage];
const CHART_MORE = [...CHART_TRIO, "8FA3C8", "C9AB9C", "A3B18A", "6B7280"];

const PAGE_W = 13.333;
const PAGE_H = 7.5;

// "Partner logo" placeholder geometry on S1/S20 (from the PDF text layer)
const PARTNER_BOX = { x: 4.66, y: 5.24, w: 4.0, h: 0.95 };

export interface BuildDeckOptions {
  /** Origin to fetch template page renders from (e.g. request.nextUrl.origin). */
  assetOrigin?: string;
}

// Module-level cache: template pages are identical for every deck.
const assetCache = new Map<string, string>();

async function templateAsset(origin: string | undefined, name: string): Promise<string | null> {
  if (!origin) return null;
  const key = `${origin}/${name}`;
  if (assetCache.has(key)) return assetCache.get(key)!;
  try {
    const r = await fetch(`${origin}/brief-assets/${name}`, { cache: "force-cache" });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = name.endsWith(".png") ? "png" : "jpeg";
    const uri = `data:image/${mime};base64,${buf.toString("base64")}`;
    assetCache.set(key, uri);
    return uri;
  } catch {
    return null;
  }
}

export async function buildDeck(d: BriefDeckData, opts: BuildDeckOptions = {}): Promise<PptxGenJS> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5"
  pptx.title = `Key Partner Brief — ${d.brand}`;
  pptx.author = "Business Publishing Group";
  pptx.company = "BPG";
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

  const origin = opts.assetOrigin;
  const pages: Record<number, string | null> = {};
  await Promise.all(
    [1, 2, 3, 4, 5, 6, 17, 18, 19, 20].map(async (n) => {
      pages[n] = await templateAsset(origin, `s${String(n).padStart(2, "0")}.jpg`);
    })
  );
  const logo = await templateAsset(origin, "td-logo-circle.png");

  slideTemplate(pptx, pages[1], (s) => overlayPartnerName(s, d.brand), navyFallback(d, "Key Partner Annual Meeting"));
  slideTemplate(pptx, pages[2], undefined, whiteFallback("Contents"));
  slideTemplate(pptx, pages[3], undefined, whiteFallback("Readership"));
  slideTemplate(pptx, pages[4], undefined, whiteFallback("Audience"));
  slideTemplate(pptx, pages[5], undefined, whiteFallback("Our Editorial Team"));
  slideTemplate(pptx, pages[6], undefined, whiteFallback("Respected"));
  slide7ContentVolume(pptx, d, logo);
  slide8TitleCard(pptx, d);
  slide9Coverage(pptx, d, logo);
  slide10Unique(pptx, d, logo);
  slide11Sov(pptx, d, logo);
  slide12AdvSov(pptx, d, logo);
  await slide13Proof(pptx, d, logo);
  slide14AllProof(pptx, d, logo);
  slide15Campaign(pptx, d, logo);
  slide16CampaignYtd(pptx, d, logo);
  slideTemplate(pptx, pages[17], (s) => overlayRecommendations(s, d), whiteFallback("Optimisation and Recommendations"));
  slideTemplate(pptx, pages[18], undefined, whiteFallback("Proposal"));
  slideTemplate(pptx, pages[19], undefined, whiteFallback("Looking Ahead"));
  slideTemplate(pptx, pages[20], (s) => overlayPartnerName(s, d.brand), navyFallback(d, "Thank you for your partnership"));

  return pptx;
}

// ---------------------------------------------------------------------------
// Template-page slides
// ---------------------------------------------------------------------------

function slideTemplate(
  pptx: PptxGenJS,
  pageUri: string | null | undefined,
  overlay?: (s: PptxGenJS.Slide) => void,
  fallback?: (s: PptxGenJS.Slide) => void
) {
  const s = pptx.addSlide();
  if (pageUri) {
    s.addImage({ data: pageUri, x: 0, y: 0, w: PAGE_W, h: PAGE_H });
    overlay?.(s);
  } else {
    fallback?.(s);
    overlay?.(s);
  }
}

/** Cover the template's italic "Partner logo" placeholder with the brand name. */
function overlayPartnerName(s: PptxGenJS.Slide, brand: string) {
  s.addShape("rect", {
    x: PARTNER_BOX.x, y: PARTNER_BOX.y, w: PARTNER_BOX.w, h: PARTNER_BOX.h,
    fill: { color: NAVY },
  });
  s.addText(brand, {
    x: 1.67, y: PARTNER_BOX.y, w: 10, h: PARTNER_BOX.h,
    align: "center", valign: "middle",
    fontFace: FONT, fontSize: brand.length > 22 ? 28 : 36,
    bold: true, italic: true, color: "FFFFFF",
  });
}

/** S17 — typeset the saved recommendations onto the template's blank canvas. */
function overlayRecommendations(s: PptxGenJS.Slide, d: BriefDeckData) {
  if (!d.recommendationsMd) {
    s.addText(
      `Recommendations for ${d.brand} are being prepared by the ${d.host.title_name} team and will be presented at the meeting.`,
      { x: 0.68, y: 1.7, w: 12, h: 0.5, fontFace: FONT, fontSize: 13.5, italic: true, color: SUB }
    );
    return;
  }
  const blocks = parseSimpleMd(d.recommendationsMd);
  let y = 1.7;
  for (const b of blocks) {
    if (y > 6.9) break;
    if (b.type === "p") {
      s.addText(b.text, { x: 0.68, y, w: 12.2, h: 0.45, fontFace: FONT, fontSize: 13.5, color: "3A3A3A" });
      y += 0.5;
    } else {
      for (const item of b.items) {
        if (y > 6.9) break;
        s.addText(item, {
          x: 0.9, y, w: 12.0, h: 0.4, fontFace: FONT, fontSize: 12.5, color: "3A3A3A",
          bullet: { code: "2022" },
        });
        y += 0.42;
      }
      y += 0.12;
    }
  }
}

// Fallbacks only fire if the template renders can't be fetched (broken deploy).
function navyFallback(d: BriefDeckData, line: string) {
  return (s: PptxGenJS.Slide) => {
    s.background = { color: NAVY };
    s.addText(d.host.title_name.toUpperCase(), {
      x: 0, y: 2.2, w: PAGE_W, h: 0.5, align: "center",
      fontFace: FONT, fontSize: 20, bold: true, color: "FFFFFF", charSpacing: 4,
    });
    s.addText(line, {
      x: 0, y: 3.0, w: PAGE_W, h: 0.9, align: "center",
      fontFace: FONT, fontSize: 40, bold: true, color: "FFFFFF",
    });
  };
}

function whiteFallback(title: string) {
  return (s: PptxGenJS.Slide) => addHeading(s, title);
}

// ---------------------------------------------------------------------------
// Shared typography for the data slides (matches the template system)
// ---------------------------------------------------------------------------

function addHeading(s: PptxGenJS.Slide, title: string, subtitle?: string, italicSub = false) {
  s.addText(title, {
    x: 0.68, y: 0.42, w: 12.2, h: 0.9,
    fontFace: FONT, fontSize: 40, bold: true, color: INK,
  });
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.68, y: 1.5, w: 12.2, h: 0.38,
      fontFace: FONT, fontSize: 13.5, color: SUB, italic: italicSub,
    });
  }
}

function addLogo(s: PptxGenJS.Slide, logo: string | null) {
  if (logo) {
    s.addImage({ data: logo, x: 12.25, y: 6.42, w: 0.88, h: 0.88 });
  }
}

function pendingLine(s: PptxGenJS.Slide, text: string, y = 2.0) {
  s.addText(text, {
    x: 0.68, y, w: 12.2, h: 0.4, fontFace: FONT, fontSize: 13.5, italic: true, color: SUB,
  });
}

const CHART_BASE = {
  chartColors: CHART_TRIO,
  showLegend: true,
  legendPos: "b" as const,
  legendFontFace: FONT,
  legendFontSize: 11,
  catAxisLabelFontFace: FONT,
  catAxisLabelFontSize: 11,
  catAxisLabelColor: "595959",
  valAxisLabelFontFace: FONT,
  valAxisLabelFontSize: 10,
  valAxisLabelColor: "595959",
  valGridLine: { color: "D9D9D9", style: "solid" as const, size: 0.5 },
  catGridLine: { style: "none" as const },
  showValue: true,
  dataLabelFontFace: FONT,
  dataLabelFontSize: 10,
  dataLabelColor: "595959",
  chartColorsOpacity: 100,
  barGapWidthPct: 60,
};

function chartTitleText(s: PptxGenJS.Slide, text: string, x: number, y: number, w: number) {
  s.addText(text, {
    x, y, w, h: 0.32, align: "center",
    fontFace: FONT, fontSize: 12, bold: true, color: "595959",
  });
}

// ---------------------------------------------------------------------------
// S7 — Content Volume (template layout: heading, italic line, grouped bars)
// ---------------------------------------------------------------------------

function slide7ContentVolume(pptx: PptxGenJS, d: BriefDeckData, logo: string | null) {
  const s = pptx.addSlide();
  const set = mediaCompetitorSet(d.host);
  const byId = new Map(d.contentVolume.map((p) => [p.source_id, p]));
  const rows = set.map((src) => ({
    name: sourceLabel(src),
    count: byId.get(src)?.article_count || 0,
  }));
  const host = rows[0];
  const rivalsSorted = rows.slice(1).sort((a, b) => b.count - a.count);
  const leads = host && rivalsSorted[0] && host.count > rivalsSorted[0].count;

  addHeading(
    s, "Content Volume",
    leads
      ? `${d.host.title_name} produces more articles than any other tracked ${d.host.vertical} trade publication`
      : `Articles published — ${d.host.title_name} vs media competitors, last ${d.period_days} days`,
    true
  );

  if (d.contentVolume.length === 0) {
    pendingLine(s, "Content volume data pending for this period.");
    addLogo(s, logo);
    return;
  }

  chartTitleText(s, "Volume LTM", 0.68, 1.95, 11.4);
  s.addChart(
    pptx.ChartType.bar,
    rows.map((r) => ({ name: r.name, labels: ["Articles"], values: [r.count] })),
    {
      ...CHART_BASE,
      x: 0.9, y: 2.3, w: 11.0, h: 4.4,
      barDir: "col",
      chartColors: CHART_MORE.slice(0, rows.length),
    }
  );
  s.addText("Social posting volumes: data pending (social capture not yet live).", {
    x: 0.68, y: 6.95, w: 11.4, h: 0.3, fontFace: FONT, fontSize: 9, color: SUB, italic: true,
  });
  addLogo(s, logo);
}

// ---------------------------------------------------------------------------
// S8 — Partner performance interstitial (navy, template title-slide language)
// ---------------------------------------------------------------------------

function slide8TitleCard(pptx: PptxGenJS, d: BriefDeckData) {
  const s = pptx.addSlide();
  s.background = { color: NAVY };
  s.addText(d.host.title_name.toUpperCase(), {
    x: 0, y: 1.15, w: PAGE_W, h: 0.4, align: "center",
    fontFace: FONT, fontSize: 14, color: DECK_COLORS.tanLight, bold: true, charSpacing: 6,
  });
  s.addText(d.brand, {
    x: 0, y: 1.75, w: PAGE_W, h: 1.05, align: "center",
    fontFace: FONT, fontSize: 48, bold: true, color: "FFFFFF",
  });
  s.addText(
    `Last ${d.period_days} days · Prepared ${new Date(d.generated_at).toLocaleDateString("en-AU")} by Business Publishing Group`,
    { x: 0, y: 2.95, w: PAGE_W, h: 0.4, align: "center", fontFace: FONT, fontSize: 13, color: "C9C7DD" }
  );

  const stats: Array<[string, string, string | null]> = [
    ["Total articles", String(d.coverage.summary.total_articles), null],
    ["Coverage across our titles", String(d.coverage.summary.bpg_articles), null],
    ["Promotional value", formatAudCompact(d.promotionalValue.mid), `Range ${formatPromoBand(d.promotionalValue)}`],
  ];
  stats.forEach(([k, v, sub], i) => {
    const x = 1.1 + i * 3.9;
    s.addText(v, {
      x, y: 4.15, w: 3.5, h: 0.85, align: "center",
      fontFace: FONT, fontSize: 36, bold: true, color: "FFFFFF",
    });
    s.addText(k.toUpperCase(), {
      x, y: 5.05, w: 3.5, h: 0.32, align: "center",
      fontFace: FONT, fontSize: 10.5, color: "C9C7DD", charSpacing: 3,
    });
    if (sub) {
      s.addText(sub, {
        x, y: 5.4, w: 3.5, h: 0.3, align: "center", fontFace: FONT, fontSize: 10, color: "9B98BC",
      });
    }
  });
  s.addText(`Midpoint ${AUD.format(d.promotionalValue.mid)}. ${promoFootnote(d.host.title_name)}`, {
    x: 0.9, y: 6.65, w: 11.5, h: 0.5, align: "center",
    fontFace: FONT, fontSize: 9, color: "8B88AE", italic: true,
  });
}

// ---------------------------------------------------------------------------
// S9 — Coverage (template layout: navy rounded box left, Volume LTM right)
// ---------------------------------------------------------------------------

function slide9Coverage(pptx: PptxGenJS, d: BriefDeckData, logo: string | null) {
  const s = pptx.addSlide();
  addHeading(s, "Coverage", "We have amplified your brand across our newsletter, social media and website");

  // Left navy rounded box with the headline stats (template S9). Headline
  // coverage joins as a fifth stat when present (0-safe); spacing adapts.
  s.addShape("roundRect", {
    x: 0.68, y: 2.0, w: 3.85, h: 4.85, rectRadius: 0.18,
    fill: { color: NAVY },
  });
  const stats: Array<[string, string]> = [
    [String(d.coverage.summary.bpg_articles), "Articles across our titles"],
    ["—", "Social Media Posts (pending)"],
    [String(d.coverage.events.length), "Events Attended"],
    [formatPromoBand(d.promotionalValue), "Promotional Value"],
  ];
  if (d.headlineCoverage) {
    stats.push([`${d.headlineCoverage.pct}%`, "Coverage in the headline"]);
  }
  const slot = 4.85 / stats.length;
  stats.forEach(([v, k], i) => {
    const y = 2.0 + i * slot + (slot - 0.82) / 2;
    s.addText(v, {
      x: 0.83, y, w: 3.55, h: 0.5, align: "center",
      fontFace: FONT, fontSize: v.length > 10 ? 16 : 24, bold: true, color: "FFFFFF",
    });
    s.addText(k, {
      x: 0.83, y: y + 0.5, w: 3.55, h: 0.3, align: "center",
      fontFace: FONT, fontSize: 11.5, color: "D8D6E8",
    });
  });

  // Right — Volume LTM, one coloured series per publication (template style).
  // BPG titles in navy tones (host darkest), competitors in the template
  // blush/sage cycle — BPG bars sum to the Articles headline.
  const rows = coverageVolumeRows(d);
  let comp = 0;
  const colorBySource = new Map<string, string>();
  for (const r of rows) {
    colorBySource.set(
      r.source_id,
      r.is_host
        ? CHART_TRIO[0]
        : r.is_bpg
          ? "8FA3C8"
          : CHART_MORE.slice(1)[comp++ % (CHART_MORE.length - 1)]
    );
  }

  if (rows.every((r) => r.article_count === 0)) {
    s.addText("No brand coverage recorded across these publications in this period.", {
      x: 5.0, y: 3.4, w: 7.8, h: 0.5, fontFace: FONT, fontSize: 12.5, color: SUB, italic: true,
    });
  } else {
    chartTitleText(s, "Volume LTM", 4.9, 2.0, 8.0);
    s.addChart(
      pptx.ChartType.bar,
      rows.map((r) => ({
        name: sourceLabel(r.source_id),
        labels: ["Articles"],
        values: [r.article_count],
      })),
      {
        ...CHART_BASE,
        x: 5.0, y: 2.35, w: 7.9, h: 3.9,
        barDir: "col",
        chartColors: rows.map((r) => colorBySource.get(r.source_id)!),
      }
    );
  }

  // "Where your coverage comes from" — compact per-source share beneath the
  // chart, coloured to match the bars, BPG titles bold (0-safe: empty → hidden).
  const mix = (d.publisherMix ?? []).slice(0, 5);
  if (mix.length > 0) {
    s.addText("Where your coverage comes from", {
      x: 5.0, y: 6.32, w: 7.9, h: 0.26, fontFace: FONT, fontSize: 10.5, bold: true, color: "595959",
    });
    const runs: PptxGenJS.TextProps[] = [];
    mix.forEach((m, i) => {
      if (i > 0) runs.push({ text: "   ·   ", options: { color: "BBBBBB", fontSize: 11 } });
      runs.push({
        text: `${sourceLabel(m.source_id)} ${m.pct}%`,
        options: {
          color: colorBySource.get(m.source_id) || CHART_MORE[i % CHART_MORE.length],
          fontSize: 11,
          bold: m.is_bpg,
        },
      });
    });
    s.addText(runs, {
      x: 5.0, y: 6.58, w: 7.9, h: 0.34, fontFace: FONT, fontSize: 11, color: "595959",
    });
  }

  s.addText(promoFootnote(d.host.title_name), {
    x: 0.68, y: 7.02, w: 11.4, h: 0.3, fontFace: FONT, fontSize: 8, color: SUB, italic: true,
  });
  addLogo(s, logo);
}

// ---------------------------------------------------------------------------
// S10 — Unique coverage (template layout: white card with four stat tiles)
// ---------------------------------------------------------------------------

function slide10Unique(pptx: PptxGenJS, d: BriefDeckData, logo: string | null) {
  const s = pptx.addSlide();
  const c = d.coverage;
  addHeading(s, "Unique Coverage", "We have amplified your brand across our newsletter, social media and website");

  const uniqueCount = c.unique_coverage_count ?? c.unique_coverage.length;
  const missedCount = c.missed_coverage_count ?? c.missed_coverage.length;
  const ftp = c.first_to_publish;
  const bpgFirstPct =
    ftp.total_shared > 0
      ? Math.round((ftp.bpg_first / ftp.total_shared) * 100)
      : 0;
  const enoughShared = ftp.total_shared >= 3;
  // Emphasis line — only when there is shared coverage to be first on (0-safe).
  const showFirstEmphasis = c.shared_coverage_count > 0 && ftp.total_shared > 0;

  // Outer card
  s.addShape("rect", {
    x: 0.75, y: 2.3, w: 11.85, h: 3.55,
    fill: { color: "FFFFFF" },
    line: { color: "DDDDDD", width: 1 },
    shadow: { type: "outer", blur: 6, offset: 1, angle: 90, color: "AAAAAA", opacity: 0.25 },
  });
  s.addText("Unique coverage", {
    x: 1.15, y: 2.55, w: 8, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: "1A1A1A",
  });
  s.addText(`Stories only BPG ran — ${uniqueCount} in last ${c.period_days} days`, {
    x: 1.15, y: 2.95, w: 9, h: 0.32, fontFace: FONT, fontSize: 11, color: "8A8A8A",
  });
  s.addShape("line", {
    x: 1.15, y: 3.45, w: 11.05, h: 0,
    line: { color: "E5E5E5", width: 0.75 },
  });

  const kpis: Array<[string, string]> = [
    [String(uniqueCount), "BPG-only"],
    [String(c.shared_coverage_count), "Shared"],
    [String(missedCount), "Missed (competitor only)"],
    [
      enoughShared ? `${bpgFirstPct}%` : "—",
      enoughShared ? "BPG-first rate" : `BPG-first rate (only ${ftp.total_shared} shared)`,
    ],
  ];
  kpis.forEach(([v, k], i) => {
    const x = 1.15 + i * 2.83;
    s.addShape("rect", {
      x, y: 3.7, w: 2.63, h: 1.75,
      fill: { color: TILE },
      line: { color: TILE_BORDER, width: 0.75 },
    });
    s.addText(v, {
      x, y: 4.0, w: 2.63, h: 0.6, align: "center",
      fontFace: FONT, fontSize: 26, bold: true, color: "1A1A1A",
    });
    s.addText(k, {
      x: x + 0.1, y: 4.7, w: 2.43, h: 0.55, align: "center",
      fontFace: FONT, fontSize: 10, color: "8A8A8A",
    });
  });

  if (uniqueCoverageAllZero(c)) {
    s.addText("Story-clustering backfill in progress — figures will populate as clusters build.", {
      x: 0.75, y: 6.1, w: 11.85, h: 0.35, fontFace: FONT, fontSize: 10, color: SUB, italic: true,
    });
  } else if (showFirstEmphasis) {
    s.addText(
      [
        { text: "First to publish ", options: { bold: true } },
        {
          text: `on ${ftp.bpg_first} of ${ftp.total_shared} stories that competitors also ran.`,
          options: {},
        },
      ],
      { x: 0.75, y: 6.1, w: 11.85, h: 0.4, fontFace: FONT, fontSize: 13, color: INK, align: "center" }
    );
  }
  addLogo(s, logo);
}

// ---------------------------------------------------------------------------
// S11 — Share of Voice by Category (template: italic claim lines + % charts)
// ---------------------------------------------------------------------------

function slide11Sov(pptx: PptxGenJS, d: BriefDeckData, logo: string | null) {
  const s = pptx.addSlide();
  const demoTag = d.rivals?.source_of_truth === "demo" ? "  (demo matrix)" : "";
  addHeading(s, "Share of Voice by Category" + demoTag);

  if (!d.rivals || d.rivals.rivals.length === 0) {
    pendingLine(s, `Share of voice pending — ${d.host.title_name} to supply the competitor matrix.`, 1.6);
    addLogo(s, logo);
    return;
  }

  const charts = sovChartsBySource(d);
  if (charts.length === 0) {
    pendingLine(s, "No category coverage found for this competitor set in the period.", 1.6);
    addLogo(s, logo);
    return;
  }

  // Italic claim lines (template S11 style), one per publication shown
  const shown = charts.slice(0, 2);
  shown.forEach((chart, i) => {
    const total = chart.rows.reduce((t, r) => t + r.count, 0) || 1;
    const sorted = [...chart.rows].sort((a, b) => b.count - a.count);
    const brandRow = chart.rows.find((r) => r.brand === d.brand) || chart.rows[0];
    const bestOther = sorted.find((r) => r.brand !== d.brand);
    let line: string;
    if (!bestOther || bestOther.count === 0) {
      line = `${d.brand} is the only brand in this set covered in ${sourceLabel(chart.source_id)} this period`;
    } else if (brandRow.count >= bestOther.count) {
      const diff = Math.round(((brandRow.count - bestOther.count) / Math.max(bestOther.count, 1)) * 100);
      line = `${d.brand} receives ${diff}% more coverage in ${sourceLabel(chart.source_id)} than your nearest competitor`;
    } else {
      const diff = Math.round(((bestOther.count - brandRow.count) / Math.max(brandRow.count, 1)) * 100);
      line = `${bestOther.brand} receives ${diff}% more coverage in ${sourceLabel(chart.source_id)} than ${d.brand}`;
    }
    s.addText(line, {
      x: 0.68, y: 1.5 + i * 0.38, w: 12.2, h: 0.36,
      fontFace: FONT, fontSize: 13.5, italic: true, color: SUB,
    });
    void total;
  });

  // Side-by-side percentage charts (template S11 composition)
  const cols = shown.length;
  const chartW = cols === 2 ? 5.85 : 9.0;
  shown.forEach((chart, i) => {
    const x = cols === 2 ? 0.75 + i * 6.15 : 2.1;
    const total = chart.rows.reduce((t, r) => t + r.count, 0) || 1;
    chartTitleText(s, `${sourceLabel(chart.source_id)} Volume LTM`, x, 2.55, chartW);
    s.addChart(
      pptx.ChartType.bar,
      chart.rows.map((r) => ({
        name: r.brand,
        labels: ["Articles"],
        values: [Math.round((r.count / total) * 1000) / 10],
      })),
      {
        ...CHART_BASE,
        x, y: 2.9, w: chartW, h: 3.9,
        barDir: "col",
        chartColors: CHART_MORE.slice(0, chart.rows.length),
        valAxisLabelFormatCode: '0"%"',
        dataLabelFormatCode: '0.#"%"',
      }
    );
  });
  addLogo(s, logo);
}

// ---------------------------------------------------------------------------
// S12 — Share of Voice by Advertising Presence
// ---------------------------------------------------------------------------

function slide12AdvSov(pptx: PptxGenJS, d: BriefDeckData, logo: string | null) {
  const s = pptx.addSlide();
  addHeading(s, "Share of Voice by Advertising Presence");

  const rows = d.advertisingSov;
  if (rows.length === 0 || rows.every((r) => r.spend_aud === 0)) {
    pendingLine(
      s,
      `${d.brand} advertising share of voice pending — Salesforce spend import (Admin › Spend).`,
      1.6
    );
    addLogo(s, logo);
    return;
  }

  const sorted = [...rows].sort((a, b) => b.spend_aud - a.spend_aud);
  const brandRow = rows.find((r) => r.advertiser === d.brand) || sorted[0];
  const bestOther = sorted.find((r) => r.advertiser !== d.brand);
  if (bestOther && bestOther.spend_aud > 0) {
    const leading = brandRow.spend_aud >= bestOther.spend_aud;
    const a = leading ? brandRow : bestOther;
    const b = leading ? bestOther : brandRow;
    const diff = Math.round(((a.spend_aud - b.spend_aud) / Math.max(b.spend_aud, 1)) * 100);
    s.addText(
      `${a.advertiser} ran ${diff}% more advertising across ${d.host.title_name} titles than ${b.advertiser}`,
      { x: 0.68, y: 1.5, w: 12.2, h: 0.36, fontFace: FONT, fontSize: 13.5, italic: true, color: SUB }
    );
  }

  s.addChart(
    pptx.ChartType.bar,
    sorted.map((r) => ({ name: r.advertiser, labels: ["Spend"], values: [r.spend_aud] })),
    {
      ...CHART_BASE,
      x: 0.9, y: 2.3, w: 11.4, h: 4.3,
      barDir: "col",
      chartColors: CHART_MORE.slice(0, sorted.length),
      valAxisLabelFormatCode: '"$"#,##0',
      dataLabelFormatCode: '"$"#,##0',
    }
  );
  s.addText(
    sorted.map((r) => `${r.advertiser}: ${r.insertion_periods} insertion period${r.insertion_periods === 1 ? "" : "s"}`).join("   ·   "),
    { x: 0.68, y: 6.85, w: 11.6, h: 0.35, fontFace: FONT, fontSize: 9, color: SUB }
  );
  addLogo(s, logo);
}

// ---------------------------------------------------------------------------
// S13 — Coverage proof (template: heading + subtitle + clippings)
// ---------------------------------------------------------------------------

async function slide13Proof(pptx: PptxGenJS, d: BriefDeckData, logo: string | null) {
  const s = pptx.addSlide();
  addHeading(s, "Coverage", "Examples of how we’ve covered your brand");

  const latest = [...(d.coverage.top_articles || [])]
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, 3);

  if (latest.length === 0) {
    pendingLine(s, "No coverage in the selected period.");
    addLogo(s, logo);
    return;
  }

  const images = await Promise.all(
    latest.map((a) => (a.url ? fetchOgImageData(a.url) : Promise.resolve(null)))
  );

  latest.forEach((a, i) => {
    const x = 0.75 + i * 4.05;
    const rawImg = images[i];
    const img = rawImg && rawImg.length > 2000 ? rawImg : null;
    s.addShape("rect", {
      x, y: 2.0, w: 3.8, h: 4.75,
      fill: { color: "FFFFFF" },
      line: { color: "DDDDDD", width: 1 },
      shadow: { type: "outer", blur: 5, offset: 1, angle: 90, color: "AAAAAA", opacity: 0.22 },
    });
    if (img) {
      s.addImage({
        data: img,
        x: x + 0.08, y: 2.08, w: 3.64, h: 2.1,
        sizing: { type: "cover", w: 3.64, h: 2.1 },
      });
    } else {
      s.addShape("rect", { x: x + 0.08, y: 2.08, w: 3.64, h: 2.1, fill: { color: NAVY } });
      s.addText(sourceLabel(a.source_id), {
        x: x + 0.08, y: 2.08, w: 3.64, h: 2.1,
        align: "center", valign: "middle", fontFace: FONT, fontSize: 16, bold: true, color: "FFFFFF",
      });
    }
    s.addText(a.title, {
      x: x + 0.2, y: 4.35, w: 3.42, h: 1.25,
      fontFace: FONT, fontSize: 11.5, bold: true, color: INK, valign: "top",
    });
    s.addText(
      `${sourceLabel(a.source_id)} · ${new Date(a.published_at).toLocaleDateString("en-AU")}`,
      { x: x + 0.2, y: 5.7, w: 3.42, h: 0.3, fontFace: FONT, fontSize: 9.5, color: SUB }
    );
    if (a.url) {
      s.addText("Read article", {
        x: x + 0.2, y: 6.05, w: 3.42, h: 0.3,
        fontFace: FONT, fontSize: 9.5, color: TBL, underline: { style: "sng" },
        hyperlink: { url: a.url },
      });
    }
  });
  addLogo(s, logo);
}

// ---------------------------------------------------------------------------
// S14 — All the proof (template: Date | Link table, blue borders)
// ---------------------------------------------------------------------------

function slide14AllProof(pptx: PptxGenJS, d: BriefDeckData, logo: string | null) {
  const ROWS_PER_SLIDE = 22;
  const MAX_SLIDES = 8;
  const articles = d.allArticles;

  const cell = (text: string, opts: object = {}) => ({
    text,
    options: { fontFace: FONT, fontSize: 8.5, color: "1A1A1A", align: "center" as const, ...opts },
  });
  const header: PptxGenJS.TableRow = [
    cell("Date", { bold: true, fontSize: 10 }),
    cell("Link", { bold: true, fontSize: 10 }),
    cell("Publication", { bold: true, fontSize: 10 }),
  ];

  if (articles.length === 0) {
    const s = pptx.addSlide();
    addHeading(s, "Coverage", "Examples of how we’ve covered your brand");
    pendingLine(s, "No articles found for this brand in the selected period.");
    addLogo(s, logo);
    return;
  }

  const chunks: (typeof articles)[] = [];
  for (let i = 0; i < articles.length && chunks.length < MAX_SLIDES; i += ROWS_PER_SLIDE) {
    chunks.push(articles.slice(i, i + ROWS_PER_SLIDE));
  }
  const shownCount = chunks.reduce((t, c) => t + c.length, 0);
  const remaining = articles.length - shownCount;

  chunks.forEach((chunk, ci) => {
    const s = pptx.addSlide();
    addHeading(
      s, "Coverage",
      ci === 0
        ? "Examples of how we’ve covered your brand"
        : `Full coverage appendix (continued) — ${articles.length} articles`
    );
    const rows: PptxGenJS.TableRow[] = [header];
    for (const a of chunk) {
      rows.push([
        cell(a.published_at ? new Date(a.published_at).toLocaleDateString("en-AU") : "—"),
        {
          text: a.title,
          options: {
            fontFace: FONT, fontSize: 8.5, align: "left" as const,
            color: TBL,
            ...(a.url ? { hyperlink: { url: a.url } } : {}),
          },
        },
        cell(sourceLabel(a.source_id)),
      ]);
    }
    s.addTable(rows, {
      x: 0.75, y: 2.0, w: 10.6,
      colW: [1.6, 7.0, 2.0],
      border: { type: "solid", color: TBL, pt: 0.75 },
      valign: "middle",
      rowH: 0.21,
    });
    if (ci === chunks.length - 1 && remaining > 0) {
      s.addText(`+${remaining} further articles in the full export.`, {
        x: 0.75, y: 7.05, w: 11.4, h: 0.3, fontFace: FONT, fontSize: 9, color: SUB, italic: true,
      });
    }
    addLogo(s, logo);
  });
}

// ---------------------------------------------------------------------------
// S15/S16 — Campaigns (template: navy rounded stat box left, table right)
// ---------------------------------------------------------------------------

const INSERTION_COLS = ["Date", "Publication", "Ad Type", "Page Position", "Estimated Readership", "Clicks"];

function insertionHeader(withNotes: boolean): PptxGenJS.TableRow {
  const cols = withNotes ? [...INSERTION_COLS, "Notes"] : INSERTION_COLS;
  return cols.map((c) => ({
    text: c,
    options: { bold: true, fontFace: FONT, fontSize: 9, color: "1A1A1A", align: "center" as const },
  }));
}

function insertionCells(i: {
  run_date: string;
  source_id: string;
  ad_type: string | null;
  page_position: string | null;
  est_readership: number | null;
  clicks: number | null;
}): PptxGenJS.TableRow {
  const c = (text: string) => ({
    text,
    options: { fontFace: FONT, fontSize: 8.5, color: "1A1A1A", align: "center" as const },
  });
  return [
    c(new Date(i.run_date).toLocaleDateString("en-AU")),
    c(sourceLabel(i.source_id)),
    c(i.ad_type || "—"),
    c(i.page_position || "—"),
    c(i.est_readership != null ? Number(i.est_readership).toLocaleString("en-AU") : "—"),
    c(i.clicks != null ? Number(i.clicks).toLocaleString("en-AU") : "—"),
  ];
}

/** Navy rounded stat box (template S15/S16 left panel). */
function campaignStatBox(
  s: PptxGenJS.Slide,
  title: string,
  pairs: Array<[string, string]>
) {
  s.addShape("roundRect", {
    x: 0.68, y: 1.85, w: 3.9, h: 5.15, rectRadius: 0.18,
    fill: { color: NAVY },
  });
  const runs: PptxGenJS.TextProps[] = [
    { text: title, options: { fontSize: 15, bold: true, color: "FFFFFF", breakLine: true, paraSpaceAfter: 12 } },
  ];
  for (const [label, value] of pairs) {
    runs.push({ text: label, options: { fontSize: 12.5, color: "D8D6E8", breakLine: true, paraSpaceBefore: 6 } });
    runs.push({ text: value, options: { fontSize: 13.5, bold: true, color: "FFFFFF", breakLine: true } });
  }
  s.addText(runs, {
    x: 0.88, y: 2.0, w: 3.5, h: 4.85,
    align: "center", valign: "top", fontFace: FONT,
  });
}

function slide15Campaign(pptx: PptxGenJS, d: BriefDeckData, logo: string | null) {
  const s = pptx.addSlide();
  addHeading(s, "Most Recent Campaign");

  if (!d.latestCampaign) {
    pendingLine(s, "Campaign data pending — campaign report import (Admin › Campaigns).", 1.6);
    addLogo(s, logo);
    return;
  }

  const { campaign, insertions } = d.latestCampaign;
  const t = insertionTotals(insertions);
  campaignStatBox(s, campaign.name, [
    ["Advertisements", String(t.advertisements)],
    ["Click-Thrus", t.clicks.toLocaleString("en-AU")],
    ["Click-Thru Rate", t.ctrPct != null ? `${t.ctrPct.toFixed(2)}%` : "—"],
    ["Estimated Reach", campaign.estimated_reach != null ? Number(campaign.estimated_reach).toLocaleString("en-AU") : "—"],
    ["Spend", campaign.spend_aud != null ? formatAudCompact(Number(campaign.spend_aud)) : "—"],
    ["Bonus Ad Value", formatBonusValue(campaign.bonus_ad_value, formatAudCompact)],
  ]);

  const rows: PptxGenJS.TableRow[] = [insertionHeader(false)];
  for (const i of insertions.slice(0, 14)) rows.push(insertionCells(i));
  if (insertions.length === 0) {
    rows.push([
      {
        text: "No insertions recorded for this campaign yet.",
        options: { fontFace: FONT, fontSize: 9, colspan: 6, color: SUB },
      },
    ]);
  }
  s.addTable(rows, {
    x: 4.85, y: 1.95, w: 8.1,
    colW: [1.15, 1.55, 1.1, 1.3, 1.8, 1.2],
    border: { type: "solid", color: TBL, pt: 0.75 },
    valign: "middle",
  });
  if (insertions.length > 14) {
    s.addText(`+${insertions.length - 14} further insertions.`, {
      x: 4.85, y: 7.05, w: 8, h: 0.3, fontFace: FONT, fontSize: 9, color: SUB, italic: true,
    });
  }
  addLogo(s, logo);
}

function slide16CampaignYtd(pptx: PptxGenJS, d: BriefDeckData, logo: string | null) {
  const s = pptx.addSlide();
  const year = new Date().getFullYear();
  addHeading(s, `Campaign Reports ${year}`);

  if (d.ytdInsertions.length === 0) {
    pendingLine(s, "Campaign data pending — campaign report import (Admin › Campaigns).", 1.6);
    addLogo(s, logo);
    return;
  }

  const t = insertionTotals(d.ytdInsertions);
  const monthName = new Date().toLocaleDateString("en-AU", { month: "long" });
  campaignStatBox(s, `YTD (January – ${monthName} ${year})`, [
    ["Advertisements", String(t.advertisements)],
    ["Click-Thrus", t.clicks.toLocaleString("en-AU")],
    ["Click-Thru Rate", t.ctrPct != null ? `${t.ctrPct.toFixed(2)}%` : "—"],
  ]);

  const rows: PptxGenJS.TableRow[] = [insertionHeader(true)];
  for (const i of d.ytdInsertions.slice(0, 16)) {
    rows.push([
      ...insertionCells(i),
      { text: i.notes || "", options: { fontFace: FONT, fontSize: 8, color: "1A1A1A", bold: !!i.notes, align: "center" as const } },
    ]);
  }
  s.addTable(rows, {
    x: 4.85, y: 1.95, w: 8.1,
    colW: [1.0, 1.35, 0.9, 1.05, 1.5, 0.9, 1.4],
    border: { type: "solid", color: TBL, pt: 0.75 },
    valign: "middle",
  });
  if (d.ytdInsertions.length > 16) {
    s.addText(`+${d.ytdInsertions.length - 16} further insertions this year.`, {
      x: 4.85, y: 7.05, w: 8, h: 0.3, fontFace: FONT, fontSize: 9, color: SUB, italic: true,
    });
  }
  addLogo(s, logo);
}
