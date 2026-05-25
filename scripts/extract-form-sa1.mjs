// Extracts the data-entry skeleton of "Form Sa1" (Aluminium pro-forma).
// Walks every row of the sheet and emits a JSON line per row:
//  - row, code (col A), label (col B), basis (col C), unit (col D)
//  - iFormula  (formula in I if any — formula rows are computed, not user-entered)
//  - iDefault  (literal default in column I, if any)
//  - iValidationKind / iValidationFormula (Excel data validation on column I)
//  - eFormula / eDefault / eValidationKind / eValidationFormula
//      (fallback — column I sometimes lacks DV/defaults but column E carries the
//      authoritative validation rules; the generator falls back to E for those.)
//  - source (col J), remarks (col K)
//
// Column I is the "Current/Assessment/Target Year" input column where user
// answers should write on export.
import ExcelJS from "exceljs";
import { argv } from "node:process";

const file = argv[2] ?? "ALM0009UP CCTS proforma FY'23-24 final V1.4.xlsx";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const sb =
  wb.worksheets.find((w) => /form[-\s_]*sa1/i.test(w.name)) ??
  wb.worksheets.find((w) => /form[-\s_]*sa/i.test(w.name));
if (!sb) throw new Error("Form Sa1 sheet not found. Sheets: " + wb.worksheets.map((w) => w.name).join(", "));

const out = [];
for (let r = 1; r <= sb.rowCount; r++) {
  const row = sb.getRow(r);
  const codeRaw = readCell(row.getCell(1));
  const labelRaw = readCell(row.getCell(2));
  const basisRaw = readCell(row.getCell(3));
  const unitRaw = readCell(row.getCell(4));
  const eCell = row.getCell(5); // baseline year input
  const iCell = row.getCell(9); // current/assessment year input (the column we write on export)
  const sourceRaw = readCell(row.getCell(10));
  const remarksRaw = readCell(row.getCell(11));

  // Skip rows that have absolutely nothing useful
  if (
    codeRaw === "" &&
    labelRaw === "" &&
    eCell.value == null &&
    iCell.value == null
  )
    continue;

  const iFormula = extractFormula(iCell);
  const eFormula = extractFormula(eCell);

  // Determine "what kind of input this is" by preferring column-I metadata,
  // falling back to column-E. Column I tends to be empty for inputs (defaults
  // are populated in E only) but Excel still attaches DV to both columns.
  const iValidation = iCell.dataValidation ?? null;
  const eValidation = eCell.dataValidation ?? null;

  out.push({
    row: r,
    code: codeRaw || "",
    label: typeof labelRaw === "string" ? labelRaw : "",
    basis: typeof basisRaw === "string" ? basisRaw : "",
    unit: typeof unitRaw === "string" ? unitRaw : "",
    iFormula,
    iDefault: iFormula ? null : (typeof iCell.value === "object" ? null : iCell.value ?? null),
    iValidationKind: iValidation?.type ?? null,
    iValidationFormula: iValidation?.formulae ?? null,
    eFormula,
    eDefault: eFormula ? null : (typeof eCell.value === "object" ? null : eCell.value ?? null),
    eValidationKind: eValidation?.type ?? null,
    eValidationFormula: eValidation?.formulae ?? null,
    source: typeof sourceRaw === "string" ? sourceRaw : "",
    remarks: typeof remarksRaw === "string" ? remarksRaw : "",
  });
}

console.log(JSON.stringify(out, null, 2));

function readCell(cell) {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return v.text;
    if ("result" in v) return v.result ?? "";
    if ("formula" in v) return `=${v.formula}`;
    if (v instanceof Date) return v.toISOString();
  }
  return v;
}

function extractFormula(cell) {
  const v = cell.value;
  if (v && typeof v === "object" && "formula" in v) return v.formula;
  if (v && typeof v === "object" && "sharedFormula" in v) return `=>${v.sharedFormula}`;
  return null;
}
