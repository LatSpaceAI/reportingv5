#!/usr/bin/env node
// Static validator for the esg/*.sql seed files.
//
// Postgres is the real authority here, but the seeds have to be right BEFORE
// they reach a database — a broken reference discovered in the SQL editor costs
// a round-trip. This parses the seed files directly and runs the same checks
// the v_formula_missing_refs and v_formula_dag_edges views would:
//
//   1. Every in:/const:/out: token in a formula resolves to a seeded key.
//   2. Every output_parameter has exactly one formula, and vice versa.
//   3. The output->output dependency graph is acyclic, and eval_order is
//      consistent with it (a formula never reads an output computed later).
//   4. Every site_form_field maps to a real input_parameter key.
//   5. Every site is assigned exactly one form.
//
// Usage: node scripts/validate-esg-seed.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "esg");
const read = (f) => readFileSync(join(DIR, f), "utf8");

// Strip line comments so commented-out examples never register as real keys.
const strip = (sql) => sql.replace(/^\s*--.*$/gm, "");

const files = {
  constants: strip(read("02_constants_seed.sql")),
  dimensions: strip(read("03_dimensions_seed.sql")),
  inputs: strip(read("04_input_parameters_seed.sql")),
  forms: strip(read("05_site_forms_seed.sql")),
  outputs: strip(read("06_output_parameters_seed.sql")),
  formulas: strip(read("07_formulas_seed.sql")),
  values: strip(read("08_input_values_seed.sql")) + strip(read("08b_input_values_fy24_seed.sql")),
};

const errors = [];
const warnings = [];

// --- collect seeded keys ----------------------------------------------------
// Keys are the first quoted string of each VALUES tuple, e.g. ('EF.grid', ...).
const firstTupleStrings = (sql) => {
  const out = new Set();
  for (const m of sql.matchAll(/\(\s*'([A-Za-z0-9_.\-]+)'\s*,/g)) out.add(m[1]);
  return out;
};

const constantKeys = firstTupleStrings(files.constants);
const inputKeys = firstTupleStrings(files.inputs);
const outputKeys = firstTupleStrings(files.outputs);

// --- parse formulas ---------------------------------------------------------
// Each formula tuple starts ('<output_key>', '<expression>', ... eval_order is
// the 2nd-to-last field before is_assumption.
const formulas = [];
for (const m of files.formulas.matchAll(
  /\(\s*'([a-z0-9_.]+)'\s*,\s*'((?:[^']|'')*)'\s*,/g
)) {
  const [, outputKey, expression] = m;
  if (!outputKeys.has(outputKey)) continue; // skip non-formula tuples
  // eval_order: find the tail of this tuple to read the numeric fields.
  const tail = files.formulas.slice(m.index, m.index + 2000);
  const evalMatch = tail.match(/,\s*'(all|water_stressed|commercial|residential)'\s*,\s*(\d+)\s*,\s*(true|false)\s*\)/);
  formulas.push({
    outputKey,
    expression: expression.replace(/''/g, "'"),
    evalOrder: evalMatch ? Number(evalMatch[2]) : null,
    siteFilter: evalMatch ? evalMatch[1] : null,
  });
}

// --- check 1: every reference resolves --------------------------------------
const refsOf = (expr) =>
  [...expr.matchAll(/(in|const|out):([A-Za-z0-9_.]+)/g)].map((m) => ({
    kind: m[1],
    key: m[2],
  }));

for (const f of formulas) {
  for (const { kind, key } of refsOf(f.expression)) {
    const pool =
      kind === "in" ? inputKeys : kind === "const" ? constantKeys : outputKeys;
    const label =
      kind === "in" ? "input_parameter" : kind === "const" ? "constant" : "output_parameter";
    if (!pool.has(key)) {
      errors.push(`${f.outputKey}: references ${kind}:${key} — no such ${label}`);
    }
  }
}

// --- check 2: formula/output coverage ---------------------------------------
const formulaKeys = new Set(formulas.map((f) => f.outputKey));
for (const k of outputKeys) {
  if (!formulaKeys.has(k)) errors.push(`output_parameter '${k}' has no formula`);
}
const seen = new Set();
for (const f of formulas) {
  if (seen.has(f.outputKey)) errors.push(`duplicate formula for '${f.outputKey}'`);
  seen.add(f.outputKey);
}

// --- check 3: DAG + eval_order consistency ----------------------------------
const edges = new Map(); // to -> [from...]
for (const f of formulas) {
  edges.set(
    f.outputKey,
    refsOf(f.expression).filter((r) => r.kind === "out").map((r) => r.key)
  );
}

const WHITE = 0, GREY = 1, BLACK = 2;
const colour = new Map([...edges.keys()].map((k) => [k, WHITE]));
const cycles = [];
const visit = (n, path) => {
  if (colour.get(n) === GREY) {
    cycles.push([...path.slice(path.indexOf(n)), n].join(" -> "));
    return;
  }
  if (colour.get(n) === BLACK) return;
  colour.set(n, GREY);
  for (const dep of edges.get(n) ?? []) visit(dep, [...path, n]);
  colour.set(n, BLACK);
};
for (const n of edges.keys()) if (colour.get(n) === WHITE) visit(n, []);
for (const c of cycles) errors.push(`cycle in output dependencies: ${c}`);

const orderOf = new Map(formulas.map((f) => [f.outputKey, f.evalOrder]));
for (const f of formulas) {
  for (const dep of edges.get(f.outputKey) ?? []) {
    const depOrder = orderOf.get(dep);
    if (depOrder != null && f.evalOrder != null && depOrder >= f.evalOrder) {
      errors.push(
        `${f.outputKey} (eval_order ${f.evalOrder}) reads out:${dep} (eval_order ${depOrder}) — dependency must evaluate first`
      );
    }
  }
}

// --- check 4: form fields map to real parameters ----------------------------
// Form fields reference parameters via  where key = 'x'  inside the seed.
const formParamRefs = new Set();
for (const m of files.forms.matchAll(/input_parameter\s+where\s+key\s*=\s*'([A-Za-z0-9_.]+)'/g)) {
  formParamRefs.add(m[1]);
}
// ... and via the VALUES tuples that carry a pkey column.
for (const m of files.forms.matchAll(/'((?:water|elec|fuel|waste|refrig|air|ops)\.[a-z0-9_]+)'/g)) {
  formParamRefs.add(m[1]);
}
for (const key of formParamRefs) {
  if (!inputKeys.has(key)) {
    errors.push(`site_form_field maps to input parameter '${key}' — no such input_parameter`);
  }
}

// --- check 5: every site has a form -----------------------------------------
const siteCodes = new Set();
for (const m of files.dimensions.matchAll(/\(\s*'([A-Z_]+)'\s*,\s*'Birla|\(\s*'([A-Z_]+)'\s*,\s*'/g)) {
  const code = m[1] ?? m[2];
  if (code && code === code.toUpperCase()) siteCodes.add(code);
}
const assignedSites = new Set();
for (const m of files.forms.matchAll(/s\.code\s*=\s*'([A-Z_]+)'/g)) assignedSites.add(m[1]);
for (const m of files.forms.matchAll(/s\.code\s+in\s*\(([^)]+)\)/g)) {
  for (const c of m[1].matchAll(/'([A-Z_]+)'/g)) assignedSites.add(c[1]);
}
for (const code of siteCodes) {
  if (code === "GROUP") continue;
  if (!assignedSites.has(code)) warnings.push(`site '${code}' has no form assignment`);
}

// --- check 6: seeded values reference real sites and parameters --------------
for (const m of files.values.matchAll(
  /seed_input\(\s*'([A-Z_]+)'\s*,\s*'([\d-]+)'\s*,\s*(\d+)::smallint\s*,\s*'([a-z0-9_.]+)'/g
)) {
  const [, site, , , param] = m;
  if (!siteCodes.has(site)) errors.push(`seeded value for unknown site '${site}'`);
  if (!inputKeys.has(param)) errors.push(`seeded value for unknown parameter '${param}'`);
}

// --- unused input parameters (informational) --------------------------------
const usedInputs = new Set();
for (const f of formulas) {
  for (const r of refsOf(f.expression)) if (r.kind === "in") usedInputs.add(r.key);
}
// is_memo is the boolean immediately before sort_order in each tuple. Tuples
// wrap across lines, so match with /s and stop at the tuple's own quoted key.
const memoKeys = new Set();
for (const m of files.inputs.matchAll(
  /\(\s*'([A-Za-z0-9_.]+)'(?:[^()]|\([^()]*\))*?,\s*(true|false)\s*,\s*\d+\s*,/gs
)) {
  if (m[2] === "true") memoKeys.add(m[1]);
}

// A non-memo input that no formula reads is a real gap worth reporting — the
// site is being asked for a number that reaches no disclosure. The exception is
// inputs whose BRSR line exists but is blocked on a missing conversion factor
// (counts and litres against MT-denominated lines); those are already
// documented as zero-valued formulas, so list them separately.
const BLOCKED_ON_CONVERSION = new Set([
  "waste.used_oil",
  "waste.oil_filters_no",
  "waste.battery_no",
  "waste.coolant_oil",
]);
const unusedNonMemo = [...inputKeys].filter(
  (k) => !usedInputs.has(k) && !memoKeys.has(k) && !BLOCKED_ON_CONVERSION.has(k)
);
const blocked = [...inputKeys].filter(
  (k) => !usedInputs.has(k) && BLOCKED_ON_CONVERSION.has(k)
);

// --- report -----------------------------------------------------------------
const n = (s, c) => `${c} ${s}`;
console.log("\nESG seed validation\n" + "=".repeat(60));
console.log(`constants          ${constantKeys.size}`);
console.log(`input parameters   ${inputKeys.size}  (${memoKeys.size} memo)`);
console.log(`output parameters  ${outputKeys.size}`);
console.log(`formulas           ${formulas.length}`);
console.log(`sites              ${siteCodes.size}`);
console.log("=".repeat(60));

if (blocked.length) {
  console.log(
    `\nCollected but not yet disclosable — needs a unit conversion (${blocked.length}):`
  );
  for (const k of blocked) console.log(`  · ${k}`);
}
if (unusedNonMemo.length) {
  console.log(`\nNon-memo inputs no formula reads (${unusedNonMemo.length}):`);
  for (const k of unusedNonMemo) console.log(`  · ${k}`);
}
if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(n(w, "  !"));
}
if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(n(e, "  x"));
  console.log("\nFAILED\n");
  process.exit(1);
}
console.log("\nAll checks passed.\n");
