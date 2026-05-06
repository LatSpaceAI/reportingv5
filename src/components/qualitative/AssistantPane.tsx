"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, ChevronRight, Send } from "./icons";

// Resizable, collapsible AI Assistant pane. Width + collapsed state are
// persisted in localStorage so the user's layout preference carries across
// navigations and reloads.

const STORAGE_KEY = "qualitative-app/assistant-pane/v1";
const MIN = 260;
const MAX = 520;
const DEFAULT_WIDTH = 320;

interface PaneState {
  width: number;
  collapsed: boolean;
}

const defaultState: PaneState = { width: DEFAULT_WIDTH, collapsed: false };

export function useAssistantPane() {
  const [state, setState] = useState<PaneState>(defaultState);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PaneState>;
      setState((prev) => ({ ...prev, ...parsed }));
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return { state, setState };
}

interface PaneProps {
  width: number;
  onWidthChange: (w: number) => void;
  onCollapse: () => void;
}

interface RetrievedSource {
  section: string;
  title: string;
  pages: string;
  score: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: RetrievedSource[];
}

export function AssistantPane({ width, onWidthChange, onCollapse }: PaneProps) {
  const [tab, setTab] = useState<"ask" | "write">("ask");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = e.clientX - d.startX;
      const next = Math.min(MAX, Math.max(MIN, d.startWidth - delta));
      onWidthChange(next);
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onWidthChange]);

  // Auto-scroll to the bottom as new tokens stream in.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming, retrieving]);

  // Cancel any in-flight request when the component unmounts.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = async () => {
    const text = prompt.trim();
    if (!text || streaming) return;
    setError(null);
    setPrompt("");

    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ];
    setMessages(next);
    setStreaming(true);
    setRetrieving(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(0, -1).map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "Request failed");
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          handleFrame(frame);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) =>
        prev.length && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content
          ? prev.slice(0, -1)
          : prev
      );
    } finally {
      setStreaming(false);
      setRetrieving(false);
      abortRef.current = null;
    }

    function handleFrame(frame: string) {
      let event = "message";
      let dataLine = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataLine = line.slice(6);
      }
      if (!dataLine) return;
      let data: unknown;
      try {
        data = JSON.parse(dataLine);
      } catch {
        return;
      }
      if (event === "retrieved" && Array.isArray(data)) {
        setRetrieving(false);
        const sources = data as RetrievedSource[];
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, sources };
          }
          return copy;
        });
      } else if (event === "text" && data && typeof (data as { text: unknown }).text === "string") {
        const delta = (data as { text: string }).text;
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + delta };
          }
          return copy;
        });
      } else if (event === "error" && data && typeof (data as { message: unknown }).message === "string") {
        setError((data as { message: string }).message);
      }
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  };

  return (
    <>
      <div
        onMouseDown={onMouseDown}
        className="group relative w-1 shrink-0 cursor-col-resize bg-slate-200 hover:bg-brand/60 active:bg-brand"
        role="separator"
        aria-orientation="vertical"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <aside
        className="flex shrink-0 flex-col border-l border-slate-200 bg-white"
        style={{ width }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-medium text-slate-800">AI Assistant</div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                title="Clear conversation"
                className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                Clear
              </button>
            )}
            <button
              onClick={onCollapse}
              title="Collapse panel"
              className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex gap-4 text-sm">
            <button
              onClick={() => setTab("ask")}
              className={`pb-1 ${
                tab === "ask"
                  ? "border-b-2 border-brand font-medium text-slate-900"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              Ask
            </button>
            <button
              onClick={() => setTab("write")}
              className={`pb-1 ${
                tab === "write"
                  ? "border-b-2 border-brand font-medium text-slate-900"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              Write
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {tab === "ask" ? (
            messages.length === 0 ? (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-500">
                <div>
                  <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100">
                    🤖
                  </div>
                  <div>Ask questions about the CBAM guidance document.</div>
                  <ul className="mx-auto mt-4 max-w-[260px] space-y-1.5 text-left text-xs text-slate-500">
                    <li>· What does the regulation require for system boundaries?</li>
                    <li>· Summarise the QA/QC procedures</li>
                    <li>· What goes into the Monitoring Methodology Document?</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1;
                  return (
                    <div key={i} className="space-y-2">
                      <MessageBubble
                        role={m.role}
                        content={m.content}
                        streaming={streaming && isLast && m.role === "assistant"}
                        retrieving={retrieving && isLast && m.role === "assistant"}
                      />
                      {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                        <SourcesList sources={m.sources} />
                      )}
                    </div>
                  );
                })}
                {error && (
                  <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-500">
              <div>
                <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100">
                  ✍️
                </div>
                <div>Generate or extend a section of your report.</div>
                <p className="mt-3 text-xs text-slate-400">
                  Coming soon — for now, use the Ask tab to chat with the guidance document.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2 border border-slate-200 px-3 py-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={tab === "ask" ? "Ask a question..." : "Describe the section to draft..."}
              className="flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
              disabled={streaming || tab === "write"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (tab === "ask") send();
                }
              }}
            />
            <button
              className="text-brand disabled:text-slate-300"
              aria-label="send"
              disabled={!prompt.trim() || streaming || tab === "write"}
              onClick={() => tab === "ask" && send()}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            AI suggestions are drafts — review before inserting.
          </p>
        </div>
      </aside>
    </>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
  retrieving,
}: {
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
  retrieving: boolean;
}) {
  const isUser = role === "user";
  const placeholder = !content && (
    <span className="text-slate-400">
      {retrieving ? "Searching guidance document…" : streaming ? "…" : null}
    </span>
  );
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] break-words px-3 py-2 text-sm ${
          isUser ? "whitespace-pre-wrap bg-brand/10 text-slate-800" : "bg-slate-50 text-slate-800"
        }`}
      >
        {isUser ? (
          content
        ) : content ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="mt-2 mb-1 text-base font-semibold first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h3>,
              h4: ({ children }) => <h4 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h4>,
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>,
              li: ({ children }) => <li className="leading-snug">{children}</li>,
              code: ({ children }) => (
                <code className="bg-slate-200/60 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
              ),
              pre: ({ children }) => (
                <pre className="my-2 overflow-x-auto bg-slate-200/60 p-2 font-mono text-xs">{children}</pre>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-2 border-l-2 border-slate-300 pl-3 text-slate-700">{children}</blockquote>
              ),
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noreferrer" className="text-brand underline">
                  {children}
                </a>
              ),
              hr: () => <hr className="my-3 border-slate-200" />,
              table: ({ children }) => (
                <div className="my-2 -mx-1 overflow-x-auto">
                  <table className="w-full border-collapse text-xs">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => <tr className="border-b border-slate-200 last:border-b-0">{children}</tr>,
              th: ({ children }) => (
                <th className="border border-slate-200 px-2 py-1 text-left font-semibold">{children}</th>
              ),
              td: ({ children }) => (
                <td className="border border-slate-200 px-2 py-1 align-top">{children}</td>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        ) : (
          placeholder
        )}
      </div>
    </div>
  );
}

function SourcesList({ sources }: { sources: RetrievedSource[] }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="border border-slate-200 bg-white"
    >
      <summary className="cursor-pointer select-none px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500 hover:bg-slate-50">
        {sources.length} source{sources.length === 1 ? "" : "s"}
      </summary>
      <ul className="space-y-1 px-3 py-2 text-xs">
        {sources.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono font-medium text-slate-700">{s.section}</span>
            <span className="truncate text-slate-600" title={s.title}>
              {s.title}
            </span>
            <span className="ml-auto shrink-0 text-slate-400">{s.pages}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function CollapsedAssistantRail({ onExpand }: { onExpand: () => void }) {
  return (
    <aside className="flex w-10 shrink-0 flex-col items-center border-l border-slate-200 bg-white py-3">
      <button
        onClick={onExpand}
        title="Expand AI Assistant"
        className="p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div
        className="mt-3 text-[11px] uppercase tracking-wider text-slate-400"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        AI Assistant
      </div>
    </aside>
  );
}
