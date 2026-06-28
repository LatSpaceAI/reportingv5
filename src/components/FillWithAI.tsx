"use client";

// "Fill with AI" — proposes values for the active question's fields, which the
// user reviews and accepts/dismisses one by one (or all at once). The agent
// runs in the sandbox via /api/fill (OpenAI Agents SDK); results stream back as
// per-field proposals with a source + confidence.

import { useCallback, useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/frameworkTypes";
import type { RowValues } from "@/components/Fields";
import { runFill, type FillProposal, type ProposedField } from "@/lib/fillClient";

type Phase = "idle" | "running" | "review" | "error";

function fieldLabel(q: Question, fieldId: string): string {
  const list = q.kind === "fields" ? q.fields : q.columns;
  return list.find((f) => f.id === fieldId)?.label ?? fieldId;
}

function fmtValue(v: ProposedField["value"]): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function confidenceTone(c: number): string {
  if (c >= 0.75) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (c >= 0.4) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

// lucide: sparkles
function SparkIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

export function FillWithAI({
  frameworkId,
  question,
  values,
  rows,
  onValues,
  onRows,
}: {
  frameworkId: string;
  question: Question;
  values: RowValues;
  rows: RowValues[];
  onValues: (v: RowValues) => void;
  onRows: (r: RowValues[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [activity, setActivity] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [proposal, setProposal] = useState<FillProposal | null>(null);
  // Field ids the user has already accepted or dismissed this round.
  const [resolved, setResolved] = useState<Record<string, "accepted" | "dismissed">>({});
  const abortRef = useRef<AbortController | null>(null);

  // Current values snapshot to send so the agent skips already-filled fields.
  const existingValues = useMemo<Record<string, unknown>>(() => {
    if (question.kind === "fields") return { ...values };
    // For tables, summarise filled column ids from the first row (enough signal
    // for the agent; full per-row diffing isn't needed in v1).
    return { ...(rows[0] ?? {}) };
  }, [question.kind, values, rows]);

  const start = useCallback(async () => {
    setPhase("running");
    setActivity("Starting…");
    setError("");
    setProposal(null);
    setResolved({});
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await runFill(
        {
          frameworkId,
          questions: [{ id: question.id, existingValues }],
          signal: ac.signal,
        },
        {
          onActivity: (t) => setActivity(t),
          onProposal: (p) => {
            setProposal(p);
            setPhase("review");
          },
          onError: (m) => {
            setError(m);
            setPhase("error");
          },
          onDone: () => {
            // If we got a proposal we're already in review; otherwise nothing
            // was returned.
            setPhase((prev) => (prev === "review" ? prev : "idle"));
          },
        }
      );
    } catch (err) {
      if (ac.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }, [frameworkId, question.id, existingValues]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
  }, []);

  const acceptField = useCallback(
    (pf: ProposedField) => {
      if (question.kind === "fields") {
        onValues({ ...values, [pf.fieldId]: pf.value });
      } else {
        // Write into the first row (single-row fill in v1).
        const next = rows.length ? [...rows] : [{}];
        next[0] = { ...next[0], [pf.fieldId]: pf.value };
        onRows(next);
      }
      setResolved((r) => ({ ...r, [pf.fieldId]: "accepted" }));
    },
    [question.kind, values, rows, onValues, onRows]
  );

  const dismissField = useCallback((fieldId: string) => {
    setResolved((r) => ({ ...r, [fieldId]: "dismissed" }));
  }, []);

  const acceptAll = useCallback(() => {
    if (!proposal) return;
    const pending = proposal.fields.filter((f) => !resolved[f.fieldId]);
    if (question.kind === "fields") {
      const merged = { ...values };
      for (const f of pending) merged[f.fieldId] = f.value;
      onValues(merged);
    } else {
      const next = rows.length ? [...rows] : [{}];
      const row = { ...next[0] };
      for (const f of pending) row[f.fieldId] = f.value;
      next[0] = row;
      onRows(next);
    }
    setResolved((r) => {
      const copy = { ...r };
      for (const f of pending) copy[f.fieldId] = "accepted";
      return copy;
    });
  }, [proposal, resolved, question.kind, values, rows, onValues, onRows]);

  const close = useCallback(() => {
    setPhase("idle");
    setProposal(null);
    setResolved({});
  }, []);

  const pendingCount = proposal
    ? proposal.fields.filter((f) => !resolved[f.fieldId]).length
    : 0;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={phase === "running" ? cancel : start}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            phase === "running"
              ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              : "bg-brand text-white hover:bg-brand-dark"
          }`}
        >
          <SparkIcon />
          {phase === "running" ? "Cancel" : "Fill with AI"}
        </button>
        {phase === "running" && (
          <span className="flex items-center gap-2 text-sm text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
            {activity}
          </span>
        )}
      </div>

      {phase === "error" && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error || "Something went wrong."}
        </div>
      )}

      {phase === "review" && proposal && (
        <div className="mt-3 rounded-lg border border-brand/30 bg-brand/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <SparkIcon className="h-4 w-4 text-brand" />
              AI suggestions ({pendingCount} to review)
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={acceptAll}
                  className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark"
                >
                  Accept all
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>

          <ul className="mt-3 space-y-2">
            {proposal.fields.map((pf) => {
              const state = resolved[pf.fieldId];
              return (
                <li
                  key={pf.fieldId}
                  className={`rounded-md border bg-white p-3 ${
                    state === "accepted"
                      ? "border-emerald-200"
                      : state === "dismissed"
                      ? "border-slate-200 opacity-50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-500">
                        {fieldLabel(question, pf.fieldId)}
                      </div>
                      <div className="mt-0.5 break-words text-sm text-slate-900">
                        {fmtValue(pf.value)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span
                          className={`rounded border px-1.5 py-0.5 ${confidenceTone(
                            pf.confidence
                          )}`}
                        >
                          {Math.round(pf.confidence * 100)}% confident
                        </span>
                        <span className="truncate">Source: {pf.source}</span>
                      </div>
                      {pf.rationale && (
                        <div className="mt-1 text-[11px] italic text-slate-400">
                          {pf.rationale}
                        </div>
                      )}
                    </div>
                    {!state && (
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => acceptField(pf)}
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissField(pf.fieldId)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {state === "accepted" && (
                      <span className="shrink-0 text-xs font-medium text-emerald-600">
                        ✓ Accepted
                      </span>
                    )}
                    {state === "dismissed" && (
                      <span className="shrink-0 text-xs text-slate-400">Dismissed</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {proposal.unfilled && proposal.unfilled.length > 0 && (
            <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-500">
              <div className="font-medium text-slate-600">
                Couldn&apos;t find grounded values for:
              </div>
              <ul className="mt-1 list-disc pl-4">
                {proposal.unfilled.map((u) => (
                  <li key={u.fieldId}>
                    {fieldLabel(question, u.fieldId)} — {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
