import { createClient } from "@/lib/supabase/server";
import { decodeHtmlEntities } from "@/lib/brief-deck";
import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";
import { NextResponse, type NextRequest } from "next/server";

interface StoryFlagRow {
  key: string;
  cluster_id: number | null;
  cluster_sources: number | null;
  exclusive: boolean | null;
  is_first: boolean | null;
}

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

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vertical = (params.get("vertical") || "travel") as VerticalCode;
  const search = params.get("search") || "";
  const sourcesParam = params.get("sources") || params.get("source") || "";
  const days = parseInt(params.get("days") || "0", 10);
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const sponsored = params.get("sponsored") || "all";
  const offset = parseInt(params.get("offset") || "0", 10);
  const limit = Math.min(parseInt(params.get("limit") || "30", 10), 100);

  const verticalSources = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;
  const selected = sourcesParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && (verticalSources as readonly string[]).includes(s));
  const filterSources = selected.length > 0 ? selected : [...verticalSources];

  const supabase = await createClient();

  // Exact count only when a search term is active (counts are too slow on
  // the full 300K+ row table, but a search narrows the set enough).
  let query = supabase
    .from("articles")
    .select(
      "id, source_id, external_id, title, url, excerpt, author_name, published_at, word_count, is_sponsored, categories",
      search ? { count: "exact" } : undefined
    )
    .in("source_id", filterSources)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Date filters. published_at is TEXT holding ISO timestamps, so
  // lexicographic gte/lt comparisons on ISO strings are correct.
  if (from || to) {
    // Reject impossible dates up front (e.g. 2026-02-31 would make
    // plusOneDay throw and 500).
    if ((from && !isValidYmd(from)) || (to && !isValidYmd(to))) {
      return NextResponse.json({ error: "Invalid from/to date" }, { status: 400 });
    }
    if (from && to && from > to) {
      return NextResponse.json({ error: "from must be <= to" }, { status: 400 });
    }
    // Custom range takes precedence over preset days
    if (from) {
      query = query.gte("published_at", from);
    }
    if (to) {
      query = query.lt("published_at", plusOneDay(to));
    }
  } else if (days > 0) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    query = query.gte("published_at", cutoff.toISOString());
  }

  // Sponsored filter
  if (sponsored === "yes") {
    query = query.eq("is_sponsored", 1);
  } else if (sponsored === "no") {
    query = query.eq("is_sponsored", 0);
  }

  // Search filter. Strip PostgREST or() metacharacters — a raw ',' or '(' in
  // the term breaks the filter expression (500) and allows filter injection.
  if (search) {
    const safe = search.replace(/[,()]/g, " ").trim();
    if (safe) {
      query = query.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%`);
    }
  }

  const { data: articles, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = articles || [];

  // Resolve exclusive / first-to-publish flags for this page of articles.
  // Articles with no returned row are not yet clustered -> flags stay null.
  const flagsByKey = new Map<string, StoryFlagRow>();
  if (rows.length > 0) {
    const keys = rows.map((a) => `${a.source_id}|${a.external_id}`);
    const { data: flagRows } = await supabase.rpc("article_story_flags", {
      p_keys: keys,
    });
    for (const f of (flagRows || []) as StoryFlagRow[]) {
      flagsByKey.set(f.key, f);
    }
  }

  const withFlags = rows.map((a) => {
    const f = flagsByKey.get(`${a.source_id}|${a.external_id}`);
    return {
      ...a,
      title: decodeHtmlEntities(a.title || ""),
      excerpt: decodeHtmlEntities(a.excerpt || ""),
      story_flags: f
        ? { exclusive: f.exclusive === true, is_first: f.is_first === true }
        : null,
    };
  });

  return NextResponse.json({
    articles: withFlags,
    hasMore: rows.length === limit,
    matchCount: search ? (count ?? null) : null,
  });
}
