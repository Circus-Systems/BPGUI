import { createClient } from "@/lib/supabase/server";
import { assembleBriefData, DEFAULT_HOST_SLUG } from "@/lib/brief-deck";
import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/brief/deck?slug=<slug>&name=<Brand>&period=365&host=travel-daily
 *
 * Returns the full BriefDeckData payload consumed by the /brief/[slug]
 * web preview. The PPTX route builds from the same assembleBriefData()
 * call so the two renderers cannot drift.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const slug = sp.get("slug") || "";
  const brandName = sp.get("name") || slug;
  const period = parseInt(sp.get("period") || "365", 10);
  const host = sp.get("host") || DEFAULT_HOST_SLUG;

  if (!brandName) {
    return NextResponse.json({ error: "slug or name required" }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const data = await assembleBriefData(supabase, {
      slug,
      brandName,
      period,
      host,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
