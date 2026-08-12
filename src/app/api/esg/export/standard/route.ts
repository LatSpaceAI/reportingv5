// Downloads the standard ESG metrics workbook.
//
//   GET /api/esg/export/standard?fy=2024-25            -> .xlsx
//   GET /api/esg/export/standard?fy=2024-25&report=1   -> JSON summary
//
// UNLIKE /api/esg/export/environment, THIS HAS NO FILE DEPENDENCY.
//
// That route opens the client's own BRSR template from birla-estates/ — a
// gitignored directory — and 404s when it is absent. This one is authored from
// output_parameter, so it works on a fresh clone, needs nothing from the client,
// and is the export that can be exercised in CI.

import { NextRequest } from "next/server";

import { loadOutputModel } from "@/lib/standardOutput/outputData";
import { generateOutputWorkbook } from "@/lib/standardOutput/generateOutputWorkbook";
import { outputFilename } from "@/lib/standardOutput/outputLayout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  const fiscalYear = url.searchParams.get("fy") ?? "2024-25";
  const reportOnly = url.searchParams.get("report") === "1";

  // Validated because the sheet titles and filename are built from it.
  if (!/^\d{4}-\d{2}$/.test(fiscalYear)) {
    return json({ error: `'${fiscalYear}' is not a fiscal year like 2024-25.` }, 400);
  }

  try {
    const model = await loadOutputModel(fiscalYear);

    if (model.parameters.length === 0) {
      return json({ error: "No output parameters are configured." }, 500);
    }

    const { buffer, report } = await generateOutputWorkbook(model);

    if (reportOnly) return json(report);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${outputFilename(fiscalYear)}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        // Surfaced so the dialog can warn about thin evidence without a second
        // round trip for the full report.
        "X-Export-Coverage": `${report.coverage.siteMonthsFiled}/${report.coverage.siteMonthsExpected}`,
        "X-Export-Not-Filed": String(report.cellStates.notFiled),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[export/standard] failed", { fiscalYear, message });
    return json({ error: `Export failed: ${message}` }, 500);
  }
}
