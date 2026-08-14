// Offline tests for the drilldown's provenance walk.
//
// No database: the walk is pure over a formula registry, which is exactly what
// makes it testable. The fixtures below mirror the real shapes — a chain, a
// diamond, a constant-only leaf, an inactive formula, a cycle, and a Scope 3
// output with no formula at all.

import {
  expandProvenance,
  referencesOf,
  substituteExpression,
  type DrilldownFormulaRow,
} from "../src/lib/drilldown/expand";
import { formatFactor } from "../src/lib/drilldown/formatFactor";

let pass = 0;
let fail = 0;
function t(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`ok   ${name.padEnd(64)} ${detail}`);
  } else {
    fail++;
    console.log(`FAIL ${name.padEnd(64)} ${detail}`);
  }
}

// The real en.energy_total_gj shape, three levels deep.
const F: DrilldownFormulaRow[] = [
  { outputKey: "en.energy_total_gj", expression: "out:en.electricity_total * const:CONV.kwh_to_gj + out:en.fuel_energy_gj" },
  { outputKey: "en.electricity_total", expression: "out:en.electricity_nonrenew + out:en.electricity_renew" },
  { outputKey: "en.fuel_energy_gj", expression: "out:en.diesel_stationary * const:NCV.diesel" },
  { outputKey: "en.electricity_nonrenew", expression: "in:elec.grid + in:elec.own_floor_1" },
  { outputKey: "en.electricity_renew", expression: "in:elec.green" },
  { outputKey: "en.diesel_stationary", expression: "in:fuel.diesel_dg", isAssumption: true },
  { outputKey: "wtr.ws_groundwater", expression: "in:water.groundwater", siteFilter: "water_stressed" },
  { outputKey: "dead.key", expression: "in:nothing.at.all", isActive: false },
  // A cycle. Must terminate, not hang.
  { outputKey: "cyc.a", expression: "out:cyc.b" },
  { outputKey: "cyc.b", expression: "out:cyc.a" },
];

// ---- referencesOf ----------------------------------------------------------
const refs = referencesOf("out:a.b * const:C.d + in:e.f - out:a.b");
t("splits references by kind", refs.outputKeys.length === 1 && refs.constantKeys.length === 1 && refs.inputKeys.length === 1);
t("de-duplicates within one expression", refs.outputKeys[0] === "a.b", "out:a.b appears twice");
t("an expression with no references yields none", referencesOf("0").inputKeys.length === 0);

// ---- expandProvenance ------------------------------------------------------
const tree = expandProvenance(F, "en.energy_total_gj");
t("the root is at depth 0", tree.nodes[0]?.outputKey === "en.energy_total_gj" && tree.nodes[0]?.depth === 0);
t("the whole chain is walked", tree.nodes.length === 6, `${tree.nodes.length} formulas`);
t("depth is the shortest path",
  tree.nodes.find((n) => n.outputKey === "en.electricity_nonrenew")?.depth === 2);
t("every leaf input is collected",
  ["elec.grid", "elec.own_floor_1", "elec.green", "fuel.diesel_dg"].every((k) => tree.inputKeys.includes(k)),
  tree.inputKeys.join(", "));
t("constants at every depth are collected",
  tree.constantKeys.includes("CONV.kwh_to_gj") && tree.constantKeys.includes("NCV.diesel"));
t("an assumption flag survives the walk",
  tree.nodes.find((n) => n.outputKey === "en.diesel_stationary")?.isAssumption === true);
t("the walk is not truncated on a normal chain", !tree.truncated);
t("a formula with a row is not flagged as formula-less", !tree.hasNoFormula);

// site_filter is what makes the water-stressed lines sum a narrower site set —
// a drilldown that ignored it would list sites that did not contribute.
t("site_filter is carried on the node",
  expandProvenance(F, "wtr.ws_groundwater").nodes[0]?.siteFilter === "water_stressed");

// ---- the states that must not be silently wrong ---------------------------
const s3 = expandProvenance(F, "s3.total");
t("an output with NO formula is flagged, not returned empty-and-silent",
  s3.hasNoFormula && s3.nodes.length === 0, "Scope 3 comes from the ledger");

const inactive = expandProvenance(F, "dead.key");
t("an inactive formula is excluded like the resolver excludes it",
  inactive.hasNoFormula, "matches resolve-birla.mjs:150");

const cyc = expandProvenance(F, "cyc.a");
t("a cycle terminates rather than hanging", cyc.nodes.length >= 1, "and did not hang");

// ---- substituteExpression --------------------------------------------------
const subs = new Map<string, number | null>([
  ["out:en.electricity_total", 1551983.2592],
  ["const:CONV.kwh_to_gj", 0.0036],
  ["out:en.fuel_energy_gj", 338.2132],
]);
const shown = substituteExpression(F[0].expression, subs, formatFactor);
t("values are substituted into the working", shown != null && shown.includes("1,551,983.2592"), shown ?? "");
t("a small factor keeps its digits", shown != null && shown.includes("0.0036"),
  "0.004 would print arithmetic that could not produce the number");

const partial = new Map<string, number | null>([["out:en.electricity_total", 1]]);
t("a missing term yields null, never a half-substituted formula",
  substituteExpression(F[0].expression, partial, formatFactor) === null,
  "a gap would read as though the term were zero");
t("an explicitly null value counts as missing",
  substituteExpression("out:a.b", new Map([["out:a.b", null]]), formatFactor) === null);

// ---- formatFactor ----------------------------------------------------------
t("the kWh->GJ factor survives", formatFactor(0.0036) === "0.0036");
t("the INR->crore factor does not collapse to zero", formatFactor(1e-7) === "1.00e-7", formatFactor(1e-7));
t("a large operand is grouped", formatFactor(1551983.2592).startsWith("1,551,983"));
// toLocaleString() defaults to 3 fraction digits, which would silently drop the
// 4th decimal the resolver actually stored.
t("the fourth decimal survives grouping",
  formatFactor(1551983.2592) === "1,551,983.2592", formatFactor(1551983.2592));
t("zero stays zero", formatFactor(0) === "0");

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
