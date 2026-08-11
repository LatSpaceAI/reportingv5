// Parsing an uploaded monthly site return.
//
// The ESG team receives these as Excel files and has, until now, retyped them.
// This reads the file instead. Everything it produces is a PROPOSAL: the
// preview shows what was read, the reviewer corrects it, and only then is
// anything written.
//
// ---------------------------------------------------------------------------
// THE ONE RULE THAT MATTERS: MATCH BY LABEL, NEVER BY ROW POSITION
// ---------------------------------------------------------------------------
//
// Aurora revised its form in February 2024. The same row position changed
// meaning entirely:
//
//   Jan-24 and earlier   row 12  "Grid Electricity consumption"                -> elec.grid  (NON-renewable)
//   Feb-24 onward        row 13  "Grid Electricity consmuption ( Green Energy)" -> elec.green (RENEWABLE)
//
// A row-indexed importer would book ~233,720 kWh/month of ordinary grid draw as
// renewable energy, and the error would be invisible — the number would look
// perfectly reasonable in the wrong bucket. So every value is placed by
// matching its printed label against site_form_field.label, for the form that
// was actually in force for that month. The seeds reproduce those labels
// verbatim, typos and all ("consmuption", "Scarp - Wood", "Collant Oil form
// HVAC"), which is exactly what makes this work.
//
// ---------------------------------------------------------------------------
// SHAPE OF THESE FILES
// ---------------------------------------------------------------------------
//
// Two label/value column pairs side by side, which is why a single-column scan
// would miss half the return:
//
//   A: label   B: qty   C: unit  |  E: label   F: qty   G: unit
//   ^ water, waste, DG hours     |  ^ electricity, fuel
//
// Header rows carry the site name and the period in one of three formats seen
// in the real files: "Apr'24", "Dec'24", "31/03/23 to 30/04/23".

import ExcelJS from "exceljs";
import { parseQuantity } from "./parseQuantity";
import type { FormField } from "./types";

export interface ImportedCell {
  /** Where it came from: 'F13'. */
  sheetCell: string;
  /** The label as printed in the file. */
  sourceLabel: string;
  /** The cell content as typed: '58 kg', 'Nil', '1345'. */
  rawText: string;
  /** The form row this resolved to, if any. */
  matchedFieldId: number | null;
  matchedLabel: string | null;
  parameterKey: string | null;
  matchConfidence: "exact" | "normalised" | "fuzzy" | "unmatched";
  /** The number in the FORM's unit. */
  parsedValue: number | null;
  unitFactor: number;
  /** parsedValue * unitFactor — the value in the model's canonical unit. */
  canonicalValue: number | null;
  isNotAvailable: boolean;
  /** How the number was reached, shown next to the row in the preview. */
  explanation?: string;
}

export interface DetectedPeriod {
  monthNo: number | null;
  fiscalYear: string | null;
  /** The text the detection came from, so the UI can show its working. */
  sourceText: string | null;
}

export interface ParsedSheet {
  sheetName: string;
  detectedSiteName: string | null;
  detectedPeriod: DetectedPeriod;
  cells: ImportedCell[];
}

export interface WorkbookParseResult {
  ok: boolean;
  /** Set when the workbook cannot be imported at all. */
  error?: string;
  /** Monthly sheets found — used by the multi-sheet rejection message. */
  monthlySheetNames: string[];
  sheet?: ParsedSheet;
}

// ---------------------------------------------------------------------------
// Label matching
// ---------------------------------------------------------------------------

/**
 * Reduce a label to its comparable core.
 *
 * Lowercases, strips punctuation and collapses whitespace, so
 * "From Ground Water ( onsite)" and "From Ground Water (colony)" differ only
 * in the word that actually distinguishes them. Deliberately does NOT correct
 * spelling: "consmuption" must keep failing to equal "consumption", because
 * those two labels mean different things on Aurora's form.
 */
export function normaliseLabel(label: string): string {
  return (label ?? "")
    .toLowerCase()
    .replace(/[()[\]{}.,:;*'"–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Labels that differ between the printed form and the seeded field, where the
 * meaning is unambiguous.
 *
 * Every entry here is a real difference observed in the four files in
 * birla-estates/input. This list is intentionally explicit rather than a
 * similarity score: a fuzzy matcher that "helpfully" paired
 * "Grid Electricity consmuption ( Green Energy)" with "Grid Electricity
 * consumption" would reintroduce the exact classification error this module
 * exists to prevent.
 */
const LABEL_ALIASES: { from: string; to: string }[] = [
  // Ground water is sourced from a colony tap on residential sites and from an
  // onsite bore on commercial ones. Same parameter either way.
  { from: "from ground water colony", to: "from ground water onsite" },
  // The residential form spells out where the sewage reading is taken.
  { from: "sewage waste generated stp inlet", to: "sewage generated stp inlet" },
  { from: "sewage generated", to: "sewage generated stp inlet" },
  { from: "sewage recycled", to: "sewage recycled stp outlet" },
  { from: "waste water generated", to: "sewage generated stp inlet" },
  { from: "waste water recycled", to: "sewage recycled stp outlet" },
  { from: "treated water used at construction site", to: "treated water used" },
  { from: "from tanker treated stp water", to: "from tanker treated" },
  { from: "water for drinking", to: "water for drinking" },
  // Fuel rows: the commercial form says "vehicles", residential "plant and
  // Machinery". Both are mobile combustion and share a parameter.
  { from: "diesel for vehicles", to: "diesel for plant and machinery" },
  { from: "dg set diesel", to: "dg set diesel" },
];

const ALIAS_MAP = new Map(LABEL_ALIASES.map((a) => [a.from, a.to]));

interface FieldIndex {
  byExact: Map<string, FormField>;
  byNormalised: Map<string, FormField>;
}

function indexFields(fields: FormField[]): FieldIndex {
  const byExact = new Map<string, FormField>();
  const byNormalised = new Map<string, FormField>();
  for (const f of fields) {
    // Only quantity columns are importable. The agency/comment columns hold
    // text that belongs to a row, not a figure of its own.
    if (f.columnKind !== "quantity") continue;
    if (!byExact.has(f.label)) byExact.set(f.label, f);
    const n = normaliseLabel(f.label);
    if (!byNormalised.has(n)) byNormalised.set(n, f);
  }
  return { byExact, byNormalised };
}

export function matchField(
  label: string,
  index: FieldIndex
): { field: FormField | null; confidence: ImportedCell["matchConfidence"] } {
  if (!label?.trim()) return { field: null, confidence: "unmatched" };

  const exact = index.byExact.get(label.trim());
  if (exact) return { field: exact, confidence: "exact" };

  const n = normaliseLabel(label);
  const norm = index.byNormalised.get(n);
  if (norm) return { field: norm, confidence: "normalised" };

  const aliased = ALIAS_MAP.get(n);
  if (aliased) {
    const viaAlias = index.byNormalised.get(aliased);
    if (viaAlias) return { field: viaAlias, confidence: "fuzzy" };
  }

  // Last resort: a label that fully contains a field label (or vice versa) and
  // is unambiguous — exactly one candidate. "Total fresh water consumption"
  // against "Total fresh water consumption  " and similar trailing-noise cases.
  const candidates = [...index.byNormalised.entries()].filter(
    ([k]) => k.length > 6 && (k.startsWith(n) || n.startsWith(k))
  );
  if (candidates.length === 1) {
    return { field: candidates[0][1], confidence: "fuzzy" };
  }

  return { field: null, confidence: "unmatched" };
}

// ---------------------------------------------------------------------------
// Cell reading
// ---------------------------------------------------------------------------

/** Read a cell as display text, resolving formulas to their cached result. */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as {
      result?: unknown;
      formula?: string;
      richText?: { text: string }[];
      text?: string;
    };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (o.result != null) return String(o.result).trim();
    if (o.text) return String(o.text).trim();
  }
  return "";
}

/** Calendar month number for a month token: apr -> 4. */
const CAL_MONTH: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Fiscal month number, 1-indexed from April.
 *
 * The model's periods run Apr..Mar, so April is month 1 and March is month 12.
 * Mixing this up with the calendar month would file every return 3 months out.
 */
function fiscalMonthNo(calMonth: number): number {
  return ((calMonth - 4 + 12) % 12) + 1;
}

/** Fiscal year label for a calendar month/year: Apr-2024 -> "2024-25". */
function fiscalYearFor(calMonth: number, calYear: number): string {
  const startYear = calMonth >= 4 ? calYear : calYear - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/**
 * Read a period out of the header text.
 *
 * Handles the three formats present in the real returns:
 *   "Apr'24"                  -> Apr FY2024-25
 *   "Dec'24"                  -> Dec FY2024-25
 *   "31/03/23 to 30/04/23"    -> Apr FY2023-24  (the END date is the month)
 */
export function detectPeriod(text: string): DetectedPeriod {
  const empty: DetectedPeriod = { monthNo: null, fiscalYear: null, sourceText: null };
  if (!text?.trim()) return empty;
  const t = text.trim();

  // "31/03/23 to 30/04/23" — the period ENDS in the month being reported.
  const range = t.match(
    /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s*(?:to|-|–|—)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i
  );
  if (range) {
    const calMonth = Number(range[5]);
    let calYear = Number(range[6]);
    if (calYear < 100) calYear += 2000;
    if (calMonth >= 1 && calMonth <= 12) {
      return {
        monthNo: fiscalMonthNo(calMonth),
        fiscalYear: fiscalYearFor(calMonth, calYear),
        sourceText: t,
      };
    }
  }

  // "Apr'24", "Dec'24", "Feb-25", "April 24", "Aug 24"
  const named = t.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[''`\-\s]?\s*(\d{2,4})\b/i
  );
  if (named) {
    const token = named[1].toLowerCase();
    let calYear = Number(named[2]);
    if (calYear < 100) calYear += 2000;
    const calMonth = CAL_MONTH[token];
    return {
      monthNo: fiscalMonthNo(calMonth),
      fiscalYear: fiscalYearFor(calMonth, calYear),
      sourceText: t,
    };
  }

  return empty;
}

/** True when a sheet looks like a filled monthly return rather than a notes tab. */
function looksLikeMonthlyReturn(ws: ExcelJS.Worksheet): boolean {
  const limit = Math.min(ws.rowCount, 30);
  let markers = 0;
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= Math.min(ws.columnCount, 8); c++) {
      const t = normaliseLabel(cellText(row.getCell(c)));
      if (!t) continue;
      if (
        t.includes("water consumption") ||
        t.includes("electricity consumption") ||
        t.includes("waste management") ||
        t.includes("fuel consumption") ||
        t.includes("monthly esg report") ||
        t.includes("monthly report esg")
      ) {
        markers++;
      }
    }
    if (markers >= 2) return true;
  }
  return markers >= 2;
}

// The label/value column pairs. Left pair carries water, waste and DG hours;
// right pair carries electricity and fuel.
const COLUMN_PAIRS: { labelCol: number; valueCol: number }[] = [
  { labelCol: 1, valueCol: 2 }, // A -> B
  { labelCol: 5, valueCol: 6 }, // E -> F
];

const COL_LETTER = ["", "A", "B", "C", "D", "E", "F", "G", "H"];

/**
 * Parse one sheet into proposed values.
 *
 * `fields` must be the form assigned to THIS site for THIS month — the caller
 * resolves that from site_form_assignment before calling. Passing the wrong
 * month's form is the failure mode this whole module is built to avoid.
 */
export function parseSheet(ws: ExcelJS.Worksheet, fields: FormField[]): ParsedSheet {
  const index = indexFields(fields);
  const cells: ImportedCell[] = [];
  const seenFieldIds = new Set<number>();

  let detectedSiteName: string | null = null;
  let detectedPeriod: DetectedPeriod = { monthNo: null, fiscalYear: null, sourceText: null };

  const maxRow = Math.min(ws.rowCount, 200);

  // ---- Header: site name and period ---------------------------------------
  for (let r = 1; r <= Math.min(maxRow, 20); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= Math.min(ws.columnCount, 8); c++) {
      const label = normaliseLabel(cellText(row.getCell(c)));
      if (!label) continue;
      const next = cellText(row.getCell(c + 1));
      if (!next) continue;
      if (!detectedSiteName && (label.includes("name of project") || label === "site")) {
        detectedSiteName = next;
      }
      if (!detectedPeriod.monthNo && label === "period") {
        detectedPeriod = detectPeriod(next);
      }
    }
  }
  // Fall back to the sheet name ("Aug 24", "Feb 24") when no Period cell.
  if (!detectedPeriod.monthNo) {
    const fromName = detectPeriod(ws.name);
    if (fromName.monthNo) detectedPeriod = fromName;
  }

  // ---- Body: label/value pairs --------------------------------------------
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    for (const { labelCol, valueCol } of COLUMN_PAIRS) {
      const label = cellText(row.getCell(labelCol));
      if (!label || label.length < 3) continue;

      const raw = cellText(row.getCell(valueCol));
      // A label with nothing beside it is a section heading, not a data row.
      if (!raw) continue;
      // Section headers repeat their own text across the row.
      if (normaliseLabel(raw) === normaliseLabel(label)) continue;

      const { field, confidence } = matchField(label, index);

      // One form row must not be filled twice. The files repeat headings such
      // as "Non Hazardous waste" across columns; without this the second hit
      // would overwrite a real value with a heading.
      if (field && seenFieldIds.has(field.fieldId)) continue;

      const formUnit = field?.formUnit ?? cellText(row.getCell(valueCol + 1)) ?? null;
      const parsed = parseQuantity(raw, formUnit);
      const factor = field?.unitFactor ?? 1;

      // A row we cannot place, that also holds no number, is noise — a remark
      // or a stray heading. Recording it would bury the genuine unmatched rows.
      if (!field && parsed.value === null && !parsed.notAvailable) continue;

      if (field) seenFieldIds.add(field.fieldId);

      cells.push({
        sheetCell: `${COL_LETTER[valueCol] ?? ""}${r}`,
        sourceLabel: label,
        rawText: raw,
        matchedFieldId: field?.fieldId ?? null,
        matchedLabel: field?.label ?? null,
        parameterKey: field?.parameterKey ?? null,
        matchConfidence: confidence,
        parsedValue: parsed.value,
        unitFactor: factor,
        canonicalValue: parsed.value === null ? null : parsed.value * factor,
        isNotAvailable: parsed.notAvailable,
        explanation: parsed.explanation,
      });
    }
  }

  return { sheetName: ws.name, detectedSiteName, detectedPeriod, cells };
}

/**
 * Parse an uploaded workbook.
 *
 * Multi-sheet workbooks are REJECTED. Aurora's historic file carries 17 monthly
 * sheets; importing them in bulk would mean applying one site/period choice to
 * seventeen different months, and a single mis-detection would scatter data
 * across the wrong periods silently. One upload, one month.
 */
export async function parseWorkbook(
  bytes: ArrayBuffer,
  fields: FormField[]
): Promise<WorkbookParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(bytes);
  } catch (e) {
    return {
      ok: false,
      error: `That file could not be read as an Excel workbook (${
        e instanceof Error ? e.message : "unknown error"
      }).`,
      monthlySheetNames: [],
    };
  }

  const monthly = wb.worksheets.filter(looksLikeMonthlyReturn);
  const monthlySheetNames = monthly.map((w) => w.name);

  if (monthly.length === 0) {
    return {
      ok: false,
      error:
        "No monthly ESG return was found in this file. The importer looks for the " +
        "Water / Electricity / Fuel / Waste sections of the standard monthly form.",
      monthlySheetNames: [],
    };
  }

  if (monthly.length > 1) {
    return {
      ok: false,
      error:
        `This workbook contains ${monthly.length} monthly returns ` +
        `(${monthlySheetNames.slice(0, 4).join(", ")}${
          monthlySheetNames.length > 4 ? ", …" : ""
        }). Only one month can be uploaded at a time — please upload a file ` +
        `containing a single monthly sheet.`,
      monthlySheetNames,
    };
  }

  return {
    ok: true,
    monthlySheetNames,
    sheet: parseSheet(monthly[0], fields),
  };
}
