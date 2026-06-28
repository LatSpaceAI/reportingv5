// Expands a framework's Section[] into a flat list of its *quantitative cells* —
// one entry per numeric value the report asks for. Used by the Questionnaire's
// Requirements tab to list every number that needs to be sourced (not just the
// ~60 questions). Derived live from the schema; nothing is persisted.
//
// A "quantitative cell" is:
//   - FieldsQuestion: every field with kind === "number".
//   - TableQuestion (fixed shape, minRows === maxRows): the cross-product of
//     (numeric column) × (each row), expanded via rowLabel.
//   - TableQuestion (open-ended, user adds rows): one entry per numeric column —
//     the repeating metric — since the rows themselves are user-supplied.
//
// Non-quantitative inputs are skipped: text / longtext / select (Yes-No,
// frequencies) / boolean / email / tel / date / web links.

import type { Field, Question, Section } from "./frameworkTypes";

export interface QuantCell {
  // Stable id: question id + row + column, e.g. "C.P6.E6.r0.currentFY".
  id: string;
  // The question this cell belongs to — used to open the question on click.
  questionId: string;
  // The field (FieldsQuestion) or column (TableQuestion) id this cell maps to.
  fieldId: string;
  // For fixed-shape table cells, the 0-based row index; undefined otherwise
  // (FieldsQuestion cells and open-ended table "per row" metrics).
  rowIndex?: number;
  // Display name, e.g. "Permanent Employees — Male — No. (B)".
  name: string;
  // Question label (drilldown context).
  questionLabel: string;
  sectionTitle: string;
  unit?: string;
}

function isNumeric(f: Field): boolean {
  return f.kind === "number";
}

function unitOf(f: Field): string | undefined {
  return "unit" in f && f.unit ? f.unit : undefined;
}

// Strip a leading SEBI ordinal off a question label, e.g.
//   "18a. Employees and workers …" -> "Employees and workers …"
function questionTitle(label: string): string {
  return label.replace(/^\s*\d+[a-z]?\.\s*/i, "").trim();
}

function fieldsCells(section: Section, q: Extract<Question, { kind: "fields" }>): QuantCell[] {
  const out: QuantCell[] = [];
  for (const f of q.fields) {
    if (!isNumeric(f)) continue;
    out.push({
      id: `${q.id}.${f.id}`,
      questionId: q.id,
      fieldId: f.id,
      name: f.label,
      questionLabel: q.label,
      sectionTitle: section.title,
      unit: unitOf(f),
    });
  }
  return out;
}

function tableCells(section: Section, q: Extract<Question, { kind: "table" }>): QuantCell[] {
  const out: QuantCell[] = [];
  const numericCols = q.columns.filter(isNumeric);
  if (numericCols.length === 0) return out;

  const fixed = q.maxRows != null && q.minRows === q.maxRows && q.rowLabel != null;

  if (fixed) {
    for (let r = 0; r < q.minRows; r++) {
      const rowLabel = q.rowLabel!(r);
      for (const col of numericCols) {
        out.push({
          id: `${q.id}.r${r}.${col.id}`,
          questionId: q.id,
          fieldId: col.id,
          rowIndex: r,
          name: `${rowLabel} — ${col.label}`,
          questionLabel: q.label,
          sectionTitle: section.title,
          unit: unitOf(col),
        });
      }
    }
  } else {
    for (const col of numericCols) {
      out.push({
        id: `${q.id}.${col.id}`,
        questionId: q.id,
        fieldId: col.id,
        name: `${questionTitle(q.label)} — ${col.label} (per row)`,
        questionLabel: q.label,
        sectionTitle: section.title,
        unit: unitOf(col),
      });
    }
  }
  return out;
}

export function quantitativeCells(sections: Section[]): QuantCell[] {
  const out: QuantCell[] = [];
  for (const section of sections) {
    for (const q of section.questions) {
      if (q.kind === "fields") out.push(...fieldsCells(section, q));
      else out.push(...tableCells(section, q));
    }
  }
  return out;
}
