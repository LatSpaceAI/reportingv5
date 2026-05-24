"use client";

/**
 * Drilldown demo page.
 *
 * Reached by clicking the Response value on a row in the CCTS Requirements
 * tab. Currently a narrow demo: shows two boxes connected by a dotted line —
 * Output (the requirement value) and Input (12 monthly values whose sum is
 * the Output). Monthly values are synthesized as `annual / 12` for now.
 *
 * URL: /report/<framework>/drilldown/<fieldId>
 *      e.g. /report/ccts/drilldown/FS1!I43
 *
 * Future extensions: editable monthly cells that recompute the Output, full
 * Watershed-style pipeline (Input → Standardization → Regrouping → Activity
 * data → Calculation → Categorization → Footprint → Query result), source
 * tagging per row, etc.
 */
import Link from "next/link";
import { useMemo } from "react";
import { cctsRequirementById } from "@/lib/cctsRequirements";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export default function DrilldownPage({ params }: { params: { id: string; fid: string } }) {
  const { id: frameworkId, fid: fieldIdRaw } = params;
  // The field id is URL-encoded (FS1!I43 → FS1%21I43). Next decodes path
  // params for us, but be defensive in case a manual link arrives encoded.
  const fid = useMemo(() => {
    try {
      return decodeURIComponent(fieldIdRaw);
    } catch {
      return fieldIdRaw;
    }
  }, [fieldIdRaw]);

  // Right now drilldown is only wired for CCTS; CBAM/RCO/etc would need
  // their own requirement registries. The requirement lookup is unconditional
  // so we don't violate the rules of hooks below — early-return branches
  // happen after all hooks have run.
  const requirement = frameworkId === "ccts" ? cctsRequirementById.get(fid) ?? null : null;

  // Synthesize monthly values from the annual figure. Keep two decimals so
  // the sum visibly equals the Output without floating-point dust.
  const monthly = useMemo(() => {
    if (!requirement) return [];
    const perMonth = requirement.value / 12;
    const rounded = Math.round(perMonth * 100) / 100;
    return MONTH_LABELS.map((m, i) => ({
      label: `${m} 2024`,
      value: rounded,
      monthIndex: i,
    }));
  }, [requirement]);

  const ytdSum = useMemo(
    () => monthly.reduce((acc, m) => acc + m.value, 0),
    [monthly]
  );

  if (frameworkId !== "ccts") {
    return (
      <NotAvailable
        title="Drilldown not available"
        message={`Drilldown is currently only implemented for the CCTS Aluminium pro-forma. (Framework: ${frameworkId})`}
        backHref={`/report/${frameworkId}`}
      />
    );
  }
  if (!requirement) {
    return (
      <NotAvailable
        title="Requirement not found"
        message={`No requirement with id "${fid}" exists. It may have been renamed or removed.`}
        backHref={`/report/${frameworkId}`}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <Header
        frameworkId={frameworkId}
        requirement={{
          id: requirement.id,
          displayId: requirement.displayId,
          label: requirement.label,
        }}
      />
      <PipelineRail
        stages={[
          { id: "input", label: "Input", subline: `${monthly.length} monthly rows` },
          { id: "calculation", label: "Calculation", subline: `Sum (YTD 2024)`, active: true },
          { id: "output", label: "Output", subline: `${formatNumber(requirement.value)}${requirement.unit ? ` ${requirement.unit}` : ""}` },
        ]}
      />
      <main className="flex-1 overflow-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          {/* Output card on top, dotted line, Input card on bottom — mirrors the
              user-supplied mock. */}
          <div className="relative flex flex-col items-center gap-6">
            <OutputCard
              value={requirement.value}
              unit={requirement.unit}
              label={requirement.label}
            />
            <DottedConnector />
            <InputCard
              monthly={monthly}
              total={ytdSum}
              unit={requirement.unit}
            />
          </div>
          <FooterMeta requirement={requirement} />
        </div>
      </main>
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function Header({
  frameworkId,
  requirement,
}: {
  frameworkId: string;
  requirement: { id: string; displayId: string; label: string };
}) {
  return (
    <div className="border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`/report/${frameworkId}`}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-brand"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to report
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">Requirement</span>
        <span className="text-slate-300">/</span>
        <span className="truncate font-medium text-slate-900" title={requirement.displayId}>
          {requirement.displayId}
        </span>
      </div>
      <h1 className="mt-1 truncate text-lg font-semibold text-slate-900" title={requirement.label}>
        {requirement.label}
      </h1>
    </div>
  );
}

// ── Pipeline rail ───────────────────────────────────────────────────────────

interface Stage {
  id: string;
  label: string;
  subline?: string;
  active?: boolean;
}

function PipelineRail({ stages }: { stages: Stage[] }) {
  return (
    <div className="border-b border-slate-200 bg-[#f5f8fc] px-6 py-4">
      <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 overflow-x-auto">
        {stages.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3">
            <div
              className={`rounded-md border bg-white px-4 py-2 text-center shadow-sm transition ${
                s.active
                  ? "border-brand/50 ring-2 ring-brand/20"
                  : "border-slate-200"
              }`}
            >
              <div className="text-xs font-medium text-slate-700">{s.label}</div>
              {s.subline && (
                <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">{s.subline}</div>
              )}
            </div>
            {i < stages.length - 1 && (
              <div className="h-px w-6 bg-slate-300" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Output card ─────────────────────────────────────────────────────────────

function OutputCard({
  value,
  unit,
  label,
}: {
  value: number;
  unit?: string;
  label: string;
}) {
  return (
    <div className="w-full max-w-md rounded-xl border border-slate-300 bg-white px-6 py-5 text-center shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        Output
      </div>
      <div className="mt-1 text-xs text-slate-500" title={label}>{truncate(label, 64)}</div>
      <div className="mt-3 text-3xl font-semibold tabular-nums text-blue-700">
        {formatNumber(value)}
        {unit && <span className="ml-2 text-base font-normal text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

// ── Connector ───────────────────────────────────────────────────────────────

function DottedConnector() {
  return (
    <div className="flex h-12 items-center justify-center" aria-hidden="true">
      <div
        className="h-full border-l-2 border-dotted border-slate-300"
        style={{ width: 1 }}
      />
    </div>
  );
}

// ── Input card ──────────────────────────────────────────────────────────────

interface MonthlyRow {
  label: string;
  value: number;
  monthIndex: number;
}

function InputCard({
  monthly,
  total,
  unit,
}: {
  monthly: MonthlyRow[];
  total: number;
  unit?: string;
}) {
  return (
    <div className="w-full max-w-md rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Input · Monthly values
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-5 py-2 text-left font-medium">Month</th>
            <th className="px-5 py-2 text-right font-medium">Value{unit ? ` (${unit})` : ""}</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((row) => (
            <tr key={row.monthIndex} className="border-b border-slate-50 last:border-b-0">
              <td className="px-5 py-2 text-slate-700">{row.label}</td>
              <td className="px-5 py-2 text-right tabular-nums text-slate-900">
                {formatNumber(row.value)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-slate-200 bg-slate-50">
            <td className="px-5 py-2.5 font-medium text-slate-700">Total (YTD)</td>
            <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-blue-700">
              {formatNumber(total)}
              {unit && <span className="ml-1.5 text-xs font-normal text-slate-500">{unit}</span>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Footer metadata ─────────────────────────────────────────────────────────

function FooterMeta({
  requirement,
}: {
  requirement: { id: string; displayId: string; sectionTitle: string; questionLabel: string };
}) {
  return (
    <div className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
      <dl className="grid grid-cols-[120px_1fr] gap-y-1.5">
        <dt className="font-medium text-slate-600">Section</dt>
        <dd>{requirement.sectionTitle}</dd>
        <dt className="font-medium text-slate-600">Question</dt>
        <dd>{requirement.questionLabel}</dd>
        <dt className="font-medium text-slate-600">Internal ref</dt>
        <dd className="font-mono">{requirement.id}</dd>
        <dt className="font-medium text-slate-600">Display ID</dt>
        <dd className="font-mono">{requirement.displayId}</dd>
      </dl>
    </div>
  );
}

// ── Not-found state ─────────────────────────────────────────────────────────

function NotAvailable({
  title,
  message,
  backHref,
}: {
  title: string;
  message: string;
  backHref: string;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <Link
          href={backHref}
          className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
        >
          ← Back to report
        </Link>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
