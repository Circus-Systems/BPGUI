import {
  VERTICAL_SOURCES,
  BPG_SOURCES,
  COMPETITOR_SOURCES,
} from "@/lib/constants";
import type { VerticalCode } from "@/hooks/use-vertical";

/** Coerce an arbitrary query param into a known vertical (defaults to travel). */
export function resolveVertical(raw: string | null): VerticalCode {
  return raw === "pharmacy" ? "pharmacy" : "travel";
}

/**
 * Derive BPG / competitor / combined source sets for a vertical by intersecting
 * the vertical's publication list with the global BPG / competitor sets.
 */
export function verticalSources(vertical: VerticalCode): {
  all: string[];
  bpg: string[];
  competitors: string[];
} {
  const all = VERTICAL_SOURCES[vertical] || VERTICAL_SOURCES.travel;
  const bpg = all.filter((s) => BPG_SOURCES.includes(s));
  const competitors = all.filter((s) => COMPETITOR_SOURCES.includes(s));
  return { all: [...all], bpg, competitors };
}

/** Clamp a requested day count to an allowed set, falling back to a default. */
export function resolveDays(
  raw: string | null,
  allowed: readonly number[],
  fallback: number
): number {
  const n = Number(raw);
  return allowed.includes(n) ? n : fallback;
}
