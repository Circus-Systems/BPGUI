import { createClient } from "@/lib/supabase/server";
import { decodeHtmlEntities } from "@/lib/brief-deck";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_MONTHS = new Set([12, 24, 60, 240]);
const PAGE_LIMIT = 50;

interface TrendRpcRow {
  month: string;
  source_id: string;
  articles: number | string;
  title_articles: number | string;
}

interface ArticleRpcRow {
  published_at: string;
  source_id: string;
  title: string | null;
  url: string;
  word_count: number | string | null;
  author_name: string | null;
  in_title: number | string;
  is_sponsored: number | string;
  total_count: number | string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const entityName = decodeURIComponent(name);
  const sp = request.nextUrl.searchParams;

  // Vertical → source slugs (defaults to travel).
  const verticalParam = (sp.get("vertical") || "travel") as VerticalCode;
  const vertical: VerticalCode = VERTICAL_SOURCES[verticalParam]
    ? verticalParam
    : "travel";
  const sources = [...(VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel)];

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

  async function fetchArticles() {
    const { data, error } = await supabase.rpc("entity_articles", {
      p_name: entityName,
      p_sources: sources,
      p_months: months,
      p_limit: PAGE_LIMIT,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    const rows = (data || []) as ArticleRpcRow[];
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const articles = rows.map((r) => ({
      published_at: r.published_at,
      source_id: r.source_id,
      title: decodeHtmlEntities(String(r.title || "")),
      url: r.url,
      word_count: r.word_count == null ? null : Number(r.word_count),
      author_name: r.author_name,
      in_title: Number(r.in_title),
      is_sponsored: Number(r.is_sponsored),
    }));
    return { articles, total };
  }

  try {
    // Subsequent pages only need more articles.
    if (offset > 0) {
      const { articles, total } = await fetchArticles();
      return NextResponse.json({ articles, total });
    }

    // First page: trend + first article page in parallel.
    const [trendRes, articlesRes] = await Promise.all([
      supabase.rpc("entity_monthly_trend", {
        p_name: entityName,
        p_sources: sources,
        p_months: months,
      }),
      fetchArticles(),
    ]);

    if (trendRes.error) throw new Error(trendRes.error.message);

    const trend = ((trendRes.data || []) as TrendRpcRow[]).map((r) => ({
      month: r.month,
      source_id: r.source_id,
      articles: Number(r.articles),
      title_articles: Number(r.title_articles),
    }));

    return NextResponse.json({
      name: entityName,
      trend,
      articles: articlesRes.articles,
      total: articlesRes.total,
      months,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
