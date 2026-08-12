// The dependency closure: which outputs does a constant reach?
//
// PURE — deliberately NOT `server-only`, so the offline tests can exercise the
// graph without Supabase and without Next's bundler. blastRadius.ts is the
// server-side wrapper that feeds this real rows and cross-checks it against the
// database's own recursive CTE.
//
// WHY THIS IS COMPUTED FROM formula.expression AND NOT READ FROM
// formula_dependency
//
// formula_dependency has NO TRIGGER. Its only writer is the manual
// DELETE+INSERT block at 07_formulas_seed.sql:284-293, whose own comment says to
// regenerate it after any expression change. It is a hand-refreshed CACHE;
// formula.expression is the source of truth.
//
// esg.v_formula_missing_refs does not cover the gap. If someone ADDS
// `const:EF.diesel` to a formula without re-seeding, no dependency row exists,
// so there is nothing for that view to report as missing — it returns clean
// while the blast radius UNDER-reports. Under-reporting is the failure this
// whole feature exists to prevent, so the expressions are recomputed every time.

/** Character-for-character the regex at 07_formulas_seed.sql:292, so the two
 *  cannot drift by construction. */
export const REF_RE = /(in|const|out):([A-Za-z0-9_.]+)/g;

export interface FormulaRow {
  outputKey: string;
  expression: string;
  /** Inactive formulas are excluded, matching resolve-birla.mjs:150. */
  isActive?: boolean;
  evalOrder?: number | null;
}

/** Hard bound on closure depth. 60 formulas cannot legitimately nest 20 deep. */
const MAX_DEPTH = 20;

/**
 * Output keys a constant reaches, with the shortest hop count to each.
 *
 * `direct` is the formulas naming the constant themselves; `closure` includes
 * those plus everything downstream. Depth 0 means direct.
 */
export function buildGraph(
  formulas: FormulaRow[],
  constantKey: string
): { direct: string[]; closure: Map<string, number> } {
  const active = formulas.filter((f) => f.isActive !== false);

  // output -> the outputs that consume it
  const consumers = new Map<string, Set<string>>();
  const direct: string[] = [];

  for (const f of active) {
    for (const [, kind, key] of f.expression.matchAll(REF_RE)) {
      if (kind === "const" && key === constantKey) {
        if (!direct.includes(f.outputKey)) direct.push(f.outputKey);
      } else if (kind === "out") {
        if (!consumers.has(key)) consumers.set(key, new Set());
        consumers.get(key)!.add(f.outputKey);
      }
    }
  }

  // Breadth-first, so depth is the shortest path. The `closure` map doubles as
  // the seen-set: a cycle cannot loop forever because a key is only enqueued
  // the first time it is reached. v_formula_dag_edges is asserted acyclic by
  // convention rather than by a constraint, and a settings page must not hang
  // if that assertion ever breaks.
  const closure = new Map<string, number>();
  let frontier = direct.slice();
  for (const k of frontier) closure.set(k, 0);

  let depth = 0;
  while (frontier.length && depth < MAX_DEPTH) {
    depth++;
    const next: string[] = [];
    for (const cur of frontier) {
      for (const c of consumers.get(cur) ?? []) {
        if (!closure.has(c)) {
          closure.set(c, depth);
          next.push(c);
        }
      }
    }
    frontier = next;
  }

  return { direct, closure };
}

/** Every constant key any active formula references. */
export function referencedConstants(formulas: FormulaRow[]): Set<string> {
  const out = new Set<string>();
  for (const f of formulas.filter((x) => x.isActive !== false)) {
    for (const [, kind, key] of f.expression.matchAll(REF_RE)) {
      if (kind === "const") out.add(key);
    }
  }
  return out;
}
