"use client";

import { quarterLabel, formatAudCompact, type LedgerRow } from "./format-value";

/**
 * Quarterly detail table. Value shows the mid estimate with the ±15% band as
 * muted subtext (and a title tooltip); zero-value quarters render as "—".
 */
export function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  return (
    <div
      className="rounded-xl border border-border bg-white p-4"
      style={{ breakInside: "avoid" }}
    >
      <h3 className="mb-4 text-sm font-medium text-foreground">
        Quarterly detail
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-medium text-muted">Quarter</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                BPG articles
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                Headline
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                Competitor
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                Exclusives
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                First-to-publish
              </th>
              <th className="pb-2 text-right font-medium text-muted">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const band = `${formatAudCompact(r.value_min)}–${formatAudCompact(
                r.value_max
              )}`;
              return (
                <tr
                  key={r.quarter}
                  className="border-b border-border/50 hover:bg-surface"
                >
                  <td className="py-2.5 pr-4 font-medium text-foreground">
                    {quarterLabel(r.quarter)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-foreground">
                    {r.bpg_articles.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {r.bpg_title_articles.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {r.competitor_articles.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {r.exclusive_stories.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted">
                    {r.first_stories.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right">
                    {r.value_mid > 0 ? (
                      <span className="text-foreground" title={band}>
                        {formatAudCompact(r.value_mid)}
                        <span className="ml-1 text-xs text-muted">({band})</span>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
