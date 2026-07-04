"use client";

import { useState } from "react";
import { deckFilename } from "@/lib/brief-deck";

/**
 * Downloads the Key Partner Meeting .pptx deck for the current brand.
 *
 * Hits /api/brand/[slug]/pptx which generates a native PowerPoint file
 * (editable in Keynote/PPT), not a print-to-PDF of the web view.
 */
export function PrintButton({
  slug,
  brandName,
  period,
  host,
  hostSlug,
  brand,
}: {
  slug: string;
  brandName: string;
  period: number;
  /** host query param threaded through to the pptx route */
  host: string;
  /** resolved host slug for the filename */
  hostSlug: string;
  /** resolved brand name for the filename */
  brand: string;
}) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const url = `/api/brand/${encodeURIComponent(slug)}/pptx?name=${encodeURIComponent(
        brandName,
      )}&period=${period}&host=${encodeURIComponent(host)}`;
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
      a.download = deckFilename(brand, hostSlug, period);
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
