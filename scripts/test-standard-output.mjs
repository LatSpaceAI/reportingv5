#!/usr/bin/env node
// Verifies the standard output metrics workbook against the live database.
//
// Duplicates only the SUPABASE READ, not the layout: outputLayout.ts is a pure
// module both this script and the exporter import, so the sheet set, band order
// and number formats under test are the shipped ones. (test-export.mjs has to
// duplicate its cell map because exportEnvironment.ts is `server-only`; the
// layout/loader split here avoids that.)
//
// THE LOAD-BEARING ASSERTIONS
//
// Tests 9-13 pin the four cell states apart from BOTH directions. A single
// implementation error — keying "not computable" on `expression === '0'` without
// also checking is_assumption, or slipping a `value ?? 0` into the writer — would
// pass every other assertion in this file. Those are the ones to keep.
//
// Usage: node scripts/test-standard-output.mjs [outPath]

import { readFile, writeFile, unlink } from "node:fs/promises";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

// --base=URL anywhere in argv; a bare positional is the output path.
const argv = process.argv.slice(2);
const baseArg = argv.find((a) => a.startsWith("--base="));
const positional = argv.filter((a) => !a.startsWith("--"));
const OUT = positional[0] || ".tmp-standard-output-test.xlsx";
const KEEP = Boolean(positional[0]);
const FY = "2024-25";

const checks = [];
const t = (label, ok, detail = "") =>
  checks.push({ label, ok: Boolean(ok), detail: String(detail ?? "") });

// --- env -------------------------------------------------------------------
const envTxt = await readFile(".env.local", "utf8");
const env = Object.fromEntries(
  envTxt.split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "esg" },
  auth: { persistSession: false },
  global: { fetch: (i, o) => fetch(i, { ...o, cache: "no-store" }) },
});

// --- the workbook, built through the real route ----------------------------
// Goes over HTTP because the generator is `server-only`. A dev server on 3122 is
// assumed; pass --base=http://localhost:PORT to override.
const BASE = baseArg ? baseArg.slice("--base=".length) : "http://localhost:3122";

let buffer;
try {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "esg@demo.com",
      password: process.env.DEMO_PASSWORD || "birla-estates",
    }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  const res = await fetch(`${BASE}/api/esg/export/standard?fy=${FY}`, {
    headers: { cookie },
  });
  if (!res.ok) throw new Error(`export returned ${res.status}`);
  buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(OUT, buffer);
} catch (err) {
  console.error(
    `\nCould not reach the export route at ${BASE}.\n` +
      `Start a dev server (npx next dev -p 3122) and re-run, or pass a base URL as argv[3].\n` +
      `${err.message}\n`
  );
  process.exit(2);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer);

const headerRowOf = (ws, label = "Site code") => {
  for (let r = 1; r <= 12; r++) if (String(ws.getCell(r, 1).value ?? "") === label) return r;
  return 0;
};
const metricCols = (ws, headRow) => {
  const cols = {};
  for (let c = 10; c <= 45; c++) {
    const k = String(ws.getCell(headRow + 1, c).value ?? "").split(" ")[0];
    if (k) cols[k] = c;
  }
  return cols;
};
// A sheet folding two domains (ENERGY holds FUEL + ENERGY) emits ONE ROW PER
// BAND per site-period, each blank in the other band's columns. So a lookup has
// to name the domain, or it finds the row where the metric is legitimately null.
const findRow = (ws, headRow, siteCode, period, domain) => {
  for (let r = headRow + 2; r <= ws.rowCount; r++) {
    if (
      String(ws.getCell(r, 1).value ?? "") === siteCode &&
      String(ws.getCell(r, 7).value ?? "") === period &&
      (domain === undefined || String(ws.getCell(r, 6).value ?? "") === domain)
    ) return r;
  }
  return 0;
};

// ===========================================================================
// STRUCTURE
// ===========================================================================
const names = wb.worksheets.map((w) => w.name);
t("1. all nine sheets are present",
  names.join(",") === "READ FIRST,SUMMARY,ENERGY,WATER,WASTE,EMISSIONS,PERIODIC,CONSTANTS,ASSUMPTIONS",
  names.join(","));

const { data: params } = await sb.from("output_parameter").select("key").order("sort_order");
const summary = wb.getWorksheet("SUMMARY");
const sHead = headerRowOf(summary, "Metric");
const summaryCodes = [];
for (let r = sHead + 1; r <= summary.rowCount; r++) {
  const code = String(summary.getCell(r, 2).value ?? "");
  if (code) summaryCodes.push(code);
}
t("2. SUMMARY carries every output parameter, and only those",
  summaryCodes.length === params.length &&
    summaryCodes.slice().sort().join(",") === params.map((p) => p.key).sort().join(","),
  `${summaryCodes.length} rows vs ${params.length} parameters`);

for (const sheet of ["ENERGY", "WATER", "WASTE", "EMISSIONS", "PERIODIC"]) {
  const ws = wb.getWorksheet(sheet);
  const view = ws.views?.[0] ?? {};
  t(`3. ${sheet} freezes its header and identity columns`,
    view.state === "frozen" && view.ySplit >= 3 && view.xSplit === 9,
    `ySplit ${view.ySplit} xSplit ${view.xSplit}`);
}

const readFirst = wb.getWorksheet("READ FIRST");
let banner = "";
for (let r = 1; r <= 10; r++) {
  const v = String(readFirst.getCell(r, 2).value ?? "");
  if (v.includes("COVERAGE")) banner = v;
}
t("4. READ FIRST leads with a coverage banner naming both figures",
  /COVERAGE:.*\d+ of \d+ site-months/.test(banner), banner);

// ===========================================================================
// KNOWN FIGURES IN THE RIGHT PLACE
// ===========================================================================
const energy = wb.getWorksheet("ENERGY");
const eHead = headerRowOf(energy);
const eCols = metricCols(energy, eHead);

const auroraApril = findRow(energy, eHead, "AURORA", "April", "ENERGY");
t("5. Aurora April non-renewable electricity is its own filed figure",
  Number(energy.getCell(auroraApril, eCols["en.electricity_nonrenew"]).value) === 17113,
  energy.getCell(auroraApril, eCols["en.electricity_nonrenew"]).value);

const groupApril = findRow(energy, eHead, "GROUP", "April", "ENERGY");
const groupAprilFuel = findRow(energy, eHead, "GROUP", "April", "FUEL");
const groupElec = Number(energy.getCell(groupApril, eCols["en.electricity_nonrenew"]).value);
t("6. the portfolio row differs from any single site (Aurora + Tisya)",
  groupElec === 41048.5, groupElec);

t("7. a 0.03 kL figure survives its number format",
  Number(energy.getCell(groupAprilFuel, eCols["en.diesel_stationary"]).value) === 0.21 &&
    energy.getCell(groupAprilFuel, eCols["en.diesel_stationary"]).numFmt === "#,##0.000",
  `${energy.getCell(groupAprilFuel, eCols["en.diesel_stationary"]).value} fmt ${energy.getCell(groupAprilFuel, eCols["en.diesel_stationary"]).numFmt}`);

const [{ data: s2Param }, { data: s2Period }, { data: s2Site }] = await Promise.all([
  sb.from("output_parameter").select("id").eq("key", "ghg.scope2_total").single(),
  sb.from("period").select("id").eq("fiscal_year", FY).eq("period_kind", "ytd").single(),
  sb.from("site").select("id").eq("is_group", true).single(),
]);
const { data: s2Rows } = await sb
  .from("output_value")
  .select("value_num")
  .eq("parameter_id", s2Param.id)
  .eq("period_id", s2Period.id)
  .eq("site_id", s2Site.id);
const s2 = s2Rows?.[0] ?? null;
let s2Sheet = null;
for (let r = sHead + 1; r <= summary.rowCount; r++) {
  if (String(summary.getCell(r, 2).value ?? "") === "ghg.scope2_total") {
    s2Sheet = Number(summary.getCell(r, 4).value);
  }
}
t("8. SUMMARY Scope 2 equals the stored portfolio YTD figure",
  s2 && Math.abs(s2Sheet - Number(s2.value_num)) < 0.01,
  `sheet ${s2Sheet} vs db ${s2?.value_num}`);

// ===========================================================================
// THE FOUR STATES — pinned from both directions
// ===========================================================================
let notFiledRow = 0;
for (let r = eHead + 2; r <= energy.rowCount; r++) {
  if (
    String(energy.getCell(r, 9).value ?? "") === "NOT FILED" &&
    String(energy.getCell(r, 6).value ?? "") === "ENERGY"
  ) { notFiledRow = r; break; }
}
const nfCell = energy.getCell(notFiledRow, eCols["en.electricity_nonrenew"]);
t("9. an unfiled site-month renders TEXT, not a number",
  typeof nfCell.value === "string" && /not filed/i.test(nfCell.value) && nfCell.value !== 0,
  JSON.stringify(nfCell.value));

t("10. its Return filed column says so too",
  String(energy.getCell(notFiledRow, 9).value) === "NOT FILED");

// THE REGRESSION SWEEP. A future `value ?? 0` would fail here and nowhere else.
let zeroOnNotFiled = 0;
for (const sheet of ["ENERGY", "WATER", "WASTE", "EMISSIONS", "PERIODIC"]) {
  const ws = wb.getWorksheet(sheet);
  const hr = headerRowOf(ws);
  for (let r = hr + 2; r <= ws.rowCount; r++) {
    if (String(ws.getCell(r, 9).value ?? "") !== "NOT FILED") continue;
    for (let c = 10; c <= 45; c++) {
      if (ws.getCell(r, c).value === 0) zeroOnNotFiled++;
    }
  }
}
t("11. NO metric cell on a NOT-FILED row is a numeric zero",
  zeroOnNotFiled === 0, `${zeroOnNotFiled} offending cells`);

// The other direction: a filed row with a legitimate zero keeps the number.
const water = wb.getWorksheet("WATER");
const wHead = headerRowOf(water);
const wCols = metricCols(water, wHead);
const wAurora = findRow(water, wHead, "AURORA", "April");
t("12. a FILED row with a real zero renders numeric 0, not text",
  water.getCell(wAurora, wCols["wtr.surface"]).value === 0 &&
    typeof water.getCell(wAurora, wCols["wtr.surface"]).value === "number",
  JSON.stringify(water.getCell(wAurora, wCols["wtr.surface"]).value));

// The subtle pair. Both formulas are a literal '0'; only is_assumption separates
// them, and keying on the expression alone would break exactly this.
const waste = wb.getWorksheet("WASTE");
const wsHead = headerRowOf(waste);
const wsCols = metricCols(waste, wsHead);
let wasteFiled = 0;
for (let r = wsHead + 2; r <= waste.rowCount; r++) {
  if (String(waste.getCell(r, 9).value ?? "") === "Yes") { wasteFiled = r; break; }
}
t("13. an uncomputable line reads 'not computable', not 0",
  /not computable/i.test(String(waste.getCell(wasteFiled, wsCols["wst.used_oil_generated"]).value)),
  JSON.stringify(waste.getCell(wasteFiled, wsCols["wst.used_oil_generated"]).value));

t("14. a SUBSTANTIVE zero (wtr.discharged) stays numeric 0",
  water.getCell(wAurora, wCols["wtr.discharged"]).value === 0 &&
    typeof water.getCell(wAurora, wCols["wtr.discharged"]).value === "number",
  JSON.stringify(water.getCell(wAurora, wCols["wtr.discharged"]).value));

// n/a, the fourth state
t("15. a stressed-area metric on a non-stressed site reads n/a",
  String(water.getCell(wAurora, wCols["wtr.ws_groundwater"]).value) === "n/a" &&
    String(water.getCell(wAurora, 5).value) === "No",
  JSON.stringify(water.getCell(wAurora, wCols["wtr.ws_groundwater"]).value));

const wTisya = findRow(water, wHead, "TISYA", "April");
t("16. the same metric on a STRESSED site carries its figure",
  Number(water.getCell(wTisya, wCols["wtr.ws_groundwater"]).value) === 1396,
  water.getCell(wTisya, wCols["wtr.ws_groundwater"]).value);

// ===========================================================================
// AGGREGATION, DISCLOSED
// ===========================================================================
let aggNote = "";
for (let r = 1; r <= 6; r++) {
  const v = String(waste.getCell(r, 1).value ?? "");
  if (v.includes("AGGREGATED")) aggNote = v;
}
t("17. WASTE says on the sheet that it aggregated the figures itself",
  /AGGREGATED FROM MONTHLY ROWS/.test(aggNote), aggNote.slice(0, 48));

const monthsCol = 10 + Object.keys(wsCols).length;
t("18. WASTE carries a per-cell Months-in-period count",
  String(waste.getCell(wsHead, monthsCol).value) === "Months in period",
  waste.getCell(wsHead, monthsCol).value);

let partial = 0;
let zeroMonth = 0;
for (let r = wsHead + 2; r <= waste.rowCount; r++) {
  const m = String(waste.getCell(r, monthsCol).value ?? "");
  if (/^[12] of 3$/.test(m)) partial = partial || r;
  if (m === "0 of 3") zeroMonth = zeroMonth || r;
}
t("19. a partial quarter is filled amber so it cannot read as a whole one",
  partial > 0 && waste.getCell(partial, 13).fill?.fgColor?.argb === "FFFEF3C7",
  `row ${partial}`);

t("20. a quarter with NO filed month renders 'not filed', never 0",
  zeroMonth > 0 && /not filed/i.test(String(waste.getCell(zeroMonth, 10).value)),
  JSON.stringify(waste.getCell(zeroMonth, 10).value));

// ===========================================================================
// COVERAGE AND ASSUMPTIONS
// ===========================================================================
const { data: subs } = await sb
  .from("site_submission")
  .select("period:period_id(fiscal_year, period_kind)")
  .in("status", ["submitted", "under_review", "approved"]);
const filedFy = (subs ?? []).filter(
  (s) => s.period?.fiscal_year === FY && s.period?.period_kind === "month"
).length;

const assumptions = wb.getWorksheet("ASSUMPTIONS");
let yCount = 0;
for (let r = 1; r <= assumptions.rowCount; r++) {
  for (let c = 2; c <= 13; c++) if (String(assumptions.getCell(r, c).value ?? "") === "Y") yCount++;
}
t("21. the coverage matrix marks exactly the filed site-months",
  yCount === filedFy, `${yCount} in sheet vs ${filedFy} in database`);

t("22. coverage is stated in site-MONTHS, since a YTD count is month-summed",
  /site-months/.test(banner), banner);

const constantsSheet = wb.getWorksheet("CONSTANTS");
const cHead = headerRowOf(constantsSheet, "Key");
const assumptionKeys = [];
let gridStatus = "";
for (let r = cHead + 1; r <= constantsSheet.rowCount; r++) {
  const key = String(constantsSheet.getCell(r, 1).value ?? "");
  if (!key) continue;
  if (String(constantsSheet.getCell(r, 8).value) === "ASSUMPTION") assumptionKeys.push(key);
  if (key === "EF.grid") gridStatus = String(constantsSheet.getCell(r, 8).value);
}
t("23. the assumption list includes the combustion factors",
  assumptionKeys.includes("EF.diesel") && assumptionKeys.includes("EF.petrol"),
  assumptionKeys.join(", "));
t("24. EF.grid is NOT an assumption — it is back-derived and exact",
  gridStatus === "Confirmed" && !assumptionKeys.includes("EF.grid"), gridStatus);

let r22Used = "";
for (let r = cHead + 1; r <= constantsSheet.rowCount; r++) {
  if (String(constantsSheet.getCell(r, 1).value ?? "") === "GWP.r22") {
    r22Used = String(constantsSheet.getCell(r, 9).value ?? "");
  }
}
t("25. GWP.r22's empty usage is explained, not left blank",
  /Montreal Protocol/.test(r22Used), r22Used.slice(0, 44));

// At 6% coverage, "not filed" must outnumber real values. If it ever doesn't,
// something zero-filled.
const notFiledTotal = (() => {
  let n = 0;
  for (const sheet of ["ENERGY", "WATER", "WASTE", "EMISSIONS", "PERIODIC"]) {
    const ws = wb.getWorksheet(sheet);
    const hr = headerRowOf(ws);
    for (let r = hr + 2; r <= ws.rowCount; r++) {
      for (let c = 10; c <= 45; c++) {
        if (/not filed/i.test(String(ws.getCell(r, c).value ?? ""))) n++;
      }
    }
  }
  return n;
})();
const valueTotal = (() => {
  let n = 0;
  for (const sheet of ["ENERGY", "WATER", "WASTE", "EMISSIONS", "PERIODIC"]) {
    const ws = wb.getWorksheet(sheet);
    const hr = headerRowOf(ws);
    for (let r = hr + 2; r <= ws.rowCount; r++) {
      for (let c = 10; c <= 45; c++) {
        if (typeof ws.getCell(r, c).value === "number") n++;
      }
    }
  }
  return n;
})();
t("26. at 6% coverage, 'not filed' outnumbers real values",
  notFiledTotal > valueTotal, `${notFiledTotal} not filed vs ${valueTotal} values`);

// --- report ----------------------------------------------------------------
if (!KEEP) await unlink(OUT).catch(() => {});

const width = Math.max(...checks.map((c) => c.label.length)) + 2;
console.log(`\nstandard output workbook — FY ${FY}\n`);
for (const c of checks) {
  console.log(`${c.ok ? "ok  " : "FAIL"} ${c.label.padEnd(width)} ${c.detail}`);
}
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} passed\n`);
process.exit(failed ? 1 : 0);
