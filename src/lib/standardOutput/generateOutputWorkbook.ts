// Writes the standard output metrics workbook.
//
// Authored from scratch, so normalizeSharedFormulas.ts is NOT needed and must
// not be imported: every path in it hunts `shareType === "shared"` /
// `sharedFormula` metadata, which Excel only writes when COMPRESSING repeated
// formulas in an existing file. A `new ExcelJS.Workbook()` never contains any.
//
// CELLS CARRY COMPUTED VALUES, NOT LIVE FORMULAS
//
// The four-state rendering is impossible with formulas: a formula's natural
// output for missing data is 0, which is the exact lie this design exists to
// prevent. The only formulas written are SUMs over cells this exporter itself
// wrote on the same sheet, for the FY-total column.
//
// It also diverges deliberately from exportEnvironment.ts:205-218, whose write()
// returns early on null because "leaving the template's own content in place is
// the honest outcome". An authored sheet has no prior content to leave, so
// silence there would be a blank cell indistinguishable from an unformatted one.
// Hence explicit `not filed` text.

import "server-only";

import ExcelJS from "exceljs";

import {
  FIRST_METRIC_COL,
  HEADER_ROWS,
  IDENTITY_COLUMNS,
  MONTH_LABELS,
  OUTPUT_TEMPLATE_VERSION,
  STATE_TEXT,
  numFmtFor,
  periodColumns,
  planSheets,
  type SheetPlan,
} from "./outputLayout";
import { resolveCell, returnFiled, type LoadedModel, type SiteRow } from "./outputData";

const BRAND = "FF074D47";
const HEAD_TEXT = "FFFFFFFF";
const AMBER = "FFB45309";
const AMBER_FILL = "FFFEF3C7";
const GREY_FILL = "FFF7F7F7";
const GROUP_FILL = "FFEFF6F5";
const MUTED = "FF808080";

export interface OutputReport {
  fiscalYear: string;
  sheets: string[];
  cellStates: { value: number; notFiled: number; notComputable: number; notApplicable: number };
  coverage: { siteMonthsFiled: number; siteMonthsExpected: number; pct: number };
  aggregatedSheets: string[];
  assumptionConstants: string[];
  assumptionFormulaCount: number;
}

export async function generateOutputWorkbook(
  model: LoadedModel
): Promise<{ buffer: Buffer; report: OutputReport }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Plato ESG";
  wb.created = new Date(model.generatedAt);

  const plans = planSheets(model.parameters);
  const states = { value: 0, notFiled: 0, notComputable: 0, notApplicable: 0 };

  const pct =
    model.coverage.siteMonthsExpected === 0
      ? 0
      : model.coverage.siteMonthsFiled / model.coverage.siteMonthsExpected;

  writeReadFirst(wb, model, pct, plans);
  writeSummary(wb, model, pct);
  for (const plan of plans) writeDetailSheet(wb, model, plan, states, pct);
  writeConstants(wb, model);
  writeAssumptions(wb, model);

  const out = await wb.xlsx.writeBuffer();

  return {
    buffer: Buffer.from(out),
    report: {
      fiscalYear: model.fiscalYear,
      sheets: wb.worksheets.map((w) => w.name),
      cellStates: states,
      coverage: { ...model.coverage, pct },
      aggregatedSheets: plans.filter((p) => p.aggregated).map((p) => p.name),
      assumptionConstants: model.constants.filter((c) => c.isAssumption).map((c) => c.key),
      assumptionFormulaCount: model.assumptionFormulas.length,
    },
  };
}

// ---------------------------------------------------------------------------

function writeReadFirst(
  wb: ExcelJS.Workbook,
  model: LoadedModel,
  pct: number,
  plans: SheetPlan[]
) {
  const ws = wb.addWorksheet("READ FIRST");
  ws.columns = [{ width: 3 }, { width: 108 }];

  let r = 2;
  const put = (text: string, kind: "title" | "head" | "body" = "body") => {
    const c = ws.getCell(r, 2);
    c.value = text;
    if (kind === "title") c.font = { bold: true, size: 15, color: { argb: BRAND } };
    else if (kind === "head") c.font = { bold: true, size: 11, color: { argb: BRAND } };
    else c.font = { size: 10 };
    c.alignment = { wrapText: true, vertical: "top" };
    r++;
  };

  put("Birla Estates — ESG metrics", "title");
  put(`Fiscal year ${model.fiscalYear} · generated ${model.generatedAt.slice(0, 10)} · template v${OUTPUT_TEMPLATE_VERSION}`);
  r++;

  // The coverage banner. Deliberately the first thing on the tab Excel opens.
  const banner = ws.getCell(r, 2);
  banner.value = `COVERAGE: ${model.coverage.siteMonthsFiled} of ${model.coverage.siteMonthsExpected} site-months filed (${Math.round(pct * 100)}%)`;
  banner.font = { bold: true, size: 13, color: { argb: HEAD_TEXT } };
  banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
  banner.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(r).height = 26;
  r += 2;

  put("What these figures are", "head");
  put(
    "Every figure in this workbook is the SUM OF THE RETURNS ACTUALLY FILED. It is not an estimate " +
      "of the full portfolio, and no gap has been balanced or inferred."
  );
  put(
    "A site-month with no return produces NO ROW — never a zero. So the sheets distinguish four " +
      "different facts, and they must not be read as the same thing:"
  );
  r++;
  put("    12.480                 a figure that was filed and computed.");
  put("    0                      a return was filed REPORTING ZERO. A real measurement.");
  put("    not filed              no return was received. Nothing is known.");
  put("    not computable         the input exists but arrives in a unit this model cannot convert.");
  put("    n/a                    the metric does not apply to that site.");
  r++;
  put(
    "Figures are therefore LOWER than a full-portfolio disclosure would be. That is correct, " +
      "not a defect — the gap is shown as a gap."
  );
  r++;

  // Aggregation, disclosed here as well as on the sheets themselves.
  const aggregated = plans.filter((p) => p.aggregated);
  if (aggregated.length) {
    put("Figures this export aggregated itself", "head");
    put(
      `The platform stores MONTHLY values only. BRSR discloses waste quarterly and air emissions ` +
        `half-yearly, and no quarterly or half-yearly figure exists upstream — so ${aggregated
          .map((p) => p.name)
          .join(" and ")} ${aggregated.length === 1 ? "is" : "are"} summed from their constituent ` +
        `months BY THIS EXPORT. Each such cell carries a "Months in period" count, and any period ` +
        `built from fewer than all its months is marked.`
    );
    r++;
  }

  put("Sites that filed", "head");
  const filedSites = model.sites.filter(
    (s) => !s.isGroup && [...model.filedSiteMonths].some((k) => k.startsWith(`${s.id}|`))
  );
  const missingSites = model.sites.filter(
    (s) => !s.isGroup && ![...model.filedSiteMonths].some((k) => k.startsWith(`${s.id}|`))
  );
  put(filedSites.length ? filedSites.map((s) => s.name).join(", ") : "None.");
  put("Sites with no return in this year", "head");
  put(missingSites.length ? missingSites.map((s) => s.name).join(", ") : "None.");
  r++;

  put("Before any figure here is disclosed", "head");
  put(
    `${model.constants.filter((c) => c.isAssumption).length} of ${model.constants.length} constants ` +
      `are still marked an assumption, and ${model.assumptionFormulas.length} formulas rest on one. ` +
      `See the CONSTANTS and ASSUMPTIONS sheets — both list what is outstanding.`
  );
}

function writeSummary(wb: ExcelJS.Workbook, model: LoadedModel, pct: number) {
  const ws = wb.addWorksheet("SUMMARY");
  ws.columns = [
    { width: 46 }, { width: 26 }, { width: 10 }, { width: 16 },
    { width: 18 }, { width: 12 }, { width: 12 }, { width: 70 },
  ];

  ws.getCell("A1").value = `Portfolio totals — FY ${model.fiscalYear}`;
  ws.getCell("A1").font = { bold: true, size: 13, color: { argb: BRAND } };
  ws.getCell("A2").value =
    `Coverage ${model.coverage.siteMonthsFiled}/${model.coverage.siteMonthsExpected} site-months ` +
    `(${Math.round(pct * 100)}%). Sums of filed returns, not estimates. See READ FIRST.`;
  ws.getCell("A2").font = { size: 9, italic: true, color: { argb: MUTED } };

  const headers = ["Metric", "Code", "Unit", `FY ${model.fiscalYear}`, "Coverage", "Coverage %", "Basis", "Notes"];
  const headRow = 4;
  headers.forEach((h, i) => {
    const c = ws.getCell(headRow, i + 1);
    c.value = h;
    c.font = { bold: true, size: 10, color: { argb: HEAD_TEXT } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });
  ws.views = [{ state: "frozen", ySplit: headRow }];

  const group = model.sites.find((s) => s.isGroup);
  let r = headRow + 1;
  let lastDomain = "";

  for (const p of model.parameters) {
    if (p.domain !== lastDomain) {
      const band = ws.getCell(r, 1);
      band.value = p.domain;
      band.font = { bold: true, size: 10, color: { argb: BRAND } };
      for (let c = 1; c <= 8; c++) {
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY_FILL } };
      }
      lastDomain = p.domain;
      r++;
    }

    ws.getCell(r, 1).value = p.label;
    ws.getCell(r, 1).font = { size: 10 };
    ws.getCell(r, 2).value = p.key;
    ws.getCell(r, 2).font = { size: 9, name: "Consolas", color: { argb: MUTED } };
    ws.getCell(r, 3).value = p.unit ?? "";
    ws.getCell(r, 3).font = { size: 9, color: { argb: MUTED } };

    const cell = group
      ? resolveCell(model, p, group, "annual", 1)
      : { state: "not_filed" as const, value: null };

    writeStateCell(ws.getCell(r, 4), cell, p.unit);

    // Coverage in site-MONTHS. sites_expected on a ytd row is month-summed
    // (resolve-birla.mjs:346-351), so "8 of 132 sites" would be nonsense.
    const cov = ws.getCell(r, 5);
    if (cell.state === "value" && cell.sitesExpected) {
      cov.value = `${cell.sitesReporting ?? 0}/${cell.sitesExpected} site-months`;
      cov.font = { size: 9 };
      const ratio = (cell.sitesReporting ?? 0) / cell.sitesExpected;
      const pc = ws.getCell(r, 6);
      pc.value = ratio;
      pc.numFmt = "0%";
      pc.font = { size: 9 };
      if (ratio < 0.25) {
        pc.font = { size: 9, bold: true, color: { argb: "FFB91C1C" } };
      } else if (ratio < 1) {
        pc.font = { size: 9, color: { argb: AMBER } };
      }
    } else {
      cov.value = "—";
      cov.font = { size: 9, color: { argb: MUTED } };
    }

    const basis = ws.getCell(r, 7);
    basis.value =
      cell.state === "not_computable"
        ? "Not computable"
        : model.assumptionFormulas.some((a) => a.outputKey === p.key)
          ? "Assumption"
          : "Computed";
    basis.font = {
      size: 9,
      color: { argb: basis.value === "Computed" ? MUTED : AMBER },
    };

    ws.getCell(r, 8).value = p.notes ?? "";
    ws.getCell(r, 8).font = { size: 9, color: { argb: MUTED } };
    ws.getCell(r, 8).alignment = { wrapText: true, vertical: "top" };

    r++;
  }

  ws.autoFilter = { from: { row: headRow, column: 1 }, to: { row: r - 1, column: 8 } };
}

function writeDetailSheet(
  wb: ExcelJS.Workbook,
  model: LoadedModel,
  plan: SheetPlan,
  states: OutputReport["cellStates"],
  pct: number
) {
  const ws = wb.addWorksheet(plan.name);

  // Flatten the bands into a metric column list, remembering each band's grain.
  const metrics = plan.bands.flatMap((b) =>
    b.parameters.map((p) => ({ param: p, band: b }))
  );

  ws.columns = [
    ...IDENTITY_COLUMNS.map((c) => ({ width: c.width })),
    ...metrics.map(() => ({ width: 15 })),
    { width: 16 }, // Months in period
  ];

  ws.getCell("A1").value = `${plan.name} — FY ${model.fiscalYear}`;
  ws.getCell("A1").font = { bold: true, size: 12, color: { argb: BRAND } };

  // Row 2 repeats coverage, so a reader who tabs straight here cannot escape it.
  const sub = ws.getCell("A2");
  sub.value =
    `Coverage ${model.coverage.siteMonthsFiled}/${model.coverage.siteMonthsExpected} site-months ` +
    `(${Math.round(pct * 100)}%). "not filed" means no return was received — it is not a zero.`;
  sub.font = { size: 9, italic: true, color: { argb: MUTED } };

  let r = 3;
  if (plan.aggregated) {
    const note = ws.getCell(r, 1);
    note.value =
      "AGGREGATED FROM MONTHLY ROWS BY THIS EXPORT. The platform stores monthly values only; " +
      "no figure at this grain exists upstream. The last column counts the months behind each period.";
    note.font = { bold: true, size: 9, color: { argb: AMBER } };
    note.alignment = { wrapText: true };
    r += 2;
  }

  const headRow = r;
  IDENTITY_COLUMNS.forEach((c, i) => {
    const cell = ws.getCell(headRow, i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 9, color: { argb: HEAD_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  metrics.forEach((m, i) => {
    const c1 = ws.getCell(headRow, FIRST_METRIC_COL + i);
    c1.value = m.param.label;
    c1.font = { bold: true, size: 9, color: { argb: HEAD_TEXT } };
    c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c1.alignment = { wrapText: true, vertical: "middle" };

    const c2 = ws.getCell(headRow + 1, FIRST_METRIC_COL + i);
    c2.value = `${m.param.key}${m.param.unit ? ` (${m.param.unit})` : ""}`;
    c2.font = { size: 8, name: "Consolas", color: { argb: MUTED } };
  });
  const monthsCol = FIRST_METRIC_COL + metrics.length;
  if (plan.aggregated) {
    const mc = ws.getCell(headRow, monthsCol);
    mc.value = "Months in period";
    mc.font = { bold: true, size: 9, color: { argb: HEAD_TEXT } };
    mc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    mc.alignment = { wrapText: true, vertical: "middle" };
  }

  ws.views = [{ state: "frozen", xSplit: IDENTITY_COLUMNS.length, ySplit: headRow + 1 }];

  // ---- Body --------------------------------------------------------------
  // Real sites alphabetically, GROUP last and visibly separated so a portfolio
  // total is never read as one more site.
  const ordered = [
    ...model.sites.filter((s) => !s.isGroup).sort((a, b) => a.code.localeCompare(b.code)),
    ...model.sites.filter((s) => s.isGroup),
  ];

  let row = headRow + HEADER_ROWS;

  for (const site of ordered) {
    // A sheet holding two grains lays each band's periods out separately, so a
    // monthly build-up and an annual component never share a column.
    for (const band of plan.bands) {
      const grain =
        band.frequency === "quarterly"
          ? ("quarter" as const)
          : band.frequency === "half_yearly"
            ? ("half" as const)
            : band.frequency === "annual"
              ? ("annual" as const)
              : ("month" as const);

      const periods = periodColumns(grain, model.fiscalYear);

      for (let pi = 0; pi < periods.length; pi++) {
        const periodIndex = pi + 1;
        const filed = returnFiled(model, site, grain, periodIndex);

        writeIdentity(ws, row, site, band.domain, periods[pi], grain, filed);

        let monthsFiled: number | null = null;
        let monthsInPeriod: number | null = null;

        metrics.forEach((m, i) => {
          const cell = ws.getCell(row, FIRST_METRIC_COL + i);
          // A metric from a different band leaves this row blank rather than
          // repeating a figure at the wrong grain.
          if (m.band !== band) {
            cell.value = null;
            return;
          }
          const resolved = resolveCell(model, m.param, site, grain, periodIndex);
          writeStateCell(cell, resolved, m.param.unit);
          states[
            resolved.state === "value"
              ? "value"
              : resolved.state === "not_filed"
                ? "notFiled"
                : resolved.state === "not_computable"
                  ? "notComputable"
                  : "notApplicable"
          ]++;
          if (resolved.monthsInPeriod != null) {
            monthsFiled = resolved.monthsFiled ?? 0;
            monthsInPeriod = resolved.monthsInPeriod;
          }
        });

        if (plan.aggregated && monthsInPeriod != null) {
          const mc = ws.getCell(row, monthsCol);
          mc.value = `${monthsFiled} of ${monthsInPeriod}`;
          mc.font = {
            size: 9,
            color: { argb: monthsFiled === monthsInPeriod ? MUTED : AMBER },
          };
          if (monthsFiled !== monthsInPeriod && monthsFiled !== 0) {
            mc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
          }
        }

        if (site.isGroup) {
          for (let c = 1; c <= monthsCol; c++) {
            const cc = ws.getCell(row, c);
            cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_FILL } };
            cc.font = { ...(cc.font ?? {}), bold: true };
          }
        }

        row++;
      }
    }
  }

  ws.autoFilter = { from: { row: headRow, column: 1 }, to: { row: row - 1, column: monthsCol } };
}

function writeIdentity(
  ws: ExcelJS.Worksheet,
  row: number,
  site: SiteRow,
  domain: string,
  periodLabel: string,
  grain: string,
  filed: boolean
) {
  const vals: (string | number)[] = [
    site.code,
    site.name,
    site.isGroup ? "portfolio" : site.assetType,
    site.region ?? "",
    site.isGroup ? "" : site.waterStressed ? "Yes" : "No",
    domain,
    periodLabel,
    grain,
    filed ? "Yes" : "NOT FILED",
  ];
  vals.forEach((v, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = v;
    c.font = { size: 9 };
  });
  if (!filed) {
    const c = ws.getCell(row, IDENTITY_COLUMNS.length);
    c.font = { size: 9, bold: true, color: { argb: AMBER } };
  }
}

/**
 * Writes a value or its state text.
 *
 * Text in a numeric column is deliberate: SUM ignores text, so a column total
 * stays arithmetically right while a reader sees a visibly non-numeric cell.
 * Writing 0 here instead would be both wrong and invisible.
 */
function writeStateCell(
  cell: ExcelJS.Cell,
  resolved: { state: string; value: number | null; monthsFiled?: number; monthsInPeriod?: number },
  unit: string | null
) {
  if (resolved.state !== "value") {
    cell.value = STATE_TEXT[resolved.state as keyof typeof STATE_TEXT];
    cell.font = {
      size: 9,
      italic: true,
      color: { argb: resolved.state === "not_computable" ? AMBER : MUTED },
    };
    cell.alignment = { horizontal: "right" };
    return;
  }

  cell.value = resolved.value;
  cell.numFmt = numFmtFor(unit);
  cell.font = { size: 9 };

  // A period built from fewer than all its months is marked in the cell itself,
  // not only in the count column — at ~10% coverage this is the common case, and
  // a number that looks like a quarter while covering one month is the reading
  // most likely to mislead.
  if (
    resolved.monthsInPeriod != null &&
    resolved.monthsFiled != null &&
    resolved.monthsFiled > 0 &&
    resolved.monthsFiled < resolved.monthsInPeriod
  ) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
  }
}

function writeConstants(wb: ExcelJS.Workbook, model: LoadedModel) {
  const ws = wb.addWorksheet("CONSTANTS");
  ws.columns = [
    { width: 24 }, { width: 30 }, { width: 34 }, { width: 12 }, { width: 14 },
    { width: 44 }, { width: 14 }, { width: 14 }, { width: 34 }, { width: 60 },
  ];

  ws.getCell("A1").value = "Emission factors, GWPs and conversions";
  ws.getCell("A1").font = { bold: true, size: 12, color: { argb: BRAND } };

  const assumptions = model.constants.filter((c) => c.isAssumption);
  ws.getCell("A2").value =
    assumptions.length > 0
      ? `${assumptions.length} of ${model.constants.length} values are still assumptions and must be ` +
        `confirmed against their source before these figures are disclosed. They are listed first.`
      : "Every value has been confirmed against its cited source.";
  ws.getCell("A2").font = { size: 9, italic: true, color: { argb: assumptions.length ? AMBER : MUTED } };

  const headers = ["Key", "Category", "Label", "Value", "Unit", "Source", "Source date", "Status", "Used by", "Notes"];
  const headRow = 4;
  headers.forEach((h, i) => {
    const c = ws.getCell(headRow, i + 1);
    c.value = h;
    c.font = { bold: true, size: 9, color: { argb: HEAD_TEXT } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });
  ws.views = [{ state: "frozen", ySplit: headRow }];

  // Assumptions first: they are the working list.
  const ordered = [...model.constants].sort(
    (a, b) => Number(b.isAssumption) - Number(a.isAssumption) || a.key.localeCompare(b.key)
  );

  let r = headRow + 1;
  for (const c of ordered) {
    ws.getCell(r, 1).value = c.key;
    ws.getCell(r, 1).font = { size: 9, name: "Consolas" };
    ws.getCell(r, 2).value = c.category;
    ws.getCell(r, 3).value = c.label;
    ws.getCell(r, 4).value = c.value;
    ws.getCell(r, 4).numFmt = "#,##0.####";
    ws.getCell(r, 5).value = c.unit ?? "";
    ws.getCell(r, 6).value = c.source ?? "";
    ws.getCell(r, 7).value = c.sourceDate ?? "";

    const status = ws.getCell(r, 8);
    status.value = c.isAssumption ? "ASSUMPTION" : "Confirmed";
    status.font = {
      size: 9,
      bold: c.isAssumption,
      color: { argb: c.isAssumption ? AMBER : BRAND },
    };

    // Empty is meaningful, and the reason differs per constant — say which.
    ws.getCell(r, 9).value = c.usedBy.length
      ? c.usedBy.join(", ")
      : c.key === "GWP.r22"
        ? "none — Montreal Protocol gas, disclosed as a quantity only"
        : c.key === "qa.anomaly_tolerance"
          ? "none — affects upload flagging, not a computed figure"
          : "none — no formula references this value";
    ws.getCell(r, 9).font = { size: 8, color: { argb: MUTED } };

    ws.getCell(r, 10).value = c.notes ?? "";
    ws.getCell(r, 10).font = { size: 8, color: { argb: MUTED } };
    ws.getCell(r, 10).alignment = { wrapText: true, vertical: "top" };

    for (let col = 1; col <= 10; col++) {
      ws.getCell(r, col).font = { ...(ws.getCell(r, col).font ?? { size: 9 }) };
      if (c.isAssumption) {
        ws.getCell(r, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: AMBER_FILL },
        };
      }
    }
    r++;
  }
}

function writeAssumptions(wb: ExcelJS.Workbook, model: LoadedModel) {
  const ws = wb.addWorksheet("ASSUMPTIONS");
  ws.columns = [{ width: 30 }, { width: 22 }, { width: 12 }, { width: 54 }, { width: 60 }];

  let r = 1;
  const head = (text: string) => {
    const c = ws.getCell(r, 1);
    c.value = text;
    c.font = { bold: true, size: 11, color: { argb: BRAND } };
    r += 1;
  };
  const body = (text: string) => {
    const c = ws.getCell(r, 1);
    c.value = text;
    c.font = { size: 9, color: { argb: MUTED } };
    c.alignment = { wrapText: true };
    r += 1;
  };

  head("Coverage");
  body(
    `${model.coverage.siteMonthsFiled} of ${model.coverage.siteMonthsExpected} site-months filed. ` +
      `Every figure is a sum of what was filed.`
  );
  r++;

  // ---- Coverage matrix: the most useful anti-misreading artefact here -----
  head("Which site-months were filed");
  const matrixHead = r;
  ws.getCell(matrixHead, 1).value = "Site";
  ws.getCell(matrixHead, 1).font = { bold: true, size: 9, color: { argb: HEAD_TEXT } };
  ws.getCell(matrixHead, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  MONTH_LABELS.forEach((m, i) => {
    const c = ws.getCell(matrixHead, i + 2);
    c.value = m.slice(0, 3);
    c.font = { bold: true, size: 8, color: { argb: HEAD_TEXT } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });
  const filedCol = MONTH_LABELS.length + 2;
  ws.getCell(matrixHead, filedCol).value = "Filed";
  ws.getCell(matrixHead, filedCol).font = { bold: true, size: 8, color: { argb: HEAD_TEXT } };
  ws.getCell(matrixHead, filedCol).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND },
  };
  r++;

  for (const site of model.sites.filter((s) => !s.isGroup)) {
    ws.getCell(r, 1).value = site.name;
    ws.getCell(r, 1).font = { size: 9 };
    let count = 0;
    for (let m = 1; m <= 12; m++) {
      const filed = model.filedSiteMonths.has(`${site.id}|${m}`);
      if (filed) count++;
      const c = ws.getCell(r, m + 1);
      c.value = filed ? "Y" : "—";
      c.alignment = { horizontal: "center" };
      c.font = { size: 8, color: { argb: filed ? BRAND : MUTED } };
      if (filed) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCF2EE" } };
      }
    }
    ws.getCell(r, filedCol).value = count;
    ws.getCell(r, filedCol).font = { size: 9, bold: count > 0 };
    r++;
  }
  r++;

  // ---- Metrics resting on an assumption ----------------------------------
  head("Metrics that rest on an assumption");
  body(
    "Derived at export time from the formula registry, so this list cannot go stale against the seed."
  );
  const aHead = r;
  ["Code", "Metric", "Unit", "Why it is an assumption", "Source reference"].forEach((h, i) => {
    const c = ws.getCell(aHead, i + 1);
    c.value = h;
    c.font = { bold: true, size: 9, color: { argb: HEAD_TEXT } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });
  r++;
  for (const a of model.assumptionFormulas) {
    ws.getCell(r, 1).value = a.outputKey;
    ws.getCell(r, 1).font = { size: 8, name: "Consolas" };
    ws.getCell(r, 2).value = a.label ?? "";
    ws.getCell(r, 2).font = { size: 9 };
    ws.getCell(r, 3).value = a.unit ?? "";
    ws.getCell(r, 3).font = { size: 9 };
    ws.getCell(r, 4).value = a.description ?? "";
    ws.getCell(r, 4).font = { size: 8, color: { argb: MUTED } };
    ws.getCell(r, 4).alignment = { wrapText: true, vertical: "top" };
    ws.getCell(r, 5).value = a.sourceRef ?? "";
    ws.getCell(r, 5).font = { size: 8, color: { argb: MUTED } };
    r++;
  }
  r++;

  // ---- Not computable ---------------------------------------------------
  if (model.notComputableKeys.size) {
    head("Disclosures this model cannot compute");
    body(
      "The activity data exists but arrives in a unit the disclosure cannot accept — used oil and " +
        "coolant in litres against a tonnage line, batteries and oil filters as counts. Each needs a " +
        "density or an average unit weight from the ESG team, after which it becomes a real figure."
    );
    for (const k of [...model.notComputableKeys].sort()) {
      ws.getCell(r, 1).value = k;
      ws.getCell(r, 1).font = { size: 8, name: "Consolas", color: { argb: AMBER } };
      r++;
    }
    r++;
  }

  // ---- Open data flags --------------------------------------------------
  if (model.openFlags.length) {
    head("Open data-quality flags");
    body("Raised during entry and not yet acknowledged. None of them blocked a save.");
    for (const f of model.openFlags) {
      ws.getCell(r, 1).value = `${f.site} ${f.period}`.trim();
      ws.getCell(r, 1).font = { size: 9 };
      ws.getCell(r, 2).value = f.ruleCode;
      ws.getCell(r, 2).font = { size: 8, name: "Consolas", color: { argb: MUTED } };
      ws.getCell(r, 4).value = f.message;
      ws.getCell(r, 4).font = { size: 8, color: { argb: MUTED } };
      ws.getCell(r, 4).alignment = { wrapText: true, vertical: "top" };
      r++;
    }
  }
}
