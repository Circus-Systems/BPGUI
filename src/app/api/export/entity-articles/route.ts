import { createClient } from "@/lib/supabase/server";
import { decodeHtmlEntities } from "@/lib/brief-deck";
import { VERTICAL_SOURCES, SOURCE_LABELS } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";
import { toCsvResponse, safeSegment, type CsvCell } from "../_lib/csv";

// Up to 30 sequential 1000-row chunks (cold) can exceed the default duration.
export const maxDuration = 60;

const ALLOWED_MONTHS = new Set([12, 24, 60, 240]);
// PostgREST caps EVERY response at max-rows=1000 project-wide, regardless of the
// RPC's p_limit. So we must page in chunks of 1000 (p_offset += 1000) and stop
// on the exact total_count carried in row 1, a short page, or the 30k ceiling.
const PAGE_SIZE = 1000;
const ROW_CEILING = 30000;

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

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const entity = (sp.get("entity") || "").trim();
  if (!entity) {
    return NextResponse.json({ error: "entity is required" }, { status: 400 });
  }

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

  const supabase = await createClient();

  try {
    // Page through entity_articles in 1000-row chunks (PostgREST max-rows cap).
    const all: ArticleRpcRow[] = [];
    let offset = 0;
    let total = Infinity;
    while (offset < ROW_CEILING) {
      const { data, error } = await supabase.rpc("entity_articles", {
        p_name: entity,
        p_sources: sources,
        p_months: months,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (error) throw new Error(error.message);
      const page = (data || []) as ArticleRpcRow[];
      if (page.length === 0) break;
      if (offset === 0) total = Number(page[0].total_count) || page.length;
      all.push(...page);
      offset += PAGE_SIZE;
      if (all.length >= total || page.length < PAGE_SIZE) break;
    }
    const capped = all.slice(0, ROW_CEILING);

    const headers = [
      "date",
      "title",
      "url",
      "publication",
      "journalist",
      "word_count",
      "headline_mention",
      "sponsored",
    ];
    const rows: CsvCell[][] = capped.map((r) => [
      r.published_at,
      decodeHtmlEntities(String(r.title || "")),
      r.url,
      SOURCE_LABELS[r.source_id] || r.source_id,
      r.author_name,
      r.word_count == null ? null : Number(r.word_count),
      Number(r.in_title) ? 1 : 0,
      Number(r.is_sponsored) ? 1 : 0,
    ]);

    const date = new Date().toISOString().slice(0, 10);
    const filename = `bpg_entity-articles_${safeSegment(entity)}_${months}mo_${date}.csv`;
    return toCsvResponse(filename, headers, rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
