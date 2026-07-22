import { NextResponse } from "next/server";

export type CsvCell = string | number | null | undefined;

/**
 * Serialize a single cell to an RFC 4180 field.
 *
 * - null / undefined → empty string
 * - numbers → their string form (never formula-guarded; a bare number is safe)
 * - strings that begin with =, +, -, @, TAB or CR get a leading apostrophe so
 *   spreadsheet apps (Excel / Sheets) treat them as text, not formulas. Scraped
 *   article titles are untrusted input, so this guard is mandatory.
 * - fields containing a comma, double-quote, or newline are wrapped in double
 *   quotes with embedded quotes doubled.
 */
function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";

  let s = typeof value === "number" ? String(value) : value;

  // Formula-injection guard — only for string-typed cells. Numbers are safe.
  if (typeof value === "string" && s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }

  // RFC 4180 quoting.
  if (/[",\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }

  return s;
}

/**
 * Build a downloadable CSV response. Body is a UTF-8 BOM followed by
 * CRLF-delimited RFC 4180 rows so Excel opens it with the right encoding.
 */
export function toCsvResponse(
  filename: string,
  headers: string[],
  rows: CsvCell[][]
): NextResponse {
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(","));
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }

  const body = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Sanitize a dynamic filename segment (entity name, source slug, …) to a safe,
 * header-friendly token: alphanumerics, dot, underscore and hyphen only.
 */
export function safeSegment(raw: string): string {
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "export";
}
