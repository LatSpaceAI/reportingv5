// Downloads the blank standard input template.
//
//   GET /api/esg/entry/template
//   GET /api/esg/entry/template?site=TRIMAYA&fy=2025-26&month=6
//
// The workbook is GENERATED from esg.input_parameter on every request, not
// served from disk. So a newly seeded parameter appears in the next download
// with no deploy, and a stale template can never circulate — the version stamp
// makes an out-of-date file a hard rejection at import rather than a silent
// mis-parse.
//
// Every query parameter is optional. With none, this is a blank template whose
// site and month dropdowns are filled in but unselected, which is what the
// "download a blank return" link needs.

import { NextRequest } from "next/server";

import { generateTemplate } from "@/lib/standardTemplate/generateTemplate";
import { templateFilename } from "@/lib/standardTemplate/templateLayout";
import {
  loadTemplateParameters,
  loadSiteOptions,
  loadMonthOptions,
} from "@/lib/standardTemplate/standardService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Default fiscal year for a blank template. */
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
  const siteCode = url.searchParams.get("site");
  const fiscalYear = url.searchParams.get("fy") ?? DEFAULT_FY;
  const monthParam = url.searchParams.get("month");

  if (!/^\d{4}-\d{2}$/.test(fiscalYear)) {
    return json({ error: `'${fiscalYear}' is not a fiscal year like 2025-26.` }, 400);
  }

  try {
    const [parameters, siteOptions, monthOptions] = await Promise.all([
      loadTemplateParameters(),
      loadSiteOptions(),
      loadMonthOptions(fiscalYear),
    ]);

    if (parameters.length === 0) {
      return json(
        { error: "No active input parameters are configured, so a template would be empty." },
        500
      );
    }
    if (monthOptions.length === 0) {
      return json(
        {
          error:
            `No monthly periods exist for ${fiscalYear}. Seed the fiscal year before ` +
            `issuing templates for it.`,
        },
        400
      );
    }

    const site = siteCode
      ? siteOptions.find((s) => s.code === siteCode) ?? null
      : null;
    if (siteCode && !site) {
      return json({ error: `Unknown site '${siteCode}'.` }, 404);
    }

    const monthNo = monthParam ? Number(monthParam) : NaN;
    const period = Number.isInteger(monthNo)
      ? monthOptions.find((m) => m.monthNo === monthNo) ?? null
      : null;
    if (monthParam && !period) {
      return json({ error: `'${monthParam}' is not a month of ${fiscalYear}.` }, 400);
    }

    const buffer = await generateTemplate({
      parameters,
      site,
      fiscalYear,
      period,
      siteOptions,
      monthOptions,
      generatedAt: new Date().toISOString(),
    });

    const filename = templateFilename(
      site?.code ?? null,
      fiscalYear,
      period?.monthLabel ?? null
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[entry/template] failed", { siteCode, fiscalYear, message });
    return json({ error: `Could not build the template: ${message}` }, 500);
  }
}
