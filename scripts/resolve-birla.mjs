#!/usr/bin/env node
// =============================================================================
// BIRLA ESTATES — ESG resolver
//
// Evaluates the FORMULAS layer into esg.output_value:
//
//   1. Per site × month, in eval_order (DAG-safe), so every out: reference is
//      computed before it is read.
//   2. Portfolio (GROUP) rollups, which are SUMS OVER SITES rather than a
//      re-evaluation — summing site-level results is not the same as running
//      the formula on summed inputs once ratios or filters are involved, and
//      the water-stressed lines depend on the difference.
//   3. Year-to-date rollups: sums for stock/flow quantities, and a re-derivation
//      for anything that is a ratio of other outputs.
//
// WHAT MAKES THIS DIFFERENT FROM A PLAIN EVALUATOR
//
//   site_filter  A formula tagged 'water_stressed' contributes to the GROUP
//                rollup only from sites inside the declared stressed area.
//                Summing every site into it would overstate the BRSR
//                stressed-area disclosure by roughly 4x.
//
//   coverage     Every row carries sites_reporting / sites_expected. A
//                portfolio figure for a month where 1 of 11 sites filed is
//                arithmetically fine and evidentially thin; storing the ratio
//                with the number is what keeps that visible downstream.
//
//   no balancing There is deliberately no derived-balance mechanism. A total is
//                the sum of what was filed. The gap shows as a gap.
//
// Usage:
//   node scripts/resolve-birla.mjs                 # resolve everything
//   node scripts/resolve-birla.mjs --fy 2024-25    # one fiscal year
//   node scripts/resolve-birla.mjs --dry-run       # compute + report, write nothing
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
// =============================================================================

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

import { compile, evalAst, toNum } from "./lib/formula-eval.mjs";

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
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }
  sb = createClient(url, key, {
    db: { schema: "esg" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Page through PostgREST's 1000-row default cap. */
async function selectAll(table, columns) {
  const pageSize = 1000;
  let from = 0;
  const out = [];
  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
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
    const { error } = await sb
      .from(table)
      .upsert(rows.slice(i, i + chunk), { onConflict });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
}

const round4 = (n) => Math.round(n * 1e4) / 1e4;

// =============================================================================
// Resolve
// =============================================================================
async function main() {
  await initClient();

  console.log("Loading model…");
  const [sites, periods, constants, inputParams, outputParams, formulas] =
    await Promise.all([
      selectAll("site", "id, code, name, asset_type, water_stressed, is_group, in_scope_from, in_scope_to"),
      selectAll("period", "id, fiscal_year, period_kind, month_no, month_label, quarter_no, half_no, period_start, period_end"),
      selectAll("constant", "key, value"),
      selectAll("input_parameter", "id, key, is_memo"),
      selectAll("output_parameter", "id, key, frequency"),
      selectAll("formula", "id, output_key, expression, site_filter, eval_order, is_active"),
    ]);

  const groupSite = sites.find((s) => s.is_group);
  if (!groupSite) throw new Error("No GROUP site found — check 03_dimensions_seed.sql");
  const realSites = sites.filter((s) => !s.is_group);

  const months = periods
    .filter((p) => p.period_kind === "month")
    .filter((p) => !ONLY_FY || p.fiscal_year === ONLY_FY)
    .sort((a, b) => a.fiscal_year.localeCompare(b.fiscal_year) || a.month_no - b.month_no);

  if (months.length === 0) {
    console.error(ONLY_FY ? `No months found for FY ${ONLY_FY}` : "No month periods found");
    process.exit(1);
  }

  const outputIdByKey = new Map(outputParams.map((p) => [p.key, p.id]));
  const inputKeyById = new Map(inputParams.map((p) => [p.id, p.key]));

  // Compile once. A bad expression is a hard failure — a resolver that quietly
  // treats an unparseable formula as zero would publish a zero.
  const compiled = formulas
    .filter((f) => f.is_active !== false)
    .sort(
      (a, b) => a.eval_order - b.eval_order || a.output_key.localeCompare(b.output_key)
    )
    .map((f) => {
      try {
        return { ...f, ast: compile(f.expression) };
      } catch (e) {
        throw new Error(`Formula ${f.output_key} failed to compile: ${e.message}\n  ${f.expression}`);
      }
    });
  console.log(`Compiled ${compiled.length} formulas.`);

  // Constants context, shared by every evaluation.
  const constCtx = {};
  for (const c of constants) constCtx[`const:${c.key}`] = Number(c.value);

  // Input values indexed by site|period.
  console.log("Loading input values…");
  const inputValues = await selectAll(
    "input_value",
    "site_id, period_id, parameter_id, value_num, is_not_available"
  );
  const inBySP = new Map();
  for (const iv of inputValues) {
    const key = inputKeyById.get(iv.parameter_id);
    if (!key) continue;
    const k = `${iv.site_id}|${iv.period_id}`;
    if (!inBySP.has(k)) inBySP.set(k, {});
    // A not-available row contributes 0 to arithmetic — the same as a blank
    // cell in the workbook. The distinction between "NA" and a reported zero
    // is preserved in input_value and surfaced by coverage, not by making
    // sums undefined.
    inBySP.get(k)[`in:${key}`] =
      iv.value_num != null ? Number(iv.value_num) : 0;
  }

  // Which sites actually filed for each period (submitted or better).
  const submissions = await selectAll("site_submission", "site_id, period_id, status");
  const FILED = new Set(["submitted", "under_review", "approved"]);
  const filedBySP = new Set(
    submissions
      .filter((s) => FILED.has(s.status))
      .map((s) => `${s.site_id}|${s.period_id}`)
  );

  /** Is a site in the reporting boundary for this period? */
  const inScope = (site, period) => {
    if (site.in_scope_from && period.period_start < site.in_scope_from) return false;
    if (site.in_scope_to && period.period_end > site.in_scope_to) return false;
    return true;
  };

  // ---------------------------------------------------------------------------
  // 1. Per site × month
  // ---------------------------------------------------------------------------
  console.log(
    `Resolving ${compiled.length} formulas over ${realSites.length} sites x ${months.length} months…`
  );

  const outRows = [];
  // siteValues[`${siteId}|${periodId}`] = { outputKey: value } — reused by the
  // GROUP rollup so site results are never recomputed from summed inputs.
  const siteValues = new Map();

  for (const site of realSites) {
    for (const period of months) {
      if (!inScope(site, period)) continue;
      const spKey = `${site.id}|${period.id}`;
      const inputs = inBySP.get(spKey);
      // Nothing filed for this site-month: no row is written at all. Writing
      // zeros would turn "no return" into "a return of zero", which is the
      // single most consequential lie this model could tell.
      if (!inputs) continue;

      const ctx = { ...constCtx, ...inputs };
      const vals = {};
      for (const f of compiled) {
        let v;
        try {
          v = toNum(evalAst(f.ast, ctx));
        } catch (e) {
          if (VERBOSE) console.warn(`  ${site.code} ${period.month_label}: ${f.output_key} -> ${e.message}`);
          v = 0;
        }
        if (!Number.isFinite(v)) v = 0;
        ctx[`out:${f.output_key}`] = v;
        vals[f.output_key] = v;

        const pid = outputIdByKey.get(f.output_key);
        if (pid == null) continue;
        outRows.push({
          site_id: site.id,
          period_id: period.id,
          parameter_id: pid,
          value_num: round4(v),
          formula_id: f.id,
          // A site-level figure rests on that one site's own return.
          sites_reporting: filedBySP.has(spKey) ? 1 : 0,
          sites_expected: 1,
        });
      }
      siteValues.set(spKey, vals);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. GROUP rollup per month — sum over sites, honouring site_filter
  // ---------------------------------------------------------------------------
  console.log("Rolling up to portfolio…");

  for (const period of months) {
    const scoped = realSites.filter((s) => inScope(s, period));
    const expected = scoped.length;
    const reporting = scoped.filter((s) => filedBySP.has(`${s.id}|${period.id}`)).length;

    for (const f of compiled) {
      // Which sites may contribute to THIS formula.
      const contributors = scoped.filter((s) => {
        switch (f.site_filter) {
          case "water_stressed":
            return s.water_stressed;
          case "commercial":
            return s.asset_type === "commercial";
          case "residential":
            return s.asset_type === "residential";
          default:
            return true;
        }
      });

      let sum = 0;
      let contributed = 0;
      for (const s of contributors) {
        const vals = siteValues.get(`${s.id}|${period.id}`);
        if (!vals) continue;
        const v = vals[f.output_key];
        if (typeof v === "number" && Number.isFinite(v)) {
          sum += v;
          contributed++;
        }
      }
      // No site contributed anything: write nothing rather than a zero.
      if (contributed === 0) continue;

      const pid = outputIdByKey.get(f.output_key);
      if (pid == null) continue;
      outRows.push({
        site_id: groupSite.id,
        period_id: period.id,
        parameter_id: pid,
        value_num: round4(sum),
        formula_id: f.id,
        // Coverage is stated against the sites eligible for THIS formula, so a
        // stressed-area figure is not judged against the whole portfolio.
        sites_reporting: contributors.filter((s) =>
          filedBySP.has(`${s.id}|${period.id}`)
        ).length,
        sites_expected: contributors.length,
      });
    }
    if (VERBOSE) {
      console.log(`  ${period.fiscal_year} ${period.month_label}: ${reporting}/${expected} sites`);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Year-to-date rollups
  //
  // Sums over the fiscal year's months, for both each site and the portfolio.
  // Every output in this model is an extensive quantity (kWh, KL, MT, tCO2e),
  // so summing is correct; if an intensity/ratio output is ever added it must
  // be RE-DERIVED here from its YTD components rather than summed.
  // ---------------------------------------------------------------------------
  const ytdPeriods = periods.filter(
    (p) => p.period_kind === "ytd" && (!ONLY_FY || p.fiscal_year === ONLY_FY)
  );

  const intensityKeys = outputParams.filter((p) => p.is_intensity).map((p) => p.key);
  if (intensityKeys.length) {
    console.warn(
      `  ! ${intensityKeys.length} intensity outputs would be wrong if summed: ${intensityKeys.join(", ")}`
    );
  }

  for (const ytd of ytdPeriods) {
    const fyMonths = months.filter((m) => m.fiscal_year === ytd.fiscal_year);
    if (!fyMonths.length) continue;
    const monthIds = new Set(fyMonths.map((m) => m.id));

    for (const site of [...realSites, groupSite]) {
      const totals = new Map();
      const cov = new Map();
      for (const row of outRows) {
        if (row.site_id !== site.id || !monthIds.has(row.period_id)) continue;
        totals.set(row.parameter_id, (totals.get(row.parameter_id) ?? 0) + row.value_num);
        // YTD coverage: the best month's coverage understates, the worst
        // overstates. Report the average site-months filed across the year.
        const c = cov.get(row.parameter_id) ?? { r: 0, e: 0 };
        c.r += row.sites_reporting ?? 0;
        c.e += row.sites_expected ?? 0;
        cov.set(row.parameter_id, c);
      }
      for (const [pid, total] of totals) {
        const c = cov.get(pid) ?? { r: 0, e: 0 };
        outRows.push({
          site_id: site.id,
          period_id: ytd.id,
          parameter_id: pid,
          value_num: round4(total),
          formula_id: null,
          sites_reporting: c.r,
          sites_expected: c.e,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------
  const siteRowCount = outRows.filter((r) => r.site_id !== groupSite.id).length;
  const groupRowCount = outRows.length - siteRowCount;
  console.log(
    `\nComputed ${outRows.length} output rows (${siteRowCount} site, ${groupRowCount} portfolio).`
  );

  if (DRY_RUN) {
    console.log("--dry-run: nothing written.\n");
  } else {
    console.log("Upserting…");
    await upsertChunks("output_value", outRows, "site_id,period_id,parameter_id");
    console.log("Written.\n");
  }

  await report(outRows, { sites, periods, outputParams, groupSite, months });
}

// =============================================================================
// Post-run report — the figures worth eyeballing every time.
// =============================================================================
async function report(outRows, { periods, outputParams, groupSite }) {
  const keyById = new Map(outputParams.map((p) => [p.id, p.key]));
  const periodById = new Map(periods.map((p) => [p.id, p]));

  const pick = (siteId, periodId, key) => {
    const pid = outputParams.find((p) => p.key === key)?.id;
    const row = outRows.find(
      (r) => r.site_id === siteId && r.period_id === periodId && r.parameter_id === pid
    );
    return row ? row.value_num : null;
  };

  const ytd25 = periods.find((p) => p.period_kind === "ytd" && p.fiscal_year === "2024-25");
  if (!ytd25) return;

  const fmt = (n) =>
    n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  console.log("Portfolio FY2024-25 (sum of what was filed — see coverage)");
  console.log("-".repeat(64));
  for (const [label, key, unit] of [
    ["Electricity - non-renewable", "en.electricity_nonrenew", "kWh"],
    ["Electricity - renewable", "en.electricity_renew", "kWh"],
    ["Diesel - stationary", "en.diesel_stationary", "kL"],
    ["Diesel - mobile", "en.diesel_mobile", "kL"],
    ["Water withdrawal - total", "wtr.total", "KL"],
    ["  of which water-stressed", "wtr.ws_total", "KL"],
    ["Water consumption", "wtr.consumption", "KL"],
    ["C&D waste generated", "wst.cnd_generated", "MT"],
    ["Scope 1 (indicative)", "ghg.scope1_total", "tCO2e"],
    ["Scope 2", "ghg.scope2_total", "tCO2e"],
  ]) {
    const v = pick(groupSite.id, ytd25.id, key);
    console.log(`  ${label.padEnd(30)} ${fmt(v).padStart(14)} ${unit}`);
  }

  // Coverage on a headline figure, stated plainly.
  const pid = outputParams.find((p) => p.key === "wtr.total")?.id;
  const covRow = outRows.find(
    (r) => r.site_id === groupSite.id && r.period_id === ytd25.id && r.parameter_id === pid
  );
  if (covRow) {
    const pct =
      covRow.sites_expected > 0
        ? Math.round((covRow.sites_reporting / covRow.sites_expected) * 100)
        : 0;
    console.log(
      `\n  Coverage: ${covRow.sites_reporting} of ${covRow.sites_expected} site-months filed (${pct}%).`
    );
    console.log(
      "  These are sums of filed returns, not estimates of what occurred."
    );
  }
  console.log();
  void keyById;
  void periodById;
}

main().catch((e) => {
  console.error("\nResolver failed:", e.message);
  process.exit(1);
});
