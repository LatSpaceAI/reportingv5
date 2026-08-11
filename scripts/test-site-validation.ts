// Verifies the entry-time rules fire on the known-bad site-months, and stay
// quiet on the good ones. Every case is real data from birla-estates/input/.
// Run: npx tsx scripts/test-site-validation.ts
import { runValidations } from "../src/lib/siteEntry/validation";

const check = (
  label: string,
  values: Record<string, number | null>,
  expectCodes: string[]
) => {
  const flags = runValidations({ values, notAvailable: new Set() });
  const got = flags.map((f) => f.ruleCode).sort();
  const want = [...expectCodes].sort();
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`       got  ${got.join(", ") || "(none)"}\n       want ${want.join(", ") || "(none)"}`);
  for (const f of flags) console.log(`         · [${f.severity}] ${f.message}`);
  return ok;
};

let pass = 0, total = 0;
const t = (l: string, v: Record<string, number | null>, e: string[]) => {
  total++; if (check(l, v, e)) pass++;
};

// Aurora May-24: STP outlet 2,276 vs inlet 1,915 — physically impossible.
t("Aurora May-24 · STP outlet exceeds inlet",
  { "water.stp_inlet": 1915, "water.stp_outlet": 2276 },
  ["STP_OUTLET_GT_INLET"]);

// Aurora Apr-24: inlet blank, so the rule cannot run — must stay silent.
t("Aurora Apr-24 · blank inlet does not fire",
  { "water.stp_inlet": null, "water.stp_outlet": 2257 },
  []);

// Sangamwadi Dec-24: filed total 0 against sources summing 283.2; and DG
// 2,000 L over 741 h = 2.7 L/h.
t("Sangamwadi Dec-24 · total mismatch + implausible DG + count-only filters",
  {
    "water.total_reported": 0, "water.tanker": 280, "water.drinking": 3.2,
    "fuel.diesel_dg": 2.0, "ops.dg_hours": 741,
    "waste.oil_filters_no": 2,
  },
  ["WATER_TOTAL_MISMATCH", "DG_CONSUMPTION_IMPLAUSIBLE", "COUNT_WITHOUT_MASS"]);

// Trimaya Feb-25: filed 120.4 against 1,929.92 of sources.
t("Trimaya Feb-25 · total mismatch",
  { "water.total_reported": 120.4, "water.groundwater": 52, "water.tanker": 1877.92 },
  ["WATER_TOTAL_MISMATCH"]);

// Aurora Aug-24: 110 L over 1.583 h (hours filed in minutes) = ~69 L/h.
t("Aurora Aug-24 · DG L/h too high (minutes filed as hours)",
  { "fuel.diesel_dg": 0.11, "ops.dg_hours": 1.583 },
  ["DG_CONSUMPTION_IMPLAUSIBLE"]);

// Aurora Apr-24: total 1,832 = municipal 975 + ground 857. Clean.
t("Aurora Apr-24 · water total reconciles, no flags",
  { "water.total_reported": 1832, "water.municipal": 975, "water.groundwater": 857 },
  []);

// Tisya Apr-24: 1,824.63 = 1,396 + 428.63. Clean, and its DG is 180 L / 41.5 h
// = 4.3 L/h which is plausible.
t("Tisya Apr-24 · clean month",
  {
    "water.total_reported": 1824.63, "water.groundwater": 1396, "water.tanker": 428.63,
    "fuel.diesel_dg": 0.18, "ops.dg_hours": 41.5,
  },
  []);

// Trimaya Feb-25 reused 7.5 MT of the 7.5 MT generated — equal is fine.
t("Trimaya Feb-25 · reuse equal to generation is allowed",
  { "waste.cnd": 7.5, "waste.cnd_reused": 7.5 },
  []);

t("Recovery exceeding generation is flagged",
  { "waste.plastic": 0.5, "waste.plastic_recycled": 0.9 },
  ["RECOVERY_GT_GENERATION_PLASTIC"]);

t("Negative quantity is an error",
  { "water.municipal": -5 },
  ["NEGATIVE_QUANTITY"]);

// The renewable adjustment is legitimately signed and must not trip it.
t("Renewable adjustment may be negative",
  { "elec.renewable_adjustment": -37510.76 },
  []);

// Aurora Apr-24 tenant 193,428 vs own floors 17,113 = 11.3x — under the 20x bar.
t("Aurora Apr-24 · tenant ratio within tolerance",
  { "elec.tenant": 193428, "elec.own_floor_1": 13991, "elec.own_floor_2": 3122 },
  []);

t("Transposed tenant/own-floor rows are flagged",
  { "elec.tenant": 193428, "elec.own_floor_1": 500, "elec.own_floor_2": 0 },
  ["TENANT_ELEC_DOMINATES"]);

console.log(`\n${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
