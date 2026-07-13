/**
 * Shared types and formatters for the Partnership Value Ledger one-pager.
 */

export interface LedgerRow {
  /** Quarter start date, 'YYYY-MM-DD' (ascending, zero-filled). */
  quarter: string;
  bpg_articles: number;
  bpg_title_articles: number;
  competitor_articles: number;
  exclusive_stories: number;
  first_stories: number;
  value_min: number;
  value_mid: number;
  value_max: number;
}

/** '2025-07-01' → "Q3 2025". */
export function quarterLabel(q: string): string {
  const [y, m] = q.split("-").map(Number);
  const quarter = Math.floor((m - 1) / 3) + 1;
  return `Q${quarter} ${y}`;
}

/**
 * Compact AUD: 1_450 → "$1k", 12_400 → "$12k", 1_250_000 → "$1.3M".
 * Used for KPI bands, the value line's axis, and the quarterly table.
 */
export function formatAudCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}
