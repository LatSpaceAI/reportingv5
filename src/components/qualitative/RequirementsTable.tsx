"use client";

import { useMemo, useState } from "react";
import type { QualitativeDoc, Requirement } from "@/lib/qualitative/types";
import { Plus, Search } from "./icons";
import { formatDateTime, formatResponse, locationFor } from "./util";

interface Props {
  doc: QualitativeDoc;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
}

// Icon shown next to typed responses: ▦ for table, 𝟙𝟚𝟛 for number.
function ResponseGlyph({ req }: { req: Requirement }) {
  if (!req.response) return null;
  if (req.response.kind === "table") {
    return (
      <span className="mr-1 inline-block align-middle text-[11px] text-slate-500">▦</span>
    );
  }
  if (req.response.kind === "number") {
    return (
      <span className="mr-1 inline-block align-middle text-[11px] text-slate-500 tabular-nums">▦</span>
    );
  }
  return null;
}

export function RequirementsTable({ doc, selectedId, onSelect, onAdd }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return doc.requirements;
    return doc.requirements.filter(
      (r) =>
        r.id.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle) ||
        r.description.toLowerCase().includes(needle)
    );
  }, [doc.requirements, search]);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-3">
        <div className="relative max-w-sm flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requirements..."
            className="w-full border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand"
          />
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {filtered.length} of {doc.requirements.length}
          </span>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" /> Add requirement
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="w-44 px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Description</th>
              <th className="w-64 px-4 py-2 text-left font-medium">Response</th>
              <th className="w-56 px-4 py-2 text-left font-medium">Location in report</th>
              <th className="w-44 px-4 py-2 text-left font-medium">Created at</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const loc = locationFor(doc.blocks, r.id);
              const isActive = r.id === selectedId;
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(isActive ? null : r.id)}
                  className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50/60 ${
                    isActive ? "bg-brand/5" : ""
                  }`}
                >
                  <td className="truncate px-4 py-3 font-medium text-slate-900">
                    <span title={r.name}>
                      {r.id}: {r.name}
                    </span>
                  </td>
                  <td className="truncate px-4 py-3 text-slate-600" title={r.description}>
                    {r.description}
                  </td>
                  <td className="truncate px-4 py-3 text-slate-700">
                    {r.response ? (
                      <>
                        <ResponseGlyph req={r} />
                        {formatResponse(r)}
                      </>
                    ) : (
                      <span className="italic text-slate-400">No response</span>
                    )}
                  </td>
                  <td className="truncate px-4 py-3 text-slate-600">
                    {loc === "Not tagged yet" ? (
                      <span className="italic text-slate-400">Not tagged yet</span>
                    ) : (
                      loc
                    )}
                  </td>
                  <td className="truncate px-4 py-3 text-slate-500">
                    {formatDateTime(r.createdAt)}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
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
