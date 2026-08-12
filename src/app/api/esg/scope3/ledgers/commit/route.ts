// Commits a previewed Scope 3 ledger upload into esg.s3_line.
//
//   POST /api/esg/scope3/ledgers/commit
//   { batchId, fiscalYear, overrideExisting? }
//
// Reads back what the PREVIEW recorded rather than re-parsing an upload, so what
// is committed is what was reviewed. The client sends a batch id, not data.
//
// COMMITTING DOES NOT COMPUTE.
//
//   The lines land with factor_key, quantity and emissions_t all null.
//   resolve-scope3.mjs fills them on its next run. An upload is evidence that
//   somebody filed data; a disclosure needs a resolver run standing behind it,
//   and writing a figure here would let a category total exist that no run ever
//   produced.
//
//   So the response says plainly that the figures are not yet computed, and
//   names the command that computes them.

import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  commitLedgerLines,
  type ResolvedLedgerRow,
  type ResolvedLedgerSheet,
} from "@/lib/scope3Ledger/ledgerService";
import { ledgerByCode } from "@/lib/scope3Ledger/ledgerLayout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CommitRequest {
  batchId: number;
  fiscalYear: string;
  overrideExisting?: boolean;
}

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
  let body: CommitRequest;
  try {
    body = (await req.json()) as CommitRequest;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { batchId, fiscalYear, overrideExisting } = body;
  if (!batchId || !fiscalYear) {
    return json({ ok: false, error: "batchId and fiscalYear are required" }, 400);
  }

  try {
    // ---- The batch must be committable -------------------------------------
    // Re-committing would double-supersede: the first commit already archived
    // the previous lines, so a second would archive the ones it just wrote and
    // leave nothing live.
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("import_batch")
      .select("id, status, filename, uploaded_by")
      .eq("id", batchId)
      .single();
    if (batchErr || !batch) return json({ ok: false, error: "Unknown import batch." }, 404);
    if (batch.status !== "preview") {
      return json({ ok: false, error: `That import was already ${batch.status}.` }, 409);
    }

    // ---- Read back what the preview recorded --------------------------------
    const rows: { source_label: string; raw_text: string }[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from("import_batch_row")
        .select("source_label, raw_text")
        .eq("batch_id", batchId)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as { source_label: string; raw_text: string }[]));
      if (!data || data.length < pageSize) break;
    }

    if (!rows.length) {
      return json(
        { ok: false, error: "That import recorded no rows. Re-upload the workbook." },
        422
      );
    }

    // ---- Rebuild the resolved sheets ----------------------------------------
    const byLedger = new Map<string, ResolvedLedgerRow[]>();
    const sheetNameByLedger = new Map<string, string>();

    for (const r of rows) {
      const ledger = String(r.source_label ?? "").split("|")[0];
      if (!ledger || !ledgerByCode(ledger)) continue;

      let payload: {
        attrs: Record<string, string | number>;
        siteId: number | null;
        periodId: number | null;
        lineNo: number;
        sheetRow: number;
        sheet: string;
        unresolvedSite: string | null;
        unresolvedMonth: string | null;
        unmappedValues: { column: string; value: string }[];
        missingRequired: string[];
      };
      try {
        payload = JSON.parse(r.raw_text);
      } catch {
        continue; // a row whose payload cannot be read is skipped, not guessed at
      }

      sheetNameByLedger.set(ledger, payload.sheet);
      if (!byLedger.has(ledger)) byLedger.set(ledger, []);
      byLedger.get(ledger)!.push({
        ledger,
        lineNo: payload.lineNo,
        sheetRow: payload.sheetRow,
        attrs: payload.attrs ?? {},
        siteName: null,
        month: null,
        missingRequired: payload.missingRequired ?? [],
        siteId: payload.siteId ?? null,
        periodId: payload.periodId ?? null,
        unmappedValues: payload.unmappedValues ?? [],
        unresolvedSite: payload.unresolvedSite ?? null,
        unresolvedMonth: payload.unresolvedMonth ?? null,
      });
    }

    const sheets: ResolvedLedgerSheet[] = [...byLedger.entries()].map(([ledger, rs]) => ({
      ledger,
      sheet: sheetNameByLedger.get(ledger) ?? ledger,
      title: ledgerByCode(ledger)?.title ?? ledger,
      rows: rs,
      blankCount: 0,
      unknownHeaders: [],
      missingHeaders: [],
    }));

    const result = await commitLedgerLines({
      fiscalYear,
      batchId,
      sourceBase: batch.filename as string,
      enteredBy: (batch.uploaded_by as string) ?? "esg-team",
      sheets,
      overrideExisting,
    });

    if (!result.ok) {
      return json(result, result.requiresOverride ? 409 : 422);
    }

    return json({
      ...result,
      fiscalYear,
      byLedger: result.byLedger.map((b) => ({
        ...b,
        title: ledgerByCode(b.ledger)?.title ?? b.ledger,
      })),
      // Said explicitly, because a screen that shows "247 lines saved" and
      // nothing else invites the reader to assume a figure now exists.
      computed: false,
      note:
        "Lines saved. Emissions are NOT yet computed — run the Scope 3 resolver " +
        "(npm run esg:resolve-scope3) to produce category totals. Until then these are " +
        "filed data, not a disclosure.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: `Could not commit the ledgers: ${msg}` }, 500);
  }
}
