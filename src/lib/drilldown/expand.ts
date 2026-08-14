// Expanding one computed metric into the evidence behind it.
//
// PURE — no Supabase, no `server-only`, so the offline tests can exercise the
// graph walk without a database. resolve.ts is the server wrapper that feeds it
// real rows. Same split as esgConstants/graph.ts vs blastRadius.ts, for the same
// reason.
//
// THE WALK IS THE REVERSE OF blastRadius
//
// blastRadius asks "which outputs does this constant reach?" and walks forward.
// A drilldown asks "what does this output rest on?" and walks back: parse the
// formula, collect its in:/const:/out: references, recurse on the out: ones
// until every leaf is an input or a constant.
//
// WHY THE EXPRESSIONS AND NOT esg.formula_dependency
//
// formula_dependency has NO TRIGGER. Its only writer is the manual DELETE+INSERT
// at the foot of each formulas migration, so it is a hand-refreshed CACHE of the
// expressions while formula.expression is the source of truth
// (src/lib/esgConstants/graph.ts:8-20). A drilldown reading the cache would show
// a provenance tree that quietly disagrees with the arithmetic that produced the
// number — which is the one thing a drilldown must never do.
//
// REF_RE IS IMPORTED, NOT REDECLARED. It is character-for-character the regex in
// the seed's own regeneration block; a second copy here could drift from it.

import { REF_RE, type FormulaRow } from "@/lib/esgConstants/graph";

/** FormulaRow plus the two columns a drilldown needs and a blast radius does
 *  not. Extended here rather than widened in graph.ts, so the constants feature
 *  keeps the minimal shape it actually uses. */
export interface DrilldownFormulaRow extends FormulaRow {
  isAssumption?: boolean;
  siteFilter?: string | null;
}

export interface FormulaNode {
  outputKey: string;
  expression: string;
  /** 0 for the metric asked about; 1+ for what it rests on. */
  depth: number;
  /** Direct references, in the order they appear in the expression. */
  inputKeys: string[];
  constantKeys: string[];
  outputKeys: string[];
  isAssumption: boolean;
  siteFilter: string | null;
}

export interface ProvenanceTree {
  rootKey: string;
  /** Every formula reached, nearest first. Root is nodes[0] when it has one. */
  nodes: FormulaNode[];
  /** Every distinct input parameter at any depth — the leaves that hold data. */
  inputKeys: string[];
  /** Every distinct constant at any depth. */
  constantKeys: string[];
  /**
   * True when the root has no esg.formula row. Scope 3 outputs are written
   * directly by resolve-scope3.mjs with formula_id = null, so their provenance
   * is a ledger query, not a formula walk. The caller must branch on this
   * rather than render an empty tree as "rests on nothing".
   */
  hasNoFormula: boolean;
  /** Cycle or depth-cap hit. Should never fire; surfaced rather than hidden. */
  truncated: boolean;
}

/** Hard bound on recursion. 64 formulas cannot legitimately nest 20 deep. */
const MAX_DEPTH = 20;

/** Split an expression's references by kind, preserving order and dropping
 *  duplicates within one expression. */
export function referencesOf(expression: string): {
  inputKeys: string[];
  constantKeys: string[];
  outputKeys: string[];
} {
  const inputKeys: string[] = [];
  const constantKeys: string[] = [];
  const outputKeys: string[] = [];
  for (const [, kind, key] of expression.matchAll(REF_RE)) {
    const bucket = kind === "in" ? inputKeys : kind === "const" ? constantKeys : outputKeys;
    if (!bucket.includes(key)) bucket.push(key);
  }
  return { inputKeys, constantKeys, outputKeys };
}

/**
 * Walk back from one output key to every formula, input and constant it rests
 * on.
 *
 * `formulas` is the full active registry — the same rows resolve-birla.mjs
 * loads. Inactive formulas are excluded, matching resolve-birla.mjs:150.
 */
export function expandProvenance(
  formulas: DrilldownFormulaRow[],
  rootKey: string
): ProvenanceTree {
  const byOutput = new Map<string, DrilldownFormulaRow>();
  for (const f of formulas) {
    if (f.isActive === false) continue;
    byOutput.set(f.outputKey, f);
  }

  const nodes: FormulaNode[] = [];
  const seen = new Set<string>();
  const allInputs: string[] = [];
  const allConstants: string[] = [];
  let truncated = false;

  // Breadth-first so `depth` is the shortest path, and so a diamond (two
  // formulas both reading en.electricity_total) reports the nearer depth.
  let frontier = [rootKey];
  seen.add(rootKey);
  let depth = 0;

  while (frontier.length) {
    if (depth > MAX_DEPTH) {
      truncated = true;
      break;
    }
    const next: string[] = [];
    for (const key of frontier) {
      const f = byOutput.get(key);
      if (!f) continue; // a leaf output with no formula — Scope 3, or the root
      const refs = referencesOf(f.expression);
      nodes.push({
        outputKey: key,
        expression: f.expression,
        depth,
        inputKeys: refs.inputKeys,
        constantKeys: refs.constantKeys,
        outputKeys: refs.outputKeys,
        isAssumption: Boolean(f.isAssumption),
        siteFilter: f.siteFilter ?? null,
      });
      for (const k of refs.inputKeys) if (!allInputs.includes(k)) allInputs.push(k);
      for (const k of refs.constantKeys) if (!allConstants.includes(k)) allConstants.push(k);
      for (const k of refs.outputKeys) {
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(k);
      }
    }
    frontier = next;
    depth++;
  }

  return {
    rootKey,
    nodes,
    inputKeys: allInputs,
    constantKeys: allConstants,
    hasNoFormula: !byOutput.has(rootKey),
    truncated,
  };
}

/**
 * Render an expression with values substituted, for showing the working.
 *
 * Returns null when any referenced value is missing rather than printing a gap:
 * a half-substituted formula reads as though the missing term were zero, which
 * is the same lie this whole feature exists to refuse. The caller shows the raw
 * expression instead.
 *
 * Deliberately textual and not a re-evaluation — the resolver already computed
 * the number, and a second evaluator here could disagree with it.
 */
export function substituteExpression(
  expression: string,
  values: Map<string, number | null>,
  format: (n: number) => string = (n) => String(n)
): string | null {
  let missing = false;
  const out = expression.replace(REF_RE, (_m, kind: string, key: string) => {
    const v = values.get(`${kind}:${key}`);
    if (v == null) {
      missing = true;
      return `${kind}:${key}`;
    }
    return format(v);
  });
  return missing ? null : out;
}
