// Extracts the data-entry skeleton of Form-Sb.
// Walks every row of the Form-Sb sheet and emits a JSON line per row containing:
//  - code  (column A)
//  - label (column B)
//  - basis (column C)
//  - unit  (column D)
//  - eFormula  (formula in E if any — formula rows are computed, not user-entered)
//  - eValidation (Excel data validation on E — list / decimal / etc)
//  - eDefault  (E value if a literal default exists, e.g. "Not Applicable")
//  - source (column J — "Source of Data")
//  - remarks (column K)
// We use this to figure out which rows in column E need a UI input vs which are computed.
import ExcelJS from "exceljs";

const file = "C:/Users/ishan/Downloads/Cement-PPC-Proforma-BEE (1).xlsx";
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const sb = wb.worksheets.find((w) => /form[-\s_]*sb/i.test(w.name));
if (!sb) throw new Error("Form-Sb sheet not found");

const out = [];
for (let r = 1; r <= sb.rowCount; r++) {
  const row = sb.getRow(r);
  const codeRaw = readCell(row.getCell(1));
  const labelRaw = readCell(row.getCell(2));
  const basisRaw = readCell(row.getCell(3));
  const unitRaw = readCell(row.getCell(4));
  const eCell = row.getCell(5);
  const fCell = row.getCell(6);
  const sourceRaw = readCell(row.getCell(10));
  const remarksRaw = readCell(row.getCell(11));

  // Skip obvious header rows / fully-empty rows
  if (codeRaw === "" && labelRaw === "" && eCell.value == null && fCell.value == null) continue;

  const eFormula = extractFormula(eCell);
  const eDefault = eFormula ? null : eCell.value ?? null;
  const eValidation = eCell.dataValidation ?? null;

  out.push({
    row: r,
    code: codeRaw || "",
    label: typeof labelRaw === "string" ? labelRaw : "",
    basis: typeof basisRaw === "string" ? basisRaw : "",
    unit: typeof unitRaw === "string" ? unitRaw : "",
    eFormula,
    eDefault: eFormula ? null : (typeof eDefault === "object" ? null : eDefault),
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
