"use client";

import { useEffect, useState } from "react";
import { SOURCE_LABELS, BPG_SOURCES } from "@/lib/constants";
import { parseCSV } from "@/lib/csv";

interface Journalist {
  id: number;
  full_name: string;
  slug: string;
  source_id: string;
  role: string | null;
  years_exp: number | null;
  headshot_url: string | null;
  active: boolean;
}

export default function JournalistsAdmin() {
  const [list, setList] = useState<Journalist[]>([]);
  const [form, setForm] = useState({ full_name: "", source_id: "travel-daily", role: "", years_exp: "", headshot_url: "" });
  const [csv, setCsv] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const r = await fetch("/api/admin/journalists");
    const d = await r.json();
    setList(d.journalists || []);
  }
  useEffect(() => { load(); }, []);

  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/journalists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      setStatus("Saved.");
      setForm({ full_name: "", source_id: "travel-daily", role: "", years_exp: "", headshot_url: "" });
      load();
    } else {
      const d = await r.json();
      setStatus(`Error: ${d.error}`);
    }
  }

  async function uploadCsv() {
    const rows = parseCSV(csv);
    if (rows.length === 0) { setStatus("No rows parsed."); return; }
    const r = await fetch("/api/admin/journalists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const d = await r.json();
    setStatus(r.ok ? `Inserted ${d.inserted} journalists.` : `Error: ${d.error}`);
    if (r.ok) { setCsv(""); load(); }
  }

  async function remove(id: number) {
    if (!confirm("Delete this journalist?")) return;
    await fetch(`/api/admin/journalists?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold mb-3">Add journalist</h2>
        <form onSubmit={addOne} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input required placeholder="Full name" value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="rounded border border-border px-3 py-2 text-sm" />
          <select value={form.source_id} onChange={(e) => setForm({ ...form, source_id: e.target.value })}
            className="rounded border border-border px-3 py-2 text-sm">
            {BPG_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>)}
          </select>
          <input placeholder="Role (editor / journalist / contributor)" value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded border border-border px-3 py-2 text-sm" />
          <input placeholder="Years experience" type="number" value={form.years_exp}
            onChange={(e) => setForm({ ...form, years_exp: e.target.value })}
            className="rounded border border-border px-3 py-2 text-sm" />
          <input placeholder="Headshot URL (optional)" value={form.headshot_url}
            onChange={(e) => setForm({ ...form, headshot_url: e.target.value })}
            className="rounded border border-border px-3 py-2 text-sm md:col-span-2" />
          <button className="rounded bg-accent px-4 py-2 text-sm text-white md:col-span-2">Save</button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold mb-2">Bulk CSV</h2>
        <p className="text-xs text-muted mb-2">
          Headers: <code>full_name,source_id,role,years_exp,headshot_url,bio</code>
        </p>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={6}
          placeholder="full_name,source_id,role,years_exp&#10;Jane Doe,travel-daily,editor,12"
          className="w-full rounded border border-border px-3 py-2 text-xs font-mono" />
        <button onClick={uploadCsv} className="mt-2 rounded bg-accent px-4 py-2 text-sm text-white">
          Upload CSV
        </button>
      </section>

      {status && <div className="text-sm text-foreground">{status}</div>}

      <section className="rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Years</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((j) => (
              <tr key={j.id} className="border-t border-border">
                <td className="p-3">{j.full_name}</td>
                <td className="p-3">{SOURCE_LABELS[j.source_id] || j.source_id}</td>
                <td className="p-3">{j.role || "—"}</td>
                <td className="p-3">{j.years_exp || "—"}</td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(j.id)} className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted text-sm">No journalists yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
