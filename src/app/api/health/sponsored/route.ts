import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Reports per-publication sponsored-flagging rates and highlights sources
 * whose rate looks suspiciously low or high. Intended as a data-quality
 * signal, not a commercial metric.
 */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("publication_stats", {
    p_sources: [
      "travel-weekly", "karryon", "travel-daily", "latte", "traveltalk",
      "travel-monitor", "travel-today-nz", "global-travel-media",
      "cruise-weekly", "cruise-industry-news", "seatrade-rss", "travel-bulletin",
      "ajp", "pharmacy-daily",
    ],
    p_days: 10000,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r: {
    source_id: string;
    article_count: number;
    sponsored_pct: number | string;
  }) => {
    const pct = Number(r.sponsored_pct);
    const n = Number(r.article_count);
    const flags: string[] = [];
    if (n > 500 && pct === 0) flags.push("likely-undetected");
    if (n > 500 && pct < 0.002) flags.push("suspiciously-low");
    if (pct > 0.15) flags.push("suspiciously-high");
    return {
      source_id: r.source_id,
      article_count: n,
      sponsored_pct: pct,
      flags,
    };
  });

  return NextResponse.json({
    sources: rows,
    note:
      "Sponsored detection relies on keyword matching at collection time plus periodic taxonomy-based re-detection (redetect_sponsored RPC). Low rates across most sources reflect conservative detection rules, not necessarily low sponsored volume.",
  });
}
