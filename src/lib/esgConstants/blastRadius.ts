// What does editing a constant change?
//
// Answered two ways and cross-checked, because getting it wrong in one direction
// is much worse than the other.
//
//   FAST PATH   esg.fn_constant_blast_radius(key) — a recursive CTE over
//               formula_dependency (indexed) and v_formula_dag_edges.
//   CROSS-CHECK the same closure, recomputed in JS from formula.expression using
//               the SEED'S OWN REGEX.
//
// WHY BOTH
//
// formula_dependency has NO TRIGGER. Its only writer is the manual DELETE+INSERT
// block at 07_formulas_seed.sql:284-293, whose own comment says to regenerate it
// after any expression change. So it is a hand-refreshed CACHE of the
// expressions, and formula.expression is the source of truth.
//
// esg.v_formula_missing_refs cannot detect the drift that matters. Work both
// directions:
//
//   * Someone ADDS `const:EF.diesel` to a formula and does not re-seed. No
//     dependency row is created, so there is no row for the view to find
//     "missing" — it returns clean while the blast radius UNDER-reports. This is
//     the dangerous direction and precisely the failure this feature exists to
//     prevent.
//   * Someone REMOVES it. The stale dependency row survives, EF.diesel still
//     exists in esg.constant, so the view's existence test passes and the radius
//     OVER-reports.
//
// The view only catches references to keys that exist nowhere. It is orthogonal
// to staleness, not a partial check on it.
//
// Cost of the cross-check is trivial — 60 rows, ~2,100 characters of expression
// total — so there is no efficiency argument for trusting the cache. On
// disagreement we return the UNION and flag it: over-warning is the correct bias.

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildGraph, type FormulaRow } from "./graph";

export { buildGraph } from "./graph";
export type { FormulaRow } from "./graph";

export interface AffectedOutput {
  key: string;
  /** 0 = a formula names the constant directly; 1+ = hops downstream. */
  depth: number;
  label?: string | null;
  unit?: string | null;
  scope?: string | null;
  evalOrder?: number | null;
}

/** Why an empty blast radius is empty. Each needs a different message. */
export type InertReason =
  | "excluded_by_design"
  | "not_referenced"
  | "affects_validation_only"
  | null;

export interface BlastRadius {
  constantKey: string;
  outputs: AffectedOutput[];
  /** The formulas naming the constant themselves, before the closure. */
  directKeys: string[];
  /**
   * Existing output_value rows resting on those outputs.
   *
   * Phrased to the user as "N existing computed values", not "N will go stale":
   * the resolver upserts rather than truncating, so this is a count of what
   * exists today, not a prediction.
   */
  existingRowCount: number;
  inertReason: InertReason;
  /** True when the stored dependency index and the expressions disagree. */
  driftDetected: boolean;
  driftKeys: string[];
}

/** Constants whose empty radius is intentional rather than an oversight. */
function explainEmpty(constantKey: string, directRefCount: number): InertReason {
  if (constantKey === "GWP.r22") return "excluded_by_design";
  if (constantKey === "qa.anomaly_tolerance") return "affects_validation_only";
  if (directRefCount === 0) return "not_referenced";
  return null;
}

export async function computeBlastRadius(constantKey: string): Promise<BlastRadius> {
  // ---- Fast path: the database's own recursive CTE ------------------------
  let cteKeys = new Map<string, number>();
  let cteAvailable = true;
  try {
    const { data, error } = await supabaseAdmin.rpc("fn_constant_blast_radius", {
      p_constant_key: constantKey,
    });
    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data ?? []) as any[]) {
      cteKeys.set(r.output_key as string, Number(r.depth ?? 0));
    }
  } catch {
    // The function ships in 12_constant_revision.sql. If the migration has not
    // been applied the expression recompute below still gives a correct answer,
    // so degrade rather than fail — but do not silently claim agreement.
    cteAvailable = false;
    cteKeys = new Map();
  }

  // ---- Cross-check: recompute from the expressions ------------------------
  const { data: formulaRows, error: fErr } = await supabaseAdmin
    .from("formula")
    .select("output_key, expression, is_active, eval_order");
  if (fErr) throw fErr;

  const formulas: FormulaRow[] = (formulaRows ?? []).map((f) => ({
    outputKey: f.output_key as string,
    expression: (f.expression as string) ?? "",
    isActive: f.is_active !== false,
    evalOrder: (f.eval_order as number) ?? null,
  }));

  const { direct, closure } = buildGraph(formulas, constantKey);

  // ---- Reconcile ----------------------------------------------------------
  const union = new Map<string, number>(closure);
  const driftKeys: string[] = [];

  if (cteAvailable) {
    for (const [k, d] of cteKeys) {
      if (!union.has(k)) {
        union.set(k, d);
        driftKeys.push(k);
      }
    }
    for (const k of closure.keys()) {
      if (!cteKeys.has(k)) driftKeys.push(k);
    }
  }

  // ---- Decorate ----------------------------------------------------------
  const keys = [...union.keys()];
  const meta = new Map<
    string,
    { label: string | null; unit: string | null; scope: string | null }
  >();

  if (keys.length) {
    const { data: params } = await supabaseAdmin
      .from("output_parameter")
      .select("key, label, unit, scope")
      .in("key", keys);
    for (const p of params ?? []) {
      meta.set(p.key as string, {
        label: (p.label as string) ?? null,
        unit: (p.unit as string) ?? null,
        scope: (p.scope as string) ?? null,
      });
    }
  }

  const evalOrderByKey = new Map(formulas.map((f) => [f.outputKey, f.evalOrder ?? null]));

  const outputs: AffectedOutput[] = keys
    .map((k) => ({
      key: k,
      depth: union.get(k) ?? 0,
      label: meta.get(k)?.label ?? null,
      unit: meta.get(k)?.unit ?? null,
      scope: meta.get(k)?.scope ?? null,
      evalOrder: evalOrderByKey.get(k) ?? null,
    }))
    // The resolver's own ordering (resolve-birla.mjs:151-153), for presentation
    // only — the closure itself is order-independent because it follows real
    // out: edges.
    .sort((a, b) => (a.evalOrder ?? 1e9) - (b.evalOrder ?? 1e9) || a.key.localeCompare(b.key));

  // ---- How many computed values rest on those outputs --------------------
  let existingRowCount = 0;
  if (keys.length) {
    const { data: ids } = await supabaseAdmin
      .from("output_parameter")
      .select("id")
      .in("key", keys);
    const idList = (ids ?? []).map((r) => r.id as number);
    if (idList.length) {
      const { count } = await supabaseAdmin
        .from("output_value")
        .select("id", { count: "exact", head: true })
        .in("parameter_id", idList);
      existingRowCount = count ?? 0;
    }
  }

  return {
    constantKey,
    outputs,
    directKeys: direct,
    existingRowCount,
    inertReason: outputs.length === 0 ? explainEmpty(constantKey, direct.length) : null,
    driftDetected: driftKeys.length > 0,
    driftKeys: [...new Set(driftKeys)],
  };
}
