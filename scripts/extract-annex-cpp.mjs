// Extracts assessment-year input fields from the "Annex CPP" sheet of the
// Aluminium pro-forma and emits a Section[] JSON ready to fold into
// cctsSections.ts.
//
// Annex CPP is wide (19 cols) and table-shaped: 10 captive-power-plant units
// (rows 7-16, 25-34, 45-54, 61-70, 82-91) each have several attributes in
// adjacent columns. The columns are split into a baseline-year block and an
// assessment/current-year block. The baseline block ships pre-filled (and is
// stripped from our template on build); we only generate fields for the
// assessment-year columns.
//
// Section breakdown:
//  1. OEM Curve / HBD data            (rows 4-17, header cols C-M, single block — no baseline/assessment split)
//  2. Unit-wise Operating Data        (rows 21-35, baseline C-J, assessment K-R)
//  3.a PLF: External factor loss      (rows 40-55, baseline C-J, assessment K-R)
//  3.b PLF: Internal/External loss    (rows 57-71, baseline C-J, assessment K-R)
//  4.  Unit-wise Fuel Analysis        (rows 78-92, baseline D-J, assessment K-Q)
//
// Each row in a unit-block becomes a Question (one per unit), with the
// assessment-year columns as fields. Field ids carry an "ACPP!" sheet prefix
// so the export-mapper can route the patch to Annex CPP.
import ExcelJS from "exceljs";
import { argv } from "node:process";
import { writeFile } from "node:fs/promises";

const file = argv[2];
if (!file) {
  console.error("Usage: node extract-annex-cpp.mjs <xlsx>");
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const sheet = wb.worksheets.find((w) => /annex\s*cpp/i.test(w.name));
if (!sheet) throw new Error("Annex CPP sheet not found");

function colLetter(n) {
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
    if ("result" in v) return v.result ?? "";
    if ("formula" in v) return `=${v.formula}`;
    if (v instanceof Date) return v.toISOString();
  }
  return v;
}

function isCellFormula(cell) {
  const v = cell.value;
  return !!(v && typeof v === "object" && ("formula" in v || "sharedFormula" in v));
}

// Block definitions describe each table:
//  - headerRows: which rows hold the column-meaning labels (multiple stacked
//    label rows; we concatenate them per column).
//  - unitRows: rows containing actual unit data (one per row).
//  - assessmentCols: column letters that are user-input assessment-year cols.
//
// We hand-coded these from the workbook dump rather than trying to detect
// them programmatically — the layout is bespoke per block.

const BLOCKS = [
  {
    sectionTitle: "1. OEM Curve / HBD Data (Design Capacity)",
    description: "Original Equipment Manufacturer design data per unit. Heat-rate / boiler-efficiency at design capacity.",
    headerRows: [4, 5, 6],     // col-meaning headers stacked across rows 4-6
    labelCol: "B",              // Unit label (Unit-1, Unit-2, ...)
    unitRows: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    assessmentCols: ["C", "D", "E", "G", "H", "I", "J", "K", "L"],
    // Skip cols already populated by shared formula (F, M, N, O, P, Q, R, S are
    // mostly formulas or remarks).
  },
  {
    sectionTitle: "2. Unit-wise Operating Data — Assessment Year",
    description: "Operating Load / ULF / Gross Generation / Unit Heat Rate per unit for the assessment year.",
    headerRows: [22, 23, 24],
    labelCol: "B",
    unitRows: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34],
    assessmentCols: ["K", "L", "M", "N", "O", "P", "Q", "R"],
  },
  {
    sectionTitle: "3.a PLF — Loss due to External Factors (Assessment Year)",
    description: "Average Operating Load (MW) caused by low ULF — Coal Unavailability / Scheduling / Backing-down / any external factor.",
    headerRows: [43, 44],
    labelCol: "B",
    unitRows: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54],
    assessmentCols: ["K", "L", "M", "N", "O", "P", "Q", "R"],
  },
  {
    sectionTitle: "3.b PLF — Forced/Planned Outage & ULF (Assessment Year)",
    description: "Capacity / Forced Outage / Planned Maintenance Outage / Unit Availability Factor / Average Operating Load due to Internal vs External factors.",
    headerRows: [59, 60],
    labelCol: "B",
    unitRows: [61, 62, 63, 64, 65, 66, 67, 68, 69, 70],
    assessmentCols: ["K", "L", "M", "N", "O", "P", "Q", "R"],
  },
  {
    sectionTitle: "4. Unit-wise Fuel Analysis (As-Fired Basis) — Assessment Year",
    description: "Coal proximate + ultimate analysis per unit: Volatile Matter, Moisture, Ash, GCV, Hydrogen, Sulphur, Nitrogen.",
    headerRows: [79, 80, 81],
    labelCol: "B",
    unitRows: [82, 83, 84, 85, 86, 87, 88, 89, 90, 91],
    assessmentCols: ["K", "L", "M", "N", "O", "P", "Q"],
  },
];

function getText(row, col) {
  const v = readCell(sheet.getRow(row).getCell(col));
  return typeof v === "string" ? v.trim() : (v ?? "");
}

function isYearLabel(s) {
  if (typeof s !== "string") return false;
  const trimmed = s.trim();
  // Skip column-header rows that just announce the year block name.
  return /^(Baseline\/Previous Year|Assesment year|Assessment Year|Source of Data|Remarks)/i.test(trimmed);
}

function columnTitleFor(block, col) {
  // Concatenate non-year-label header text across the block's headerRows.
  const parts = [];
  for (const r of block.headerRows) {
    const t = getText(r, col);
    if (!t) continue;
    if (isYearLabel(t)) continue;
    if (parts.includes(t)) continue;
    parts.push(t);
  }
  return parts.join(" — ");
}

const sections = [];

for (const block of BLOCKS) {
  const section = {
    id: `sec_acpp_${block.sectionTitle.split(/[.\s]/)[0]}_${block.unitRows[0]}`.replace(/[^\w]/g, "_"),
    title: block.sectionTitle,
    sheetRef: "Annex CPP",
    questions: [],
  };

  // One Question per unit (so 10 questions per block).
  for (const unitRow of block.unitRows) {
    const unitLabel = getText(unitRow, block.labelCol) || `Row ${unitRow}`;
    const q = {
      id: `q_acpp_${section.id}_${unitRow}`,
      label: `${unitLabel}`,
      description: block.description,
      kind: "fields",
      fields: [],
    };
    for (const col of block.assessmentCols) {
      const cell = sheet.getRow(unitRow).getCell(col);
      // Skip cells that carry a formula — those are computed, not user input.
      if (isCellFormula(cell)) continue;
      const colTitle = columnTitleFor(block, col);
      if (!colTitle) continue; // unlabeled column — skip
      // Get unit-of-measure from a label row (last header row often has units).
      const unitText = getText(block.headerRows[block.headerRows.length - 1], col);
      const looksLikeUnit = unitText && unitText.length <= 30 && !isYearLabel(unitText) && unitText !== colTitle;
      q.fields.push({
        id: `ACPP!${col}${unitRow}`,
        label: `${unitLabel} — ${colTitle}`,
        unit: looksLikeUnit ? unitText : undefined,
        kind: "number",
        min: 0,
      });
    }
    if (q.fields.length > 0) section.questions.push(q);
  }
  if (section.questions.length > 0) sections.push(section);
}

await writeFile(process.env.TEMP + "/annex-cpp.json", JSON.stringify(sections, null, 2), "utf8");

// Diagnostics
let nFields = 0, nQuestions = 0;
for (const s of sections) for (const q of s.questions) { nQuestions++; nFields += q.fields.length; }
console.log(`Wrote ${process.env.TEMP}/annex-cpp.json`);
console.log(`Annex CPP sections: ${sections.length}, questions: ${nQuestions}, fields: ${nFields}`);
for (const s of sections) {
  console.log(`  ${s.title.padEnd(70)} q=${s.questions.length} f=${s.questions.reduce((n, q) => n + q.fields.length, 0)}`);
}
