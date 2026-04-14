"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      Export PDF
    </button>
  );
}
