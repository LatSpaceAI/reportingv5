"use client";

// Logbook — every entered site-month, in one place.
//
// One collapsed row per (site, period): who entered it, when, from where, and
// how many values it holds. Expanding fetches the data points themselves.
//
// The two things this page exists to make visible:
//
//   * PROVENANCE. A figure typed by hand and one read out of a spreadsheet are
//     both legitimate, but they are not the same evidence. Each value shows
//     which it is, and an imported one names the file and cell it came from.
//
//   * SUPERSESSION. Re-uploading a month replaces its values. The replaced
//     ones are kept and shown here under "previously recorded", because an
//     override that left no trace would make the audit trail a claim rather
//     than a fact.

import { useCallback, useEffect, useMemo, useState } from "react";

import { initialsOf } from "@/lib/currentUser";
import type { LogbookEntrySummary } from "@/app/api/esg/logbook/route";
import type {
  LogbookValue,
  LogbookHistoryValue,
} from "@/app/api/esg/logbook/entry/route";

interface EntryFlag {
  parameterKey: string | null;
  ruleCode: string;
  severity: "info" | "warning" | "error";
  message: string;
  acknowledgedAt: string | null;
}

interface ImportRecord {
  id: number;
  filename: string;
  sheet_name: string | null;
  uploaded_by: string | null;
  committed_at: string | null;
  row_count: number;
  matched_count: number;
  unmatched_count: number;
}

interface EntryDetail {
  values: LogbookValue[];
  flags: EntryFlag[];
  history: LogbookHistoryValue[];
  imports: ImportRecord[];
}

const fmt = (n: number | null) =>
  n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 4 });

function when(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function LogbookPage() {
  const [entries, setEntries] = useState<LogbookEntrySummary[]>([]);
  const [fiscalYears, setFiscalYears] = useState<string[]>([]);
  const [fy, setFy] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, EntryDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/esg/logbook${fy ? `?fy=${encodeURIComponent(fy)}` : ""}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load the logbook");
        setEntries(data.entries ?? []);
        if (!fy && data.fiscalYears?.length) setFiscalYears(data.fiscalYears);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fy]);

  const keyOf = (e: LogbookEntrySummary) => `${e.siteId}-${e.periodId}`;

  const toggle = useCallback(
    async (e: LogbookEntrySummary) => {
      const key = keyOf(e);
      if (expanded === key) {
        setExpanded(null);
        return;
      }
      setExpanded(key);
      if (details[key]) return;

      setLoadingDetail(key);
      try {
        const res = await fetch(
          `/api/esg/logbook/entry?siteId=${e.siteId}&periodId=${e.periodId}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load values");
        setDetails((prev) => ({ ...prev, [key]: data }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingDetail(null);
      }
    },
    [expanded, details]
  );

  const totals = useMemo(
    () => ({
      entries: entries.length,
      values: entries.reduce((n, e) => n + e.valueCount, 0),
      imported: entries.filter((e) => e.importBatchId != null).length,
      flagged: entries.filter((e) => e.openFlagCount > 0).length,
    }),
    [entries]
  );

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-10">
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-[#0A0A0A]">Logbook</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every site-month that has been entered, with the values it holds and where they came
          from.
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Entries" value={String(totals.entries)} />
        <Stat label="Data points" value={totals.values.toLocaleString("en-IN")} />
        <Stat label="From Excel" value={String(totals.imported)} />
        <Stat label="With open flags" value={String(totals.flagged)} tone={totals.flagged ? "warn" : "neutral"} />
      </div>

      {/* Filter */}
      {fiscalYears.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.15em] text-gray-400">
            Fiscal year
          </span>
          <button
            type="button"
            onClick={() => setFy("")}
            className={`border px-3 py-1.5 text-xs transition-colors ${
              fy === "" ? "border-brand bg-brand/[0.04] text-brand" : "border-gray-200 text-gray-600"
            }`}
          >
            All
          </button>
          {fiscalYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setFy(y)}
              className={`border px-3 py-1.5 text-xs transition-colors ${
                fy === y ? "border-brand bg-brand/[0.04] text-brand" : "border-gray-200 text-gray-600"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="border border-gray-200 bg-white px-6 py-16 text-center text-sm text-gray-400">
          Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-600">Nothing has been entered yet.</p>
          <p className="mt-2 text-xs text-gray-400">
            Enter a return from{" "}
            <a className="text-brand underline underline-offset-2" href="/data-collection/site-return">
              Monthly Site Return
            </a>{" "}
            or upload one from{" "}
            <a className="text-brand underline underline-offset-2" href="/data-collection/excel-entry">
              Excel Entry
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 bg-white">
          {entries.map((e) => {
            const key = keyOf(e);
            const isOpen = expanded === key;
            const detail = details[key];
            return (
              <div key={key}>
                {/* ── Collapsed row ─────────────────────────────────────── */}
                <button
                  type="button"
                  onClick={() => void toggle(e)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50/60"
                >
                  <ChevronIcon
                    className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[#0A0A0A]">{e.siteName}</span>
                      <span className="text-sm text-gray-500">
                        {e.monthLabel} {e.fiscalYear}
                      </span>
                      <StatusChip status={e.status} />
                      {e.importBatchId != null && <SourceChip label="Excel" />}
                      {e.openFlagCount > 0 && (
                        <span className="border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-amber-800">
                          {e.openFlagCount} flag{e.openFlagCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {e.valueCount} data point{e.valueCount === 1 ? "" : "s"}
                      {e.naCount > 0 && ` · ${e.naCount} marked NA`}
                      {e.sourceDoc && (
                        <>
                          {" · "}
                          <span className="font-mono text-[11px] text-gray-400">
                            {e.sourceDoc.split("!")[0]}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-gray-700">{e.lastEnteredBy ?? "—"}</div>
                      <div className="text-[11px] text-gray-400">{when(e.lastUpdatedAt)}</div>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-[10px] font-medium text-brand">
                      {initialsOf(e.lastEnteredBy ?? "?")}
                    </div>
                  </div>
                </button>

                {/* ── Expanded ──────────────────────────────────────────── */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-4">
                    {loadingDetail === key ? (
                      <p className="py-6 text-center text-sm text-gray-400">Loading values…</p>
                    ) : !detail ? (
                      <p className="py-6 text-center text-sm text-gray-400">No values.</p>
                    ) : (
                      <>
                        {detail.imports.length > 0 && (
                          <div className="mb-4 border border-gray-200 bg-white px-4 py-3 text-xs">
                            <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-gray-400">
                              Imported from
                            </div>
                            {detail.imports.map((im) => (
                              <div key={im.id} className="text-gray-700">
                                <span className="font-medium">{im.filename}</span>
                                {im.sheet_name && (
                                  <span className="text-gray-500"> › {im.sheet_name}</span>
                                )}
                                <span className="text-gray-400">
                                  {" "}
                                  — {im.matched_count} of {im.row_count} rows matched
                                  {im.unmatched_count > 0 && `, ${im.unmatched_count} unmatched`}
                                  {im.uploaded_by && ` · ${im.uploaded_by}`}
                                  {im.committed_at && ` · ${when(im.committed_at)}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {detail.flags.filter((f) => !f.acknowledgedAt).length > 0 && (
                          <div className="mb-4 space-y-1.5">
                            {detail.flags
                              .filter((f) => !f.acknowledgedAt)
                              .map((f, i) => (
                                <div
                                  key={`${f.ruleCode}-${i}`}
                                  className={`border-l-2 px-3 py-2 text-xs ${
                                    f.severity === "error"
                                      ? "border-red-400 bg-red-50/70 text-red-800"
                                      : f.severity === "warning"
                                        ? "border-amber-400 bg-amber-50/70 text-amber-900"
                                        : "border-gray-300 bg-white text-gray-600"
                                  }`}
                                >
                                  {f.message}
                                </div>
                              ))}
                          </div>
                        )}

                        <div className="overflow-x-auto border border-gray-200 bg-white">
                          <table className="w-full min-w-[720px] text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] uppercase tracking-[0.1em] text-gray-500">
                                <th className="px-3 py-2 text-left font-medium">Parameter</th>
                                <th className="px-3 py-2 text-right font-medium">Value</th>
                                <th className="px-3 py-2 text-left font-medium">As filed</th>
                                <th className="px-3 py-2 text-left font-medium">Source</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.values.map((v) => (
                                <tr
                                  key={v.parameterKey}
                                  className="border-b border-gray-100 last:border-0"
                                >
                                  <td className="px-3 py-2">
                                    <div className="text-gray-800">{v.parameterLabel}</div>
                                    <div className="font-mono text-[10px] text-gray-400">
                                      {v.parameterKey}
                                      {v.isMemo && " · memo"}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {v.isNotAvailable ? (
                                      <span className="text-xs text-gray-400">not available</span>
                                    ) : (
                                      <>
                                        <span className="text-gray-800">{fmt(v.valueNum)}</span>
                                        {v.unit && (
                                          <span className="ml-1 text-[11px] text-gray-400">
                                            {v.unit}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-500">
                                    {v.rawText ? `“${v.rawText}”` : "—"}
                                  </td>
                                  <td className="px-3 py-2">
                                    <ProvenanceChip provenance={v.provenance} />
                                    {v.sourceDoc && (
                                      <div className="mt-0.5 font-mono text-[10px] text-gray-400">
                                        {v.sourceDoc}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {detail.history.length > 0 && (
                          <div className="mt-4">
                            <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-gray-400">
                              Previously recorded — replaced by a later upload
                            </div>
                            <div className="border border-gray-200 bg-white/60">
                              {detail.history.map((h, i) => (
                                <div
                                  key={`${h.parameterKey}-${i}`}
                                  className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 text-xs last:border-0"
                                >
                                  <span className="text-gray-600">{h.parameterLabel}</span>
                                  <span className="text-gray-500">
                                    {h.isNotAvailable ? "not available" : fmt(h.valueNum)}
                                    <span className="ml-2 text-gray-400">
                                      {h.enteredBy ?? "—"} · replaced {when(h.supersededAt)}
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warn";
}) {
  return (
    <div className="border border-gray-200 bg-white px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400">{label}</div>
      <div
        className={`mt-1 text-[20px] font-semibold ${
          tone === "warn" ? "text-amber-700" : "text-[#0A0A0A]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : status === "submitted" || status === "under_review"
        ? "border-blue-300 bg-blue-50 text-blue-800"
        : "border-gray-300 bg-gray-50 text-gray-600";
  return (
    <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function SourceChip({ label }: { label: string }) {
  return (
    <span className="border border-brand/30 bg-brand/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-brand">
      {label}
    </span>
  );
}

function ProvenanceChip({ provenance }: { provenance: string }) {
  const label =
    provenance === "imported"
      ? "from Excel"
      : provenance === "parsed"
        ? "parsed from text"
        : provenance === "estimated"
          ? "estimated"
          : "typed";
  return <span className="text-[11px] text-gray-500">{label}</span>;
}

// lucide: chevron-right
function ChevronIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
