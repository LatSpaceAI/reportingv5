"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComputeContext, FieldsQuestion, Question, Section } from "@/lib/frameworkTypes";
import { FieldHelp, FieldLabel, FieldRenderer, isFilled, isValid, type RowValues, type CalculatedRef } from "@/components/Fields";
import { TableField } from "@/components/TableField";
import { AssistantPane } from "@/components/qualitative/AssistantPane";
import { initials, mockUsers, readAssignees, writeAssignees, type Assignees } from "@/lib/storage";
import {
  calculatedValues,
  calculatedForField,
  calculatedForRow,
  sotRowsForTableQuestion,
  sotValuesForFieldsQuestion,
  type CalculatedValue,
} from "@/lib/cbamSOT";

type Status = "not-started" | "in-progress" | "completed";

interface QuestionState {
  values: RowValues;
  rows: RowValues[];
  status: Status;
  updatedAt?: string;
  comment?: string;
}

const statusLabel: Record<Status, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  completed: "Completed",
};

const statusDot: Record<Status, string> = {
  "not-started": "bg-slate-300",
  "in-progress": "bg-amber-400",
  completed: "bg-emerald-500",
};

const PANES_KEY = "cbam-app/panes/v1";

export interface QuestionnaireConfig {
  sections: Section[];
  storageKey: string;
  frameworkId: string; // used to scope assignee storage so it syncs with /table
  frameworkName: string; // shown in the header, e.g. "CBAM Communication Template — Installations"
  version?: string; // optional version label shown in header
  onExport?: () => Promise<void> | void; // called by the header Export button; if absent, button is hidden
}

const LEFT_MIN = 240;
const LEFT_MAX = 560;
const LEFT_DEFAULT = 340;
const RIGHT_MIN = 240;
const RIGHT_MAX = 520;
const RIGHT_DEFAULT = 320;

interface PanesState {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

const panesDefault: PanesState = {
  leftWidth: LEFT_DEFAULT,
  rightWidth: RIGHT_DEFAULT,
  leftCollapsed: false,
  rightCollapsed: false,
};

function blankState(q: Question): QuestionState {
  if (q.kind === "fields") {
    const values: RowValues = {};
    for (const f of q.fields) values[f.id] = null;
    return { values, rows: [], status: "not-started" };
  }
  const rows: RowValues[] = Array.from({ length: q.minRows }, () => {
    const r: RowValues = {};
    for (const c of q.columns) r[c.id] = null;
    return r;
  });
  return { values: {}, rows, status: "not-started" };
}

/**
 * For the CBAM framework, hydrate a fresh state with SOT-derived values for
 * every (question, field) that has a calculated mapping. Cells the SOT does
 * not cover stay blank.
 */
function sotHydratedState(q: Question, withSOT: boolean): QuestionState {
  const base = blankState(q);
  if (!withSOT) return base;
  if (q.kind === "fields") {
    const sot = sotValuesForFieldsQuestion(q.id, q.fields.map((f) => f.id));
    if (sot) base.values = { ...base.values, ...sot };
    return base;
  }
  const colIds = q.columns.map((c) => c.id);
  const sotRows = sotRowsForTableQuestion(q.id, colIds);
  if (sotRows && sotRows.length > 0) {
    // Ensure at least `minRows` rows; fill SOT rows over the front.
    const blank: RowValues = Object.fromEntries(colIds.map((c) => [c, null]));
    const rows: RowValues[] = [];
    const target = Math.max(q.minRows, sotRows.length);
    for (let i = 0; i < target; i++) {
      const sot = sotRows[i];
      rows.push(sot ? { ...blank, ...sot } : { ...blank });
    }
    base.rows = rows;
  }
  return base;
}

/**
 * Backfill SOT values into a previously saved QuestionState, but only into
 * cells the user has not yet touched (null/undefined/empty).
 */
function mergeSOTBackfill(q: Question, saved: QuestionState): QuestionState {
  if (q.kind === "fields") {
    const next = { ...saved.values };
    for (const f of q.fields) {
      const cur = next[f.id];
      if (cur === null || cur === undefined || cur === "") {
        const cv = calculatedForField(q.id, f.id);
        if (cv) next[f.id] = cv.value;
      }
    }
    return { ...saved, values: next };
  }
  const colIds = q.columns.map((c) => c.id);
  const sotRows = sotRowsForTableQuestion(q.id, colIds);
  if (!sotRows || sotRows.length === 0) return saved;
  const nextRows = [...saved.rows];
  // Make sure we have at least sotRows.length rows.
  while (nextRows.length < sotRows.length) {
    const blank: RowValues = Object.fromEntries(colIds.map((c) => [c, null]));
    nextRows.push(blank);
  }
  for (let i = 0; i < sotRows.length; i++) {
    const merged = { ...nextRows[i] };
    for (const cid of colIds) {
      const cur = merged[cid];
      if (cur === null || cur === undefined || cur === "") {
        const sv = sotRows[i][cid];
        if (sv !== null && sv !== undefined) merged[cid] = sv;
      }
    }
    nextRows[i] = merged;
  }
  return { ...saved, rows: nextRows };
}

function deriveStatus(q: Question, s: QuestionState): Status {
  if (s.status === "completed") return "completed";
  if (q.kind === "fields") {
    const anyFilled = q.fields.some((f) => isFilled(f, s.values[f.id]));
    return anyFilled ? "in-progress" : "not-started";
  }
  const anyFilled = s.rows.some((r) => q.columns.some((c) => isFilled(c, r[c.id])));
  return anyFilled ? "in-progress" : "not-started";
}

function canComplete(q: Question, s: QuestionState): boolean {
  if (q.kind === "fields") {
    return q.fields.every((f) => isValid(f, s.values[f.id]));
  }
  return s.rows.every((r) => q.columns.every((c) => isValid(c, r[c.id])));
}

export function Questionnaire({
  config,
  initialQuestionId,
}: {
  config: QuestionnaireConfig;
  initialQuestionId?: string;
}) {
  const { sections, storageKey, frameworkId, frameworkName, version, onExport } = config;
  const withSOT = frameworkId === "cbam";
  const allQuestions = useMemo(
    () => sections.flatMap((s) => s.questions.map((q) => ({ section: s, q }))),
    [sections]
  );

  const [answers, setAnswers] = useState<Record<string, QuestionState>>(() =>
    Object.fromEntries(allQuestions.map(({ q }) => [q.id, sotHydratedState(q, withSOT)]))
  );

  // When the framework changes (rare — happens via navigation), reset state.
  useEffect(() => {
    setAnswers(Object.fromEntries(allQuestions.map(({ q }) => [q.id, sotHydratedState(q, withSOT)])));
  }, [storageKey, allQuestions, withSOT]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Record<string, QuestionState>;
      setAnswers((prev) => {
        const next = { ...prev };
        for (const { q } of allQuestions) {
          if (saved[q.id]) {
            // Backfill any SOT calculated cell the user hasn't already filled.
            // This keeps the report behaviour consistent if the SOT map grows
            // between sessions.
            next[q.id] = withSOT ? mergeSOTBackfill(q, saved[q.id]) : saved[q.id];
          }
        }
        return next;
      });
    } catch {}
  }, [allQuestions, storageKey, withSOT]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(storageKey, JSON.stringify(answers));
  }, [answers, storageKey]);

  const [assignees, setAssigneesState] = useState<Assignees>({});
  useEffect(() => {
    setAssigneesState(readAssignees(frameworkId));
  }, [frameworkId]);
  const setAssigned = useCallback(
    (questionId: string, userIds: string[]) => {
      setAssigneesState((prev) => {
        const next = { ...prev, [questionId]: userIds };
        writeAssignees(frameworkId, next);
        return next;
      });
    },
    [frameworkId]
  );

  // Build a ComputeContext that the renderers use to resolve formula-driven
  // field values. `get(qId, fId)` walks into the question's `values` map; if
  // the target question is a table, the same id resolves the first row's
  // value (sufficient for RCO's row-1 summary fields).
  const computeCtx: ComputeContext = useMemo(
    () => ({
      get: (qId: string, fId: string) => {
        const a = answers[qId];
        if (!a) return null;
        if (a.values && fId in a.values) return a.values[fId];
        if (a.rows && a.rows[0] && fId in a.rows[0]) return a.rows[0][fId];
        return null;
      },
      num: (v: unknown) => {
        if (typeof v === "number") return Number.isFinite(v) ? v : 0;
        if (typeof v === "string" && v.trim() !== "") {
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        }
        return 0;
      },
    }),
    [answers]
  );

  const [panes, setPanes] = useState<PanesState>(panesDefault);
  const dragRef = useRef<{ side: "left" | "right"; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(PANES_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Partial<PanesState>;
      setPanes((prev) => ({ ...prev, ...saved }));
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PANES_KEY, JSON.stringify(panes));
  }, [panes]);

  const onDragStart = useCallback((side: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      side,
      startX: e.clientX,
      startWidth: side === "left" ? panes.leftWidth : panes.rightWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [panes.leftWidth, panes.rightWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = e.clientX - d.startX;
      if (d.side === "left") {
        const next = Math.min(LEFT_MAX, Math.max(LEFT_MIN, d.startWidth + delta));
        setPanes((p) => ({ ...p, leftWidth: next }));
      } else {
        const next = Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, d.startWidth - delta));
        setPanes((p) => ({ ...p, rightWidth: next }));
      }
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
  }, []);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s, i) => [s.id, i < 3]))
  );
  const [activeId, setActiveId] = useState<string>(
    initialQuestionId && allQuestions.some((x) => x.q.id === initialQuestionId)
      ? initialQuestionId
      : allQuestions[0].q.id
  );
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"requirements" | "document">("document");
  const [reqFocusId, setReqFocusId] = useState<string | null>(null);

  // Switch to Requirements tab and focus the row for a given calculated value.
  const jumpToRequirement = useCallback((valueId: string) => {
    setReqFocusId(valueId);
    setTab("requirements");
    // Scroll after the tab paint settles.
    setTimeout(() => {
      const el = document.getElementById(`req-${valueId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, []);

  // Build a (qid, fid) → CalculatedRef builder, only for CBAM.
  const calcFieldRef = useCallback(
    (qid: string, fid: string): CalculatedRef | null => {
      if (!withSOT) return null;
      const v = calculatedForField(qid, fid);
      if (!v) return null;
      return { valueId: v.id, label: v.label, source: v.source, onJump: jumpToRequirement };
    },
    [withSOT, jumpToRequirement]
  );

  const calcRowRef = useCallback(
    (qid: string, rowIdx: number, cid: string): CalculatedRef | null => {
      if (!withSOT) return null;
      const v = calculatedForRow(qid, cid, rowIdx);
      if (!v) return null;
      return { valueId: v.id, label: v.label, source: v.source, onJump: jumpToRequirement };
    },
    [withSOT, jumpToRequirement]
  );

  const active = allQuestions.find((x) => x.q.id === activeId)!;

  // Compact context handed to the AI Assistant so it knows which question the
  // user is currently looking at. Built fresh on each render — cheap.
  const activeQuestionContext = useMemo(() => {
    return {
      id: active.q.id,
      label: active.q.label,
      sectionId: active.section.id,
      sectionTitle: active.section.title,
      questionKind: active.q.kind,
      description: active.q.description,
    };
  }, [active]);

  const activeAnswerSummary = useMemo(() => {
    const a = answers[active.q.id];
    if (!a) return undefined;
    let filledCount = 0;
    let totalFields = 0;
    let preview = "";
    if (active.q.kind === "fields") {
      totalFields = active.q.fields.length;
      for (const f of active.q.fields) {
        const v = a.values[f.id];
        if (isFilled(f, v)) {
          filledCount++;
          if (preview.length < 200 && (typeof v === "string" || typeof v === "number")) {
            preview += `${f.id}=${String(v).slice(0, 60)}; `;
          }
        }
      }
    } else {
      const cols = active.q.columns;
      totalFields = cols.length * a.rows.length;
      for (const r of a.rows) {
        for (const c of cols) {
          if (isFilled(c, r[c.id])) filledCount++;
        }
      }
      preview = `${a.rows.length} row${a.rows.length === 1 ? "" : "s"}`;
    }
    return {
      status: a.status,
      filledCount,
      totalFields,
      preview: preview.trim().slice(0, 200) || undefined,
    };
  }, [active, answers]);

  const completedCount = Object.values(answers).filter((a) => a.status === "completed").length;
  const inProgressCount = Object.values(answers).filter((a) => a.status === "in-progress").length;
  const notStartedCount = Object.values(answers).filter((a) => a.status === "not-started").length;
  const overallPct = Math.round((completedCount / allQuestions.length) * 100);

  function patch(id: string, patch: Partial<QuestionState>) {
    setAnswers((prev) => {
      const current = prev[id];
      const q = allQuestions.find((x) => x.q.id === id)!.q;
      const merged = { ...current, ...patch };
      const autoStatus =
        current.status === "completed" ? "completed" : deriveStatus(q, merged);
      return {
        ...prev,
        [id]: { ...merged, status: autoStatus, updatedAt: new Date().toISOString() },
      };
    });
  }

  function setStatus(id: string, status: Status) {
    setAnswers((prev) => ({
      ...prev,
      [id]: { ...prev[id], status, updatedAt: new Date().toISOString() },
    }));
  }

  function filteredSections() {
    if (!search.trim()) return sections;
    const needle = search.toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        questions: s.questions.filter(
          (q) =>
            q.id.toLowerCase().includes(needle) ||
            q.label.toLowerCase().includes(needle) ||
            (q.description ?? "").toLowerCase().includes(needle)
        ),
      }))
      .filter((s) => s.questions.length > 0);
  }

  return (
    <div className="flex h-full flex-col">
      <QuestionnaireHeader
        overallPct={overallPct}
        activeId={activeId}
        frameworkName={frameworkName}
        version={version}
        onExport={onExport}
      />
      <QuestionnaireTabs tab={tab} onChange={setTab} />
      {tab === "requirements" ? (
        withSOT ? (
          <CalculatedRequirementsView
            sections={sections}
            answers={answers}
            focusId={reqFocusId}
            onJumpToReport={(qid) => {
              setActiveId(qid);
              setTab("document");
            }}
          />
        ) : (
        <RequirementsView
          sections={sections}
          answers={answers}
          assignees={assignees}
          onOpen={(id) => {
            setActiveId(id);
            setTab("document");
          }}
        />
        )
      ) : (
      <div className="flex flex-1 overflow-hidden">
        {panes.leftCollapsed ? (
          <CollapsedRail
            side="left"
            label="Sections"
            onExpand={() => setPanes((p) => ({ ...p, leftCollapsed: false }))}
          />
        ) : (
          <>
            <Sidebar
              width={panes.leftWidth}
              onCollapse={() => setPanes((p) => ({ ...p, leftCollapsed: true }))}
              sections={filteredSections()}
              answers={answers}
              activeId={activeId}
              setActiveId={setActiveId}
              openSections={openSections}
              setOpenSections={setOpenSections}
              search={search}
              setSearch={setSearch}
              overallPct={overallPct}
              completedCount={completedCount}
              inProgressCount={inProgressCount}
              notStartedCount={notStartedCount}
              totalCount={allQuestions.length}
            />
            <ResizeHandle onMouseDown={onDragStart("left")} />
          </>
        )}
        <QuestionPanel
          section={active.section}
          question={active.q}
          state={answers[active.q.id]}
          onValues={(values) => patch(active.q.id, { values })}
          onRows={(rows) => patch(active.q.id, { rows })}
          onComment={(comment) => patch(active.q.id, { comment })}
          assigned={assignees[active.q.id] ?? []}
          onAssignedChange={(ids) => setAssigned(active.q.id, ids)}
          onStatusChange={(s) => setStatus(active.q.id, s)}
          onComplete={() =>
            canComplete(active.q, answers[active.q.id]) && setStatus(active.q.id, "completed")
          }
          computeCtx={computeCtx}
          calcFieldRef={(fid) => calcFieldRef(active.q.id, fid)}
          calcRowRef={(rowIdx, cid) => calcRowRef(active.q.id, rowIdx, cid)}
        />
        {panes.rightCollapsed ? (
          <CollapsedRail
            side="right"
            label="AI Assistant"
            onExpand={() => setPanes((p) => ({ ...p, rightCollapsed: false }))}
          />
        ) : (
          // Note: <AssistantPane> renders its own resize handle, so we don't
          // wrap it in a <ResizeHandle> here (unlike the left pane).
          <AssistantPane
            width={panes.rightWidth}
            onWidthChange={(w) => setPanes((p) => ({ ...p, rightWidth: w }))}
            onCollapse={() => setPanes((p) => ({ ...p, rightCollapsed: true }))}
            frameworkId={frameworkId}
            activeQuestion={activeQuestionContext}
            activeAnswer={activeAnswerSummary}
          />
        )}
      </div>
      )}
    </div>
  );
}

function QuestionnaireTabs({
  tab,
  onChange,
}: {
  tab: "requirements" | "document";
  onChange: (t: "requirements" | "document") => void;
}) {
  const labels: Record<"requirements" | "document", string> = {
    requirements: "Requirements",
    document: "Document",
  };
  return (
    <div className="border-b border-slate-200 bg-white px-6">
      <div className="flex gap-6 text-sm">
        {(["requirements", "document"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`-mb-px border-b-2 py-2.5 ${
              tab === t
                ? "border-brand font-medium text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {labels[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

function RequirementsView({
  sections,
  answers,
  assignees,
  onOpen,
}: {
  sections: Section[];
  answers: Record<string, QuestionState>;
  assignees: Assignees;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const out: Array<{
      id: string;
      label: string;
      description?: string;
      sectionTitle: string;
      kind: "fields" | "table";
      status: Status;
      updatedAt?: string;
      assignedIds: string[];
    }> = [];
    for (const s of sections) {
      for (const q of s.questions) {
        const a = answers[q.id];
        out.push({
          id: q.id,
          label: q.label,
          description: q.description,
          sectionTitle: s.title,
          kind: q.kind,
          status: a?.status ?? "not-started",
          updatedAt: a?.updatedAt,
          assignedIds: assignees[q.id] ?? [],
        });
      }
    }
    return out;
  }, [sections, answers, assignees]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(needle) ||
        r.label.toLowerCase().includes(needle) ||
        (r.description ?? "").toLowerCase().includes(needle) ||
        r.sectionTitle.toLowerCase().includes(needle)
    );
  }, [rows, search]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-3">
        <div className="relative max-w-sm flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requirements..."
            className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand"
          />
          <svg
            className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-xs text-slate-500">
          {filtered.length} of {rows.length}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="w-32 px-4 py-2 text-left font-medium">ID</th>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="w-56 px-4 py-2 text-left font-medium">Section</th>
              <th className="w-20 px-4 py-2 text-left font-medium">Type</th>
              <th className="w-32 px-4 py-2 text-left font-medium">Status</th>
              <th className="w-44 px-4 py-2 text-left font-medium">Assigned</th>
              <th className="w-44 px-4 py-2 text-left font-medium">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => onOpen(r.id)}
                className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/60"
              >
                <td className="truncate px-4 py-3 font-mono text-[12px] text-slate-700">{r.id}</td>
                <td className="truncate px-4 py-3 text-slate-900" title={r.label}>
                  <div className="truncate font-medium">{r.label}</div>
                  {r.description && (
                    <div className="truncate text-xs text-slate-500">{r.description}</div>
                  )}
                </td>
                <td className="truncate px-4 py-3 text-slate-600" title={r.sectionTitle}>
                  {r.sectionTitle}
                </td>
                <td className="px-4 py-3 text-slate-600 capitalize">{r.kind}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-slate-700">
                    <span className={`h-2 w-2 rounded-full ${statusDot[r.status]}`} />
                    {statusLabel[r.status]}
                  </span>
                </td>
                <td className="truncate px-4 py-3 text-slate-600">
                  {r.assignedIds.length > 0 ? (
                    <span className="inline-flex flex-wrap gap-1">
                      {r.assignedIds.slice(0, 3).map((uid) => {
                        const u = mockUsers.find((m) => m.id === uid);
                        return (
                          <span
                            key={uid}
                            title={u?.name ?? uid}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-700"
                          >
                            {u ? initials(u.name) : "?"}
                          </span>
                        );
                      })}
                      {r.assignedIds.length > 3 && (
                        <span className="text-xs text-slate-400">+{r.assignedIds.length - 3}</span>
                      )}
                    </span>
                  ) : (
                    <span className="italic text-slate-400">Unassigned</span>
                  )}
                </td>
                <td className="truncate px-4 py-3 text-slate-500">
                  {r.updatedAt
                    ? new Date(r.updatedAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                  No requirements match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * CBAM Requirements tab — every calculated value from the Hindalco Renukoot
 * SOT, with the report fields it feeds into. Each row is anchored as
 * `id="req-<valueId>"` so the document can deep-link into it.
 */
function CalculatedRequirementsView({
  sections,
  answers,
  focusId,
  onJumpToReport,
}: {
  sections: Section[];
  answers: Record<string, QuestionState>;
  focusId: string | null;
  onJumpToReport: (questionId: string) => void;
}) {
  const [search, setSearch] = useState("");

  // Index questions by id, for label lookup.
  const questionById = useMemo(() => {
    const m = new Map<string, { sectionTitle: string; questionLabel: string; question: Question }>();
    for (const s of sections) {
      for (const q of s.questions) {
        m.set(q.id, { sectionTitle: s.title, questionLabel: q.label, question: q });
      }
    }
    return m;
  }, [sections]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return calculatedValues;
    return calculatedValues.filter(
      (v) =>
        v.id.toLowerCase().includes(needle) ||
        v.label.toLowerCase().includes(needle) ||
        v.sotSection.toLowerCase().includes(needle) ||
        v.source.toLowerCase().includes(needle)
    );
  }, [search]);

  // Group by SOT section.
  const groups = useMemo(() => {
    const m = new Map<string, CalculatedValue[]>();
    for (const v of filtered) {
      const arr = m.get(v.sotSection) ?? [];
      arr.push(v);
      m.set(v.sotSection, arr);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const formatValue = (n: number, unit: string): string => {
    if (n === 0) return `0 ${unit}`;
    const abs = Math.abs(n);
    let s: string;
    if (abs >= 1000) s = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    else if (abs >= 1) s = n.toLocaleString(undefined, { maximumFractionDigits: 4 });
    else s = n.toPrecision(4);
    return `${s} ${unit}`;
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-3">
        <div className="relative max-w-sm flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search calculated values, sources, SOT sections..."
            className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand"
          />
          <svg
            className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-xs text-slate-500">
          {filtered.length} of {calculatedValues.length} calculated values
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-start gap-2">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
              <div>
                <div className="font-medium text-slate-900">Calculated values from SOT</div>
                <div className="mt-0.5 text-xs text-slate-600">
                  Source: <span className="font-mono">SOT - CBAM Calculation Hindalco Renukoot.xlsx</span>.
                  These numbers are pre-populated into the report — they appear in <span className="font-medium text-blue-700">blue</span> in the Document tab.
                  Click the ↗ icon on any blue value to jump back here.
                </div>
              </div>
            </div>
          </div>
          {groups.map(([groupLabel, vals]) => (
            <div key={groupLabel} className="mb-6">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {groupLabel}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500">{vals.length} value{vals.length === 1 ? "" : "s"}</span>
              </div>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="w-44 px-3 py-2 text-left font-medium">ID</th>
                      <th className="px-3 py-2 text-left font-medium">Calculated value</th>
                      <th className="w-48 px-3 py-2 text-right font-medium">Value</th>
                      <th className="px-3 py-2 text-left font-medium">Mapped to (report)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vals.map((v) => {
                      const focused = focusId === v.id;
                      return (
                        <tr
                          key={v.id}
                          id={`req-${v.id}`}
                          className={`border-b border-slate-100 last:border-b-0 ${
                            focused ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : "hover:bg-slate-50/60"
                          }`}
                        >
                          <td className="px-3 py-3 align-top">
                            <span className="font-mono text-[11px] text-slate-600">{v.id}</span>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="font-medium text-slate-900">{v.label}</div>
                            <div className="mt-1 text-xs text-slate-500">{v.source}</div>
                          </td>
                          <td className="px-3 py-3 text-right align-top tabular-nums">
                            <span className="font-semibold text-blue-700">
                              {formatValue(v.value, v.unit)}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <ul className="space-y-1">
                              {v.targets.map((t, idx) => {
                                const qInfo = questionById.get(t.questionId);
                                const a = answers[t.questionId];
                                let curStr = "—";
                                if (a) {
                                  if (t.rowIndex !== undefined && a.rows[t.rowIndex]) {
                                    const cv = a.rows[t.rowIndex][t.fieldId];
                                    if (cv !== null && cv !== undefined && cv !== "") {
                                      curStr = typeof cv === "number" ? formatValue(cv, v.unit) : String(cv);
                                    }
                                  } else if (a.values && a.values[t.fieldId] !== undefined) {
                                    const cv = a.values[t.fieldId];
                                    if (cv !== null && cv !== undefined && cv !== "") {
                                      curStr = typeof cv === "number" ? formatValue(cv, v.unit) : String(cv);
                                    }
                                  }
                                }
                                return (
                                  <li key={idx} className="flex items-start justify-between gap-3">
                                    <button
                                      onClick={() => onJumpToReport(t.questionId)}
                                      className="text-left text-xs text-blue-700 hover:underline"
                                      title={`Open ${qInfo?.questionLabel ?? t.questionId} in the report`}
                                    >
                                      <span className="font-mono">{t.questionId}</span>
                                      {t.rowIndex !== undefined && (
                                        <span className="text-slate-500"> · row {t.rowIndex + 1}</span>
                                      )}{" "}
                                      · <span className="text-slate-600">{t.fieldId}</span>
                                    </button>
                                    <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                                      {curStr}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-md border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-400">
              No calculated values match your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group relative w-1 shrink-0 cursor-col-resize bg-slate-200 hover:bg-brand/60 active:bg-brand"
      role="separator"
      aria-orientation="vertical"
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

function CollapsedRail({
  side,
  label,
  onExpand,
}: {
  side: "left" | "right";
  label: string;
  onExpand: () => void;
}) {
  const border = side === "left" ? "border-r" : "border-l";
  return (
    <aside
      className={`flex w-10 shrink-0 flex-col items-center ${border} border-slate-200 bg-white py-3`}
    >
      <button
        onClick={onExpand}
        title={`Expand ${label}`}
        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          {side === "left" ? (
            <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>
      <div
        className="mt-3 text-[11px] uppercase tracking-wider text-slate-400"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {label}
      </div>
    </aside>
  );
}

function QuestionnaireHeader({
  overallPct,
  activeId,
  frameworkName,
  version,
  onExport,
}: {
  overallPct: number;
  activeId: string;
  frameworkName: string;
  version?: string;
  onExport?: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const handleExport = async () => {
    if (busy || !onExport) return;
    setBusy(true);
    try {
      await onExport();
    } catch (e) {
      console.error(e);
      alert("Export failed. See browser console for details.");
    } finally {
      setBusy(false);
    }
  };
  const handleSync = () => {
    if (syncing) return;
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      setSyncedAt(new Date());
    }, 900);
  };
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-4">
        <a
          href="/"
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <span className="text-lg leading-none">‹</span> Back
        </a>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-slate-900">{frameworkName}</span>
          <span className="text-xs text-slate-500">{overallPct}% complete</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">
          {version ? `${version} · ` : ""}
          {activeId}
        </span>
        {syncedAt && !syncing && (
          <span className="text-[11px] text-emerald-600">
            Synced {syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          title="Sync with connected source systems"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 12a8 8 0 0 1 14-5.3L20 9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 12a8 8 0 0 1-14 5.3L4 15" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {syncing ? "Syncing…" : "Sync"}
        </button>
        {onExport && (
          <button
            onClick={handleExport}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Download the filled template"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {busy ? "Generating…" : "Export"}
          </button>
        )}
      </div>
    </header>
  );
}

function Sidebar(props: {
  width: number;
  onCollapse: () => void;
  sections: Section[];
  answers: Record<string, QuestionState>;
  activeId: string;
  setActiveId: (id: string) => void;
  openSections: Record<string, boolean>;
  setOpenSections: (v: Record<string, boolean>) => void;
  search: string;
  setSearch: (v: string) => void;
  overallPct: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  totalCount: number;
}) {
  return (
    <aside
      className="shrink-0 border-r border-slate-200 bg-white flex flex-col"
      style={{ width: props.width }}
    >
      <div className="border-b border-slate-200 p-4 space-y-4">
        <div className="flex items-center text-sm">
          <span className="text-[11px] uppercase tracking-wider font-medium text-slate-500">Sections</span>
          <button
            onClick={props.onCollapse}
            title="Collapse panel"
            className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="relative">
          <input
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full rounded border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span>Overall Progress</span>
            <span>{props.overallPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${props.overallPct}%` }} />
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px]">
            <LegendDot color="bg-emerald-500" label={`Completed: ${props.completedCount}`} />
            <LegendDot color="bg-amber-400" label={`In Progress: ${props.inProgressCount}`} />
            <LegendDot color="bg-slate-300" label={`Not Started: ${props.notStartedCount}`} />
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {props.sections.map((s) => {
          const total = s.questions.length;
          const done = s.questions.filter((q) => props.answers[q.id]?.status === "completed").length;
          const open = props.openSections[s.id];
          const expanded = props.search.trim() ? true : open;
          return (
            <div key={s.id} className="border-b border-slate-100">
              <button
                onClick={() => props.setOpenSections({ ...props.openSections, [s.id]: !expanded })}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
                  <span className="font-medium text-slate-800 text-left">{s.title}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {done}/{total}
                </span>
              </button>
              {expanded && (
                <ul>
                  {s.questions.map((q) => {
                    const st = props.answers[q.id]?.status ?? "not-started";
                    const isActive = props.activeId === q.id;
                    return (
                      <li key={q.id}>
                        <button
                          onClick={() => props.setActiveId(q.id)}
                          className={`w-full text-left flex gap-3 px-6 py-2.5 text-sm ${
                            isActive ? "bg-brand/5" : "hover:bg-slate-50"
                          }`}
                        >
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusDot[st]}`} />
                          <span className="min-w-0">
                            <span className="block text-[11px] uppercase tracking-wide text-slate-500">{q.id}</span>
                            <span className="block text-slate-700 truncate">{q.label}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 px-4 py-2 text-[11px] text-emerald-600 flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Auto-save enabled
      </div>
    </aside>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-slate-500">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function QuestionPanel({
  section,
  question,
  state,
  onValues,
  onRows,
  onComment,
  assigned,
  onAssignedChange,
  onStatusChange,
  onComplete,
  computeCtx,
  calcFieldRef,
  calcRowRef,
}: {
  section: Section;
  question: Question;
  state: QuestionState;
  onValues: (values: RowValues) => void;
  onRows: (rows: RowValues[]) => void;
  onComment: (comment: string) => void;
  assigned: string[];
  onAssignedChange: (ids: string[]) => void;
  onStatusChange: (s: Status) => void;
  onComplete: () => void;
  computeCtx: ComputeContext;
  calcFieldRef?: (fieldId: string) => CalculatedRef | null;
  calcRowRef?: (rowIndex: number, columnId: string) => CalculatedRef | null;
}) {
  const valid = canComplete(question, state);
  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/40">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{question.id}</span>
              <span className={`h-2 w-2 rounded-full ${statusDot[state.status]}`} />
            </div>
            <h1 className="mt-1 text-[22px] leading-snug font-medium text-slate-900">{question.label}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {section.title} · {section.sheetRef}
            </p>
          </div>
          <select
            value={state.status}
            onChange={(e) => onStatusChange(e.target.value as Status)}
            className="shrink-0 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="not-started">Not Started</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-slate-500">Assignees</span>
          <AssigneePicker selected={assigned} onChange={onAssignedChange} />
        </div>

        {question.description && (
          <div className="mt-4 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {question.description}
          </div>
        )}

        <div className="mt-6">
          {question.kind === "fields" ? (
            <FieldsForm
              q={question}
              values={state.values}
              onChange={onValues}
              computeCtx={computeCtx}
              calcFieldRef={calcFieldRef}
            />
          ) : (
            <TableField
              q={question}
              rows={state.rows}
              onChange={onRows}
              computeCtx={computeCtx}
              calculatedRef={
                calcRowRef ? (rowIdx, cid) => calcRowRef(rowIdx, cid) : undefined
              }
            />
          )}
        </div>

        <div className="mt-8">
          <div className="text-sm font-medium text-slate-800 mb-2">Comments</div>
          <textarea
            value={state.comment ?? ""}
            onChange={(e) => onComment(e.target.value)}
            placeholder="Add context, caveats, or notes for reviewers..."
            rows={3}
            className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand"
          />
        </div>

        <div className="mt-6">
          <div className="text-sm font-medium text-slate-800 mb-2">Supporting Documents</div>
          <label className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white py-10 text-sm text-slate-500 cursor-pointer hover:bg-slate-50">
            <span className="rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-700 inline-flex items-center gap-1">
              ⬆ Upload Files
            </span>
            <span className="text-xs">Supported formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</span>
            <input type="file" className="hidden" multiple />
          </label>
        </div>

        <div className="mt-8 mb-10 flex items-center justify-between">
          <span className="text-sm text-slate-500 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusDot[state.status]}`} />
            {statusLabel[state.status]}
            {!valid && <span className="text-xs text-rose-500">· required fields missing</span>}
          </span>
          <button
            onClick={onComplete}
            disabled={!valid}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mark as Complete
          </button>
        </div>
      </div>
    </main>
  );
}

function FieldsForm({
  q,
  values,
  onChange,
  computeCtx,
  calcFieldRef,
}: {
  q: FieldsQuestion;
  values: RowValues;
  onChange: (v: RowValues) => void;
  computeCtx?: ComputeContext;
  calcFieldRef?: (fieldId: string) => CalculatedRef | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {q.fields.map((f) => {
        const wide = f.kind === "longtext";
        const calc = calcFieldRef ? calcFieldRef(f.id) ?? undefined : undefined;
        return (
          <div key={f.id} className={wide ? "md:col-span-2" : ""}>
            <FieldLabel field={f} />
            <FieldRenderer
              field={f}
              value={values[f.id]}
              siblings={values}
              onChange={(v) => onChange({ ...values, [f.id]: v })}
              computeCtx={computeCtx}
              calculatedRef={calc}
            />
            <FieldHelp field={f} />
          </div>
        );
      })}
    </div>
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
        type="button"
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
                type="button"
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

