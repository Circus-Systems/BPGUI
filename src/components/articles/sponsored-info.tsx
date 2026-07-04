"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small info popover explaining how articles are flagged as sponsored.
 */
export function SponsoredInfo() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="What counts as sponsored?"
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-foreground hover:bg-surface transition-colors"
        title="What counts as sponsored?"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-40 w-80 rounded-xl border border-border bg-white p-4 shadow-lg">
          <h4 className="text-xs font-semibold text-foreground">
            What counts as sponsored?
          </h4>
          <p className="mt-1.5 text-xs text-muted">
            An article is flagged as sponsored when any of these signals is
            present:
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted">
            <li className="flex gap-2">
              <span className="font-medium text-foreground">a.</span>
              <span>
                An explicit WordPress sponsored category or tag ID on the
                article.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">b.</span>
              <span>
                A category or tag name containing{" "}
                <em>sponsor</em>, <em>advertorial</em>,{" "}
                <em>partner content</em> or <em>paid</em>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">c.</span>
              <span>
                Disclosure keywords in the title or the opening of the
                article.
              </span>
            </li>
          </ul>
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted">
            Competitions, giveaways and generic promotions are{" "}
            <span className="font-medium text-foreground">not</span> counted
            as sponsored (recalibrated July 2026).
          </p>
        </div>
      )}
    </div>
  );
}
