"use client";

interface Entity {
  entity_name: string;
  entity_type: string;
  total_mentions: number;
  article_count: number;
  avg_confidence: number;
  in_title_pct: number;
  top_sentiment: string;
}

const TYPE_COLORS: Record<string, string> = {
  company: "bg-accent/10 text-accent",
  destination: "bg-increase/10 text-increase",
  industry_body: "bg-removed/10 text-removed",
};

export function EntityTable({
  entities,
  selectedEntity,
  onSelect,
}: {
  entities: Entity[];
  selectedEntity: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-2 pr-4 font-medium text-muted">Entity</th>
            <th className="pb-2 pr-4 font-medium text-muted">Type</th>
            <th className="pb-2 pr-4 font-medium text-muted text-right">
              Mentions
            </th>
            <th className="pb-2 pr-4 font-medium text-muted text-right">
              Articles
            </th>
            <th className="pb-2 font-medium text-muted text-right">
              Confidence
            </th>
          </tr>
        </thead>
        <tbody>
          {entities.map((entity) => (
            <tr
              key={`${entity.entity_name}-${entity.entity_type}`}
              onClick={() => onSelect(entity.entity_name)}
              className={`border-b border-border/50 cursor-pointer transition-colors ${
                selectedEntity === entity.entity_name
                  ? "bg-accent/5"
                  : "hover:bg-surface"
              }`}
            >
              <td className="py-2.5 pr-4 font-medium text-foreground">
                {entity.entity_name}
              </td>
              <td className="py-2.5 pr-4">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    TYPE_COLORS[entity.entity_type] || "bg-surface text-muted"
                  }`}
                >
                  {entity.entity_type.replace("_", " ")}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-right text-foreground">
                {entity.total_mentions.toLocaleString()}
              </td>
              <td className="py-2.5 pr-4 text-right text-muted">
                {entity.article_count.toLocaleString()}
              </td>
              <td className="py-2.5 text-right text-muted">
                {(entity.avg_confidence * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
