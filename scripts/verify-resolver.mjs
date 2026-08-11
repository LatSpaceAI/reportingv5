#!/usr/bin/env node
// =============================================================================
// Checks the resolver's output against figures established independently.
//
// The Middle Link reconstruction computed, by hand and from the same site
// returns, how much of each FY25 figure is evidenced by filed returns (its
// "Coverage" sheet, "From site returns (SR)" column). Our resolver sums only
// filed returns and performs no balancing, so its portfolio FY25 totals must
// equal that SR column exactly. Any drift means the model changed meaning.
//
// Run AFTER resolve-birla.mjs has written output_value:
//   node scripts/verify-resolver.mjs
// =============================================================================

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

async function loadEnv() {
  const txt = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = await loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "esg" },
  auth: { persistSession: false },
});

const [{ data: sites }, { data: periods }, { data: params }] = await Promise.all([
  sb.from("site").select("id, code, is_group, water_stressed"),
  sb.from("period").select("id, fiscal_year, period_kind, month_no, month_label"),
  sb.from("output_parameter").select("id, key, label, unit"),
]);

const group = sites.find((s) => s.is_group);
const byKey = new Map(params.map((p) => [p.key, p]));
const siteByCode = new Map(sites.map((s) => [s.code, s]));
const monthOf = (fy, mo) =>
  periods.find((p) => p.fiscal_year === fy && p.period_kind === "month" && p.month_no === mo);
const ytdOf = (fy) => periods.find((p) => p.fiscal_year === fy && p.period_kind === "ytd");

async function val(siteId, periodId, key) {
  const p = byKey.get(key);
  if (!p) throw new Error(`unknown output key ${key}`);
  const { data } = await sb
    .from("output_value")
    .select("value_num, sites_reporting, sites_expected")
    .eq("site_id", siteId)
    .eq("period_id", periodId)
    .eq("parameter_id", p.id)
    .maybeSingle();
  return data ? Number(data.value_num) : null;
}

const checks = [];
const near = (a, b, tol = 0.01) => a !== null && Math.abs(a - b) <= tol;
async function check(label, siteCode, period, key, want, tol) {
  const site = siteCode === "GROUP" ? group : siteByCode.get(siteCode);
  const got = await val(site.id, period.id, key);
  checks.push({ label, got, want, ok: near(got, want, tol) });
}

const FY25 = "2024-25";
const ytd25 = ytdOf(FY25);

// ---------------------------------------------------------------------------
// Portfolio FY25 totals vs the reconstruction's SR column.
// Every one of these was derived independently, by hand, from the same returns.
// ---------------------------------------------------------------------------
await check("FY25 non-renewable electricity (kWh)", "GROUP", ytd25, "en.electricity_nonrenew", 130914.5);
await check("FY25 renewable electricity (kWh)", "GROUP", ytd25, "en.electricity_renew", 1421068.7592, 0.001);
await check("FY25 stationary diesel (kL)", "GROUP", ytd25, "en.diesel_stationary", 3.475);
await check("FY25 mobile diesel (kL)", "GROUP", ytd25, "en.diesel_mobile", 5.287);
await check("FY25 C&D waste generated (MT)", "GROUP", ytd25, "wst.cnd_generated", 196.85);

// Water — and here our model deliberately DIVERGES from the published FY25
// consolidation, so the expected values differ from the reconstruction's SR
// column by exactly one number.
//
// The published template booked Tisya's Apr-24 groundwater (1,396 KL) as
// THIRD-PARTY water while leaving Trimaya's Feb-25 groundwater as groundwater.
// We store both as filed and raise the inconsistency as a flag, because
// silently adopting either treatment would move a published figure without a
// decision having been taken.
//
// Net effect, which these two assertions pin down so it cannot drift unnoticed:
//   groundwater   4,060.00 (template treatment)  ->  5,456.00 (as filed)
//   third-party   9,608.75 (template treatment)  ->  8,212.75 (as filed)
//   total         13,668.75 either way — the water does not move, only its label.
//
// If the ESG team decides to adopt the template's reclassification, that is a
// change to wtr.groundwater / wtr.third_party in 07_formulas_seed.sql (or to
// Tisya's stored value), and these two numbers swap back.
const TISYA_APR_GROUNDWATER = 1396;
await check("FY25 groundwater as filed (KL)", "GROUP", ytd25, "wtr.groundwater", 4060 + TISYA_APR_GROUNDWATER);
await check("FY25 third-party as filed (KL)", "GROUP", ytd25, "wtr.third_party", 9608.75 - TISYA_APR_GROUNDWATER);
await check("FY25 treated water (KL)", "GROUP", ytd25, "wtr.treated", 612.88);

// Whichever way the classification lands, the total withdrawal is invariant —
// this is the assertion that would catch water being lost or double-counted.
const gw = await val(group.id, ytd25.id, "wtr.groundwater");
const tp = await val(group.id, ytd25.id, "wtr.third_party");
const tr = await val(group.id, ytd25.id, "wtr.treated");
const tot = await val(group.id, ytd25.id, "wtr.total");
checks.push({
  label: "FY25 total withdrawal = groundwater + third-party + treated",
  got: tot,
  want: gw + tp + tr,
  ok: near(tot, gw + tp + tr, 0.01),
});

// ---------------------------------------------------------------------------
// The water identity the published template got wrong twice.
// ---------------------------------------------------------------------------
const aprFY25 = monthOf(FY25, 1);
const totalApr = await val(group.id, aprFY25.id, "wtr.total");
const consApr = await val(group.id, aprFY25.id, "wtr.consumption");
checks.push({
  label: "April: consumption equals withdrawal (discharge is zero)",
  got: consApr,
  want: totalApr,
  ok: near(consApr, totalApr, 1e-6),
});

const wsApr = await val(group.id, aprFY25.id, "wtr.ws_total");
checks.push({
  label: "April: stressed withdrawal <= total withdrawal",
  got: wsApr <= totalApr ? 1 : 0,
  want: 1,
  ok: wsApr !== null && wsApr <= totalApr,
});

// ---------------------------------------------------------------------------
// site_filter: the stressed-area rollup must exclude non-stressed sites.
// December: only Sangamwadi (Pune, NOT stressed) filed, so stressed must be 0
// while the company-wide figure is 283.2.
// ---------------------------------------------------------------------------
const decFY25 = monthOf(FY25, 9);
await check("Dec: company-wide third-party water (KL)", "GROUP", decFY25, "wtr.third_party", 283.2);
const wsDec = await val(group.id, decFY25.id, "wtr.ws_third_party");
checks.push({
  label: "Dec: stressed third-party excludes Pune",
  got: wsDec,
  want: null,
  ok: wsDec === null || wsDec === 0,
});

// February: only Trimaya (Bengaluru, stressed) filed — stressed equals total.
const febFY25 = monthOf(FY25, 11);
await check("Feb: stressed groundwater is Trimaya's 52 KL", "GROUP", febFY25, "wtr.ws_groundwater", 52);

// ---------------------------------------------------------------------------
// Scope 2 must derive from non-renewable electricity only.
// ---------------------------------------------------------------------------
const nrApr = await val(group.id, aprFY25.id, "en.electricity_nonrenew");
const s2Apr = await val(group.id, aprFY25.id, "ghg.scope2_total");
checks.push({
  label: "April: Scope 2 = non-renewable kWh x 0.727 / 1000",
  got: s2Apr,
  want: (nrApr * 0.727) / 1000,
  ok: near(s2Apr, (nrApr * 0.727) / 1000, 0.001),
});

// ---------------------------------------------------------------------------
// Site-level spot checks — the reconstruction's cleanest lineage proofs.
// ---------------------------------------------------------------------------
await check("Sangamwadi Dec: stationary diesel (kL)", "SANGAMWADI", decFY25, "en.diesel_stationary", 2.0);
await check("Tisya Apr: treated water (KL)", "TISYA", monthOf(FY25, 1), "wtr.treated", 612.88);
await check("Tisya Apr: C&D incl. scrap (MT)", "TISYA", monthOf(FY25, 1), "wst.cnd_generated", 184.05);
await check("Aurora Apr: non-renewable electricity (kWh)", "AURORA", aprFY25, "en.electricity_nonrenew", 17113);
await check("Trimaya Feb: mobile diesel (kL)", "TRIMAYA", febFY25, "en.diesel_mobile", 3.942);

// ---------------------------------------------------------------------------
// FY24 comparatives: the electricity inversion must survive resolution.
// Aurora's FY24 grid draw is NON-renewable; renewable is nil until Feb-24.
// ---------------------------------------------------------------------------
const FY24 = "2023-24";
const apr23 = monthOf(FY24, 1);
await check("Aurora Apr-23: grid feeds non-renewable (kWh)", "AURORA", apr23, "en.electricity_nonrenew", 265906.89, 0.5);
await check("Aurora Apr-23: renewable is zero", "AURORA", apr23, "en.electricity_renew", 0);
await check("Aurora Feb-24: green energy feeds renewable (kWh)", "AURORA", monthOf(FY24, 11), "en.electricity_renew", 219960);

// ---------------------------------------------------------------------------
// Nothing may be written for a site-month with no return: "no data" must never
// become "a return of zero".
// ---------------------------------------------------------------------------
const navya = siteByCode.get("NAVYA");
const navyaApr = await val(navya.id, aprFY25.id, "wtr.total");
checks.push({
  label: "A site that filed nothing has no computed row",
  got: navyaApr === null ? "no row" : navyaApr,
  want: "no row",
  ok: navyaApr === null,
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const fmt = (n) =>
  typeof n === "number" ? Number(n.toFixed(4)).toLocaleString("en-IN") : String(n);

console.log("\nResolver verification — computed vs independently-derived figures");
console.log("=".repeat(78));
let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  const detail = c.ok ? fmt(c.got) : `got ${fmt(c.got)}, expected ${fmt(c.want)}`;
  console.log(`${c.ok ? "ok  " : "FAIL"}  ${c.label.padEnd(52)} ${detail}`);
}
console.log("=".repeat(78));
console.log(`${checks.length - failed}/${checks.length} passed\n`);
process.exit(failed ? 1 : 0);
