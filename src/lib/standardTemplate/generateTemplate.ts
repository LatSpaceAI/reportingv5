// Builds the blank standard input template as a real .xlsx.
//
// Generated, never hand-authored: the row set comes from esg.input_parameter at
// request time, so seeding a 58th parameter makes it appear here with no code
// change. Only the editorial decisions live in templateLayout.ts — which
// parameters are excluded, which sections collapse, the section order.
//
// COLOUR CONVENTION, borrowed from the client's own Scope 3 calculator so it
// reads as familiar:
//   yellow fill + blue text  = you type here
//   grey fill                = do not type (computed, or a locked key column)
//
// The three states a cell can express — a number, "not available", and "not
// filled in" — are the whole reason the Value and Not-available columns are
// separate. See parseTemplate.ts for how they are read back.

import ExcelJS from "exceljs";

import {
  HEADERS,
  INSTRUCTIONS_SHEET,
  META_CELLS,
  META_SHEET,
  NA_TOKEN,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  buildSections,
  type TemplateParameter,
} from "./templateLayout";

const BRAND = "FF074D47"; // Primary Dark, per designlanguage.md
const INPUT_FILL = "FFFFF9DB"; // yellow — type here
const INPUT_TEXT = "FF1F4E79"; // blue — type here
const LOCKED_FILL = "FFF2F2F2"; // grey — do not type
const MEMO_TEXT = "FF808080";
const SECTION_FILL = "FFE8F1F0";

export interface GenerateTemplateInput {
  parameters: TemplateParameter[];
  /** Pre-fills the header block. Null produces a blank template. */
  site: { code: string; name: string } | null;
  fiscalYear: string;
  period: { monthNo: number; monthLabel: string } | null;
  /** Dropdown options for the site cell. */
  siteOptions: { code: string; name: string }[];
  monthOptions: { monthNo: number; monthLabel: string }[];
  generatedAt: string;
}

/** Column indices on the data sheet. Written here, DISCOVERED by the parser. */
const COL = {
  lineItem: 1,
  key: 2,
  value: 3,
  unit: 4,
  notAvailable: 5,
  remarks: 6,
} as const;

export async function generateTemplate(
  input: GenerateTemplateInput
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Plato ESG";
  wb.created = new Date(input.generatedAt);

  writeInstructions(wb, input);
  writeDataSheet(wb, input);
  writeMeta(wb, input);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

// ---------------------------------------------------------------------------

function writeInstructions(wb: ExcelJS.Workbook, input: GenerateTemplateInput) {
  const ws = wb.addWorksheet(INSTRUCTIONS_SHEET);
  ws.columns = [{ width: 4 }, { width: 104 }];

  const lines: [string, "title" | "head" | "body"][] = [
    ["Birla Estates — monthly ESG site return", "title"],
    [`Standard template v${TEMPLATE_VERSION}`, "body"],
    ["", "body"],
    ["How to fill this in", "head"],
    ["1. Confirm the site, fiscal year and month in the header block on the Return sheet.", "body"],
    ["2. Enter each figure in the Value column, in the unit shown beside it.", "body"],
    [
      `3. If a figure genuinely is not available, put ${NA_TOKEN} in the "Not available" column and leave Value blank.`,
      "body",
    ],
    ["4. Leave BOTH columns blank for anything you were not asked to report.", "body"],
    ["", "body"],
    ["The three states, and why they are different", "head"],
    [
      "A reported zero, an unavailable figure and a row nobody filled in are three different facts, and this",
      "body",
    ],
    ["template keeps them apart:", "body"],
    ["", "body"],
    ["    Value = 0             the site reports zero. A real measurement.", "body"],
    [`    Not available = ${NA_TOKEN}      the figure exists but could not be obtained this month.`, "body"],
    ["    both blank            not reported. Nothing is recorded at all.", "body"],
    ["", "body"],
    [
      "Writing 0 for a row you simply did not fill in would turn 'nobody reported' into 'a return of zero',",
      "body",
    ],
    ["which is the single most misleading thing this form could record. Please leave it blank instead.", "body"],
    ["", "body"],
    ["Notes", "head"],
    ["• Yellow cells with blue text are yours to fill in. Grey cells are locked.", "body"],
    ["• The Parameter key column is hidden and must not be edited — it is how the app", "body"],
    ["  identifies each row, so a renamed label still imports correctly.", "body"],
    [
      "• Rows marked (memo) are collected for cross-checking and do not feed a BRSR disclosure directly.",
      "body",
    ],
    ["• Collapsed sections can be expanded with the + in the left margin.", "body"],
    ["• One workbook covers ONE site and ONE month.", "body"],
    ["", "body"],
    ["Labels here are the platform's canonical wording, which may differ slightly from", "body"],
    ["your own printed form. The hidden key, not the label, decides where a figure lands.", "body"],
  ];

  lines.forEach(([text, kind], i) => {
    const cell = ws.getCell(i + 2, 2);
    cell.value = text;
    if (kind === "title") cell.font = { bold: true, size: 14, color: { argb: BRAND } };
    else if (kind === "head") cell.font = { bold: true, size: 11, color: { argb: BRAND } };
    else cell.font = { size: 10 };
  });
}

function writeDataSheet(wb: ExcelJS.Workbook, input: GenerateTemplateInput) {
  const ws = wb.addWorksheet("Return");

  ws.columns = [
    { width: 46 }, // Line item
    { width: 26, hidden: true }, // Parameter key — hidden, load-bearing
    { width: 14 }, // Value
    { width: 10 }, // Unit
    { width: 14 }, // Not available
    { width: 40 }, // Remarks
  ];

  // ---- Header block -------------------------------------------------------
  const title = ws.getCell("A1");
  title.value = "Birla Estates — monthly ESG site return";
  title.font = { bold: true, size: 13, color: { argb: BRAND } };

  const field = (row: number, label: string, value: string | number | null) => {
    const l = ws.getCell(row, 1);
    l.value = label;
    l.font = { bold: true, size: 10 };
    const v = ws.getCell(row, 3);
    v.value = value;
    v.font = { size: 10, color: { argb: INPUT_TEXT } };
    v.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
    v.border = boxBorder();
    return v;
  };

  const siteCell = field(3, "Site", input.site?.name ?? null);
  const fyCell = field(4, "Fiscal year", input.fiscalYear);
  const monthCell = field(5, "Month", input.period?.monthLabel ?? null);

  // Dropdowns, so a typo cannot become an unresolvable site.
  if (input.siteOptions.length) {
    siteCell.dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${input.siteOptions.map((s) => s.name).join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Unknown site",
      error: "Pick a site from the list.",
    };
  }
  if (input.monthOptions.length) {
    monthCell.dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${input.monthOptions.map((m) => m.monthLabel).join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Unknown month",
      error: "Pick a month from the list.",
    };
  }

  ws.getCell("A6").value =
    "Yellow cells with blue text are yours to fill in. See the Instructions tab first.";
  ws.getCell("A6").font = { italic: true, size: 9, color: { argb: MEMO_TEXT } };

  // ---- Header row ---------------------------------------------------------
  // Row 8. The parser does NOT assume that — it scans for the key header text.
  const headerRow = 8;
  const headers: [number, string][] = [
    [COL.lineItem, HEADERS.lineItem],
    [COL.key, HEADERS.key],
    [COL.value, HEADERS.value],
    [COL.unit, HEADERS.unit],
    [COL.notAvailable, HEADERS.notAvailable],
    [COL.remarks, HEADERS.remarks],
  ];
  for (const [c, text] of headers) {
    const cell = ws.getCell(headerRow, c);
    cell.value = text;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle" };
    cell.border = boxBorder();
  }
  ws.views = [{ state: "frozen", ySplit: headerRow }];

  // ---- Body ---------------------------------------------------------------
  let r = headerRow + 1;
  for (const section of buildSections(input.parameters)) {
    const head = ws.getCell(r, 1);
    head.value = section.name;
    head.font = { bold: true, size: 10, color: { argb: BRAND } };
    for (let c = 1; c <= 6; c++) {
      ws.getCell(r, c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: SECTION_FILL },
      };
    }
    r++;

    for (const p of section.parameters) {
      const row = ws.getRow(r);
      if (section.collapsed) {
        row.outlineLevel = 1;
        row.hidden = true;
      }

      const label = ws.getCell(r, COL.lineItem);
      label.value = p.isMemo ? `${p.label}` : p.label;
      label.font = p.isMemo
        ? { size: 10, italic: true, color: { argb: MEMO_TEXT } }
        : { size: 10 };
      label.alignment = { indent: 1, wrapText: true, vertical: "middle" };

      // The key. Hidden column, grey, and the thing the parser actually reads.
      const key = ws.getCell(r, COL.key);
      key.value = p.key;
      key.font = { size: 9, name: "Consolas", color: { argb: MEMO_TEXT } };
      key.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LOCKED_FILL } };

      const value = ws.getCell(r, COL.value);
      value.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
      value.font = { size: 10, color: { argb: INPUT_TEXT } };
      value.border = boxBorder();
      value.numFmt = "#,##0.###";

      const unit = ws.getCell(r, COL.unit);
      unit.value = p.isMemo ? `${p.unit ?? ""} (memo)`.trim() : p.unit ?? "";
      unit.font = { size: 9, color: { argb: MEMO_TEXT } };

      const na = ws.getCell(r, COL.notAvailable);
      na.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
      na.font = { size: 10, color: { argb: INPUT_TEXT } };
      na.border = boxBorder();
      na.alignment = { horizontal: "center" };
      na.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${NA_TOKEN}"`],
        showErrorMessage: true,
        errorTitle: "Not available",
        error: `Enter ${NA_TOKEN}, or leave blank if the row was simply not reported.`,
      };

      const remarks = ws.getCell(r, COL.remarks);
      remarks.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
      remarks.font = { size: 9, color: { argb: INPUT_TEXT } };

      if (p.isMemo) {
        label.note =
          "Collected for cross-checking and completeness. Does not feed a BRSR disclosure.";
      }

      r++;
    }
  }

  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: r - 1, column: 6 } };
}

function writeMeta(wb: ExcelJS.Workbook, input: GenerateTemplateInput) {
  const ws = wb.addWorksheet(META_SHEET);
  // veryHidden keeps it out of Excel's unhide list, so it survives casual
  // tidying. The visible header block is the fallback if it is stripped anyway.
  ws.state = "veryHidden";

  const put = (addr: string, label: string, value: string | number | null) => {
    const row = Number(addr.slice(1));
    ws.getCell(`A${row}`).value = label;
    ws.getCell(addr).value = value;
  };

  put(META_CELLS.templateId, "template_id", TEMPLATE_ID);
  put(META_CELLS.version, "version", TEMPLATE_VERSION);
  put(META_CELLS.generatedAt, "generated_at", input.generatedAt);
  put(META_CELLS.siteCode, "site_code", input.site?.code ?? null);
  put(META_CELLS.fiscalYear, "fiscal_year", input.fiscalYear);
  put(META_CELLS.monthNo, "month_no", input.period?.monthNo ?? null);

  ws.getCell("A8").value =
    "Written by the app. Do not edit — the importer reads this to confirm the file is a " +
    "current standard template rather than guessing at its layout.";
}

function boxBorder(): ExcelJS.Borders {
  const side = { style: "thin" as const, color: { argb: "FFD0D0D0" } };
  return { top: side, left: side, bottom: side, right: side } as ExcelJS.Borders;
}
