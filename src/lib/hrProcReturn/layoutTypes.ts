// The shared grammar for the two Birla monthly BRSR return sheets ("BRSR - HR"
// and "BRSR - Procurement"). One declarative layout per sheet drives three
// things that must never disagree:
//
//   1. the upload parser (which cells to read, and how to find their rows when
//      the filler has inserted or renamed rows),
//   2. the input_parameter seed (scripts/gen-hr-proc-seed.ts),
//   3. the Birla template export (which template cell each value lands in).
//
// WHY ROWS ARE RESOLVED BY LABEL AND NOT BY NUMBER
//
// The monthly workbooks are layout copies of the export template's own tabs,
// but not faithful ones: the filled Procurement sample is three rows longer
// than the template tab because the filler inserted material rows and renamed
// the "Material 1"/"Material 2" placeholders to "Concrete"/"Steel". A layout
// keyed on absolute rows would silently read the wrong cells — the exact
// failure mode this module exists to prevent. So every cell carries the
// TEMPLATE row (the export write target, which is fixed) plus the row LABEL
// the parser scans for in the uploaded file.
//
// CUMULATIVE SEMANTICS
//
// The client fills these sheets with FY-to-date figures each month. A month's
// upload is therefore a snapshot, not a delta: YTD = the latest month's value.
// Nothing here sums across months.

/** How a cell's content is typed in the database. */
export type CellKind = "number" | "text";

export type ReturnDomain = "HR" | "PROCUREMENT";

export interface SheetCell {
  /** input_parameter.key, e.g. 'hr.headcount_perm_emp_m'. */
  key: string;
  /** Which block resolves this cell's row. */
  blockId: string;
  /**
   * Row in the TEMPLATE tab. This is where the export writes. Null for list
   * slots beyond the template's placeholder rows: those values are ingested
   * and chartable but have no cell to land in (the export reports them).
   */
  templateRow: number | null;
  /** Column letter, identical in template and upload. */
  col: string;
  /**
   * Column-B text of the cell's row, matched normalised-prefix-wise when
   * parsing an upload. Null means "no label on that row" — the parser falls
   * back to the row's offset from the previously resolved row of the block.
   */
  rowLabel: string | null;
  kind: CellKind;
  /** Canonical label for the seed and the preview table. */
  label: string;
  unit?: string | null;
  /**
   * List blocks only: which captured data row (1-based) feeds this cell.
   * Cells sharing a slot come from the same row of the uploaded list.
   */
  slot?: number;
}

export interface SheetBlock {
  id: string;
  /**
   * Column-B text of the block's section header, matched normalised
   * prefix-wise. Blocks are located in declared order with a forward-moving
   * cursor, so a later block with a similar anchor (both Proc "Details on
   * assessment of value chain partners" sections) still resolves correctly.
   */
  anchor: string;
  /** Row of the anchor in the TEMPLATE, for offset fallbacks. */
  templateAnchorRow: number;
  kind: "fixed" | "list";
  /**
   * List blocks only: data rows start after the row matching this label
   * (a sub-header such as the "Example- Process solid waste…" hint row).
   * When absent, data rows start immediately after the anchor row.
   */
  listStartAfter?: string;
  /** List blocks only: scanning stops at the row matching this label. */
  endAnchor?: string;
  /** List blocks only: how many row slots the layout declares. */
  slots?: number;
}

export interface ReturnSheetLayout {
  /** Exact worksheet name, identical in template and monthly workbook. */
  sheetName: string;
  domain: ReturnDomain;
  /** Human name for previews and batch notes. */
  title: string;
  blocks: SheetBlock[];
  cells: SheetCell[];
}

/** Same normalisation contract as scope3Ledger's normaliseHeader. */
export function normaliseLabel(text: unknown): string {
  return (text ?? "").toString().replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Prefix match used for anchors and row labels. Long narrative labels drift in
 * small ways (trailing spaces, appended units such as "- MT"), so the match is
 * satisfied when either normalised string starts with the other, compared over
 * at least a meaningful stem.
 */
export function labelsMatch(expected: string, found: unknown): boolean {
  const e = normaliseLabel(expected);
  const f = normaliseLabel(found);
  if (!e || !f) return false;
  return f.startsWith(e) || e.startsWith(f);
}

/** Tokens that mean "explicitly not available" in a numeric cell. */
const NA_TOKENS = new Set([
  "na",
  "n.a.",
  "n.a",
  "n/a",
  "nil",
  "not available",
  "data not available",
  "data not avaialble", // the client's own spelling, seen in the wild
]);

export function isNaToken(text: unknown): boolean {
  return NA_TOKENS.has(normaliseLabel(text));
}

export function templateCellRef(cell: SheetCell): string | null {
  return cell.templateRow == null ? null : `${cell.col}${cell.templateRow}`;
}
