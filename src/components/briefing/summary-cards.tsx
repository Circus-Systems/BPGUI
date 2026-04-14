"use client";

interface SummaryCardsProps {
  articlesToday: number;
  dailyAvg: number;
  activeSources: number;
  totalSources: number;
  trendingCount: number;
  loading: boolean;
}

export function SummaryCards({
  articlesToday,
  dailyAvg,
  activeSources,
  totalSources,
  trendingCount,
  loading,
}: SummaryCardsProps) {
  const cards = [
    {
      label: "Articles Today",
      value: articlesToday,
      sub: dailyAvg > 0 ? `avg ${dailyAvg}/day` : undefined,
      color: articlesToday >= dailyAvg ? "text-increase" : "text-decrease",
    },
    {
      label: "Active Sources",
      value: `${activeSources}/${totalSources}`,
      sub: activeSources === totalSources ? "all publishing" : `${totalSources - activeSources} silent`,
      color: activeSources === totalSources ? "text-increase" : "text-amber-500",
    },
    {
      label: "Top Entities",
      value: trendingCount,
      sub: "tracked",
      color: "text-accent",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-white p-4"
        >
          <p className="text-xs text-muted">{card.label}</p>
          <p className={`text-2xl font-semibold ${loading ? "text-muted" : card.color}`}>
            {loading ? "—" : card.value}
          </p>
          {card.sub && (
            <p className="text-xs text-muted mt-0.5">{card.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
