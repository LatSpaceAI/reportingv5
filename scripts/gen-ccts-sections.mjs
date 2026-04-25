// Generates src/lib/cctsSections.ts from the Form-Sb extract.
//
// The extract (scripts/extract-form-sb.mjs) gives us, per row:
//   row, code, label, basis, unit, eFormula, eDefault, eValidationKind,
//   eValidationFormula, source, remarks
//
// Treatment:
//  - Rows where eFormula is set → CALC → skipped entirely (formulas live in the
//    template; Excel recomputes them on open).
//  - Rows where eFormula is null AND there is a real label → INPUT → become a
//    field with id = `I<row>` (the column-I cell on Form-Sb).
//  - Sub-block headers (rows that announce a kiln / STG / fuel block but have
//    no E cell input) become Question banners — they group the inputs that
//    follow.
//  - True section headers (Roman numerals I, II, single capital A-P) become
//    Sections.
//
// Output is hand-tuned a little after generation, but the bulk is mechanical.
import { readFile, writeFile } from "node:fs/promises";

const data = JSON.parse(await readFile(process.env.TEMP + "/formsb.json", "utf8"));

// ── Tuning tables ──────────────────────────────────────────────────────────

// Section headers detected by code shape. The label becomes the section title.
function isSectionHeader(r) {
  if (!r.label) return false;
  if (r.eFormula) return false;
  // Roman numerals (I, II) and single capital letters A-P that have a label
  // but no unit and no E-input — these are the workbook's section banners.
  if (/^[IVX]+$/i.test(r.code) && r.label.length > 2) return true;
  if (/^[A-P]$/.test(r.code) && r.label.length > 2) return true;
  return false;
}

// Sub-block (Question) headers — a workbook row that announces a group of
// inputs (e.g. "A11.1 Ordinary Portland Cement (OPC) Production",
// "C.2.1 Through Diesel Generator (DG) sets", "D.1 Coal (Indian)",
// "Kiln 1 Start/Stop", "P3.1 Clinker production and composition").
function isSubBlockHeader(r) {
  if (r.eFormula) return false;
  if (!r.label) return false;
  // Sub-block headers shouldn't have a real unit. The workbook occasionally
  // misuses col D for a long descriptive sentence (e.g. D.10/D.11) — treat
  // anything longer than 25 chars as "not a unit".
  if (r.unit && r.unit.length <= 25) return false;
  // Codes like A11, A11.1, C.1, C.2.2.1, D.1, E.6, F.2, P.1, P3.1, P3.7…
  if (/^[A-Z]\d+(\.\d+)*$/.test(r.code)) return true;
  if (/^[A-Z]\.\d+(\.\d+)*$/.test(r.code)) return true;
  if (/^[A-Z]\d+\.\d+(\.\d+)*$/.test(r.code)) return true;
  // A12 / A20 / A21 / A22 — top-level headers under section A
  if (/^[A-Z]\d{1,2}$/.test(r.code) && r.label.length > 4) return true;
  // Kiln 1 Start/Stop etc — flagged by text in label
  if (/^\((i|ii|iii|iv|v)\)$/.test(r.code) && /Start\/Stop$/i.test(r.label)) return true;
  return false;
}

// True input row — render as a field.
function isInputRow(r) {
  if (r.eFormula) return false;
  if (!r.label) return false;
  if (isSectionHeader(r)) return false;
  if (isSubBlockHeader(r)) return false;
  // Drop the "Note: …" rows — they are commentary, not inputs.
  if (/^Note[: ]/i.test(r.label.trim())) return false;
  // The bottom of the sheet has a few help-text legend rows. Drop anything
  // that isn't actually a fill row (no unit, no validation, no real code).
  if (!r.unit && !r.eValidationKind && !/^[A-Z0-9]/.test(r.code) && !/^\(/.test(r.code)) return false;
  return true;
}

// Map Excel data validation → frameworkTypes.ts FieldKind
function fieldKindFor(r) {
  // List validations
  if (r.eValidationKind === "list" && Array.isArray(r.eValidationFormula)) {
    const formula = r.eValidationFormula[0] ?? "";
    // Inline list like "\"Yes,No,Not Applicable\"" — strip quotes and split.
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
  if (r.eValidationKind === "decimal") return { kind: "number", min: 0 };
  // Unit looks numeric → number
  if (r.unit && /[A-Za-z]/.test(r.unit)) return { kind: "number", min: 0 };
  // Default to text
  return { kind: "text" };
}

// ── Build sections ─────────────────────────────────────────────────────────

const sections = [];
let currentSection = null;
let currentQuestion = null;

// We always start with a synthetic Header section for Boundary Coverage etc.,
// plus a closing Sign-off section. The first real workbook section is "I" at
// row 9.

for (const r of data) {
  if (r.row < 9) continue; // skip workbook title rows
  if (r.row >= 961) continue; // skip footer / declaration legend rows

  if (isSectionHeader(r)) {
    currentSection = {
      id: `sec_${r.code}_${r.row}`,
      title: `${r.code}. ${r.label.trim()}`,
      sheetRef: `Form-Sb`,
      questions: [],
    };
    sections.push(currentSection);
    currentQuestion = null;
    continue;
  }

  if (!currentSection) continue;

  if (isSubBlockHeader(r)) {
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
  const looksLikeValueList = /^(Yes\/No|Yes\/No\/NA|Y\/N)$/i.test(r.unit?.trim() ?? "");
  const unit = r.unit && !looksLikeValueList ? r.unit : undefined;

  currentQuestion.fields.push({
    id: `I${r.row}`,
    label: fullLabel,
    unit,
    help,
    ...kindMeta,
  });
}

// Drop empty questions and sections.
for (const s of sections) {
  s.questions = s.questions.filter((q) => q.fields.length > 0);
}
const cleanSections = sections.filter((s) => s.questions.length > 0);

// ── Emit TS source ─────────────────────────────────────────────────────────

const tsHeader = `// AUTO-GENERATED from Form-Sb of Cement-PPC-Proforma-BEE.xlsx by
// scripts/gen-ccts-sections.mjs. Each field id (e.g. "I31") is the cell on
// the Form-Sb sheet that the answer should write to on export. Computed cells
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
