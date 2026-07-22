/**
 * Minimal CSV parser with header row.
 * Handles quoted fields, escaped quotes, commas/newlines inside quotes.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // skip
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim());
  return dataRows
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (r[i] || "").trim();
      });
      return obj;
    });
}

// ---------------------------------------------------------------------------
// CSV generation / client-side download (RFC 4180 + formula-injection guard)
// ---------------------------------------------------------------------------

export type CsvCell = string | number | null | undefined;

/**
 * Wrap a field in double quotes if it contains a comma, quote, CR or LF, and
 * double any embedded quotes (RFC 4180).
 */
function quoteField(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialise a single cell. Numbers pass through as-is. String cells that begin
 * with a dangerous character (= + - @ or a leading tab/CR) are prefixed with a
 * single quote so spreadsheet apps can't interpret scraped, untrusted text as a
 * formula. null/undefined become empty.
 */
function formatCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return quoteField(String(value));
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return quoteField(s);
}

/**
 * Build an RFC 4180 CSV string from a header row and data rows. Fields are
 * quoted/escaped as needed and guarded against formula injection.
 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(formatCell).join(","));
  for (const row of rows) {
    lines.push(row.map(formatCell).join(","));
  }
  return lines.join("\r\n");
}

/**
 * Trigger a client-side download of the given table as a UTF-8 CSV (with a BOM
 * so Excel opens it in the right encoding). Builds a Blob, clicks a temporary
 * anchor, and revokes the object URL.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvCell[][]
): void {
  const csv = "﻿" + toCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Build a safe, dated CSV filename. Truthy parts are lowercased, stripped of
 * unsafe characters, and joined with underscores; today's date (YYYY-MM-DD) and
 * a ".csv" extension are appended, and the whole thing is prefixed with "bpg_".
 * e.g. csvFilename(["sales-radar", "momentum", "90d"]) →
 *   "bpg_sales-radar_momentum_90d_2026-07-23.csv"
 */
export function csvFilename(parts: CsvCell[]): string {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;

  const clean = parts
    .filter(Boolean)
    .map((p) =>
      String(p)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter((p) => p.length > 0);

  return `bpg_${[...clean, today].join("_")}.csv`;
}
