import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/brief/rivals?brand=Norwegian%20Cruise%20Line
 * Case-insensitive lookup against sector_rivals.brand_canonical.
 * Returns { rivals: null } when no matrix has been supplied for the brand.
 */
export async function GET(request: NextRequest) {
  const brand = request.nextUrl.searchParams.get("brand");
  if (!brand) {
    return NextResponse.json({ error: "brand required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sector_rivals")
    .select("brand_canonical, rivals, sector, source_of_truth")
    .ilike("brand_canonical", brand)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rivals: data && data.length > 0 ? data[0] : null });
}
