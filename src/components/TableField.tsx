"use client";

import type { ComputeContext, TableQuestion } from "@/lib/frameworkTypes";
import { FieldRenderer, type RowValues, isFilled, type FieldValue, type CalculatedRef } from "./Fields";

interface Props {
  q: TableQuestion;
  rows: RowValues[];
  onChange: (rows: RowValues[]) => void;
  computeCtx?: ComputeContext;
  /** Optional: returns a calculated-value ref for a given (rowIndex, columnId). */
  calculatedRef?: (rowIndex: number, columnId: string) => CalculatedRef | null;
  /** Optional: fires when a number cell is focused/blurred. */
  onCellFocus?: (rowIndex: number, columnId: string, rect: DOMRect) => void;
  onCellBlur?: () => void;
}

function emptyRow(q: TableQuestion): RowValues {
  const r: RowValues = {};
  for (const c of q.columns) r[c.id] = null;
  return r;
}

export function TableField({ q, rows, onChange, computeCtx, calculatedRef, onCellFocus, onCellBlur }: Props) {
  const data = rows.length === 0 ? Array.from({ length: q.minRows }, () => emptyRow(q)) : rows;

  function updateCell(rowIdx: number, colId: string, value: FieldValue) {
    const next = data.map((r, i) => (i === rowIdx ? { ...r, [colId]: value } : r));
    // If the dependent column's parent changes, clear dependents in the same row.
    const col = q.columns.find((c) => c.id === colId);
    if (col) {
      for (const dep of q.columns) {
        if (dep.kind === "selectDependent" && dep.dependsOn === colId) {
          next[rowIdx][dep.id] = null;
        }
      }
    }
    onChange(next);
  }

  function addRow() {
    if (q.maxRows && data.length >= q.maxRows) return;
    onChange([...data, emptyRow(q)]);
  }

  function removeRow(i: number) {
    if (data.length <= q.minRows) return;
    onChange(data.filter((_, idx) => idx !== i));
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="sticky left-0 bg-slate-50 px-2 py-2 text-left font-medium w-14">#</th>
            {q.columns.map((c) => (
              <th key={c.id} className="px-2 py-2 text-left font-medium whitespace-nowrap">
                {c.label}
                {c.required && <span className="ml-0.5 text-rose-500">*</span>}
                {c.unit && <span className="ml-1 font-normal normal-case text-slate-400">({c.unit})</span>}
              </th>
            ))}
            <th className="px-2 py-2 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, i) => {
            const filledCount = q.columns.filter((c) => isFilled(c, row[c.id])).length;
            return (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white px-2 py-1.5 text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        filledCount === 0
                          ? "bg-slate-300"
                          : filledCount === q.columns.length
                          ? "bg-emerald-500"
                          : "bg-amber-400"
                      }`}
                    />
                    {q.rowLabel ? q.rowLabel(i) : i + 1}
                  </div>
                </td>
                {q.columns.map((c) => {
                  const calc = calculatedRef ? calculatedRef(i, c.id) ?? undefined : undefined;
                  return (
                    <td
                      key={c.id}
                      className={`px-1 py-1 min-w-[140px] ${calc ? "bg-blue-50/30" : ""}`}
                    >
                      <FieldRenderer
                        field={c}
                        value={row[c.id]}
                        siblings={row}
                        onChange={(v) => updateCell(i, c.id, v)}
                        compact
                        computeCtx={computeCtx}
                        calculatedRef={calc}
                        onNumberFocus={
                          onCellFocus ? (rect) => onCellFocus(i, c.id, rect) : undefined
                        }
                        onNumberBlur={onCellBlur}
                      />
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-right">
                  <button
                    onClick={() => removeRow(i)}
                    disabled={data.length <= q.minRows}
                    className="text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400"
                    title="Remove row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2 text-xs">
        <span className="text-slate-500">
          {data.length} {data.length === 1 ? "row" : "rows"}
          {q.maxRows && ` · max ${q.maxRows}`}
        </span>
        <button
          onClick={addRow}
          disabled={q.maxRows ? data.length >= q.maxRows : false}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          + Add row
        </button>
      </div>
    </div>
  );
}
