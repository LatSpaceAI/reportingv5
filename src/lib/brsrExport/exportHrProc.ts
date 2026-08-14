// Writes the HR and Procurement monthly-return figures into their tabs of the
// Birla template — the same workbook, in the same pass, as the Environment
// sheet. The cell map is the return layouts themselves
// (src/lib/hrProcReturn/), so ingestion and export can never disagree about
// where a figure lives.
//
// WHAT "LATEST MONTH" MEANS HERE
//
// The client fills these sheets cumulatively: each month's upload carries
// FY-to-date figures. So the export takes, per parameter, the value from the
// highest month that holds one — that IS the year-to-date — and a parameter
// nobody has filed yet writes nothing, leaving the template's own content in
// place ("no return" must never become "a measured zero").
//
// The DB read and the cell writing are separate functions so the offline test
// can drive the writer with a stubbed value index.

import "server-only";
import type ExcelJS from "exceljs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { RETURN_LAYOUTS } from "@/lib/hrProcReturn/layouts";
import { writeReturnSheets, type HrProcWriteResult, type ReturnValue } from "./writeHrProcSheets";

export type { HrProcWriteResult, ReturnValue };

/**
 * Latest-month value per parameter key for the fiscal year, GROUP site only.
 * NA rows are skipped — "not available" writes nothing and the earlier month's
 * figure (if any) stands, which is what a cumulative sheet means by it.
 */
export async function loadReturnValues(fiscalYear: string): Promise<Map<string, ReturnValue>> {
  const { data: group, error: gErr } = await supabaseAdmin
    .from("site")
    .select("id")
    .eq("is_group", true)
    .single();
  if (gErr || !group) throw new Error("GROUP site not found");

  const { data: periods, error: pErr } = await supabaseAdmin
    .from("period")
    .select("id, month_no")
    .eq("fiscal_year", fiscalYear)
    .eq("period_kind", "month");
  if (pErr) throw new Error(`periods: ${pErr.message}`);
  const monthByPeriodId = new Map<number, number>(
    (periods ?? []).map((p) => [p.id as number, p.month_no as number])
  );
  if (!monthByPeriodId.size) return new Map();

  const keys = RETURN_LAYOUTS.flatMap((l) => l.cells.map((c) => c.key));
  const { data: params, error: paramErr } = await supabaseAdmin
    .from("input_parameter")
    .select("id, key")
    .in("domain", ["HR", "PROCUREMENT"]);
  if (paramErr) throw new Error(`parameters: ${paramErr.message}`);
  const keyById = new Map<number, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((params ?? []) as any[])
      .filter((p) => keys.includes(p.key as string))
      .map((p) => [p.id as number, p.key as string])
  );
  if (!keyById.size) return new Map();

  const { data: values, error: vErr } = await supabaseAdmin
    .from("input_value")
    .select("parameter_id, period_id, value_num, value_text, is_not_available")
    .eq("site_id", group.id)
    .in("period_id", [...monthByPeriodId.keys()])
    .in("parameter_id", [...keyById.keys()])
    .is("superseded_at", null);
  if (vErr) throw new Error(`return values: ${vErr.message}`);

  const latest = new Map<string, ReturnValue>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const v of (values ?? []) as any[]) {
    const key = keyById.get(v.parameter_id as number);
    const monthNo = monthByPeriodId.get(v.period_id as number);
    if (!key || monthNo == null) continue;
    if (v.is_not_available) continue;
    const num = v.value_num == null ? null : Number(v.value_num);
    const text = (v.value_text as string | null) ?? null;
    if (num == null && text == null) continue;
    const cur = latest.get(key);
    if (cur && cur.monthNo >= monthNo) continue;
    latest.set(key, { num, text, monthNo });
  }
  return latest;
}

/** Load values and write both tabs. Called from the template export pass. */
export async function exportHrProcSheets(
  wb: ExcelJS.Workbook,
  fiscalYear: string
): Promise<HrProcWriteResult> {
  const values = await loadReturnValues(fiscalYear);
  return writeReturnSheets(wb, values);
}
