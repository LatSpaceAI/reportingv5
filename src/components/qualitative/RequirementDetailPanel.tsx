"use client";

import { useEffect, useMemo, useState } from "react";
import type { Block, QualitativeDoc, Requirement, Response } from "@/lib/qualitative/types";
import { ChevronLeft, ChevronRight, Paperclip, PanelClose, Pencil, Trash, X } from "./icons";
import { formatDateTime, isStale, locationFor } from "./util";

interface Props {
  doc: QualitativeDoc;
  requirement: Requirement;
  onChange: (next: Requirement) => void;
  onClose: () => void;
  onDelete: () => void;
  onSelectAdjacent: (delta: -1 | 1) => void;
  // Sync the document blocks' snapshots to the canonical requirement.response.
  onSyncDocument: () => void;
}

type Tab = "details" | "activity";

export function RequirementDetailPanel({
  doc,
  requirement,
  onChange,
  onClose,
  onDelete,
  onSelectAdjacent,
  onSyncDocument,
}: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const location = locationFor(doc.blocks, requirement.id);
  const stale = useMemo(
    () => doc.blocks.some((b) => b.kind === "requirement-ref" && b.requirementId === requirement.id && isStale(b, doc.requirements)),
    [doc.blocks, doc.requirements, requirement.id]
  );

  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-2">
        <button
          onClick={() => onSelectAdjacent(-1)}
          title="Previous requirement"
          className="p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onSelectAdjacent(1)}
          title="Next requirement"
          className="p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <NameField
          value={requirement.name}
          onChange={(name) => onChange({ ...requirement, name })}
        />
        <button
          onClick={onDelete}
          title="Delete requirement"
          className="ml-1 p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash className="h-4 w-4" />
        </button>
        <button
          onClick={onClose}
          title="Close panel"
          className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <PanelClose className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-slate-200 px-4">
        <div className="flex gap-4 text-sm">
          <button
            onClick={() => setTab("details")}
            className={`-mb-px border-b-2 py-2 ${
              tab === "details"
                ? "border-brand font-medium text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setTab("activity")}
            className={`-mb-px border-b-2 py-2 ${
              tab === "activity"
                ? "border-brand font-medium text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Activity
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "details" ? (
          <DetailsTab
            requirement={requirement}
            onChange={onChange}
            location={location}
            stale={stale}
            onSyncDocument={onSyncDocument}
          />
        ) : (
          <ActivityTab requirement={requirement} />
        )}
      </div>
    </aside>
  );
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() && draft !== value) onChange(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="ml-2 flex-1 border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand"
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="group ml-2 flex flex-1 items-center gap-1 truncate px-1 py-1 text-left text-sm font-medium text-slate-900"
    >
      <span className="truncate">{value}</span>
      <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 group-hover:opacity-100" />
    </button>
  );
}

function DetailsTab({
  requirement,
  onChange,
  location,
  stale,
  onSyncDocument,
}: {
  requirement: Requirement;
  onChange: (next: Requirement) => void;
  location: string;
  stale: boolean;
  onSyncDocument: () => void;
}) {
  return (
    <div className="space-y-5 p-4">
      <Section label="Description">
        <DescriptionField
          value={requirement.description}
          onChange={(description) => onChange({ ...requirement, description })}
        />
      </Section>

      <Section label="Location in report">
        <p className={`text-sm ${location === "Not tagged yet" ? "italic text-slate-400" : "text-slate-700"}`}>
          {location}
        </p>
      </Section>

      <Section label="Response" trailing={
        <button
          title="Edit response"
          className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      }>
        {stale && (
          <div className="mb-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <div className="flex items-center justify-between gap-2">
              <span>The document contains an older version of this response. Update the document to reflect your changes.</span>
              <button
                onClick={onSyncDocument}
                className="shrink-0 border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
              >
                Update document
              </button>
            </div>
          </div>
        )}
        <ResponseEditor
          response={requirement.response}
          onChange={(response) => onChange({ ...requirement, response })}
        />
      </Section>

      <Section label="Attachments">
        <AttachmentsList
          requirement={requirement}
          onChange={onChange}
        />
      </Section>
    </div>
  );
}

function Section({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </h3>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function DescriptionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onChange(draft)}
      placeholder="Add a description"
      rows={3}
      className="w-full resize-y border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand"
    />
  );
}

function ResponseEditor({
  response,
  onChange,
}: {
  response: Response | null;
  onChange: (next: Response | null) => void;
}) {
  const kind = response?.kind ?? "text";
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px]">
        <span className="text-slate-500">Type:</span>
        <select
          value={kind}
          onChange={(e) => {
            const k = e.target.value as Response["kind"] | "none";
            if (k === "none") return onChange(null);
            if (k === "text") return onChange({ kind: "text", value: response?.kind === "text" ? response.value : "" });
            if (k === "number")
              return onChange({
                kind: "number",
                value: response?.kind === "number" ? response.value : 0,
                unit: response?.kind === "number" ? response.unit : "",
              });
            return onChange({
              kind: "table",
              columns: response?.kind === "table" ? response.columns : ["Column 1", "Column 2"],
              rows: response?.kind === "table" ? response.rows : [["", ""]],
            });
          }}
          className="border border-slate-200 bg-white px-1.5 py-0.5 text-xs"
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="table">Table</option>
          <option value="none">None</option>
        </select>
      </div>

      {response?.kind === "text" && (
        <textarea
          value={response.value}
          onChange={(e) => onChange({ ...response, value: e.target.value })}
          rows={3}
          placeholder="Enter response..."
          className="w-full resize-y border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
        />
      )}

      {response?.kind === "number" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={response.value}
            onChange={(e) => onChange({ ...response, value: Number(e.target.value) })}
            className="w-32 border border-slate-200 bg-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand"
          />
          <input
            placeholder="Unit"
            value={response.unit ?? ""}
            onChange={(e) => onChange({ ...response, unit: e.target.value })}
            className="w-28 border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
        </div>
      )}

      {response?.kind === "table" && (
        <ResponseTableEditor
          columns={response.columns}
          rows={response.rows}
          onChange={(columns, rows) => onChange({ kind: "table", columns, rows })}
        />
      )}

      {!response && (
        <p className="border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs italic text-slate-400">
          No response yet.
        </p>
      )}
    </div>
  );
}

function ResponseTableEditor({
  columns,
  rows,
  onChange,
}: {
  columns: string[];
  rows: string[][];
  onChange: (columns: string[], rows: string[][]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="overflow-auto border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((c, ci) => (
                <th key={ci} className="border-r border-slate-200 last:border-r-0">
                  <input
                    value={c}
                    onChange={(e) => {
                      const next = columns.slice();
                      next[ci] = e.target.value;
                      onChange(next, rows);
                    }}
                    className="w-full bg-transparent px-2 py-1 text-left text-[11px] font-medium uppercase outline-none"
                  />
                </th>
              ))}
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-slate-100">
                {columns.map((_, ci) => (
                  <td key={ci} className="border-r border-slate-200 last:border-r-0">
                    <input
                      value={row[ci] ?? ""}
                      onChange={(e) => {
                        const next = rows.map((r) => r.slice());
                        next[ri][ci] = e.target.value;
                        onChange(columns, next);
                      }}
                      className="w-full bg-transparent px-2 py-1 text-sm outline-none"
                    />
                  </td>
                ))}
                <td className="text-center">
                  <button
                    title="Remove row"
                    onClick={() => onChange(columns, rows.filter((_, i) => i !== ri))}
                    className="px-1 text-slate-400 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => onChange(columns, [...rows, columns.map(() => "")])}
          className="border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
        >
          + Row
        </button>
        <button
          onClick={() =>
            onChange([...columns, `Column ${columns.length + 1}`], rows.map((r) => [...r, ""]))
          }
          className="border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
        >
          + Column
        </button>
      </div>
    </div>
  );
}

function AttachmentsList({
  requirement,
  onChange,
}: {
  requirement: Requirement;
  onChange: (r: Requirement) => void;
}) {
  if (requirement.attachments.length === 0) {
    return (
      <div className="border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
        Add information to help satisfy this requirement
        <div className="mt-2 flex justify-center gap-2">
          <button className="inline-flex items-center gap-1 border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            <Paperclip className="h-3.5 w-3.5" /> Upload files
          </button>
          <button
            onClick={() => {
              const url = window.prompt("Link URL");
              if (!url) return;
              const name = window.prompt("Display name") ?? url;
              onChange({
                ...requirement,
                attachments: [
                  ...requirement.attachments,
                  { id: `att_${Date.now()}`, name, url },
                ],
              });
            }}
            className="inline-flex items-center gap-1 border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            🔗 Add link
          </button>
        </div>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {requirement.attachments.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between border border-slate-200 px-2 py-1.5 text-sm"
        >
          <span className="flex items-center gap-2 truncate">
            <Paperclip className="h-3.5 w-3.5 text-slate-400" />
            {a.url ? (
              <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-brand hover:underline">
                {a.name}
              </a>
            ) : (
              <span className="truncate text-slate-700">{a.name}</span>
            )}
          </span>
          <button
            onClick={() =>
              onChange({
                ...requirement,
                attachments: requirement.attachments.filter((x) => x.id !== a.id),
              })
            }
            className="p-1 text-slate-400 hover:text-rose-600"
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ActivityTab({ requirement }: { requirement: Requirement }) {
  const sorted = [...requirement.activity].sort((a, b) => (a.at < b.at ? 1 : -1));
  if (sorted.length === 0) {
    return <p className="p-4 text-sm italic text-slate-500">No activity yet.</p>;
  }
  return (
    <ol className="divide-y divide-slate-100">
      {sorted.map((entry) => (
        <li key={entry.id} className="px-4 py-3 text-sm">
          <div className="text-slate-700">{entry.message}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {entry.actor} · {formatDateTime(entry.at)}
          </div>
        </li>
      ))}
    </ol>
  );
}
