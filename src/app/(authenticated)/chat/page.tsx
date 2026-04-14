"use client";

import { useCallback, useRef, useState } from "react";
import { useVertical } from "@/hooks/use-vertical";
import { ChatMessage } from "@/components/chat/chat-message";

interface RenderedOutput {
  type: "chart" | "table";
  data: Record<string, unknown>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  renderedOutputs?: RenderedOutput[];
}

export default function ChatPage() {
  const { vertical } = useVertical();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      // Build message history for the API (text-only, no rendered outputs)
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, vertical }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to get response");
      }

      const data = await res.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.content || "I couldn't generate a response.",
        renderedOutputs: data.rendered_outputs,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong."}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-grow
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  return (
    <main className="flex-1 flex flex-col h-[calc(100vh-8rem)]">
      <div className="mx-auto w-full max-w-3xl flex flex-col flex-1 px-4">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">
                  BPG Intelligence Chat
                </p>
                <p className="text-sm text-muted mt-1">
                  Ask questions about {vertical === "travel" ? "travel & cruise" : "pharmacy"} trade media data.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {[
                    "What are the top 10 most mentioned entities this month?",
                    "How many articles were published this week by source?",
                    "Which publications have the highest sponsored content ratio?",
                    "Show me article volume trends over the last 30 days",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-xs rounded-lg border border-border bg-white px-3 py-2 text-muted hover:text-foreground hover:border-accent/30 transition-colors text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage
              key={i}
              role={msg.role}
              content={msg.content}
              renderedOutputs={msg.renderedOutputs}
            />
          ))}

          {loading && (
            <ChatMessage role="assistant" content="" loading />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-border bg-white py-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about articles, entities, publications..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
