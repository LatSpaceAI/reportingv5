"use client";

import { useEffect, useRef, useState } from "react";

import { ChartMessage } from "@/components/dashboard/ChartMessage";
import { useDashboardChat } from "@/components/dashboard/use-dashboard-chat";

// Anchored to metrics that actually have filed data — suggesting a chart that
// renders empty is a worse first impression than suggesting nothing.
const SUGGESTIONS = [
  "What's our total Scope 2 emissions?",
  "Show water withdrawal through the year for Birla Aurora",
  "Compare renewable electricity across sites",
  "Water withdrawal by source",
];

// lucide: arrow-up
function ArrowUpIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </svg>
  );
}

export function AiSearchBar() {
  const { messages, sending, send } = useDashboardChat();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function submit(text: string) {
    if (!text.trim() || sending) return;
    setOpen(true);
    setInput("");
    await send(text);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="relative flex items-center gap-2 border border-[#0A0A0A]/15 bg-white px-3 py-2 focus-within:border-[#074D47]/50"
      >
        <textarea
          value={input}
          rows={1}
          onFocus={() => {
            if (messages.length > 0) setOpen(true);
          }}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          placeholder="Ask for a chart — e.g. “Scope 1 through the year”"
          disabled={sending}
          className="flex-1 resize-none bg-transparent text-sm text-[#0A0A0A] placeholder:text-[#0A0A0A]/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center bg-[#074D47] text-white transition-opacity disabled:opacity-40"
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <ArrowUpIcon />
          )}
        </button>
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden border border-[#0A0A0A]/15 bg-white shadow-lg">
          <div
            ref={scrollRef}
            className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 ? (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-[#0A0A0A]/45">
                  Try asking
                </div>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="block w-full border border-[#0A0A0A]/10 px-3 py-2 text-left text-sm text-[#0A0A0A]/80 transition-colors hover:border-[#074D47]/40 hover:text-[#074D47]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={m.role === "user" ? "flex justify-end" : "block"}
                >
                  {m.role === "user" ? (
                    <div className="bg-[#074D47] px-3.5 py-2 text-sm text-white">
                      {m.text}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {m.streaming && m.blocks.length === 0 && (
                        <div className="text-sm text-[#0A0A0A]/45">Thinking…</div>
                      )}
                      {m.blocks.map((b, i) => {
                        if (b.kind === "text")
                          return (
                            <div key={i} className="text-sm text-[#0A0A0A]/80">
                              {b.text}
                            </div>
                          );
                        if (b.kind === "error")
                          return (
                            <div key={i} className="text-sm text-red-600">
                              {b.message}
                            </div>
                          );
                        return (
                          <ChartMessage key={i} spec={b.spec} data={b.data} />
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
