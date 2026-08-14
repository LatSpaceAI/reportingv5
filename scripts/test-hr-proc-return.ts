#!/usr/bin/env node
// Round-trips the Birla HR/Procurement monthly returns: parse the real client
// samples → assert values → shift rows → parse again → write into the bundled
// template → re-parse the result.
//
// No database. Layout, parser and export writer are pure. Runs in esg:check.
//
// THE LOAD-BEARING ASSERTIONS
//
//   1. Rows are found by LABEL, not row number. The filled Procurement sample
//      is three rows longer than the template tab (inserted material rows,
//      renamed placeholders) — the exact drift this must survive.
//   2. A blank cell is not a zero, an NA is not a blank, and a reported zero
//      is stored as zero.
//   3. The layout never points a write at a cell the template computes with
//      its own formula — that would kill the workbook's recalculation.
//
// Usage: tsx scripts/test-hr-proc-return.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";

import ExcelJS from "exceljs";

import { normalizeSharedFormulas } from "../src/lib/brsrExport/normalizeSharedFormulas";
import { writeReturnSheets, type ReturnValue } from "../src/lib/brsrExport/writeHrProcSheets";
import { HR_LAYOUT } from "../src/lib/hrProcReturn/hrLayout";
import { PROC_LAYOUT } from "../src/lib/hrProcReturn/procLayout";
import { RETURN_LAYOUTS } from "../src/lib/hrProcReturn/layouts";
import { parseReturnWorkbook, type ParsedReturnSheet } from "../src/lib/hrProcReturn/parseReturn";

const checks: { label: string; ok: boolean; detail: string }[] = [];
const t = (label: string, ok: unknown, detail: unknown = "") =>
  checks.push({ label, ok: Boolean(ok), detail: String(detail ?? "") });

const HR_SAMPLE = join(process.cwd(), "birla-estates", "output", "BRSR - HR - 15.04.xlsx");
const PROC_SAMPLE = join(process.cwd(), "birla-estates", "output", "BRSR -  Procurement.xlsx");
const TEMPLATE = join(
  process.cwd(),
  "src",
  "lib",
  "brsrExport",
  "template",
  "birla-estates-brsr-fy25-v1.xlsx"
);

const cellOf = (sheet: ParsedReturnSheet, key: string) => sheet.cells.find((c) => c.key === key);
const valueOf = (sheet: ParsedReturnSheet, key: string) => cellOf(sheet, key)?.value;
const textOf = (sheet: ParsedReturnSheet, key: string) => cellOf(sheet, key)?.text;
const near = (a: number | null | undefined, b: number, eps = 1e-6) =>
  a != null && Math.abs(a - b) < eps;

async function main() {
  // =========================================================================
  // 1. LAYOUT INVARIANTS
  // =========================================================================
  {
    const keys = RETURN_LAYOUTS.flatMap((l) => l.cells.map((c) => c.key));
    t("parameter keys are unique across both layouts", new Set(keys).size === keys.length, keys.length);

    const prefixOk = HR_LAYOUT.cells.every((c) => c.key.startsWith("hr.")) &&
      PROC_LAYOUT.cells.every((c) => c.key.startsWith("proc."));
    t("keys carry their domain prefix", prefixOk);

    const blockIds = new Set(RETURN_LAYOUTS.flatMap((l) => l.blocks.map((b) => b.id)));
    const orphan = RETURN_LAYOUTS.flatMap((l) => l.cells).find((c) => !blockIds.has(c.blockId));
    t("every cell belongs to a declared block", !orphan, orphan?.key ?? "");
  }

  // The layout must never target a cell the template computes itself: writing
  // there would replace a live formula with a constant.
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const offenders: string[] = [];
    for (const layout of RETURN_LAYOUTS) {
      const ws = wb.getWorksheet(layout.sheetName);
      t(`template has a "${layout.sheetName}" tab`, Boolean(ws));
      if (!ws) continue;
      for (const cell of layout.cells) {
        if (cell.templateRow == null) continue;
        const v = ws.getRow(cell.templateRow).getCell(cell.col).value;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyV = v as any;
        if (v && typeof v === "object" && (anyV.formula !== undefined || anyV.sharedFormula !== undefined)) {
          offenders.push(`${layout.sheetName}!${cell.col}${cell.templateRow} (${cell.key})`);
        }
      }
    }
    t("no layout cell targets a template formula cell", offenders.length === 0, offenders.join(", "));
  }

  // The checked-in seed migration is generated from these layouts; a layout
  // change without a regenerate must fail here, not drift silently.
  {
    const { buildSeedSql, SEED_SQL_PATH } = await import("./gen-hr-proc-seed");
    const onDisk = readFileSync(join(process.cwd(), SEED_SQL_PATH), "utf8");
    t(
      "supabase/esg/17_hr_procurement_inputs.sql matches the layouts (rerun scripts/gen-hr-proc-seed.ts)",
      onDisk === buildSeedSql()
    );
  }

  // =========================================================================
  // 2. THE HR SAMPLE (row-identical to the template)
  // =========================================================================
  const hrParsed = await parseReturnWorkbook(readFileSync(HR_SAMPLE));
  t("the HR sample parses", hrParsed.ok, hrParsed.error ?? "");
  const hr = hrParsed.sheets?.find((s) => s.domain === "HR");
  if (!hr) throw new Error("HR sheet missing from parse result");

  t("every HR block was found", hr.blocksNotFound.length === 0, hr.blocksNotFound.join("; "));
  t("no HR row fell back to offset", hr.rowLabelMismatches.length === 0,
    hr.rowLabelMismatches.map((m) => m.expected).join("; "));
  t("no HR list overflow", hr.listOverflow.length === 0);
  t("nothing unparseable in HR", hr.unparsedCells.length === 0,
    hr.unparsedCells.map((c) => `${c.sheetCell}=${c.rawText}`).join("; "));

  t("male permanent headcount", valueOf(hr, "hr.headcount_perm_emp_m") === 348);
  t("female permanent headcount", valueOf(hr, "hr.headcount_perm_emp_f") === 114);
  t("end-of-FY grid: permanent males under 30", valueOf(hr, "hr.eoy_perm_emp_u30_m") === 64);
  t("beginning-of-FY grid: permanent males 30-50", valueOf(hr, "hr.boy_perm_emp_30_50_m") === 192);
  t("separations: permanent males 30-50", valueOf(hr, "hr.sep_perm_emp_30_50_m") === 49);
  t("new hires: permanent males under 30", valueOf(hr, "hr.hires_perm_emp_u30_m") === 51);
  t("senior management male", valueOf(hr, "hr.senior_mgmt_m") === 15);
  t("A REPORTED ZERO IS STORED AS ZERO", valueOf(hr, "hr.complaints_posh_filed") === 0,
    String(valueOf(hr, "hr.complaints_posh_filed")));
  t("duplicate Male/Female labels resolve by cursor (skill training, workers)",
    valueOf(hr, "hr.trained_skill_perm_wkr_m") === 0 &&
    cellOf(hr, "hr.trained_skill_perm_wkr_m")?.sheetCell === "C89",
    cellOf(hr, "hr.trained_skill_perm_wkr_m")?.sheetCell);
  t("parental leave: females who availed", valueOf(hr, "hr.matleave_emp_availed_f") === 2);
  t("well-being spend text survives", textOf(hr, "hr.wellbeing_spend_text") === "1.30 Cr.");
  t("metro wages parsed", near(valueOf(hr, "hr.wages_metro_paid"), 1567819511.6787522, 1e-3));
  t("'NA' IN A NUMERIC CELL IS NOT-AVAILABLE, NOT BLANK",
    cellOf(hr, "hr.wages_rural_paid")?.isNotAvailable === true);
  t("security third-party text", textOf(hr, "hr.security_thirdparty_text") === "yes");
  t("NGRBC topics text", textOf(hr, "hr.ngrbc_emp_topics") === "Principle 1, 3 &6");

  // Derived totals stay out of the layout entirely.
  const derivedRows = new Set([21, 22, 30, 31, 36, 41, 46, 52, 53, 59, 60, 65, 73, 87, 91, 127, 128, 139, 140, 161, 217]);
  const derived = HR_LAYOUT.cells.filter((c) => c.templateRow != null && derivedRows.has(c.templateRow));
  t("no HR cell sits on a template total/percentage row", derived.length === 0,
    derived.map((c) => c.key).join(", "));

  // =========================================================================
  // 3. THE PROCUREMENT SAMPLE (three rows longer than the template)
  // =========================================================================
  const procParsed = await parseReturnWorkbook(readFileSync(PROC_SAMPLE));
  t("the Procurement sample parses", procParsed.ok, procParsed.error ?? "");
  const proc = procParsed.sheets?.find((s) => s.domain === "PROCUREMENT");
  if (!proc) throw new Error("Procurement sheet missing from parse result");

  t("every Proc block was found", proc.blocksNotFound.length === 0, proc.blocksNotFound.join("; "));
  t("nothing unparseable in Proc", proc.unparsedCells.length === 0,
    proc.unparsedCells.map((c) => `${c.sheetCell}=${c.rawText}`).join("; "));

  {
    const msme = cellOf(proc, "proc.msme_share");
    t("THE +3 ROW SHIFT RESOLVES: MSME share read from C44, written to C41",
      near(msme?.value, 0.3235) && msme?.sheetCell === "C44" && msme?.templateCell === "C41",
      `${msme?.sheetCell} -> ${msme?.templateCell} = ${msme?.value}`);
  }
  t("external-link formula contributes its cached result (Concrete tonnage)",
    near(valueOf(proc, "proc.material_nonrenew_1_qty"), 241743.72, 1e-2));
  t("renamed placeholder becomes the material name", textOf(proc, "proc.material_nonrenew_1_name") === "Concrete");
  t("recycled input material slot 1 name", textOf(proc, "proc.recycled_input_1_name") === "GGBS");
  t("recycled input material slot 1 share", near(valueOf(proc, "proc.recycled_input_1_pct"), 0.023680362823902935));
  t("recycled input material slot 3 share (surplus slot, no template cell)",
    near(valueOf(proc, "proc.recycled_input_3_pct"), 0.11559205701796726) &&
    cellOf(proc, "proc.recycled_input_3_pct")?.templateCell === null,
    String(cellOf(proc, "proc.recycled_input_3_pct")?.templateCell));
  t("the stray note row is reported as overflow, not silently eaten",
    proc.listOverflow.some((o) => /materials documented/i.test(o.name)),
    proc.listOverflow.map((o) => `${o.row}:${o.name}`).join("; "));
  t("total procurement budget survives as text", textOf(proc, "proc.budget_total_text") === "171.49 Crore");
  t("'NA' reclaimed products is not-available", cellOf(proc, "proc.reclaimed_products")?.isNotAvailable === true);
  {
    const total = cellOf(proc, "proc.inputs_total_wt");
    t("bottom-of-sheet inputs row found via offset (B131 -> B128)",
      near(total?.value, 644644.8551779999, 1e-3) && total?.sheetCell === "B131" && total?.templateCell === "B128",
      `${total?.sheetCell} -> ${total?.templateCell}`);
  }
  t("value-chain awareness coverage via unlabeled data row", near(valueOf(proc, "proc.vcp_awareness_coverage"), 0.0896));
  t("social-impact rows sequence past the template's formula rows",
    valueOf(proc, "proc.suppliers_social_improved") === 0 &&
    cellOf(proc, "proc.suppliers_social_improved")?.sheetCell === "D126",
    cellOf(proc, "proc.suppliers_social_improved")?.sheetCell);
  t("child-labour operation type text", textOf(proc, "proc.child_labour_risk_optype_text") === "Construction site");

  // =========================================================================
  // 4. ROW INSERTION DOES NOT BREAK THE PARSE
  // =========================================================================
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(readFileSync(HR_SAMPLE) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("HR")!;
    normalizeSharedFormulas(ws); // exceljs cannot re-serialise shared-formula clones after a splice
    ws.spliceRows(1, 0, [], []); // two rows above everything
    const shifted = await parseReturnWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
    const s = shifted.sheets?.find((x) => x.domain === "HR");
    t("two inserted rows shift nothing",
      s != null && valueOf(s, "hr.headcount_perm_emp_m") === 348 &&
      near(valueOf(s, "hr.wages_metro_paid"), 1567819511.6787522, 1e-3) &&
      textOf(s, "hr.security_thirdparty_text") === "yes",
      s ? `headcount=${valueOf(s, "hr.headcount_perm_emp_m")}` : "no sheet");
  }

  // =========================================================================
  // 5. EXPORT ROUND-TRIP: stub values → template tabs → parse back
  // =========================================================================
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);

    const stub = new Map<string, ReturnValue>([
      ["hr.headcount_perm_emp_m", { num: 400, text: null, monthNo: 3 }],
      ["hr.wellbeing_spend_text", { num: null, text: "2.10 Cr.", monthNo: 3 }],
      ["hr.wages_metro_paid", { num: 1234567.89, text: null, monthNo: 3 }],
      ["proc.msme_share", { num: 0.5, text: null, monthNo: 2 }],
      ["proc.material_nonrenew_1_name", { num: null, text: "Concrete", monthNo: 2 }],
      ["proc.material_nonrenew_1_qty", { num: 1000, text: null, monthNo: 2 }],
      ["proc.recycled_input_3_pct", { num: 0.1, text: null, monthNo: 2 }],
      ["proc.inputs_total_wt", { num: 9999, text: null, monthNo: 2 }],
    ]);

    const result = writeReturnSheets(wb, stub);
    t("export writes the writable stub values",
      result.changes.length === 7, // all but the surplus list slot
      String(result.changes.length));
    t("the surplus list slot is reported as unwritable, not dropped",
      result.unwritableListValues.some((u) => u.key === "proc.recycled_input_3_pct"),
      result.unwritableListValues.map((u) => u.key).join(", "));
    t("shared formulas were expanded on the HR tab before writing",
      result.sharedFormulasExpanded > 0, String(result.sharedFormulasExpanded));
    t("the latest month is reported per sheet",
      result.latestMonthBySheet["BRSR - HR"] === 3 && result.latestMonthBySheet["BRSR - Procurement"] === 2,
      JSON.stringify(result.latestMonthBySheet));

    // The workbook must survive serialisation AND parse back to the same values.
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const reread = await parseReturnWorkbook(buffer);
    t("the populated template parses back", reread.ok, reread.error ?? "");
    const rHr = reread.sheets?.find((s) => s.domain === "HR");
    const rProc = reread.sheets?.find((s) => s.domain === "PROCUREMENT");
    t("a number round-trips through the HR tab",
      rHr && valueOf(rHr, "hr.headcount_perm_emp_m") === 400,
      String(rHr && valueOf(rHr, "hr.headcount_perm_emp_m")));
    t("a text answer round-trips through the HR tab",
      rHr && textOf(rHr, "hr.wellbeing_spend_text") === "2.10 Cr.");
    t("a fraction round-trips through the Proc tab at the TEMPLATE row",
      rProc != null &&
      near(valueOf(rProc, "proc.msme_share"), 0.5) &&
      cellOf(rProc, "proc.msme_share")?.sheetCell === "C41",
      rProc ? `${cellOf(rProc, "proc.msme_share")?.sheetCell}` : "no sheet");
    t("the bottom inputs row lands at B128",
      rProc != null && valueOf(rProc, "proc.inputs_total_wt") === 9999 &&
      cellOf(rProc, "proc.inputs_total_wt")?.sheetCell === "B128");

    // Template arithmetic stays alive: the Total row above the headcount block
    // must still be a formula after the write.
    const totalCell = wb.getWorksheet("HR")!.getCell("C21").value;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stillFormula = totalCell != null && typeof totalCell === "object" && "formula" in (totalCell as any);
    t("template total-row formulas survive the write", stillFormula, JSON.stringify(totalCell).slice(0, 60));
  }

  // =========================================================================
  // 6. WHAT IT REFUSES
  // =========================================================================
  {
    const foreign = new ExcelJS.Workbook();
    foreign.addWorksheet("Sheet1").getCell("A1").value = "hello";
    const res = await parseReturnWorkbook(Buffer.from(await foreign.xlsx.writeBuffer()));
    t("a foreign workbook is refused", !res.ok);
    t("and the refusal names the expected tabs", /Proc,Supply Chain, MKt/.test(res.error ?? ""), res.error ?? "");
  }

  // ---- report --------------------------------------------------------------
  const pass = checks.filter((c) => c.ok).length;
  for (const c of checks) {
    console.log(`${c.ok ? "ok  " : "FAIL"} ${c.label}${c.detail ? `  ${c.detail}` : ""}`);
  }
  console.log(`\n${pass}/${checks.length} passed`);
  process.exit(pass === checks.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
