"use client";

// Standard Return — download a template, fill it in, upload it back.
//
// Sibling of /data-collection/excel-entry, which accepts a site's OWN monthly
// form and has to show match confidence and unplaced rows because it is reading
// somebody else's paper. This screen reads our own template by an explicit
// parameter key, so there is nothing to review about the MATCHING — only the
// figures themselves, the override warning, and any validation flags.
//
// Kept as a separate page rather than a mode toggle inside excel-entry: that
// screen's review table is built around fuzzy-match columns which are all
// meaningless here, and interleaving two review UIs in one component would make
// both harder to follow than either is alone.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/Toast";
import { CURRENT_USER } from "@/lib/currentUser";
import type { SiteSummary } from "@/lib/siteEntry/types";
import type { DataFlag } from "@/lib/siteEntry/types";

import {
  PageHeader,
  UploadIcon,
  labelClass,
  inputClass,
  AlertTriangleIcon,
  CheckCircleIcon,
} from "../shared";

interface PreviewRow {
  key: string;
  label: string;
  cell: string;
  rawText: string | null;
  value: number | null;
  isNotAvailable: boolean;
  remarks: string | null;
  parseNote: string | null;
  detectedUnit: string | null;
}

interface PreviewResponse {
  ok: boolean;
  error?: string;
  versionFound?: string | null;
  batchId?: number;
  filename?: string;
  templateVersion?: string;
  site?: { code: string; name: string };
  period?: { fiscalYear: string; monthNo: number; monthLabel: string | null };
  rows?: PreviewRow[];
  unknownKeys?: string[];
  summary?: {
    matched: number;
    unknown: number;
    notAvailable: number;
    reportedZero: number;
    blank: number;
  };
  existing?: {
    valueCount: number;
    status: string;
    lastEnteredBy: string | null;
    lastUpdatedAt: string | null;
  } | null;
}

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 4 });

export default function StandardReturnPage() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [fiscalYears, setFiscalYears] = useState<string[]>([]);
  const [siteCode, setSiteCode] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [monthNo, setMonthNo] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [committed, setCommitted] = useState<{ saved: number; superseded: number } | null>(null);
  const [flags, setFlags] = useState<DataFlag[]>([]);

  // The multi-month checklist. Lives OUTSIDE reset() deliberately: reset()
  // clears per-upload state on every file, and if the queue were cleared with
  // it, committing April and then uploading May would erase the record that
  // April was done — which is exactly what the checklist exists to show.
  const [queue, setQueue] = useState<
    { monthNo: number; monthLabel: string; state: "pending" | "committed" }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/esg/entry/sites");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load sites");
        setSites(data.sites ?? []);
        setFiscalYears(data.fiscalYears ?? []);
        if (data.sites?.length) setSiteCode(data.sites[0].code);
        if (data.fiscalYears?.length) setFiscalYear(data.fiscalYears[0]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = useCallback(() => {
    setPreview(null);
    setOverrideConfirmed(false);
    setCommitted(null);
    setFlags([]);
    setError(null);
  }, []);

  const downloadHref = useMemo(() => {
    const p = new URLSearchParams();
    if (siteCode) p.set("site", siteCode);
    if (fiscalYear) p.set("fy", fiscalYear);
    if (monthNo > 0) p.set("month", String(monthNo));
    return `/api/esg/entry/template?${p.toString()}`;
  }, [siteCode, fiscalYear, monthNo]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const upload = useCallback(
    async (f: File) => {
      reset();
      setUploading(true);
      setFile(f);
      try {
        const body = new FormData();
        body.append("file", f);
        // Sent as overrides only when the user has narrowed them. The file
        // carries its own header block, and it usually knows better.
        if (siteCode) body.append("siteCode", siteCode);
        if (monthNo > 0) {
          body.append("monthNo", String(monthNo));
          body.append("fiscalYear", fiscalYear);
        }

        const res = await fetch("/api/esg/entry/import/standard-preview", {
          method: "POST",
          body,
        });
        const data = (await res.json()) as PreviewResponse;
        if (!res.ok || !data.ok) {
          setError(data.error ?? "That file could not be read.");
          return;
        }
        setPreview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
      }
    },
    [siteCode, fiscalYear, monthNo, reset]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void upload(f);
    },
    [upload]
  );

  // ── Commit ────────────────────────────────────────────────────────────────
  const commit = useCallback(async () => {
    if (!preview?.batchId || !preview.period || !preview.site) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await fetch("/api/esg/entry/import/standard-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: preview.batchId,
          siteCode: preview.site.code,
          fiscalYear: preview.period.fiscalYear,
          monthNo: preview.period.monthNo,
          overrideExisting: overrideConfirmed || !preview.existing,
          enteredBy: CURRENT_USER.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.requiresOverride) {
          setError(data.error ?? "This month already has data.");
          setOverrideConfirmed(false);
          return;
        }
        throw new Error(data.error ?? "Could not save the import.");
      }
      setCommitted({ saved: data.saved ?? 0, superseded: data.superseded ?? 0 });
      setFlags(data.flags ?? []);

      // Record it in the checklist, so a part-finished set of months stays
      // visible after the next upload replaces the preview.
      const label = preview.period.monthLabel ?? `Month ${preview.period.monthNo}`;
      setQueue((prev) => {
        const next = prev.filter((q) => q.monthNo !== preview.period!.monthNo);
        return [
          ...next,
          { monthNo: preview.period!.monthNo, monthLabel: label, state: "committed" as const },
        ].sort((a, b) => a.monthNo - b.monthNo);
      });

      toast.show(
        `${data.saved} values recorded as a draft${
          data.superseded ? ` · ${data.superseded} replaced` : ""
        }`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.show(message);
    } finally {
      setCommitting(false);
    }
  }, [preview, overrideConfirmed, toast]);

  const needsOverride = Boolean(preview?.existing) && !overrideConfirmed;
  const rows = preview?.rows ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-10">
      <PageHeader
        icon={<UploadIcon className="h-5 w-5" />}
        title="Standard Return"
        subtitle="Download the standard template, fill it in, and upload it back."
        backHref="/data-collection"
      />

      {/* ── Pickers ─────────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="site">Site</label>
          <select
            id="site"
            className={inputClass}
            value={siteCode}
            onChange={(e) => setSiteCode(e.target.value)}
          >
            {sites.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="month">Month</label>
          <select
            id="month"
            className={inputClass}
            value={monthNo}
            onChange={(e) => setMonthNo(Number(e.target.value))}
          >
            <option value={0}>Read from the file</option>
            {MONTH_LABELS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="fy">Fiscal year</label>
          <select
            id="fy"
            className={inputClass}
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
          >
            {fiscalYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Download ────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-gray-200 bg-gray-50/60 px-5 py-4">
        <div>
          <h2 className="text-[13px] font-semibold text-[#0A0A0A]">
            Step 1 — get the template
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-gray-600">
            Built fresh from the current parameter list, pre-filled with the site and month
            above. Enter each figure in the unit shown; put <span className="font-mono">NA</span>{" "}
            beside anything unavailable, and leave rows you were not asked to report blank.
          </p>
        </div>
        <a
          href={downloadHref}
          className="flex-shrink-0 bg-brand px-4 py-2.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Download template
        </a>
      </div>

      {/* ── Multi-month checklist ───────────────────────────────────────── */}
      {queue.length > 0 && (
        <div className="mb-6 border border-gray-200 bg-white px-5 py-4">
          <h3 className="text-[12px] font-semibold text-[#0A0A0A]">Recorded this session</h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {queue.map((q) => (
              <span key={q.monthNo} className="font-mono text-[12px] text-gray-700">
                {q.monthLabel}{" "}
                <span className="text-brand">✓ recorded</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
            One month per workbook. Each is recorded separately, so uploading the next does not
            affect these. They are drafts until submitted on the site-return screen, and the
            logbook lists them if you leave this page.
          </p>
        </div>
      )}

      {/* ── Drop zone ───────────────────────────────────────────────────── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mb-6 border-2 border-dashed px-8 py-10 text-center transition-colors ${
          dragging ? "border-brand bg-brand/[0.03]" : "border-gray-200 bg-white"
        }`}
      >
        <UploadIcon className="mx-auto mb-3 h-7 w-7 text-brand/60" />
        <p className="text-sm text-gray-700">
          Step 2 — drop the filled template here, or{" "}
          <button
            type="button"
            className="font-medium text-brand underline underline-offset-2"
            onClick={() => fileInput.current?.click()}
          >
            choose a file
          </button>
          .
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Uploading a site&apos;s own monthly form instead?{" "}
          <a href="/data-collection/excel-entry" className="text-brand underline underline-offset-2">
            Use Excel Entry
          </a>
          .
        </p>
        {file && (
          <p className="mt-3 text-xs text-gray-600">
            {uploading ? "Reading" : "Loaded"} <span className="font-medium">{file.name}</span>
            {preview?.templateVersion ? ` · template v${preview.templateVersion}` : ""}
          </p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* ── Errors ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 flex items-start gap-3 border border-red-200 border-l-4 border-l-red-500 bg-red-50/60 px-5 py-4">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <p className="text-[12px] leading-relaxed text-red-900">{error}</p>
        </div>
      )}

      {/* ── Preview ─────────────────────────────────────────────────────── */}
      {preview?.ok && preview.site && preview.period && (
        <div className="border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div>
              <h2 className="text-[13px] font-semibold text-[#0A0A0A]">
                {preview.site.name} · {preview.period.monthLabel} {preview.period.fiscalYear}
              </h2>
              <p className="mt-1 text-[12px] text-gray-500">
                {preview.summary?.matched} figures ·{" "}
                {preview.summary?.notAvailable} not available ·{" "}
                {preview.summary?.reportedZero} reported zero ·{" "}
                {preview.summary?.blank} rows left blank
              </p>
            </div>
            {!committed && (
              <button
                type="button"
                disabled={committing || needsOverride}
                onClick={() => void commit()}
                className="flex-shrink-0 bg-brand px-4 py-2.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {committing ? "Recording…" : "Record as draft"}
              </button>
            )}
          </div>

          {/* Blank rows are the normal case, and must not read as zeros. */}
          {(preview.summary?.blank ?? 0) > 0 && (
            <p className="border-b border-gray-200 bg-gray-50/60 px-5 py-3 text-[11px] leading-relaxed text-gray-600">
              {preview.summary?.blank} rows were left blank and will not be recorded at all —
              not as zero. Only the {preview.summary?.matched} figures below will be stored.
            </p>
          )}

          {/* Override warning */}
          {preview.existing && (
            <div className="border-b border-gray-200 bg-amber-50/60 px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                <div>
                  <h3 className="text-[12px] font-semibold text-amber-900">
                    This month already holds {preview.existing.valueCount} values
                  </h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                    Recording this file replaces them. The existing figures are copied to
                    history first, so the change stays visible in the logbook and can be
                    undone.
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-[12px] text-amber-900">
                    <input
                      type="checkbox"
                      checked={overrideConfirmed}
                      onChange={(e) => setOverrideConfirmed(e.target.checked)}
                    />
                    Replace the existing figures
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Unknown keys */}
          {(preview.unknownKeys?.length ?? 0) > 0 && (
            <div className="border-b border-gray-200 bg-amber-50/40 px-5 py-3">
              <p className="text-[12px] text-amber-900">
                {preview.unknownKeys!.length} rows carried a parameter key this app does not
                recognise and will not be recorded:{" "}
                <span className="font-mono text-[11px]">
                  {preview.unknownKeys!.join(", ")}
                </span>
              </p>
            </div>
          )}

          {/* Committed */}
          {committed && (
            <div className="flex items-start gap-3 border-b border-gray-200 bg-brand-light/20 px-5 py-4">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
              <div>
                <h3 className="text-[12px] font-semibold text-brand">
                  {committed.saved} values recorded as a draft
                  {committed.superseded ? ` · ${committed.superseded} replaced` : ""}
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-gray-700">
                  Nothing is submitted yet. Review and submit this month on the{" "}
                  <a
                    href="/data-collection/site-return"
                    className="text-brand underline underline-offset-2"
                  >
                    site-return screen
                  </a>
                  . Only submitted returns feed the computed figures.
                </p>
                {flags.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {flags.map((f, i) => (
                      <li key={i} className="text-[11px] text-amber-800">
                        {f.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Rows */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-2 font-medium">Line item</th>
                  <th className="px-3 py-2 font-medium">Key</th>
                  <th className="px-3 py-2 font-medium">As typed</th>
                  <th className="px-3 py-2 text-right font-medium">Will store</th>
                  <th className="px-3 py-2 font-medium">Cell</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-2 text-gray-800">{r.label}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-500">{r.key}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.rawText ?? "—"}
                      {r.parseNote && (
                        <span className="ml-2 text-[11px] text-brand">{r.parseNote}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.isNotAvailable ? (
                        <span className="text-[11px] uppercase tracking-wide text-amber-700">
                          not available
                        </span>
                      ) : (
                        fmt(r.value)
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-400">{r.cell}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const MONTH_LABELS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];
