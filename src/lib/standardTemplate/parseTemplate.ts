// Reads a filled standard template back.
//
// PURE MODULE — takes a Buffer, returns data. No database, so the tests can
// round-trip generate → fill → parse without Supabase.
//
// DETERMINISTIC BY CONSTRUCTION
//
// The client's-own-form parser must guess: it fuzzy-matches printed labels
// against a per-site form replica, with exact/normalised/contains tiers, because
// it is reading somebody else's paper. This parser never guesses. Every row
// carries an input_parameter.key in a hidden column, so a match is either an
// exact key or nothing at all. A relabelled row still imports; a row whose key
// we do not recognise is reported, never approximated.
//
// WHAT IT REFUSES
//
// A file with no version stamp is not this template — most likely someone
// uploaded their own monthly form to the wrong screen, so the error says which
// screen to use instead. A file stamped with an unsupported version is refused
// rather than read on the assumption its layout is unchanged. Silence would mean
// mis-parsing, which is worse than rejection.

import ExcelJS from "exceljs";

import { parseQuantity } from "@/lib/siteEntry/parseQuantity";
import {
  HEADERS,
  HEADER_SCAN_ROWS,
  META_CELLS,
  META_SHEET,
  NA_TOKEN,
  SUPPORTED_VERSIONS,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  normaliseHeader,
} from "./templateLayout";

/** One data row as read off the sheet, before parameter ids are resolved. */
export interface ParsedRow {
  /** input_parameter.key from the hidden column. */
  key: string;
  /** Cell reference of the value cell, e.g. "C12", for the audit trail. */
  cell: string;
  /** The label as printed, for display only — never used for matching. */
  label: string | null;
  /** Raw text of the value cell, exactly as typed. */
  rawText: string | null;
  /** Number read from the value cell, after parseQuantity. */
  value: number | null;
  /** True when the Not-available column says NA. */
  isNotAvailable: boolean;
  /** Free text from Remarks. */
  remarks: string | null;
  /** How parseQuantity reached the value, when the text was not a bare number. */
  parseNote: string | null;
  /** A unit found in the text that differs from the row's own unit. */
  detectedUnit: string | null;
}

export interface ParseResult {
  ok: boolean;
  error?: string;
  /** Set when the file is a template but of the wrong version. */
  versionFound?: string | null;

  templateVersion?: string;
  /** What the file says it is for. Validated against the database by the caller. */
  header?: {
    siteCode: string | null;
    siteName: string | null;
    fiscalYear: string | null;
    monthNo: number | null;
    monthLabel: string | null;
  };
  rows?: ParsedRow[];
  /** Rows carrying a key, a value or an NA marker — i.e. worth committing. */
  filledCount?: number;
  /** Rows left entirely blank. Reported for reassurance, never written. */
  blankCount?: number;
}

export async function parseStandardTemplate(buffer: Buffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { ok: false, error: "That file could not be opened as an Excel workbook." };
  }

  // ---- Version gate -------------------------------------------------------
  const meta = wb.getWorksheet(META_SHEET);
  const stampedId = meta ? cellText(meta.getCell(META_CELLS.templateId)) : "";
  const stampedVersion = meta ? cellText(meta.getCell(META_CELLS.version)) : "";

  if (!meta || stampedId !== TEMPLATE_ID) {
    return {
      ok: false,
      error:
        "This is not a standard ESG return template. Download a fresh one from this " +
        "screen, or if you are uploading a site's own monthly form, use the " +
        "site's-own-form option instead.",
    };
  }

  if (!SUPPORTED_VERSIONS.has(stampedVersion)) {
    const newer = compareVersions(stampedVersion, TEMPLATE_VERSION) > 0;
    return {
      ok: false,
      versionFound: stampedVersion || null,
      error: newer
        ? `This template is version ${stampedVersion}, newer than this app supports ` +
          `(${TEMPLATE_VERSION}). The app needs updating.`
        : `This template is version ${stampedVersion || "unstamped"}; the current ` +
          `version is ${TEMPLATE_VERSION}. Download a fresh template and re-enter, or ` +
          `paste your figures into it — the row set has changed.`,
    };
  }

  // ---- Locate the data sheet and its header row ---------------------------
  // Anything that is not the meta or instructions sheet and contains the key
  // header. Scanning rather than assuming a sheet name means a renamed tab
  // still parses.
  let ws: ExcelJS.Worksheet | null = null;
  let headerRow = 0;
  let cols: Record<keyof typeof HEADERS, number> | null = null;

  for (const sheet of wb.worksheets) {
    if (sheet.name === META_SHEET) continue;
    const found = findHeader(sheet);
    if (found) {
      ws = sheet;
      headerRow = found.row;
      cols = found.cols;
      break;
    }
  }

  if (!ws || !cols) {
    return {
      ok: false,
      error:
        `No "${HEADERS.key}" column was found. That column is how the app identifies ` +
        `each row; if it was deleted, download a fresh template.`,
    };
  }
  if (!cols.value) {
    return {
      ok: false,
      error: `A "${HEADERS.value}" column was found but no values could be read from it.`,
    };
  }

  // ---- Header block -------------------------------------------------------
  const siteCode = meta ? cellText(meta.getCell(META_CELLS.siteCode)) || null : null;
  const metaFy = meta ? cellText(meta.getCell(META_CELLS.fiscalYear)) || null : null;
  const metaMonth = meta ? Number(cellText(meta.getCell(META_CELLS.monthNo))) : NaN;

  // The visible block wins over the stamp: a user who changed the dropdown meant
  // it, and the stamp only records what the file was generated for.
  const visible = readVisibleHeader(ws, headerRow);

  // ---- Body ---------------------------------------------------------------
  const rows: ParsedRow[] = [];
  let blankCount = 0;

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const key = cellText(row.getCell(cols.key)).trim();
    if (!key) continue; // section headings and spacers carry no key

    const valueCell = row.getCell(cols.value);
    const rawText = cellText(valueCell).trim();
    const naText = cols.notAvailable
      ? cellText(row.getCell(cols.notAvailable)).trim()
      : "";
    const remarks = cols.remarks ? cellText(row.getCell(cols.remarks)).trim() : "";

    const isNotAvailable = naText.toUpperCase() === NA_TOKEN;

    // PRECEDENCE, and it matters:
    //   1. NA wins. An explicit "not available" is a statement, and it stands
    //      even if a stale number was left in the value cell.
    //   2. A blank value with no NA marker means NOT REPORTED. The row is
    //      dropped entirely — no import_batch_row, no input_value. Writing 0
    //      here would turn "nobody filled this in" into "a return of zero".
    //   3. Otherwise parse the text, so "58 kg" on an MT row still lands.
    if (!isNotAvailable && rawText === "") {
      blankCount++;
      continue;
    }

    // The row's own unit, so "58 kg" typed on an MT row converts rather than
    // being taken at face value — the same discipline the manual screen uses.
    const rowUnit = cols.unit
      ? cellText(row.getCell(cols.unit)).replace(/\(memo\)/i, "").trim() || null
      : null;

    let value: number | null = null;
    let parseNote: string | null = null;
    let detectedUnit: string | null = null;
    let na = isNotAvailable;

    if (!na) {
      const parsed = parseQuantity(rawText, rowUnit);
      // parseQuantity also recognises "Nil", "None", "-" and friends as NA. A
      // site team that writes Nil in the Value column means the same thing as
      // ticking the NA column, and refusing to honour that would silently drop
      // a deliberate statement.
      if (parsed.notAvailable) {
        na = true;
      } else {
        value = parsed.value;
        parseNote = parsed.explanation ?? null;
        detectedUnit = parsed.detectedUnit ?? null;
      }
    }

    rows.push({
      key,
      cell: `${columnLetter(cols.value)}${r}`,
      label: cols.lineItem ? cellText(row.getCell(cols.lineItem)).trim() || null : null,
      rawText: rawText || null,
      value,
      isNotAvailable: na,
      remarks: remarks || null,
      parseNote,
      detectedUnit,
    });
  }

  return {
    ok: true,
    templateVersion: stampedVersion,
    header: {
      siteCode,
      siteName: visible.siteName,
      fiscalYear: visible.fiscalYear ?? metaFy,
      monthNo: Number.isFinite(metaMonth) ? metaMonth : null,
      monthLabel: visible.monthLabel,
    },
    rows,
    filledCount: rows.length,
    blankCount,
  };
}

// ---------------------------------------------------------------------------

/**
 * Finds the header row by its KEY column header, then locates every other
 * column by its own header text in that row.
 *
 * No fixed indices anywhere: inserting a row above the table moves the header
 * row and this still finds it; inserting a column between two others changes
 * every index and this still finds them. Both asserted in the test suite.
 */
function findHeader(
  ws: ExcelJS.Worksheet
): { row: number; cols: Record<keyof typeof HEADERS, number> } | null {
  const wanted = new Map<string, keyof typeof HEADERS>(
    Object.entries(HEADERS).map(([k, v]) => [normaliseHeader(v), k as keyof typeof HEADERS])
  );
  const keyHeader = normaliseHeader(HEADERS.key);
  const limit = Math.min(ws.rowCount, HEADER_SCAN_ROWS);

  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    const width = Math.max(row.cellCount, 12);

    let keyCol = 0;
    for (let c = 1; c <= width; c++) {
      if (normaliseHeader(cellText(row.getCell(c))) === keyHeader) {
        keyCol = c;
        break;
      }
    }
    if (!keyCol) continue;

    const cols = {
      lineItem: 0,
      key: keyCol,
      value: 0,
      unit: 0,
      notAvailable: 0,
      remarks: 0,
    } as Record<keyof typeof HEADERS, number>;

    for (let c = 1; c <= width; c++) {
      const which = wanted.get(normaliseHeader(cellText(row.getCell(c))));
      if (which && !cols[which]) cols[which] = c;
    }
    return { row: r, cols };
  }
  return null;
}

/** Reads the visible Site / Fiscal year / Month block above the table. */
function readVisibleHeader(
  ws: ExcelJS.Worksheet,
  headerRow: number
): { siteName: string | null; fiscalYear: string | null; monthLabel: string | null } {
  const out = { siteName: null as string | null, fiscalYear: null as string | null, monthLabel: null as string | null };

  for (let r = 1; r < headerRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 4; c++) {
      const label = normaliseHeader(cellText(row.getCell(c)));
      if (!label) continue;
      // The value sits to the right of its label, in the first non-empty cell.
      let v = "";
      for (let vc = c + 1; vc <= c + 4; vc++) {
        v = cellText(row.getCell(vc)).trim();
        if (v) break;
      }
      if (!v) continue;
      if (label === "site" && !out.siteName) out.siteName = v;
      else if (label === "fiscal year" && !out.fiscalYear) out.fiscalYear = v;
      else if (label === "month" && !out.monthLabel) out.monthLabel = v;
    }
  }
  return out;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell?.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown; formula?: string };
    if (o.richText) return o.richText.map((t) => t.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined && o.result !== null) return String(o.result);
    return "";
  }
  return String(v);
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

/** -1 / 0 / 1, comparing dotted numeric versions. */
function compareVersions(a: string, b: string): number {
  const pa = (a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = (b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
