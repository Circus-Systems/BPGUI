import { SOURCE_LABELS } from "@/lib/constants";

/**
 * Tiny CSV parser (admin area). Header row required; forgiving of column
 * order and header case. Handles quoted fields, escaped quotes ("") and
 * commas/newlines inside quotes. Header keys are lowercased + trimmed.
 */
export function parseCsv(text: string): Record<string, string>[] {
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
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim().toLowerCase());
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

/** Lowercased lookup of publication label -> source_id, plus source_ids themselves. */
const PUBLICATION_LOOKUP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [sourceId, label] of Object.entries(SOURCE_LABELS)) {
    map[sourceId.toLowerCase()] = sourceId;
    map[label.toLowerCase()] = sourceId;
  }
  return map;
})();

/** Resolve a publication cell (label like "Travel Daily" OR a source_id) to a source_id. */
export function resolveSourceId(value: string): string | null {
  return PUBLICATION_LOOKUP[value.trim().toLowerCase()] ?? null;
}

/**
 * Normalise a date cell to YYYY-MM-DD. Accepts YYYY-MM-DD, DD/MM/YYYY,
 * DD-MM-YYYY, DD/MM/YY. Returns null if unparseable.
 */
export function normaliseDate(value: string): string | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return validDate(+y, +mo, +d);
  }
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? 2000 + +yRaw : +yRaw;
    return validDate(y, +mo, +d);
  }
  return null;
}

function validDate(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parse an optional integer cell ("" -> null, non-numeric -> undefined = invalid). */
export function optionalInt(value: string): number | null | undefined {
  const v = value.trim().replace(/,/g, "");
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n);
}
