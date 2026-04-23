"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { frameworks } from "@/lib/frameworks";
import type { Section, Question } from "@/lib/cbamSections";
import {
  readAnswers,
  readAssignees,
  writeAssignees,
  mockUsers,
  initials,
  formatUpdated,
  type Answers,
  type Assignees,
} from "@/lib/storage";
import { useToast } from "@/components/Toast";

export default function TablePage() {
  const { show } = useToast();
  const [expandedFw, setExpandedFw] = useState<Record<string, boolean>>({ cbam: true });
  const [expandedSection, setExpandedSection] = useState<Record<string, boolean>>({});
  const [answersByFw, setAnswersByFw] = useState<Record<string, Answers>>({});
  const [assigneesByFw, setAssigneesByFw] = useState<Record<string, Assignees>>({});

  useEffect(() => {
    const nextAnswers: Record<string, Answers> = {};
    const nextAssignees: Record<string, Assignees> = {};
    for (const fw of frameworks) {
      if (fw.status === "active" && fw.storageKey) {
        nextAnswers[fw.id] = readAnswers(fw.storageKey);
        nextAssignees[fw.id] = readAssignees(fw.id);
      }
    }
    setAnswersByFw(nextAnswers);
    setAssigneesByFw(nextAssignees);
  }, []);

  const updateAssignees = (frameworkId: string, questionId: string, userIds: string[]) => {
    setAssigneesByFw((prev) => {
      const current = prev[frameworkId] ?? {};
      const next = { ...current, [questionId]: userIds };
      writeAssignees(frameworkId, next);
      return { ...prev, [frameworkId]: next };
    });
  };

  const toggleFw = (id: string) =>
    setExpandedFw((p) => ({ ...p, [id]: !p[id] }));
  const toggleSection = (key: string) =>
    setExpandedSection((p) => ({ ...p, [key]: !p[key] }));

  const activeFrameworks = useMemo(
    () => frameworks.filter((f) => f.status === "active"),
    [],
  );

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Project Management</h1>
          <p className="text-sm text-slate-500">
            Assign owners and send reminders for each disclosure question.
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.9fr_1fr] border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500">
          <div>Name</div>
          <div>Report Section</div>
          <div>Sub-Section</div>
          <div>Assignees</div>
          <div>Last Updated</div>
          <div>Notify</div>
        </div>

        {activeFrameworks.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No active frameworks yet.
          </div>
        )}

        {activeFrameworks.map((fw) => {
          if (!fw.sections) return null;
          const fwOpen = expandedFw[fw.id] ?? false;
          const answers = answersByFw[fw.id] ?? {};
          const assignees = assigneesByFw[fw.id] ?? {};
          const totalQ = fw.sections.reduce((n, s) => n + s.questions.length, 0);
          const completedQ = fw.sections.reduce(
            (n, s) =>
              n +
              s.questions.filter((q) => answers[q.id]?.status === "completed").length,
            0,
          );

          return (
            <div key={fw.id}>
              <button
                onClick={() => toggleFw(fw.id)}
                className="grid w-full grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.9fr_1fr] items-center border-b border-slate-100 px-5 py-3 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  <Chevron open={fwOpen} />
                  <div
                    className={`h-7 w-7 shrink-0 rounded-md grid place-items-center text-[9px] font-bold ${fw.logoColor}`}
                  >
                    {fw.logoInitials}
                  </div>
                  <span className="font-semibold text-slate-900">{fw.shortName}</span>
                  <span className="text-xs text-slate-500">
                    {completedQ}/{totalQ}
                  </span>
                </div>
                <div className="text-xs text-slate-400">—</div>
                <div className="text-xs text-slate-400">—</div>
                <div className="text-xs text-slate-400">—</div>
                <div className="text-xs text-slate-400">—</div>
                <div className="text-xs text-slate-400">—</div>
              </button>

              {fwOpen &&
                fw.sections.map((section) => {
                  const sectionKey = `${fw.id}/${section.id}`;
                  const secOpen = expandedSection[sectionKey] ?? true;
                  const secCompleted = section.questions.filter(
                    (q) => answers[q.id]?.status === "completed",
                  ).length;
                  return (
                    <div key={sectionKey}>
                      <button
                        onClick={() => toggleSection(sectionKey)}
                        className="grid w-full grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.9fr_1fr] items-center border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 pl-10 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <Chevron open={secOpen} />
                          <span className="text-sm font-medium text-slate-800">
                            {section.title}
                          </span>
                          <span className="text-xs text-slate-500">
                            {secCompleted}/{section.questions.length}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">{section.title}</div>
                        <div className="text-xs text-slate-400">—</div>
                        <div className="text-xs text-slate-400">—</div>
                        <div className="text-xs text-slate-400">—</div>
                        <div className="text-xs text-slate-400">—</div>
                      </button>

                      {secOpen &&
                        section.questions.map((q) => {
                          const status = answers[q.id]?.status ?? "not-started";
                          const updatedAt = answers[q.id]?.updatedAt;
                          const assigned = assignees[q.id] ?? [];
                          return (
                            <QuestionRowView
                              key={q.id}
                              frameworkId={fw.id}
                              section={section}
                              question={q}
                              status={status}
                              updatedAt={updatedAt}
                              assigned={assigned}
                              onChangeAssigned={(ids) =>
                                updateAssignees(fw.id, q.id, ids)
                              }
                              onNotify={() => {
                                if (assigned.length === 0) {
                                  show("Assign someone before sending a reminder.");
                                  return;
                                }
                                const names = assigned
                                  .map(
                                    (id) =>
                                      mockUsers.find((u) => u.id === id)?.name ?? "user",
                                  )
                                  .join(", ");
                                show(`Reminder sent to ${names}`);
                              }}
                            />
                          );
                        })}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionRowView({
  frameworkId,
  section,
  question,
  status,
  updatedAt,
  assigned,
  onChangeAssigned,
  onNotify,
}: {
  frameworkId: string;
  section: Section;
  question: Question;
  status: "not-started" | "in-progress" | "completed";
  updatedAt?: string;
  assigned: string[];
  onChangeAssigned: (ids: string[]) => void;
  onNotify: () => void;
}) {
  const href = `/report/${frameworkId}?q=${encodeURIComponent(question.id)}`;
  return (
    <div className="grid grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.9fr_1fr] items-center border-b border-slate-100 px-5 py-3 pl-16 last:border-b-0 hover:bg-slate-50/60">
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={status} />
        <Link
          href={href}
          className="truncate text-sm text-slate-800 hover:text-brand hover:underline"
          title={question.label}
        >
          {question.id} · {question.label}
        </Link>
      </div>
      <div className="truncate text-xs text-slate-500" title={section.title}>
        {section.title}
      </div>
      <div className="truncate text-xs text-slate-500" title={question.label}>
        {question.label}
      </div>
      <div>
        <AssigneePicker selected={assigned} onChange={onChangeAssigned} />
      </div>
      <div className="text-xs text-slate-500">{formatUpdated(updatedAt)}</div>
      <div>
        <button
          onClick={onNotify}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16v12H5.17L4 17.17V4z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Notify
        </button>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: "not-started" | "in-progress" | "completed" }) {
  const cls =
    status === "completed"
      ? "bg-emerald-500"
      : status === "in-progress"
        ? "bg-amber-400"
        : "bg-slate-300";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AssigneePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  const selectedUsers = selected
    .map((id) => mockUsers.find((u) => u.id === id))
    .filter(Boolean) as { id: string; name: string; email: string }[];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 hover:border-slate-200 hover:bg-slate-50"
      >
        {selectedUsers.length === 0 ? (
          <span className="text-xs text-slate-400">+ Assign</span>
        ) : (
          <div className="flex -space-x-1.5">
            {selectedUsers.slice(0, 3).map((u) => (
              <span
                key={u.id}
                title={u.name}
                className="h-6 w-6 rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 ring-2 ring-white grid place-items-center"
              >
                {initials(u.name)}
              </span>
            ))}
            {selectedUsers.length > 3 && (
              <span className="h-6 w-6 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 ring-2 ring-white grid place-items-center">
                +{selectedUsers.length - 3}
              </span>
            )}
          </div>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {mockUsers.map((u) => {
            const checked = selected.includes(u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggle(u.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
              >
                <span
                  className={`h-4 w-4 shrink-0 rounded border grid place-items-center ${
                    checked ? "border-brand bg-brand" : "border-slate-300"
                  }`}
                >
                  {checked && (
                    <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="h-6 w-6 rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 grid place-items-center">
                  {initials(u.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-slate-800">
                    {u.name}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">{u.email}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
