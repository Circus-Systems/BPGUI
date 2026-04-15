"use client";

import { useState } from "react";

/**
 * Downloads a .pptx deck for the current brand.
 *
 * Hits /api/brand/[slug]/pptx which generates a native PowerPoint file
 * (editable in Keynote/PPT), not a print-to-PDF of the web view.
 */
export function PrintButton({
  slug,
  brandName,
  period,
}: {
  slug: string;
  brandName: string;
  period: number;
}) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const url = `/api/brand/${encodeURIComponent(slug)}/pptx?name=${encodeURIComponent(
        brandName,
      )}&period=${period}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.text();
        alert(`Download failed: ${err.slice(0, 200)}`);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `AdvertiserBrief_${brandName.replace(/[^A-Za-z0-9_-]+/g, "_")}_${period}d.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      alert(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      className="print:hidden rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
    >
      {loading ? "Generating…" : "Download PowerPoint"}
    </button>
  );
}
