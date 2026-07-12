/**
 * Format a lag in hours as a compact string: "4.2h" normally, switching to
 * days ("1.3d") once the lag exceeds 48 hours. Null/undefined renders as "—".
 */
export function formatLagHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours > 48) return `${(hours / 24).toFixed(1)}d`;
  return `${hours.toFixed(1)}h`;
}
