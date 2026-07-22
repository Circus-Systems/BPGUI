import { createClient } from "@/lib/supabase/server";
import { decodeHtmlEntities } from "@/lib/brief-deck";
import { VERTICAL_SOURCES, SOURCE_LABELS } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";
import { toCsvResponse, type CsvCell } from "../_lib/csv";

// Up to 30 sequential 1000-row chunks (cold) can exceed the default duration.
export const maxDuration = 60;

// PostgREST caps EVERY response at max-rows=1000, so .range() pages must be 1000
// wide (range(i, i+999)); a wider range silently truncates to the first 1000.
const PAGE_SIZE = 1000;
const ROW_CEILING = 30000;

/** Add one day to a YYYY-MM-DD date string, returning YYYY-MM-DD. */
function plusOneDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for well-formed AND possible dates (rejects 2026-02-31 etc.). */
function isValidYmd(ymd: string): boolean {
  if (!YMD_RE.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

interface ArticleRow {
  source_id: string;
  title: string | null;
  url: string;
  author_name: string | null;
  published_at: string | null;
  word_count: number | null;
  is_sponsored: number | string;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vertical = (params.get("vertical") || "travel") as VerticalCode;
  const search = params.get("search") || "";
  const sourcesParam = params.get("sources") || params.get("source") || "";
  const days = parseInt(params.get("days") || "0", 10);
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const sponsored = params.get("sponsored") || "all";

  const verticalSources = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;
  const selected = sourcesParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && (verticalSources as readonly string[]).includes(s));
  const filterSources = selected.length > 0 ? selected : [...verticalSources];

  // Validate date params up front (mirrors /api/articles).
  if (from || to) {
    if ((from && !isValidYmd(from)) || (to && !isValidYmd(to))) {
      return NextResponse.json({ error: "Invalid from/to date" }, { status: 400 });
    }
    if (from && to && from > to) {
      return NextResponse.json({ error: "from must be <= to" }, { status: 400 });
    }
  }

  const supabase = await createClient();

  /** Build the base filtered query (without range) — reused per page. */
  function baseQuery() {
    let query = supabase
      .from("articles")
      .select(
        "source_id, title, url, author_name, published_at, word_count, is_sponsored"
      )
      .in("source_id", filterSources)
      .order("published_at", { ascending: false });

    // Date filters. published_at is TEXT holding ISO timestamps, so
    // lexicographic gte/lt comparisons on ISO strings are correct.
    if (from || to) {
      if (from) query = query.gte("published_at", from);
      if (to) query = query.lt("published_at", plusOneDay(to));
    } else if (days > 0) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      query = query.gte("published_at", cutoff.toISOString());
    }

    // Sponsored filter.
    if (sponsored === "yes") {
      query = query.eq("is_sponsored", 1);
    } else if (sponsored === "no") {
      query = query.eq("is_sponsored", 0);
    }

    // Search filter. Strip PostgREST or() metacharacters to avoid 500 / injection.
    if (search) {
      const safe = search.replace(/[,()]/g, " ").trim();
      if (safe) {
        query = query.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%`);
      }
    }

    return query;
  }

  try {
    // Page through the filtered set until a short page or the row ceiling.
    const all: ArticleRow[] = [];
    let offset = 0;
    while (offset < ROW_CEILING) {
      const { data, error } = await baseQuery().range(
        offset,
        offset + PAGE_SIZE - 1
      );
      if (error) throw new Error(error.message);
      const page = (data || []) as ArticleRow[];
      all.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    const capped = all.slice(0, ROW_CEILING);

    const headers = [
      "date",
      "title",
      "url",
      "publication",
      "author",
      "word_count",
      "sponsored",
    ];
    const rows: CsvCell[][] = capped.map((a) => [
      a.published_at,
      decodeHtmlEntities(a.title || ""),
      a.url,
      SOURCE_LABELS[a.source_id] || a.source_id,
      a.author_name,
      a.word_count == null ? null : Number(a.word_count),
      Number(a.is_sponsored) ? 1 : 0,
    ]);

    const date = new Date().toISOString().slice(0, 10);
    const filename = `bpg_articles_${vertical}_${date}.csv`;
    return toCsvResponse(filename, headers, rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
