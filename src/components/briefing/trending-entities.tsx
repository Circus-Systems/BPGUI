"use client";

interface TrendingEntity {
  entity_name: string;
  entity_type: string;
  total_mentions: number;
  article_count: number;
}

const TYPE_COLORS: Record<string, string> = {
  company: "bg-blue-100 text-blue-700",
  destination: "bg-emerald-100 text-emerald-700",
  industry_body: "bg-purple-100 text-purple-700",
  person: "bg-amber-100 text-amber-700",
};

export function TrendingEntities({
  entities,
  loading,
}: {
  entities: TrendingEntity[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-4">
        No entity data available.
      </p>
    );
  }

  const maxArticles = Math.max(...entities.map((e) => e.article_count));

  return (
    <div className="space-y-2">
      {entities.map((entity) => (
        <div
          key={entity.entity_name}
          className="flex items-center gap-3 text-sm"
        >
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              TYPE_COLORS[entity.entity_type] || "bg-gray-100 text-gray-600"
            }`}
          >
            {entity.entity_type}
          </span>
          <span className="font-medium text-foreground truncate flex-1">
            {entity.entity_name}
          </span>
          <div className="w-24 h-2 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-accent"
              style={{
                width: `${(entity.article_count / maxArticles) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs text-muted shrink-0 w-20 text-right">
            {entity.article_count} articles
          </span>
        </div>
      ))}
    </div>
  );
}
