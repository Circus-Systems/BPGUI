"use client";

import { useEffect, useState } from "react";
import { SOURCE_LABELS, BPG_SOURCES } from "@/lib/constants";

interface Rate {
  id: number;
  source_id: string;
  metric: string;
  rate_aud: number;
  notes: string | null;
  effective_from: string;
}

const METRICS = ["article_standard", "article_feature", "social_post", "event"];

export default function AveRatesAdmin() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [form, setForm] = useState({ source_id: "travel-daily", metric: "article_standard", rate_aud: "", notes: "" });
  const [status, setStatus] = useState("");

  async function load() {
    const r = await fetch("/api/admin/ave-rates");
    const d = await r.json();
    setRates(d.rates || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/ave-rates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setStatus(r.ok ? `Saved ${d.source_id} / ${d.metric}.` : `Error: ${d.error}`);
    if (r.ok) { setForm({ ...form, rate_aud: "", notes: "" }); load(); }
  }

  async function remove(id: number) {
    if (!confirm("Delete this rate?")) return;
    await fetch(`/api/admin/ave-rates?id=${id}`, { method: "DELETE" });
    load();
  }

  // Group by source for a matrix view
  const matrix = new Map<string, Record<string, Rate>>();
  for (const r of rates) {
    const m = matrix.get(r.source_id) || {};
    m[r.metric] = r;
    matrix.set(r.source_id, m);
  }

  const AUD = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold mb-3">Add or update rate</h2>
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={form.source_id} onChange={(e) => setForm({ ...form, source_id: e.target.value })}
            className="rounded border border-border px-3 py-2 text-sm">
            {BPG_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>)}
          </select>
          <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}
            className="rounded border border-border px-3 py-2 text-sm">
            {METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input required type="number" step="1" placeholder="Rate AUD" value={form.rate_aud}
            onChange={(e) => setForm({ ...form, rate_aud: e.target.value })}
            className="rounded border border-border px-3 py-2 text-sm" />
          <button className="rounded bg-accent px-4 py-2 text-sm text-white">Save</button>
        </form>
      </section>

      {status && <div className="text-sm text-foreground">{status}</div>}

      <section className="rounded-lg border border-border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="text-left p-3">Publication</th>
              {METRICS.map((m) => <th key={m} className="text-right p-3">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from(matrix.entries()).map(([source, metrics]) => (
              <tr key={source} className="border-t border-border">
                <td className="p-3 font-medium">{SOURCE_LABELS[source] || source}</td>
                {METRICS.map((m) => (
                  <td key={m} className="p-3 text-right">
                    {metrics[m] ? (
                      <span className="inline-flex items-center gap-2">
                        {AUD.format(metrics[m].rate_aud)}
                        <button onClick={() => remove(metrics[m].id)} className="text-xs text-red-500 hover:underline">×</button>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {rates.length === 0 && (
              <tr><td colSpan={METRICS.length + 1} className="p-6 text-center text-muted text-sm">No rates yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
