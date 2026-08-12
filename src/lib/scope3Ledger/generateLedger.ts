// Builds the blank Scope 3 ledger workbook as a real .xlsx.
//
// Nine data sheets, an instructions tab, a lists tab and a hidden version stamp.
// The layout comes entirely from ledgerLayout.ts, which the parser also reads —
// that shared source is what stops the written and read layouts drifting.
//
// COLOUR CONVENTION, borrowed from the client's own Scope 3 calculator so it
// reads as familiar to the same people:
//   yellow fill + blue text  = you type here
//   grey fill                = do not type
//
// WHY THE DROPDOWNS MATTER MORE HERE THAN ON THE MONTHLY TEMPLATE
//
// On the monthly return a typo produces a number in the wrong row, which is
// visible. Here, every dropdown value is a LOOKUP KEY into esg.s3_mapping, and
// an unrecognised key contributes ZERO to its category while looking like a
// filled-in row. So every list column is real Excel data validation, and the
// preview reports anything that still failed to map.

import ExcelJS from "exceljs";

import {
  LEDGER_INSTRUCTIONS_SHEET,
  LEDGER_META_CELLS,
  LEDGER_META_SHEET,
  LEDGER_SHEETS,
  LEDGER_TEMPLATE_ID,
  LEDGER_TEMPLATE_VERSION,
  type LedgerColumn,
  type LedgerSheet,
} from "./ledgerLayout";

const BRAND = "FF074D47";
const INPUT_FILL = "FFFFF9DB";
const INPUT_TEXT = "FF1F4E79";
const LOCKED_FILL = "FFF2F2F2";
const MEMO_TEXT = "FF808080";
const SECTION_FILL = "FFE8F1F0";
const WARN_TEXT = "FF9A3412";

export interface GenerateLedgerInput {
  fiscalYear: string;
  /** Site names offered in the site dropdowns. */
  siteOptions: { code: string; name: string }[];
  /** Months of the fiscal year, as 'YYYY-MM', for the month dropdowns. */
  monthOptions: string[];
  generatedAt: string;
  /** Generate only this ledger's sheet. Undefined produces all nine. */
  onlyLedger?: string;
}

const HEADER_ROW = 6;

export async function generateLedgerWorkbook(input: GenerateLedgerInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Plato ESG";
  wb.created = new Date(input.generatedAt);

  const sheets = input.onlyLedger
    ? LEDGER_SHEETS.filter((l) => l.code === input.onlyLedger)
    : LEDGER_SHEETS;

  // ORDER IS LOAD-BEARING. Lists whose inline validation exceeds Excel's 255
  // character limit point at a named range on the Lists sheet, so the column
  // assignment must exist BEFORE any data sheet writes its validation. Building
  // the map first — rather than relying on writeListsSheet having run — is what
  // stops a long dropdown silently pointing at the wrong column.
  const listColumns = assignListColumns(sheets);

  writeInstructions(wb, input, sheets);
  for (const spec of sheets) writeLedgerSheet(wb, spec, input, listColumns);
  writeListsSheet(wb, sheets, listColumns);
  writeMeta(wb, input);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

// ---------------------------------------------------------------------------

function writeInstructions(
  wb: ExcelJS.Workbook,
  input: GenerateLedgerInput,
  sheets: readonly LedgerSheet[]
) {
  const ws = wb.addWorksheet(LEDGER_INSTRUCTIONS_SHEET);
  ws.columns = [{ width: 4 }, { width: 108 }];

  let r = 2;
  const line = (text: string, opts: Partial<ExcelJS.Font> = {}, gap = 0) => {
    const c = ws.getCell(r, 2);
    c.value = text;
    c.font = { size: 10, ...opts };
    c.alignment = { wrapText: true, vertical: "top" };
    r += 1 + gap;
  };

  line("Scope 3 ledgers", { size: 16, bold: true, color: { argb: BRAND } });
  line(`Fiscal year ${input.fiscalYear}`, { size: 11, color: { argb: MEMO_TEXT } }, 1);

  line("How this differs from the monthly site return", { size: 12, bold: true });
  line(
    "The monthly return asks for one number per row. These sheets are LEDGERS: one row is one " +
      "purchase order, one delivery, one trip. Add as many rows as you need — the sheets are " +
      "pre-formatted but not limited to what you can see.",
    {},
    1
  );

  line("Filling these in", { size: 12, bold: true });
  line("Yellow cells with blue text are yours to fill in. Grey cells are not.");
  line(
    "EVERY ROW NEEDS A LINE ID. It is how a figure in the final disclosure is traced back to " +
      "the row it came from. A row with data but no Line ID is reported and dropped."
  );
  line(
    "Where a cell has a dropdown, USE IT. Those values are looked up to find an emission " +
      "factor, and a value that does not match contributes nothing to the total while still " +
      "looking like a filled-in row. If the list is missing something you need, say so rather " +
      "than typing it in — the list is extended centrally.",
    { color: { argb: WARN_TEXT } }
  );
  line(
    "Leave a cell blank if you do not have the figure. A blank means 'not stated', which is " +
      "treated differently from a zero.",
    {},
    1
  );

  line("The one rule that matters most", { size: 12, bold: true });
  line(
    "A rupee of spend belongs to exactly ONE method. If a material is counted by tonnage on " +
      "sheet 2, its purchase order must be tagged EXCLUDE on sheet 1. Otherwise the same cement " +
      "is counted twice — once by weight and once by value.",
    { color: { argb: WARN_TEXT } },
    1
  );

  line("The sheets", { size: 12, bold: true });
  for (const s of sheets) {
    line(`${s.sheet}  —  ${s.title}`, { bold: true });
    line(`     One row = ${s.grain}.`, { size: 9, color: { argb: MEMO_TEXT } });
    line(`     Owner: ${s.owner}. Mirrors '${s.sourceSheet}' in the Scope 3 calculator.`, {
      size: 9,
      color: { argb: MEMO_TEXT },
    });
  }
  r += 1;

  line("When you are done", { size: 12, bold: true });
  line(
    "Upload this file on Data collection → Scope 3 ledgers. You will see a preview of what was " +
      "read, including anything that could not be matched, before anything is saved."
  );
}

// ---------------------------------------------------------------------------

/**
 * Which column of the Lists sheet holds each dropdown's values.
 *
 * Computed once, up front, and passed to both the validation writer and the
 * Lists writer so the two cannot disagree about where a list lives.
 */
function assignListColumns(sheets: readonly LedgerSheet[]): Map<string, number> {
  const out = new Map<string, number>();
  let col = 1;
  for (const s of sheets) {
    for (const c of s.columns) {
      if (c.type === "list" && c.options?.length && !out.has(c.attr)) {
        out.set(c.attr, col++);
      }
    }
  }
  return out;
}

function writeLedgerSheet(
  wb: ExcelJS.Workbook,
  spec: LedgerSheet,
  input: GenerateLedgerInput,
  listColumns: Map<string, number>
) {
  const ws = wb.addWorksheet(spec.sheet);

  ws.getCell("A1").value = `${spec.sheet.replace(/^\d+\s/, "")} — ${spec.title}`;
  ws.getCell("A1").font = { size: 14, bold: true, color: { argb: BRAND } };

  ws.getCell("A2").value = `Owner: ${spec.owner}.  One row = ${spec.grain}.`;
  ws.getCell("A2").font = { size: 10, color: { argb: MEMO_TEXT } };

  ws.getCell("A3").value =
    "Yellow cells are yours to fill in. Every row needs a Line ID. Add rows as needed.";
  ws.getCell("A3").font = { size: 9, italic: true, color: { argb: MEMO_TEXT } };

  // The traps, stated on the sheet itself. Somebody filling this in has the tab
  // open and the instructions closed.
  let noteRow = 4;
  for (const n of spec.notes ?? []) {
    ws.getCell(noteRow, 1).value = n;
    ws.getCell(noteRow, 1).font = { size: 9, color: { argb: WARN_TEXT } };
    noteRow++;
  }

  // ---- Header row ----------------------------------------------------------
  // Written at a known row; DISCOVERED by the parser via the header text, so
  // this can move without breaking an import.
  const headerRow = Math.max(HEADER_ROW, noteRow + 1);
  const hr = ws.getRow(headerRow);
  spec.columns.forEach((col, i) => {
    const c = hr.getCell(i + 1);
    c.value = col.header;
    c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    c.border = boxBorder();
    if (col.help) {
      c.note = { texts: [{ text: col.help }] };
    }
    ws.getColumn(i + 1).width = col.width ?? 16;
  });
  hr.height = 34;

  // ---- Body ----------------------------------------------------------------
  const first = headerRow + 1;
  const last = headerRow + spec.rowCapacity;

  for (let r = first; r <= last; r++) {
    const row = ws.getRow(r);
    spec.columns.forEach((col, i) => {
      const c = row.getCell(i + 1);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
      c.font = { size: 9, color: { argb: INPUT_TEXT } };
      c.border = boxBorder();
      if (col.type === "number") c.alignment = { horizontal: "right" };
      applyValidation(c, col, listColumns);
      // Site and month are dropdowns too, built from the database at generation
      // time rather than frozen in the layout. A mistyped site name is not a
      // cosmetic problem: the row still imports, but it lands unattributed and
      // the preview has to ask a human which asset was meant.
      applyDynamicValidation(c, col, spec, input);
    });
    row.height = 15;
  }

  // Line ID pre-filled 1..n, so a filler never has to number rows by hand and
  // the ID a problem is reported against is stable.
  //
  // THE CONSEQUENCE THE PARSER MUST HANDLE: every blank row now carries an ID
  // too. The parser therefore anchors on "has a line ID AND has some data" — a
  // row with an ID and nothing else is the blank remainder of the sheet, not a
  // filed line. Getting that wrong would import a four-row return as three
  // hundred rows, 296 of them empty, and those would land in s3_line and have
  // to be explained to an assurer.
  //
  // A formula (IF(B="","",ROW()-n)) was the alternative and is worse: ExcelJS
  // writes no cached result, so a workbook that never passed through Excel
  // parses as having no line IDs at all.
  for (let r = first; r <= last; r++) {
    const c = ws.getCell(r, 1);
    c.value = r - headerRow;
    c.font = { size: 9, color: { argb: MEMO_TEXT } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LOCKED_FILL } };
  }

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: headerRow }];
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: spec.columns.length },
  };
}

/**
 * Data validation for a column.
 *
 * Excel's inline list format (a quoted, comma-joined string) has a hard 255
 * character limit, and several of these lists are longer than that — the Scope 3
 * tag list alone is 200+. Anything that does not fit points at a named range on
 * the Lists sheet instead, which has no such limit.
 *
 * allowBlank is TRUE on every list, including required ones: a blank is "not
 * stated" and must remain typeable. Requiredness is reported in the preview, not
 * enforced by Excel, matching how the rest of this codebase treats validation.
 */
function applyValidation(
  cell: ExcelJS.Cell,
  col: LedgerColumn,
  listColumns: Map<string, number>
) {
  if (col.type !== "list" || !col.options?.length) return;

  const inline = `"${col.options.join(",")}"`;
  const formulae =
    inline.length <= 255 ? [inline] : [listRangeName(col.attr, col.options.length, listColumns)];

  cell.dataValidation = {
    type: "list",
    allowBlank: true,
    formulae,
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: "Not on the list",
    error:
      "That value is not one this model recognises, so it would not be matched to an " +
      "emission factor. Pick from the list, or leave it blank and add a note.",
  };
}

/**
 * Site and month dropdowns, whose values come from the database rather than the
 * layout.
 *
 * Only applied where the column is free text in the layout — the site and month
 * columns. allowBlank stays true and the error style is a WARNING, not a stop:
 * the procurement ledger legitimately carries project codes that are not sites,
 * and a hard block would leave someone unable to file a real purchase order.
 */
function applyDynamicValidation(
  cell: ExcelJS.Cell,
  col: LedgerColumn,
  spec: LedgerSheet,
  input: GenerateLedgerInput
) {
  const isSite =
    spec.hasSite && ["site_name", "property", "project"].includes(col.attr);
  const isMonth = col.attr === "month";
  if (!isSite && !isMonth) return;

  const values = isSite ? input.siteOptions.map((s) => s.name) : input.monthOptions;
  if (!values.length) return;

  const inline = `"${values.join(",")}"`;
  if (inline.length > 255) return; // too many to inline; free text stands

  cell.dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [inline],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: isSite ? "Not a known site" : "Not a month in this fiscal year",
    error: isSite
      ? "That name does not match the site register, so the row will import without being " +
        "attributed to an asset. Pick from the list if it is one of these."
      : "Months run April to March of the fiscal year on the Instructions tab. Use YYYY-MM.",
  };
}

/**
 * Named range for a list too long to inline.
 *
 * Bounded to the list's ACTUAL length rather than a generous fixed range: a
 * range extending past the values would put blank entries in the dropdown, and
 * a blank picked from a list is indistinguishable from a cell nobody touched.
 */
function listRangeName(
  attr: string,
  count: number,
  listColumns: Map<string, number>
): string {
  const letter = columnLetter(listColumns.get(attr) ?? 1);
  return `Lists!$${letter}$2:$${letter}$${1 + count}`;
}

function columnLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/**
 * The Lists sheet.
 *
 * Every dropdown's values, one list per column. Serves two purposes: it backs
 * the validation for lists too long to inline, and it is the reference someone
 * checks when they want to know what values exist without clicking a cell.
 */
function writeListsSheet(
  wb: ExcelJS.Workbook,
  sheets: readonly LedgerSheet[],
  listColumns: Map<string, number>
) {
  const ws = wb.addWorksheet("Lists");

  // One column per distinct list across the sheets being generated.
  const seen = new Map<string, readonly string[]>();
  for (const s of sheets) {
    for (const c of s.columns) {
      if (c.type === "list" && c.options?.length && !seen.has(c.attr)) {
        seen.set(c.attr, c.options);
      }
    }
  }

  for (const [attr, options] of seen) {
    const col = listColumns.get(attr)!;
    const head = ws.getCell(1, col);
    head.value = attr;
    head.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    options.forEach((o, i) => {
      const c = ws.getCell(2 + i, col);
      c.value = o;
      c.font = { size: 9 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_FILL } };
    });
    ws.getColumn(col).width = Math.min(
      44,
      Math.max(14, ...options.map((o) => o.length + 2))
    );
  }

  ws.getCell(62, 1).value =
    "Reference only. These lists are maintained centrally — if something you need is missing, " +
    "ask for it to be added rather than typing a new value into a sheet.";
  ws.getCell(62, 1).font = { size: 9, italic: true, color: { argb: MEMO_TEXT } };
}

function writeMeta(wb: ExcelJS.Workbook, input: GenerateLedgerInput) {
  const ws = wb.addWorksheet(LEDGER_META_SHEET);
  ws.getCell("A1").value = "template_id";
  ws.getCell(LEDGER_META_CELLS.templateId).value = LEDGER_TEMPLATE_ID;
  ws.getCell("A2").value = "version";
  ws.getCell(LEDGER_META_CELLS.version).value = LEDGER_TEMPLATE_VERSION;
  ws.getCell("A3").value = "generated_at";
  ws.getCell(LEDGER_META_CELLS.generatedAt).value = input.generatedAt;
  ws.getCell("A4").value = "fiscal_year";
  ws.getCell(LEDGER_META_CELLS.fiscalYear).value = input.fiscalYear;

  // veryHidden: not in Excel's unhide list, so it cannot be casually deleted and
  // an upload cannot lose the stamp that identifies the file.
  ws.state = "veryHidden";
}

function boxBorder(): Partial<ExcelJS.Borders> {
  const side = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
  return { top: side, left: side, bottom: side, right: side };
}
