"use client";

// Export the BRSR Environment sheet, populated from entered site returns.
//
// The deliverable is the client's OWN template workbook with computed values in
// its exact cells — same layout, same merged ranges, same styling, same eight
// other sheets. Two things this screen must make impossible to miss:
//
//   1. How thin the evidence is. Portfolio figures are sums of filed returns,
//      not estimates of the full portfolio, and right now most site-months are
//      uncollected. A number that looks like a company total but isn't one is
//      the most dangerous thing this app can hand someone.
//   2. That the export CHANGES published numbers — it corrects five template
//      defects and replaces broken external links. The change report is one
//      click away for exactly that reason.

import { useCallback, useEffect, useState } from "react";

import {
  PageHeader,
  DownloadIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  SpreadsheetIcon,
  labelClass,
  inputClass,
} from "../shared";

interface ExportChange {
  cell: string;
  label: string;
  previous: string | number | null;
  written: number;
  replacedFormula: boolean;
}

interface ExportReport {
  fiscalYear: string;
  cellsWritten: number;
  formulasReplaced: number;
  sharedFormulasExpanded: number;
  changes: ExportChange[];
  missingKeys: string[];
  coverage: { siteMonthsFiled: number; siteMonthsExpected: number } | null;
  defectsCorrected: { cell: string; what: string; fix: string }[];
}

const FISCAL_YEARS = ["2024-25", "2023-24", "2025-26"];

export default function ExportPage() {
  const [fiscalYear, setFiscalYear] = useState("2024-25");
  const [report, setReport] = useState<ExportReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/esg/export/environment?fy=${encodeURIComponent(fiscalYear)}&report=1`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build the export");
      setReport(data as ExportReport);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const download = () => {
    window.location.href = `/api/esg/export/environment?fy=${encodeURIComponent(fiscalYear)}`;
  };

  const cov = report?.coverage;
  const covPct =
    cov && cov.siteMonthsExpected > 0
      ? Math.round((cov.siteMonthsFiled / cov.siteMonthsExpected) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[900px] px-6 py-6">
        <PageHeader
          icon={<SpreadsheetIcon className="h-5 w-5" />}
          title="Export BRSR Environment"
          subtitle="Populates the Real Estate BRSR template with values computed from the site returns entered here."
          backHref="/data-collection"
        />

        {/* ── Year picker ─────────────────────────────────────────────── */}
        <section className="mb-6 border border-gray-200">
          <div className="border-b border-gray-200 px-5 py-4">
            <h3 className="text-[13px] font-semibold text-[#0A0A0A]">Reporting year</h3>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Fiscal year</label>
              <select
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className={inputClass}
              >
                {FISCAL_YEARS.map((fy) => (
                  <option key={fy} value={fy}>
                    FY {fy}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && (
          <p className="py-10 text-center text-sm text-gray-500">
            Building the export…
          </p>
        )}

        {error && !loading && (
          <div className="border border-rose-200 bg-rose-50 p-5">
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}

        {report && !loading && (
          <>
            {/* ── Coverage warning ───────────────────────────────────────
                Deliberately the first and largest thing on the page. */}
            {cov && covPct < 100 && (
              <div className="mb-4 border border-amber-200 bg-amber-50/70 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
                  <h3 className="text-[13px] font-semibold text-amber-900">
                    This export covers {cov.siteMonthsFiled} of{" "}
                    {cov.siteMonthsExpected} site-months ({covPct}%)
                  </h3>
                </div>
                <div className="mb-3 h-1.5 w-full bg-amber-200/60">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${Math.max(covPct, 1)}%` }}
                  />
                </div>
                <p className="text-[12px] leading-relaxed text-amber-900/80">
                  Every figure is the sum of the returns actually filed — not an
                  estimate of the full portfolio. Months and sites with no return
                  are left exactly as the template had them, never zeroed. Collect
                  the outstanding returns and re-export to close the gap.
                </p>
              </div>
            )}

            {/* ── What the export does ───────────────────────────────── */}
            <section className="mb-4 border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h3 className="text-[13px] font-semibold text-[#0A0A0A]">
                  What this writes
                </h3>
                <span className="text-[11px] text-gray-500">
                  FY {report.fiscalYear}
                </span>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-3">
                <Stat label="Cells written" value={report.cellsWritten} />
                <Stat
                  label="Broken formulas replaced"
                  value={report.formulasReplaced}
                  hint="External links into a file nobody has"
                />
                <Stat
                  label="Metrics with no data"
                  value={report.missingKeys.length}
                  hint="Left as the template had them"
                />
              </div>
            </section>

            {/* ── Template defects corrected ─────────────────────────── */}
            <section className="mb-4 border border-gray-200">
              <div className="border-b border-gray-200 px-5 py-4">
                <h3 className="text-[13px] font-semibold text-[#0A0A0A]">
                  Template defects corrected
                </h3>
                <p className="mt-1 text-[11px] text-gray-500">
                  These change figures the published workbook reported. Each is
                  listed so the difference can be explained rather than
                  discovered.
                </p>
              </div>
              <ul className="divide-y divide-gray-100">
                {report.defectsCorrected.map((d) => (
                  <li key={d.cell} className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand" />
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-[#0A0A0A]">
                          {d.cell}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-relaxed text-gray-600">
                          {d.what}
                        </div>
                        <div className="mt-0.5 text-[11px] text-brand">{d.fix}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Full change list ───────────────────────────────────── */}
            <section className="mb-6 border border-gray-200">
              <button
                type="button"
                onClick={() => setShowChanges((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50/60"
              >
                <h3 className="text-[13px] font-semibold text-[#0A0A0A]">
                  Every cell changed ({report.changes.length})
                </h3>
                <span className="text-[11px] text-gray-500">
                  {showChanges ? "Hide" : "Show"}
                </span>
              </button>
              {showChanges && (
                <div className="max-h-80 overflow-y-auto border-t border-gray-200">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-gray-50/95">
                      <tr className="text-left text-gray-500">
                        <th className="px-4 py-2 font-medium">Cell</th>
                        <th className="px-4 py-2 font-medium">Metric</th>
                        <th className="px-4 py-2 font-medium">Was</th>
                        <th className="px-4 py-2 text-right font-medium">Now</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.changes.map((c) => (
                        <tr key={c.cell}>
                          <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[10px] text-[#0A0A0A]/70">
                            {c.cell}
                          </td>
                          <td className="px-4 py-1.5 text-[#0A0A0A]/80">{c.label}</td>
                          <td
                            className={`max-w-[220px] truncate px-4 py-1.5 ${
                              c.replacedFormula ? "font-mono text-[10px] text-amber-700" : "text-gray-500"
                            }`}
                            title={String(c.previous ?? "")}
                          >
                            {c.previous == null ? "(blank)" : String(c.previous)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-1.5 text-right tabular-nums text-[#0A0A0A]">
                            {c.written.toLocaleString("en-IN", {
                              maximumFractionDigits: 4,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-5">
              <p className="text-[11px] text-gray-500">
                Downloads the template workbook with these values written in.
              </p>
              <button
                type="button"
                onClick={download}
                className="flex items-center gap-2 bg-brand px-5 py-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                Download populated template
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-2xl font-medium tabular-nums text-[#0A0A0A]">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium text-[#0A0A0A]/70">{label}</div>
      {hint && <div className="mt-0.5 text-[10px] text-gray-500">{hint}</div>}
    </div>
  );
}
