import { createClient } from "@/lib/supabase/server";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";
import { toCsvResponse, safeSegment, type CsvCell } from "../_lib/csv";

// Up to 30 sequential 1000-row chunks (cold) can exceed the default duration.
export const maxDuration = 60;

const ALLOWED_MONTHS = new Set([12, 24, 60, 240]);
// PostgREST caps EVERY response at max-rows=1000 project-wide, so a single 10k
// call silently truncates (travel-daily 12mo = 1,339 brands). Page in 1000-row
// chunks, stopping on the exact total_count in row 1, a short page, or ceiling.
const PAGE_SIZE = 1000;
const ROW_CEILING = 30000;

interface BrandRpcRow {
  brand_id: number | string | null;
  brand: string;
  entity_type: string;
  articles: number | string;
  title_articles: number | string;
  share_pct: number | string | null;
  total_count: number | string;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const source = (sp.get("source") || "").trim();

  // Vertical → source slugs (defaults to travel).
  const verticalParam = (sp.get("vertical") || "travel") as VerticalCode;
  const vertical: VerticalCode = VERTICAL_SOURCES[verticalParam]
    ? verticalParam
    : "travel";
  const sources = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;

  // Source must belong to the selected vertical.
  if (!sources.includes(source)) {
    return NextResponse.json(
      { error: `source '${source}' is not in vertical '${vertical}'` },
      { status: 400 }
    );
  }

  // Window: months ∈ {12,24,60,240}, default 12.
  let months = 12;
  const monthsParam = sp.get("months");
  if (monthsParam !== null) {
    const parsed = Number(monthsParam);
    if (!ALLOWED_MONTHS.has(parsed)) {
      return NextResponse.json(
        { error: "months must be one of 12, 24, 60, 240" },
        { status: 400 }
      );
    }
    months = parsed;
  }

  const supabase = await createClient();

  // Page through publication_brands in 1000-row chunks (PostgREST max-rows cap).
  const all: BrandRpcRow[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < ROW_CEILING) {
    const { data, error } = await supabase.rpc("publication_brands", {
      p_source: source,
      p_months: months,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });

    if (error) {
      // Postgres statement timeout (57014) → the window is too heavy to compute.
      const isTimeout =
        error.code === "57014" ||
        /statement timeout/i.test(error.message || "");
      if (isTimeout) {
        return NextResponse.json(
          { error: "window too large — try a shorter window" },
          { status: 504 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const page = (data || []) as BrandRpcRow[];
    if (page.length === 0) break;
    if (offset === 0) total = Number(page[0].total_count) || page.length;
    all.push(...page);
    offset += PAGE_SIZE;
    if (all.length >= total || page.length < PAGE_SIZE) break;
  }
  const capped = all.slice(0, ROW_CEILING);

  const headers = [
    "rank",
    "brand",
    "type",
    "articles",
    "headline_articles",
    "share_pct",
  ];
  const rows: CsvCell[][] = capped.map((r, i) => [
    i + 1,
    r.brand,
    r.entity_type,
    Number(r.articles),
    Number(r.title_articles),
    r.share_pct == null ? null : Number(r.share_pct),
  ]);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `bpg_publication-brands_${safeSegment(source)}_${months}mo_${date}.csv`;
  return toCsvResponse(filename, headers, rows);
}
