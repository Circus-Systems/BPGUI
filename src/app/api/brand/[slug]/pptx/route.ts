import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { assembleBriefData, deckFilename, DEFAULT_HOST_SLUG, type BriefDeckData } from "@/lib/brief-deck";
import { buildDeck } from "@/lib/brief-pptx";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sp = request.nextUrl.searchParams;
  const brandName = sp.get("name") || slug;
  const period = parseInt(sp.get("period") || "365", 10);
  const host = sp.get("host") || DEFAULT_HOST_SLUG;

  const supabase = await createClient();
  let data: BriefDeckData;
  try {
    data = await assembleBriefData(supabase, {
      slug,
      brandName,
      period,
      host,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  const pptx = await buildDeck(data);
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  const filename = deckFilename(data.brand, data.host.slug, period);

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
