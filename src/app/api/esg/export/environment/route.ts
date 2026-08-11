// Downloads the BRSR Environment sheet populated with computed values.
//
// The response is the CLIENT'S OWN template workbook with our numbers written
// into its exact cells — not a generated lookalike. Layout, merged ranges,
// styling and the eight sheets we do not compute all survive.
//
//   GET /api/esg/export/environment?fy=2024-25            -> .xlsx download
//   GET /api/esg/export/environment?fy=2024-25&report=1   -> JSON change report
//
// The report exists because this export CHANGES PUBLISHED NUMBERS: it corrects
// five template defects and replaces 108 broken external-link formulas. Handing
// someone a workbook whose figures differ from last year's without telling them
// which cells moved, and why, would be indefensible.

import { NextRequest } from "next/server";
import { join } from "node:path";
import { access } from "node:fs/promises";

import { exportEnvironmentSheet } from "@/lib/brsrExport/exportEnvironment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// The template lives outside src/ so it is not bundled; it is the client's file,
// versioned alongside their data rather than in the app.
const TEMPLATE_PATH = join(
  process.cwd(),
  "birla-estates",
  "output",
  "Real Estate BRSR and IR Data template FY25 V1.xlsx"
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const fiscalYear = url.searchParams.get("fy") ?? "2024-25";
  const reportOnly = url.searchParams.get("report") === "1";

  try {
    await access(TEMPLATE_PATH);
  } catch {
    return json(
      {
        error:
          "The BRSR template workbook was not found on the server. It is expected at " +
          "birla-estates/output/Real Estate BRSR and IR Data template FY25 V1.xlsx.",
      },
      404
    );
  }

  try {
    const { buffer, report, filename } = await exportEnvironmentSheet(
      TEMPLATE_PATH,
      fiscalYear
    );

    if (reportOnly) return json(report);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
        // Surfaced so the UI can warn about thin evidence without a second
        // round-trip for the full report.
        "X-Export-Cells-Written": String(report.cellsWritten),
        "X-Export-Coverage": report.coverage
          ? `${report.coverage.siteMonthsFiled}/${report.coverage.siteMonthsExpected}`
          : "unknown",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[export/environment] failed", { fiscalYear, message });
    return json({ error: `Export failed: ${message}` }, 500);
  }
}
