export interface KpiTile {
  label: string;
  value: string;
  sub: string;
}

/**
 * Hero KPI row for the Benchmark evidence sheet — four house-style tiles.
 * Renders skeleton dashes while loading.
 */
export function KpiRow({
  tiles,
  loading,
}: {
  tiles: KpiTile[];
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-xl border border-border bg-white p-4"
          style={{ breakInside: "avoid" }}
        >
          <p className="text-xs text-muted">{tile.label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {loading ? "—" : tile.value}
          </p>
          <p className="mt-1 text-xs text-muted">{tile.sub}</p>
        </div>
      ))}
    </div>
  );
}
