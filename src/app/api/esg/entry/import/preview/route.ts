// Parse an uploaded monthly return and show what WOULD be saved.
//
// This route writes no input_value rows. It records a batch in 'preview' state
// so the parse is auditable even if the reviewer walks away, then returns every
// cell it read with its match, its conversion and any flags it raised.
//
// The site is always chosen by the user in the UI. The file's own header is
// parsed and offered as the default, but a header that says "Birla Tisya Site"
// is not proof the file belongs to Tisya — it is proof someone copied a
// template. The month is read from the file and is likewise confirmable.

import { NextRequest } from "next/server";
import { createHash } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseWorkbook } from "@/lib/siteEntry/importWorkbook";
import {
  resolveContext,
  loadPriorValues,
  loadAnomalyTolerance,
  loadExistingValues,
} from "@/lib/siteEntry/importService";
import { runValidations, type ParamValues } from "@/lib/siteEntry/validation";
import type { PreviewResponse, PreviewRow } from "@/lib/siteEntry/importTypes";
import type { DataFlag } from "@/lib/siteEntry/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The four real returns are 18-90 KB, so a plain multipart POST is well within
// the platform's body limit and needs no Blob detour. Guarded anyway.
const MAX_BYTES = 4 * 1024 * 1024;

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
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: "Expected a multipart upload." }, 400);
  }

  const file = form.get("file");
  const siteCode = String(form.get("siteCode") ?? "").trim();
  const fyOverride = String(form.get("fiscalYear") ?? "").trim();
  const monthOverride = Number(form.get("monthNo"));
  const uploadedBy = String(form.get("uploadedBy") ?? "").trim() || null;

  if (!(file instanceof File)) {
    return json({ ok: false, error: "No file was uploaded." }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json(
      { ok: false, error: `That file is ${(file.size / 1e6).toFixed(1)} MB; the limit is 4 MB.` },
      400
    );
  }
  if (!siteCode) {
    return json({ ok: false, error: "Choose the site this return belongs to." }, 400);
  }

  try {
    const bytes = await file.arrayBuffer();
    const fileHash = createHash("sha256").update(Buffer.from(bytes)).digest("hex");

    // The form layout depends on the month, and the month may come from the
    // file. Parse once against the current layout only to read the header,
    // then re-parse against the layout that actually applied for that month.
    const provisionalMonth = Number.isInteger(monthOverride) && monthOverride >= 1 ? monthOverride : null;
    const provisionalFy = fyOverride || null;

    // First pass with no fields: reads the header and enforces the
    // one-sheet rule without needing to know the form yet.
    const probe = await parseWorkbook(bytes, []);
    if (!probe.ok) {
      return json(
        { ok: false, error: probe.error, monthlySheetNames: probe.monthlySheetNames },
        422
      );
    }

    const detected = probe.sheet!.detectedPeriod;
    const fiscalYear = provisionalFy ?? detected.fiscalYear;
    const monthNo = provisionalMonth ?? detected.monthNo;

    if (!fiscalYear || !monthNo) {
      return json(
        {
          ok: false,
          error:
            "Could not read the reporting month from this file. Choose the month manually and upload again.",
          monthlySheetNames: probe.monthlySheetNames,
        },
        422
      );
    }

    const ctx = await resolveContext(siteCode, fiscalYear, monthNo);

    // Second pass, against the form that applied for THIS month.
    const parsed = await parseWorkbook(bytes, ctx.fields);
    if (!parsed.ok || !parsed.sheet) {
      return json(
        { ok: false, error: parsed.error, monthlySheetNames: parsed.monthlySheetNames },
        422
      );
    }
    const sheet = parsed.sheet;

    // ---- Aggregate to canonical parameter values, mirroring the save route --
    // Rows sharing an aggregate_key sum (Level 8 + Level 13; DG1..DG4).
    const fieldById = new Map(ctx.fields.map((f) => [f.fieldId, f]));
    const canonical: ParamValues = {};
    const notAvailable = new Set<string>();
    for (const cell of sheet.cells) {
      if (!cell.matchedFieldId || !cell.parameterKey) continue;
      if (cell.isNotAvailable) {
        if (!(cell.parameterKey in canonical)) notAvailable.add(cell.parameterKey);
        continue;
      }
      if (cell.canonicalValue == null) continue;
      canonical[cell.parameterKey] = (canonical[cell.parameterKey] ?? 0) + cell.canonicalValue;
      notAvailable.delete(cell.parameterKey);
    }

    // ---- Validate ----------------------------------------------------------
    const [priorValues, anomalyTolerance, existingValues] = await Promise.all([
      loadPriorValues(ctx.site.id, fiscalYear, monthNo),
      loadAnomalyTolerance(),
      loadExistingValues(ctx.site.id, ctx.period.id),
    ]);

    const requiredKeys = ctx.fields
      .filter((f) => f.isRequired && f.parameterKey)
      .map((f) => f.parameterKey!);
    const labelsByKey: Record<string, string> = {};
    for (const f of ctx.fields) if (f.parameterKey) labelsByKey[f.parameterKey] = f.label;

    const flags = runValidations({
      values: canonical,
      notAvailable,
      priorValues,
      requiredKeys,
      labelsByKey,
      anomalyTolerance,
    });

    const flagsByParam = new Map<string, DataFlag[]>();
    const formFlags: DataFlag[] = [];
    for (const fl of flags) {
      if (fl.parameterKey) {
        const list = flagsByParam.get(fl.parameterKey) ?? [];
        list.push(fl);
        flagsByParam.set(fl.parameterKey, list);
      } else {
        formFlags.push(fl);
      }
    }

    // ---- Record the batch --------------------------------------------------
    const matched = sheet.cells.filter((c) => c.matchedFieldId != null).length;
    const unmatched = sheet.cells.length - matched;

    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("import_batch")
      .insert({
        site_id: ctx.site.id,
        period_id: ctx.period.id,
        filename: file.name,
        sheet_name: sheet.sheetName,
        file_hash: fileHash,
        status: "preview",
        row_count: sheet.cells.length,
        matched_count: matched,
        unmatched_count: unmatched,
        uploaded_by: uploadedBy,
      })
      .select("id")
      .single();
    if (batchErr) throw batchErr;

    const batchId = batch.id as number;

    if (sheet.cells.length) {
      const { error: rowsErr } = await supabaseAdmin.from("import_batch_row").insert(
        sheet.cells.map((c) => ({
          batch_id: batchId,
          sheet_cell: c.sheetCell,
          source_label: c.sourceLabel,
          raw_text: c.rawText,
          matched_field_id: c.matchedFieldId,
          match_confidence: c.matchConfidence,
          parsed_value: c.parsedValue,
          unit_factor: c.unitFactor,
          canonical_value: c.canonicalValue,
          is_not_available: c.isNotAvailable,
        }))
      );
      if (rowsErr) throw rowsErr;
    }

    // ---- Shape the preview -------------------------------------------------
    const rows: PreviewRow[] = sheet.cells.map((c) => {
      const field = c.matchedFieldId ? fieldById.get(c.matchedFieldId) : undefined;
      const existing = c.parameterKey ? existingValues[c.parameterKey] : undefined;
      const existingValue = existing?.valueNum ?? null;
      const isChange =
        existing != null &&
        (existingValue == null
          ? c.canonicalValue != null
          : c.canonicalValue == null || Math.abs(existingValue - c.canonicalValue) > 1e-9);

      return {
        ...c,
        parameterUnit: field?.parameterUnit ?? null,
        formLabel: field?.label ?? null,
        existingValue,
        existingIsNotAvailable: existing?.isNotAvailable ?? false,
        isChange,
        flags: c.parameterKey ? flagsByParam.get(c.parameterKey) ?? [] : [],
      };
    });

    const existingCount = Object.keys(existingValues).length;
    let existingBlock: PreviewResponse["existing"] = null;
    if (existingCount > 0) {
      const [{ data: sub }, { data: prevBatch }] = await Promise.all([
        supabaseAdmin
          .from("site_submission")
          .select("status")
          .eq("site_id", ctx.site.id)
          .eq("period_id", ctx.period.id)
          .maybeSingle(),
        supabaseAdmin
          .from("import_batch")
          .select("id")
          .eq("site_id", ctx.site.id)
          .eq("period_id", ctx.period.id)
          .eq("status", "committed")
          .order("committed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const { data: meta } = await supabaseAdmin
        .from("input_value")
        .select("entered_by, updated_at")
        .eq("site_id", ctx.site.id)
        .eq("period_id", ctx.period.id)
        .is("superseded_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      existingBlock = {
        valueCount: existingCount,
        changedCount: rows.filter((r) => r.isChange).length,
        status: (sub?.status as string) ?? "draft",
        lastEnteredBy: (meta?.entered_by as string | null) ?? null,
        lastUpdatedAt: (meta?.updated_at as string | null) ?? null,
        previousBatchId: (prevBatch?.id as number | null) ?? null,
      };
    }

    // Did the file's own header name a site other than the one chosen?
    const detectedName = sheet.detectedSiteName?.toLowerCase() ?? "";
    const siteAmbiguous =
      detectedName.length > 0 &&
      !detectedName.includes(ctx.site.name.toLowerCase().replace(/^birla\s+/, "")) &&
      !ctx.site.name.toLowerCase().includes(detectedName.replace(/^birla\s+/, "").replace(/\s+site$/, ""));

    const response: PreviewResponse = {
      ok: true,
      batchId,
      filename: file.name,
      sheetName: sheet.sheetName,
      site: { code: ctx.site.code, name: ctx.site.name },
      period: {
        fiscalYear: ctx.period.fiscalYear,
        monthNo: ctx.period.monthNo,
        monthLabel: ctx.period.monthLabel,
      },
      form: { code: ctx.form.code, name: ctx.form.name },
      detected: {
        siteName: sheet.detectedSiteName,
        monthNo: detected.monthNo,
        fiscalYear: detected.fiscalYear,
        sourceText: detected.sourceText,
        siteAmbiguous,
      },
      rows,
      formFlags,
      existing: existingBlock,
      summary: {
        matched,
        unmatched,
        notAvailable: sheet.cells.filter((c) => c.isNotAvailable).length,
        anomalies: flags.filter((f) => f.ruleCode === "ANOMALY_VS_PRIOR").length,
        missingRequired: formFlags.filter((f) => f.ruleCode === "REQUIRED_FIELD_MISSING").length,
      },
    };

    return json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[entry/import/preview] failed", { siteCode, message });
    return json({ ok: false, error: message }, 500);
  }
}
