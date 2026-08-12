#!/usr/bin/env node
// =============================================================================
// BIRLA ESTATES — SCOPE 3 resolver
//
// Reads esg.s3_line (the nine ledgers), resolves each line's factor through
// esg.s3_mapping, computes per-line emissions in plain JavaScript, and writes
// eleven category totals into esg.output_value as ordinary rows.
//
// WHY THIS IS A SEPARATE PASS AND NOT PART OF resolve-birla.mjs
//
//   resolve-birla.mjs evaluates a DAG of SCALAR formulas: every token binds to
//   one number, per site x month. Every Scope 3 category is a set operation —
//   sum over ledger lines where tag = X — which that grammar cannot express and
//   should not be taught to. See scripts/lib/scope3-methods.mjs.
//
//   The two passes never interact. resolve-birla.mjs does not know ledgers
//   exist; this script does not touch a formula. They meet only in output_value,
//   where a Scope 3 category total looks exactly like any other computed figure
//   — which is what makes the exporter, the dashboard and the BRSR export pick
//   them up with no change at all.
//
// WHAT GRAIN THIS WRITES AT, AND WHY
//
//   (GROUP, YTD) only. The workbook is annual and company-wide, and four of the
//   nine ledgers carry no site while three carry no month. Writing per-site
//   rows would mean either inventing an attribution nobody reported, or
//   publishing categories at inconsistent grains that cannot be summed
//   together. The per-LINE results still carry whatever site and period were
//   filed, on s3_line, so a breakdown is a query rather than a re-derivation.
//
//   LEDGER_GRAIN below is the single place that decision lives.
//
// WHAT IT REFUSES TO DO
//
//   Write a category it could not compute. A zero is a claim about the world:
//   "no employee commuted" is a different statement from "nobody was surveyed".
//   Where a category cannot be computed, no row is written and the run reports
//   it — the same principle as a site-month with no return in resolve-birla.mjs.
//
// Usage:
//   node scripts/resolve-scope3.mjs --fy 2025-26          # one fiscal year
//   node scripts/resolve-scope3.mjs --fy 2025-26 --dry-run
//   node scripts/resolve-scope3.mjs                       # every FY with lines
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
// =============================================================================

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

import {
  makeFactorLookup,
  computeSpendLine,
  computeMaterialLine,
  computeFreightLine,
  computeCat3,
  computeWasteLine,
  computeTravelLine,
  computeCommuteLine,
  grossUpCommute,
  computeSoldProductLine,
  computeCat13,
  checkDoubleCounting,
  EXCLUSION,
} from "./lib/scope3-methods.mjs";

// ---- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY_RUN = has("--dry-run");
const ONLY_FY = valueOf("--fy");
const VERBOSE = has("--verbose");

// -----------------------------------------------------------------------------
// The grain each ledger's results are attributed at.
//
// Declared rather than hardcoded so that adding per-site or per-month output
// for the three ledgers that could support it (energy_fuel, waste,
// leased_assets) is a change here, not a rewrite of the writer.
// -----------------------------------------------------------------------------
const OUTPUT_GRAIN = "group_ytd";

// ---- env --------------------------------------------------------------------
async function loadEnv() {
  const txt = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

let sb;
async function initClient() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  sb = createClient(url, key, {
    db: { schema: "esg" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Page through PostgREST's 1000-row default cap. */
async function selectAll(table, columns, apply) {
  const pageSize = 1000;
  let from = 0;
  const out = [];
  for (;;) {
    let qb = sb.from(table).select(columns).range(from, from + pageSize - 1);
    if (apply) qb = apply(qb);
    const { data, error } = await qb;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function upsertChunks(table, rows, onConflict) {
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + chunk), { onConflict });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
}

const round4 = (n) => Math.round(n * 1e4) / 1e4;
const fmt = (n) =>
  n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

let currentRunId = null;

async function startResolverRun(fy) {
  const { data, error } = await sb
    .from("resolver_run")
    .insert({
      trigger_source: "cli",
      fiscal_year: fy ?? null,
      status: "running",
      dry_run: false,
      triggered_by: "cli:scope3",
    })
    .select("id")
    .single();
  if (error) {
    console.warn(`  ! could not record resolver_run: ${error.message}`);
    return null;
  }
  return data.id;
}

async function finishResolverRun(runId, status, extra = {}) {
  if (runId == null) return;
  const { error } = await sb
    .from("resolver_run")
    .update({ status, finished_at: new Date().toISOString(), ...extra })
    .eq("id", runId);
  if (error) console.warn(`  ! could not close resolver_run: ${error.message}`);
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  await initClient();

  const runAt = new Date().toISOString();
  const runId = DRY_RUN ? null : await startResolverRun(ONLY_FY);
  currentRunId = runId;

  console.log("Loading Scope 3 model…");
  const [sites, periods, constants, mappings, outputParams, ledgers] = await Promise.all([
    selectAll("site", "id, code, name, is_group"),
    selectAll("period", "id, fiscal_year, period_kind, month_no, month_label"),
    selectAll("constant", "key, value, label, is_assumption, category"),
    selectAll("s3_mapping", "block, lookup_key, factor_key, factor_key_2, is_active"),
    selectAll("output_parameter", "id, key, domain, scope, frequency"),
    selectAll("s3_ledger", "code, label, has_site, has_period, sort_order"),
  ]);

  const groupSite = sites.find((s) => s.is_group);
  if (!groupSite) throw new Error("No GROUP site found — check 03_dimensions_seed.sql");

  const outputIdByKey = new Map(outputParams.map((p) => [p.key, p.id]));
  const lookup = makeFactorLookup({ mappings, constants });
  const constByKey = new Map(constants.map((c) => [c.key, Number(c.value)]));

  // ---------------------------------------------------------------------------
  // The CONTROL-sheet assumptions.
  //
  // Hard failure on a missing one. Every one of these SCALES a category — the FX
  // rate divides all of Cat 1 and 2, the deflator does too, the circuity factor
  // multiplies every freight leg. Defaulting a missing constant to 1 would
  // produce a plausible number that is wrong by exactly that factor, with no
  // symptom anywhere.
  // ---------------------------------------------------------------------------
  const CONTROL_KEYS = [
    "s3.fx_inr_per_eur",
    "s3.price_deflator",
    "s3.circuity_road",
    "s3.headcount",
  ];
  const missingControl = CONTROL_KEYS.filter((k) => !constByKey.has(k));
  if (missingControl.length) {
    throw new Error(
      `Missing CONTROL constants: ${missingControl.join(", ")}\n` +
        "  Apply supabase/esg/14_scope3_constants.sql. These scale whole categories; " +
        "the resolver will not substitute defaults for them."
    );
  }
  const ctl = {
    fxInrPerEur: constByKey.get("s3.fx_inr_per_eur"),
    deflator: constByKey.get("s3.price_deflator"),
    defaultCircuity: constByKey.get("s3.circuity_road"),
    headcount: constByKey.get("s3.headcount"),
  };
  if (!(ctl.fxInrPerEur > 0) || !(ctl.deflator > 0)) {
    throw new Error(
      `FX rate (${ctl.fxInrPerEur}) and deflator (${ctl.deflator}) must both be > 0 — ` +
        "they are divisors on every spend line."
    );
  }

  // EF-MAT-SUPPLIER-EPD carries no register value by design (the factor is
  // per line, from the supplier's EPD). Asserted so that if someone ever
  // "fixes" the seed by giving it a real number, this says so loudly rather
  // than silently applying one supplier's factor to every EPD line.
  const epdRegisterValue = constByKey.get("EF-MAT-SUPPLIER-EPD");
  if (epdRegisterValue) {
    console.warn(
      `  ! EF-MAT-SUPPLIER-EPD has a register value of ${epdRegisterValue}. It is a ` +
        "per-line factor and this resolver never reads it — the register value is ignored."
    );
  }

  // ---------------------------------------------------------------------------
  // Ledger lines
  // ---------------------------------------------------------------------------
  const allLines = await selectAll(
    "s3_line",
    "id, ledger, fiscal_year, site_id, period_id, line_no, attrs, superseded_at",
    (qb) => (ONLY_FY ? qb.eq("fiscal_year", ONLY_FY) : qb)
  );
  const live = allLines.filter((l) => l.superseded_at == null);

  const fiscalYears = [...new Set(live.map((l) => l.fiscal_year))].sort();
  if (!fiscalYears.length) {
    console.log(
      ONLY_FY
        ? `No Scope 3 ledger lines for FY ${ONLY_FY}. Nothing to compute.`
        : "No Scope 3 ledger lines in esg.s3_line. Nothing to compute."
    );
    await finishResolverRun(runId, "succeeded", { rows_written: 0 });
    return;
  }

  console.log(
    `${live.length} live ledger lines across ${fiscalYears.length} fiscal year(s): ${fiscalYears.join(", ")}`
  );
  void ledgers;
  void OUTPUT_GRAIN;

  const outRows = [];
  const lineUpdates = [];
  const reports = [];

  for (const fy of fiscalYears) {
    const ytd = periods.find((p) => p.fiscal_year === fy && p.period_kind === "ytd");
    if (!ytd) {
      console.warn(`  ! No YTD period for FY ${fy} — skipping. Seed it in 03_dimensions_seed.sql.`);
      continue;
    }
    const fyLines = live.filter((l) => l.fiscal_year === fy);
    const byLedger = (code) => fyLines.filter((l) => l.ledger === code);

    const totals = new Map();      // output key -> tCO2e
    const add = (key, t) => totals.set(key, (totals.get(key) ?? 0) + t);
    const issues = [];

    /** Record a per-line result back onto s3_line for the audit trail. */
    const stamp = (line, r, extra = {}) => {
      lineUpdates.push({
        id: line.id,
        factor_key: r.factor_key ?? null,
        factor_value: r.factor_value ?? null,
        factor_key_2: r.factor_key_2 ?? null,
        factor_value_2: r.factor_value_2 ?? null,
        quantity: r.quantity ?? null,
        quantity_unit: r.quantity_unit ?? null,
        emissions_t: r.emissions_t == null ? null : round4(r.emissions_t),
        emissions_t_2: r.emissions_t_2 == null ? null : round4(r.emissions_t_2),
        category: r.category ?? null,
        exclusion_reason: r.exclusion_reason ?? null,
        ...extra,
      });
    };

    // ---- Cat 1 spend + Cat 2 ------------------------------------------------
    const procurement = byLedger("procurement");
    const procResults = [];
    for (const line of procurement) {
      const r = computeSpendLine(line, { ...ctl, lookup });
      procResults.push({ ...r, line_no: line.line_no, attrs: line.attrs });
      stamp(line, r);
      if (r.category === "cat1_spend" || r.category === "cat2_capital") {
        add(r.category === "cat1_spend" ? "s3.cat1_spend" : "s3.cat2_capital", r.emissions_t);
      }
    }

    // ---- Cat 1 materials + Cat 4 material freight ---------------------------
    const materials = byLedger("materials");
    for (const line of materials) {
      const r = computeMaterialLine(line, { ...ctl, lookup });
      stamp(line, r);
      add("s3.cat1_materials", r.emissions_t ?? 0);
      add("s3.cat4_materials", r.emissions_t_2 ?? 0);
    }

    // ---- Cat 4 inbound freight ----------------------------------------------
    for (const line of byLedger("inbound_freight")) {
      const r = computeFreightLine(line, { ...ctl, lookup });
      stamp(line, r);
      add("s3.cat4_freight", r.emissions_t ?? 0);
    }

    // ---- Cat 3 (aggregate) ---------------------------------------------------
    const energyLines = byLedger("energy_fuel");
    let cat3 = null;
    if (energyLines.length) {
      cat3 = computeCat3({ lines: energyLines, lookup });
      add("s3.cat3_fera", cat3.total_t);
      for (const d of cat3.detail) {
        if (d.exclusion_reason) {
          issues.push(`Cat 3 ${d.component}: ${d.exclusion_reason} (factor ${d.factor_key})`);
        }
      }
      // The energy ledger's lines are inputs to an aggregate, not per-line
      // emitters. Stamped with the quantity they contributed so the drill-down
      // still shows what each site-month put into the category.
      for (const line of energyLines) {
        lineUpdates.push({
          id: line.id,
          category: "cat3_fera",
          quantity_unit: "aggregated",
          emissions_t: null,
          exclusion_reason: null,
        });
      }
    }

    // ---- Cat 5 waste ---------------------------------------------------------
    for (const line of byLedger("waste")) {
      const r = computeWasteLine(line, { lookup });
      stamp(line, r);
      add("s3.cat5_waste", r.emissions_t ?? 0);
      if (r.exclusion_reason === EXCLUSION.UNMAPPED_FACTOR) {
        issues.push(`Cat 5 line ${line.line_no}: no factor for '${r.lookup_key}'`);
      }
    }

    // ---- Cat 6 travel --------------------------------------------------------
    for (const line of byLedger("business_travel")) {
      const r = computeTravelLine(line, { lookup });
      stamp(line, r);
      add("s3.cat6_travel", r.emissions_t ?? 0);
    }

    // ---- Cat 7 commute -------------------------------------------------------
    const commuteLines = byLedger("commute");
    let commute = null;
    if (commuteLines.length) {
      const wfhFactor = constByKey.has("EF-CMT-WFH") ? constByKey.get("EF-CMT-WFH") : null;
      let surveyedCommuteT = 0;
      let surveyedWfhT = 0;
      let respondents = 0;
      for (const line of commuteLines) {
        const r = computeCommuteLine(line, { lookup, wfhFactor });
        stamp(line, r);
        surveyedCommuteT += r.emissions_t ?? 0;
        surveyedWfhT += r.emissions_t_2 ?? 0;
        respondents += r.respondents ?? 0;
      }
      commute = grossUpCommute({
        surveyedCommuteT,
        surveyedWfhT,
        respondents,
        headcount: ctl.headcount,
      });
      if (commute.total_t === null) {
        // No row written. "Nobody was surveyed" is not "nobody commuted".
        issues.push(
          "Cat 7: survey has zero respondents — category NOT written (a zero here would be a false claim)"
        );
      } else {
        add("s3.cat7_commute", commute.total_t);
        if (commute.factor < 1) {
          issues.push(
            `Cat 7: gross-up factor ${commute.factor.toFixed(3)} is below 1 — the survey covered more ` +
              `people (${commute.respondents}) than the headcount (${commute.headcount}). One of the two is wrong.`
          );
        }
      }
    }

    // ---- Cat 11 sold products ------------------------------------------------
    for (const line of byLedger("sold_products")) {
      const r = computeSoldProductLine(line, { lookup });
      stamp(line, r);
      add("s3.cat11_sold", r.emissions_t ?? 0);
      if (r.exclusion_reason === EXCLUSION.MISSING_LIFETIME) {
        issues.push(
          `Cat 11 line ${line.line_no}: no expected lifetime — excluded. Defaulting to 1 year would ` +
            "understate the category by roughly the lifetime multiple."
        );
      }
    }

    // ---- Cat 13 leased assets (aggregate) ------------------------------------
    const leased = byLedger("leased_assets");
    let cat13 = null;
    if (leased.length) {
      cat13 = computeCat13({ lines: leased, lookup });
      add("s3.cat13_leased", cat13.total_t);
      for (const d of cat13.detail) {
        if (d.exclusion_reason) {
          issues.push(`Cat 13 ${d.component}: ${d.exclusion_reason} (factor ${d.factor_key})`);
        }
      }
      for (const line of leased) {
        lineUpdates.push({
          id: line.id,
          category: "cat13_leased",
          quantity_unit: "aggregated",
          emissions_t: null,
          exclusion_reason: null,
        });
      }
    }

    // ---- The double-counting guard -------------------------------------------
    const dc = checkDoubleCounting({ procurementResults: procResults, materialLines: materials });
    if (dc.untagged_count > 0) {
      issues.push(
        `DOUBLE-COUNTING GUARD: ${dc.untagged_count} procurement line(s) carry no Scope 3 tag ` +
          `(lines ${dc.untagged_lines.slice(0, 10).join(", ")}${dc.untagged_lines.length > 10 ? "…" : ""}). ` +
          "An untagged line is silently excluded — the total is understated by an unknown amount."
      );
    }
    if (dc.suspect_count > 0) {
      issues.push(
        `DOUBLE-COUNTING GUARD: ${dc.suspect_count} supplier(s) appear on both the procurement and ` +
          "materials ledgers without an EXCLUDE tag. Verify each is not counted twice."
      );
    }

    // ---- Total ----------------------------------------------------------------
    const CATEGORY_KEYS = [
      "s3.cat1_spend", "s3.cat1_materials", "s3.cat2_capital", "s3.cat3_fera",
      "s3.cat4_freight", "s3.cat4_materials", "s3.cat5_waste", "s3.cat6_travel",
      "s3.cat7_commute", "s3.cat11_sold", "s3.cat13_leased",
    ];
    const total = CATEGORY_KEYS.reduce((t, k) => t + (totals.get(k) ?? 0), 0);
    totals.set("s3.total", total);

    // ---- Scope 1 + 2 + 3, and the share --------------------------------------
    //
    // ghg.total means Scope 1 + 2 and keeps meaning that. The all-scopes figure
    // is a NEW key. Read from output_value rather than recomputed, so the two
    // resolvers cannot disagree about what Scope 1 + 2 was.
    const ghgTotalId = outputIdByKey.get("ghg.total");
    let scope12 = null;
    if (ghgTotalId) {
      const { data } = await sb
        .from("output_value")
        .select("value_num")
        .eq("site_id", groupSite.id)
        .eq("period_id", ytd.id)
        .eq("parameter_id", ghgTotalId)
        .maybeSingle();
      if (data?.value_num != null) scope12 = Number(data.value_num);
    }
    if (scope12 !== null) {
      totals.set("ghg.total_all_scopes", scope12 + total);
      const denom = scope12 + total;
      if (denom > 0) totals.set("s3.share_of_footprint", total / denom);
      // The workbook's VALIDATION check 13: for a developer, Scope 3 should
      // dominate. A check, not a target.
      if (total <= scope12) {
        issues.push(
          `Scope 3 (${fmt(total)} tCO2e) does not exceed Scope 1+2 (${fmt(scope12)} tCO2e). ` +
            "For a real-estate developer this normally means a category is missing or understated."
        );
      }
    } else {
      issues.push(
        "ghg.total not found for (GROUP, YTD) — ghg.total_all_scopes and the Scope 3 share " +
          "were NOT written. Run npm run esg:resolve first."
      );
    }

    // ---- Factor confirmation status -------------------------------------------
    //
    // The workbook's VALIDATION check 1, and the reason the settings page
    // exists. Reported every run: a Scope 3 figure computed on indicative
    // factors is a test fixture, not a disclosure.
    const s3FactorKeys = new Set(
      mappings.filter((m) => m.factor_key !== "__via_spend__").flatMap((m) => [m.factor_key, m.factor_key_2]).filter(Boolean)
    );
    for (const k of ["EF-ELEC-CEA-COMB", "EF-ELEC-TD-LOSS", "EF-ELEC-UPSTREAM", "EF-DSL-WTT", "EF-PET-WTT", "EF-DSL-COMB", "EF-CMT-WFH"]) {
      s3FactorKeys.add(k);
    }
    const indicative = constants.filter((c) => s3FactorKeys.has(c.key) && c.is_assumption);

    // ---- Rows -----------------------------------------------------------------
    //
    // Coverage: a Scope 3 category is a company-wide figure computed from
    // ledgers, not a rollup of site returns. sites_reporting/expected would be
    // meaningless here, so both are left null rather than filled with a number
    // that invites a false reading.
    for (const [key, value] of totals) {
      const pid = outputIdByKey.get(key);
      if (pid == null) {
        issues.push(`No output_parameter for '${key}' — apply 15_scope3_outputs.sql`);
        continue;
      }
      outRows.push({
        site_id: groupSite.id,
        period_id: ytd.id,
        parameter_id: pid,
        value_num: round4(value),
        formula_id: null,
        sites_reporting: null,
        sites_expected: null,
        computed_at: runAt,
      });
    }

    reports.push({ fy, totals, issues, cat3, cat13, commute, dc, indicative, scope12, ytd });
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------
  console.log(`\nComputed ${outRows.length} output rows and ${lineUpdates.length} line results.`);

  if (DRY_RUN) {
    console.log("--dry-run: nothing written.\n");
  } else {
    console.log("Writing…");
    await upsertChunks("output_value", outRows, "site_id,period_id,parameter_id");
    // Per-line results, so a disclosure traces back to the purchase order that
    // produced it — the question an assurer actually asks.
    const chunk = 200;
    for (let i = 0; i < lineUpdates.length; i += chunk) {
      for (const u of lineUpdates.slice(i, i + chunk)) {
        const { id, ...fields } = u;
        const { error } = await sb.from("s3_line").update(fields).eq("id", id);
        if (error) throw new Error(`s3_line update ${id}: ${error.message}`);
      }
    }
    await finishResolverRun(runId, "succeeded", { rows_written: outRows.length });
    console.log("Written.\n");
  }

  report(reports);
}

// =============================================================================
// Post-run report
// =============================================================================
function report(reports) {
  for (const r of reports) {
    console.log(`Scope 3 — FY ${r.fy}`);
    console.log("=".repeat(72));
    const LINES = [
      ["Cat 1  Purchased goods and services (spend)", "s3.cat1_spend"],
      ["Cat 1  Building materials (embodied)", "s3.cat1_materials"],
      ["Cat 2  Capital goods", "s3.cat2_capital"],
      ["Cat 3  Fuel and energy related", "s3.cat3_fera"],
      ["Cat 4  Transport of purchased goods", "s3.cat4_freight"],
      ["Cat 4  Transport of building materials", "s3.cat4_materials"],
      ["Cat 5  Waste generated in operations", "s3.cat5_waste"],
      ["Cat 6  Business travel", "s3.cat6_travel"],
      ["Cat 7  Employee commuting", "s3.cat7_commute"],
      ["Cat 11 Use of sold products", "s3.cat11_sold"],
      ["Cat 13 Downstream leased assets", "s3.cat13_leased"],
    ];
    const total = r.totals.get("s3.total") ?? 0;
    for (const [label, key] of LINES) {
      const v = r.totals.get(key);
      const share = total > 0 && v != null ? ((v / total) * 100).toFixed(1) + "%" : "—";
      console.log(`  ${label.padEnd(44)} ${fmt(v).padStart(14)} tCO2e ${share.padStart(7)}`);
    }
    console.log("  " + "-".repeat(70));
    console.log(`  ${"TOTAL SCOPE 3".padEnd(44)} ${fmt(total).padStart(14)} tCO2e`);
    if (r.scope12 != null) {
      console.log(`  ${"Scope 1 + 2 (from ghg.total)".padEnd(44)} ${fmt(r.scope12).padStart(14)} tCO2e`);
      const share = r.totals.get("s3.share_of_footprint");
      if (share != null) {
        console.log(`  ${"Scope 3 share of footprint".padEnd(44)} ${(share * 100).toFixed(1).padStart(14)} %`);
      }
    }

    if (r.cat3) {
      const b = r.cat3.basis;
      console.log("\n  Cat 3 basis");
      console.log(`    grid ${fmt(b.grid_kwh)} + open access ${fmt(b.open_access_kwh)} = ${fmt(b.td_basis_kwh)} kWh`);
      console.log(`    onsite renewable ${fmt(b.onsite_kwh)} kWh EXCLUDED from the basis (behind the meter)`);
      console.log(
        `    T&D loss ${b.td_loss_share == null ? "—" : (b.td_loss_share * 100).toFixed(1) + "%"}` +
          ` grossed up as L/(1-L) -> ${fmt(b.td_loss_kwh)} kWh`
      );
    }
    if (r.commute?.total_t != null) {
      console.log(
        `\n  Cat 7 gross-up: ${fmt(r.commute.surveyed_t)} tCO2e surveyed x ` +
          `${r.commute.headcount}/${r.commute.respondents} = ${r.commute.factor.toFixed(3)}`
      );
    }

    if (r.indicative.length) {
      console.log(
        `\n  ⚠ ${r.indicative.length} of the factors these figures rest on are still marked as ` +
          "assumptions (INDICATIVE in the workbook)."
      );
      console.log(
        "    Until each is confirmed against its cited source, this is a test fixture, not a disclosure."
      );
      console.log("    Confirm them at /settings/constants — every change records a reason.");
    }

    if (r.issues.length) {
      console.log(`\n  ${r.issues.length} issue(s) to resolve before sign-off:`);
      for (const i of r.issues) console.log(`    • ${i}`);
    } else {
      console.log("\n  No structural issues found.");
    }
    console.log();
  }
}

main().catch(async (e) => {
  await finishResolverRun(currentRunId, "failed", { error_message: String(e?.message ?? e) });
  console.error(e);
  process.exit(1);
});
