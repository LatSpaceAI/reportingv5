import "server-only";
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSharedFormulas } from "./normalizeSharedFormulas";
import {
  AIR_ROWS,
  AIR_SITE_COLUMNS,
  ENERGY_ROWS,
  ENVIRONMENT_SHEET,
  KNOWN_TEMPLATE_DEFECTS,
  REFRIGERANT_ROWS,
  REFRIGERANT_SITE_COLUMNS,
  STRESSED_ROWS,
  WASTE_ROWS,
  WATER_ROWS,
  type MonthlyRow,
} from "./environmentMap";

/**
 * Populate the real BRSR template with computed values.
 *
 * This opens the client's own workbook and writes into its exact cells rather
 * than generating a lookalike, so the delivered file keeps its layout, its 137
 * merged ranges, its styling, and the eight sheets we do not compute.
 *
 * Every write is recorded, and the caller gets a report of what changed, what
 * template defects were corrected, and — importantly — how thin the evidence
 * is. With most site-months still uncollected the output is legitimately
 * sparse; a cell we have no data for is LEFT ALONE rather than zeroed, because
 * writing 0 would assert a measurement nobody made.
 */

export interface ExportCellChange {
  sheet: string;
  cell: string;
  label: string;
  previous: string | number | null;
  written: number;
  /** True where we overwrote a formula (external link or defective). */
  replacedFormula: boolean;
}

export interface ExportReport {
  fiscalYear: string;
  generatedAt: string;
  cellsWritten: number;
  formulasReplaced: number;
  /** Shared-formula cells expanded to standalone before writing (see below). */
  sharedFormulasExpanded: number;
  changes: ExportCellChange[];
  /** Output keys with no computed value at all for this year. */
  missingKeys: string[];
  coverage: { siteMonthsFiled: number; siteMonthsExpected: number } | null;
  defectsCorrected: typeof KNOWN_TEMPLATE_DEFECTS;
}

export interface ExportResult {
  buffer: Buffer;
  report: ExportReport;
  filename: string;
}

interface ValueIndex {
  /** `${outputKey}|${periodId}` -> value */
  byKeyPeriod: Map<string, number>;
  monthIdByNo: Map<number, number>;
  quarterIds: Map<number, number[]>;
  ytdId: number | null;
}

/** Read every GROUP-level computed value for one fiscal year. */
async function loadValues(fiscalYear: string): Promise<ValueIndex> {
  const { data: group, error: gErr } = await supabaseAdmin
    .from("site")
    .select("id")
    .eq("is_group", true)
    .single();
  if (gErr || !group) throw new Error("GROUP site not found");

  const { data: periods, error: pErr } = await supabaseAdmin
    .from("period")
    .select("id, period_kind, month_no, quarter_no")
    .eq("fiscal_year", fiscalYear);
  if (pErr) throw new Error(`periods: ${pErr.message}`);

  const monthIdByNo = new Map<number, number>();
  const quarterIds = new Map<number, number[]>();
  let ytdId: number | null = null;
  for (const p of periods ?? []) {
    if (p.period_kind === "month" && p.month_no != null) {
      monthIdByNo.set(p.month_no as number, p.id as number);
      const q = p.quarter_no as number | null;
      if (q != null) {
        if (!quarterIds.has(q)) quarterIds.set(q, []);
        quarterIds.get(q)!.push(p.id as number);
      }
    } else if (p.period_kind === "ytd") {
      ytdId = p.id as number;
    }
  }

  const periodIds = [...monthIdByNo.values(), ...(ytdId ? [ytdId] : [])];
  const { data: values, error: vErr } = await supabaseAdmin
    .from("output_value")
    .select("period_id, value_num, parameter:parameter_id(key)")
    .eq("site_id", group.id)
    .in("period_id", periodIds);
  if (vErr) throw new Error(`output values: ${vErr.message}`);

  const byKeyPeriod = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const v of (values ?? []) as any[]) {
    const key = v.parameter?.key;
    if (!key || v.value_num == null) continue;
    byKeyPeriod.set(`${key}|${v.period_id}`, Number(v.value_num));
  }

  return { byKeyPeriod, monthIdByNo, quarterIds, ytdId };
}

/** Coverage for the year, straight from the submission table. */
async function loadCoverage(fiscalYear: string) {
  const [{ data: sites }, { data: periods }] = await Promise.all([
    supabaseAdmin.from("site").select("id").eq("is_group", false),
    supabaseAdmin
      .from("period")
      .select("id")
      .eq("fiscal_year", fiscalYear)
      .eq("period_kind", "month"),
  ]);
  const periodIds = (periods ?? []).map((p) => p.id as number);
  if (!periodIds.length) return null;

  const { data: subs } = await supabaseAdmin
    .from("site_submission")
    .select("site_id, period_id, status")
    .in("period_id", periodIds);

  const filed = (subs ?? []).filter((s) =>
    ["submitted", "under_review", "approved"].includes(s.status as string)
  ).length;
  return {
    siteMonthsFiled: filed,
    siteMonthsExpected: (sites ?? []).length * periodIds.length,
  };
}

/** Describe a cell's existing content for the diff report. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describe(value: any): { text: string | number | null; isFormula: boolean } {
  if (value == null) return { text: null, isFormula: false };
  if (typeof value === "object" && "formula" in value) {
    return { text: `=${value.formula}`, isFormula: true };
  }
  if (typeof value === "number" || typeof value === "string") {
    return { text: value, isFormula: false };
  }
  return { text: String(value), isFormula: false };
}

export async function exportEnvironmentSheet(
  templatePath: string,
  fiscalYear: string
): Promise<ExportResult> {
  const [index, coverage] = await Promise.all([
    loadValues(fiscalYear),
    loadCoverage(fiscalYear),
  ]);

  const wb = new ExcelJS.Workbook();
  // ExcelJS ships its own `Buffer` type that no longer unifies with Node's, so
  // hand it the raw bytes — `load` accepts an ArrayBuffer and this sidesteps the
  // type mismatch without a lie about the shape.
  const templateBytes = await readFile(templatePath);
  await wb.xlsx.load(
    templateBytes.buffer.slice(
      templateBytes.byteOffset,
      templateBytes.byteOffset + templateBytes.byteLength
    ) as ArrayBuffer
  );
  const ws = wb.getWorksheet(ENVIRONMENT_SHEET);
  if (!ws) throw new Error(`Sheet "${ENVIRONMENT_SHEET}" not found in the template`);

  // MUST run before any write. The template compresses repeated formulas into
  // shared groups (19 of them); overwriting a group's master orphans its clones
  // and ExcelJS then refuses to serialise the workbook at all. One of those
  // masters is E70 — a cell we specifically need to overwrite, because its
  // formula is one of the template's defects. Expanding first makes the writes
  // safe without changing what any formula computes.
  const sharedFormulasExpanded = normalizeSharedFormulas(ws);

  const changes: ExportCellChange[] = [];
  const missingKeys = new Set<string>();
  const seenKeys = new Set<string>();

  /**
   * Write one value, recording what was there before.
   *
   * A null value writes NOTHING. Leaving the template's own content in place is
   * the honest outcome for a period nobody reported: replacing it with 0 would
   * turn "no return" into "a measured zero".
   */
  const write = (cellRef: string, value: number | null, label: string) => {
    if (value == null) return;
    const cell = ws.getCell(cellRef);
    const before = describe(cell.value);
    cell.value = value;
    changes.push({
      sheet: ENVIRONMENT_SHEET,
      cell: cellRef,
      label,
      previous: before.text,
      written: value,
      replacedFormula: before.isFormula,
    });
  };

  const monthly = (rows: MonthlyRow[]) => {
    for (const r of rows) {
      seenKeys.add(r.key);
      let any = false;
      r.monthCols.forEach((col, i) => {
        const periodId = index.monthIdByNo.get(i + 1);
        if (periodId == null) return;
        const v = index.byKeyPeriod.get(`${r.key}|${periodId}`);
        if (v == null) return;
        any = true;
        write(`${col}${r.row}`, v, `${r.label} — ${MONTH_NAMES[i]}`);
      });
      if (r.fyCol && index.ytdId != null) {
        const fy = index.byKeyPeriod.get(`${r.key}|${index.ytdId}`);
        if (fy != null) write(`${r.fyCol}${r.row}`, fy, `${r.label} — FY total`);
      }
      if (!any) missingKeys.add(r.key);
    }
  };

  monthly(ENERGY_ROWS);
  monthly(WATER_ROWS);
  monthly(STRESSED_ROWS);

  // ---- Waste: quarterly, summed from the months in each quarter ------------
  for (const r of WASTE_ROWS) {
    seenKeys.add(r.key);
    let any = false;
    r.quarterCols.forEach((col, qi) => {
      const ids = index.quarterIds.get(qi + 1) ?? [];
      let sum = 0;
      let found = false;
      for (const pid of ids) {
        const v = index.byKeyPeriod.get(`${r.key}|${pid}`);
        if (v != null) {
          sum += v;
          found = true;
        }
      }
      if (!found) return;
      any = true;
      write(`${col}${r.row}`, sum, `${r.label} — Q${qi + 1}`);
    });
    if (index.ytdId != null) {
      const fy = index.byKeyPeriod.get(`${r.key}|${index.ytdId}`);
      if (fy != null) write(`${r.fyCol}${r.row}`, fy, `${r.label} — FY total`);
    }
    if (!any) missingKeys.add(r.key);
  }

  // ---- Air emissions: per site, half-yearly --------------------------------
  // Only written when a site actually has the data; the monthly EHS forms do
  // not carry an air-emissions block, so in practice these stay untouched
  // until half-yearly monitoring reports are entered.
  const siteHalfValues = await loadPerSiteHalfYear(fiscalYear, AIR_ROWS.map((r) => r.key));
  for (const r of AIR_ROWS) {
    seenKeys.add(r.key);
    let any = false;
    for (const s of AIR_SITE_COLUMNS) {
      const h1 = siteHalfValues.get(`${r.key}|${s.siteCode}|1`);
      const h2 = siteHalfValues.get(`${r.key}|${s.siteCode}|2`);
      if (h1 != null) {
        write(`${s.h1}${r.row}`, h1, `${r.label} — ${s.siteCode} H1`);
        any = true;
      }
      if (h2 != null) {
        write(`${s.h2}${r.row}`, h2, `${r.label} — ${s.siteCode} H2`);
        any = true;
      }
    }
    if (!any) missingKeys.add(r.key);
  }

  // ---- Refrigerants: per site, annual --------------------------------------
  const siteAnnual = await loadPerSiteAnnual(fiscalYear, REFRIGERANT_ROWS.map((r) => r.key));
  for (const r of REFRIGERANT_ROWS) {
    seenKeys.add(r.key);
    let any = false;
    for (const s of REFRIGERANT_SITE_COLUMNS) {
      const v = siteAnnual.get(`${r.key}|${s.siteCode}`);
      if (v == null) continue;
      write(`${s.col}${r.row}`, v, `${r.label} — ${s.siteCode}`);
      any = true;
    }
    if (!any) missingKeys.add(r.key);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  return {
    buffer,
    filename: `Real Estate BRSR and IR Data template FY${fiscalYear.replace("-", "")} (populated).xlsx`,
    report: {
      fiscalYear,
      generatedAt: new Date().toISOString(),
      cellsWritten: changes.length,
      formulasReplaced: changes.filter((c) => c.replacedFormula).length,
      sharedFormulasExpanded,
      changes,
      missingKeys: [...missingKeys].sort(),
      coverage,
      defectsCorrected: KNOWN_TEMPLATE_DEFECTS,
    },
  };
}

const MONTH_NAMES = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

/** Per-site half-year totals for the given output keys. */
async function loadPerSiteHalfYear(
  fiscalYear: string,
  keys: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!keys.length) return out;

  const { data, error } = await supabaseAdmin
    .from("output_value")
    .select(
      "value_num, site:site_id(code), period:period_id(fiscal_year, period_kind, half_no), parameter:parameter_id(key)"
    )
    .not("value_num", "is", null)
    .limit(20000);
  if (error) throw new Error(`per-site half-year values: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    if (r.period?.fiscal_year !== fiscalYear) continue;
    if (r.period?.period_kind !== "month") continue;
    const key = r.parameter?.key;
    const code = r.site?.code;
    const half = r.period?.half_no;
    if (!key || !code || !half || !keys.includes(key)) continue;
    const k = `${key}|${code}|${half}`;
    out.set(k, (out.get(k) ?? 0) + Number(r.value_num));
  }
  return out;
}

/** Per-site fiscal-year totals for the given output keys. */
async function loadPerSiteAnnual(
  fiscalYear: string,
  keys: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!keys.length) return out;

  const { data } = await supabaseAdmin
    .from("output_value")
    .select(
      "value_num, site:site_id(code, is_group), period:period_id(fiscal_year, period_kind), parameter:parameter_id(key)"
    )
    .not("value_num", "is", null)
    .limit(20000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    if (r.period?.fiscal_year !== fiscalYear) continue;
    if (r.period?.period_kind !== "ytd") continue;
    if (r.site?.is_group) continue;
    const key = r.parameter?.key;
    const code = r.site?.code;
    if (!key || !code || !keys.includes(key)) continue;
    out.set(`${key}|${code}`, Number(r.value_num));
  }
  return out;
}
