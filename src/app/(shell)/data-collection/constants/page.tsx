"use client";

// Emission Factors & Constants — the reference values every computed figure
// rests on, and the first screen that lets anyone change them.
//
// That is a change in kind, not degree. The combustion factors are documented
// assumptions: diesel 2.65 gives a Scope 1 of 603.82 tCO2e against a published
// 589.11. The edit that finally resolves that gap MOVES A PUBLISHED FIGURE, so
// this screen is built around three ideas:
//
//   1. Show the consequences BEFORE the write. Every edit passes a confirm step
//      naming the outputs it changes and how many computed values rest on them.
//   2. Never recompute silently. An edit makes the stored figures stale and says
//      so; re-running the resolver is a separate, deliberate act.
//   3. Record why. The reason is mandatory and becomes the audit trail — a value
//      that moved with no recorded reason is indistinguishable from a typo.
//
// Assumption-flagged constants are visually prominent because they are the ones
// the ESG team actually has to work through, and confirming one WITHOUT changing
// its value is a first-class action rather than an edge case.

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/Toast";
import { CURRENT_USER } from "@/lib/currentUser";
import {
  validateConstantEdit,
  validateReason,
  isBlocked,
  needsTypedConfirm,
  type ValidationIssue,
} from "@/lib/esgConstants/validation";

import {
  PageHeader,
  SlidersIcon,
  RotateCcwIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  labelClass,
  inputClass,
} from "../shared";

interface ConstantRow {
  id: number;
  key: string;
  category: string;
  categoryName: string;
  label: string;
  value: number;
  unit: string | null;
  source: string | null;
  sourceDate: string | null;
  isAssumption: boolean;
  notes: string | null;
  updatedAt: string;
  updatedBy: string | null;
  directRefCount: number;
  editCount: number;
}

interface Revision {
  id: number;
  oldValue: number | null;
  newValue: number;
  oldIsAssumption: boolean | null;
  newIsAssumption: boolean | null;
  reason: string | null;
  changeKind: "edit" | "revert" | "seed";
  revertedRevisionId: number | null;
  affectedOutputKeys: string[] | null;
  affectedRowCount: number | null;
  changedBy: string | null;
  changedAt: string;
}

interface AffectedOutput {
  key: string;
  depth: number;
  label?: string | null;
  unit?: string | null;
}

interface Staleness {
  isStale: boolean;
  staleKeys: string[];
  lastResolvedAt: string | null;
  neverResolved: boolean;
}

const fmtDate = (iso: string | null) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

export default function ConstantsPage() {
  const toast = useToast();

  const [constants, setConstants] = useState<ConstantRow[]>([]);
  const [categories, setCategories] = useState<{ code: string; name: string }[]>([]);
  const [staleness, setStaleness] = useState<Staleness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ConstantRow | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/esg/constants");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to load constants");
      setConstants(data.constants);
      setCategories(data.categories);
      setStaleness(data.staleness);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openHistory = useCallback(async (key: string) => {
    if (historyFor === key) {
      setHistoryFor(null);
      return;
    }
    setHistoryFor(key);
    setRevisions([]);
    const res = await fetch(`/api/esg/constants/${encodeURIComponent(key)}/history`);
    const data = await res.json();
    if (data.ok) setRevisions(data.revisions);
  }, [historyFor]);

  const assumptionCount = useMemo(
    () => constants.filter((c) => c.isAssumption).length,
    [constants]
  );

  const grouped = useMemo(() => {
    const byCat = new Map<string, ConstantRow[]>();
    for (const c of constants) {
      if (!byCat.has(c.category)) byCat.set(c.category, []);
      byCat.get(c.category)!.push(c);
    }
    return categories
      .filter((cat) => byCat.has(cat.code))
      .map((cat) => ({ ...cat, rows: byCat.get(cat.code)! }));
  }, [constants, categories]);

  return (
    <div className="mx-auto max-w-[1100px] px-8 py-10">
      <PageHeader
        icon={<SlidersIcon className="h-5 w-5" />}
        title="Emission Factors & Constants"
        subtitle="The reference values every computed figure rests on."
        backHref="/data-collection"
      />

      {/* ── Stale banner ────────────────────────────────────────────────── */}
      {staleness?.isStale && (
        <div className="mb-6 border border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/60">
          <div className="flex items-start gap-3 px-5 py-4">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-amber-900">
                Computed figures are behind these values
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                {staleness.staleKeys.map((k, i) => (
                  <span key={k}>
                    {i > 0 && ", "}
                    <span className="font-mono">{k}</span>
                  </span>
                ))}{" "}
                {staleness.staleKeys.length === 1 ? "was" : "were"} edited after the last
                resolver run ({fmtDate(staleness.lastResolvedAt)}). The dashboard and export
                still show figures computed from the old values.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                Re-run <span className="font-mono">npm run esg:resolve</span> to bring them
                up to date. Nothing recomputes on its own — a factor change moves published
                numbers, so applying it is a deliberate step.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Assumptions summary ─────────────────────────────────────────── */}
      {assumptionCount > 0 && (
        <div className="mb-6 border border-gray-200 bg-white px-5 py-4">
          <h3 className="text-[12px] font-semibold text-[#0A0A0A]">
            {assumptionCount} of {constants.length} values are still assumptions
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-gray-600">
            Each needs confirming against its source before assurance. Confirming a value
            without changing it is a normal action — open the row and mark it confirmed.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-start gap-3 border border-red-200 border-l-4 border-l-red-500 bg-red-50/60 px-5 py-4">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <p className="text-[12px] leading-relaxed text-red-900">{error}</p>
        </div>
      )}

      {loading && <p className="text-[12px] text-gray-500">Loading…</p>}

      {/* ── Groups ──────────────────────────────────────────────────────── */}
      {grouped.map((cat) => (
        <section key={cat.code} className="mb-8">
          <h2 className="mb-2 text-[13px] font-semibold text-[#0A0A0A]">{cat.name}</h2>
          <div className="border border-gray-200 bg-white">
            {cat.rows.map((c, i) => (
              <div
                key={c.key}
                className={`${i > 0 ? "border-t border-gray-100" : ""} ${
                  c.isAssumption ? "border-l-2 border-l-amber-400 bg-amber-50/40" : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-[12px] text-[#0A0A0A]/70">{c.key}</span>
                      {c.isAssumption ? (
                        <span className="border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800">
                          assumption
                        </span>
                      ) : c.editCount > 0 ? (
                        <span className="border border-brand-light bg-brand-light/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
                          confirmed
                        </span>
                      ) : null}
                      {c.directRefCount === 0 && (
                        <span
                          className="border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500"
                          title={
                            c.key === "GWP.r22"
                              ? "Disclosed as a refill quantity only; excluded from Scope 1 as a Montreal Protocol gas."
                              : c.key === "qa.anomaly_tolerance"
                                ? "Affects which uploads are flagged for review, not any computed figure."
                                : "No formula references this value, so editing it changes no computed figure."
                          }
                        >
                          no computed effect
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-gray-700">{c.label}</p>
                    {c.source && (
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {c.source}
                        {c.sourceDate ? ` · ${c.sourceDate}` : ""}
                      </p>
                    )}
                  </div>

                  <div className="w-24 text-right">
                    <span className="font-mono text-sm tabular-nums text-[#0A0A0A]">
                      {c.value}
                    </span>
                  </div>
                  <div className="w-24 text-[11px] text-gray-500">{c.unit ?? ""}</div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="text-[12px] font-medium text-brand underline underline-offset-2"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void openHistory(c.key)}
                      className="text-[12px] text-gray-500 underline underline-offset-2"
                    >
                      {historyFor === c.key ? "Hide" : "History"}
                      {c.editCount > 0 ? ` (${c.editCount})` : ""}
                    </button>
                  </div>
                </div>

                {c.notes && (
                  <p className="px-5 pb-3 text-[11px] leading-relaxed text-gray-500">
                    {c.notes}
                  </p>
                )}

                {/* History — inline, because it is reference material you want
                    visible WHILE deciding, not a modal that hides the row. */}
                {historyFor === c.key && (
                  <div className="border-t border-gray-200 bg-gray-50/40 px-5 py-3">
                    {revisions.length === 0 ? (
                      <p className="text-[11px] text-gray-500">Loading history…</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {revisions.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
                            <span className="font-mono text-[11px] tabular-nums text-gray-700">
                              {r.oldValue == null ? "seeded" : `${r.oldValue} → ${r.newValue}`}
                            </span>
                            {r.oldIsAssumption !== r.newIsAssumption && (
                              <span className="text-[11px] font-medium text-brand">
                                {r.newIsAssumption ? "marked assumption" : "marked confirmed"}
                              </span>
                            )}
                            {r.changeKind === "revert" && (
                              <span className="text-[11px] text-gray-500">
                                reverted #{r.revertedRevisionId}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 text-[11px] text-gray-600">
                              {r.reason}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {r.changedBy} · {fmtDate(r.changedAt)}
                            </span>
                            {r.changeKind === "edit" && r.oldValue != null && (
                              <RevertButton
                                constantKey={c.key}
                                revisionId={r.id}
                                onDone={async () => {
                                  await load();
                                  await openHistory(c.key);
                                  await openHistory(c.key);
                                }}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {editing && (
        <EditDialog
          constant={editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            toast.show(msg);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function RevertButton({
  constantKey,
  revisionId,
  onDone,
}: {
  constantKey: string;
  revisionId: number;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(
            `/api/esg/constants/${encodeURIComponent(constantKey)}/revert`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                revisionId,
                reason: `Reverting revision ${revisionId}`,
                changedBy: CURRENT_USER.id,
              }),
            }
          );
          const data = await res.json();
          if (!data.ok) throw new Error(data.error);
          toast.show(`${constantKey} restored to ${data.restoredValue}`);
          await onDone();
        } catch (err) {
          toast.show(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1 text-[11px] text-gray-500 underline underline-offset-2"
    >
      <RotateCcwIcon className="h-3 w-3" />
      {busy ? "…" : "Revert"}
    </button>
  );
}

/**
 * One modal, two steps — not two modals.
 *
 * The form and the blast radius are the same decision, and unmounting the form
 * to show consequences would lose the reason just typed. A modal rather than an
 * inline panel because the purpose of this step is to make the write
 * interruptible and undismissable-by-scrolling: an inline panel can be scrolled
 * past and leaves the list clickable, inviting two half-finished edits.
 */
function EditDialog({
  constant,
  onClose,
  onSaved,
}: {
  constant: ConstantRow;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [rawValue, setRawValue] = useState(String(constant.value));
  const [isAssumption, setIsAssumption] = useState(constant.isAssumption);
  const [source, setSource] = useState(constant.source ?? "");
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState<{
    outputs: AffectedOutput[];
    existingRowCount: number;
    driftDetected: boolean;
    driftKeys: string[];
    inertReason: string | null;
  } | null>(null);

  const issues: ValidationIssue[] = useMemo(
    () =>
      validateConstantEdit({
        key: constant.key,
        category: constant.category,
        rawValue,
        currentValue: constant.value,
        directRefCount: constant.directRefCount,
      }),
    [constant, rawValue]
  );

  const blocked = isBlocked(issues);
  const valueChanged = Number(rawValue) !== Number(constant.value);
  const confirmOnly = !valueChanged && isAssumption !== constant.isAssumption;
  const reasonError = validateReason(reason);
  const mustType = needsTypedConfirm(issues) && valueChanged;
  const typedOk = !mustType || typed.trim() === constant.key;

  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/esg/constants/blast-radius", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: constant.key }),
      });
      const data = await res.json();
      if (!cancelled && data.ok) setRadius(data.radius);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, constant.key]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/esg/constants/${encodeURIComponent(constant.key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: Number(rawValue),
          isAssumption,
          source: source.trim() || null,
          reason: reason.trim(),
          changedBy: CURRENT_USER.id,
          expectedValue: constant.value,
          confirmInert: constant.directRefCount === 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not save.");
      await onSaved(
        confirmOnly
          ? `${constant.key} marked ${isAssumption ? "an assumption" : "confirmed"}`
          : `${constant.key} is now ${rawValue}${
              data.createsStaleness ? " · re-run the resolver to apply it" : ""
            }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep(1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#0A0A0A]/40 px-4 py-16"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] border border-gray-200 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-[13px] font-semibold text-[#0A0A0A]">
            <span className="font-mono">{constant.key}</span>
            <span className="ml-2 font-sans font-normal text-gray-500">{constant.label}</span>
          </h2>
        </div>

        {step === 1 ? (
          <div className="px-5 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="cv">
                  Value {constant.unit ? `(${constant.unit})` : ""}
                </label>
                <input
                  id="cv"
                  autoFocus
                  className={`${inputClass} font-mono tabular-nums`}
                  value={rawValue}
                  onChange={(e) => setRawValue(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Currently <span className="font-mono">{constant.value}</span>
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="cs">Source</label>
                <input
                  id="cs"
                  className={inputClass}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
            </div>

            <label className="mt-4 flex items-start gap-2 text-[12px] text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!isAssumption}
                onChange={(e) => setIsAssumption(!e.target.checked)}
              />
              <span>
                Confirmed against its source
                <span className="block text-[11px] text-gray-500">
                  Ticking this without changing the value is a normal action — it is what
                  moves a figure from indicative to disclosable.
                </span>
              </span>
            </label>

            <div className="mt-4">
              <label className={labelClass} htmlFor="cr">Reason</label>
              <input
                id="cr"
                className={inputClass}
                placeholder="e.g. ESG team confirmed against the CEA 2025 edition"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Recorded permanently. This is what an assurer reads a year from now.
              </p>
            </div>

            {issues
              .filter((i) => i.severity !== "ok")
              .map((i, n) => (
                <p
                  key={n}
                  className={`mt-3 border-l-2 py-1 pl-3 text-[12px] leading-relaxed ${
                    i.severity === "block"
                      ? "border-l-red-500 text-red-800"
                      : "border-l-amber-400 text-amber-800"
                  }`}
                >
                  {i.message}
                </p>
              ))}

            {error && (
              <p className="mt-3 border-l-2 border-l-red-500 py-1 pl-3 text-[12px] text-red-800">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="px-5 py-5">
            {radius?.driftDetected && (
              <p className="mb-3 border border-amber-300 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                The stored dependency index disagrees with the formula expressions — someone
                edited a formula without re-running the dependency block in
                07_formulas_seed.sql. Showing the union of both:{" "}
                <span className="font-mono">{radius.driftKeys.join(", ")}</span>.
              </p>
            )}

            <p className="text-[13px] font-semibold text-[#0A0A0A]">
              <span className="font-mono">{constant.key}</span>{" "}
              {valueChanged ? (
                <>
                  <span className="font-mono tabular-nums">{constant.value}</span> →{" "}
                  <span className="font-mono tabular-nums">{rawValue}</span>{" "}
                  <span className="font-normal text-gray-500">{constant.unit}</span>
                </>
              ) : (
                <span className="font-normal text-gray-600">
                  marked {isAssumption ? "an assumption" : "confirmed"}
                </span>
              )}
            </p>

            {!radius ? (
              <p className="mt-3 text-[12px] text-gray-500">Working out what this affects…</p>
            ) : radius.outputs.length === 0 ? (
              <p className="mt-3 text-[12px] leading-relaxed text-gray-700">
                {radius.inertReason === "excluded_by_design"
                  ? "This value is disclosed as a quantity but deliberately excluded from the Scope 1 build-up, so no computed figure depends on it."
                  : radius.inertReason === "affects_validation_only"
                    ? "This affects which uploaded figures are flagged for review, not any computed figure."
                    : "No formula references this value, so no computed figure will change."}
              </p>
            ) : (
              <>
                <p className="mt-3 text-[12px] leading-relaxed text-gray-700">
                  {valueChanged ? "This changes" : "This value feeds"}{" "}
                  {radius.outputs.length} computed{" "}
                  {radius.outputs.length === 1 ? "output" : "outputs"}:
                </p>
                <ul className="mt-2 space-y-1">
                  {radius.outputs.map((o) => (
                    <li key={o.key} className="text-[12px] text-gray-700">
                      <span className="font-mono text-[11px]">{o.key}</span>
                      {o.label ? <span className="text-gray-500"> — {o.label}</span> : null}
                      {o.depth > 0 && (
                        <span className="ml-1 text-[11px] text-gray-400">
                          ({o.depth} {o.depth === 1 ? "hop" : "hops"} downstream)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {valueChanged && (
                  <p className="mt-3 text-[12px] leading-relaxed text-gray-700">
                    <span className="font-semibold">
                      {radius.existingRowCount.toLocaleString("en-IN")} existing computed
                      values
                    </span>{" "}
                    rest on those outputs. They will not change until the resolver is
                    re-run — the dashboard and export keep showing the current figures
                    until then.
                  </p>
                )}
              </>
            )}

            {mustType && (
              <div className="mt-4">
                <label className={labelClass} htmlFor="ct">
                  Type <span className="font-mono">{constant.key}</span> to confirm
                </label>
                <input
                  id="ct"
                  className={`${inputClass} font-mono`}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                />
              </div>
            )}

            {error && (
              <p className="mt-3 border-l-2 border-l-red-500 py-1 pl-3 text-[12px] text-red-800">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mr-auto text-[12px] text-gray-500 underline underline-offset-2"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-200 px-4 py-2.5 text-[12px] font-medium text-gray-700"
          >
            Cancel
          </button>
          {step === 1 ? (
            <button
              type="button"
              disabled={blocked || Boolean(reasonError) || (!valueChanged && !confirmOnly)}
              onClick={() => setStep(2)}
              className="bg-brand px-4 py-2.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !typedOk}
              onClick={() => void save()}
              className="bg-brand px-4 py-2.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save change"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
