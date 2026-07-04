"use client";

import { useCallback, useEffect, useState } from "react";
import { SOURCE_LABELS } from "@/lib/constants";
import { CsvImport, type RowResult } from "../_components/csv-import";
import { normaliseDate, resolveSourceId } from "../_lib/csv";

interface EventRow {
  id: number;
  source_id: string;
  event_name: string;
  event_date: string;
  advertiser: string | null;
  attended_by: string | null;
  notes: string | null;
}

function validateEventRow(row: Record<string, string>): RowResult {
  const publication = row.source_id || row.publication || "";
  const sourceId = publication ? resolveSourceId(publication) : null;
  if (!sourceId) {
    return { ok: false, reason: publication ? `Unknown publication "${publication}"` : "Missing source_id/publication" };
  }

  const eventName = (row.event_name || "").trim();
  if (!eventName) return { ok: false, reason: "Missing event_name" };

  const rawDate = row.event_date || row.date || "";
  const eventDate = normaliseDate(rawDate);
  if (!eventDate) return { ok: false, reason: rawDate ? `Unrecognised date "${rawDate}"` : "Missing event_date" };

  return {
    ok: true,
    data: {
      source_id: sourceId,
      event_name: eventName,
      event_date: eventDate,
      advertiser: row.advertiser || null,
      attended_by: row.attended_by || null,
      notes: row.notes || null,
    },
  };
}

export default function EventsAdmin() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/events");
    if (r.ok) {
      const d = await r.json();
      setEvents(d.events || []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = useCallback(
    async (rows: Record<string, unknown>[]) => {
      const r = await fetch("/api/admin/events", {
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

  async function remove(id: number) {
    if (!confirm("Delete this event?")) return;
    const r = await fetch(`/api/admin/events?id=${id}`, { method: "DELETE" });
    if (!r.ok) {
      const d = await r.json();
      setStatus(`Error: ${d.error}`);
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold mb-2">Events attended — CSV upload</h2>
        <p className="text-xs text-muted mb-2">
          The publication column accepts a source_id (e.g. <code>travel-daily</code>) or a
          publication label (e.g. <code>Travel Daily</code>). Duplicate rows (same source,
          event, date and advertiser) are skipped automatically.
        </p>
        <CsvImport
          headersHint="source_id (or publication), event_name, event_date, advertiser, attended_by, notes"
          placeholder={"source_id,event_name,event_date,advertiser,attended_by,notes\nTravel Daily,Cruise360 Australia,2026-02-14,Carnival,Bruce Piper,"}
          previewColumns={[
            { field: "event_date", label: "Date" },
            { field: "event_name", label: "Event" },
            { field: "source_id", label: "Source" },
            { field: "advertiser", label: "Advertiser" },
            { field: "attended_by", label: "Attended by" },
            { field: "notes", label: "Notes" },
          ]}
          validateRow={validateEventRow}
          onSubmit={submit}
        />
      </section>

      {status && <div className="text-sm text-foreground">{status}</div>}

      <section className="rounded-lg border border-border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Event</th>
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Advertiser</th>
              <th className="text-left p-3">Attended by</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3 whitespace-nowrap">{e.event_date}</td>
                <td className="p-3">{e.event_name}</td>
                <td className="p-3">{SOURCE_LABELS[e.source_id] || e.source_id}</td>
                <td className="p-3">{e.advertiser || "—"}</td>
                <td className="p-3">{e.attended_by || "—"}</td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(e.id)} className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted text-sm">No events yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
