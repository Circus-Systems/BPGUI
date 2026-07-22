import { createClient } from "@/lib/supabase/server";
import {
  aggregateEntities,
  parseEntityAggregateParams,
} from "../_lib/entities-aggregate";
import { toCsvResponse, safeSegment, type CsvCell } from "../_lib/csv";
import { NextResponse, type NextRequest } from "next/server";

// Aggregation may page up to 100 sequential 1000-row reads (cold) → raise limit.
export const maxDuration = 60;

const ROW_CEILING = 30000;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const aggregateParams = parseEntityAggregateParams(params);
  const supabase = await createClient();

  try {
    const { entities, error } = await aggregateEntities(
      supabase,
      aggregateParams
    );
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    const capped = entities.slice(0, ROW_CEILING);

    const headers = ["entity", "type", "mentions", "articles"];
    const rows: CsvCell[][] = capped.map((e) => [
      e.entity_name,
      e.entity_type,
      e.total_mentions,
      e.article_count,
    ]);

    const date = new Date().toISOString().slice(0, 10);
    const filename = `bpg_entities_${safeSegment(aggregateParams.vertical)}_${date}.csv`;
    return toCsvResponse(filename, headers, rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
