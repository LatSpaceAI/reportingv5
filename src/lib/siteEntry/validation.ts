// Data-quality rules for a monthly site return.
//
// These NEVER block a save. The real returns contain values that are physically
// impossible (Aurora's STP outlet exceeds its inlet in four consecutive months)
// and ones that are merely implausible (Sangamwadi's DG at 2.7 L/h over 741
// hours). Refusing those would not produce better data — it would stop the ESG
// team recording what the site actually filed, which is the one thing the
// platform must never lose.
//
// So: store what was filed, raise a flag, and let a human decide. Every rule
// here corresponds to a check the Middle Link reconstruction ran by hand.

import type { DataFlag } from "./types";

/** Canonical values for one site-month, keyed by input_parameter.key. */
export type ParamValues = Record<string, number | null>;

export interface RuleContext {
  values: ParamValues;
  /** Parameters the site explicitly marked not-available. */
  notAvailable: Set<string>;
}

interface Rule {
  code: string;
  severity: DataFlag["severity"];
  /** The parameter the flag hangs off, for the review queue. */
  parameterKey: string | null;
  run: (ctx: RuleContext) => string | null;
}

const has = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

const fmt = (n: number) =>
  Number(n.toFixed(4)).toLocaleString("en-IN", { maximumFractionDigits: 4 });

const RULES: Rule[] = [
  // -------------------------------------------------------------------------
  // Physical impossibility: you cannot recycle more sewage than you generate.
  // Aurora fails this in May, Jun, Jul and Aug 2024.
  // -------------------------------------------------------------------------
  {
    code: "STP_OUTLET_GT_INLET",
    severity: "error",
    parameterKey: "water.stp_outlet",
    run: ({ values }) => {
      const inlet = values["water.stp_inlet"];
      const outlet = values["water.stp_outlet"];
      if (!has(inlet) || !has(outlet)) return null;
      if (outlet <= inlet) return null;
      return `STP outlet (${fmt(outlet)} KL) exceeds inlet (${fmt(
        inlet
      )} KL). Recycled water cannot exceed sewage generated — check the meter readings or the row definitions.`;
    },
  },

  // -------------------------------------------------------------------------
  // The site's own total should equal the sum of the sources it listed.
  // Sangamwadi (filed 0 against 283.2) and Trimaya (filed 120.4 against
  // 1,929.92) both fail this in the source data.
  // -------------------------------------------------------------------------
  {
    code: "WATER_TOTAL_MISMATCH",
    severity: "warning",
    parameterKey: "water.total_reported",
    run: ({ values }) => {
      const reported = values["water.total_reported"];
      if (!has(reported)) return null;
      const sources = [
        "water.municipal",
        "water.groundwater",
        "water.tanker",
        "water.tanker_treated",
        "water.treated_used",
        "water.drinking",
        "water.rainwater",
        "water.surface",
      ];
      const sum = sources.reduce((n, k) => n + (has(values[k]) ? values[k]! : 0), 0);
      // Only meaningful once at least one source was entered.
      if (sum === 0 && reported === 0) return null;
      const diff = Math.abs(sum - reported);
      // A kilolitre of slack absorbs rounding without hiding real breaks.
      if (diff <= 1) return null;
      return `Reported total fresh water (${fmt(
        reported
      )} KL) does not match the sum of the sources entered (${fmt(
        sum
      )} KL). Difference ${fmt(diff)} KL.`;
    },
  },

  // -------------------------------------------------------------------------
  // DG plausibility. A diesel generator burns roughly 3-30 L/h depending on
  // rating and load. Sangamwadi's 2,000 L over 741 h (2.7 L/h) is too low;
  // Aurora's Aug-24 110 L over 1.583 h (~70 L/h) is too high. Both are real.
  // -------------------------------------------------------------------------
  {
    code: "DG_CONSUMPTION_IMPLAUSIBLE",
    severity: "warning",
    parameterKey: "fuel.diesel_dg",
    run: ({ values }) => {
      const kl = values["fuel.diesel_dg"];
      const hours = values["ops.dg_hours"];
      if (!has(kl) || !has(hours) || hours <= 0 || kl <= 0) return null;
      const litresPerHour = (kl * 1000) / hours;
      if (litresPerHour >= 3 && litresPerHour <= 60) return null;
      const direction = litresPerHour < 3 ? "low" : "high";
      return `DG diesel works out to ${fmt(
        litresPerHour
      )} L per running hour (${fmt(kl * 1000)} L over ${fmt(
        hours
      )} h), which is implausibly ${direction}. Typical DG consumption is 3-60 L/h. Check whether the hours were filed in minutes.`;
    },
  },

  // -------------------------------------------------------------------------
  // A count cannot fill a tonnage disclosure. Flagged so the gap is visible at
  // entry rather than discovered when the BRSR line comes out empty.
  // -------------------------------------------------------------------------
  {
    code: "COUNT_WITHOUT_MASS",
    severity: "info",
    parameterKey: "waste.oil_filters_no",
    run: ({ values }) => {
      const filters = values["waste.oil_filters_no"];
      const batteries = values["waste.battery_no"];
      const reported: string[] = [];
      if (has(filters) && filters > 0) reported.push(`${fmt(filters)} oil filters`);
      if (has(batteries) && batteries > 0) reported.push(`${fmt(batteries)} batteries`);
      if (!reported.length) return null;
      return `${reported.join(
        " and "
      )} recorded as a count. The BRSR waste lines are in metric tonnes, so these cannot be disclosed until an average unit weight is supplied.`;
    },
  },

  // -------------------------------------------------------------------------
  // Used oil and coolant are filed in litres against MT-denominated lines.
  // -------------------------------------------------------------------------
  {
    code: "VOLUME_WITHOUT_DENSITY",
    severity: "info",
    parameterKey: "waste.used_oil",
    run: ({ values }) => {
      const oil = values["waste.used_oil"];
      const coolant = values["waste.coolant_oil"];
      const reported: string[] = [];
      if (has(oil) && oil > 0) reported.push(`${fmt(oil)} L used oil`);
      if (has(coolant) && coolant > 0) reported.push(`${fmt(coolant)} L coolant`);
      if (!reported.length) return null;
      return `${reported.join(
        " and "
      )} recorded in litres. The BRSR waste lines are in metric tonnes, so a density is needed before these can be disclosed.`;
    },
  },

  // -------------------------------------------------------------------------
  // Recovery cannot exceed generation, per category.
  // -------------------------------------------------------------------------
  ...(
    [
      ["waste.cnd", "waste.cnd_reused", "C&D waste"],
      ["waste.plastic", "waste.plastic_recycled", "Plastic waste"],
      ["waste.municipal", "waste.municipal_recycled", "Municipal waste"],
      ["waste.food", "waste.food_recycled", "Food waste"],
    ] as const
  ).map(([genKey, recKey, label]): Rule => ({
    code: `RECOVERY_GT_GENERATION_${genKey.split(".")[1].toUpperCase()}`,
    severity: "warning",
    parameterKey: recKey,
    run: ({ values }) => {
      const gen = values[genKey];
      const rec = values[recKey];
      if (!has(gen) || !has(rec)) return null;
      if (rec <= gen + 1e-9) return null;
      return `${label} recovered (${fmt(rec)} MT) exceeds the quantity generated (${fmt(
        gen
      )} MT).`;
    },
  })),

  // -------------------------------------------------------------------------
  // Aurora's tenant electricity is excluded from the entity boundary, so a
  // month where it dwarfs the reported own-floor draw is worth a look — it
  // usually means the floors were entered in the tenant row or vice versa.
  // -------------------------------------------------------------------------
  {
    code: "TENANT_ELEC_DOMINATES",
    severity: "info",
    parameterKey: "elec.tenant",
    run: ({ values }) => {
      const tenant = values["elec.tenant"];
      const f1 = values["elec.own_floor_1"];
      const f2 = values["elec.own_floor_2"];
      if (!has(tenant) || tenant <= 0) return null;
      const own = (has(f1) ? f1 : 0) + (has(f2) ? f2 : 0);
      if (own <= 0) return null;
      if (tenant / own < 20) return null;
      return `Tenant electricity (${fmt(
        tenant
      )} kWh) is more than 20x the own-floor consumption (${fmt(
        own
      )} kWh). Tenant load is excluded from the reporting boundary — confirm the rows were not transposed.`;
    },
  },

  // -------------------------------------------------------------------------
  // Negative quantities are never meaningful on these forms. The one legitimate
  // signed field is the renewable adjustment, which is excluded here.
  // -------------------------------------------------------------------------
  {
    code: "NEGATIVE_QUANTITY",
    severity: "error",
    parameterKey: null,
    run: ({ values }) => {
      const negatives = Object.entries(values)
        .filter(([k, v]) => k !== "elec.renewable_adjustment" && has(v) && v < 0)
        .map(([k]) => k);
      if (!negatives.length) return null;
      return `Negative values entered for: ${negatives.join(", ")}.`;
    },
  },
];

/** Run every rule over one site-month. Returns the flags that fired. */
export function runValidations(ctx: RuleContext): DataFlag[] {
  const flags: DataFlag[] = [];
  for (const rule of RULES) {
    let message: string | null = null;
    try {
      message = rule.run(ctx);
    } catch {
      // A rule must never break a save. Skip it and carry on.
      continue;
    }
    if (message) {
      flags.push({
        parameterKey: rule.parameterKey,
        ruleCode: rule.code,
        severity: rule.severity,
        message,
      });
    }
  }
  return flags;
}

export const ruleCodes = RULES.map((r) => r.code);
