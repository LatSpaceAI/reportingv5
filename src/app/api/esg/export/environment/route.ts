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

// The template must SHIP WITH THE DEPLOYMENT. It used to be read from
// birla-estates/output/, outside src/ — which worked locally and failed on
// Vercel for two compounding reasons: `*.xlsx` in .gitignore meant the file was
// never committed, and even committed it would not be traced into the lambda
// because nothing imports it. The canonical copy now lives inside src/ and is
// force-included via outputFileTracingIncludes in next.config.mjs.
//
// The old location is kept as a fallback so an existing local checkout (where
// the client drops updated templates) keeps working without a copy step.
const BUNDLED_TEMPLATE_PATH = join(
  process.cwd(),
  "src",
  "lib",
  "brsrExport",
  "template",
  "birla-estates-brsr-fy25-v1.xlsx"
);

const LEGACY_TEMPLATE_PATH = join(
  process.cwd(),
  "birla-estates",
  "output",
  "Real Estate BRSR and IR Data template FY25 V1.xlsx"
);

async function resolveTemplatePath(): Promise<string | null> {
  for (const candidate of [BUNDLED_TEMPLATE_PATH, LEGACY_TEMPLATE_PATH]) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

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

  const templatePath = await resolveTemplatePath();
  if (!templatePath) {
    return json(
      {
        error:
          "The BRSR template workbook was not found on the server. It is expected at " +
          "src/lib/brsrExport/template/birla-estates-brsr-fy25-v1.xlsx.",
      },
      404
    );
  }

  try {
    const { buffer, report, filename } = await exportEnvironmentSheet(
      templatePath,
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
