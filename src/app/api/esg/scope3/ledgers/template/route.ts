// Downloads the blank Scope 3 ledger workbook.
//
//   GET /api/esg/scope3/ledgers/template
//   GET /api/esg/scope3/ledgers/template?fy=2025-26
//   GET /api/esg/scope3/ledgers/template?fy=2025-26&ledger=waste
//
// GENERATED on every request, never served from disk: the site and month
// dropdowns come from the database, so a site added today appears in the next
// download with no deploy. The version stamp makes an out-of-date file a hard
// rejection at import rather than a silent mis-parse.
//
// `ledger` produces a single-sheet workbook. The nine ledgers are owned by five
// different teams — Procurement fills sheet 1, Site EHS fills 4 and 5, HR fills
// 6 and 7 — and sending each of them all nine sheets invites someone to fill in
// a sheet that is not theirs, on data they are guessing at.

import { NextRequest } from "next/server";

import { generateLedgerWorkbook } from "@/lib/scope3Ledger/generateLedger";
import { ledgerByCode, ledgerFilename, LEDGER_SHEETS } from "@/lib/scope3Ledger/ledgerLayout";
import { loadSiteOptions, loadMonthOptions } from "@/lib/scope3Ledger/ledgerService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const fiscalYear = url.searchParams.get("fy") ?? DEFAULT_FY;
  const ledger = url.searchParams.get("ledger");

  if (!/^\d{4}-\d{2}$/.test(fiscalYear)) {
    return json({ error: `'${fiscalYear}' is not a fiscal year like 2025-26.` }, 400);
  }
  if (ledger && !ledgerByCode(ledger)) {
    return json(
      {
        error: `Unknown ledger '${ledger}'.`,
        known: LEDGER_SHEETS.map((l) => l.code),
      },
      400
    );
  }

  try {
    const [siteOptions, monthOptions] = await Promise.all([
      loadSiteOptions(),
      loadMonthOptions(fiscalYear),
    ]);

    // A fiscal year with no month periods would produce a workbook whose month
    // dropdowns are empty, and every dated row would then fail to resolve. Said
    // plainly rather than shipping a template that cannot be filled correctly.
    if (monthOptions.length === 0) {
      return json(
        {
          error:
            `No month periods exist for ${fiscalYear}, so the month dropdowns would be empty. ` +
            `Seed the fiscal year in 03_dimensions_seed.sql first.`,
        },
        409
      );
    }

    const buffer = await generateLedgerWorkbook({
      fiscalYear,
      siteOptions,
      monthOptions,
      generatedAt: new Date().toISOString(),
      onlyLedger: ledger ?? undefined,
    });

    const filename = ledgerFilename(fiscalYear, ledger ?? undefined);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `Could not build the ledger workbook: ${msg}` }, 500);
  }
}
