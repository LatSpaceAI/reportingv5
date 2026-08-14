"use client";

// HR & Procurement monthly returns — upload the two workbooks the client
// already fills ("BRSR - HR" and "BRSR - Procurement"), review, commit.
//
// Sibling of /data-collection/scope3-ledgers, and structured the same way,
// but the review question differs: a ledger asks "will these rows MATCH?",
// this return asks "did each cell land on the right parameter?" — so the
// screen leads with layout drift (sections not found, rows resolved by
// guesswork, list rows beyond the template) and shows the values themselves
// below.
//
// One thing this screen must say out loud: the sheets are filled CUMULATIVELY.
// Each month's file carries FY-to-date figures, so the latest committed month
// is the year-to-date, and that is what the Birla export writes.

import { useCallback, useRef, useState } from "react";

import { useToast } from "@/components/Toast";

import {
  PageHeader,
  UploadIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  labelClass,
  inputClass,
} from "../shared";

const FISCAL_YEARS = ["2025-26", "2024-25"];

// Fiscal order: month 1 is April.
const MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
] as const;

interface PreviewRow {
  key: string;
  label: string;
  cell: string;
  templateCell: string | null;
  kind: "number" | "text";
  value: number | null;
  text: string | null;
  isNotAvailable: boolean;
  matchedByLabel: boolean;
  known: boolean;
}

interface PreviewSheet {
  sheetName: string;
  title: string;
  domain: string;
  warnings: {
    blocksNotFound: string[];
    rowLabelMismatches: { blockId: string; expected: string; fallbackRow: number }[];
    listOverflow: { blockId: string; row: number; name: string }[];
    unparsedCells: { key: string; sheetCell: string; label: string; rawText: string }[];
  };
  rows: PreviewRow[];
  summary: {
    filled: number;
    notAvailable: number;
    reportedZero: number;
    text: number;
    blank: number;
    problems: number;
  };
  existingValues: number;
}

interface PreviewResponse {
  ok: boolean;
  error?: string;
  batchId?: number;
  filename?: string;
  site?: { code: string; name: string };
  period?: { fiscalYear: string; monthNo: number; monthLabel: string | null };
  sheets?: PreviewSheet[];
  unknownKeys?: string[];
  requiresOverride?: boolean;
}

export default function HrProcReturnPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fiscalYear, setFiscalYear] = useState(FISCAL_YEARS[0]);
  const [monthNo, setMonthNo] = useState(1);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [committed, setCommitted] = useState<{ saved: number; superseded: number } | null>(null);
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setPreview(null);
      setCommitted(null);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("fy", fiscalYear);
        form.append("monthNo", String(monthNo));
        const res = await fetch("/api/esg/hr-proc/preview", { method: "POST", body: form });
        const body = (await res.json()) as PreviewResponse;
        setPreview(body);
        if (!body.ok) toast.show(body.error ?? "The workbook could not be read.");
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [fiscalYear, monthNo, toast]
  );

  const commit = useCallback(
    async (overrideExisting: boolean) => {
      if (!preview?.batchId || !preview.period) return;
      setBusy(true);
      try {
        const res = await fetch("/api/esg/hr-proc/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId: preview.batchId,
            fiscalYear: preview.period.fiscalYear,
            monthNo: preview.period.monthNo,
            overrideExisting,
          }),
        });
        const body = await res.json();
        if (!body.ok) {
          toast.show(body.error ?? "The commit failed.");
          return;
        }
        setCommitted({ saved: body.saved, superseded: body.superseded });
        setPreview(null);
        toast.show(`${body.saved} value${body.saved === 1 ? "" : "s"} saved.`);
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Commit failed.");
      } finally {
        setBusy(false);
      }
    },
    [preview, toast]
  );

  const problemCount =
    preview?.sheets?.reduce((n, s) => n + s.summary.problems, 0) ?? 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-6 py-6">
        <PageHeader
          icon={<UploadIcon className="h-5 w-5" />}
          title="HR & Procurement Return"
          subtitle="Upload the monthly BRSR HR and Procurement workbooks. Figures are cumulative for the year — the latest month is the year-to-date."
          backHref="/data-collection"
        />

        {/* ---- Upload ------------------------------------------------------ */}
        <section className="mb-6 border border-gray-200 p-5">
          <h2 className="mb-1 text-[14px] font-semibold text-[#0A0A0A]">
            1. Upload a filled workbook
          </h2>
          <p className="mb-4 text-[12px] leading-relaxed text-gray-500">
            Either workbook is recognised by its tab — <em>HR</em> or{" "}
            <em>Proc,Supply Chain, MKt</em> — and a file carrying both is read in one
            go. The month is yours to state: the files themselves do not carry one.
            Nothing is saved until you confirm.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelClass}>Fiscal year</label>
              <select
                className={inputClass}
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
              >
                {FISCAL_YEARS.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Month (as-of)</label>
              <select
                className={inputClass}
                value={monthNo}
                onChange={(e) => setMonthNo(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 border border-brand bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              <UploadIcon className="h-4 w-4" />
              {busy ? "Reading…" : "Choose a file"}
            </button>
            {preview?.filename && (
              <span className="text-[12px] text-gray-500">{preview.filename}</span>
            )}
          </div>
        </section>

        {/* ---- Committed --------------------------------------------------- */}
        {committed && (
          <section className="mb-6 border border-emerald-200 bg-emerald-50/50 p-5">
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 text-emerald-700" />
              <div>
                <p className="text-[13px] font-medium text-emerald-900">
                  {committed.saved} value{committed.saved === 1 ? "" : "s"} saved
                  {committed.superseded > 0 &&
                    `, replacing ${committed.superseded} previously recorded`}
                  .
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-emerald-800">
                  Recorded as a <strong>draft</strong> against the group at the month you
                  chose. The figures are now chartable on the dashboard, and the Birla
                  Estate template export will carry each parameter&apos;s latest month as
                  the year-to-date.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ---- Preview ----------------------------------------------------- */}
        {preview?.ok && preview.sheets && (
          <section className="mb-6 border border-gray-200">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-[14px] font-semibold text-[#0A0A0A]">
                2. Review — {preview.sheets.map((s) => s.title).join(" and ")} ·{" "}
                {preview.period?.monthLabel} {preview.period?.fiscalYear}
              </h2>
            </div>

            {/* Layout drift first: these are the cells that may have landed on
                the wrong parameter, and that is the decision being made here. */}
            {problemCount > 0 ? (
              <div className="border-b border-amber-200 bg-amber-50/50 px-5 py-4">
                <div className="flex items-start gap-2">
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4 text-amber-700" />
                  <div className="text-[12px] leading-relaxed text-amber-900">
                    <p className="font-medium">
                      The sheet does not fully match the expected layout.
                    </p>
                    <ul className="mt-2 space-y-1">
                      {preview.sheets.flatMap((s) => [
                        ...s.warnings.blocksNotFound.map((b) => (
                          <li key={`${s.domain}-nb-${b}`}>
                            <strong>Section not found:</strong> “{b}” — every cell in it was
                            skipped.
                          </li>
                        )),
                        ...s.warnings.rowLabelMismatches.map((m) => (
                          <li key={`${s.domain}-rm-${m.blockId}-${m.expected}`}>
                            <strong>Row not found by its label:</strong> “{m.expected}” —
                            read from row {m.fallbackRow} by position instead. Check those
                            values below.
                          </li>
                        )),
                        ...s.warnings.listOverflow.map((o) => (
                          <li key={`${s.domain}-lo-${o.row}`}>
                            <strong>Extra list row:</strong> “{o.name || "(unnamed)"}” at row{" "}
                            {o.row} has no slot in the template — it was not read.
                          </li>
                        )),
                        ...s.warnings.unparsedCells.map((u) => (
                          <li key={`${s.domain}-up-${u.sheetCell}`}>
                            <strong>Not a number:</strong> {u.sheetCell} reads “{u.rawText}” —
                            expected a figure for “{u.label}”. It was not recorded.
                          </li>
                        )),
                      ])}
                      {(preview.unknownKeys?.length ?? 0) > 0 && (
                        <li>
                          <strong>{preview.unknownKeys?.length}</strong> parameter(s) are not
                          seeded in this database — apply the latest migration.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-b border-emerald-200 bg-emerald-50/50 px-5 py-3">
                <div className="flex items-center gap-2 text-[12px] text-emerald-900">
                  <CheckCircleIcon className="h-4 w-4" />
                  Every section and row was found by its label.
                </div>
              </div>
            )}

            {/* Per sheet: summary + expandable value table */}
            {preview.sheets.map((s) => (
              <div key={s.domain} className="border-b border-gray-200 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[#0A0A0A]">{s.title}</h3>
                    <p className="text-[11px] text-gray-500">
                      {s.summary.filled} cells read · {s.summary.reportedZero} reported zero ·{" "}
                      {s.summary.notAvailable} marked NA · {s.summary.text} text answers ·{" "}
                      {s.summary.blank} left blank
                      {s.existingValues > 0 && (
                        <span className="text-amber-700">
                          {" "}
                          · {s.existingValues} values already recorded for this month
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSheet(expandedSheet === s.domain ? null : s.domain)
                    }
                    className="border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-[#0A0A0A] transition-colors hover:border-brand hover:text-brand"
                  >
                    {expandedSheet === s.domain ? "Hide values" : "Show values"}
                  </button>
                </div>

                {expandedSheet === s.domain && (
                  <div className="mt-3 max-h-[420px] overflow-y-auto border border-gray-100">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="px-2 py-1 font-medium">Cell</th>
                          <th className="px-2 py-1 font-medium">Parameter</th>
                          <th className="px-2 py-1 text-right font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.rows.map((r) => (
                          <tr key={r.key} className="border-b border-gray-100 align-top">
                            <td className="px-2 py-1 font-mono text-[11px] text-gray-500">
                              {r.cell}
                              {!r.matchedByLabel && (
                                <span className="text-amber-700" title="Row located by position, not label"> *</span>
                              )}
                            </td>
                            <td className="px-2 py-1">{r.label}</td>
                            <td className="px-2 py-1 text-right">
                              {r.isNotAvailable ? (
                                <span className="text-gray-400">NA</span>
                              ) : r.kind === "text" ? (
                                <span
                                  className="block max-w-[320px] truncate text-left"
                                  title={r.text ?? ""}
                                >
                                  {r.text}
                                </span>
                              ) : (
                                r.value?.toLocaleString("en-IN")
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {/* ---- Confirm ------------------------------------------------- */}
            <div className="flex items-center justify-between gap-4 border-t border-gray-200 bg-gray-50/50 px-5 py-4">
              <div className="text-[12px] text-gray-600">
                {preview.requiresOverride ? (
                  <span className="text-amber-800">
                    This month already holds values for{" "}
                    {preview.sheets
                      .filter((s) => s.existingValues > 0)
                      .map((s) => s.title)
                      .join(" and ")}
                    . Committing replaces them — the previous values are archived, not
                    deleted. The other return&apos;s figures are untouched.
                  </span>
                ) : (
                  <span>Nothing has been saved yet.</span>
                )}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => commit(Boolean(preview.requiresOverride))}
                className="shrink-0 border border-brand bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
              >
                {preview.requiresOverride ? "Replace and save" : "Save these values"}
              </button>
            </div>
          </section>
        )}

        {/* ---- Read failure ------------------------------------------------ */}
        {preview && !preview.ok && (
          <section className="mb-6 border border-red-200 bg-red-50/50 p-5">
            <div className="flex items-start gap-2">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 text-red-700" />
              <p className="text-[12px] font-medium leading-relaxed text-red-900">
                {preview.error}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
