"use client";

import { useCallback, useEffect, useState } from "react";
import { CsvImport, type RowResult } from "../_components/csv-import";
import { normaliseDate, optionalInt, resolveSourceId } from "../_lib/csv";

interface Campaign {
  id: number;
  brand: string;
  name: string;
  period_start: string;
  period_end: string;
  spend_aud: number | null;
  bonus_ad_value: string | null; // TEXT in DB: "2x bonus eDMs" or a number
  estimated_reach: number | null;
  creative_url: string | null;
  insertion_count: number;
}

const EMPTY_FORM = {
  brand: "",
  name: "",
  period_start: "",
  period_end: "",
  spend_aud: "",
  bonus_ad_value: "",
  estimated_reach: "",
  creative_url: "",
};

const AUD = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

function validateInsertionRow(row: Record<string, string>): RowResult {
  const rawDate = row.date || row.run_date || "";
  const runDate = normaliseDate(rawDate);
  if (!runDate) return { ok: false, reason: rawDate ? `Unrecognised date "${rawDate}"` : "Missing date" };

  const publication = row.publication || row.source_id || "";
  const sourceId = publication ? resolveSourceId(publication) : null;
  if (!sourceId) {
    return { ok: false, reason: publication ? `Unknown publication "${publication}"` : "Missing publication" };
  }

  const estReadership = optionalInt(row.est_readership || "");
  if (estReadership === undefined) return { ok: false, reason: `Invalid est_readership "${row.est_readership}"` };
  const clicks = optionalInt(row.clicks || "");
  if (clicks === undefined) return { ok: false, reason: `Invalid clicks "${row.clicks}"` };

  return {
    ok: true,
    data: {
      run_date: runDate,
      source_id: sourceId,
      ad_type: row.ad_type || null,
      page_position: row.page_position || null,
      est_readership: estReadership,
      clicks,
      notes: row.notes || null,
    },
  };
}

export default function CampaignsAdmin() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState("");
  const [uploadFor, setUploadFor] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/campaigns");
    if (r.ok) {
      const d = await r.json();
      setCampaigns(d.campaigns || []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setStatus(r.ok ? `Created campaign "${d.campaign.name}".` : `Error: ${d.error}`);
    if (r.ok) { setForm(EMPTY_FORM); load(); }
  }

  async function remove(c: Campaign) {
    if (!confirm(`Delete campaign "${c.name}" and its ${c.insertion_count} insertions?`)) return;
    const r = await fetch(`/api/admin/campaigns?id=${c.id}`, { method: "DELETE" });
    if (!r.ok) {
      const d = await r.json();
      setStatus(`Error: ${d.error}`);
      return;
    }
    if (uploadFor === c.id) setUploadFor(null);
    load();
  }

  const submitInsertions = useCallback(
    (campaignId: number) => async (rows: Record<string, unknown>[]) => {
      const r = await fetch(`/api/admin/campaigns/${campaignId}/insertions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");
      load();
      return `Inserted ${d.inserted} row${d.inserted === 1 ? "" : "s"}${d.skipped ? `, skipped ${d.skipped} duplicate${d.skipped === 1 ? "" : "s"}` : ""}.`;
    },
    [load]
  );

  const input = "rounded border border-border px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold mb-3">Create campaign</h2>
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input required placeholder="Brand (e.g. Norwegian Cruise Line)" value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })} className={input} />
          <input required placeholder="Campaign name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
          <label className="flex items-center gap-2 text-xs text-muted">
            Start
            <input required type="date" value={form.period_start}
              onChange={(e) => setForm({ ...form, period_start: e.target.value })} className={`${input} flex-1`} />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            End
            <input required type="date" value={form.period_end}
              onChange={(e) => setForm({ ...form, period_end: e.target.value })} className={`${input} flex-1`} />
          </label>
          <input type="number" step="1" min="0" placeholder="Spend AUD (optional)" value={form.spend_aud}
            onChange={(e) => setForm({ ...form, spend_aud: e.target.value })} className={input} />
          <input type="text" placeholder="Bonus ad value (e.g. 15000 or 2x bonus eDMs)" value={form.bonus_ad_value}
            onChange={(e) => setForm({ ...form, bonus_ad_value: e.target.value })} className={input} />
          <input type="number" step="1" min="0" placeholder="Estimated reach" value={form.estimated_reach}
            onChange={(e) => setForm({ ...form, estimated_reach: e.target.value })} className={input} />
          <input type="url" placeholder="Creative URL" value={form.creative_url}
            onChange={(e) => setForm({ ...form, creative_url: e.target.value })} className={input} />
          <button className="rounded bg-accent px-4 py-2 text-sm text-white md:col-span-4 md:w-fit">
            Create campaign
          </button>
        </form>
      </section>

      {status && <div className="text-sm text-foreground">{status}</div>}

      <section className="rounded-lg border border-border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="text-left p-3">Brand</th>
              <th className="text-left p-3">Campaign</th>
              <th className="text-left p-3">Period</th>
              <th className="text-right p-3">Spend</th>
              <th className="text-right p-3">Bonus value</th>
              <th className="text-right p-3">Est. reach</th>
              <th className="text-right p-3">Insertions</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-medium">{c.brand}</td>
                <td className="p-3">
                  {c.creative_url ? (
                    <a href={c.creative_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {c.name}
                    </a>
                  ) : (
                    c.name
                  )}
                </td>
                <td className="p-3 whitespace-nowrap">{c.period_start} → {c.period_end}</td>
                <td className="p-3 text-right">{c.spend_aud !== null ? AUD.format(c.spend_aud) : "—"}</td>
                <td className="p-3 text-right">{c.bonus_ad_value !== null && c.bonus_ad_value.trim() !== "" ? (Number.isFinite(Number(c.bonus_ad_value)) ? AUD.format(Number(c.bonus_ad_value)) : c.bonus_ad_value) : "—"}</td>
                <td className="p-3 text-right">{c.estimated_reach !== null ? c.estimated_reach.toLocaleString("en-AU") : "—"}</td>
                <td className="p-3 text-right">{c.insertion_count}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setUploadFor(uploadFor === c.id ? null : c.id)}
                    className="text-xs text-accent hover:underline mr-3"
                  >
                    {uploadFor === c.id ? "Close upload" : "Upload insertions"}
                  </button>
                  <button onClick={() => remove(c)} className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted text-sm">
                  No campaigns yet. Create one above to start tracking insertions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {uploadFor !== null && (
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-semibold mb-2">
            Upload insertions — {campaigns.find((c) => c.id === uploadFor)?.name ?? `campaign #${uploadFor}`}
          </h2>
          <CsvImport
            headersHint="date, publication, ad_type, page_position, est_readership, clicks, notes"
            placeholder={"date,publication,ad_type,page_position,est_readership,clicks,notes\n2026-06-01,Travel Daily,banner,top,45000,320,June burst"}
            previewColumns={[
              { field: "run_date", label: "Date" },
              { field: "source_id", label: "Source" },
              { field: "ad_type", label: "Ad type" },
              { field: "page_position", label: "Position" },
              { field: "est_readership", label: "Est. readership" },
              { field: "clicks", label: "Clicks" },
              { field: "notes", label: "Notes" },
            ]}
            validateRow={validateInsertionRow}
            onSubmit={submitInsertions(uploadFor)}
          />
        </section>
      )}
    </div>
  );
}
