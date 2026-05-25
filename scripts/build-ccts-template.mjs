// Builds public/ccts-template.xlsx from the upstream BEE aluminium pro-forma
// workbook. We strip baseline-year values from Form Sa1 and Annex CPP so
// every DC starts from a blank slate; formulas, formatting and the other
// sheets ship verbatim.
//
// Strip rules:
//   Form Sa1
//     - Cols E, F, G (Baseline Year 1/2/3 inputs) cleared for any row where
//       the cell is a plain literal (not a formula).
//     - Col I (Current/Assessment Year input) cleared similarly. Formula
//       cells in I are left intact since they recompute on open.
//   Annex CPP
//     - Cols C-J (baseline-year input blocks) and Cols K-S
//       (assessment-year input blocks) cleared where the cell is a plain
//       literal. Formula cells preserved.
//
// We don't touch dataValidation, style refs, or any other XML — only the
// `<v>…</v>` value (and `<is><t>…</t></is>` for inline strings) on the cells
// we want to blank.
import ExcelJS from "exceljs";
import { argv } from "node:process";
import { mkdir } from "node:fs/promises";

const inFile = argv[2] ?? "ALM0009UP CCTS proforma FY'23-24 final V1.4.xlsx";
const outFile = argv[3] ?? "public/ccts-template.xlsx";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(inFile);

function isFormulaCell(cell) {
  const v = cell.value;
  return !!(v && typeof v === "object" && ("formula" in v || "sharedFormula" in v));
}

function blankIfLiteral(cell) {
  if (cell == null) return false;
  if (cell.value == null) return false;
  if (isFormulaCell(cell)) return false;
  cell.value = null;
  return true;
}

// ── Form Sa1 ───────────────────────────────────────────────────────────────
const formSa1 = wb.worksheets.find((w) => /form[-\s_]*sa1/i.test(w.name));
if (!formSa1) throw new Error("Form Sa1 not found");

const SA1_INPUT_COLS = ["E", "F", "G", "I"]; // baseline 1/2/3 + assessment
const SA1_START = 11;  // first row beneath section headers I & II
const SA1_END = 1465;  // last row before the legend/declaration block

let sa1Cleared = 0;
for (let r = SA1_START; r <= SA1_END; r++) {
  const row = formSa1.getRow(r);
  for (const col of SA1_INPUT_COLS) {
    const cell = row.getCell(col);
    if (blankIfLiteral(cell)) sa1Cleared++;
  }
}
console.log(`Form Sa1: cleared ${sa1Cleared} baseline/assessment literal cells`);

// ── Annex CPP ──────────────────────────────────────────────────────────────
const annex = wb.worksheets.find((w) => /annex\s*cpp/i.test(w.name));
if (!annex) throw new Error("Annex CPP not found");

// Annex CPP unit-data rows broken into 5 blocks (see extract-annex-cpp.mjs).
const ACPP_UNIT_ROWS = [
  ...range(7, 16),   // block 1 OEM Curve
  ...range(25, 34),  // block 2 Operating Data
  ...range(45, 54),  // block 3.a PLF external
  ...range(61, 70),  // block 3.b PLF internal/external
  ...range(82, 91),  // block 4 Fuel Analysis
];
const ACPP_INPUT_COLS = [
  // Baseline-year input columns
  "C", "D", "E", "F", "G", "H", "I", "J",
  // Assessment-year input columns
  "K", "L", "M", "N", "O", "P", "Q", "R", "S",
];

let acppCleared = 0;
for (const r of ACPP_UNIT_ROWS) {
  const row = annex.getRow(r);
  for (const col of ACPP_INPUT_COLS) {
    const cell = row.getCell(col);
    if (blankIfLiteral(cell)) acppCleared++;
  }
}
// Also clear the "totals" row literals (rows 17, 35, 55, 71) — they're
// usually formulas, but a few are literals in the sample. Skip those that
// are formulas (preserved by blankIfLiteral).
for (const r of [17, 35, 55, 71]) {
  const row = annex.getRow(r);
  for (const col of ACPP_INPUT_COLS) {
    const cell = row.getCell(col);
    if (blankIfLiteral(cell)) acppCleared++;
  }
}
// Auxiliary power consumption row 37 (col E-J = baseline, col K-R =
// assessment). The block 2 schema didn't include it but BEE filled it in
// the sample anyway; strip it for consistency.
for (const col of ACPP_INPUT_COLS) {
  const cell = annex.getRow(37).getCell(col);
  if (blankIfLiteral(cell)) acppCleared++;
}
console.log(`Annex CPP: cleared ${acppCleared} baseline/assessment literal cells`);

// ── Write ──────────────────────────────────────────────────────────────────
await mkdir("public", { recursive: true });
await wb.xlsx.writeFile(outFile);
console.log(`Wrote ${outFile}`);

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
