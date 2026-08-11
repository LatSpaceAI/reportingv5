"use client";

// Monthly site return — the central ESG team's entry screen.
//
// Site teams file a form each month; the ESG team receives it and enters it
// here. Each site's form is rendered from its own stored layout, so what is on
// screen matches what is on the sheet in front of the person typing — same
// wording, same order, same units, including the form's own typos.
//
// Saving never blocks. Validation runs server-side and comes back as flags to
// review, because the returns genuinely contain impossible values and refusing
// them would only stop the data being recorded.

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/Toast";
import type {
  DataFlag,
  EntrySnapshot,
  EntryValue,
  FormField,
  SiteSummary,
} from "@/lib/siteEntry/types";

import { EntryField } from "./EntryField";
import {
  PageHeader,
  UploadIcon,
  labelClass,
  inputClass,
  SaveIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from "../shared";

interface CoverageRow {
  fiscalYear: string;
  monthNo: number;
  monthLabel: string;
  sitesReporting: number;
  sitesExpected: number;
}

const MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

const emptyValue = (): EntryValue => ({ raw: "", notAvailable: false });

export default function SiteReturnPage() {
  const toast = useToast();

  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [fiscalYears, setFiscalYears] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);

  const [siteCode, setSiteCode] = useState("");
  const [fiscalYear, setFiscalYear] = useState("");
  const [monthNo, setMonthNo] = useState(1);

  const [snapshot, setSnapshot] = useState<EntrySnapshot | null>(null);
  const [values, setValues] = useState<Record<string, EntryValue>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flags, setFlags] = useState<DataFlag[]>([]);
  const [dirty, setDirty] = useState(false);

  // ── Pickers ───────────────────────────────────────────────────────────────
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
        setCoverage(data.coverage ?? []);
        if (data.sites?.length) setSiteCode(data.sites[0].code);
        if (data.fiscalYears?.length) setFiscalYear(data.fiscalYears[0]);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load the form for the selected site-month ─────────────────────────────
  const loadForm = useCallback(async () => {
    if (!siteCode || !fiscalYear) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/esg/entry/form?site=${encodeURIComponent(siteCode)}&fy=${encodeURIComponent(
          fiscalYear
        )}&month=${monthNo}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load the form");

      const snap = data as EntrySnapshot;
      setSnapshot(snap);
      setFlags(snap.flags ?? []);

      // Seed the inputs from whatever is already saved. Values are stored per
      // canonical parameter, while the screen is per form row — so a parameter
      // fed by several rows (Level 8 + Level 13) restores into the first of
      // them rather than being split back arbitrarily.
      const byParam = new Map(snap.values.map((v) => [v.parameterKey, v]));
      const claimed = new Set<string>();
      const next: Record<string, EntryValue> = {};
      for (const f of snap.form.fields) {
        const v = f.parameterKey ? byParam.get(f.parameterKey) : undefined;
        if (!v || claimed.has(f.parameterKey ?? "")) {
          next[String(f.fieldId)] = emptyValue();
          continue;
        }
        claimed.add(f.parameterKey!);
        next[String(f.fieldId)] = {
          // Convert the stored canonical value back into the form's unit.
          raw:
            v.valueNum === null
              ? ""
              : String(
                  Number((v.valueNum / (f.unitFactor || 1)).toPrecision(12))
                ),
          notAvailable: v.isNotAvailable,
          rawText: v.rawText ?? undefined,
          comment: v.comment ?? undefined,
        };
      }
      setValues(next);
      setDirty(false);
    } catch (err) {
      setSnapshot(null);
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [siteCode, fiscalYear, monthNo]);

  useEffect(() => {
    void loadForm();
  }, [loadForm]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async (status: "draft" | "submitted") => {
    if (!snapshot) return;
    setSaving(true);
    try {
      const res = await fetch("/api/esg/entry/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteCode,
          fiscalYear,
          monthNo,
          values,
          status,
          enteredBy: "esg-team",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      setFlags(data.flags ?? []);
      setDirty(false);
      const n = data.saved ?? 0;
      const flagCount = (data.flags ?? []).length;
      toast.show(
        status === "submitted"
          ? `Return submitted — ${n} values saved${
              flagCount ? `, ${flagCount} to review` : ""
            }`
          : `Draft saved — ${n} values${flagCount ? `, ${flagCount} flagged` : ""}`
      );
      // Refresh coverage so the picker reflects the new submission.
      if (status === "submitted") {
        fetch("/api/esg/entry/sites")
          .then((r) => r.json())
          .then((d) => setCoverage(d.coverage ?? []))
          .catch(() => {});
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    if (!snapshot) return [];
    const out: { label: string; fields: FormField[] }[] = [];
    for (const f of snapshot.form.fields) {
      // Only the primary quantity column is entered here; the reused/disposed
      // columns are a later refinement rather than something to half-render.
      if (f.columnKind !== "quantity") continue;
      const label = f.groupLabel ?? "Other";
      const last = out[out.length - 1];
      if (last && last.label === label) last.fields.push(f);
      else out.push({ label, fields: [f] });
    }
    return out;
  }, [snapshot]);

  const flagByParam = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of flags) if (f.parameterKey) m.set(f.parameterKey, f.message);
    return m;
  }, [flags]);

  const monthCoverage = coverage.find(
    (c) => c.fiscalYear === fiscalYear && c.monthNo === monthNo
  );

  const filledCount = Object.values(values).filter(
    (v) => v.notAvailable || v.raw.trim() !== ""
  ).length;
  const totalFields = groups.reduce((n, g) => n + g.fields.length, 0);

  const status = snapshot?.submission?.status ?? "draft";

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[900px] px-6 py-6">
        <PageHeader
          icon={<UploadIcon className="h-5 w-5" />}
          title="Monthly Site Return"
          subtitle="Enter the return a site has filed for a month. Each site's own form layout is reproduced below."
          backHref="/data-collection"
        />

        {/* ── Site / period picker ──────────────────────────────────────── */}
        <section className="mb-6 border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-4">
            <h3 className="text-[13px] font-semibold text-[#0A0A0A]">
              Which return
            </h3>
            {monthCoverage && (
              <span className="text-[11px] text-gray-500">
                {monthCoverage.monthLabel} {fiscalYear}:{" "}
                <strong className="text-[#0A0A0A]">
                  {monthCoverage.sitesReporting} of {monthCoverage.sitesExpected}
                </strong>{" "}
                sites filed
              </span>
            )}
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Site</label>
              <select
                value={siteCode}
                onChange={(e) => setSiteCode(e.target.value)}
                className={inputClass}
              >
                {sites.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                    {s.city ? ` — ${s.city}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Fiscal year</label>
              <select
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className={inputClass}
              >
                {fiscalYears.map((fy) => (
                  <option key={fy} value={fy}>
                    FY {fy}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Month</label>
              <select
                value={monthNo}
                onChange={(e) => setMonthNo(Number(e.target.value))}
                className={inputClass}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && (
          <p className="py-12 text-center text-sm text-gray-500">Loading form…</p>
        )}

        {loadError && !loading && (
          <div className="border border-rose-200 bg-rose-50 p-5">
            <p className="text-sm text-rose-700">{loadError}</p>
          </div>
        )}

        {snapshot && !loading && (
          <>
            {/* ── Form identity ──────────────────────────────────────────── */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border border-gray-200 bg-gray-50/60 px-5 py-3">
              <div className="text-[12px] text-gray-600">
                <strong className="text-[#0A0A0A]">{snapshot.form.formName}</strong>
                {snapshot.form.formRef && (
                  <span className="ml-2 text-gray-400">
                    Ref {snapshot.form.formRef}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {snapshot.site.waterStressed && (
                  <span className="bg-amber-50 px-2 py-1 text-amber-700">
                    water-stressed area
                  </span>
                )}
                <span
                  className={`px-2 py-1 font-medium uppercase tracking-wider ${
                    status === "approved"
                      ? "bg-emerald-50 text-emerald-700"
                      : status === "submitted" || status === "under_review"
                        ? "bg-brand/[0.08] text-brand"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {status.replace("_", " ")}
                </span>
                <span className="text-gray-500">
                  {filledCount}/{totalFields} filled
                </span>
              </div>
            </div>

            {/* ── Flags ──────────────────────────────────────────────────── */}
            {flags.length > 0 && (
              <div className="mb-4 border border-amber-200 bg-amber-50/60">
                <div className="flex items-center gap-2 border-b border-amber-200 px-5 py-3">
                  <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
                  <h3 className="text-[13px] font-semibold text-amber-900">
                    {flags.length} to review
                  </h3>
                  <span className="text-[11px] text-amber-700">
                    saved anyway — these need a human decision, not a correction
                  </span>
                </div>
                <ul className="divide-y divide-amber-200/70">
                  {flags.map((f) => (
                    <li key={f.ruleCode + (f.parameterKey ?? "")} className="px-5 py-2.5">
                      <span
                        className={`mr-2 text-[10px] font-semibold uppercase tracking-wider ${
                          f.severity === "error"
                            ? "text-rose-600"
                            : f.severity === "warning"
                              ? "text-amber-700"
                              : "text-gray-500"
                        }`}
                      >
                        {f.severity}
                      </span>
                      <span className="text-[12px] text-[#0A0A0A]/80">{f.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── The form ───────────────────────────────────────────────── */}
            {groups.map((group) => (
              <section key={group.label} className="mb-4 border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50/60 px-5 py-3">
                  <h3 className="text-[13px] font-semibold text-[#0A0A0A]">
                    {group.label}
                  </h3>
                </div>
                <div>
                  {group.fields.map((f) => (
                    <EntryField
                      key={f.fieldId}
                      field={f}
                      value={values[String(f.fieldId)] ?? emptyValue()}
                      flagMessage={
                        f.parameterKey ? flagByParam.get(f.parameterKey) : undefined
                      }
                      onChange={(next) => {
                        setValues((prev) => ({ ...prev, [String(f.fieldId)]: next }));
                        setDirty(true);
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* ── Actions ────────────────────────────────────────────────── */}
            <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
              <p className="text-[11px] text-gray-500">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save("draft")}
                  className="flex items-center gap-2 border border-gray-200 px-4 py-2.5 text-[12px] font-medium text-[#0A0A0A]/80 transition-colors hover:border-gray-300 disabled:opacity-50"
                >
                  <SaveIcon className="h-3.5 w-3.5" />
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save("submitted")}
                  className="flex items-center gap-2 bg-brand px-4 py-2.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Submit return"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
