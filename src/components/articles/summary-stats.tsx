"use client";

import { formatNumber } from "@/lib/format";

interface Stats {
  totalArticles: number;
  articlesToday: number;
  sponsoredTotal: number;
  sourcesActive: number;
}

export function SummaryStats({ stats }: { stats: Stats }) {
  const cards = [
    { label: "Total Articles", value: formatNumber(stats.totalArticles) },
    { label: "Today", value: formatNumber(stats.articlesToday) },
    {
      label: "Sponsored",
      value: formatNumber(stats.sponsoredTotal),
    },
    { label: "Sources Active", value: String(stats.sourcesActive) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-white p-4"
        >
          <p className="text-xs font-medium text-muted">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
