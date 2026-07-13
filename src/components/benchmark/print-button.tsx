"use client";

/**
 * Triggers the browser print dialog for the Benchmark evidence sheet.
 *
 * Unlike the brief's PrintButton (which downloads a generated .pptx), the
 * Benchmark page IS the deliverable — a print-friendly one-pager — so this
 * just calls window.print(). The page's @media print styles hide the nav,
 * selector, and pills so it comes out clean.
 */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      Print / Save PDF
    </button>
  );
}
