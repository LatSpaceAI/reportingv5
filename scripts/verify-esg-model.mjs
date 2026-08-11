#!/usr/bin/env node
// End-to-end check of the seeded model WITHOUT a database.
//
// The seed files are only correct if, run together, they reproduce the figures
// we already know to be true. This parses 02/04/06/07/08, evaluates the formula
// DAG over the seeded input values, and compares the results against the
// verified numbers from the Middle Link reconstruction.
//
// What it can prove: the eight evidenced site-months compute to the same
// site-level figures the reconstruction derived from the same returns, and
// Scope 2 reproduces from the back-derived grid factor.
//
// What it cannot prove: FY25 portfolio totals. Those depend on ~124 site-months
// that were never filed — the reconstruction reached them by balancing against
// the published template, which this app deliberately does not do.
//
// Usage: node scripts/verify-esg-model.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "esg");
const read = (f) => readFileSync(join(DIR, f), "utf8").replace(/^\s*--.*$/gm, "");

// --- constants --------------------------------------------------------------
const constants = new Map();
for (const m of read("02_constants_seed.sql").matchAll(
  /\(\s*'([A-Za-z0-9_.]+)'\s*,\s*'[A-Z_]+'\s*,\s*'(?:[^']|'')*'\s*,\s*(-?[\d.]+)/g
)) {
  constants.set(m[1], Number(m[2]));
}

// --- formulas ---------------------------------------------------------------
const outputKeys = new Set();
for (const m of read("06_output_parameters_seed.sql").matchAll(/\(\s*'([a-z0-9_.]+)'\s*,/g)) {
  outputKeys.add(m[1]);
}

const formulas = [];
const fsql = read("07_formulas_seed.sql");
for (const m of fsql.matchAll(/\(\s*'([a-z0-9_.]+)'\s*,\s*'((?:[^']|'')*)'\s*,/g)) {
  if (!outputKeys.has(m[1])) continue;
  const tail = fsql.slice(m.index, m.index + 2500);
  const meta = tail.match(
    /,\s*'(all|water_stressed|commercial|residential)'\s*,\s*(\d+)\s*,\s*(true|false)\s*\)/
  );
  formulas.push({
    key: m[1],
    expr: m[2].replace(/''/g, "'"),
    siteFilter: meta?.[1] ?? "all",
    evalOrder: meta ? Number(meta[2]) : 100,
  });
}
formulas.sort((a, b) => a.evalOrder - b.evalOrder);

// --- seeded input values ----------------------------------------------------
// seed_input('SITE','FY',N::smallint,'param', value, 'source', ...)
const inputs = new Map(); // site -> month -> param -> number
const MONTH_NAMES = ["", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
for (const m of read("08_input_values_seed.sql").matchAll(
  /seed_input\(\s*'([A-Z_]+)'\s*,\s*'([\d-]+)'\s*,\s*(\d+)::smallint\s*,\s*'([a-z0-9_.]+)'\s*,\s*(null|-?[\d.]+)/g
)) {
  const [, site, , month, param, raw] = m;
  if (raw === "null") continue;
  if (!inputs.has(site)) inputs.set(site, new Map());
  const bySite = inputs.get(site);
  const mo = Number(month);
  if (!bySite.has(mo)) bySite.set(mo, new Map());
  bySite.get(mo).set(param, Number(raw));
}

// --- site attributes --------------------------------------------------------
const stressed = new Set();
for (const m of read("03_dimensions_seed.sql").matchAll(
  /\(\s*'([A-Z_]+)'\s*,\s*'[^']*'\s*,\s*'(?:commercial|residential|group)'\s*,[^)]*?,\s*(true|false)\s*,\s*(?:true|false)\s*,/g
)) {
  if (m[2] === "true") stressed.add(m[1]);
}

// --- evaluator --------------------------------------------------------------
// Substitute tokens then evaluate the arithmetic. Expressions are seeded by us
// and contain only + - * / ( ) and numbers after substitution.
function evaluate(expr, resolve) {
  const substituted = expr.replace(/(in|const|out):([A-Za-z0-9_.]+)/g, (_, kind, key) => {
    const v = resolve(kind, key);
    return `(${v ?? 0})`;
  });
  if (!/^[-+*/(). \d]+$/.test(substituted)) {
    throw new Error(`unsafe expression after substitution: ${substituted}`);
  }
  // eslint-disable-next-line no-new-func
  return Function(`"use strict";return (${substituted});`)();
}

// Compute one site's outputs for one month.
function computeSiteMonth(site, month) {
  const inVals = inputs.get(site)?.get(month) ?? new Map();
  const out = new Map();
  for (const f of formulas) {
    const v = evaluate(f.expr, (kind, key) =>
      kind === "in" ? inVals.get(key) ?? 0
      : kind === "const" ? constants.get(key) ?? 0
      : out.get(key) ?? 0
    );
    out.set(f.key, v);
  }
  return out;
}

// Portfolio rollup for a month: sum over sites, honouring site_filter.
function computeGroupMonth(month) {
  const perSite = new Map();
  for (const site of inputs.keys()) perSite.set(site, computeSiteMonth(site, month));
  const out = new Map();
  for (const f of formulas) {
    let total = 0;
    for (const [site, vals] of perSite) {
      if (f.siteFilter === "water_stressed" && !stressed.has(site)) continue;
      total += vals.get(f.key) ?? 0;
    }
    out.set(f.key, total);
  }
  return out;
}

// --- expectations -----------------------------------------------------------
// Every figure below is independently established in the Middle Link
// reconstruction (Consolidation FY25 / Coverage / Emissions Check sheets) from
// the same site returns this model was seeded from.
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const checks = [];
const check = (label, got, want, tol) =>
  checks.push({ label, got, want, ok: near(got, want, tol ?? 0.01) });

// -- Aurora April 2024 --------------------------------------------------------
const auroraApr = computeSiteMonth("AURORA", 1);
check("Aurora Apr · non-renewable electricity (kWh)", auroraApr.get("en.electricity_nonrenew"), 13991 + 3122);
check("Aurora Apr · renewable electricity (kWh)", auroraApr.get("en.electricity_renew"), 271906);
check("Aurora Apr · groundwater (KL)", auroraApr.get("wtr.groundwater"), 857);
check("Aurora Apr · third-party water (KL)", auroraApr.get("wtr.third_party"), 975);
check("Aurora Apr · total withdrawal (KL)", auroraApr.get("wtr.total"), 1832);
check("Aurora Apr · stationary diesel (kL)", auroraApr.get("en.diesel_stationary"), 0.03);
// Tenant electricity must NOT reach any disclosure.
check(
  "Aurora Apr · tenant electricity excluded from boundary",
  auroraApr.get("en.electricity_nonrenew"),
  17113
);

// -- Aurora Apr-Aug, the five evidenced months --------------------------------
let auroraGreen = 0, auroraNonRenew = 0, auroraGround = 0;
for (let mo = 1; mo <= 5; mo++) {
  const v = computeSiteMonth("AURORA", mo);
  auroraGreen += v.get("en.electricity_renew");
  auroraNonRenew += v.get("en.electricity_nonrenew");
  auroraGround += v.get("wtr.groundwater");
}
// Coverage sheet: Aurora is 100% of Apr-Aug groundwater (4,008 KL) and the
// site-reported green energy over the five months is 1,421,068.7592 kWh
// including Tisya's April renewable — Aurora alone is 1,419,545.9992.
check("Aurora Apr-Aug · green energy (kWh)", auroraGreen, 1419545.9992, 0.001);
check("Aurora Apr-Aug · groundwater (KL)", auroraGround, 4008);
check("Aurora Apr-Aug · own-floor electricity (kWh)", auroraNonRenew, 90747);

// -- Tisya April 2024 ---------------------------------------------------------
const tisya = computeSiteMonth("TISYA", 1);
check("Tisya Apr · treated water (KL)", tisya.get("wtr.treated"), 612.88);
check("Tisya Apr · third-party water (KL)", tisya.get("wtr.third_party"), 428.63);
check("Tisya Apr · groundwater as filed (KL)", tisya.get("wtr.groundwater"), 1396);
check("Tisya Apr · mobile diesel (kL)", tisya.get("en.diesel_mobile"), 1.345);
check("Tisya Apr · C&D incl. scrap (MT)", tisya.get("wst.cnd_generated"), 180.38 + 3.67);
check("Tisya Apr · food waste (MT)", tisya.get("wst.food_generated"), 0.058);

// -- Sangamwadi December 2024 -------------------------------------------------
const sang = computeSiteMonth("SANGAMWADI", 9);
// The reconstruction's cleanest lineage proof: Sangamwadi alone is 98% of the
// published December stationary diesel (2.000 of 2.043 kL).
check("Sangamwadi Dec · stationary diesel (kL)", sang.get("en.diesel_stationary"), 2.0);
check("Sangamwadi Dec · third-party water incl. drinking (KL)", sang.get("wtr.third_party"), 283.2);
check("Sangamwadi Dec · C&D incl. scrap (MT)", sang.get("wst.cnd_generated"), 1.2 + 4.1);
check("Sangamwadi Dec · other hazardous / paint drums (MT)", sang.get("wst.other_haz_generated"), 0.004);

// -- Trimaya February 2025 ----------------------------------------------------
const trim = computeSiteMonth("TRIMAYA", 11);
check("Trimaya Feb · groundwater (KL)", trim.get("wtr.groundwater"), 52);
check("Trimaya Feb · third-party water (KL)", trim.get("wtr.third_party"), 1877.92);
check("Trimaya Feb · mobile diesel (kL)", trim.get("en.diesel_mobile"), 3.942);
check("Trimaya Feb · C&D generated (MT)", trim.get("wst.cnd_generated"), 7.5);
check("Trimaya Feb · C&D reused (MT)", trim.get("wst.cnd_reused"), 7.5);

// -- Water-stressed filter ----------------------------------------------------
// February: Trimaya (Bengaluru, stressed) contributes; nobody else filed.
const febGroup = computeGroupMonth(11);
check("Feb portfolio · stressed groundwater = Trimaya only (KL)", febGroup.get("wtr.ws_groundwater"), 52);
// December: only Sangamwadi (Pune, NOT stressed) filed, so stressed must be 0.
const decGroup = computeGroupMonth(9);
check("Dec portfolio · stressed third-party excludes Pune (KL)", decGroup.get("wtr.ws_third_party"), 0);
check("Dec portfolio · company-wide third-party (KL)", decGroup.get("wtr.third_party"), 283.2);

// -- Scope 2 ------------------------------------------------------------------
// The grid factor was back-derived so that published non-renewable kWh x factor
// reproduces published Scope 2. Verify the relationship holds in our evaluator.
const PUBLISHED_NONRENEW_KWH = 3683858.31;
const PUBLISHED_SCOPE2_TCO2E = 2678.16;
const scope2FromPublished = (PUBLISHED_NONRENEW_KWH * constants.get("EF.grid")) / 1000;
check("Scope 2 · grid factor reproduces published FY25", scope2FromPublished, PUBLISHED_SCOPE2_TCO2E, 0.01);

// Scope 2 must be computed off non-renewable electricity only — renewable
// electricity is zero-emission and must not inflate it.
const aprGroup = computeGroupMonth(1);
check(
  "Apr portfolio · Scope 2 uses non-renewable only (tCO2e)",
  aprGroup.get("ghg.scope2_total"),
  (aprGroup.get("en.electricity_nonrenew") * constants.get("EF.grid")) / 1000,
  0.0001
);

// -- Water identity -----------------------------------------------------------
// Consumption = withdrawal - discharge, and discharge is zero throughout. This
// is the relationship the published template got wrong in two places.
for (const [label, g] of [["Apr", aprGroup], ["Dec", decGroup], ["Feb", febGroup]]) {
  check(`${label} portfolio · consumption = withdrawal (discharge 0)`, g.get("wtr.consumption"), g.get("wtr.total"), 0.0001);
  check(
    `${label} portfolio · stressed consumption <= total consumption`,
    g.get("wtr.ws_consumption") <= g.get("wtr.consumption") + 1e-9 ? 1 : 0,
    1
  );
}

// --- report -----------------------------------------------------------------
const fmt = (n) => (typeof n === "number" ? Number(n.toFixed(4)).toLocaleString("en-US") : String(n));
console.log("\nESG model verification — computed vs known-good figures\n" + "=".repeat(78));
let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  const mark = c.ok ? "ok  " : "FAIL";
  const detail = c.ok ? fmt(c.got) : `got ${fmt(c.got)}, expected ${fmt(c.want)}`;
  console.log(`${mark}  ${c.label.padEnd(56)} ${detail}`);
}
console.log("=".repeat(78));
console.log(`${checks.length - failed}/${checks.length} passed`);

// Coverage is a first-class output of this model, so state it plainly.
const filed = [...inputs.entries()].reduce((n, [, months]) => n + months.size, 0);
console.log(
  `\nEvidenced site-months: ${filed}. Portfolio totals below full coverage are` +
  `\nsums of what was filed, not estimates of what occurred.\n`
);
process.exit(failed ? 1 : 0);
