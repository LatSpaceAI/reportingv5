// Reads a filled Scope 3 ledger workbook back.
//
// PURE MODULE — takes a Buffer, returns data. No database, so the tests can
// round-trip generate → fill → parse without Supabase.
//
// DETERMINISTIC BY CONSTRUCTION, LIKE parseTemplate.ts
//
// Every column is located by its HEADER TEXT within a header row that is itself
// located by scanning for the line-ID header. No fixed indices, so inserting a
// row above a table or a column between two others cannot break an import.
//
// WHAT IT DOES NOT DO, DELIBERATELY
//
// It does not validate dropdown values against the mapping table. A value like
// 'Cement - OPQ' parses fine here and is reported by the service layer as
// unmapped, because the mapping table is the authority and it can be extended
// without a deploy. A parser that rejected unknown values would make a file
// stale the moment someone added a material.
//
// It does not resolve site names or months to ids. A sheet cannot know the site
// register, and a parser that silently dropped an unrecognised site name would
// lose a whole project's procurement. Both are reported as text and resolved by
// ledgerService.ts, which CAN see the database.
//
// It does not sum, convert or infer. Every figure lands in attrs exactly as
// typed, because s3_line is the audit record and resolve-scope3.mjs is where
// arithmetic happens.

import ExcelJS from "exceljs";

import {
  HEADER_SCAN_ROWS,
  LEDGER_META_CELLS,
  LEDGER_META_SHEET,
  LEDGER_SHEETS,
  LEDGER_TEMPLATE_ID,
  SUPPORTED_LEDGER_VERSIONS,
  ledgerBySheet,
  normaliseHeader,
  type LedgerColumn,
  type LedgerSheet,
} from "./ledgerLayout";

/** One ledger row as read off a sheet, before ids are resolved. */
export interface ParsedLedgerRow {
  /** esg.s3_ledger.code. */
  ledger: string;
  /** The sheet's own Line ID. */
  lineNo: number;
  /** Sheet row number, for the audit trail: '1 Procurement!47'. */
  sheetRow: number;
  /** The row's fields, keyed by the attrs contract. */
  attrs: Record<string, string | number>;
  /** Site / property / project name as typed, when the ledger carries one. */
  siteName: string | null;
  /** Month as typed ('2025-04'), when the ledger carries one. */
  month: string | null;
  /** Required columns that were left blank. Reported, never blocking. */
  missingRequired: string[];
}

export interface ParsedLedgerSheet {
  ledger: string;
  sheet: string;
  title: string;
  /** Rows carrying a line ID. */
  rows: ParsedLedgerRow[];
  /** Rows skipped because they had no line ID — the blank tail of the sheet. */
  blankCount: number;
  /** Headers present in the file that this build does not know. */
  unknownHeaders: string[];
  /** Columns this build expects that the file does not have. */
  missingHeaders: string[];
}

export interface ParseLedgerResult {
  ok: boolean;
  error?: string;
  versionFound?: string | null;

  templateVersion?: string;
  fiscalYear?: string | null;
  sheets?: ParsedLedgerSheet[];
  /** Total rows across every sheet. */
  rowCount?: number;
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyV = v as any;
    if (Array.isArray(anyV.richText)) {
      return anyV.richText.map((t: { text: string }) => t.text).join("");
    }
    if (anyV.text !== undefined) return String(anyV.text);
    if (anyV.result !== undefined) return String(anyV.result);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (anyV.formula !== undefined) return "";
    return "";
  }
  return String(v);
}

/**
 * Reads a numeric cell.
 *
 * Tolerates the thousands separators and stray currency symbols an SAP export
 * carries, because a procurement extract pasted into Excel routinely arrives as
 * '4,200,000' or '₹ 4200000' — and refusing those would mean the ESG team
 * hand-cleans 300 rows.
 *
 * Returns null for anything not a number, INCLUDING the empty string. Null means
 * "not stated", which the computation treats differently from zero.
 */
function numberOf(text: string): number | null {
  const t = text.replace(/[₹$,\s]/g, "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export async function parseLedgerWorkbook(buffer: Buffer): Promise<ParseLedgerResult> {
  const wb = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
  } catch {
    return { ok: false, error: "That file could not be opened as an .xlsx workbook." };
  }

  // ---- Version stamp -------------------------------------------------------
  // A file with no stamp is not this workbook. Most likely someone uploaded the
  // client's own Scope 3 calculator, or a monthly return to the wrong screen, so
  // the message names both rather than saying "invalid file".
  const meta = wb.getWorksheet(LEDGER_META_SHEET);
  const stampedId = meta ? cellText(meta.getCell(LEDGER_META_CELLS.templateId)).trim() : "";
  const stampedVersion = meta ? cellText(meta.getCell(LEDGER_META_CELLS.version)).trim() : "";

  if (stampedId !== LEDGER_TEMPLATE_ID) {
    return {
      ok: false,
      error:
        "This is not a Scope 3 ledger workbook. Download a blank one from this screen and " +
        "fill that in. (A monthly site return goes to Data collection → Site return; the " +
        "client's own Scope 3 calculator cannot be uploaded directly — its sheets are " +
        "formulas, not data.)",
    };
  }
  if (!SUPPORTED_LEDGER_VERSIONS.has(stampedVersion)) {
    return {
      ok: false,
      error:
        `This workbook was generated by a different version of the platform ` +
        `(${stampedVersion || "unstamped"}). Download a fresh one and re-enter, or ask for ` +
        `this version to be supported.`,
      versionFound: stampedVersion || null,
    };
  }

  const fiscalYear = meta ? cellText(meta.getCell(LEDGER_META_CELLS.fiscalYear)).trim() || null : null;

  // ---- Each ledger sheet ---------------------------------------------------
  const sheets: ParsedLedgerSheet[] = [];
  let rowCount = 0;

  for (const ws of wb.worksheets) {
    const spec = ledgerBySheet(ws.name);
    if (!spec) continue; // Instructions, Lists, _plato_meta

    const found = findLedgerHeader(ws, spec);
    if (!found) {
      // A ledger sheet whose header row cannot be found is reported as an empty
      // sheet with every column missing, rather than skipped silently — an
      // upload that lost a whole sheet must be visible in the preview.
      sheets.push({
        ledger: spec.code,
        sheet: ws.name,
        title: spec.title,
        rows: [],
        blankCount: 0,
        unknownHeaders: [],
        missingHeaders: spec.columns.map((c) => c.header),
      });
      continue;
    }

    const { row: headerRow, colByAttr, unknownHeaders } = found;
    const missingHeaders = spec.columns
      .filter((c) => !colByAttr.get(c.attr))
      .map((c) => c.header);

    const rows: ParsedLedgerRow[] = [];
    let blankCount = 0;

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);

      // A row needs BOTH a line ID and some data.
      //
      // The generator pre-fills Line ID 1..300 so nobody numbers rows by hand,
      // which means an empty row carries an ID too. Anchoring on the ID alone
      // would import a four-row return as three hundred rows, 296 of them
      // empty — and those would land in s3_line and have to be explained.
      //
      // So the two conditions are checked separately, and the three outcomes
      // are distinguished rather than collapsed:
      //   ID + data     -> a filed line
      //   ID, no data   -> the blank remainder of the sheet; counted, not filed
      //   data, no ID   -> a filing mistake; REPORTED, because the row will be
      //                    dropped and the filler has no way to know
      const lineCol = colByAttr.get("line_no");
      const lineText = lineCol ? cellText(row.getCell(lineCol)).trim() : "";
      const lineNo = numberOf(lineText);

      const hasAnyValue = spec.columns.some((c) => {
        const col = colByAttr.get(c.attr);
        return col && c.attr !== "line_no" && cellText(row.getCell(col)).trim() !== "";
      });

      if (!hasAnyValue) {
        blankCount++;
        continue;
      }

      if (lineNo === null) {
        rows.push({
          ledger: spec.code,
          lineNo: 0,
          sheetRow: r,
          attrs: {},
          siteName: null,
          month: null,
          missingRequired: ["Line ID"],
        });
        continue;
      }

      const attrs: Record<string, string | number> = {};
      const missingRequired: string[] = [];
      let siteName: string | null = null;
      let month: string | null = null;

      for (const col of spec.columns) {
        if (col.attr === "line_no") continue;
        const c = colByAttr.get(col.attr);
        if (!c) continue;

        const text = cellText(row.getCell(c)).trim();
        if (text === "") {
          if (col.required) missingRequired.push(col.header);
          continue;
        }

        if (col.type === "number") {
          const n = numberOf(text);
          if (n === null) {
            // A number column holding text is kept AS TEXT rather than dropped.
            // The computation reads it as unparseable and reports it; dropping
            // it would make a mistyped tonnage look like an unfilled row.
            attrs[col.attr] = text;
          } else {
            attrs[col.attr] = n;
          }
        } else {
          attrs[col.attr] = text;
        }

        // The two fields the service layer resolves against the database.
        if (spec.hasSite && isSiteAttr(spec, col)) siteName = text;
        if (col.attr === "month") month = text;
      }

      rows.push({
        ledger: spec.code,
        lineNo,
        sheetRow: r,
        attrs,
        siteName,
        month,
        missingRequired,
      });
      rowCount++;
    }

    sheets.push({
      ledger: spec.code,
      sheet: ws.name,
      title: spec.title,
      rows,
      blankCount,
      unknownHeaders,
      missingHeaders,
    });
  }

  if (!sheets.length) {
    return {
      ok: false,
      error:
        "This workbook carries the right version stamp but none of its nine ledger sheets " +
        "were found. Sheets may have been renamed or deleted.",
    };
  }

  return { ok: true, templateVersion: stampedVersion, fiscalYear, sheets, rowCount };
}

/**
 * Which column carries the site/property/project name.
 *
 * The nine sheets name it five different ways ('Site', 'Property', 'Project',
 * 'Project / site', 'Project / plant code'), so it is identified by its attr
 * rather than its header.
 */
function isSiteAttr(spec: LedgerSheet, col: LedgerColumn): boolean {
  if (!spec.hasSite) return false;
  return ["site_name", "property", "project", "project_code"].includes(col.attr);
}

/**
 * Finds the header row by the line-ID header, then locates every declared
 * column by its own header text in that row.
 *
 * Headers are matched on normalised text, so a re-typed 'Line ID ' still
 * resolves. Anything in the header row this build does not recognise is
 * REPORTED rather than ignored: a column someone added is the single most
 * useful thing to see when a sheet has quietly changed shape.
 */
function findLedgerHeader(
  ws: ExcelJS.Worksheet,
  spec: LedgerSheet
): { row: number; colByAttr: Map<string, number>; unknownHeaders: string[] } | null {
  const wanted = new Map<string, string>(
    spec.columns.map((c) => [normaliseHeader(c.header), c.attr])
  );
  const anchor = normaliseHeader(spec.columns[0].header); // 'line id'
  const limit = Math.min(ws.rowCount, HEADER_SCAN_ROWS);

  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    const width = Math.max(row.cellCount, spec.columns.length + 4);

    let anchorCol = 0;
    for (let c = 1; c <= width; c++) {
      if (normaliseHeader(cellText(row.getCell(c))) === anchor) {
        anchorCol = c;
        break;
      }
    }
    if (!anchorCol) continue;

    const colByAttr = new Map<string, number>();
    const unknownHeaders: string[] = [];

    for (let c = 1; c <= width; c++) {
      const text = cellText(row.getCell(c)).trim();
      if (!text) continue;
      const attr = wanted.get(normaliseHeader(text));
      if (attr) {
        // First occurrence wins, so a duplicated header cannot silently
        // redirect a column.
        if (!colByAttr.has(attr)) colByAttr.set(attr, c);
      } else {
        unknownHeaders.push(text);
      }
    }

    return { row: r, colByAttr, unknownHeaders };
  }

  return null;
}
