import { VERTICAL_SOURCES } from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";

/**
 * Shared query-param parsing for the publications API routes.
 *
 * Period is EITHER:
 *   - days=N            (existing behaviour, unchanged)
 *   - from=YYYY-MM-DD&to=YYYY-MM-DD  (custom range -> *_range RPCs)
 */

export type Period =
  | { mode: "days"; days: number }
  | { mode: "range"; from: string; to: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function parsePeriod(
  params: URLSearchParams
): { period: Period } | { error: string } {
  const from = params.get("from");
  const to = params.get("to");

  if (from !== null || to !== null) {
    if (!from || !to) {
      return { error: "Both 'from' and 'to' are required for a custom range" };
    }
    if (!isValidDate(from) || !isValidDate(to)) {
      return { error: "Dates must be valid YYYY-MM-DD" };
    }
    if (from > to) {
      return { error: "'from' must not be after 'to'" };
    }
    // Reject future 'to'. Allow one day of slack so clients in timezones
    // ahead of the server (e.g. AU/NZ vs UTC) can still select their local today.
    const maxTo = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    if (to > maxTo) {
      return { error: "'to' must not be in the future" };
    }
    return { period: { mode: "range", from, to } };
  }

  const days = parseInt(params.get("days") || "30", 10);
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    return { error: "'days' must be a positive integer" };
  }
  return { period: { mode: "days", days } };
}

/**
 * Resolves the source list: optional `sources` param (comma-separated) is
 * filtered to the vertical's known sources; falls back to the full vertical.
 */
export function resolveSources(params: URLSearchParams): string[] {
  const vertical = (params.get("vertical") || "travel") as VerticalCode;
  const verticalSources = [
    ...(VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel),
  ];

  const raw = params.get("sources");
  if (!raw) return verticalSources;

  const allowed = new Set(verticalSources);
  const requested = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => allowed.has(s));

  return requested.length > 0 ? requested : verticalSources;
}
