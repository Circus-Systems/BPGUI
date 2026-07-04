"use client";

import { useState } from "react";
import { parseSimpleMd } from "@/lib/brief-deck";

/**
 * Slide 17 inline editor — renders the saved recommendations markdown as
 * simple paragraphs/bullets, with a textarea + Save that upserts via
 * POST /api/brief/recommendations (service-role write, keyed host_slug+brand).
 */
export function RecommendationsEditor({
  hostSlug,
  brand,
  initialMd,
}: {
  hostSlug: string;
  brand: string;
  initialMd: string | null;
}) {
  const [saved, setSaved] = useState<string | null>(initialMd);
  const [draft, setDraft] = useState<string>(initialMd || "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/brief/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host_slug: hostSlug,
          brand,
          content_md: draft,
        }),
      });
      const d = await res.json();
      if (!res.ok || d?.error) {
        setError(d?.error || `HTTP ${res.status}`);
      } else {
        setSaved(draft);
        setEditing(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const blocks = saved ? parseSimpleMd(saved) : [];

  return (
    <div>
      {blocks.length > 0 ? (
        <div className="space-y-3 text-sm text-foreground">
          {blocks.map((b, i) =>
            b.type === "p" ? (
              <p key={i}>{b.text}</p>
            ) : (
              <ul key={i} className="list-disc pl-5 space-y-1">
                {b.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            )
          )}
        </div>
      ) : (
        <p className="text-sm text-muted italic">
          Recommendations to be tailored ahead of the meeting — add them below.
        </p>
      )}

      <div className="mt-4 print:hidden">
        {editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              placeholder={
                "One recommendation per line. Start lines with - for bullets."
              }
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-mono"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setDraft(saved || "");
                  setError(null);
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface"
              >
                Cancel
              </button>
              {error && <span className="text-xs text-red-700">{error}</span>}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface"
          >
            {saved ? "Edit recommendations" : "Add recommendations"}
          </button>
        )}
      </div>
    </div>
  );
}
