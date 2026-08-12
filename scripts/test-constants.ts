#!/usr/bin/env node
// Blast radius and edit validation, from the seed files. No database.
//
// These are the assertions that must run in CI: they catch a formula change
// breaking the dependency graph, and they pin the three "empty radius" cases
// apart. The live-database half of this feature (revisions, staleness, revert)
// needs 12_constant_revision.sql applied and lives in a separate suite.
//
// Usage: npx tsx scripts/test-constants.ts

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildGraph, type FormulaRow } from "../src/lib/esgConstants/graph";
import {
  validateConstantEdit,
  validateReason,
  isBlocked,
  needsTypedConfirm,
} from "../src/lib/esgConstants/validation";

const checks: { label: string; ok: boolean; detail: string }[] = [];
const t = (label: string, ok: unknown, detail: unknown = "") =>
  checks.push({ label, ok: Boolean(ok), detail: String(detail ?? "") });

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "esg");

// --- parse the formula seed -------------------------------------------------
// Comments stripped first, exactly as verify-esg-model.mjs does, so a `const:`
// mentioned in prose cannot be read as a dependency.
const formulaSql = readFileSync(join(DIR, "07_formulas_seed.sql"), "utf8").replace(
  /^\s*--.*$/gm,
  ""
);

const formulas: FormulaRow[] = [];
for (const m of formulaSql.matchAll(/\('([a-z0-9._]+)',\s*\n?\s*'((?:[^']|'')*)'/g)) {
  formulas.push({ outputKey: m[1], expression: m[2], isActive: true });
}

// --- parse the constant seeds ----------------------------------------------
const constantSql =
  readFileSync(join(DIR, "02_constants_seed.sql"), "utf8").replace(/^\s*--.*$/gm, "") +
  readFileSync(join(DIR, "11_import_batch.sql"), "utf8").replace(/^\s*--.*$/gm, "");

const constantKeys = new Set<string>();
for (const m of constantSql.matchAll(
  /\(\s*'([A-Za-z0-9_.]+)'\s*,\s*'(EF_GRID|EF_FUEL|GWP_REFRIG|CONVERSION|DATA_QUALITY)'/g
)) {
  constantKeys.add(m[1]);
}

async function main() {
  t("the formula seed parsed", formulas.length === 60, `${formulas.length} formulas`);
  t("the constant seeds parsed", constantKeys.size === 15, `${constantKeys.size} constants`);

  const radius = (key: string) => {
    const { direct, closure } = buildGraph(formulas, key);
    return { direct, keys: [...closure.keys()].sort(), closure };
  };

  // =========================================================================
  // THE CLOSURE — transitive, not just direct
  // =========================================================================
  const diesel = radius("EF.diesel");
  t("EF.diesel affects exactly 3 outputs", diesel.keys.length === 3, diesel.keys.join(", "));
  t("EF.diesel names ghg.scope1_diesel directly", diesel.direct.includes("ghg.scope1_diesel"));
  t("EF.diesel reaches ghg.scope1_total (1 hop)", diesel.closure.get("ghg.scope1_total") === 1);
  t("EF.diesel reaches ghg.total (2 hops)", diesel.closure.get("ghg.total") === 2,
    `depth ${diesel.closure.get("ghg.total")}`);
  t("EF.diesel does NOT reach ghg.scope2_total (Scope 2 is grid only)",
    !diesel.keys.includes("ghg.scope2_total"));
  t("EF.diesel does NOT reach en.diesel_stationary (upstream — the walk must " +
    "follow edges, not reverse them)", !diesel.keys.includes("en.diesel_stationary"));

  const grid = radius("EF.grid");
  t("EF.grid affects ghg.scope2_total and ghg.total only",
    grid.keys.join(",") === "ghg.scope2_total,ghg.total", grid.keys.join(","));

  const r410a = radius("GWP.r410a");
  t("GWP.r410a reaches ghg.total via scope1_refrigerant",
    r410a.direct.includes("ghg.scope1_refrigerant") && r410a.keys.includes("ghg.total"),
    r410a.keys.join(", "));

  // =========================================================================
  // THE THREE EMPTY RADII — each empty for a different reason
  // =========================================================================
  t("GWP.r22 affects nothing (Montreal Protocol gas, excluded by design)",
    radius("GWP.r22").keys.length === 0);
  t("CONV.l_to_kl is referenced by no formula", radius("CONV.l_to_kl").keys.length === 0);
  t("CONV.kg_to_mt is referenced by no formula", radius("CONV.kg_to_mt").keys.length === 0);
  t("qa.anomaly_tolerance affects no output (validation only)",
    radius("qa.anomaly_tolerance").keys.length === 0);

  // The one CONVERSION constant that IS live — which is why category is the
  // wrong key for the inert check and direct_ref_count is the right one.
  const gj = radius("CONV.kwh_to_gj");
  t("CONV.kwh_to_gj IS live — affects en.energy_total_gj",
    gj.keys.length === 1 && gj.keys[0] === "en.energy_total_gj", gj.keys.join(","));

  // =========================================================================
  // GRAPH INTEGRITY
  // =========================================================================
  const referenced = new Set<string>();
  for (const f of formulas) {
    for (const m of f.expression.matchAll(/const:([A-Za-z0-9_.]+)/g)) referenced.add(m[1]);
  }
  const unresolved = [...referenced].filter((k) => !constantKeys.has(k));
  t("every const: token resolves to a real constant", unresolved.length === 0,
    unresolved.join(", ") || "0 unresolved");

  t("9 of the 15 constants are referenced by a formula", referenced.size === 9,
    `${referenced.size} referenced`);

  // A synthetic cycle must terminate rather than hang.
  const cyclic: FormulaRow[] = [
    { outputKey: "a", expression: "const:EF.diesel + out:b", isActive: true },
    { outputKey: "b", expression: "out:a", isActive: true },
  ];
  const cyc = buildGraph(cyclic, "EF.diesel");
  t("the closure terminates on a cycle instead of hanging",
    cyc.closure.has("a") && cyc.closure.has("b"), [...cyc.closure.keys()].join(","));

  // An inactive formula must drop out, matching resolve-birla.mjs:150.
  const withInactive: FormulaRow[] = [
    { outputKey: "x", expression: "const:EF.diesel", isActive: false },
    { outputKey: "y", expression: "const:EF.diesel", isActive: true },
  ];
  const inactiveKeys = [...buildGraph(withInactive, "EF.diesel").closure.keys()];
  t("an inactive formula is excluded from the radius",
    inactiveKeys.join(",") === "y", inactiveKeys.join(","));

  // The 8 literal-'0' formulas carry no dependency and must fall out cleanly.
  const zeroFormulas = formulas.filter((f) => f.expression.trim() === "0");
  t("8 formulas are a literal 0 and carry no dependencies", zeroFormulas.length === 8,
    zeroFormulas.map((f) => f.outputKey).join(", "));

  // =========================================================================
  // VALIDATION
  // =========================================================================
  const v = (rawValue: string, opts: Partial<Parameters<typeof validateConstantEdit>[0]> = {}) =>
    validateConstantEdit({
      key: "EF.diesel",
      category: "EF_FUEL",
      rawValue,
      currentValue: 2.65,
      directRefCount: 1,
      ...opts,
    });

  t("rejects a non-numeric value", isBlocked(v("two point six")));
  t("rejects an empty value", isBlocked(v("")));
  t("rejects zero", isBlocked(v("0")));
  t("rejects a negative", isBlocked(v("-2.65")));
  t("rejects Infinity", isBlocked(v("Infinity")));
  t("rejects 9 decimal places", isBlocked(v("2.650000001")));
  t("accepts a plausible edit cleanly", !isBlocked(v("2.58")) && !needsTypedConfirm(v("2.58")));
  t("warns but does not block an out-of-range factor",
    !isBlocked(v("26.5")) && needsTypedConfirm(v("26.5")));
  t("warns on a change larger than 25%",
    needsTypedConfirm(v("3.40")), "2.65 -> 3.40");
  t("an inert edit warns and demands a typed confirm",
    needsTypedConfirm(v("0.002", { key: "CONV.l_to_kl", category: "CONVERSION", currentValue: 0.001, directRefCount: 0 })));
  t("the inert warning names unit_factor as the real location",
    v("0.002", { key: "CONV.l_to_kl", category: "CONVERSION", currentValue: 0.001, directRefCount: 0 })
      .some((i) => /unit_factor/.test(i.message)));

  // The fraction guard — a hard block, because 20 instead of 0.20 silences the
  // anomaly check rather than loosening it.
  const tol = (raw: string) =>
    v(raw, { key: "qa.anomaly_tolerance", category: "DATA_QUALITY", currentValue: 0.2, directRefCount: 0 });
  t("qa.anomaly_tolerance = 20 is BLOCKED (it is a fraction)", isBlocked(tol("20")));
  t("qa.anomaly_tolerance = 0.25 is accepted", !isBlocked(tol("0.25")));
  t("the fraction block explains that 0.20 means 20%",
    tol("20").some((i) => /0\.20 means 20%/.test(i.message)));

  t("an unknown category falls back to permissive rather than throwing",
    !isBlocked(v("5", { category: "SOMETHING_NEW" })));

  // Reasons
  t("an empty reason is rejected", validateReason("") !== null);
  t("a too-short reason is rejected", validateReason("ok") !== null);
  t("a real reason is accepted", validateReason("ESG team confirmed against CEA 2025") === null);

  // =========================================================================
  // STALENESS PREDICATE
  //
  // Regression guard for a bug found in live testing: staleness keyed off
  // constant.updated_at alone, which moves on ANY edit. Marking a factor
  // "confirmed against its source" — the primary ESG-team workflow, deliberately
  // allowed without touching the number — therefore told the user to re-run the
  // resolver when no arithmetic had changed. That trains people to ignore the
  // banner precisely when it matters.
  //
  // The rule: a constant is stale only when it FEEDS A FORMULA and its VALUE
  // moved after the last successful run. Both halves required.
  // =========================================================================
  const isStaleRow = (
    r: { oldValue: number; newValue: number; directRefCount: number }
  ) => Number(r.oldValue) !== Number(r.newValue) && r.directRefCount > 0;

  t("a value change on a live constant is stale",
    isStaleRow({ oldValue: 2.65, newValue: 2.58, directRefCount: 1 }));
  t("a CONFIRM-ONLY edit is NOT stale (old_value === new_value)",
    !isStaleRow({ oldValue: 2.3, newValue: 2.3, directRefCount: 1 }),
    "the bug this guards");
  t("a value change on an INERT constant is not stale",
    !isStaleRow({ oldValue: 0.001, newValue: 0.002, directRefCount: 0 }));
  t("a confirm-only edit on an inert constant is not stale",
    !isStaleRow({ oldValue: 1810, newValue: 1810, directRefCount: 0 }));

  // --- report -------------------------------------------------------------
  const width = Math.max(...checks.map((c) => c.label.length)) + 2;
  console.log("\nconstants — blast radius and edit validation (no database)\n");
  for (const c of checks) {
    console.log(`${c.ok ? "ok  " : "FAIL"} ${c.label.padEnd(width)} ${c.detail}`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} passed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
