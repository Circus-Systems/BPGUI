import { createClient } from "@/lib/supabase/server";
import { resolveHostConfig, DEFAULT_HOST_SLUG } from "@/lib/brief-deck";
import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/brief/config?host=travel-daily
 * Returns the brief_config row for the host slug; falls back to
 * constants-derived defaults when no row exists (found: false).
 */
export async function GET(request: NextRequest) {
  const host = request.nextUrl.searchParams.get("host") || DEFAULT_HOST_SLUG;

  const supabase = await createClient();
  const { config, found } = await resolveHostConfig(supabase, host);

  return NextResponse.json({ config, found });
}
