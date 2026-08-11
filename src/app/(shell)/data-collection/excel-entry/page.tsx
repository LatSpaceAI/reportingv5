"use client";

// Excel Entry — upload a monthly site return instead of retyping it.
//
// The screen is a review queue, not a file drop. Uploading parses the workbook
// and shows every row it read: the label as printed, the text as filed, what it
// parsed to, and what it will store. Nothing reaches the database until the
// reviewer approves.
//
// Three things are surfaced rather than resolved automatically, because each
// one moves a published number:
//
//   * rows the importer could not place        (the form may have changed)
//   * values ±20% from the same month last year (the anomaly check)
//   * a month that already holds data           (the override warning)
//
// Approving records the figures as a DRAFT. Submitting is a separate, explicit
// act on the site-return screen — an uploaded file is evidence that someone
// typed something, not that anyone checked it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/Toast";
import { CURRENT_USER } from "@/lib/currentUser";
import type { PreviewResponse, PreviewRow, CommitEdit } from "@/lib/siteEntry/importTypes";
import type { SiteSummary } from "@/lib/siteEntry/types";

import {
  PageHeader,
  UploadIcon,
  labelClass,
  inputClass,
  AlertTriangleIcon,
  CheckCircleIcon,
} from "../shared";

const MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 4 });

export default function ExcelEntryPage() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [fiscalYears, setFiscalYears] = useState<string[]>([]);
  const [siteCode, setSiteCode] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  // 0 = "read it from the file", which is the default because the file knows.
  const [monthNo, setMonthNo] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<number, { raw: string; notAvailable: boolean }>>({});
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [committed, setCommitted] = useState<{ saved: number; superseded: number } | null>(null);

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
    setEdits({});
    setOverrideConfirmed(false);
    setCommitted(null);
    setError(null);
  }, []);

  // ── Upload ────────────────────────────────────────────────────────────────
  const upload = useCallback(
    async (f: File) => {
      if (!siteCode) {
        setError("Choose the site this return belongs to first.");
        return;
      }
      reset();
      setUploading(true);
      setFile(f);
      try {
        const body = new FormData();
        body.append("file", f);
        body.append("siteCode", siteCode);
        body.append("uploadedBy", CURRENT_USER.id);
        if (monthNo > 0) {
          body.append("monthNo", String(monthNo));
          body.append("fiscalYear", fiscalYear);
        }

        const res = await fetch("/api/esg/entry/import/preview", { method: "POST", body });
        const data = (await res.json()) as PreviewResponse;
        if (!res.ok || !data.ok) {
          setError(data.error ?? "That file could not be read.");
          setPreview(data.monthlySheetNames?.length ? data : null);
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

  // ── Rows, grouped for display ─────────────────────────────────────────────
  const rows = preview?.rows ?? [];
  const matchedRows = useMemo(() => rows.filter((r) => r.matchedFieldId != null), [rows]);
  const unmatchedRows = useMemo(() => rows.filter((r) => r.matchedFieldId == null), [rows]);
  const anomalyRows = useMemo(
    () => matchedRows.filter((r) => r.flags.some((f) => f.ruleCode === "ANOMALY_VS_PRIOR")),
    [matchedRows]
  );

  const editValue = useCallback((fieldId: number, raw: string, notAvailable: boolean) => {
    setEdits((prev) => ({ ...prev, [fieldId]: { raw, notAvailable } }));
  }, []);

  // ── Commit ────────────────────────────────────────────────────────────────
  const commit = useCallback(async () => {
    if (!preview?.batchId || !preview.period || !preview.site) return;
    setCommitting(true);
    setError(null);
    try {
      const editList: CommitEdit[] = Object.entries(edits).map(([fieldId, e]) => ({
        fieldId: Number(fieldId),
        value: e.notAvailable || e.raw.trim() === "" ? null : Number(e.raw.replace(/,/g, "")),
        notAvailable: e.notAvailable,
      }));

      const res = await fetch("/api/esg/entry/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: preview.batchId,
          siteCode: preview.site.code,
          fiscalYear: preview.period.fiscalYear,
          monthNo: preview.period.monthNo,
          edits: editList,
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
  }, [preview, edits, overrideConfirmed, toast]);

  const needsOverride = Boolean(preview?.existing) && !overrideConfirmed;

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-10">
      <PageHeader
        icon={<UploadIcon className="h-5 w-5" />}
        title="Excel Entry"
        subtitle="Upload a monthly site return and review what it contains before it is recorded."
        backHref="/data-collection"
      />

      {/* ── Pickers ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="site">Site</label>
          <select
            id="site"
            className={inputClass}
            value={siteCode}
            onChange={(e) => {
              setSiteCode(e.target.value);
              reset();
            }}
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
            onChange={(e) => {
              setMonthNo(Number(e.target.value));
              reset();
            }}
          >
            <option value={0}>Read from the file</option>
            {MONTHS.map((m, i) => (
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
            disabled={monthNo === 0}
            onChange={(e) => {
              setFiscalYear(e.target.value);
              reset();
            }}
          >
            {fiscalYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

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
          Drop a monthly return here, or{" "}
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
          One month per file. Workbooks containing several monthly sheets are not accepted.
        </p>
        {file && (
          <p className="mt-3 text-xs text-gray-600">
            {uploading ? "Reading" : "Loaded"} <span className="font-medium">{file.name}</span>
            {preview?.sheetName ? ` › ${preview.sheetName}` : ""}
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
        <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-800">
              <p>{error}</p>
              {preview?.monthlySheetNames && preview.monthlySheetNames.length > 1 && (
                <p className="mt-2 text-xs text-red-700">
                  Sheets found: {preview.monthlySheetNames.join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Committed ───────────────────────────────────────────────────── */}
      {committed && (
        <div className="mb-6 border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <div className="text-sm text-emerald-900">
              <p className="font-medium">
                {committed.saved} values recorded
                {committed.superseded > 0 && ` · ${committed.superseded} previous values replaced`}
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                Saved as a <strong>draft</strong>. It does not count toward coverage or reach the
                BRSR export until the return is submitted from the site-return screen. The entry is
                now in the <a className="underline underline-offset-2" href="/logbook">logbook</a>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview ─────────────────────────────────────────────────────── */}
      {preview?.ok && !committed && (
        <>
          {/* What the file was read as */}
          <div className="mb-4 border border-gray-200 bg-white px-5 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <Detail label="Site" value={preview.site?.name ?? "—"} />
              <Detail
                label="Period"
                value={`${preview.period?.monthLabel ?? ""} ${preview.period?.fiscalYear ?? ""}`.trim()}
              />
              <Detail label="Form" value={preview.form?.name ?? "—"} />
              <Detail
                label="Rows read"
                value={`${preview.summary?.matched ?? 0} matched · ${
                  preview.summary?.unmatched ?? 0
                } unmatched`}
              />
            </div>
            {preview.detected?.sourceText && (
              <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
                The file&apos;s own header says{" "}
                <span className="font-medium text-gray-700">
                  &ldquo;{preview.detected.sourceText}&rdquo;
                </span>
                {preview.detected.siteName && (
                  <> for <span className="font-medium text-gray-700">{preview.detected.siteName}</span></>
                )}
                .
              </p>
            )}
            {preview.detected?.siteAmbiguous && (
              <p className="mt-2 text-xs text-amber-700">
                The site named in the file does not obviously match{" "}
                <strong>{preview.site?.name}</strong>. Confirm you picked the right site.
              </p>
            )}
          </div>

          {/* Override warning — the loudest thing on the page */}
          {preview.existing && (
            <div className="mb-4 border-l-2 border-amber-500 bg-amber-50 px-5 py-4">
              <div className="flex items-start gap-2">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    {preview.period?.monthLabel} {preview.period?.fiscalYear} already has data for{" "}
                    {preview.site?.name}.
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    {preview.existing.valueCount} values are recorded
                    {preview.existing.lastEnteredBy && ` by ${preview.existing.lastEnteredBy}`}
                    {preview.existing.lastUpdatedAt &&
                      ` on ${new Date(preview.existing.lastUpdatedAt).toLocaleDateString("en-IN")}`}
                    {preview.existing.status && ` · status: ${preview.existing.status}`}.{" "}
                    <strong>
                      {preview.existing.changedCount} of them would change.
                    </strong>{" "}
                    The previous values are kept in the logbook, not deleted.
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-900">
                    <input
                      type="checkbox"
                      checked={overrideConfirmed}
                      onChange={(e) => setOverrideConfirmed(e.target.checked)}
                      className="h-3.5 w-3.5 accent-amber-600"
                    />
                    Replace the existing values for this month
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Form-level flags: missing required rows */}
          {(preview.formFlags?.length ?? 0) > 0 && (
            <div className="mb-4 space-y-2">
              {preview.formFlags!.map((f, i) => (
                <div
                  key={`${f.ruleCode}-${i}`}
                  className="border-l-2 border-amber-400 bg-amber-50/60 px-4 py-2 text-xs text-amber-900"
                >
                  {f.message}
                </div>
              ))}
            </div>
          )}

          {/* Summary chips */}
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <Chip tone="neutral" label={`${matchedRows.length} rows matched`} />
            {anomalyRows.length > 0 && (
              <Chip tone="warn" label={`${anomalyRows.length} outside ±20%`} />
            )}
            {unmatchedRows.length > 0 && (
              <Chip tone="warn" label={`${unmatchedRows.length} unmatched`} />
            )}
            {(preview.summary?.notAvailable ?? 0) > 0 && (
              <Chip tone="neutral" label={`${preview.summary!.notAvailable} marked NA`} />
            )}
          </div>

          {/* The rows */}
          <div className="overflow-x-auto border border-gray-200 bg-white">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] uppercase tracking-[0.1em] text-gray-500">
                  <Th>Cell</Th>
                  <Th>Row as printed</Th>
                  <Th>As filed</Th>
                  <Th align="right">Value</Th>
                  <Th align="right">Stored as</Th>
                  <Th>Check</Th>
                </tr>
              </thead>
              <tbody>
                {matchedRows.map((r) => (
                  <PreviewRowView
                    key={`${r.sheetCell}-${r.matchedFieldId}`}
                    row={r}
                    edit={r.matchedFieldId ? edits[r.matchedFieldId] : undefined}
                    onEdit={editValue}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Unmatched rows, listed separately so they cannot be scrolled past */}
          {unmatchedRows.length > 0 && (
            <div className="mt-4 border border-amber-200 bg-amber-50/50">
              <div className="border-b border-amber-200 px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-amber-800">
                {unmatchedRows.length} rows could not be matched to this form — they will not be
                saved
              </div>
              <ul className="divide-y divide-amber-100">
                {unmatchedRows.map((r) => (
                  <li key={`${r.sheetCell}-${r.sourceLabel}`} className="px-4 py-2 text-xs">
                    <span className="font-mono text-amber-700">{r.sheetCell}</span>{" "}
                    <span className="text-gray-700">{r.sourceLabel}</span>
                    <span className="text-gray-500"> — &ldquo;{r.rawText}&rdquo;</span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-amber-200 px-4 py-2 text-xs text-amber-800">
                If any of these carry a figure that belongs in the disclosure, the site&apos;s form
                layout has changed and needs updating before this month is submitted.
              </p>
            </div>
          )}

          {/* Approve */}
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-6">
            <p className="text-xs text-gray-500">
              Approving records these figures as a <strong>draft</strong>. Submitting the return is
              a separate step.
            </p>
            <button
              type="button"
              disabled={committing || needsOverride || matchedRows.length === 0}
              onClick={() => void commit()}
              className="flex items-center gap-2 bg-brand px-6 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {committing
                ? "Recording…"
                : needsOverride
                  ? "Confirm the override first"
                  : `Approve ${matchedRows.length} values`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400">{label}</div>
      <div className="mt-1 text-gray-800">{value}</div>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: "neutral" | "warn" }) {
  return (
    <span
      className={`border px-2.5 py-1 ${
        tone === "warn"
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-gray-200 bg-gray-50 text-gray-600"
      }`}
    >
      {label}
    </span>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function PreviewRowView({
  row,
  edit,
  onEdit,
}: {
  row: PreviewRow;
  edit?: { raw: string; notAvailable: boolean };
  onEdit: (fieldId: number, raw: string, notAvailable: boolean) => void;
}) {
  const anomaly = row.flags.find((f) => f.ruleCode === "ANOMALY_VS_PRIOR");
  const fieldId = row.matchedFieldId!;
  const shownRaw = edit ? edit.raw : row.parsedValue == null ? "" : String(row.parsedValue);
  const isNa = edit ? edit.notAvailable : row.isNotAvailable;
  const edited = edit != null;

  return (
    <tr
      className={`border-b border-gray-100 last:border-0 ${
        anomaly ? "bg-amber-50/40" : row.isChange ? "bg-blue-50/30" : ""
      }`}
    >
      <td className="px-3 py-2 font-mono text-xs text-gray-400">{row.sheetCell}</td>
      <td className="px-3 py-2">
        <div className="text-gray-800">{row.sourceLabel}</div>
        {row.matchConfidence !== "exact" && row.formLabel !== row.sourceLabel && (
          <div className="text-[11px] text-gray-400">
            matched to &ldquo;{row.formLabel}&rdquo;
            {row.matchConfidence === "fuzzy" && " (by alias)"}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">
        &ldquo;{row.rawText}&rdquo;
        {row.explanation && (
          <div className="text-[11px] text-gray-400">{row.explanation}</div>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <input
          value={shownRaw}
          disabled={isNa}
          onChange={(e) => onEdit(fieldId, e.target.value, false)}
          className={`w-28 border px-2 py-1 text-right text-sm outline-none transition-colors focus:border-brand disabled:bg-gray-50 disabled:text-gray-400 ${
            edited ? "border-brand bg-brand/[0.03]" : "border-gray-200"
          }`}
        />
        <label className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500">
          <input
            type="checkbox"
            checked={isNa}
            onChange={(e) => onEdit(fieldId, shownRaw, e.target.checked)}
            className="h-3 w-3 accent-gray-500"
          />
          NA
        </label>
      </td>
      <td className="px-3 py-2 text-right text-gray-700">
        {isNa ? (
          <span className="text-xs text-gray-400">not available</span>
        ) : (
          <>
            {fmt(
              edit
                ? edit.raw.trim() === ""
                  ? null
                  : Number(edit.raw.replace(/,/g, "")) * row.unitFactor
                : row.canonicalValue
            )}
            {row.parameterUnit && (
              <span className="ml-1 text-[11px] text-gray-400">{row.parameterUnit}</span>
            )}
            {row.unitFactor !== 1 && (
              <div className="text-[10px] text-gray-400">×{row.unitFactor}</div>
            )}
          </>
        )}
      </td>
      <td className="px-3 py-2">
        {anomaly ? (
          <div className="flex items-start gap-1.5 text-[11px] text-amber-800">
            <AlertTriangleIcon className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span>{anomaly.message}</span>
          </div>
        ) : row.isChange ? (
          <span className="text-[11px] text-blue-700">
            was {row.existingIsNotAvailable ? "NA" : fmt(row.existingValue)}
          </span>
        ) : null}
      </td>
    </tr>
  );
}
