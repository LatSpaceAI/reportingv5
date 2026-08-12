"use client";

// Pick a year, see what the workbook will contain, download it.
//
// Sibling of BrsrEnvironmentExportDialog rather than a generalisation of it: half
// of that component describes changes made to the CLIENT'S OWN template — a
// Was/Now diff table, formulas replaced, shared formulas expanded, template
// defects corrected. None of that exists here, because this workbook is authored
// from scratch and overwrites nobody's file.
//
// What it shows instead is the thing a reader of this export most needs to know
// before opening it: how little of the portfolio actually reported.

import { useCallback, useEffect, useState } from "react";

interface OutputReport {
  fiscalYear: string;
  sheets: string[];
  cellStates: { value: number; notFiled: number; notComputable: number; notApplicable: number };
  coverage: { siteMonthsFiled: number; siteMonthsExpected: number; pct: number };
  aggregatedSheets: string[];
  assumptionConstants: string[];
  assumptionFormulaCount: number;
}

const FISCAL_YEARS = ["2024-25", "2023-24", "2025-26"];

export default function StandardMetricsExportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [fiscalYear, setFiscalYear] = useState(FISCAL_YEARS[0]);
  const [report, setReport] = useState<OutputReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (fy: string) => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(
        `/api/esg/export/standard?fy=${encodeURIComponent(fy)}&report=1`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setReport(data as OutputReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadReport(fiscalYear);
  }, [open, fiscalYear, loadReport]);

  if (!open) return null;

  const pct = report ? Math.round(report.coverage.pct * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] border border-gray-200 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0A0A0A]">
              ESG metrics — standard template
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
              Every computed metric at the grain its disclosure asks for, in a workbook of our
              own rather than the client&apos;s.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] text-gray-400 hover:text-gray-600"
          >
            Close
          </button>
        </div>

        <div className="px-6 py-5">
          <label
            htmlFor="std-fy"
            className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500"
          >
            Fiscal year
          </label>
          <select
            id="std-fy"
            className="w-full border border-gray-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
          >
            {FISCAL_YEARS.map((fy) => (
              <option key={fy} value={fy}>
                FY {fy}
              </option>
            ))}
          </select>

          {loading && <p className="mt-4 text-[12px] text-gray-500">Building the workbook…</p>}

          {error && (
            <p className="mt-4 border-l-2 border-l-red-500 py-1 pl-3 text-[12px] text-red-800">
              {error}
            </p>
          )}

          {report && (
            <>
              {/* The coverage warning comes first, because at this coverage it is
                  the most important fact about the file. */}
              <div
                className={`mt-5 border border-l-4 px-4 py-3 ${
                  pct < 50
                    ? "border-amber-300 border-l-amber-500 bg-amber-50/60"
                    : "border-gray-200 border-l-brand bg-gray-50"
                }`}
              >
                <p
                  className={`text-[13px] font-semibold ${
                    pct < 50 ? "text-amber-900" : "text-[#0A0A0A]"
                  }`}
                >
                  {report.coverage.siteMonthsFiled} of{" "}
                  {report.coverage.siteMonthsExpected} site-months filed ({pct}%)
                </p>
                <p
                  className={`mt-1 text-[12px] leading-relaxed ${
                    pct < 50 ? "text-amber-800" : "text-gray-600"
                  }`}
                >
                  Figures are sums of the returns actually filed, so they are lower than a
                  full-portfolio disclosure. The workbook distinguishes a reported zero from a
                  return nobody filed, and says so on every sheet.
                </p>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Figures" value={report.cellStates.value} />
                <Stat label="Not filed" value={report.cellStates.notFiled} amber />
                <Stat label="Not computable" value={report.cellStates.notComputable} amber />
                <Stat label="Not applicable" value={report.cellStates.notApplicable} />
              </dl>

              <p className="mt-4 text-[12px] leading-relaxed text-gray-600">
                {report.sheets.length} sheets: {report.sheets.join(", ")}.
              </p>

              {report.aggregatedSheets.length > 0 && (
                <p className="mt-2 text-[12px] leading-relaxed text-gray-600">
                  <span className="font-medium">
                    {report.aggregatedSheets.join(" and ")}
                  </span>{" "}
                  {report.aggregatedSheets.length === 1 ? "is" : "are"} aggregated from monthly
                  rows by this export — the platform stores no figure at those grains. Each cell
                  carries the number of months behind it.
                </p>
              )}

              {report.assumptionConstants.length > 0 && (
                <p className="mt-2 text-[12px] leading-relaxed text-amber-800">
                  {report.assumptionConstants.length} constants and{" "}
                  {report.assumptionFormulaCount} formulas still rest on an assumption. Both are
                  listed in the workbook, and must be confirmed before these figures are
                  disclosed.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-200 px-4 py-2.5 text-[12px] font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!report}
            onClick={() => {
              window.location.href = `/api/esg/export/standard?fy=${encodeURIComponent(fiscalYear)}`;
            }}
            className="bg-brand px-4 py-2.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download workbook
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, amber }: { label: string; value: number; amber?: boolean }) {
  return (
    <div className="border border-gray-200 px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-gray-500">
        {label}
      </dt>
      <dd
        className={`mt-0.5 font-mono text-[15px] tabular-nums ${
          amber && value > 0 ? "text-amber-700" : "text-[#0A0A0A]"
        }`}
      >
        {value.toLocaleString("en-IN")}
      </dd>
    </div>
  );
}
