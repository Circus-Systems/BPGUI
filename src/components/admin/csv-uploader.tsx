"use client";

import { useEffect, useState } from "react";
import { parseCSV } from "@/lib/csv";

interface Props {
  title: string;
  endpoint: string;
  listKey: string;       // key in GET response: "events" | "spend" | "results"
  columns: { field: string; label: string }[];
  csvHeaders: string;
  placeholder: string;
}

export function CsvUploader({ title, endpoint, listKey, columns, csvHeaders, placeholder }: Props) {
  const [csv, setCsv] = useState("");
  const [list, setList] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState("");

  async function load() {
    const r = await fetch(endpoint);
    if (r.ok) {
      const d = await r.json();
      setList(d[listKey] || []);
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload() {
    const rows = parseCSV(csv);
    if (rows.length === 0) { setStatus("No rows parsed."); return; }
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const d = await r.json();
    setStatus(r.ok ? `Inserted ${d.inserted} rows.` : `Error: ${d.error}`);
    if (r.ok) { setCsv(""); load(); }
  }

  async function remove(id: number) {
    if (!confirm("Delete this row?")) return;
    await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold mb-2">{title} — CSV upload</h2>
        <p className="text-xs text-muted mb-2">
          Headers: <code>{csvHeaders}</code>
        </p>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} placeholder={placeholder}
          className="w-full rounded border border-border px-3 py-2 text-xs font-mono" />
        <button onClick={upload} className="mt-2 rounded bg-accent px-4 py-2 text-sm text-white">
          Upload
        </button>
      </section>

      {status && <div className="text-sm text-foreground">{status}</div>}

      <section className="rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              {columns.map((c) => <th key={c.field} className="text-left p-3">{c.label}</th>)}
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={Number(row.id)} className="border-t border-border">
                {columns.map((c) => (
                  <td key={c.field} className="p-3">
                    {row[c.field] !== null && row[c.field] !== undefined ? String(row[c.field]) : "—"}
                  </td>
                ))}
                <td className="p-3 text-right">
                  <button onClick={() => remove(Number(row.id))} className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="p-6 text-center text-muted text-sm">No rows yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
