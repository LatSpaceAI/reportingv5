#!/usr/bin/env node
// Round-trips the Scope 3 ledger workbook: generate → fill → parse.
//
// No database. The layout, generator and parser are pure, so the whole contract
// is exercised offline. Runs in esg:check.
//
// THE LOAD-BEARING ASSERTIONS
//
//   1. The attrs contract. Every key the parser writes must be one that
//      resolve-scope3.mjs reads, and every key the computation reads must be one
//      some column writes. A mismatch means a figure someone filed that the
//      computation cannot see — the worst failure this path has, and completely
//      silent. Checked against scripts/lib/scope3-methods.mjs itself, not
//      against a copy of the list.
//
//   2. Column location by HEADER TEXT, not index. Inserting a column between two
//      others must not break an import, because the ESG team will do exactly
//      that the first time they want a working note beside a figure.
//
//   3. A blank cell is not a zero, and a row with no Line ID is reported rather
//      than silently dropped.
//
// Usage: tsx scripts/test-scope3-ledger.ts

import { readFileSync } from "node:fs";

import ExcelJS from "exceljs";

import { generateLedgerWorkbook } from "../src/lib/scope3Ledger/generateLedger";
import { parseLedgerWorkbook } from "../src/lib/scope3Ledger/parseLedger";
import {
  LEDGER_META_CELLS,
  LEDGER_META_SHEET,
  LEDGER_SHEETS,
  LEDGER_TEMPLATE_ID,
  LEDGER_TEMPLATE_VERSION,
  attrsByLedger,
  ledgerByCode,
} from "../src/lib/scope3Ledger/ledgerLayout";

const checks: { label: string; ok: boolean; detail: string }[] = [];
const t = (label: string, ok: unknown, detail: unknown = "") =>
  checks.push({ label, ok: Boolean(ok), detail: String(detail ?? "") });

const GEN = {
  fiscalYear: "2025-26",
  siteOptions: [
    { code: "AURORA", name: "Birla Aurora" },
    { code: "TISYA", name: "Birla Tisya" },
    { code: "TRIMAYA", name: "Birla Trimaya" },
  ],
  monthOptions: [
    "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09",
    "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
  ],
  generatedAt: "2026-08-13T00:00:00.000Z",
};

/** Finds a sheet's header row and its column index by header text. */
function locate(ws: ExcelJS.Worksheet, header: string): { row: number; col: number } {
  const want = header.replace(/\s+/g, " ").trim().toLowerCase();
  for (let r = 1; r <= Math.min(ws.rowCount, 40); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= Math.max(row.cellCount, 20); c++) {
      const v = row.getCell(c).value;
      const text = typeof v === "string" ? v : v == null ? "" : String(v);
      if (text.replace(/\s+/g, " ").trim().toLowerCase() === want) return { row: r, col: c };
    }
  }
  return { row: 0, col: 0 };
}

async function main() {
  // =========================================================================
  // 1. THE ATTRS CONTRACT
  //
  // Asserted against the real computation source, so adding a column that
  // nothing reads — or renaming an attr the computation depends on — fails here
  // rather than producing a silently understated category.
  // =========================================================================
  const methodsSrc = readFileSync(
    new URL("../scripts/lib/scope3-methods.mjs", import.meta.url),
    "utf8"
  );
  const schemaSrc = readFileSync(
    new URL("../supabase/esg/13_scope3_schema.sql", import.meta.url),
    "utf8"
  );

  // Every attrs key the methods read. Three access forms, matched separately:
  //   a.foo            destructured `const a = line.attrs`
  //   l.attrs?.foo     direct, in the aggregate methods
  //   sum("foo")       the aggregate helper, which takes the key as a string
  //
  // The computed form `l.attrs?.[key]` is deliberately NOT matched: `key` there
  // is the helper's parameter name, not an attrs key, and the sum("...") calls
  // that supply it are already covered.
  const readKeys = new Set<string>();
  for (const m of methodsSrc.matchAll(/\ba\.([a-z_0-9]+)/g)) readKeys.add(m[1]);
  for (const m of methodsSrc.matchAll(/attrs\?\.([a-z_0-9]+)/g)) readKeys.add(m[1]);
  for (const m of methodsSrc.matchAll(/sum\("([a-z_0-9]+)"\)/g)) readKeys.add(m[1]);
  // `attrs` itself is the container, not a key.
  readKeys.delete("attrs");

  const written = attrsByLedger();
  const allWritten = new Set(Object.values(written).flat());

  const unreadable = [...readKeys].filter((k) => !allWritten.has(k));
  t(
    "every attrs key the computation reads is written by some column",
    unreadable.length === 0,
    unreadable.length ? `NOT WRITTEN: ${unreadable.join(", ")}` : `${readKeys.size} keys read`
  );

  // The reverse direction is a warning rather than a failure: `notes`,
  // `supplier_code` and the pincodes are deliberately descriptive-only, kept
  // because an assurer asks where a delivery came from.
  const DESCRIPTIVE_ONLY = new Set([
    "notes", "supplier_code", "description", "order_unit", "hsn_code",
    "supplier_pincode", "site_pincode", "agency", "is_hazardous", "function",
    "handover_fy", "epi_source", "area_basis", "unit", "transport_mode",
    "doc_date", "project_code", "project", "property", "site_name", "month",
  ]);
  const deadColumns = [...allWritten].filter(
    (k) => !readKeys.has(k) && !DESCRIPTIVE_ONLY.has(k)
  );
  t(
    "no column collects data nothing reads and nothing documents",
    deadColumns.length === 0,
    deadColumns.length ? `DEAD: ${deadColumns.join(", ")}` : "all columns accounted for"
  );

  // The schema file documents the same contract in prose. Its per-ledger key
  // list must mention every key the layout writes, or the two have drifted.
  const undocumented: string[] = [];
  for (const [ledger, keys] of Object.entries(written)) {
    for (const k of keys) {
      if (DESCRIPTIVE_ONLY.has(k) && k === "notes") continue;
      if (!schemaSrc.includes(k)) undocumented.push(`${ledger}.${k}`);
    }
  }
  t(
    "13_scope3_schema.sql documents every attrs key the layout writes",
    undocumented.length === 0,
    undocumented.length ? `MISSING FROM SCHEMA DOC: ${undocumented.join(", ")}` : "all documented"
  );

  // The ledger codes must match the seeded s3_ledger rows exactly, or a commit
  // violates the foreign key.
  const seededCodes = [...schemaSrc.matchAll(/^\('([a-z_]+)',\s*'INPUT - \d/gm)].map((m) => m[1]);
  const layoutCodes = LEDGER_SHEETS.map((l) => l.code);
  t(
    "layout ledger codes match the seeded s3_ledger rows",
    layoutCodes.length === seededCodes.length && layoutCodes.every((c) => seededCodes.includes(c)),
    `layout ${layoutCodes.length}, seeded ${seededCodes.length}`
  );

  // =========================================================================
  // 2. GENERATE
  // =========================================================================
  const blank = await generateLedgerWorkbook(GEN);
  t("generates a non-trivial workbook", blank.length > 20000, `${blank.length} bytes`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(blank as unknown as ArrayBuffer);

  t(
    "one sheet per ledger, plus Instructions, Lists and the stamp",
    wb.worksheets.length === LEDGER_SHEETS.length + 3,
    wb.worksheets.map((w) => w.name).join(", ")
  );

  const meta = wb.getWorksheet(LEDGER_META_SHEET);
  t("version stamp is present", meta?.getCell(LEDGER_META_CELLS.version).value === LEDGER_TEMPLATE_VERSION);
  t("template id is stamped", meta?.getCell(LEDGER_META_CELLS.templateId).value === LEDGER_TEMPLATE_ID);
  t(
    "the stamp sheet is veryHidden, so it cannot be casually deleted",
    meta?.state === "veryHidden",
    meta?.state
  );
  t(
    "the fiscal year is stamped, so a mis-filed year is catchable",
    meta?.getCell(LEDGER_META_CELLS.fiscalYear).value === GEN.fiscalYear
  );

  // Dropdowns on the columns whose values are lookup keys. A typo in one of
  // these contributes ZERO to its category while looking like a filled-in row,
  // which is the whole reason they are validated at source.
  const proc = wb.getWorksheet("1 Procurement")!;
  const tagAt = locate(proc, "Scope 3 tag");
  const tagCell = proc.getCell(tagAt.row + 1, tagAt.col);
  t(
    "the Scope 3 tag column carries data validation",
    tagCell.dataValidation?.type === "list",
    tagCell.dataValidation?.type
  );
  t(
    "a short list is inlined",
    String(tagCell.dataValidation?.formulae?.[0] ?? "").startsWith('"Cat 1'),
    String(tagCell.dataValidation?.formulae?.[0] ?? "").slice(0, 30)
  );

  // Spend category is 432 characters joined — well past Excel's 255-char inline
  // limit — so it MUST point at the Lists sheet. Getting this wrong does not
  // error: Excel silently drops the validation and the column becomes free text.
  const spendAt = locate(proc, "Spend category");
  const spendCell = proc.getCell(spendAt.row + 1, spendAt.col);
  const rangeRef = String(spendCell.dataValidation?.formulae?.[0] ?? "");
  t(
    "a list too long to inline points at the Lists sheet instead",
    rangeRef.startsWith("Lists!"),
    rangeRef
  );

  const lists = wb.getWorksheet("Lists")!;
  const colLetter = rangeRef.match(/\$([A-Z]+)\$/)?.[1] ?? "";
  const colIdx = colLetter.split("").reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0);
  t(
    "that range actually holds the spend categories",
    colIdx > 0 && String(lists.getCell(2, colIdx).value ?? "") === "Construction and civil works",
    `col ${colLetter}(${colIdx}) row 2 = ${String(lists.getCell(2, colIdx).value ?? "")}`
  );

  // The range must END at the last value. A range running past them would offer
  // blank entries, and a blank picked from a dropdown is indistinguishable from
  // a cell nobody touched.
  const endRow = Number(rangeRef.match(/\$(\d+)$/)?.[1] ?? 0);
  t(
    "the range stops at the last value, so the dropdown has no blank entries",
    endRow > 1 && String(lists.getCell(endRow, colIdx).value ?? "") === "Other goods and services",
    `ends at row ${endRow} = ${String(lists.getCell(endRow, colIdx).value ?? "")}`
  );

  // =========================================================================
  // 3. FILL — the workbook's own example rows
  // =========================================================================
  const set = (sheet: string, lineNo: number, header: string, value: string | number) => {
    const ws = wb.getWorksheet(sheet)!;
    const at = locate(ws, header);
    if (!at.row) throw new Error(`header '${header}' not found on ${sheet}`);
    ws.getCell(at.row + lineNo, at.col).value = value;
  };

  set("1 Procurement", 1, "Supplier name", "Example Cement Ltd");
  set("1 Procurement", 1, "Net order value (INR)", 4200000);
  set("1 Procurement", 1, "Scope 3 tag", "EXCLUDE - counted by tonnage on Materials sheet");
  set("1 Procurement", 1, "Spend category", "Cement lime and plaster");
  set("1 Procurement", 1, "Project / plant code", "Birla Tisya");

  // A line with a value but NO tag — the double-counting guard's target.
  set("1 Procurement", 2, "Supplier name", "Forgot To Tag Ltd");
  set("1 Procurement", 2, "Net order value (INR)", 1200000);

  set("2 Materials", 1, "Project / site", "Birla Tisya");
  set("2 Materials", 1, "Material type", "Cement - OPC");
  set("2 Materials", 1, "Quantity as recorded", 600);
  set("2 Materials", 1, "Unit", "MT (tonnes)");
  set("2 Materials", 1, "Conversion to tonnes", 1);
  set("2 Materials", 1, "Supplier EPD available? (Y/N)", "N");
  set("2 Materials", 1, "Straight-line distance (km)", 38);
  set("2 Materials", 1, "Road circuity factor", 1.3);
  set("2 Materials", 1, "Freight vehicle type", "Rigid truck 16-25t");

  set("4 Energy and Fuel", 1, "Site", "Birla Aurora");
  set("4 Energy and Fuel", 1, "Month (YYYY-MM)", "2025-04");
  set("4 Energy and Fuel", 1, "Grid electricity (kWh)", 271906);
  // Deliberately left blank: renewable open access. A blank must parse as
  // ABSENT, not as zero.
  set("4 Energy and Fuel", 1, "Diesel - stationary DG (litres)", 1240);

  set("5 Waste", 1, "Site", "Birla Tisya");
  set("5 Waste", 1, "Month (YYYY-MM)", "2025-04");
  set("5 Waste", 1, "Waste stream", "Construction and demolition");
  set("5 Waste", 1, "Quantity (tonnes)", 145.5);
  set("5 Waste", 1, "Disposal route", "Landfill");

  // An SAP-style number with separators and a currency symbol.
  set("1 Procurement", 3, "Supplier name", "Example Contractors");
  set("1 Procurement", 3, "Net order value (INR)", "₹ 50,000,000");
  set("1 Procurement", 3, "Scope 3 tag", "Cat 1 - Purchased goods and services");
  set("1 Procurement", 3, "Spend category", "Construction and civil works");

  // A row carrying data but no Line ID — must be reported, not dropped.
  {
    const ws = wb.getWorksheet("3 Inbound Freight")!;
    const at = locate(ws, "Line ID");
    const supplierAt = locate(ws, "Supplier");
    ws.getCell(at.row + 4, at.col).value = null;
    ws.getCell(at.row + 4, supplierAt.col).value = "Orphan Row Ltd";
  }

  const filled = Buffer.from(await wb.xlsx.writeBuffer());

  // =========================================================================
  // 4. PARSE
  // =========================================================================
  const parsed = await parseLedgerWorkbook(filled);
  t("the filled workbook parses", parsed.ok, parsed.error ?? "");
  t("the fiscal year survives the round trip", parsed.fiscalYear === GEN.fiscalYear, parsed.fiscalYear);

  const sheetOf = (code: string) => parsed.sheets?.find((s) => s.ledger === code);

  const procSheet = sheetOf("procurement")!;
  t("procurement rows parsed", procSheet.rows.length === 3, `${procSheet.rows.length}`);

  const line1 = procSheet.rows.find((r) => r.lineNo === 1)!;
  t("the order value parsed", line1.attrs.order_value_inr === 4200000, line1.attrs.order_value_inr);
  t(
    "the Scope 3 tag parsed verbatim, so the EXCLUDE prefix still matches",
    line1.attrs.s3_tag === "EXCLUDE - counted by tonnage on Materials sheet",
    line1.attrs.s3_tag
  );
  t("the site name is exposed for resolution", line1.siteName === "Birla Tisya", line1.siteName);

  const line2 = procSheet.rows.find((r) => r.lineNo === 2)!;
  t(
    "an untagged line parses and reports its missing required field",
    line2.attrs.s3_tag === undefined && line2.missingRequired.includes("Scope 3 tag"),
    line2.missingRequired.join(", ")
  );

  const line3 = procSheet.rows.find((r) => r.lineNo === 3)!;
  t(
    "an SAP-style '₹ 50,000,000' parses to a number",
    line3.attrs.order_value_inr === 50000000,
    line3.attrs.order_value_inr
  );

  const matSheet = sheetOf("materials")!;
  const mat1 = matSheet.rows.find((r) => r.lineNo === 1)!;
  t("material tonnage parsed", mat1.attrs.quantity_recorded === 600, mat1.attrs.quantity_recorded);
  t("circuity parsed", mat1.attrs.circuity === 1.3, mat1.attrs.circuity);
  t("vehicle type parsed", mat1.attrs.vehicle_type === "Rigid truck 16-25t", mat1.attrs.vehicle_type);

  const energy = sheetOf("energy_fuel")!;
  const e1 = energy.rows.find((r) => r.lineNo === 1)!;
  t("grid electricity parsed", e1.attrs.grid_kwh === 271906, e1.attrs.grid_kwh);
  t(
    "A BLANK CELL IS ABSENT, NOT ZERO",
    !("renewable_openaccess_kwh" in e1.attrs),
    `renewable_openaccess_kwh = ${JSON.stringify(e1.attrs.renewable_openaccess_kwh)}`
  );
  t("the month is exposed for resolution", e1.month === "2025-04", e1.month);

  const waste = sheetOf("waste")!;
  const w1 = waste.rows.find((r) => r.lineNo === 1)!;
  t(
    "waste stream and route both parse, so the composite key can be built",
    w1.attrs.waste_stream === "Construction and demolition" && w1.attrs.disposal_route === "Landfill",
    `${w1.attrs.waste_stream} | ${w1.attrs.disposal_route}`
  );

  const freight = sheetOf("inbound_freight")!;
  const orphan = freight.rows.find((r) => r.lineNo === 0);
  t(
    "a row with data but no Line ID is REPORTED, not silently dropped",
    orphan !== undefined && orphan.missingRequired.includes("Line ID"),
    orphan ? orphan.missingRequired.join(", ") : "not reported"
  );
  t(
    "genuinely blank rows are counted, not reported as problems",
    freight.blankCount > 100,
    `${freight.blankCount} blank`
  );

  // =========================================================================
  // 5. THE PARSE CONTRACT — location by header text, not index
  // =========================================================================
  {
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(filled as unknown as ArrayBuffer);
    const ws = wb2.getWorksheet("1 Procurement")!;
    // Insert a working-note column between two existing ones, which is exactly
    // what someone does the first week they use this.
    ws.spliceColumns(3, 0, []);
    const at = locate(ws, "Line ID");
    ws.getCell(at.row, 3).value = "Someone's working note";

    const shifted = await parseLedgerWorkbook(Buffer.from(await wb2.xlsx.writeBuffer()));
    const s = shifted.sheets?.find((x) => x.ledger === "procurement");
    const l1 = s?.rows.find((r) => r.lineNo === 1);
    t(
      "inserting a column does not break the parse",
      l1?.attrs.order_value_inr === 4200000,
      l1?.attrs.order_value_inr
    );
    t(
      "an unrecognised column is reported rather than ignored",
      s?.unknownHeaders.includes("Someone's working note"),
      (s?.unknownHeaders ?? []).join(", ")
    );
  }

  {
    const wb3 = new ExcelJS.Workbook();
    await wb3.xlsx.load(filled as unknown as ArrayBuffer);
    const ws = wb3.getWorksheet("5 Waste")!;
    ws.spliceRows(1, 0, [], []); // two rows above the table
    const shifted = await parseLedgerWorkbook(Buffer.from(await wb3.xlsx.writeBuffer()));
    const s = shifted.sheets?.find((x) => x.ledger === "waste");
    t(
      "inserting rows above the table does not break the parse",
      s?.rows.find((r) => r.lineNo === 1)?.attrs.quantity_tonnes === 145.5,
      s?.rows.find((r) => r.lineNo === 1)?.attrs.quantity_tonnes
    );
  }

  // =========================================================================
  // 6. WHAT IT REFUSES
  // =========================================================================
  {
    const foreign = new ExcelJS.Workbook();
    foreign.addWorksheet("Sheet1").getCell("A1").value = "hello";
    const res = await parseLedgerWorkbook(Buffer.from(await foreign.xlsx.writeBuffer()));
    t("a workbook with no stamp is refused", !res.ok, res.error?.slice(0, 60));
    t(
      "and the refusal names where the file should have gone instead",
      /Site return|calculator/i.test(res.error ?? ""),
      ""
    );
  }

  {
    const wrong = new ExcelJS.Workbook();
    await wrong.xlsx.load(blank as unknown as ArrayBuffer);
    wrong.getWorksheet(LEDGER_META_SHEET)!.getCell(LEDGER_META_CELLS.version).value = "9.9.9";
    const res = await parseLedgerWorkbook(Buffer.from(await wrong.xlsx.writeBuffer()));
    t("an unsupported version is refused, not read hopefully", !res.ok, res.versionFound);
  }

  // =========================================================================
  // 7. SINGLE-LEDGER GENERATION
  // =========================================================================
  {
    const one = await generateLedgerWorkbook({ ...GEN, onlyLedger: "waste" });
    const wb4 = new ExcelJS.Workbook();
    await wb4.xlsx.load(one as unknown as ArrayBuffer);
    t(
      "a single-ledger workbook holds just that sheet",
      wb4.worksheets.length === 4 && wb4.getWorksheet("5 Waste") !== undefined,
      wb4.worksheets.map((w) => w.name).join(", ")
    );
    const res = await parseLedgerWorkbook(one);
    t("and it parses as a valid workbook", res.ok && res.sheets?.length === 1, res.error ?? "");
  }

  // =========================================================================
  // 8. EVERY LEDGER IS REACHABLE AND COHERENT
  // =========================================================================
  for (const spec of LEDGER_SHEETS) {
    const ws = wb.getWorksheet(spec.sheet);
    const anchor = ws ? locate(ws, "Line ID") : { row: 0, col: 0 };
    t(
      `${spec.sheet}: sheet exists with a locatable header`,
      Boolean(ws) && anchor.row > 0,
      anchor.row ? `header row ${anchor.row}` : "MISSING"
    );
    t(
      `${spec.sheet}: declared in s3_ledger and matched by code`,
      ledgerByCode(spec.code) !== undefined
    );
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
