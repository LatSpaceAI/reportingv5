// Parses an uploaded Scope 3 ledger workbook and returns it for review.
//
//   POST /api/esg/scope3/ledgers/preview   (multipart: file, fy)
//
// Sibling of entry/import/standard-preview, which handles the monthly return.
// The difference is what a "row" is: there, a row is one parameter's value and
// the review is about whether the number was read correctly. Here a row is a
// purchase order, there may be three hundred of them, and the review is about
// whether they will MATCH — an unmapped material type or an unrecognised site
// still imports, but contributes nothing, and that has to be visible before
// anyone commits.
//
// NOTHING IS WRITTEN TO s3_line HERE. The rows are recorded as an import_batch
// in 'preview' state, and each parsed row is stored on import_batch_row so the
// commit step has something to consume without a second upload — the same
// contract the monthly path uses.
//
// WHY THE ROWS ARE PERSISTED RATHER THAN RETURNED AND POSTED BACK
//
//   A 300-line procurement ledger is too large to round-trip through a browser
//   and back without inviting the client to edit it in transit. The batch row is
//   the record of what the SERVER read, and the commit reads that same record —
//   so what gets committed is what was previewed, not what a client says was
//   previewed.

import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseLedgerWorkbook } from "@/lib/scope3Ledger/parseLedger";
import { resolveLedgerSheets, createLedgerBatch } from "@/lib/scope3Ledger/ledgerService";
import { ledgerByCode } from "@/lib/scope3Ledger/ledgerLayout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_FY = "2025-26";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  let file: File | null = null;
  let fiscalYear = DEFAULT_FY;

  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
    const fy = form.get("fy");
    if (typeof fy === "string" && fy) fiscalYear = fy;
  } catch {
    return json({ ok: false, error: "Expected a multipart upload." }, 400);
  }

  if (!file) return json({ ok: false, error: "No file was uploaded." }, 400);
  if (!/^\d{4}-\d{2}$/.test(fiscalYear)) {
    return json({ ok: false, error: `'${fiscalYear}' is not a fiscal year like 2025-26.` }, 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseLedgerWorkbook(buffer);

    if (!parsed.ok || !parsed.sheets) {
      return json(
        { ok: false, error: parsed.error ?? "The file could not be read.", versionFound: parsed.versionFound },
        422
      );
    }

    // The workbook's own stamp wins a disagreement only by being reported. A
    // file generated for FY25-26 and uploaded against FY24-25 is far more likely
    // to be a mis-click than a deliberate re-filing, and silently accepting it
    // would file a year of procurement against the wrong disclosure.
    if (parsed.fiscalYear && parsed.fiscalYear !== fiscalYear) {
      return json(
        {
          ok: false,
          error:
            `This workbook was generated for ${parsed.fiscalYear} but is being uploaded ` +
            `against ${fiscalYear}. Re-select the year, or download a fresh workbook for ` +
            `${fiscalYear}.`,
          fiscalYearInFile: parsed.fiscalYear,
        },
        409
      );
    }

    const summary = await resolveLedgerSheets(parsed.sheets, fiscalYear);

    if (summary.rowCount === 0) {
      return json(
        {
          ok: false,
          error:
            "The workbook was read but every ledger sheet was empty. Rows need a Line ID — " +
            "rows carrying data without one are reported here and not saved.",
        },
        422
      );
    }

    // ---- Record the upload -------------------------------------------------
    const matched = summary.rowCount - summary.unmappedCount;
    const batchId = await createLedgerBatch({
      fiscalYear,
      filename: file.name,
      fileHash: null,
      rowCount: summary.rowCount,
      matchedCount: matched,
      unmatchedCount: summary.unmappedCount,
      uploadedBy: "esg-team",
    });

    await supabaseAdmin
      .from("import_batch")
      .update({ note: `Scope 3 ledgers v${parsed.templateVersion} · ${fiscalYear}` })
      .eq("id", batchId);

    // One import_batch_row per ledger line. The whole resolved row travels in
    // raw_text as JSON, because import_batch_row was built for (label, value)
    // cells and a ledger line is neither — but the alternative, a second batch
    // table with the same lifecycle, is a migration to store the same thing.
    //
    // source_label carries 'ledger|lineNo' so the commit can group without
    // parsing the payload.
    const batchRows = summary.sheets.flatMap((sheet) =>
      sheet.rows.map((row) => ({
        batch_id: batchId,
        sheet_cell: `${sheet.sheet}!${row.sheetRow}`,
        source_label: `${sheet.ledger}|${row.lineNo}`,
        raw_text: JSON.stringify({
          attrs: row.attrs,
          siteId: row.siteId,
          periodId: row.periodId,
          lineNo: row.lineNo,
          sheetRow: row.sheetRow,
          sheet: sheet.sheet,
          unresolvedSite: row.unresolvedSite,
          unresolvedMonth: row.unresolvedMonth,
          unmappedValues: row.unmappedValues,
          missingRequired: row.missingRequired,
        }),
        matched_field_id: null,
        match_confidence:
          row.lineNo <= 0
            ? "unmatched"
            : row.unmappedValues.length
              ? "fuzzy"
              : "exact",
        parsed_value: null,
        unit_factor: 1,
        canonical_value: null,
        is_not_available: false,
      }))
    );

    if (batchRows.length) {
      const chunk = 500;
      for (let i = 0; i < batchRows.length; i += chunk) {
        const { error } = await supabaseAdmin
          .from("import_batch_row")
          .insert(batchRows.slice(i, i + chunk));
        if (error) throw error;
      }
    }

    // ---- What already exists, so the UI can warn before the commit does ----
    const ledgersInFile = summary.sheets
      .filter((s) => s.rows.some((r) => r.lineNo > 0))
      .map((s) => s.ledger);

    const { data: existing } = await supabaseAdmin
      .from("s3_line")
      .select("ledger")
      .eq("fiscal_year", fiscalYear)
      .in("ledger", ledgersInFile.length ? ledgersInFile : ["__none__"])
      .is("superseded_at", null);

    const existingByLedger = new Map<string, number>();
    for (const e of existing ?? []) {
      existingByLedger.set(e.ledger as string, (existingByLedger.get(e.ledger as string) ?? 0) + 1);
    }

    return json({
      ok: true,
      batchId,
      fiscalYear,
      templateVersion: parsed.templateVersion,
      totals: {
        rows: summary.rowCount,
        matched,
        unmapped: summary.unmappedCount,
        unresolvedSites: summary.unresolvedSiteCount,
        unresolvedMonths: summary.unresolvedMonthCount,
        missingRequired: summary.missingRequiredCount,
        untaggedProcurement: summary.untaggedCount,
      },
      // Distinct unmapped values with counts, so a fix is one mapping row
      // rather than forty spreadsheet edits.
      unmappedValues: summary.unmappedValues,
      sheets: summary.sheets.map((s) => ({
        ledger: s.ledger,
        sheet: s.sheet,
        title: s.title,
        rows: s.rows.filter((r) => r.lineNo > 0).length,
        rowsWithoutLineId: s.rows.filter((r) => r.lineNo <= 0).length,
        blankRows: s.blankCount,
        unknownHeaders: s.unknownHeaders,
        missingHeaders: s.missingHeaders,
        existingRows: existingByLedger.get(s.ledger) ?? 0,
        grain: ledgerByCode(s.ledger)?.grain ?? null,
        // A sample, so the reviewer can see real rows without shipping 300.
        sample: s.rows
          .filter((r) => r.lineNo > 0)
          .slice(0, 5)
          .map((r) => ({
            lineNo: r.lineNo,
            attrs: r.attrs,
            unresolvedSite: r.unresolvedSite,
            unresolvedMonth: r.unresolvedMonth,
            unmappedValues: r.unmappedValues,
            missingRequired: r.missingRequired,
          })),
        // Every problem row, so nothing needing attention is hidden behind a
        // sample limit.
        problems: s.rows
          .filter(
            (r) =>
              r.lineNo <= 0 ||
              r.unresolvedSite ||
              r.unresolvedMonth ||
              r.unmappedValues.length ||
              r.missingRequired.length
          )
          .slice(0, 100)
          .map((r) => ({
            lineNo: r.lineNo,
            sheetRow: r.sheetRow,
            unresolvedSite: r.unresolvedSite,
            unresolvedMonth: r.unresolvedMonth,
            unmappedValues: r.unmappedValues,
            missingRequired: r.missingRequired,
          })),
      })),
      requiresOverride: existingByLedger.size > 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: `Could not read the workbook: ${msg}` }, 500);
  }
}
