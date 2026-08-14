// Parses an uploaded HR/Procurement monthly workbook and returns it for review.
//
//   POST /api/esg/hr-proc/preview   (multipart: file, fy, monthNo)
//
// The workbook may carry either return sheet or both; each sheet found is
// previewed. The month is an explicit input — the files carry no
// machine-readable period (a filename like "BRSR - HR - 15.04" is a human
// convention), and guessing would file a month wrong silently.
//
// Nothing is written to input_value here. Every parsed cell is recorded as an
// import_batch_row so the commit step consumes exactly what the reviewer saw,
// and the logbook shows the upload even if nobody commits it.

import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseReturnWorkbook } from "@/lib/hrProcReturn/parseReturn";
import { SOURCE_LABEL_SEP } from "@/lib/standardTemplate/templateLayout";
import {
  accumulate,
  existingCountsByDomain,
  loadDomainParameters,
  resolveTarget,
} from "@/lib/hrProcReturn/returnService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  let fiscalYear = "";
  let monthNo = NaN;

  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
    const fy = form.get("fy");
    if (typeof fy === "string") fiscalYear = fy;
    const m = form.get("monthNo");
    if (typeof m === "string") monthNo = Number(m);
  } catch {
    return json({ ok: false, error: "Expected a multipart upload with a 'file' field." }, 400);
  }

  if (!file) return json({ ok: false, error: "No file was uploaded." }, 400);
  if (!fiscalYear || !Number.isInteger(monthNo) || monthNo < 1 || monthNo > 12) {
    return json({ ok: false, error: "A fiscal year and month are required." }, 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseReturnWorkbook(buffer);
    if (!parsed.ok || !parsed.sheets) {
      return json({ ok: false, error: parsed.error ?? "The file could not be read." }, 422);
    }

    const resolved = await resolveTarget(fiscalYear, monthNo);
    if (!resolved.ok) return json({ ok: false, error: resolved.error }, 422);
    const { site, period } = resolved.target;

    const params = await loadDomainParameters();
    if (params.idByKey.size === 0) {
      return json(
        {
          ok: false,
          error:
            "The HR/Procurement parameters are not seeded in this database yet. " +
            "Apply supabase/esg/17_hr_procurement_inputs.sql and retry.",
        },
        422
      );
    }

    const allCells = parsed.sheets.flatMap((s) => s.cells.map((c) => ({ sheet: s, cell: c })));
    const unknownKeys = [...new Set(allCells.map(({ cell }) => cell.key))].filter(
      (k) => !params.idByKey.has(k)
    );

    if (allCells.length === 0) {
      return json(
        { ok: false, error: "The sheet was recognised but every declared cell was blank." },
        422
      );
    }

    // ---- Record the upload -------------------------------------------------
    const sheetTitles = parsed.sheets.map((s) => s.title).join(" + ");
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("import_batch")
      .insert({
        site_id: site.id,
        period_id: period.id,
        filename: file.name,
        sheet_name: parsed.sheets.map((s) => s.sheetName).join(", "),
        status: "preview",
        uploaded_by: "esg-team",
        row_count: allCells.length,
        matched_count: allCells.length - unknownKeys.length,
        unmatched_count: unknownKeys.length,
        note: `HR/Proc monthly return · ${sheetTitles}`,
      })
      .select("id")
      .single();
    if (batchErr) throw batchErr;
    const batchId = batch.id as number;

    // One import_batch_row per parsed cell; parse problems are recorded too so
    // the audit trail shows what the reviewer was warned about.
    const batchRows = allCells.map(({ sheet, cell }) => ({
      batch_id: batchId,
      sheet_cell: `${sheet.sheetName}!${cell.sheetCell}`,
      source_label: `${cell.key}${SOURCE_LABEL_SEP}${cell.label}`,
      raw_text: cell.rawText,
      matched_field_id: null,
      match_confidence: params.idByKey.has(cell.key)
        ? cell.matchedByLabel
          ? "exact"
          : "fuzzy"
        : "unmatched",
      parsed_value: cell.value,
      unit_factor: 1,
      canonical_value: cell.value,
      is_not_available: cell.isNotAvailable,
    }));
    for (const sheet of parsed.sheets) {
      for (const u of sheet.unparsedCells) {
        batchRows.push({
          batch_id: batchId,
          sheet_cell: `${sheet.sheetName}!${u.sheetCell}`,
          source_label: `${u.key}${SOURCE_LABEL_SEP}${u.label}`,
          raw_text: u.rawText,
          matched_field_id: null,
          match_confidence: "unmatched",
          parsed_value: null,
          unit_factor: 1,
          canonical_value: null,
          is_not_available: false,
        });
      }
      for (const o of sheet.listOverflow) {
        batchRows.push({
          batch_id: batchId,
          sheet_cell: `${sheet.sheetName}!B${o.row}`,
          source_label: `${SOURCE_LABEL_SEP}${o.name || "(unnamed list row)"}`,
          raw_text: o.name,
          matched_field_id: null,
          match_confidence: "unmatched",
          parsed_value: null,
          unit_factor: 1,
          canonical_value: null,
          is_not_available: false,
        });
      }
    }

    for (let i = 0; i < batchRows.length; i += 500) {
      const { error: rowsErr } = await supabaseAdmin
        .from("import_batch_row")
        .insert(batchRows.slice(i, i + 500));
      if (rowsErr) throw rowsErr;
    }

    // ---- Existing data, per domain, so the override warning names its scope --
    const existing = await existingCountsByDomain(site.id, period.id, params);

    const accumulated = accumulate(parsed.sheets);

    return json({
      ok: true,
      batchId,
      filename: file.name,
      site: { code: site.code, name: site.name },
      period: {
        fiscalYear: period.fiscalYear,
        monthNo: period.monthNo,
        monthLabel: period.monthLabel,
      },
      sheets: parsed.sheets.map((sheet) => ({
        sheetName: sheet.sheetName,
        title: sheet.title,
        domain: sheet.domain,
        warnings: {
          blocksNotFound: sheet.blocksNotFound,
          rowLabelMismatches: sheet.rowLabelMismatches,
          listOverflow: sheet.listOverflow,
          unparsedCells: sheet.unparsedCells,
        },
        rows: sheet.cells.map((c) => ({
          key: c.key,
          label: c.label,
          cell: c.sheetCell,
          templateCell: c.templateCell,
          kind: c.kind,
          value: c.value,
          text: c.text,
          isNotAvailable: c.isNotAvailable,
          matchedByLabel: c.matchedByLabel,
          known: params.idByKey.has(c.key),
        })),
        summary: {
          filled: sheet.cells.length,
          notAvailable: sheet.cells.filter((c) => c.isNotAvailable).length,
          reportedZero: sheet.cells.filter((c) => c.value === 0).length,
          text: sheet.cells.filter((c) => c.text != null).length,
          blank: sheet.blankCount,
          problems:
            sheet.blocksNotFound.length +
            sheet.rowLabelMismatches.length +
            sheet.listOverflow.length +
            sheet.unparsedCells.length,
        },
        existingValues: existing[sheet.domain] ?? 0,
      })),
      unknownKeys,
      requiresOverride: parsed.sheets.some((s) => (existing[s.domain] ?? 0) > 0),
      totals: {
        filled: accumulated.size,
        unknown: unknownKeys.length,
      },
    });
  } catch (err) {
    // Supabase errors are plain objects with a .message, not Error instances.
    const message =
      err instanceof Error
        ? err.message
        : ((err as { message?: string })?.message ?? String(err));
    console.error("[hr-proc/preview] failed", { message });
    return json({ ok: false, error: message }, 500);
  }
}
