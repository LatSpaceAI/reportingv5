"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block, Proposal, QualitativeDoc } from "@/lib/qualitative/types";
import { Check, ChevronLeft, ChevronRight, Send, X } from "./icons";

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

export interface ActiveQuestionContext {
  id: string;
  label: string;
  sectionId: string;
  sectionTitle: string;
  questionKind: "fields" | "table";
  description?: string;
}

export interface ActiveAnswerSummary {
  status: "not-started" | "in-progress" | "completed";
  filledCount: number;
  totalFields: number;
  preview?: string;
}

interface PaneProps {
  width: number;
  onWidthChange: (w: number) => void;
  onCollapse: () => void;
  // The four write-mode props are only wired in surfaces that have a
  // QualitativeDoc to insert into (the report editor). When omitted, the Write
  // tab falls back to a "not available here" state.
  doc?: QualitativeDoc;
  onAddProposal?: (
    proposal: {
      afterBlockId: string | null;
      blocks: Proposal["blocks"];
      rationale: string;
      sources?: Proposal["sources"];
    }
  ) => Proposal;
  onAcceptProposal?: (proposalId: string) => void;
  onRejectProposal?: (proposalId: string) => void;
  onScrollToProposal?: (proposalId: string) => void;
  // Framework registry id (e.g. "cbam", "cbam-mmd"). Forwarded to the
  // chat/write APIs so the agent retrieves from the right guidance index.
  frameworkId?: string;
  // Excel-style: the question the user is currently looking at. Sent with each
  // Ask request so the agent answers in the context of that question.
  activeQuestion?: ActiveQuestionContext;
  activeAnswer?: ActiveAnswerSummary;
}

interface RetrievedSource {
  section: string;
  title: string;
  pages: string;
  score: number;
}

// Live activity event — emitted by the route as the agent calls tools.
// Mirrors AgentActivity in agent-runner/lib/agent/activity.ts.
interface AgentActivity {
  kind: "guidance" | "websearch" | "webfetch" | "propose" | "tool";
  label: string;
  detail?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: RetrievedSource[];
  activities?: AgentActivity[];
}

// Write-mode message: the user's instruction or the assistant's reply.
// Assistant replies optionally carry a proposalId once the proposal lands.
interface WriteMessage {
  role: "user" | "assistant";
  content: string;
  proposalId?: string;
  sources?: RetrievedSource[];
  activities?: AgentActivity[];
}

// Response shape for the propose_insert tool — must match the schema in
// /api/write/route.ts.
interface ProposalEvent {
  after_block_id: string | null;
  blocks: Proposal["blocks"];
  rationale: string;
  sources?: Proposal["sources"];
}

// Curated starter prompts shown in the empty state. Highlighted suggestion is
// visually emphasised; the rest are outlined chips. Suggestion text is sent
// verbatim when clicked.
function askSuggestionsFor(frameworkId: string | undefined): string[] {
  if (frameworkId === "ccts") {
    return [
      "What does the BEE Detailed Procedure require for designated consumers?",
      "Explain the compliance mechanism under CCTS",
      "How are carbon credits issued and traded under CCTS?",
    ];
  }
  return [
    "What does the regulation require for system boundaries?",
    "Summarise the QA/QC procedures",
    "What goes into the Monitoring Methodology Document?",
  ];
}

function writeSuggestionsFor(frameworkId: string | undefined): string[] {
  if (frameworkId === "ccts") {
    return [
      "Add a new section after Section 2 about the monitoring plan",
      "Insert a paragraph below the Gate-to-Gate boundary heading",
      "Draft a table summarising emission sources and source streams",
    ];
  }
  return [
    "Add a new section after Section 2 about QA/QC procedures",
    "Insert a paragraph below the system boundary heading",
    "Draft a table summarising data sources",
  ];
}

// Build a compact outline of the live document for the write API.
function buildOutline(blocks: Block[]) {
  return blocks.map((b) => {
    const base: { id: string; kind: string; level?: 1 | 2 | 3; heading?: string; preview?: string } = {
      id: b.id,
      kind: b.kind,
    };
    if (b.kind === "heading") {
      base.level = b.level;
      base.heading = b.text;
    } else if (b.kind === "paragraph") {
      base.preview = b.text.length > 120 ? b.text.slice(0, 120) + "…" : b.text;
    } else if (b.kind === "table") {
      base.preview = `[table: ${b.columns.join(", ")}]`;
    } else if (b.kind === "section-marker") {
      base.preview = `[section marker: ${b.label}]`;
    } else if (b.kind === "requirement-ref") {
      base.preview = `[requirement-ref: ${b.requirementId}]`;
    } else if (b.kind === "data-ref") {
      base.preview = `[data-ref: ${b.metricId}]`;
    } else if (b.kind === "diagram") {
      const firstLine = b.source.split("\n")[0]?.trim() ?? "diagram";
      base.preview = `[diagram (mermaid): ${firstLine.length > 60 ? firstLine.slice(0, 60) + "…" : firstLine}]`;
    }
    return base;
  });
}

export function AssistantPane({
  width,
  onWidthChange,
  onCollapse,
  doc,
  onAddProposal,
  onAcceptProposal,
  onRejectProposal,
  onScrollToProposal,
  frameworkId,
  activeQuestion,
  activeAnswer,
}: PaneProps) {
  const [tab, setTab] = useState<"ask" | "write">("ask");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [writeMessages, setWriteMessages] = useState<WriteMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextEnabled, setContextEnabled] = useState(true);
  // Whenever the user navigates to a different question (or opens a different
  // doc), default the context back on — a fresh surface is a fresh decision.
  useEffect(() => {
    setContextEnabled(true);
  }, [activeQuestion?.id, doc?.title]);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Build the context payload sent with each Ask request. Word-style reports
  // pass the full document outline; Excel-style reports pass the active
  // question. When `contextEnabled` is false the user has explicitly opted out
  // for this turn, so we send null.
  const askContext = useMemo(() => {
    if (!contextEnabled) return null;
    if (activeQuestion) {
      return {
        kind: "question" as const,
        question: activeQuestion,
        answer: activeAnswer,
      };
    }
    if (doc) {
      return {
        kind: "document" as const,
        title: doc.title,
        outline: buildOutline(doc.blocks),
      };
    }
    return null;
  }, [contextEnabled, activeQuestion, activeAnswer, doc]);

  // Index proposals by id so the chat-side card can reflect the current state
  // (still pending vs. accepted vs. rejected — a proposal not in the doc means
  // the user resolved it from the editor side).
  const proposalsById = useMemo(() => {
    const map = new Map<string, Proposal>();
    for (const p of doc?.proposals ?? []) map.set(p.id, p);
    return map;
  }, [doc?.proposals]);

  const writeAvailable = Boolean(doc && onAddProposal && onAcceptProposal && onRejectProposal && onScrollToProposal);

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
  }, [messages, writeMessages, streaming, retrieving]);

  // Cancel any in-flight request when the component unmounts.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = async (override?: string) => {
    const text = (override ?? prompt).trim();
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
          framework: frameworkId,
          context: askContext,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "Request failed");
        throw new Error(msg || `HTTP ${res.status}`);
      }

      await readNdjson(res, (ev) => handleEvent(ev.event, ev.data));
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

    function handleEvent(event: string, data: unknown) {
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
      } else if (event === "activity" && data && typeof (data as { kind: unknown }).kind === "string") {
        setRetrieving(false);
        const activity = data as AgentActivity;
        setMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, activities: [...(last.activities ?? []), activity] };
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

  const sendWrite = async (override?: string) => {
    const text = (override ?? prompt).trim();
    if (!text || streaming) return;
    if (!doc || !onAddProposal) return;
    setError(null);
    setPrompt("");

    const next: WriteMessage[] = [
      ...writeMessages,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ];
    setWriteMessages(next);
    setStreaming(true);
    setRetrieving(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: text,
          outline: buildOutline(doc.blocks),
          framework: frameworkId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "Request failed");
        throw new Error(msg || `HTTP ${res.status}`);
      }

      await readNdjson(res, (ev) => handleWriteEvent(ev.event, ev.data));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setWriteMessages((prev) =>
        prev.length && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content
          ? prev.slice(0, -1)
          : prev
      );
    } finally {
      setStreaming(false);
      setRetrieving(false);
      abortRef.current = null;
    }

    function handleWriteEvent(event: string, data: unknown) {
      if (event === "retrieved" && Array.isArray(data)) {
        setRetrieving(false);
        const sources = data as RetrievedSource[];
        setWriteMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") copy[copy.length - 1] = { ...last, sources };
          return copy;
        });
      } else if (event === "activity" && data && typeof (data as { kind: unknown }).kind === "string") {
        setRetrieving(false);
        const activity = data as AgentActivity;
        setWriteMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, activities: [...(last.activities ?? []), activity] };
          }
          return copy;
        });
      } else if (event === "text" && data && typeof (data as { text: unknown }).text === "string") {
        const delta = (data as { text: string }).text;
        setWriteMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + delta };
          }
          return copy;
        });
      } else if (event === "proposal" && data && typeof data === "object") {
        const ev = data as ProposalEvent;
        if (!onAddProposal) return;
        const proposal = onAddProposal({
          afterBlockId: ev.after_block_id,
          blocks: ev.blocks,
          rationale: ev.rationale,
          sources: ev.sources,
        });
        setWriteMessages((prev) => {
          const copy = prev.slice();
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = {
              ...last,
              content: last.content || ev.rationale,
              proposalId: proposal.id,
            };
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
    if (tab === "ask") setMessages([]);
    else setWriteMessages([]);
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
            {(tab === "ask" ? messages.length > 0 : writeMessages.length > 0) && (
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
              <SuggestionEmptyState
                heading="What can I help you with?"
                subheading="Here are some suggestions to get you started:"
                suggestions={askSuggestionsFor(frameworkId)}
                onPick={(text) => send(text)}
                disabled={streaming}
              />
            ) : (
              <div className="space-y-3 p-4">
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1;
                  const isActive = streaming && isLast && m.role === "assistant";
                  return (
                    <div key={i} className="space-y-2">
                      {m.role === "assistant" && m.activities && m.activities.length > 0 && (
                        <ActivityLog activities={m.activities} active={isActive && !m.content} />
                      )}
                      <MessageBubble
                        role={m.role}
                        content={m.content}
                        streaming={isActive}
                        retrieving={retrieving && isLast && m.role === "assistant" && !(m.activities?.length)}
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
          ) : !writeAvailable ? (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-500">
              <div>
                <div>Write mode isn&apos;t available for this report type.</div>
                <p className="mt-3 text-xs text-slate-400">
                  This report uses a structured questionnaire, so the AI can&apos;t insert drafted sections directly. Use the <span className="font-medium text-slate-600">Ask</span> tab to query the guidance, then paste the answer into the relevant question.
                </p>
              </div>
            </div>
          ) : writeMessages.length === 0 ? (
            <SuggestionEmptyState
              heading="What can I help you draft?"
              subheading="Here are some suggestions to get you started:"
              suggestions={writeSuggestionsFor(frameworkId)}
              onPick={(text) => sendWrite(text)}
              disabled={streaming}
            />
          ) : (
            <div className="space-y-3 p-4">
              {writeMessages.map((m, i) => {
                const isLast = i === writeMessages.length - 1;
                const isActive = streaming && isLast && m.role === "assistant" && !m.proposalId;
                const proposal = m.proposalId ? proposalsById.get(m.proposalId) : null;
                return (
                  <div key={i} className="space-y-2">
                    {m.role === "assistant" && m.activities && m.activities.length > 0 && (
                      <ActivityLog activities={m.activities} active={isActive && !m.content} />
                    )}
                    <MessageBubble
                      role={m.role}
                      content={m.content}
                      streaming={isActive}
                      retrieving={retrieving && isLast && m.role === "assistant" && !(m.activities?.length)}
                    />
                    {m.role === "assistant" && m.proposalId && onAcceptProposal && onRejectProposal && onScrollToProposal && (
                      <ProposalChatCard
                        proposalId={m.proposalId}
                        proposal={proposal}
                        onAccept={onAcceptProposal}
                        onReject={onRejectProposal}
                        onScrollTo={onScrollToProposal}
                      />
                    )}
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
          )}
        </div>

        <div className="border-t border-slate-200 p-3">
          {tab === "ask" && (activeQuestion || doc) && (
            <ContextChip
              label={
                activeQuestion
                  ? `${activeQuestion.id} — ${truncate(activeQuestion.label, 40)}`
                  : doc
                  ? `Doc: ${truncate(doc.title, 40)}`
                  : ""
              }
              enabled={contextEnabled}
              onToggle={() => setContextEnabled((v) => !v)}
            />
          )}
          <div className="flex items-center gap-2 border border-slate-200 px-3 py-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={tab === "ask" ? "Ask a question..." : "Describe the section to draft..."}
              className="flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
              disabled={streaming || (tab === "write" && !writeAvailable)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (tab === "ask") send();
                  else if (writeAvailable) sendWrite();
                }
              }}
            />
            <button
              className="text-brand disabled:text-slate-300"
              aria-label="send"
              disabled={!prompt.trim() || streaming || (tab === "write" && !writeAvailable)}
              onClick={() => (tab === "ask" ? send() : writeAvailable && sendWrite())}
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
      {retrieving ? "Thinking…" : streaming ? "…" : null}
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

// Compact card shown under an assistant Write reply. Mirrors the editor's
// proposal block — Accept/Reject here updates the same proposal record, so
// resolving from either surface clears it from both.
function ProposalChatCard({
  proposalId,
  proposal,
  onAccept,
  onReject,
  onScrollTo,
}: {
  proposalId: string;
  proposal: Proposal | null | undefined;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onScrollTo: (id: string) => void;
}) {
  // Proposal already resolved (accepted or rejected) — show a neutral chip.
  if (!proposal) {
    return (
      <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        Proposal resolved.
      </div>
    );
  }
  const summary = proposal.blocks.map((b, i) => {
    const prefix = i === 0 ? "" : "+ ";
    if (b.kind === "heading") return `${prefix}H${b.level} "${truncate(b.text, 40)}"`;
    if (b.kind === "paragraph") return `${prefix}¶ ${truncate(b.text, 40)}`;
    if (b.kind === "diagram") {
      const firstLine = b.source.split("\n")[0]?.trim() ?? "diagram";
      return `${prefix}Diagram (${truncate(firstLine, 30)})`;
    }
    return `${prefix}Table (${b.columns.length} cols × ${b.rows.length} rows)`;
  });
  return (
    <div className="border border-emerald-300 bg-emerald-50/60 text-xs">
      <button
        type="button"
        onClick={() => onScrollTo(proposalId)}
        className="block w-full px-3 py-2 text-left hover:bg-emerald-100/50"
      >
        <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-emerald-700">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center bg-emerald-600 text-[9px] text-white">
            AI
          </span>
          Proposed insertion
          <span className="font-normal normal-case tracking-normal text-emerald-700/70">
            · click to view
          </span>
        </div>
        <ul className="space-y-0.5 text-slate-700">
          {summary.map((s, i) => (
            <li key={i} className="truncate">
              {s}
            </li>
          ))}
        </ul>
      </button>
      <div className="flex items-center justify-end gap-1 border-t border-emerald-200 px-2 py-1.5">
        <button
          onClick={() => onReject(proposalId)}
          className="inline-flex items-center gap-1 border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
        >
          <X className="h-3 w-3" />
          Reject
        </button>
        <button
          onClick={() => onAccept(proposalId)}
          className="inline-flex items-center gap-1 border border-emerald-600 bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
        >
          <Check className="h-3 w-3" />
          Accept
        </button>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Tiny chip above the Ask input that surfaces the context being sent
// (current question or current document). Click to toggle off — useful when
// the user wants a generic question untethered from the current view.
function ContextChip({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  if (!enabled) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Click to send with context"
        className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-400 hover:border-slate-300 hover:text-slate-600"
      >
        <span className="shrink-0 font-medium uppercase tracking-wider">Context off</span>
        <span className="truncate line-through">{label}</span>
      </button>
    );
  }
  return (
    <span className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand/30 bg-brand/5 py-0.5 pl-2.5 pr-1 text-[11px] text-brand">
      <span className="shrink-0 font-medium uppercase tracking-wider">Context</span>
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Remove context"
        title="Remove context for next message"
        className="ml-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-brand/70 hover:bg-brand/15 hover:text-brand"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// Empty-state with click-to-send suggestion chips. The first suggestion is
// shown as the highlighted "primary" choice; the rest are outlined.
function SuggestionEmptyState({
  heading,
  subheading,
  suggestions,
  onPick,
  disabled,
}: {
  heading: string;
  subheading: string;
  suggestions: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex h-full flex-col px-5 pt-12 pb-6">
      <h3 className="text-base font-semibold text-slate-800">{heading}</h3>
      <p className="mt-1 text-sm text-slate-500">{subheading}</p>
      <div className="mt-4 space-y-2">
        {suggestions.map((s, i) => {
          const primary = i === 0;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onPick(s)}
              className={
                primary
                  ? "w-full border border-brand/30 bg-brand/5 px-4 py-2 text-left text-sm text-brand hover:bg-brand/10 disabled:opacity-50"
                  : "w-full border border-slate-200 bg-white px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              }
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Live activity log shown while the agent is working. Each tool call (search,
// web search, web fetch, etc.) becomes a row. The most recent row spins while
// the agent is still active and the assistant text hasn't started arriving.
function ActivityLog({ activities, active }: { activities: AgentActivity[]; active: boolean }) {
  return (
    <div className="border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs">
      <ul className="space-y-1.5">
        {activities.map((a, i) => {
          const isLast = i === activities.length - 1;
          const spinning = active && isLast;
          return (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{activityIcon(a.kind, spinning)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-slate-700">{a.label}</div>
                {a.detail && (
                  <div className="truncate text-[11px] text-slate-500" title={a.detail}>
                    {a.detail}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function activityIcon(kind: AgentActivity["kind"], spinning: boolean) {
  if (spinning) {
    return (
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
    );
  }
  const tag =
    kind === "guidance"
      ? "GUIDE"
      : kind === "websearch"
      ? "WEB"
      : kind === "webfetch"
      ? "FETCH"
      : kind === "propose"
      ? "DRAFT"
      : "TOOL";
  return (
    <span className="inline-block min-w-[36px] bg-slate-200 px-1 py-px text-center font-mono text-[9px] font-medium uppercase tracking-wider text-slate-600">
      {tag}
    </span>
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

// Reads an NDJSON streaming response and dispatches each line as soon as it
// arrives. The /api/chat and /api/write routes emit one JSON object per line
// (text deltas, activity, sources, errors), so each `onEvent` callback fires
// progressively rather than all at once at the end.
async function readNdjson(
  res: Response,
  onEvent: (ev: { event: string; data: unknown }) => void
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line));
        } catch {
          // Skip malformed lines rather than aborting the whole stream.
        }
      }
      nl = buffer.indexOf("\n");
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail));
    } catch {}
  }
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
