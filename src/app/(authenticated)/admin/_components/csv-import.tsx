"use client";

import { useRef, useState } from "react";
import { parseCsv } from "../_lib/csv";

export type RowResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: string };

interface Props {
  /** Help text listing the expected CSV headers. */
  headersHint: string;
  placeholder?: string;
  /** Columns (keys of validated row data) shown in the preview table. */
  previewColumns: { field: string; label: string }[];
  /** Validate + map one parsed CSV row (keys lowercased). */
  validateRow: (row: Record<string, string>) => RowResult;
  /** POST the accepted rows; return a status message. */
  onSubmit: (rows: Record<string, unknown>[]) => Promise<string>;
}

interface Preview {
  accepted: Record<string, unknown>[];
  rejected: { line: number; reason: string; raw: string }[];
}

/**
 * CSV upload with validation preview: paste or choose a file, review
 * accepted/rejected rows (with reasons), then upload the accepted rows.
 */
export function CsvImport({ headersHint, placeholder, previewColumns, validateRow, onSubmit }: Props) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result || ""));
      setPreview(null);
      setStatus("");
    };
    reader.readAsText(file);
  }

  function runPreview() {
    setStatus("");
    const rows = parseCsv(csv);
    if (rows.length === 0) {
      setPreview(null);
      setStatus("No data rows parsed. Check the header row and content.");
      return;
    }
    const accepted: Record<string, unknown>[] = [];
    const rejected: { line: number; reason: string; raw: string }[] = [];
    rows.forEach((row, i) => {
      const result = validateRow(row);
      if (result.ok) accepted.push(result.data);
      else rejected.push({ line: i + 2, reason: result.reason, raw: Object.values(row).join(", ") });
    });
    setPreview({ accepted, rejected });
  }

  async function upload() {
    if (!preview || preview.accepted.length === 0) return;
    setBusy(true);
    try {
      const message = await onSubmit(preview.accepted);
      setStatus(message);
      setCsv("");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Headers: <code>{headersHint}</code>
      </p>
      <textarea
        value={csv}
        onChange={(e) => { setCsv(e.target.value); setPreview(null); }}
        rows={6}
        placeholder={placeholder}
        className="w-full rounded border border-border px-3 py-2 text-xs font-mono"
      />
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="text-xs text-muted"
        />
        <button
          onClick={runPreview}
          disabled={!csv.trim()}
          className="rounded border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50"
        >
          Preview
        </button>
        {preview && (
          <button
            onClick={upload}
            disabled={busy || preview.accepted.length === 0}
            className="rounded bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Uploading…" : `Upload ${preview.accepted.length} row${preview.accepted.length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      {status && <div className="text-sm text-foreground">{status}</div>}

      {preview && (
        <div className="space-y-3">
          <div className="text-xs text-muted">
            {preview.accepted.length} accepted, {preview.rejected.length} rejected.
          </div>

          {preview.accepted.length > 0 && (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-surface text-muted">
                  <tr>
                    {previewColumns.map((c) => (
                      <th key={c.field} className="text-left p-2">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.accepted.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {previewColumns.map((c) => (
                        <td key={c.field} className="p-2">
                          {row[c.field] !== null && row[c.field] !== undefined && row[c.field] !== ""
                            ? String(row[c.field])
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.rejected.length > 0 && (
            <div className="overflow-x-auto rounded border border-red-200">
              <table className="w-full text-xs">
                <thead className="bg-red-50 text-red-700">
                  <tr>
                    <th className="text-left p-2">Line</th>
                    <th className="text-left p-2">Reason</th>
                    <th className="text-left p-2">Row</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rejected.map((r, i) => (
                    <tr key={i} className="border-t border-red-100">
                      <td className="p-2">{r.line}</td>
                      <td className="p-2 text-red-700">{r.reason}</td>
                      <td className="p-2 text-muted truncate max-w-md">{r.raw}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
