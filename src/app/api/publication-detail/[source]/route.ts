import { createClient } from "@/lib/supabase/server";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_MONTHS = new Set([12, 24, 60, 240]);
const PAGE_LIMIT = 50;

interface TrendRpcRow {
  month: string;
  brand_id: number | string | null;
  brand: string;
  articles: number | string;
}

interface BrandRpcRow {
  brand_id: number | string | null;
  brand: string;
  entity_type: string;
  articles: number | string;
  title_articles: number | string;
  share_pct: number | string | null;
  total_count: number | string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source: rawSource } = await params;
  const source = decodeURIComponent(rawSource);
  const sp = request.nextUrl.searchParams;

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

  // Pagination offset ≥ 0, default 0.
  let offset = 0;
  const offsetParam = sp.get("offset");
  if (offsetParam !== null) {
    const parsed = Number(offsetParam);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return NextResponse.json(
        { error: "offset must be a non-negative integer" },
        { status: 400 }
      );
    }
    offset = parsed;
  }

  const supabase = await createClient();

  async function fetchBrands() {
    const { data, error } = await supabase.rpc("publication_brands", {
      p_source: source,
      p_months: months,
      p_limit: PAGE_LIMIT,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    const rows = (data || []) as BrandRpcRow[];
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const brands = rows.map((r) => ({
      brand_id: r.brand_id == null ? null : Number(r.brand_id),
      brand: r.brand,
      entity_type: r.entity_type,
      articles: Number(r.articles),
      title_articles: Number(r.title_articles),
      share_pct: r.share_pct == null ? null : Number(r.share_pct),
    }));
    return { brands, total };
  }

  try {
    // Subsequent pages only need more brands.
    if (offset > 0) {
      const { brands, total } = await fetchBrands();
      return NextResponse.json({ brands, total });
    }

    // First page: trend + first brand page in parallel.
    const [trendRes, brandsRes] = await Promise.all([
      supabase.rpc("publication_brand_trend", {
        p_source: source,
        p_months: months,
      }),
      fetchBrands(),
    ]);

    if (trendRes.error) throw new Error(trendRes.error.message);

    const trend = ((trendRes.data || []) as TrendRpcRow[]).map((r) => ({
      month: r.month,
      brand_id: r.brand_id == null ? null : Number(r.brand_id),
      brand: r.brand,
      articles: Number(r.articles),
    }));

    return NextResponse.json({
      source,
      trend,
      brands: brandsRes.brands,
      total: brandsRes.total,
      months,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
