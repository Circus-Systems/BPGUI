/**
 * Server-only helper: fetch an article page's og:image and return it as a
 * base64 data URI suitable for pptxgenjs `addImage({ data })`.
 *
 * Deliberately conservative: 3s timeouts, content-type checks, 4MB cap.
 * Any failure returns null and the caller renders a styled text card instead.
 */

const FETCH_TIMEOUT_MS = 3000;
const MAX_IMAGE_BYTES = 4_000_000;

export async function fetchOgImageData(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (compatible; BPGBrief/1.0)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return null;

    const html = (await res.text()).slice(0, 300_000);
    const match =
      html.match(
        /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i
      );
    if (!match) return null;

    const imgUrl = new URL(match[1], pageUrl).toString();
    if (!/^https?:\/\//i.test(imgUrl)) return null;

    const imgRes = await fetch(imgUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; BPGBrief/1.0)" },
    });
    if (!imgRes.ok) return null;
    const imgCt = (imgRes.headers.get("content-type") || "").split(";")[0].trim();
    if (!imgCt.startsWith("image/") || imgCt.includes("svg")) return null;

    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;

    return `data:${imgCt};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
