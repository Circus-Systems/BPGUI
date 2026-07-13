"use client";

import type { PublicationBrand } from "./publication-detail-modal";

export function PublicationBrandsTable({
  brands,
  total,
  onLoadMore,
  loadingMore,
  onBrandClick,
}: {
  brands: PublicationBrand[];
  total: number;
  onLoadMore: () => void;
  loadingMore: boolean;
  onBrandClick: (brandName: string) => void;
}) {
  const hasMore = brands.length < total;

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-foreground">
        Brands — showing {brands.length.toLocaleString()} of{" "}
        {total.toLocaleString()}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 text-right font-medium text-muted">#</th>
              <th className="pb-2 pr-4 font-medium text-muted">Brand</th>
              <th className="pb-2 pr-4 font-medium text-muted">Type</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                Articles
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-muted">
                Headline
              </th>
              <th className="pb-2 text-right font-medium text-muted">Share</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b, i) => (
              <tr
                key={`${b.brand_id ?? b.brand}-${i}`}
                className="border-b border-border/50"
              >
                <td className="whitespace-nowrap py-2.5 pr-4 text-right text-muted">
                  {i + 1}
                </td>
                <td className="py-2.5 pr-4">
                  <button
                    type="button"
                    onClick={() => onBrandClick(b.brand)}
                    className="text-accent hover:underline text-left"
                  >
                    {b.brand}
                  </button>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="inline-flex whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                    {b.entity_type === "industry_body"
                      ? "Industry body"
                      : "Company"}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right text-foreground">
                  {b.articles.toLocaleString()}
                </td>
                <td className="py-2.5 pr-4 text-right text-muted">
                  {b.title_articles.toLocaleString()}
                </td>
                <td className="py-2.5 text-right text-muted">
                  {b.share_pct == null ? "—" : `${b.share_pct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-full bg-surface px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
