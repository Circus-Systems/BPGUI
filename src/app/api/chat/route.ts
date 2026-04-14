import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CHAT_TOOLS } from "@/lib/chat-tools";
import { validateSQL, injectLimit } from "@/lib/sql-guardrails";
import { NextResponse, type NextRequest } from "next/server";

const SYSTEM_PROMPT = `You are the BPG Intelligence Analyst — an AI assistant for competitive intelligence across Australian trade media (travel, cruise, pharmacy).

You have access to a Supabase/Postgres database with:
- **articles** — 335K+ articles from 13 publications (travel-weekly, karryon, travel-daily, latte, traveltalk, travel-monitor, travel-today-nz, global-travel-media, cruise-weekly, cruise-industry-news, seatrade-rss, travel-bulletin, ajp, pharmacy-daily)
- **article_entities** — extracted entities (companies, destinations, industry bodies) linked to articles via (source_id, external_id)
- **publications** — publication metadata (slug, name, url, vertical, is_competitor, enabled)
- **run_history** — collector run logs (collector_id, status, started_at, finished_at, items_collected, items_new)

Key patterns:
- published_at is TEXT — cast to timestamptz for date operations: published_at::timestamptz
- Verticals: travel (12 sources), pharmacy (2 sources: ajp, pharmacy-daily)
- Entity join: articles a JOIN article_entities ae ON a.source_id = ae.source_id AND a.external_id = ae.external_id
- Use render_chart and render_table to present results visually when appropriate.

Be concise and analytical. Focus on insights, not just data dumps.`;

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, vertical } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      vertical?: string;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const systemPrompt = vertical
      ? `${SYSTEM_PROMPT}\n\nThe user is currently viewing the ${vertical} vertical.`
      : SYSTEM_PROMPT;

    // Build Anthropic messages from chat history
    let currentMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const renderedOutputs: Array<{
      type: "chart" | "table";
      data: Record<string, unknown>;
    }> = [];

    let finalContent = "";
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools: CHAT_TOOLS,
        messages: currentMessages,
      });

      if (response.stop_reason === "end_turn") {
        for (const block of response.content) {
          if (block.type === "text") {
            finalContent += block.text;
          }
        }
        break;
      }

      if (response.stop_reason === "tool_use") {
        currentMessages.push({
          role: "assistant",
          content: response.content,
        });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = await executeTool(
              block.name,
              block.input as Record<string, unknown>
            );

            if (result.rendered) {
              renderedOutputs.push(result.rendered);
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result.content,
            });
          }
        }

        currentMessages.push({
          role: "user",
          content: toolResults,
        });
      } else {
        for (const block of response.content) {
          if (block.type === "text") {
            finalContent += block.text;
          }
        }
        break;
      }
    }

    return NextResponse.json({
      content: finalContent,
      rendered_outputs: renderedOutputs,
    });
  } catch (err) {
    console.error("Chat error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{
  content: string;
  rendered?: { type: "chart" | "table"; data: Record<string, unknown> };
}> {
  switch (name) {
    case "execute_sql": {
      const sql = input.sql as string;
      const validation = validateSQL(sql);
      if (!validation.valid) {
        return { content: `Error: ${validation.error}` };
      }

      const safeSql = injectLimit(sql);
      const supabase = await createClient();

      try {
        const { data, error } = await supabase.rpc("execute_raw_sql", {
          query_text: safeSql,
        });

        if (error) {
          return { content: `SQL error: ${error.message}` };
        }

        const rows = Array.isArray(data) ? data : [];
        return {
          content: `Query returned ${rows.length} rows.\n${JSON.stringify(rows, null, 2).slice(0, 8000)}`,
        };
      } catch (err) {
        return {
          content: `SQL error: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
      }
    }

    case "render_chart": {
      return {
        content: `Chart rendered: ${(input.title as string) || "Untitled chart"}`,
        rendered: { type: "chart", data: input },
      };
    }

    case "render_table": {
      const rowCount = Array.isArray(input.rows) ? input.rows.length : 0;
      return {
        content: `Table rendered with ${rowCount} rows: ${(input.title as string) || "Untitled table"}`,
        rendered: { type: "table", data: input },
      };
    }

    default:
      return { content: `Unknown tool: ${name}` };
  }
}
