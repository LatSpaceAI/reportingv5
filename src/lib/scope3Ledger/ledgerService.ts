// Database access for the Scope 3 ledgers: what to put in a blank workbook, how
// to resolve a parsed one against the site register, and how to persist it.
//
// server-only. The pure layout/parse modules are deliberately separate so the
// round-trip test can run without Supabase.
//
// WHY THIS DOES NOT CALL commitValues
//
// commitValues persists Map<parameterKey, AccumulatedValue> into input_value for
// ONE site-month. A ledger is a different shape in every dimension: many rows
// rather than one value per slot, nine ledgers rather than one form, a fiscal
// YEAR rather than a month, and no accumulation at all — two purchase orders
// from the same supplier are two facts, not a sum.
//
// So this is a SIBLING that reuses the four GUARANTEES rather than the code:
//
//   1. Nothing is overwritten silently. An upload that would replace existing
//      lines for a ledger-year refuses without overrideExisting.
//   2. Nothing is destroyed. Replaced lines are copied into s3_line_history,
//      pointing at the batch that replaced them, BEFORE the new rows are written.
//   3. Committing does not compute. The lines land with factor_key and
//      emissions_t null; resolve-scope3.mjs fills them. An upload is evidence
//      somebody filed data, not a disclosure.
//   4. Validation never blocks. Unmapped dropdown values, unresolved sites and
//      missing required fields are all REPORTED and still saved, because a
//      ledger line held hostage to a spelling is a ledger line nobody files.
//
// The handoff said to extract the shared guarantees only if the second
// implementation actually wanted to share code. It does not: the two disagree
// about supersession scope, accumulation and grain, and a common abstraction
// over them would be more confusing than two clear modules.

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { LEDGER_SHEETS, ledgerByCode } from "./ledgerLayout";
import type { ParsedLedgerRow, ParsedLedgerSheet } from "./parseLedger";

// ---------------------------------------------------------------------------
// Blank-workbook inputs
// ---------------------------------------------------------------------------

/** Real sites (never GROUP) for the site dropdowns. */
export async function loadSiteOptions(): Promise<{ code: string; name: string }[]> {
  const { data, error } = await supabaseAdmin
    .from("site")
    .select("code, name, is_group")
    .eq("is_group", false)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => ({ code: s.code as string, name: s.name as string }));
}

/**
 * The fiscal year's months as 'YYYY-MM', in fiscal order.
 *
 * Derived from period_start rather than assembled from month_no, because month 1
 * is April and the calendar year rolls over at month 10. Building the string by
 * hand is exactly where an off-by-one lands nine months of data in the wrong
 * calendar year.
 */
export async function loadMonthOptions(fiscalYear: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("period")
    .select("month_no, period_start")
    .eq("fiscal_year", fiscalYear)
    .eq("period_kind", "month")
    .order("month_no", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((p) => p.period_start)
    .map((p) => String(p.period_start).slice(0, 7));
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** A parsed row with its database references resolved. */
export interface ResolvedLedgerRow extends ParsedLedgerRow {
  siteId: number | null;
  periodId: number | null;
  /** Dropdown values that no mapping row claims. Reported, never blocking. */
  unmappedValues: { column: string; value: string }[];
  /** Set when a site name was given but matched nothing. */
  unresolvedSite: string | null;
  /** Set when a month was given but matched no period in this fiscal year. */
  unresolvedMonth: string | null;
}

export interface ResolvedLedgerSheet extends Omit<ParsedLedgerSheet, "rows"> {
  rows: ResolvedLedgerRow[];
}

export interface ResolutionSummary {
  sheets: ResolvedLedgerSheet[];
  rowCount: number;
  /** Rows that will import but land unattributed to an asset. */
  unresolvedSiteCount: number;
  unresolvedMonthCount: number;
  /** Rows carrying a value no mapping row claims — these contribute ZERO. */
  unmappedCount: number;
  /** Rows missing a field the computation needs. */
  missingRequiredCount: number;
  /** Procurement lines with no Scope 3 tag: the double-counting guard's input. */
  untaggedCount: number;
  /** Distinct unmapped values, so the fix is one mapping row rather than 40 edits. */
  unmappedValues: { block: string; value: string; count: number }[];
}

const norm = (s: string | null | undefined) =>
  String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Which mapping block a column's value is looked up in.
 *
 * The waste block is absent on purpose: its key is a COMPOSITE of stream and
 * route, so neither column can be checked alone. It is handled per row below.
 */
const BLOCK_BY_ATTR: Record<string, string> = {
  material_type: "material",
  vehicle_type: "freight",
  spend_category: "spend",
  travel_mode: "travel",
  commute_mode: "commute",
  refrigerant_type: "refrigerant",
};

/**
 * Resolves parsed sheets against the site register, the period table and the
 * mapping table.
 *
 * Nothing here fails a row. Every problem is recorded on the row and counted in
 * the summary, so the preview can show a reviewer exactly what will land and
 * what will be ignored — before anything is written.
 */
export async function resolveLedgerSheets(
  sheets: ParsedLedgerSheet[],
  fiscalYear: string
): Promise<ResolutionSummary> {
  const [{ data: siteRows }, { data: periodRows }, { data: mappingRows }] = await Promise.all([
    supabaseAdmin.from("site").select("id, code, name, is_group"),
    supabaseAdmin
      .from("period")
      .select("id, month_no, period_start")
      .eq("fiscal_year", fiscalYear)
      .eq("period_kind", "month"),
    supabaseAdmin.from("s3_mapping").select("block, lookup_key, is_active"),
  ]);

  // Sites are matched on name OR code, case-insensitively. The nine sheets are
  // filled by five different teams and they do not agree on which to use.
  const siteByName = new Map<string, number>();
  for (const s of siteRows ?? []) {
    if (s.is_group) continue; // a ledger line belongs to an asset, never to the rollup
    siteByName.set(norm(s.name as string), s.id as number);
    siteByName.set(norm(s.code as string), s.id as number);
  }

  const periodByMonth = new Map<string, number>();
  for (const p of periodRows ?? []) {
    if (p.period_start) periodByMonth.set(String(p.period_start).slice(0, 7), p.id as number);
  }

  const mappedByBlock = new Map<string, Set<string>>();
  for (const m of mappingRows ?? []) {
    if (m.is_active === false) continue;
    const block = m.block as string;
    if (!mappedByBlock.has(block)) mappedByBlock.set(block, new Set());
    mappedByBlock.get(block)!.add(norm(m.lookup_key as string));
  }

  const out: ResolvedLedgerSheet[] = [];
  let rowCount = 0;
  let unresolvedSiteCount = 0;
  let unresolvedMonthCount = 0;
  let unmappedCount = 0;
  let missingRequiredCount = 0;
  let untaggedCount = 0;
  const unmappedTally = new Map<string, { block: string; value: string; count: number }>();

  for (const sheet of sheets) {
    const spec = ledgerByCode(sheet.ledger);
    const rows: ResolvedLedgerRow[] = [];

    for (const row of sheet.rows) {
      const unmappedValues: { column: string; value: string }[] = [];

      // ---- site ------------------------------------------------------------
      let siteId: number | null = null;
      let unresolvedSite: string | null = null;
      if (row.siteName) {
        siteId = siteByName.get(norm(row.siteName)) ?? null;
        if (siteId === null) {
          unresolvedSite = row.siteName;
          unresolvedSiteCount++;
        }
      }

      // ---- month -----------------------------------------------------------
      let periodId: number | null = null;
      let unresolvedMonth: string | null = null;
      if (row.month) {
        periodId = periodByMonth.get(row.month.trim()) ?? null;
        if (periodId === null) {
          unresolvedMonth = row.month;
          unresolvedMonthCount++;
        }
      }

      // ---- dropdown values against the mapping table -----------------------
      for (const [attr, block] of Object.entries(BLOCK_BY_ATTR)) {
        const v = row.attrs[attr];
        if (typeof v !== "string" || !v) continue;
        // A material line carrying its own supplier EPD does not use the
        // material mapping at all, so an unrecognised material type there is
        // not a problem worth reporting.
        if (
          attr === "material_type" &&
          String(row.attrs.epd_available ?? "").trim().toUpperCase() === "Y"
        ) {
          continue;
        }
        if (!mappedByBlock.get(block)?.has(norm(v))) {
          unmappedValues.push({ column: attr, value: v });
          const k = `${block}|${norm(v)}`;
          const cur = unmappedTally.get(k) ?? { block, value: v, count: 0 };
          cur.count++;
          unmappedTally.set(k, cur);
        }
      }

      // ---- the waste composite ---------------------------------------------
      if (sheet.ledger === "waste") {
        const stream = String(row.attrs.waste_stream ?? "").trim();
        const route = String(row.attrs.disposal_route ?? "").trim();
        if (stream && route) {
          const composite = `${stream} | ${route}`;
          if (!mappedByBlock.get("waste")?.has(norm(composite))) {
            unmappedValues.push({ column: "waste_stream + disposal_route", value: composite });
            const k = `waste|${norm(composite)}`;
            const cur = unmappedTally.get(k) ?? { block: "waste", value: composite, count: 0 };
            cur.count++;
            unmappedTally.set(k, cur);
          }
        }
      }

      // ---- the double-counting guard's entry-time half ---------------------
      // Counted here as well as in the resolver, because catching it at upload
      // is the difference between fixing a spreadsheet and restating a figure.
      if (sheet.ledger === "procurement" && !String(row.attrs.s3_tag ?? "").trim()) {
        untaggedCount++;
      }

      if (unmappedValues.length) unmappedCount++;
      if (row.missingRequired.length) missingRequiredCount++;
      rowCount++;

      rows.push({
        ...row,
        siteId,
        periodId,
        unmappedValues,
        unresolvedSite,
        unresolvedMonth,
      });
    }

    out.push({ ...sheet, rows, title: spec?.title ?? sheet.title });
  }

  return {
    sheets: out,
    rowCount,
    unresolvedSiteCount,
    unresolvedMonthCount,
    unmappedCount,
    missingRequiredCount,
    untaggedCount,
    unmappedValues: [...unmappedTally.values()].sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

export interface CommitLedgerInput {
  fiscalYear: string;
  batchId: number;
  /** 'Scope3 FY26.xlsx' — prefixed onto every source_doc. */
  sourceBase: string;
  enteredBy: string;
  sheets: ResolvedLedgerSheet[];
  overrideExisting?: boolean;
}

export type CommitLedgerResult =
  | {
      ok: true;
      saved: number;
      superseded: number;
      /** Per ledger, so the UI can say which sheets landed. */
      byLedger: { ledger: string; saved: number }[];
    }
  | { ok: false; requiresOverride: true; error: string; existingCount: number }
  | { ok: false; requiresOverride?: false; error: string; unprocessable?: true };

/**
 * Writes resolved ledger rows into s3_line for one fiscal year, archiving
 * whatever they replace.
 *
 * SUPERSESSION IS PER (LEDGER, FISCAL YEAR), NOT PER WORKBOOK.
 *
 *   A workbook containing only sheet 5 must not delete the procurement lines
 *   somebody else filed last week. Ledgers are owned by five different teams
 *   and arrive at different times, so each sheet supersedes only itself — and
 *   only when the upload actually carries rows for it. A sheet left blank is
 *   "I have nothing to add", not "delete what is there".
 */
export async function commitLedgerLines(
  input: CommitLedgerInput
): Promise<CommitLedgerResult> {
  const { fiscalYear, batchId, sourceBase, enteredBy, sheets, overrideExisting } = input;

  // Only ledgers this upload actually carries rows for.
  const incoming = sheets.filter((s) => s.rows.some((r) => r.lineNo > 0));
  if (!incoming.length) {
    return {
      ok: false,
      unprocessable: true,
      error:
        "No ledger rows were found in this workbook. Every row needs a Line ID — rows without " +
        "one are reported in the preview and not saved.",
    };
  }
  const ledgerCodes = incoming.map((s) => s.ledger);

  // ---- Existing data: refuse to overwrite without explicit consent ---------
  const { data: existingData, error: exErr } = await supabaseAdmin
    .from("s3_line")
    .select("id, ledger, fiscal_year, site_id, period_id, line_no, attrs, factor_key, " +
            "factor_value, quantity, emissions_t, emissions_t_2, category, exclusion_reason, " +
            "source_doc, entered_by, entered_at")
    .eq("fiscal_year", fiscalYear)
    .in("ledger", ledgerCodes)
    .is("superseded_at", null);
  if (exErr) throw exErr;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (existingData ?? []) as any[];

  if (existing.length > 0 && !overrideExisting) {
    const byLedger = new Map<string, number>();
    for (const e of existing) {
      byLedger.set(e.ledger, (byLedger.get(e.ledger) ?? 0) + 1);
    }
    const detail = [...byLedger.entries()]
      .map(([code, n]) => `${ledgerByCode(code)?.title ?? code} (${n})`)
      .join(", ");
    return {
      ok: false,
      requiresOverride: true,
      existingCount: existing.length,
      error:
        `${fiscalYear} already has ${existing.length} ledger line(s) recorded for the sheet(s) ` +
        `in this file: ${detail}. Confirm the override to replace them. Ledgers not in this ` +
        `file are left untouched.`,
    };
  }

  // ---- Archive what is being replaced --------------------------------------
  let superseded = 0;
  if (existing.length) {
    const { error: histErr } = await supabaseAdmin.from("s3_line_history").insert(
      existing.map((e) => ({
        line_id: e.id,
        ledger: e.ledger,
        fiscal_year: e.fiscal_year,
        site_id: e.site_id,
        period_id: e.period_id,
        line_no: e.line_no,
        attrs: e.attrs,
        factor_key: e.factor_key,
        factor_value: e.factor_value,
        quantity: e.quantity,
        emissions_t: e.emissions_t,
        emissions_t_2: e.emissions_t_2,
        category: e.category,
        exclusion_reason: e.exclusion_reason,
        source_doc: e.source_doc,
        entered_by: e.entered_by,
        entered_at: e.entered_at,
        superseded_by_batch_id: batchId,
      }))
    );
    if (histErr) throw histErr;
    superseded = existing.length;

    // Deleted so the new upload owns the (ledger, fiscal_year, line_no) slot
    // outright — the same discipline input_value uses. History holds the
    // originals, and s3_line_history.line_id points back at what this was.
    const { error: delErr } = await supabaseAdmin
      .from("s3_line")
      .delete()
      .in("id", existing.map((e) => e.id));
    if (delErr) throw delErr;
  }

  // ---- Write ---------------------------------------------------------------
  const toInsert: Record<string, unknown>[] = [];
  const byLedger: { ledger: string; saved: number }[] = [];

  for (const sheet of incoming) {
    // Keyed by line number, so a duplicated Line ID within a sheet resolves to
    // ONE row rather than violating the unique constraint and failing the whole
    // insert. Last one wins; the preview already reported the duplicate.
    const bySheetLine = new Map<number, Record<string, unknown>>();

    for (const row of sheet.rows) {
      if (row.lineNo <= 0) continue; // reported in the preview, never written

      bySheetLine.set(row.lineNo, {
        ledger: sheet.ledger,
        fiscal_year: fiscalYear,
        site_id: row.siteId,
        period_id: row.periodId,
        line_no: row.lineNo,
        attrs: row.attrs,
        // factor_key, quantity, emissions_t and category are deliberately NOT
        // set. An upload records what was filed; resolve-scope3.mjs decides what
        // it means. Writing a computed figure here would make the ledger claim
        // an answer that no resolver run stands behind.
        import_batch_id: batchId,
        source_doc: `${sourceBase} › ${sheet.sheet}!${row.sheetRow}`,
        entered_by: enteredBy,
        // Problems travel WITH the row rather than only in the preview, which
        // disappears when the page closes. A reviewer looking at this line in
        // six months can see it arrived with an unresolved site.
        note: buildNote(row),
      });
    }
    toInsert.push(...bySheetLine.values());
    byLedger.push({ ledger: sheet.ledger, saved: bySheetLine.size });
  }

  if (toInsert.length) {
    const chunk = 500;
    for (let i = 0; i < toInsert.length; i += chunk) {
      const { error: insErr } = await supabaseAdmin
        .from("s3_line")
        .insert(toInsert.slice(i, i + chunk));
      if (insErr) throw insErr;
    }
  }

  // ---- Close the batch -----------------------------------------------------
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("import_batch")
    .update({ status: "committed", committed_at: now })
    .eq("id", batchId);

  return { ok: true, saved: toInsert.length, superseded, byLedger };
}

/** A short, human note recording what was unresolved when the row arrived. */
function buildNote(row: ResolvedLedgerRow): string | null {
  const parts: string[] = [];
  if (row.unresolvedSite) parts.push(`site '${row.unresolvedSite}' not in the register`);
  if (row.unresolvedMonth) parts.push(`month '${row.unresolvedMonth}' not in this fiscal year`);
  for (const u of row.unmappedValues) parts.push(`'${u.value}' has no emission factor mapping`);
  if (row.missingRequired.length) parts.push(`missing: ${row.missingRequired.join(", ")}`);
  return parts.length ? parts.join("; ") : null;
}

/**
 * Creates the preview batch a commit will later consume.
 *
 * import_batch requires a site and a period, both of which a Scope 3 workbook
 * genuinely lacks — it is company-wide and annual. The GROUP site and the
 * fiscal year's YTD period stand in, which is the same grain resolve-scope3.mjs
 * writes its output at, so the batch is at least consistent with what it feeds.
 */
export async function createLedgerBatch(args: {
  fiscalYear: string;
  filename: string;
  fileHash: string | null;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  uploadedBy: string;
}): Promise<number> {
  const [{ data: group }, { data: ytd }] = await Promise.all([
    supabaseAdmin.from("site").select("id").eq("is_group", true).single(),
    supabaseAdmin
      .from("period")
      .select("id")
      .eq("fiscal_year", args.fiscalYear)
      .eq("period_kind", "ytd")
      .single(),
  ]);
  if (!group) throw new Error("No GROUP site found — check 03_dimensions_seed.sql");
  if (!ytd) {
    throw new Error(
      `No YTD period for ${args.fiscalYear}. Scope 3 is disclosed annually and needs one.`
    );
  }

  const { data, error } = await supabaseAdmin
    .from("import_batch")
    .insert({
      site_id: group.id,
      period_id: ytd.id,
      filename: args.filename,
      sheet_name: "Scope 3 ledgers",
      file_hash: args.fileHash,
      status: "preview",
      row_count: args.rowCount,
      matched_count: args.matchedCount,
      unmatched_count: args.unmatchedCount,
      uploaded_by: args.uploadedBy,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

/** Ledger codes and titles, for the UI. */
export function ledgerCatalogue() {
  return LEDGER_SHEETS.map((l) => ({
    code: l.code,
    sheet: l.sheet,
    title: l.title,
    owner: l.owner,
    grain: l.grain,
  }));
}
