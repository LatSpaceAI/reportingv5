// Expand Excel "shared formulas" into standalone ones before writing.
//
// THE PROBLEM
// Excel compresses a formula repeated across a range into one master cell plus
// clones that say "same as E70, shifted". The template uses this in 19 places.
// Writing a value into a master orphans its clones, and ExcelJS then refuses to
// serialise the workbook at all:
//
//   Error: Shared Formula master must exist above and or left of clone for cell F70
//
// That is not a corner case for us — E70 IS a cell we must overwrite, because
// its formula is one of the template's defects (the stressed-consumption range
// spans its own subtotal and skips groundwater).
//
// THE FIX
// Before touching anything, rewrite every shared group as independent formulas:
// the master keeps its own text, and each clone gets the master's formula with
// its cell references translated by the clone's row/column offset — exactly
// what Excel does when it evaluates them. Behaviour is unchanged; the file just
// stops being fragile. Excel re-compresses on its next save if it wants to.

import type ExcelJS from "exceljs";

/** Split "AB12" into its parts. Returns null for anything that is not a ref. */
function parseRef(ref: string): { col: string; row: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  return m ? { col: m[1], row: Number(m[2]) } : null;
}

function colToNum(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function numToCol(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Shift the relative references in a formula by (dCol, dRow).
 *
 * Absolute parts ($A$1) are left alone, which is what Excel does — that is the
 * whole point of the dollar sign. References into other workbooks ([1]FUEL!...)
 * and sheets are matched as a unit so their sheet name is not mangled.
 */
export function translateFormula(formula: string, dCol: number, dRow: number): string {
  // Matches an optional [book]Sheet! prefix, then $?COL$?ROW.
  const REF = /((?:\[\d+\])?(?:'[^']+'|[A-Za-z0-9_]+)!)?(\$?)([A-Z]{1,3})(\$?)(\d{1,7})/g;
  return formula.replace(REF, (whole, sheet, colAbs, col, rowAbs, row) => {
    const newCol = colAbs ? col : numToCol(Math.max(1, colToNum(col) + dCol));
    const newRow = rowAbs ? row : String(Math.max(1, Number(row) + dRow));
    return `${sheet ?? ""}${colAbs}${newCol}${rowAbs}${newRow}`;
  });
}

/**
 * Rewrite every shared-formula group on a worksheet as standalone formulas.
 *
 * Returns how many cells were expanded, for the export report.
 */
export function normalizeSharedFormulas(ws: ExcelJS.Worksheet): number {
  // Collect masters first: mutating while iterating would have us read a cell we
  // have already rewritten.
  const masters = new Map<string, string>(); // master ref -> formula text
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clones: { cell: any; masterRef: string }[] = [];

  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value as unknown;
      if (!v || typeof v !== "object") return;
      const obj = v as { formula?: string; sharedFormula?: string; shareType?: string };
      if (obj.formula && obj.shareType === "shared") {
        masters.set(cell.address, obj.formula);
      } else if (obj.sharedFormula) {
        clones.push({ cell, masterRef: obj.sharedFormula });
      }
    });
  });

  let expanded = 0;

  // Masters: keep the formula, drop the sharing metadata.
  for (const [address, formula] of masters) {
    const cell = ws.getCell(address);
    const prev = cell.value as { result?: unknown } | null;
    cell.value = { formula, result: prev?.result } as ExcelJS.CellFormulaValue;
    expanded++;
  }

  // Clones: materialise the master's formula, translated by their offset.
  for (const { cell, masterRef } of clones) {
    const masterFormula = masters.get(masterRef);
    const master = parseRef(masterRef);
    const self = parseRef(cell.address);
    if (!masterFormula || !master || !self) continue;
    const translated = translateFormula(
      masterFormula,
      colToNum(self.col) - colToNum(master.col),
      self.row - master.row
    );
    const prev = cell.value as { result?: unknown } | null;
    cell.value = { formula: translated, result: prev?.result } as ExcelJS.CellFormulaValue;
    expanded++;
  }

  return expanded;
}
