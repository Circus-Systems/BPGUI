/**
 * Generate a Key Partner deck from the command line (no auth session needed).
 *
 *   npx tsx --env-file=.env.local scripts/render-brief.ts "Flight Centre" travel-daily out.pptx
 *
 * Uses the service-role key when available (full data incl. campaigns/config),
 * else the anon key (public RPC surface only — config falls back to constants).
 * Same assembly + builder as the API route, so output is identical.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { assembleBriefData, deckFilename } from "../src/lib/brief-deck";
import { buildDeck } from "../src/lib/brief-pptx";

async function main() {
  const brandName = process.argv[2] || "Flight Centre";
  const host = process.argv[3] || "travel-daily";
  const outPath = process.argv[4] || "";
  const period = parseInt(process.env.BRIEF_PERIOD || "365", 10);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env missing (run with --env-file=.env.local)");

  const supabase = createClient(url, key);
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  console.log(`Assembling brief: ${brandName} (host=${host}, ${period}d)…`);
  const data = await assembleBriefData(supabase, {
    slug,
    brandName,
    period,
    host,
  });
  console.log(
    `  coverage: ${data.coverage.summary.total_articles} articles · team source: ${data.teamSource}`
  );

  // Without assetOrigin, buildDeck silently skips the 10 template-page JPEGs
  // and the TD logo (templateAsset() returns null) — the deck loses its
  // artwork. Fetch them from prod unless overridden.
  const pptx = await buildDeck(data, {
    assetOrigin:
      process.env.BRIEF_ASSET_ORIGIN || "https://bpg.compoundlogic.ai",
  });
  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const file = outPath || deckFilename(brandName, host, period);
  writeFileSync(file, buf);
  console.log(`Wrote ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
