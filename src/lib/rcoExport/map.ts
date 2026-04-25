/**
 * Binding from in-app RCO answers (question id + field id) → RCO Excel template cells.
 *
 * Template reference: "RCO data Reporting Format for DCs who are OA consumers or
 * captive users" (30-Sep-2025) shipped at /rco-template.xlsx.
 *
 * Only user-input cells are bound. Formula-driven cells (Section D on FormA, all
 * of Section B/D on FormD, the Y'/T'/K/E_total summary cells) are intentionally
 * skipped — Excel will recompute them when the workbook opens. FormD's Section A
 * pulls from FormA via cell references, so we don't bind it twice either.
 */

export interface FieldBinding {
  kind: "field";
  questionId: string;
  fieldId: string;
  sheet: string;
  cell: string;
  /** Optional transformer. */
  transform?: "pct100to1" | "stateNameOnly";
}

export type Binding = FieldBinding;

export const bindings: Binding[] = [
  // ───────────── FormA · Section A — Basic Information ─────────────
  // C5 is the sector dropdown; the workbook's data validation list matches our
  // dcSectors enum, so the value writes through unmodified.
  { kind: "field", questionId: "A.1", fieldId: "dcName",            sheet: "FormA_CPP_OA", cell: "C4" },
  { kind: "field", questionId: "A.1", fieldId: "sector",            sheet: "FormA_CPP_OA", cell: "C5" },
  { kind: "field", questionId: "A.1", fieldId: "regNo",             sheet: "FormA_CPP_OA", cell: "C6" },
  { kind: "field", questionId: "A.1", fieldId: "obligationType",    sheet: "FormA_CPP_OA", cell: "C7" },
  { kind: "field", questionId: "A.1", fieldId: "targetYear",        sheet: "FormA_CPP_OA", cell: "C8" },
  { kind: "field", questionId: "A.1", fieldId: "compliancePeriod",  sheet: "FormA_CPP_OA", cell: "C9" },

  // ───────────── FormA · Section B — Gross Total Energy ─────────────
  // B.1 — own generation breakdown
  { kind: "field", questionId: "B.1", fieldId: "aGen",   sheet: "FormA_CPP_OA", cell: "E13" }, // A
  { kind: "field", questionId: "B.1", fieldId: "whr",    sheet: "FormA_CPP_OA", cell: "E14" }, // A**
  { kind: "field", questionId: "B.1", fieldId: "wer",    sheet: "FormA_CPP_OA", cell: "E15" }, // A!!!
  { kind: "field", questionId: "B.1", fieldId: "aux",    sheet: "FormA_CPP_OA", cell: "E16" }, // A!
  // E17 (Anon-cogen) is a formula → skip.
  { kind: "field", questionId: "B.1", fieldId: "cogen",  sheet: "FormA_CPP_OA", cell: "E18" }, // Acogen
  { kind: "field", questionId: "B.1", fieldId: "apc",    sheet: "FormA_CPP_OA", cell: "E19" }, // APCTotal
  // E12 (AT) is a formula → skip.

  // B.2 — Open-access purchases & banking drawl
  { kind: "field", questionId: "B.2", fieldId: "oaFossil",  sheet: "FormA_CPP_OA", cell: "E21" }, // C
  { kind: "field", questionId: "B.2", fieldId: "bankDrawl", sheet: "FormA_CPP_OA", cell: "E22" }, // D
  // E20 (CT) is a formula → skip.
  { kind: "field", questionId: "B.2", fieldId: "discomBuy", sheet: "FormA_CPP_OA", cell: "E23" }, // EDISCOM

  // B.3 — Sales & banking storage
  { kind: "field", questionId: "B.3", fieldId: "oaSales",    sheet: "FormA_CPP_OA", cell: "E25" }, // F
  { kind: "field", questionId: "B.3", fieldId: "bankStored", sheet: "FormA_CPP_OA", cell: "E26" }, // G
  // E24 (FT) is a formula → skip.

  // B.4 — Net fossil energy from ESS. ITL stored as % in our app; Excel expects decimal.
  { kind: "field", questionId: "B.4", fieldId: "essOut",  sheet: "FormA_CPP_OA", cell: "E28" }, // I
  { kind: "field", questionId: "B.4", fieldId: "essIn",   sheet: "FormA_CPP_OA", cell: "E29" }, // J
  { kind: "field", questionId: "B.4", fieldId: "essLoss", sheet: "FormA_CPP_OA", cell: "E30", transform: "pct100to1" },
  // E27 (IT) is a formula → skip.

  // B.5 — Aluminium smelter. K and Etotal are formulas, skip.
  { kind: "field", questionId: "B.5", fieldId: "smelterMU", sheet: "FormA_CPP_OA", cell: "E31" },

  // ───────────── FormA · Section C — RE Consumption ─────────────
  // C.1
  { kind: "field", questionId: "C.1", fieldId: "reGen",        sheet: "FormA_CPP_OA", cell: "E37" }, // U
  // E38 (W = X+Y) is a formula → skip.
  { kind: "field", questionId: "C.1", fieldId: "dreMetered",   sheet: "FormA_CPP_OA", cell: "E39" }, // X
  { kind: "field", questionId: "C.1", fieldId: "dreUnmetered", sheet: "FormA_CPP_OA", cell: "E40" }, // Y
  { kind: "field", questionId: "C.1", fieldId: "reExBus",      sheet: "FormA_CPP_OA", cell: "E41" }, // Er(ex-bus)
  { kind: "field", questionId: "C.1", fieldId: "discomRE",     sheet: "FormA_CPP_OA", cell: "E42" },
  { kind: "field", questionId: "C.1", fieldId: "reBankDrawl",  sheet: "FormA_CPP_OA", cell: "E43" }, // B'
  // E36 (T) is a formula → skip.

  // C.2
  { kind: "field", questionId: "C.2", fieldId: "reSales",       sheet: "FormA_CPP_OA", cell: "E45" }, // J'
  { kind: "field", questionId: "C.2", fieldId: "reBankStored",  sheet: "FormA_CPP_OA", cell: "E46" }, // L'
  // E44 (I') is a formula → skip.

  // C.3 — RE ESS. QL stored as % in app; Excel expects decimal.
  { kind: "field", questionId: "C.3", fieldId: "reEssOut",  sheet: "FormA_CPP_OA", cell: "E48" }, // R'
  { kind: "field", questionId: "C.3", fieldId: "reEssIn",   sheet: "FormA_CPP_OA", cell: "E49" }, // S'
  { kind: "field", questionId: "C.3", fieldId: "reEssLoss", sheet: "FormA_CPP_OA", cell: "E50", transform: "pct100to1" }, // QL
  // E47 (Q') is a formula → skip.

  // C.4 — GH2 / Green Ammonia
  { kind: "field", questionId: "C.4", fieldId: "ghEnergy",      sheet: "FormA_CPP_OA", cell: "E51" }, // W'
  { kind: "field", questionId: "C.4", fieldId: "ammoniaEnergy", sheet: "FormA_CPP_OA", cell: "E52" }, // X'

  // C.5 — Target-year RECs
  { kind: "field", questionId: "C.5", fieldId: "recsPurchased", sheet: "FormA_CPP_OA", cell: "E55" }, // U'
  { kind: "field", questionId: "C.5", fieldId: "recsRetained",  sheet: "FormA_CPP_OA", cell: "E56" }, // V'
  // E54 (T') is a formula → skip.

  // ───────────── FormA · Section D — leave entirely formula-driven ─────────────

  // ───────────── FormD · Section C — Assessment-year transactions ─────────────
  { kind: "field", questionId: "E.1", fieldId: "recsPurchased",     sheet: "FormD_CPP_OA", cell: "E22" }, // U'
  { kind: "field", questionId: "E.1", fieldId: "recsRetained",      sheet: "FormD_CPP_OA", cell: "E23" }, // V'
  { kind: "field", questionId: "E.2", fieldId: "buyoutsPurchased",  sheet: "FormD_CPP_OA", cell: "E25" }, // U' (buyouts)
  // E21, E24, E26 (RECs MU, Buyouts MU, Total compliance) are formulas → skip.

  // ───────────── FormD · Section D — leave entirely formula-driven ─────────────
];
