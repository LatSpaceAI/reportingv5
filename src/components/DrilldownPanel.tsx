"use client";

// How was this number computed?
//
// Opened by clicking a computed value in the Requirements tab. Shows the
// formula chain, the constants behind it, and every monthly input across every
// contributing site.
//
// THE GRID'S THREE STATES CARRY THE WHOLE ARGUMENT
//
//   a number   filed, including a filed zero — a reported fact
//   NA         the site marked the row Not Available
//   ·          NO RETURN WAS FILED. Not zero. Never zero.
//
// resolve-birla.mjs writes no row at all for a site-month nobody filed, and
// this grid is the last place that distinction could be lost. With coverage at
// 8 of 77 FY25 site-months, most cells are dots — and a grid of zeros would
// read as a fully-reported portfolio that reported nothing.
//
// Layout follows BrsrEnvironmentExportDialog: coverage above the fold and never
// collapsed, because "a number that looks like a company total but isn't one is
// the most dangerous thing this app can hand someone".

import { useEffect, useState } from "react";
import { formatBoundValue } from "@/lib/reportBindings/formatBoundValue";

interface InputCell {
  siteCode: string;
  monthNo: number | null;
  monthLabel: string | null;
  state: "filed" | "filed_na" | "not_filed";
  value: number | null;
  rawText: string | null;
  provenance: string | null;
  comment: string | null;
}

interface InputRow {
  key: string;
  label: string;
  unit: string | null;
  total: number;
  filedCount: number;
  naCount: number;
  notFiledCount: number;
  cells: InputCell[];
}

interface Drilldown {
  outputKey: string;
  label: string;
  unit: string | null;
  siteCode: string;
  fiscalYear: string;
  periodKind: string;
  value: number | null;
  sitesReporting: number | null;
  sitesExpected: number | null;
  formulas: {
    outputKey: string;
    expression: string;
    depth: number;
    isAssumption: boolean;
    siteFilter: string | null;
  }[];
  workingShown: string | null;
  constants: {
    key: string;
    label: string;
    value: number;
    unit: string | null;
    isAssumption: boolean;
    source: string | null;
    updatedAt: string | null;
  }[];
  inputs: InputRow[];
  sites: { siteCode: string; siteName: string; value: number | null; filed: boolean }[];
  months: { monthNo: number; monthLabel: string }[];
  fromLedger: boolean;
  flags: { siteCode: string; monthLabel: string | null; rule: string; severity: string; message: string }[];
  notes: string[];
}

export function DrilldownPanel({
  outputKey,
  siteCode,
  fiscalYear,
  onClose,
}: {
  outputKey: string;
  siteCode: string;
  fiscalYear: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Drilldown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/esg/drilldown?key=${encodeURIComponent(outputKey)}&site=${encodeURIComponent(siteCode)}&fy=${encodeURIComponent(fiscalYear)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.ok) setError(json.error ?? "Could not load.");
        else setData(json.drilldown as Drilldown);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [outputKey, siteCode, fiscalYear]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-slate-900/30"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-4xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="font-mono text-[11px] text-slate-400">{outputKey}</div>
            <h2 className="truncate text-base font-semibold text-slate-900">
              {data?.label ?? "Loading…"}
            </h2>
            <div className="mt-0.5 text-xs text-slate-500">
              {siteCode} · FY {fiscalYear} {data ? data.periodKind.toUpperCase() : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {error && (
            <p className="border-l-2 border-l-red-500 py-1 pl-3 text-sm text-red-800">{error}</p>
          )}
          {!data && !error && <p className="text-sm text-slate-400">Loading…</p>}

          {data && (
            <>
              {/* Headline + coverage. Above the fold, never collapsible. */}
              <div className="mb-5 border border-slate-200 bg-slate-50/60 px-4 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums text-slate-900">
                    {data.value == null ? "Not computed" : formatBoundValue(data.value)}
                  </span>
                  {data.unit && data.value != null && (
                    <span className="text-sm text-slate-500">{data.unit}</span>
                  )}
                </div>
                <CoverageLine data={data} />
              </div>

              {data.notes.length > 0 && (
                <ul className="mb-5 space-y-1.5">
                  {data.notes.map((n, i) => (
                    <li
                      key={i}
                      className="border-l-2 border-l-amber-400 bg-amber-50/40 py-1 pl-3 text-[12px] text-amber-900"
                    >
                      {n}
                    </li>
                  ))}
                </ul>
              )}

              {data.workingShown && (
                <Section title="The working">
                  <code className="block break-all bg-slate-50 px-3 py-2 font-mono text-[12px] text-slate-700">
                    {data.workingShown} = {data.value == null ? "—" : formatBoundValue(data.value)}
                  </code>
                </Section>
              )}

              {data.formulas.length > 0 && (
                <Section title="Formula chain">
                  <div className="space-y-1">
                    {data.formulas.map((f) => (
                      <div
                        key={f.outputKey}
                        className="font-mono text-[11px] text-slate-600"
                        style={{ paddingLeft: `${f.depth * 16}px` }}
                      >
                        <span className="text-slate-900">{f.outputKey}</span>
                        {f.isAssumption && (
                          <span className="ml-1.5 rounded-sm bg-amber-100 px-1 text-[10px] text-amber-800">
                            assumption
                          </span>
                        )}
                        <span className="text-slate-400"> = </span>
                        {f.expression}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {data.constants.length > 0 && (
                <Section title="Constants used">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {data.constants.map((c) => (
                        <tr key={c.key} className="border-b border-slate-100">
                          <td className="py-1.5 pr-3 font-mono text-slate-500">{c.key}</td>
                          <td className="py-1.5 pr-3 text-slate-700">{c.label}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-slate-900">
                            {c.value} <span className="text-slate-400">{c.unit}</span>
                          </td>
                          <td className="py-1.5 text-right">
                            {c.isAssumption && (
                              <span className="rounded-sm bg-amber-100 px-1 text-[10px] text-amber-800">
                                assumption
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {data.sites.length > 0 && (
                <Section title="By site">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {data.sites.map((s) => (
                        <tr key={s.siteCode} className="border-b border-slate-100">
                          <td className="py-1.5 pr-3 font-mono text-slate-500">{s.siteCode}</td>
                          <td className="py-1.5 pr-3 text-slate-700">{s.siteName}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            {s.filed && s.value != null ? (
                              <span className="text-slate-900">{formatBoundValue(s.value)}</span>
                            ) : (
                              <span className="text-slate-300" title="No return filed — not a zero.">
                                not filed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {data.inputs.length > 0 && (
                <Section title="Monthly inputs">
                  <p className="mb-2 text-[11px] text-slate-500">
                    A number is what was filed, including a filed zero.{" "}
                    <span className="font-medium">NA</span> is a row the site marked unavailable.{" "}
                    <span className="font-medium">·</span> means no return was filed — it is not a
                    zero.
                  </p>
                  {data.inputs.map((row) => (
                    <InputMatrix key={row.key} row={row} months={data.months} />
                  ))}
                </Section>
              )}

              {data.flags.length > 0 && (
                <Section title={`Validation flags (${data.flags.length})`}>
                  <ul className="space-y-1">
                    {data.flags.map((f, i) => (
                      <li key={i} className="text-[12px] text-slate-600">
                        <span className="font-mono text-slate-400">
                          {f.siteCode} {f.monthLabel ?? ""}
                        </span>{" "}
                        <span
                          className={
                            f.severity === "error" ? "text-red-700" : "text-amber-700"
                          }
                        >
                          {f.rule}
                        </span>{" "}
                        — {f.message}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CoverageLine({ data }: { data: Drilldown }) {
  if (data.sitesReporting == null || !data.sitesExpected) {
    return (
      <div className="mt-1 text-[11px] text-slate-500">
        Coverage not recorded for this figure.
      </div>
    );
  }
  const pct = Math.round((data.sitesReporting / data.sitesExpected) * 100);
  return (
    <div className="mt-1 text-[11px] text-slate-600">
      Rests on{" "}
      <span className="font-medium">
        {data.sitesReporting} of {data.sitesExpected}
      </span>{" "}
      site-months filed ({pct}%). This is a sum of what was filed, not an estimate of the full
      portfolio.
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** One input parameter as a site × month grid. */
function InputMatrix({
  row,
  months,
}: {
  row: InputRow;
  months: { monthNo: number; monthLabel: string }[];
}) {
  const siteCodes = [...new Set(row.cells.map((c) => c.siteCode))];
  const byKey = new Map(row.cells.map((c) => [`${c.siteCode}|${c.monthNo}`, c]));

  return (
    <div className="mb-4">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-[11px] text-slate-400">{row.key}</span>{" "}
          <span className="text-[12px] text-slate-700">{row.label}</span>
        </div>
        <div className="shrink-0 text-[11px] tabular-nums text-slate-500">
          total <span className="font-medium text-slate-900">{row.total}</span> {row.unit} ·{" "}
          {row.filedCount} filed, {row.naCount} NA, {row.notFiledCount} not filed
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-[11px]">
          <thead>
            <tr className="text-slate-400">
              <th className="px-2 py-1 text-left font-medium">Site</th>
              {months.map((m) => (
                <th key={m.monthNo} className="px-2 py-1 text-right font-medium">
                  {m.monthLabel.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {siteCodes.map((code) => (
              <tr key={code} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-2 py-1 font-mono text-slate-500">{code}</td>
                {months.map((m) => {
                  const cell = byKey.get(`${code}|${m.monthNo}`);
                  return (
                    <td key={m.monthNo} className="px-2 py-1 text-right tabular-nums">
                      <Cell cell={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ cell }: { cell: InputCell | undefined }) {
  if (!cell || cell.state === "not_filed") {
    return (
      <span className="text-slate-300" title="No return filed for this site-month. This is not a zero.">
        ·
      </span>
    );
  }
  if (cell.state === "filed_na") {
    return (
      <span className="text-slate-400" title="The site marked this row Not Available.">
        NA
      </span>
    );
  }
  const title = [
    cell.rawText ? `filed as "${cell.rawText}"` : null,
    cell.provenance ? `provenance: ${cell.provenance}` : null,
    cell.comment,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span className="text-slate-900" title={title || undefined}>
      {cell.value}
    </span>
  );
}
