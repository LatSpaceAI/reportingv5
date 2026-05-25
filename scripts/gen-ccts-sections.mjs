// Generates src/lib/cctsSections.ts from the Form Sa1 + Annex CPP extracts of
// the BEE Aluminium-Sector CCTS Pro-Forma workbook.
//
// The Form Sa1 extract (scripts/extract-form-sa1.mjs) gives us, per row:
//   row, code, label, basis, unit,
//   iFormula, iDefault, iValidationKind, iValidationFormula,
//   eFormula, eDefault, eValidationKind, eValidationFormula,
//   source, remarks
//
// Treatment for Form Sa1:
//  - Rows where iFormula is set → CALC → skipped entirely (formulas live in the
//    template; Excel recomputes them on open).
//  - Rows where iFormula is null AND there is a real label → INPUT → become a
//    field with id = `I<row>` (the column-I cell on Form Sa1).
//  - Sub-block headers (rows that announce a process line / fuel block but
//    have no I-cell input) become Question banners.
//  - Section headers (uppercase Roman numerals I, II and single capital
//    letters A-O) become Sections.
//
// Annex CPP is a wide table-shaped sheet (10 captive-power-plant units × 4-7
// attributes each) handled by extract-annex-cpp.mjs and folded into the same
// section list. Only the assessment-year columns of Annex CPP become fields;
// the baseline columns are dropped (per product decision).
//
// Output is hand-tuned a little after generation, but the bulk is mechanical.
import { readFile, writeFile } from "node:fs/promises";

const data = JSON.parse(await readFile(process.env.TEMP + "/formsa1.json", "utf8"));
const annexData = JSON.parse(await readFile(process.env.TEMP + "/annex-cpp.json", "utf8"));

// ── Tuning tables ──────────────────────────────────────────────────────────

// Valid Form-Sa1 section codes — the aluminium workbook skips F. Constraining
// to this allow-list keeps lowercase roman numerals like "ix" (used as row
// codes) from being misclassified as section headers.
const FORM_SA1_SECTIONS = new Set(["I", "II", "A", "B", "C", "D", "E", "G", "H", "I", "J", "K", "L", "M", "N", "O"]);

// Section headers detected by code shape. The label becomes the section title.
// Important: Roman-numeral regex is case-SENSITIVE here — lowercase "ix",
// "xvi" etc are valid row codes (Roman numerals used to enumerate fields
// within a sub-block), not section headers.
function isSectionHeader(r) {
  if (!r.label) return false;
  if (r.iFormula) return false;
  if (!FORM_SA1_SECTIONS.has(r.code)) return false;
  // Section header label must be at least 4 chars and not just echo the code.
  if (r.label.trim().length < 4) return false;
  return true;
}

// Sub-block (Question) headers — a workbook row that announces a group of
// inputs (e.g. "A1 Refinery Process", "A3.1 Refinery Process",
// "b.2.1 Through Diesel Generator (DG) sets", "a Hydrate Alumina",
// "b Digestion Process Parameter").
function isSubBlockHeader(r) {
  if (r.iFormula) return false;
  if (!r.label) return false;
  // Sub-block headers shouldn't have a real unit. The workbook occasionally
  // misuses col D for a long descriptive sentence — treat anything longer
  // than 25 chars as "not a unit".
  if (r.unit && r.unit.length <= 25) return false;
  // Top-level sub-blocks under a section letter (e.g. "A1", "A2", "B.1")
  if (/^[A-Z]\d+(\.\d+)*$/.test(r.code)) return true;
  if (/^[A-Z]\.\d+(\.\d+)*$/.test(r.code)) return true;
  if (/^[A-Z]\d+\.\d+(\.\d+)*$/.test(r.code)) return true;
  // Lowercase sub-block codes used in aluminium workbook: a, b, c, ... up to
  // letter only (single lowercase letter), plus dotted variants b.1, b.2.1.
  if (/^[a-z]$/.test(r.code) && r.label.length > 3) return true;
  if (/^[a-z]\d+(\.\d+)*$/.test(r.code)) return true;
  if (/^[a-z]\.\d+(\.\d+)*$/.test(r.code)) return true;
  if (/^[a-z]\d+\.\d+(\.\d+)*$/.test(r.code)) return true;
  // "A11" / "A12" — top-level headers under section A
  if (/^[A-Z]\d{1,2}$/.test(r.code) && r.label.length > 4) return true;
  // Start/Stop blocks flagged by text in label (rare in aluminium)
  if (/^\((i|ii|iii|iv|v)\)$/.test(r.code) && /Start\/Stop$/i.test(r.label)) return true;
  return false;
}

// True input row — render as a field.
function isInputRow(r) {
  if (r.iFormula) return false;
  if (!r.label) return false;
  if (isSectionHeader(r)) return false;
  if (isSubBlockHeader(r)) return false;
  // Drop the "Note: …" rows — they are commentary, not inputs.
  if (/^Note[: ]/i.test(r.label.trim())) return false;
  // Filter the legend rows at the bottom of the sheet:
  // "Please enter numeric values…", "Formulae Protected", "Yes/No", etc.
  if (/^(Please enter|Fomulae Protected|Formulae Protected|Emission based summary|Data not to be filled|Select from|I solemnly declare|Signature of)/i.test(r.label.trim())) return false;
  // The bottom of the sheet has a few help-text legend rows. Drop anything
  // that isn't actually a fill row (no unit, no validation, no real code).
  if (!r.unit && !r.iValidationKind && !r.eValidationKind && !/^[A-Za-z0-9]/.test(r.code) && !/^\(/.test(r.code)) return false;
  return true;
}

// Map Excel data validation → frameworkTypes.ts FieldKind
// We prefer the column-I validation; fall back to column-E when column I has
// no DV configured (some rows only attach DV to E in the workbook).
function fieldKindFor(r) {
  const vk = r.iValidationKind ?? r.eValidationKind;
  const vf = r.iValidationFormula ?? r.eValidationFormula;
  // List validations
  if (vk === "list" && Array.isArray(vf)) {
    const formula = vf[0] ?? "";
    // Inline list like "\"Yes, No,Not Applicable\"" — strip quotes and split.
    const m = /^"([^"]+)"$/.exec(formula);
    if (m) {
      const opts = m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((o) => o.toLowerCase() !== "select"); // drop the Excel "Select" placeholder; the renderer already provides a blank "—" choice.
      return { kind: "select", options: opts };
    }
    // Range reference (e.g. "$G$881:$G$882") — fall back to Yes/No.
    return { kind: "select", options: ["Yes", "No"] };
  }
  // "Date of Commissioning" rows → date input
  if (/Date of Commissioning/i.test(r.label)) return { kind: "date" };
  // Decimal validation → number with min 0 (rare cases use min -1 but min 0 is fine)
  if (vk === "decimal") return { kind: "number", min: 0 };
  // textLength → free-form text
  if (vk === "textLength") return { kind: "text" };
  // Unit looks numeric (anything with a letter in it = unit of measure)
  if (r.unit && /[A-Za-z]/.test(r.unit) && !/^Yes\/No/i.test(r.unit) && !/^Single\/Double$/i.test(r.unit) && !/^Name$/i.test(r.unit) && !/^Technology/i.test(r.unit) && !/^Techonolgy/i.test(r.unit) && !/^Date$/i.test(r.unit)) return { kind: "number", min: 0 };
  // Default to text
  return { kind: "text" };
}

// ── Build sections ─────────────────────────────────────────────────────────

const sections = [];
let currentSection = null;
let currentQuestion = null;

// Aluminium workbook structure starts at row 10 (Boundary Coverage section "I")
// and ends with the Process Emissions section "O" at row 1394; rows beyond
// ~1465 are formula footers / signature rows.
//
// After section "O" (row 1394), single-uppercase-letter codes like "A" / "B"
// in Process Emissions (rows 1406, 1411, etc) are *sub-block* labels for
// tier-1/tier-2 calculation blocks, not new sections. We use the current
// section ID (sec_O_*) as a flag to switch the interpretation.

for (const r of data) {
  if (r.row < 10) continue;
  if (r.row >= 1467) continue; // signature/declaration rows beyond

  // Past section "O" any single-letter "section" is actually a sub-block.
  const insideProcessEmissions = currentSection?.id?.startsWith("sec_O_");
  const looksLikeSectionHeader = isSectionHeader(r);
  if (looksLikeSectionHeader && !insideProcessEmissions) {
    currentSection = {
      id: `sec_${r.code}_${r.row}`,
      title: `${r.code}. ${r.label.trim()}`,
      sheetRef: `Form Sa1`,
      questions: [],
    };
    sections.push(currentSection);
    currentQuestion = null;
    // Special case: section "N. Process Flow Diagram Attached" — the
    // workbook puts the Yes/No question on the section-header row itself
    // (col I has the answer, col C has "Yes/No"). Emit one field so the
    // section isn't dropped as empty.
    if (r.code === "N" && /Process Flow Diagram/i.test(r.label)) {
      currentSection.questions.push({
        id: `q_sec_N_${r.row}_default`,
        label: r.label.trim(),
        kind: "fields",
        fields: [
          {
            id: `FS1!I${r.row}`,
            label: r.label.trim(),
            kind: "select",
            options: ["Yes", "No"],
          },
        ],
      });
    }
    continue;
  }

  if (!currentSection) continue;

  if (isSubBlockHeader(r) || (looksLikeSectionHeader && insideProcessEmissions)) {
    currentQuestion = {
      id: `q_${r.code}_${r.row}`,
      label: `${r.code} — ${r.label.trim()}`,
      description: r.basis || undefined,
      kind: "fields",
      fields: [],
    };
    currentSection.questions.push(currentQuestion);
    continue;
  }

  if (!isInputRow(r)) continue;

  // Lazy-create a question if the section has fields but no sub-block yet.
  if (!currentQuestion) {
    currentQuestion = {
      id: `q_${currentSection.id}_default`,
      label: currentSection.title,
      kind: "fields",
      fields: [],
    };
    currentSection.questions.push(currentQuestion);
  }

  const kindMeta = fieldKindFor(r);
  const labelPrefix = r.code && !/^\(/.test(r.code) ? `${r.code} ` : (r.code ? `${r.code} ` : "");
  const fullLabel = (labelPrefix + r.label.trim()).replace(/\s+/g, " ").trim();

  // Build help text: basis (col C) + source of data (col J) + workbook remark.
  const helpParts = [];
  if (r.basis && r.basis.trim() && r.basis.trim() !== "Annual") helpParts.push(`Basis: ${r.basis.trim()}`);
  if (r.source && r.source.trim()) helpParts.push(`Source: ${r.source.trim()}`);
  const help = helpParts.length ? helpParts.join(" · ") : undefined;

  // Drop the col-D "unit" when it's actually a values-list label (e.g. "Yes/No/NA")
  // — those show up as redundant after the field becomes a select.
  const looksLikeValueList = /^(Yes\/No|Yes\/No\/NA|Yes\/No\/Not Applicable|Y\/N|Single\/Double|Date|Name|Techonolgy|Technology)$/i.test(r.unit?.trim() ?? "");
  const unit = r.unit && !looksLikeValueList ? r.unit : undefined;

  // Cell ref on Form Sa1: column I + row number. Encoded with the "FS1!"
  // sheet prefix so the export-mapper can route the patch to the right sheet.
  currentQuestion.fields.push({
    id: `FS1!I${r.row}`,
    label: fullLabel,
    unit,
    help,
    ...kindMeta,
  });
}

// ── Fold Annex CPP into the section list ───────────────────────────────────
// annexData is already shaped as a Section[] — append it directly.
for (const s of annexData) sections.push(s);

// Drop empty questions and sections.
for (const s of sections) {
  s.questions = s.questions.filter((q) => q.fields.length > 0);
}
const cleanSections = sections.filter((s) => s.questions.length > 0);

// ── Emit TS source ─────────────────────────────────────────────────────────

const tsHeader = `// AUTO-GENERATED from Form Sa1 of the BEE Aluminium-Sector CCTS Pro-Forma
// workbook (ALM0009UP CCTS proforma FY'23-24 final V1.4.xlsx) by
// scripts/gen-ccts-sections.mjs. Each field id (e.g. "I43") is the cell on
// the Form Sa1 sheet that the answer should write to on export. Computed cells
// are intentionally absent — formulas live in the template, Excel recomputes
// them on open.

import type { Section } from "./frameworkTypes";

`;

const tsBody = `export const sections: Section[] = ${JSON.stringify(cleanSections, null, 2)};\n`;

// JSON.stringify wraps "kind" values in quotes which TS narrows correctly via
// the discriminated union, so no hand-fixup is needed for that. The unions in
// frameworkTypes.ts use string literals, so the JSON output is structurally
// compatible.
await writeFile(
  "src/lib/cctsSections.ts",
  tsHeader + tsBody,
  "utf8"
);

// Diagnostics
let nFields = 0, nQuestions = 0;
for (const s of cleanSections) {
  for (const q of s.questions) {
    nQuestions++;
    nFields += q.fields.length;
  }
}
console.log(`Wrote src/lib/cctsSections.ts`);
console.log(`Sections: ${cleanSections.length}, Questions: ${nQuestions}, Fields: ${nFields}`);
for (const s of cleanSections) {
  const qCount = s.questions.length;
  const fCount = s.questions.reduce((n, q) => n + q.fields.length, 0);
  console.log(`  ${s.title.padEnd(60)} q=${String(qCount).padStart(3)} f=${String(fCount).padStart(4)}`);
}
