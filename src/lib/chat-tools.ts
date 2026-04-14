import type Anthropic from "@anthropic-ai/sdk";

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "execute_sql",
    description:
      "Execute a read-only SQL query against the BPG Supabase database. " +
      "Available tables: articles (source_id, external_id, title, url, excerpt, author_name, published_at, word_count, is_sponsored, categories, content_text), " +
      "article_entities (source_id, external_id, entity_name, entity_type, confidence, mention_count, in_title, sentiment), " +
      "publications (slug, name, url, vertical, is_competitor, enabled), " +
      "run_history (id, collector_id, collector_type, status, started_at, finished_at, items_collected, items_new, items_updated, errors_json). " +
      "Join articles to article_entities via (source_id, external_id). " +
      "published_at is stored as TEXT in ISO format. Cast to timestamptz for date comparisons. " +
      "Only SELECT queries are allowed. Results are limited to 1000 rows.",
    input_schema: {
      type: "object" as const,
      properties: {
        sql: {
          type: "string",
          description: "The SELECT SQL query to execute.",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "render_chart",
    description:
      "Render a chart in the chat UI. Provide data as an array of objects, " +
      "a chart type, and axis configuration. The chart will be rendered using Recharts.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["line", "bar", "pie"],
          description: "Chart type.",
        },
        title: {
          type: "string",
          description: "Chart title.",
        },
        data: {
          type: "array",
          items: { type: "object" },
          description: "Array of data objects for the chart.",
        },
        xKey: {
          type: "string",
          description: "Key for the x-axis (or label key for pie charts).",
        },
        yKeys: {
          type: "array",
          items: { type: "string" },
          description: "Keys for the y-axis values (or value key for pie charts).",
        },
      },
      required: ["type", "data", "xKey", "yKeys"],
    },
  },
  {
    name: "render_table",
    description:
      "Render a formatted table in the chat UI. Provide column definitions and row data.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Table title.",
        },
        columns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              format: {
                type: "string",
                enum: ["text", "number", "date", "percent"],
              },
            },
            required: ["key", "label"],
          },
          description: "Column definitions.",
        },
        rows: {
          type: "array",
          items: { type: "object" },
          description: "Row data objects.",
        },
      },
      required: ["columns", "rows"],
    },
  },
];
