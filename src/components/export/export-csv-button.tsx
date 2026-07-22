"use client";

import { useCallback, useState } from "react";

/** Pull the server-supplied filename out of a Content-Disposition header. */
function parseFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;

  // RFC 5987 form: filename*=UTF-8''encoded-name
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain form
    }
  }

  // Plain form: filename="name.csv"
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  if (plain) return plain[1].trim();

  return fallback;
}

/**
 * Pill button that downloads the full dataset behind `url` as a CSV. The route
 * cuts across pagination server-side, so a large export can take a few seconds —
 * the button shows "Preparing…" while the request is in flight.
 */
export function ExportCsvButton({
  url,
  disabled = false,
}: {
  url: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (busy || disabled) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // Surface the server's message (e.g. the 504 "window too large" note).
        let msg = `Failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) msg = String(body.error);
        } catch {
          // non-JSON error body — keep the status fallback
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const filename = parseFilename(
        res.headers.get("Content-Disposition"),
        "export.csv"
      );

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Export failed");
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setBusy(false);
    }
  }, [url, busy, disabled]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      title={errorMsg || "Download the full dataset as CSV"}
      className="rounded-full px-3 py-1 text-xs font-medium bg-surface text-muted hover:text-foreground border border-border print:hidden disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {busy ? (
        "Preparing…"
      ) : errorMsg ? (
        <span className="text-decrease">{errorMsg}</span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true">↓</span> CSV
        </span>
      )}
    </button>
  );
}
