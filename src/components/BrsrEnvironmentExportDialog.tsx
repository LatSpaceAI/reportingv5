"use client";

// Export dialog for the BRSR Environment sheet, opened from the Export column of
// the reporting list. Replaces the old /data-collection/export page — same
// report, same warnings, but reached from the row it belongs to.
//
// The one thing this dialog must not let someone miss is how thin the evidence
// is. Portfolio figures are sums of the returns actually filed, not estimates of
// the full portfolio, and most site-months are typically uncollected. A number
// that looks like a company total but isn't one is the most dangerous thing this
// app can hand someone — so the coverage banner sits above the fold, outside the
// collapsible sections, and is never collapsed away.

import { useCallback, useEffect, useState } from "react";

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

export default function BrsrEnvironmentExportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [fiscalYear, setFiscalYear] = useState("2024-25");
  const [report, setReport] = useState<ExportReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/esg/export/environment?fy=${encodeURIComponent(fiscalYear)}&report=1`,
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

  // Only fetch while the dialog is actually open — otherwise every visit to the
  // reporting list would build an export nobody asked for.
  useEffect(() => {
    if (!open) return;
    void loadReport();
  }, [open, loadReport]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const download = () => {
    window.location.href = `/api/esg/export/environment?fy=${encodeURIComponent(fiscalYear)}`;
  };

  const cov = report?.coverage;
  const covPct =
    cov && cov.siteMonthsExpected > 0
      ? Math.round((cov.siteMonthsFiled / cov.siteMonthsExpected) * 100)
      : 0;

  const toggle = (id: string) =>
    setOpenSection((cur) => (cur === id ? null : id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="brsr-env-export-title"
        className="w-full max-w-[720px] rounded-lg bg-white shadow-xl"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <h2
              id="brsr-env-export-title"
              className="text-[15px] font-semibold text-[#0A0A0A]"
            >
              Export Birla Estate Custom Template
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
              Populates the Real Estate BRSR template with values computed from
              the site returns entered here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {/* ── Year picker ───────────────────────────────────────────── */}
          <div className="mb-5">
            <label
              htmlFor="brsr-env-fy"
              className="mb-1.5 block text-[11px] font-medium text-[#0A0A0A]/70"
            >
              Reporting year
            </label>
            <select
              id="brsr-env-fy"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="w-full max-w-[220px] rounded-md border border-gray-200 px-3 py-2 text-[13px] text-[#0A0A0A] outline-none focus:border-brand"
            >
              {FISCAL_YEARS.map((fy) => (
                <option key={fy} value={fy}>
                  FY {fy}
                </option>
              ))}
            </select>
          </div>

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
              {/* ── Coverage warning ─────────────────────────────────────
                  Never collapsible: it qualifies every number below it. */}
              {cov && covPct < 100 && (
                <div className="mb-4 border border-amber-200 bg-amber-50/70 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 text-amber-600" />
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
                    Every figure is the sum of the returns actually filed — not
                    an estimate of the full portfolio. Months and sites with no
                    return are left exactly as the template had them, never
                    zeroed. Collect the outstanding returns and re-export to
                    close the gap.
                  </p>
                </div>
              )}

              {/* ── What the export does ─────────────────────────────── */}
              <Collapsible
                id="writes"
                title="What this writes"
                meta={`FY ${report.fiscalYear}`}
                open={openSection === "writes"}
                onToggle={toggle}
              >
                <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
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
              </Collapsible>

              {/* ── Full change list ─────────────────────────────────── */}
              <Collapsible
                id="changes"
                title={`Every cell changed (${report.changes.length})`}
                open={openSection === "changes"}
                onToggle={toggle}
              >
                <div className="max-h-80 overflow-y-auto">
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
                          <td className="px-4 py-1.5 text-[#0A0A0A]/80">
                            {c.label}
                          </td>
                          <td
                            className={`max-w-[220px] truncate px-4 py-1.5 ${
                              c.replacedFormula
                                ? "font-mono text-[10px] text-amber-700"
                                : "text-gray-500"
                            }`}
                            title={String(c.previous ?? "")}
                          >
                            {c.previous == null
                              ? "(blank)"
                              : String(c.previous)}
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
              </Collapsible>
            </>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4">
          <p className="text-[11px] text-gray-500">
            Downloads the template workbook with these values written in.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-[12px] font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={download}
              disabled={!report || loading}
              className="flex items-center gap-2 bg-brand px-5 py-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Download populated template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Collapsible({
  id,
  title,
  meta,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  meta?: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3 border border-gray-200">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50/60"
      >
        <span className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className={`h-3 w-3 flex-shrink-0 text-gray-400 transition-transform ${
              open ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[13px] font-semibold text-[#0A0A0A]">
            {title}
          </span>
        </span>
        {meta && <span className="text-[11px] text-gray-500">{meta}</span>}
      </button>
      {open && <div className="border-t border-gray-200">{children}</div>}
    </section>
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
      <div className="text-2xl font-medium tabular-nums text-[#0A0A0A]">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-medium text-[#0A0A0A]/70">
        {label}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-gray-500">{hint}</div>}
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
