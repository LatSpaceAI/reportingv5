// Pure Buffer → data parser for the Birla HR/Procurement monthly workbooks.
// No database access; the service and the tests both call this.
//
// HOW ROWS ARE FOUND
//
// Two passes. Pass one walks the sheet once, locating every block's anchor
// (its section-header text in column B) with a forward-moving cursor, so a
// later block whose anchor is a prefix of an earlier one still lands on its
// own row. Pass two resolves each block's data rows inside the window between
// its anchor and the next block's anchor:
//
//   - fixed blocks: each declared row is found by its column-B label, again
//     with a forward cursor (the sheet repeats "Male"/"Female" endlessly);
//     a label that cannot be found falls back to the row's offset from the
//     anchor and is reported as a mismatch rather than silently guessed.
//   - list blocks: data rows are collected until the end anchor, and mapped
//     onto the layout's slots in order; rows beyond the declared slots are
//     reported as overflow, never dropped silently.
//
// WHAT A CELL CAN SAY
//
// A numeric cell distinguishes three states the schema cares about: a number
// (including a reported zero), an explicit NA token, and blank (not filled —
// nothing will be written). Formula cells contribute their cached result; a
// formula whose cached result is an error object contributes blank. Text the
// parser cannot read as a number is reported, not coerced.

import ExcelJS from "exceljs";

import {
  isNaToken,
  labelsMatch,
  normaliseLabel,
  templateCellRef,
  type CellKind,
  type ReturnDomain,
  type ReturnSheetLayout,
  type SheetBlock,
  type SheetCell,
} from "./layoutTypes";
import { RETURN_LAYOUTS, layoutBySheetName } from "./layouts";

export interface ParsedReturnCell {
  key: string;
  /** Where the value was actually read, e.g. 'C44'. */
  sheetCell: string;
  /** Where the export will write it, e.g. 'C41' — null for surplus list slots. */
  templateCell: string | null;
  label: string;
  kind: CellKind;
  /** Numeric value; null for text cells, NA and unparseable text. */
  value: number | null;
  /** Text value; null for numeric cells. */
  text: string | null;
  isNotAvailable: boolean;
  rawText: string;
  /** False when the row was located by offset fallback instead of its label. */
  matchedByLabel: boolean;
}

export interface RowLabelMismatch {
  blockId: string;
  expected: string;
  /** The row the offset fallback settled on. */
  fallbackRow: number;
}

export interface ListOverflowRow {
  blockId: string;
  row: number;
  name: string;
}

export interface UnparsedCell {
  key: string;
  sheetCell: string;
  label: string;
  rawText: string;
}

export interface ParsedReturnSheet {
  sheetName: string;
  domain: ReturnDomain;
  title: string;
  /** Cells that carried something: a value, a text, or an explicit NA. */
  cells: ParsedReturnCell[];
  /** Section anchors that could not be found at all. */
  blocksNotFound: string[];
  /** Rows resolved by offset because their label did not match. */
  rowLabelMismatches: RowLabelMismatch[];
  /** List rows beyond the declared slots. */
  listOverflow: ListOverflowRow[];
  /** Numeric cells whose content was neither number, NA, nor blank. */
  unparsedCells: UnparsedCell[];
  /** Declared cells that were simply empty. */
  blankCount: number;
}

export interface ParseReturnResult {
  ok: boolean;
  error?: string;
  sheets?: ParsedReturnSheet[];
}

// ---------------------------------------------------------------------------

function rawTextOf(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyV = v as any;
    if (Array.isArray(anyV.richText)) {
      return anyV.richText.map((t: { text: string }) => t.text).join("");
    }
    if (anyV.result !== undefined) {
      const r = anyV.result;
      if (r === null || r === undefined) return "";
      if (typeof r === "object") return ""; // cached error, e.g. {error:'#DIV/0!'}
      return String(r);
    }
    if (anyV.text !== undefined) return String(anyV.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    // A formula with no cached result reads as blank.
    if (anyV.formula !== undefined || anyV.sharedFormula !== undefined) return "";
    return "";
  }
  return String(v);
}

function numberOf(text: string): number | null {
  const t = text.replace(/[₹$,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function bLabel(ws: ExcelJS.Worksheet, row: number): string {
  return rawTextOf(ws.getRow(row).getCell("B"));
}

/** Rows to scan past the last populated row, so a trailing block still lands. */
const SCAN_MARGIN = 10;

interface ResolvedBlock {
  block: SheetBlock;
  anchorRow: number | null;
  /** Exclusive upper bound of the block's window. */
  endRow: number;
}

function resolveAnchors(ws: ExcelJS.Worksheet, layout: ReturnSheetLayout): ResolvedBlock[] {
  const maxRow = ws.rowCount + SCAN_MARGIN;
  const resolved: ResolvedBlock[] = [];
  let cursor = 1;
  for (const block of layout.blocks) {
    let anchorRow: number | null = null;
    for (let r = cursor; r <= maxRow; r++) {
      if (labelsMatch(block.anchor, bLabel(ws, r))) {
        anchorRow = r;
        break;
      }
    }
    if (anchorRow != null) cursor = anchorRow + 1;
    resolved.push({ block, anchorRow, endRow: maxRow + 1 });
  }
  // Close each found block's window at the next found block's anchor.
  let nextAnchor = maxRow + 1;
  for (let i = resolved.length - 1; i >= 0; i--) {
    resolved[i].endRow = nextAnchor;
    if (resolved[i].anchorRow != null) nextAnchor = resolved[i].anchorRow as number;
  }
  return resolved;
}

function readCell(
  ws: ExcelJS.Worksheet,
  spec: SheetCell,
  row: number,
  matchedByLabel: boolean,
  sheet: ParsedReturnSheet
): void {
  const cell = ws.getRow(row).getCell(spec.col);
  const raw = rawTextOf(cell).trim();
  const sheetCell = `${spec.col}${row}`;

  if (raw === "") {
    sheet.blankCount += 1;
    return;
  }

  const base = {
    key: spec.key,
    sheetCell,
    templateCell: templateCellRef(spec),
    label: spec.label,
    kind: spec.kind,
    rawText: raw,
    matchedByLabel,
  };

  if (spec.kind === "text") {
    sheet.cells.push({ ...base, value: null, text: raw, isNotAvailable: false });
    return;
  }

  if (isNaToken(raw)) {
    sheet.cells.push({ ...base, value: null, text: null, isNotAvailable: true });
    return;
  }
  const num = numberOf(raw);
  if (num === null) {
    sheet.unparsedCells.push({ key: spec.key, sheetCell, label: spec.label, rawText: raw });
    return;
  }
  sheet.cells.push({ ...base, value: num, text: null, isNotAvailable: false });
}

function parseFixedBlock(
  ws: ExcelJS.Worksheet,
  rb: ResolvedBlock,
  cells: SheetCell[],
  sheet: ParsedReturnSheet
): void {
  const anchorRow = rb.anchorRow as number;
  const { block } = rb;

  // Distinct declared rows, in template order.
  const rowSpecs = new Map<number, { rowLabel: string | null; cells: SheetCell[] }>();
  for (const cell of cells) {
    if (cell.templateRow == null) continue;
    const entry = rowSpecs.get(cell.templateRow) ?? { rowLabel: cell.rowLabel, cells: [] };
    entry.cells.push(cell);
    rowSpecs.set(cell.templateRow, entry);
  }

  let cursor = anchorRow; // searches may land on the anchor row itself
  let prev: { templateRow: number; row: number } | null = null;

  for (const templateRow of [...rowSpecs.keys()].sort((a, b) => a - b)) {
    const spec = rowSpecs.get(templateRow) as { rowLabel: string | null; cells: SheetCell[] };
    let row: number | null = null;
    let matchedByLabel = false;

    if (spec.rowLabel != null) {
      for (let r = cursor; r < rb.endRow; r++) {
        if (labelsMatch(spec.rowLabel, bLabel(ws, r))) {
          row = r;
          matchedByLabel = true;
          break;
        }
      }
      if (row == null) {
        row = anchorRow + (templateRow - block.templateAnchorRow);
        sheet.rowLabelMismatches.push({
          blockId: block.id,
          expected: spec.rowLabel,
          fallbackRow: row,
        });
      }
    } else {
      row = prev
        ? prev.row + (templateRow - prev.templateRow)
        : anchorRow + (templateRow - block.templateAnchorRow);
    }

    cursor = Math.max(cursor, row + 1);
    prev = { templateRow, row };
    for (const cell of spec.cells) readCell(ws, cell, row, matchedByLabel, sheet);
  }
}

function parseListBlock(
  ws: ExcelJS.Worksheet,
  rb: ResolvedBlock,
  cells: SheetCell[],
  sheet: ParsedReturnSheet
): void {
  const anchorRow = rb.anchorRow as number;
  const { block } = rb;

  let start = anchorRow + 1;
  if (block.listStartAfter) {
    for (let r = anchorRow; r < rb.endRow; r++) {
      if (labelsMatch(block.listStartAfter, bLabel(ws, r))) {
        start = r + 1;
        break;
      }
    }
  }

  // Which columns constitute "data" for this list.
  const valueCols = [...new Set(cells.map((c) => c.col))].filter((col) => col !== "B");
  const wantsName = cells.some((c) => c.col === "B");

  const dataRows: number[] = [];
  for (let r = start; r < rb.endRow; r++) {
    const label = bLabel(ws, r);
    if (block.endAnchor && labelsMatch(block.endAnchor, label)) break;
    const hasName = wantsName && normaliseLabel(label) !== "";
    const hasValue = valueCols.some((col) => rawTextOf(ws.getRow(r).getCell(col)).trim() !== "");
    if (hasName || hasValue) dataRows.push(r);
  }

  const slots = block.slots ?? dataRows.length;
  dataRows.slice(slots).forEach((row) => {
    sheet.listOverflow.push({ blockId: block.id, row, name: bLabel(ws, row).trim() });
  });

  for (const cell of cells) {
    const slot = cell.slot ?? 1;
    const row = dataRows[slot - 1];
    if (row === undefined) continue; // fewer filed rows than declared slots
    readCell(ws, cell, row, true, sheet);
  }
}

function parseSheet(ws: ExcelJS.Worksheet, layout: ReturnSheetLayout): ParsedReturnSheet {
  const sheet: ParsedReturnSheet = {
    sheetName: layout.sheetName,
    domain: layout.domain,
    title: layout.title,
    cells: [],
    blocksNotFound: [],
    rowLabelMismatches: [],
    listOverflow: [],
    unparsedCells: [],
    blankCount: 0,
  };

  const resolved = resolveAnchors(ws, layout);
  const cellsByBlock = new Map<string, SheetCell[]>();
  for (const cell of layout.cells) {
    const list = cellsByBlock.get(cell.blockId) ?? [];
    list.push(cell);
    cellsByBlock.set(cell.blockId, list);
  }

  for (const rb of resolved) {
    const cells = cellsByBlock.get(rb.block.id) ?? [];
    if (!cells.length) continue;
    if (rb.anchorRow == null) {
      sheet.blocksNotFound.push(rb.block.anchor);
      continue;
    }
    if (rb.block.kind === "list") parseListBlock(ws, rb, cells, sheet);
    else parseFixedBlock(ws, rb, cells, sheet);
  }

  return sheet;
}

/**
 * Parses an uploaded monthly workbook. Accepts a file carrying either return
 * sheet or both; anything else is refused with a message naming the tabs the
 * screen expects.
 */
export async function parseReturnWorkbook(buffer: Buffer): Promise<ParseReturnResult> {
  const wb = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
  } catch {
    return { ok: false, error: "That file could not be opened as an .xlsx workbook." };
  }

  const sheets: ParsedReturnSheet[] = [];
  for (const ws of wb.worksheets) {
    const layout = layoutBySheetName(ws.name);
    if (layout) sheets.push(parseSheet(ws, layout));
  }

  if (!sheets.length) {
    const expected = RETURN_LAYOUTS.map((l) => `"${l.sheetName}"`).join(" or ");
    return {
      ok: false,
      error:
        `No recognisable return sheet found. This screen expects the monthly BRSR ` +
        `workbooks with a tab named ${expected}.`,
    };
  }

  return { ok: true, sheets };
}
