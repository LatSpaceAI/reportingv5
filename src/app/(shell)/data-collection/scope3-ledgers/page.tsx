"use client";

// Scope 3 ledgers — download the workbook, fill it in, upload it back.
//
// Sibling of /data-collection/standard-return, which handles the monthly site
// return. The difference is what a row IS, and it drives the whole screen:
//
//   The monthly return has one row per parameter and the review question is
//   "was this number read correctly?" — so that screen shows every value.
//
//   A ledger has three hundred rows and the review question is "will these
//   MATCH?" — an unmapped material type or an unrecognised site still imports,
//   but contributes nothing to the total while looking like a filled-in row.
//   So this screen leads with what will NOT match, and shows values only as a
//   sample.
//
// Nine ledgers are owned by five different teams, so each can be downloaded on
// its own: sending Procurement all nine sheets invites them to fill in one that
// is not theirs, on data they are guessing at.

import { useCallback, useRef, useState } from "react";

import { useToast } from "@/components/Toast";

import {
  PageHeader,
  UploadIcon,
  DownloadIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  labelClass,
  inputClass,
} from "../shared";

const LEDGERS = [
  { code: "procurement", sheet: "1 Procurement", title: "Procurement ledger", owner: "Procurement / IT" },
  { code: "materials", sheet: "2 Materials", title: "Building materials by tonnage", owner: "Site EHS / Planning" },
  { code: "inbound_freight", sheet: "3 Inbound Freight", title: "Inbound freight", owner: "Procurement / Logistics" },
  { code: "energy_fuel", sheet: "4 Energy and Fuel", title: "Energy and fuel", owner: "Site EHS" },
  { code: "waste", sheet: "5 Waste", title: "Waste by disposal route", owner: "Site EHS" },
  { code: "business_travel", sheet: "6 Business Travel", title: "Business travel", owner: "HR / Admin" },
  { code: "commute", sheet: "7 Employee Commute", title: "Employee commute survey", owner: "HR / Sustainability" },
  { code: "sold_products", sheet: "8 Sold Products", title: "Sold units", owner: "Sales + Design/MEP" },
  { code: "leased_assets", sheet: "9 Leased Assets", title: "Downstream leased assets", owner: "Asset management" },
] as const;

interface SheetSummary {
  ledger: string;
  sheet: string;
  title: string;
  rows: number;
  rowsWithoutLineId: number;
  blankRows: number;
  unknownHeaders: string[];
  missingHeaders: string[];
  existingRows: number;
  grain: string | null;
  sample: {
    lineNo: number;
    attrs: Record<string, string | number>;
    unresolvedSite: string | null;
    unresolvedMonth: string | null;
    unmappedValues: { column: string; value: string }[];
    missingRequired: string[];
  }[];
  problems: {
    lineNo: number;
    sheetRow: number;
    unresolvedSite: string | null;
    unresolvedMonth: string | null;
    unmappedValues: { column: string; value: string }[];
    missingRequired: string[];
  }[];
}

interface PreviewResponse {
  ok: boolean;
  error?: string;
  versionFound?: string | null;
  fiscalYearInFile?: string;
  batchId?: number;
  fiscalYear?: string;
  templateVersion?: string;
  totals?: {
    rows: number;
    matched: number;
    unmapped: number;
    unresolvedSites: number;
    unresolvedMonths: number;
    missingRequired: number;
    untaggedProcurement: number;
  };
  unmappedValues?: { block: string; value: string; count: number }[];
  sheets?: SheetSummary[];
  requiresOverride?: boolean;
}

const FISCAL_YEARS = ["2025-26", "2024-25"];

export default function Scope3LedgersPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fiscalYear, setFiscalYear] = useState(FISCAL_YEARS[0]);
  const [downloadLedger, setDownloadLedger] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [committed, setCommitted] = useState<{ saved: number; superseded: number } | null>(null);

  const download = useCallback(() => {
    const q = new URLSearchParams({ fy: fiscalYear });
    if (downloadLedger) q.set("ledger", downloadLedger);
    window.location.href = `/api/esg/scope3/ledgers/template?${q.toString()}`;
  }, [fiscalYear, downloadLedger]);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setPreview(null);
      setCommitted(null);
      setFilename(file.name);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("fy", fiscalYear);
        const res = await fetch("/api/esg/scope3/ledgers/preview", {
          method: "POST",
          body: form,
        });
        const body = (await res.json()) as PreviewResponse;
        setPreview(body);
        if (!body.ok) toast.show(body.error ?? "The workbook could not be read.");
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [fiscalYear, toast]
  );

  const commit = useCallback(
    async (overrideExisting: boolean) => {
      if (!preview?.batchId) return;
      setBusy(true);
      try {
        const res = await fetch("/api/esg/scope3/ledgers/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId: preview.batchId,
            fiscalYear: preview.fiscalYear ?? fiscalYear,
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
        toast.show(
          `${body.saved} ledger line${body.saved === 1 ? "" : "s"} saved. ` +
            `Emissions are not computed until the Scope 3 resolver runs.`
        );
      } catch (e) {
        toast.show(e instanceof Error ? e.message : "Commit failed.");
      } finally {
        setBusy(false);
      }
    },
    [preview, fiscalYear, toast]
  );

  const totals = preview?.totals;
  const hasProblems =
    totals !== undefined &&
    (totals.unmapped > 0 ||
      totals.unresolvedSites > 0 ||
      totals.unresolvedMonths > 0 ||
      totals.missingRequired > 0 ||
      totals.untaggedProcurement > 0);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-6 py-6">
        <PageHeader
          icon={<UploadIcon className="h-5 w-5" />}
          title="Scope 3 Ledgers"
          subtitle="Download a ledger workbook, fill it in, and upload it back. One row is one purchase order, delivery or trip."
        />

        {/* ---- Download ---------------------------------------------------- */}
        <section className="mb-6 border border-gray-200 p-5">
          <h2 className="mb-1 text-[14px] font-semibold text-[#0A0A0A]">
            1. Download a workbook
          </h2>
          <p className="mb-4 text-[12px] leading-relaxed text-gray-500">
            The nine ledgers are owned by different teams. Download just the one a team
            needs, or all nine together.
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

            <div className="min-w-[280px]">
              <label className={labelClass}>Ledger</label>
              <select
                className={inputClass}
                value={downloadLedger}
                onChange={(e) => setDownloadLedger(e.target.value)}
              >
                <option value="">All nine sheets</option>
                {LEDGERS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.sheet} — {l.title} ({l.owner})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={download}
              className="flex items-center gap-2 border border-brand bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand/90"
            >
              <DownloadIcon className="h-4 w-4" />
              Download
            </button>
          </div>
        </section>

        {/* ---- Upload ------------------------------------------------------ */}
        <section className="mb-6 border border-gray-200 p-5">
          <h2 className="mb-1 text-[14px] font-semibold text-[#0A0A0A]">
            2. Upload the filled workbook
          </h2>
          <p className="mb-4 text-[12px] leading-relaxed text-gray-500">
            Nothing is saved until you confirm. The preview shows what was read and,
            more importantly, what will <strong>not</strong> match.
          </p>

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
            className="flex items-center gap-2 border border-gray-300 px-4 py-2 text-[13px] font-medium text-[#0A0A0A] transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            <UploadIcon className="h-4 w-4" />
            {busy ? "Reading…" : "Choose a file"}
          </button>
          {filename && (
            <span className="ml-3 text-[12px] text-gray-500">{filename}</span>
          )}
        </section>

        {/* ---- Committed --------------------------------------------------- */}
        {committed && (
          <section className="mb-6 border border-emerald-200 bg-emerald-50/50 p-5">
            <div className="flex items-start gap-2">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 text-emerald-700" />
              <div>
                <p className="text-[13px] font-medium text-emerald-900">
                  {committed.saved} ledger line{committed.saved === 1 ? "" : "s"} saved
                  {committed.superseded > 0 &&
                    `, replacing ${committed.superseded} previously filed`}
                  .
                </p>
                {/* Said explicitly. A screen that shows "247 lines saved" and stops
                    invites the reader to assume a figure now exists. */}
                <p className="mt-1 text-[12px] leading-relaxed text-emerald-800">
                  Emissions are <strong>not yet computed</strong>. Run the Scope 3
                  resolver (<code className="font-mono">npm run esg:resolve-scope3</code>)
                  to produce category totals. Until then these are filed data, not a
                  disclosure.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ---- Preview ----------------------------------------------------- */}
        {preview?.ok && totals && (
          <section className="mb-6 border border-gray-200">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-[14px] font-semibold text-[#0A0A0A]">
                3. Review — {totals.rows} row{totals.rows === 1 ? "" : "s"} read
              </h2>
            </div>

            {/* The headline is what will NOT land, because that is the decision
                being made here. */}
            {hasProblems ? (
              <div className="border-b border-amber-200 bg-amber-50/50 px-5 py-4">
                <div className="flex items-start gap-2">
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4 text-amber-700" />
                  <div className="text-[12px] leading-relaxed text-amber-900">
                    <p className="font-medium">These rows will import but contribute nothing.</p>
                    <ul className="mt-2 space-y-1">
                      {totals.unmapped > 0 && (
                        <li>
                          <strong>{totals.unmapped}</strong> row(s) carry a value with no
                          emission factor mapping — they will compute as zero.
                        </li>
                      )}
                      {totals.untaggedProcurement > 0 && (
                        <li>
                          <strong>{totals.untaggedProcurement}</strong> procurement line(s)
                          have no Scope 3 tag. An untagged line is silently excluded, so the
                          category comes out understated with nothing looking wrong.
                        </li>
                      )}
                      {totals.unresolvedSites > 0 && (
                        <li>
                          <strong>{totals.unresolvedSites}</strong> row(s) name a site that is
                          not in the register — they import unattributed to any asset.
                        </li>
                      )}
                      {totals.unresolvedMonths > 0 && (
                        <li>
                          <strong>{totals.unresolvedMonths}</strong> row(s) name a month
                          outside this fiscal year.
                        </li>
                      )}
                      {totals.missingRequired > 0 && (
                        <li>
                          <strong>{totals.missingRequired}</strong> row(s) are missing a field
                          the calculation needs.
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
                  Every row resolved to a site, a period and an emission factor.
                </div>
              </div>
            )}

            {/* Distinct unmapped values, so the fix is one mapping row rather than
                forty spreadsheet edits. */}
            {preview.unmappedValues && preview.unmappedValues.length > 0 && (
              <div className="border-b border-gray-200 px-5 py-4">
                <h3 className="mb-2 text-[12px] font-semibold text-[#0A0A0A]">
                  Values with no mapping
                </h3>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-1 font-medium">Block</th>
                      <th className="py-1 font-medium">Value as typed</th>
                      <th className="py-1 text-right font-medium">Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.unmappedValues.map((u) => (
                      <tr key={`${u.block}|${u.value}`} className="border-b border-gray-100">
                        <td className="py-1 text-gray-500">{u.block}</td>
                        <td className="py-1 font-mono text-[11px]">{u.value}</td>
                        <td className="py-1 text-right">{u.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  Each of these needs one row in the mapping table, or a correction in the
                  sheet. They are not blocked — but they compute as zero until mapped.
                </p>
              </div>
            )}

            {/* Per sheet */}
            <div className="px-5 py-4">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-1 font-medium">Sheet</th>
                    <th className="py-1 text-right font-medium">Rows</th>
                    <th className="py-1 text-right font-medium">No line ID</th>
                    <th className="py-1 text-right font-medium">Already filed</th>
                    <th className="py-1 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sheets
                    ?.filter((s) => s.rows > 0 || s.existingRows > 0 || s.missingHeaders.length)
                    .map((s) => (
                      <tr key={s.ledger} className="border-b border-gray-100 align-top">
                        <td className="py-1.5">
                          <div className="font-medium text-[#0A0A0A]">{s.sheet}</div>
                          <div className="text-[11px] text-gray-500">{s.title}</div>
                        </td>
                        <td className="py-1.5 text-right">{s.rows}</td>
                        <td className="py-1.5 text-right">
                          {s.rowsWithoutLineId > 0 ? (
                            <span className="text-amber-700">{s.rowsWithoutLineId}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1.5 text-right">
                          {s.existingRows > 0 ? (
                            <span className="text-amber-700">{s.existingRows}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1.5 text-[11px] text-gray-500">
                          {s.missingHeaders.length > 0 && (
                            <div className="text-amber-700">
                              missing columns: {s.missingHeaders.slice(0, 3).join(", ")}
                              {s.missingHeaders.length > 3 && "…"}
                            </div>
                          )}
                          {s.unknownHeaders.length > 0 && (
                            <div>extra columns: {s.unknownHeaders.slice(0, 3).join(", ")}</div>
                          )}
                          {s.problems.length > 0 && (
                            <div>
                              {s.problems.length} row(s) need attention (first at sheet row{" "}
                              {s.problems[0].sheetRow})
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* ---- Confirm ------------------------------------------------- */}
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/50 px-5 py-4">
              <div className="text-[12px] text-gray-600">
                {preview.requiresOverride ? (
                  <span className="text-amber-800">
                    Some of these ledgers already hold filed lines for {preview.fiscalYear}.
                    Committing replaces them — the previous rows are archived, not deleted.
                    Ledgers not in this file are untouched.
                  </span>
                ) : (
                  <span>Nothing has been saved yet.</span>
                )}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => commit(Boolean(preview.requiresOverride))}
                className="border border-brand bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
              >
                {preview.requiresOverride ? "Replace and save" : "Save these lines"}
              </button>
            </div>
          </section>
        )}

        {/* ---- Read failure ------------------------------------------------ */}
        {preview && !preview.ok && (
          <section className="mb-6 border border-red-200 bg-red-50/50 p-5">
            <div className="flex items-start gap-2">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 text-red-700" />
              <div className="text-[12px] leading-relaxed text-red-900">
                <p className="font-medium">{preview.error}</p>
                {preview.versionFound && (
                  <p className="mt-1">Version found in the file: {preview.versionFound}</p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
