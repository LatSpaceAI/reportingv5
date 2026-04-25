// Quick inspector for the Cement-PPC-Proforma-BEE workbook.
// Usage: node scripts/inspect-ccts.mjs <path-to-xlsx>
import ExcelJS from "exceljs";
import { argv } from "node:process";

const file = argv[2] ?? "C:/Users/ishan/Downloads/Cement-PPC-Proforma-BEE (1).xlsx";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);

console.log("=== WORKBOOK OVERVIEW ===");
console.log("File:", file);
console.log("Sheets:");
for (const ws of wb.worksheets) {
  console.log(`  - "${ws.name}"  rows=${ws.rowCount}  cols=${ws.columnCount}`);
}

const sb = wb.worksheets.find((w) => /form[-\s_]*sb/i.test(w.name));
if (!sb) {
  console.log("\nNo 'Form Sb' sheet found. Listing first 60 rows of every sheet so we can spot it.");
  for (const ws of wb.worksheets) {
    console.log(`\n--- ${ws.name} ---`);
    dumpSheet(ws, 60);
  }
} else {
  console.log(`\n=== FORM Sb DUMP (${sb.name}) ===`);
  dumpSheet(sb, sb.rowCount);
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

function dumpSheet(ws, maxRows) {
  const limit = Math.min(maxRows, ws.rowCount);
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    const cells = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = row.getCell(c);
      const v = readCell(cell);
      if (v !== "" && v != null) {
        cells.push(`${colLabel(c)}${r}=${JSON.stringify(v)}${cell.formula ? `  [=${cell.formula}]` : ""}${cell.dataValidation ? `  [validation:${JSON.stringify(cell.dataValidation)}]` : ""}`);
      }
    }
    if (cells.length) console.log(cells.join("\n"));
  }

  // Also dump merge ranges so we can see header structure.
  const merges = ws.model?.merges ?? [];
  if (merges.length) {
    console.log("\nMerges:");
    for (const m of merges) console.log("  " + m);
  }
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
