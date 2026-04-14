"use client";

import { ChatChart } from "./chat-chart";
import { ChatTable } from "./chat-table";

interface RenderedOutput {
  type: "chart" | "table";
  data: Record<string, unknown>;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  renderedOutputs?: RenderedOutput[];
  loading?: boolean;
}

function renderMarkdown(text: string): React.ReactNode[] {
  // Split by markdown patterns and render inline
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(remaining.slice(0, boldMatch.index));
      }
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Inline code: `text`
    const codeMatch = remaining.match(/`(.+?)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(remaining.slice(0, codeMatch.index));
      }
      parts.push(
        <code key={key++} className="rounded bg-surface px-1 py-0.5 text-xs font-mono">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    // No more matches
    parts.push(remaining);
    break;
  }

  return parts;
}

export function ChatMessage({
  role,
  content,
  renderedOutputs,
  loading,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
          isUser
            ? "bg-accent text-white"
            : "bg-white border border-border text-foreground"
        }`}
      >
        {loading ? (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:0.3s]" />
          </div>
        ) : (
          <>
            <div className="whitespace-pre-wrap leading-relaxed">
              {content.split("\n").map((line, i) => (
                <span key={i}>
                  {i > 0 && "\n"}
                  {renderMarkdown(line)}
                </span>
              ))}
            </div>
            {renderedOutputs && renderedOutputs.length > 0 && (
              <div className="mt-3 space-y-3">
                {renderedOutputs.map((output, i) => {
                  if (output.type === "chart") {
                    return (
                      <ChatChart
                        key={i}
                        type={output.data.type as "line" | "bar" | "pie"}
                        title={output.data.title as string | undefined}
                        data={output.data.data as Record<string, unknown>[]}
                        xKey={output.data.xKey as string}
                        yKeys={output.data.yKeys as string[]}
                      />
                    );
                  }
                  if (output.type === "table") {
                    return (
                      <ChatTable
                        key={i}
                        title={output.data.title as string | undefined}
                        columns={
                          output.data.columns as Array<{
                            key: string;
                            label: string;
                            format?: "text" | "number" | "date" | "percent";
                          }>
                        }
                        rows={output.data.rows as Record<string, unknown>[]}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
