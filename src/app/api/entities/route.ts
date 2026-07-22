import { createClient } from "@/lib/supabase/server";
import {
  aggregateEntities,
  parseEntityAggregateParams,
} from "@/app/api/export/_lib/entities-aggregate";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(params.get("limit") || "50", 10), 200);
  const offset = parseInt(params.get("offset") || "0", 10);

  const aggregateParams = parseEntityAggregateParams(params);
  const supabase = await createClient();

  // Shared aggregation: full sorted list, GROUP BY (entity_name, entity_type).
  const { entities: sorted, error } = await aggregateEntities(
    supabase,
    aggregateParams
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const paginated = sorted.slice(offset, offset + limit);
  const hasMore = offset + limit < sorted.length;

  return NextResponse.json({
    entities: paginated,
    totalCount: sorted.length,
    hasMore,
  });
}
