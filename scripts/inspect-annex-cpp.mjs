// Dump the "Annex CPP" sheet from the aluminium workbook.
import ExcelJS from "exceljs";
import { argv } from "node:process";

const file = argv[2];
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);

const sheet = wb.worksheets.find((w) => /annex\s*cpp/i.test(w.name));
if (!sheet) {
  console.error("Annex CPP not found");
  process.exit(1);
}

console.log(`=== ${sheet.name} === rows=${sheet.rowCount} cols=${sheet.columnCount}`);
const maxCol = Math.min(sheet.columnCount, 30);
for (let r = 1; r <= sheet.rowCount; r++) {
  const row = sheet.getRow(r);
  const cells = [];
  for (let c = 1; c <= maxCol; c++) {
    const cell = row.getCell(c);
    const v = readCell(cell);
    if (v !== "" && v != null) {
      const f = cell.formula ? ` [=${cell.formula}]` : "";
      const dv = cell.dataValidation ? ` [dv:${JSON.stringify(cell.dataValidation).slice(0,80)}]` : "";
      cells.push(`${colLabel(c)}${r}=${JSON.stringify(v)}${f}${dv}`);
    }
  }
  if (cells.length) console.log(cells.join(" | "));
}

function colLabel(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function readCell(cell) {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return v.text;
    if ("result" in v) return v.result;
    if ("formula" in v) return `=${v.formula}`;
    if (v instanceof Date) return v.toISOString();
  }
  return v;
}
