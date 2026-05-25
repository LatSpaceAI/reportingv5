// Aluminium pro-forma inspector. Dumps Form Sa1 with column-letter prefixes
// and any formulas / data-validation on each cell.
import ExcelJS from "exceljs";
import { argv } from "node:process";

const file = argv[2];
if (!file) {
  console.error("Usage: node inspect-alm.mjs <xlsx>");
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);

const sb = wb.worksheets.find((w) => /form[-\s_]*sa1/i.test(w.name)) ?? wb.worksheets.find((w) => /form[-\s_]*sa/i.test(w.name));
if (!sb) {
  console.error("Form Sa1 sheet not found. Available:", wb.worksheets.map((w) => w.name));
  process.exit(2);
}

console.log(`=== ${sb.name} ===`);
console.log(`rows=${sb.rowCount} cols=${sb.columnCount}`);

const maxCol = Math.min(sb.columnCount, 30);
const maxRow = Math.min(sb.rowCount, 1500);

for (let r = 1; r <= maxRow; r++) {
  const row = sb.getRow(r);
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
    if ("hyperlink" in v) return v.text ?? v.hyperlink;
    if (v instanceof Date) return v.toISOString();
  }
  return v;
}
