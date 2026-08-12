#!/usr/bin/env node
// =============================================================================
// Static validation of the Scope 3 seed files.
//
// Checks the SQL as text, before it ever reaches a database: that every mapping
// points at a factor that is actually seeded, that the counts match what was
// counted from the workbook, and that the resolver's fixed factor lookups exist.
//
// WHY STATICALLY
//   14_scope3_constants.sql carries a DO block that raises on an orphaned
//   mapping, which is the real guard. But that only fires when someone applies
//   it against a live database — and the failure then is a half-applied
//   migration. This catches the same class of error in CI, on a fresh clone,
//   with no network.
//
// Run: node scripts/validate-scope3-seed.mjs
// =============================================================================

import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  if (ok) {
    pass++;
    console.log(`ok   ${name}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${detail ? `\n       ${detail}` : ""}`);
  }
};

const schema = await read("supabase/esg/13_scope3_schema.sql");
const constants = await read("supabase/esg/14_scope3_constants.sql");
const outputs = await read("supabase/esg/15_scope3_outputs.sql");
const methods = await read("scripts/lib/scope3-methods.mjs");
const resolver = await read("scripts/resolve-scope3.mjs");

console.log("SCOPE 3 — seed validation\n" + "=".repeat(72) + "\n");

// ---------------------------------------------------------------------------
// Parse the factor keys and mapping rows out of the seed text.
// ---------------------------------------------------------------------------
const factorKeys = new Set();
for (const m of constants.matchAll(/^\('((?:EF|GWP)-[A-Z0-9-]+)',\s*'([A-Z_0-9]+)'/gm)) {
  factorKeys.add(m[1]);
}
const controlKeys = new Set();
for (const m of constants.matchAll(/^\('(s3\.[a-z_0-9]+)',\s*'S3_CONTROL'/gm)) {
  controlKeys.add(m[1]);
}

// Mapping rows: ('block', 'lookup', 'FACTOR', factor2, suggested)
const mappingRows = [];
for (const m of constants.matchAll(
  /^\('(material|freight|waste|spend|travel|commute|refrigerant|hsn)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*(null|'[^']*'),\s*(null|'(?:[^']|'')*')\)/gm
)) {
  mappingRows.push({
    block: m[1],
    lookup: m[2].replace(/''/g, "'"),
    factor: m[3],
    factor2: m[4] === "null" ? null : m[4].slice(1, -1),
    suggested: m[5] === "null" ? null : m[5].slice(1, -1).replace(/''/g, "'"),
  });
}

// ---- counts, against what was counted from the workbook -------------------
check("95 emission factors seeded", factorKeys.size === 95, `found ${factorKeys.size}`);
check("111 mapping rows seeded", mappingRows.length === 111, `found ${mappingRows.length}`);
check(
  "7 CONTROL constants seeded",
  controlKeys.size === 7,
  `found ${controlKeys.size}: ${[...controlKeys].join(", ")}`
);

const byBlock = {};
for (const r of mappingRows) byBlock[r.block] = (byBlock[r.block] ?? 0) + 1;
check(
  "mapping blocks match the workbook",
  byBlock.material === 18 && byBlock.freight === 8 && byBlock.spend === 15 &&
    byBlock.waste === 21 && byBlock.travel === 8 && byBlock.commute === 7 &&
    byBlock.refrigerant === 7 && byBlock.hsn === 27,
  JSON.stringify(byBlock)
);

// ---- referential integrity -------------------------------------------------
const orphans = mappingRows.filter((r) => r.factor !== "__via_spend__" && !factorKeys.has(r.factor));
check(
  "every mapping points at a seeded factor",
  orphans.length === 0,
  orphans.map((o) => `${o.block}/${o.lookup} -> ${o.factor}`).join("; ")
);

const orphans2 = mappingRows.filter((r) => r.factor2 && !factorKeys.has(r.factor2));
check(
  "every WTT mapping points at a seeded factor",
  orphans2.length === 0,
  orphans2.map((o) => `${o.block}/${o.lookup} -> ${o.factor2}`).join("; ")
);

const spendKeys = new Set(mappingRows.filter((r) => r.block === "spend").map((r) => r.lookup));
const badSuggestions = mappingRows.filter(
  (r) => r.block === "hsn" && r.suggested && !spendKeys.has(r.suggested)
);
check(
  "every HSN suggestion names a real spend category",
  badSuggestions.length === 0,
  badSuggestions.map((o) => `${o.lookup} -> ${o.suggested}`).join("; ")
);

// ---- the waste block's composite key ---------------------------------------
const wasteRows = mappingRows.filter((r) => r.block === "waste");
check(
  "every waste key is a 'stream | route' composite",
  wasteRows.every((r) => r.lookup.includes(" | ")),
  wasteRows.filter((r) => !r.lookup.includes(" | ")).map((r) => r.lookup).join("; ")
);
// The trap this key exists to prevent: same stream, different route, different
// factor. If these ever collapse to one factor the method has been broken.
const cdLandfill = wasteRows.find((r) => r.lookup === "Construction and demolition | Landfill");
const orgLandfill = wasteRows.find((r) => r.lookup === "Food / organic | Landfill");
check(
  "C&D and organic to landfill resolve to DIFFERENT factors",
  cdLandfill && orgLandfill && cdLandfill.factor !== orgLandfill.factor,
  `${cdLandfill?.factor} vs ${orgLandfill?.factor}`
);

// ---- the factors the resolver looks up by key, not through a mapping -------
const FIXED = [
  "EF-ELEC-CEA-COMB", "EF-ELEC-TD-LOSS", "EF-ELEC-UPSTREAM",
  "EF-DSL-WTT", "EF-PET-WTT", "EF-DSL-COMB", "EF-CMT-WFH",
];
const missingFixed = FIXED.filter((k) => !factorKeys.has(k));
check(
  "every factor the resolver reads by key is seeded",
  missingFixed.length === 0,
  missingFixed.join(", ")
);

// ---- the assumption discipline ---------------------------------------------
// The workbook's README is unambiguous: 90 of 95 are placeholders. Seeding them
// as confirmed would turn a test fixture into a disclosure.
const confirmed = [...constants.matchAll(/^\('((?:EF|GWP)-[A-Z0-9-]+)'[^\n]*?,\s*false,\s*(?:'AR6'|null),/gm)].map((m) => m[1]);
check(
  "exactly 5 factors are seeded as confirmed",
  confirmed.length === 5,
  `${confirmed.length}: ${confirmed.join(", ")}`
);
check(
  "the 5 confirmed are the expected ones",
  ["EF-ELEC-CEA-COMB", "EF-MAT-SUPPLIER-EPD", "EF-CMT-WALK-CYCLE", "GWP-CO2", "EF-ZERO"]
    .every((k) => confirmed.includes(k)),
  confirmed.join(", ")
);

// ---- the AR4 / AR6 separation ----------------------------------------------
// GWP_REFRIG (existing) holds AR4; GWP_AR6 holds AR6. R22 is 1810 in one and
// 1760 in the other, and two GWP sets cannot share a key.
check(
  "AR6 GWPs are in their own category, not GWP_REFRIG",
  constants.includes("'GWP_AR6'") && !/\('GWP-R22',\s*'GWP_REFRIG'/.test(constants)
);
check(
  "R22 is seeded at the AR6 value of 1760, not the AR4 1810",
  /\('GWP-R22',\s*'GWP_AR6',[^\n]*?,\s*1760,/.test(constants)
);
const legacy = await read("supabase/esg/02_constants_seed.sql");
check(
  "the existing AR4 GWP keys are untouched",
  legacy.includes("GWP.r22") && !constants.includes("'GWP.r22'"),
  "a Scope 3 seed must not redefine a Scope 1 constant"
);

// ---- ghg.total must not be redefined ---------------------------------------
check(
  "ghg.total_all_scopes is a NEW key",
  outputs.includes("'ghg.total_all_scopes'")
);
check(
  "ghg.total is NOT redefined by the Scope 3 seed",
  !/update\s+esg\.output_parameter[\s\S]{0,200}ghg\.total'/i.test(outputs) &&
    !/insert[\s\S]{0,400}\('ghg\.total',/.test(outputs),
  "every dashboard tile and export cell reads ghg.total as Scope 1 + 2"
);

// ---- output parameters ------------------------------------------------------
const s3Params = [...outputs.matchAll(/^\('(s3\.[a-z0-9_]+)',\s*'SCOPE3'/gm)].map((m) => m[1]);
check("13 SCOPE3 output parameters", s3Params.length === 13, `${s3Params.length}: ${s3Params.join(", ")}`);
check(
  "the 11 category keys the resolver writes all exist",
  ["s3.cat1_spend", "s3.cat1_materials", "s3.cat2_capital", "s3.cat3_fera",
   "s3.cat4_freight", "s3.cat4_materials", "s3.cat5_waste", "s3.cat6_travel",
   "s3.cat7_commute", "s3.cat11_sold", "s3.cat13_leased"].every((k) => s3Params.includes(k))
);

// Every key the resolver names must be seeded somewhere — a typo either side
// would make the resolver skip a whole category with a one-line warning.
//
// The s3. prefix is shared by two different things: OUTPUT parameters
// (s3.cat1_spend) live in 15_scope3_outputs.sql, and CONTROL constants
// (s3.fx_inr_per_eur) live in 14_scope3_constants.sql. Both are checked, against
// their own file, so a key cannot pass by being seeded in the wrong one.
const resolverKeys = [...new Set([...resolver.matchAll(/"(s3\.[a-z0-9_]+)"/g)].map((m) => m[1]))];
const unseeded = resolverKeys.filter((k) => !s3Params.includes(k) && !controlKeys.has(k));
check(
  "every s3.* key the resolver names is seeded",
  unseeded.length === 0,
  unseeded.join(", ")
);

// The CONTROL constants the resolver hard-fails on if absent. It refuses to
// substitute defaults for them because each scales a whole category.
const requiredControl = resolverKeys.filter((k) => controlKeys.has(k));
check(
  "the CONTROL constants the resolver requires are all seeded",
  requiredControl.length >= 4,
  `${requiredControl.length}: ${requiredControl.join(", ")}`
);

// ---- the ledger contract ----------------------------------------------------
const ledgerCodes = [...schema.matchAll(/^\('([a-z_]+)',\s*'INPUT - \d/gm)].map((m) => m[1]);
check("9 ledgers declared", ledgerCodes.length === 9, ledgerCodes.join(", "));
const resolverLedgers = [...resolver.matchAll(/byLedger\("([a-z_]+)"\)/g)].map((m) => m[1]);
const unknownLedgers = [...new Set(resolverLedgers)].filter((l) => !ledgerCodes.includes(l));
check(
  "every ledger the resolver reads is declared",
  unknownLedgers.length === 0,
  unknownLedgers.join(", ")
);
const unreadLedgers = ledgerCodes.filter((l) => !resolverLedgers.includes(l));
check(
  "every declared ledger is read by the resolver",
  unreadLedgers.length === 0,
  `unread: ${unreadLedgers.join(", ")} — a ledger nobody reads is silently excluded data`
);

// ---- the traps are still documented where they are implemented -------------
// Not style policing: each of these comments is the only warning a future
// reader gets before "simplifying" arithmetic that produces plausible wrong
// numbers.
for (const [name, re] of [
  ["T&D gross-up is L/(1-L)", /L\s*\/\s*\(1\s*-\s*L\)/],
  ["circuity is a detour factor, not curvature", /DETOUR factor, NOT A CURVATURE|detour factor.*not.*curvature/i],
  ["spend uses a market rate, not PPP", /MARKET RATE, NOT PPP|market rate.*not ppp/i],
  ["occupancy divides", /OCCUPANCY DIVIDES/i],
  ["a missing lifetime is not a lifetime of one", /MISSING LIFETIME IS NOT A LIFETIME OF ONE/i],
]) {
  check(`documented: ${name}`, re.test(methods));
}

console.log("\n" + "=".repeat(72));
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
