"use client";

import { downloadCsv, type CsvCell } from "@/lib/csv";

/**
 * Small "download CSV" pill button. Exports the exact rows the parent table is
 * rendering — rows are pulled lazily via getRows() so the CSV always reflects
 * the current window/selection. Hidden in print.
 */
export function DownloadCsvButton({
  filename,
  headers,
  getRows,
  disabled,
}: {
  filename: string;
  headers: string[];
  getRows: () => CsvCell[][];
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, headers, getRows())}
      disabled={disabled}
      title="Download this table as CSV"
      aria-label="Download CSV"
      className="print:hidden inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-surface text-muted hover:text-foreground border border-border disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted"
    >
      <span aria-hidden="true">↓</span>
      CSV
    </button>
  );
}
