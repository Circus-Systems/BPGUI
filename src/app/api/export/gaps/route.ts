import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { decodeHtmlEntities } from "@/lib/brief-deck";
import { WIRE_SOURCES } from "@/lib/constants";
import {
  resolveVertical,
  verticalSources,
  resolveDays,
} from "@/app/api/editorial-compare/sources";
import { toCsvResponse, type CsvCell } from "../_lib/csv";

export const maxDuration = 60;

const ALLOWED_DAYS = [7, 14, 30] as const;
// PostgREST caps every response at max-rows=1000, so page coverage_gaps via its
// p_offset param (added to production): p_limit=1000, p_offset += 1000, until a
// short page or the 30k ceiling.
const PAGE_SIZE = 1000;
const ROW_CEILING = 30000;

interface GapRpcRow {
  cluster_id: number | string;
  title: string;
  url: string;
  sources: string[] | null;
  first_source: string;
  article_count: number | string;
  first_published_at: string;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vertical = resolveVertical(params.get("vertical"));
  const days = resolveDays(params.get("days"), ALLOWED_DAYS, 7);
  const { bpg, competitors } = verticalSources(vertical);

  // Wire mode: "exclude" (default) drops wire-only gap stories; "include" keeps
  // them (passes an empty wire set). Mirrors /api/editorial-compare/gaps.
  const wireMode = params.get("wire") === "include" ? "include" : "exclude";
  const wireSources = wireMode === "exclude" ? [...WIRE_SOURCES] : [];

  const supabase = await createClient();

  // Page through coverage_gaps in 1000-row chunks (PostgREST max-rows cap).
  const all: GapRpcRow[] = [];
  let offset = 0;
  while (offset < ROW_CEILING) {
    const { data, error } = await supabase.rpc("coverage_gaps", {
      p_bpg_sources: bpg,
      p_competitor_sources: competitors,
      p_days: days,
      p_limit: PAGE_SIZE,
      p_wire_sources: wireSources,
      p_offset: offset,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const page = (data || []) as GapRpcRow[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  const capped = all.slice(0, ROW_CEILING);

  const headers = [
    "title",
    "url",
    "sources",
    "first_source",
    "article_count",
    "first_published_at",
  ];
  const rows: CsvCell[][] = capped.map((r) => [
    decodeHtmlEntities(r.title || ""),
    r.url,
    (r.sources || []).join(";"),
    r.first_source,
    Number(r.article_count),
    r.first_published_at,
  ]);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `bpg_coverage-gaps_${vertical}_${days}d_${date}.csv`;
  return toCsvResponse(filename, headers, rows);
}
