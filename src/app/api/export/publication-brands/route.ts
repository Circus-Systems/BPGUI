import { createClient } from "@/lib/supabase/server";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";
import { toCsvResponse, safeSegment, type CsvCell } from "../_lib/csv";

const ALLOWED_MONTHS = new Set([12, 24, 60, 240]);
// Worst case is 3,320 rows, so a single 10k call never truncates. Chunking would
// be slower here (each chunk re-scans), so we fetch once. months=240 runs ~7s —
// close to the 8s statement timeout — so a timeout is surfaced as a 504 below.
const FETCH_LIMIT = 10000;
const ROW_CEILING = 30000;

interface BrandRpcRow {
  brand_id: number | string | null;
  brand: string;
  entity_type: string;
  articles: number | string;
  title_articles: number | string;
  share_pct: number | string | null;
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

  // Single call — see FETCH_LIMIT note above.
  const { data, error } = await supabase.rpc("publication_brands", {
    p_source: source,
    p_months: months,
    p_limit: FETCH_LIMIT,
    p_offset: 0,
  });

  if (error) {
    // Postgres statement timeout (57014) → the window is too heavy to compute.
    const isTimeout =
      error.code === "57014" || /statement timeout/i.test(error.message || "");
    if (isTimeout) {
      return NextResponse.json(
        { error: "window too large — try a shorter window" },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const capped = ((data || []) as BrandRpcRow[]).slice(0, ROW_CEILING);

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
