#!/usr/bin/env node
// Populates the real BRSR template from the database and verifies the result.
//
// Duplicates the exporter's write logic rather than importing it, because
// exportEnvironment.ts is `server-only`. Keep the two in step — the cell map is
// shared, so drift can only come from the write rules themselves.
//
// Usage: node scripts/test-export.mjs [outPath]
import { readFile, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

const TEMPLATE = "birla-estates/output/Real Estate BRSR and IR Data template FY25 V1.xlsx";
// Default output goes to a gitignored scratch name so a test run never leaves
// an artifact next to the client's real template.
const OUT = process.argv[2] ?? "birla-estates/output/_populated-test.xlsx";
const FY = "2024-25";

const envTxt = await readFile(".env.local", "utf8");
const env = Object.fromEntries(
  envTxt.split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "esg" }, auth: { persistSession: false },
});

// ---- load the model -------------------------------------------------------
const { data: group } = await sb.from("site").select("id").eq("is_group", true).single();
const { data: periods } = await sb
  .from("period").select("id, period_kind, month_no, quarter_no").eq("fiscal_year", FY);
const monthIdByNo = new Map(), quarterIds = new Map();
let ytdId = null;
for (const p of periods) {
  if (p.period_kind === "month") {
    monthIdByNo.set(p.month_no, p.id);
    if (!quarterIds.has(p.quarter_no)) quarterIds.set(p.quarter_no, []);
    quarterIds.get(p.quarter_no).push(p.id);
  } else if (p.period_kind === "ytd") ytdId = p.id;
}
const { data: values } = await sb
  .from("output_value")
  .select("period_id, value_num, parameter:parameter_id(key)")
  .eq("site_id", group.id)
  .in("period_id", [...monthIdByNo.values(), ytdId]);
const V = new Map();
for (const v of values) if (v.value_num != null) V.set(`${v.parameter.key}|${v.period_id}`, Number(v.value_num));
console.log(`loaded ${V.size} computed values for FY${FY}`);

// ---- cell map (mirrors src/lib/brsrExport/environmentMap.ts) --------------
const EM = ["G","H","I","J","K","L","M","N","O","P","Q","R"];
const WM = ["D","E","F","G","H","I","J","K","L","M","N","O"];
const SM = ["E","F","G","H","I","J","K","L","M","N","O","P"];
const WQ = ["F","H","J","L"];
const ENERGY = [
  ["en.diesel_stationary",17,null],["en.diesel_mobile",18,"F"],["en.petrol",19,null],
  ["en.electricity_nonrenew",20,null],["en.electricity_renew",23,null]];
const WATER = [["wtr.surface",27],["wtr.groundwater",28],["wtr.third_party",29],
  ["wtr.seawater",30],["wtr.treated",31],["wtr.consumption",34]];
const STRESSED = [["wtr.ws_groundwater",64],["wtr.ws_third_party",65],
  ["wtr.ws_treated",67],["wtr.ws_consumption",70]];
const WASTE = [["wst.biomedical_generated",127],["wst.plastic_generated",135],
  ["wst.plastic_recycled",136],["wst.cnd_generated",151],["wst.cnd_reused",153],
  ["wst.cnd_landfilled",156],["wst.municipal_generated",193],["wst.food_generated",201]];

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await readFile(TEMPLATE));
const ws = wb.getWorksheet("Environment (Real Estate)");

// Expand shared formulas so overwriting a master cannot orphan its clones.
const { normalizeSharedFormulas } = await import("./lib/normalize-shared.mjs");
const expanded = normalizeSharedFormulas(ws);
console.log(`expanded ${expanded} shared-formula cells`);
const changes = [];
const write = (ref, val, label) => {
  if (val == null) return;
  const cell = ws.getCell(ref);
  const prev = cell.value;
  const wasFormula = prev && typeof prev === "object" && "formula" in prev;
  cell.value = val;
  changes.push({ ref, label, wasFormula: !!wasFormula, prev: wasFormula ? `=${prev.formula}` : prev, val });
};

for (const [key, row, fyCol] of ENERGY) {
  EM.forEach((c, i) => write(`${c}${row}`, V.get(`${key}|${monthIdByNo.get(i + 1)}`), key));
  if (fyCol) write(`${fyCol}${row}`, V.get(`${key}|${ytdId}`), `${key} FY`);
}
for (const [key, row] of WATER)
  WM.forEach((c, i) => write(`${c}${row}`, V.get(`${key}|${monthIdByNo.get(i + 1)}`), key));
for (const [key, row] of STRESSED)
  SM.forEach((c, i) => write(`${c}${row}`, V.get(`${key}|${monthIdByNo.get(i + 1)}`), key));
for (const [key, row] of WASTE) {
  WQ.forEach((c, qi) => {
    let sum = 0, found = false;
    for (const pid of quarterIds.get(qi + 1) ?? []) {
      const v = V.get(`${key}|${pid}`); if (v != null) { sum += v; found = true; }
    }
    if (found) write(`${c}${row}`, sum, `${key} Q${qi + 1}`);
  });
  write(`D${row}`, V.get(`${key}|${ytdId}`), `${key} FY`);
}

await writeFile(OUT, Buffer.from(await wb.xlsx.writeBuffer()));
console.log(`wrote ${OUT}`);
console.log(`cells written: ${changes.length}, formulas replaced: ${changes.filter(c => c.wasFormula).length}`);

// ---- verify ---------------------------------------------------------------
const check = new ExcelJS.Workbook();
await check.xlsx.readFile(OUT);
const cs = check.getWorksheet("Environment (Real Estate)");
let pass = 0, total = 0;
const t = (label, ok, detail = "") => { total++; if (ok) pass++; console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? "  " + detail : ""}`); };

t("all 9 sheets preserved", check.worksheets.length === 9, check.worksheets.map(w => w.name).length + " sheets");
t("137 merged ranges preserved", (cs.model.merges?.length ?? 0) === 137, `${cs.model.merges?.length}`);
// The BRSR template is a COMPANY-WIDE disclosure, so these are portfolio
// totals, not any single site. April 2024 is Aurora + Tisya, the two sites that
// filed that month:
//   stationary diesel   0.03 (Aurora) + 0.18 (Tisya)      = 0.21 kL
//   non-renewable elec  17,113        + 23,935.5          = 41,048.5 kWh
//   renewable elec      271,906       + 1,522.76          = 273,428.76 kWh
//   groundwater         857           + 1,396 (as filed)  = 2,253 KL
t("Apr stationary diesel = 0.21 kL (Aurora + Tisya)", Math.abs(cs.getCell("G17").value - 0.21) < 1e-9, `= ${cs.getCell("G17").value}`);
t("Apr non-renewable electricity = 41,048.5 kWh", Math.abs(cs.getCell("G20").value - 41048.5) < 1e-6, `= ${cs.getCell("G20").value}`);
t("Apr renewable electricity = 273,428.76 kWh", Math.abs(cs.getCell("G23").value - 273428.76) < 1e-6, `= ${cs.getCell("G23").value}`);
t("Apr groundwater = 2,253 KL", cs.getCell("D28").value === 2253, `= ${cs.getCell("D28").value}`);
t("Apr total-withdrawal formula intact", typeof cs.getCell("D32").value === "object" && "formula" in cs.getCell("D32").value, String(cs.getCell("D32").value?.formula));
const d34 = cs.getCell("D34").value;
t("Apr water consumption now filled (was blank)", typeof d34 === "number" && d34 > 0, `= ${d34}`);
const e70 = cs.getCell("E70").value;
t("stressed consumption overwrites the defective formula", typeof e70 === "number", `= ${e70}`);
t("stressed consumption <= stressed withdrawal", typeof e70 === "number" && typeof cs.getCell("E68").value === "object", `${e70} (withdrawal row 68 keeps its formula)`);
const f18 = cs.getCell("F18").value;
t("mobile diesel FY total now present (was blank)", typeof f18 === "number" && f18 > 0, `= ${f18}`);
// External-link formulas in the months we have data for must be gone.
const j17 = cs.getCell("J17").value;
t("external-link formula replaced where we have data", typeof j17 === "number", JSON.stringify(j17).slice(0, 40));
// A month with no data keeps whatever the template had — we must not zero it.
const l17 = cs.getCell("L17").value;
t("no-data month left untouched, not zeroed", !(l17 === 0), JSON.stringify(l17).slice(0, 50));

console.log(`\n${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
